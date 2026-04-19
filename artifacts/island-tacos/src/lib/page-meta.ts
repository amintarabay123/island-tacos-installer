export function setPageMeta(title: string, emoji: string) {
  document.title = title;

  // Render emoji to a 256x256 PNG (used for browser tab favicon + iOS touch icon)
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Dark rounded background (matches manifest background_color)
  ctx.fillStyle = "#0D0F17";
  const r = 40;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(256 - r, 0);
  ctx.arcTo(256, 0, 256, r, r);
  ctx.lineTo(256, 256 - r);
  ctx.arcTo(256, 256, 256 - r, 256, r);
  ctx.lineTo(r, 256);
  ctx.arcTo(0, 256, 0, 256 - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.font = "180px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 128, 140);

  const dataUrl = canvas.toDataURL("image/png");

  // Browser tab favicon
  let favLink = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-dynamic]');
  if (!favLink) {
    favLink = document.createElement("link");
    favLink.rel = "icon";
    favLink.setAttribute("data-dynamic", "1");
    document.head.appendChild(favLink);
  }
  favLink.href = dataUrl;

  // iOS "Add to Homescreen" touch icon — iOS reads these at share-sheet time, after JS runs
  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach(l => l.remove());
  const touchLink = document.createElement("link");
  touchLink.rel = "apple-touch-icon";
  touchLink.sizes = "256x256";
  touchLink.href = dataUrl;
  document.head.appendChild(touchLink);
}
