import { Router, type IRouter } from "express";
import net from "net";

const router: IRouter = Router();

function buildEscPos(lines: { text: string; bold?: boolean; center?: boolean; size?: "normal" | "large" | "small"; divider?: boolean }[]): Buffer {
  const ESC = 0x1b;
  const GS = 0x1d;
  const chunks: Buffer[] = [];

  const cmd = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
  const text = (str: string) => chunks.push(Buffer.from(str + "\n", "utf8"));

  // Initialize
  cmd(ESC, 0x40);
  // Set UTF-8 code page
  cmd(ESC, 0x74, 0x10);

  for (const line of lines) {
    if (line.divider) {
      cmd(ESC, 0x61, 0x01); // center
      text("--------------------------------");
      continue;
    }

    // Alignment
    cmd(ESC, 0x61, line.center ? 0x01 : 0x00);

    // Bold
    cmd(ESC, 0x45, line.bold ? 1 : 0);

    // Size
    if (line.size === "large") {
      cmd(GS, 0x21, 0x11); // double width+height
    } else if (line.size === "small") {
      cmd(GS, 0x21, 0x00);
      cmd(ESC, 0x21, 0x01); // small font
    } else {
      cmd(GS, 0x21, 0x00);
      cmd(ESC, 0x21, 0x00);
    }

    text(line.text || "");
  }

  // Reset
  cmd(ESC, 0x61, 0x00);
  cmd(ESC, 0x45, 0);
  cmd(GS, 0x21, 0x00);
  cmd(ESC, 0x21, 0x00);

  // Feed and cut
  cmd(ESC, 0x64, 0x04); // feed 4 lines
  cmd(GS, 0x56, 0x42, 0x00); // full cut

  return Buffer.concat(chunks);
}

router.post("/print/network", async (req, res): Promise<void> => {
  const { ip, port = 9100, lines } = req.body as {
    ip: string;
    port?: number;
    lines: { text: string; bold?: boolean; center?: boolean; size?: string; divider?: boolean }[];
  };

  if (!ip || !lines) {
    res.status(400).json({ error: "ip and lines required" });
    return;
  }

  const data = buildEscPos(lines as Parameters<typeof buildEscPos>[0]);

  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "Connection timed out" });
    }, 5000);

    socket.connect(port, ip, () => {
      socket.write(data, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: true });
      });
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ ok: false, error: err.message });
    });
  });

  if (result.ok) {
    res.json({ ok: true });
  } else {
    res.status(502).json({ ok: false, error: result.error });
  }
});

export default router;
