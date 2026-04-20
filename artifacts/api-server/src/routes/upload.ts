import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

router.post("/upload", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    // Step 1: get a presigned PUT URL from Replit sidecar
    const presignedUrl = await objectStorageService.getObjectEntityUploadURL();

    // Step 2: PUT the file buffer directly to GCS via the presigned URL
    const putResponse = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": req.file.mimetype },
      body: req.file.buffer,
    });

    if (!putResponse.ok) {
      const text = await putResponse.text().catch(() => "");
      console.error("GCS PUT failed:", putResponse.status, text);
      res.status(500).json({ error: "Upload to storage failed" });
      return;
    }

    // Step 3: normalize the GCS URL → /objects/... path
    const objectPath = objectStorageService.normalizeObjectEntityPath(presignedUrl);

    // Return the serving URL that goes through our /storage/objects route
    res.json({ url: `/api/storage${objectPath}` });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Serve objects from GCS
router.get("/storage/objects/*objectPath", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.params.objectPath;
    const entityPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${entityPath}`;

    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(file, 31536000);

    // Pipe the Web Response body to the Express response
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
    res.setHeader("Cache-Control", response.headers.get("Cache-Control") || "public, max-age=31536000, immutable");

    if (!response.body) {
      res.status(404).end();
      return;
    }

    const { Readable } = await import("stream");
    const readable = Readable.fromWeb(response.body as any);
    readable.pipe(res);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Not found" });
    } else {
      console.error("Serve error:", err);
      res.status(500).json({ error: "Failed to serve file" });
    }
  }
});

export default router;
