import { Router } from "express";
import { getStoreSettings } from "../lib/store-settings";

const router = Router();

const ADMIN_PATH = process.env["ADMIN_PATH"] ?? "admin";

const storeIcons = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
];

const posIcons = [
  { src: "/icon-pos-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-pos-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  { src: "/icon-pos.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
];

const kdsIcons = [
  { src: "/icon-kds-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-kds-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  { src: "/icon-kds.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
];

const adminIcons = [
  { src: "/icon-admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-admin-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  { src: "/icon-admin.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
];

const displayIcons = [
  { src: "/icon-display-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-display-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
];

router.get("/manifest.webmanifest", async (req, res) => {
  const referer = req.headers["referer"] ?? req.headers["referrer"] ?? "";
  let pathname = "";
  try { pathname = new URL(String(referer)).pathname; } catch { /* no-op */ }

  const store = await getStoreSettings().catch(() => ({ storeName: "Restaurant" }));
  const n = store.storeName;

  let manifest: object;

  if (pathname.includes("/pos")) {
    manifest = {
      name: `${n} — POS`,
      short_name: "POS",
      description: `${n} point-of-sale terminal`,
      start_url: `/${ADMIN_PATH}/pos`,
      scope: `/${ADMIN_PATH}/`,
      display: "standalone",
      background_color: "#0F1D44",
      theme_color: "#4A90D9",
      orientation: "landscape",
      categories: ["business", "productivity"],
      icons: posIcons,
    };
  } else if (pathname.includes("/kitchen")) {
    manifest = {
      name: `${n} — Kitchen`,
      short_name: "Kitchen",
      description: `${n} kitchen display system`,
      start_url: `/${ADMIN_PATH}/kitchen`,
      scope: `/${ADMIN_PATH}/`,
      display: "standalone",
      background_color: "#0A2818",
      theme_color: "#22C55E",
      orientation: "landscape",
      categories: ["business", "productivity"],
      icons: kdsIcons,
    };
  } else if (pathname.includes("/display")) {
    manifest = {
      name: `${n} — Display`,
      short_name: "Display",
      description: `${n} customer-facing display`,
      start_url: "/display",
      scope: "/display",
      display: "standalone",
      background_color: "#0A2E35",
      theme_color: "#1A7A8A",
      orientation: "landscape",
      categories: ["business"],
      icons: displayIcons,
    };
  } else if (pathname.startsWith(`/${ADMIN_PATH}`)) {
    manifest = {
      name: `${n} — Admin`,
      short_name: "Admin",
      description: `${n} admin dashboard`,
      start_url: `/${ADMIN_PATH}`,
      scope: `/${ADMIN_PATH}/`,
      display: "standalone",
      background_color: "#2B0D4A",
      theme_color: "#9B59B6",
      orientation: "portrait-primary",
      categories: ["business", "productivity"],
      icons: adminIcons,
    };
  } else {
    manifest = {
      name: n,
      short_name: n,
      description: `Order online at ${n}`,
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
          icons: [{ src: "/icon-192.png", sizes: "192x192" }],
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
