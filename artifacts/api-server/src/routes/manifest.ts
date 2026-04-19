import { Router } from "express";

const router = Router();

const ADMIN_PATH = process.env["ADMIN_PATH"] ?? "it-dav7dwn8";

const storeIcons = [
  { src: "/logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
];

const posIcons = [
  { src: "/icon-pos.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

const kdsIcons = [
  { src: "/icon-kds.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

router.get("/manifest.webmanifest", (req, res) => {
  const referer = req.headers["referer"] ?? req.headers["referrer"] ?? "";
  let pathname = "";
  try { pathname = new URL(String(referer)).pathname; } catch { /* no-op */ }

  let manifest: object;

  if (pathname.startsWith(`/${ADMIN_PATH}/pos`) || pathname.includes("/pos")) {
    manifest = {
      name: "Island Tacos — POS",
      short_name: "IT POS",
      description: "Island Tacos point-of-sale terminal",
      start_url: `/${ADMIN_PATH}/pos`,
      scope: `/${ADMIN_PATH}/`,
      display: "standalone",
      background_color: "#0D0F17",
      theme_color: "#F59E0B",
      orientation: "landscape",
      categories: ["business", "productivity"],
      icons: posIcons,
    };
  } else if (pathname.startsWith(`/${ADMIN_PATH}/kitchen`) || pathname.includes("/kitchen")) {
    manifest = {
      name: "Island Tacos — Kitchen",
      short_name: "IT Kitchen",
      description: "Island Tacos kitchen display system",
      start_url: `/${ADMIN_PATH}/kitchen`,
      scope: `/${ADMIN_PATH}/`,
      display: "standalone",
      background_color: "#0D0F17",
      theme_color: "#22C55E",
      orientation: "landscape",
      categories: ["business", "productivity"],
      icons: kdsIcons,
    };
  } else {
    manifest = {
      name: "Island Tacos",
      short_name: "Island Tacos",
      description: "Order fresh Mexican food online — Wickhams Cay 1, Road Town, BVI",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#1A0C00",
      theme_color: "#F5A623",
      orientation: "any",
      categories: ["food", "restaurants"],
      icons: storeIcons,
      shortcuts: [
        {
          name: "Order Now",
          short_name: "Order",
          description: "Place a new order",
          url: "/",
          icons: [{ src: "/logo.png", sizes: "192x192" }],
        },
      ],
    };
  }

  res
    .header("Content-Type", "application/manifest+json")
    .header("Cache-Control", "no-store")
    .json(manifest);
});

export default router;
