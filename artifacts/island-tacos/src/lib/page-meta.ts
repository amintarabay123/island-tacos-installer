export function setPageMeta(
  title: string,
  emoji: string,
  opts?: { iconUrl?: string; manifestUrl?: string },
) {
  document.title = title;

  // Swap the PWA manifest so "Add to Home Screen" picks up the right name/icon
  if (opts?.manifestUrl) {
    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = opts.manifestUrl;
  }

  if (opts?.iconUrl) {
    // Use the provided real PNG for both the favicon and the iOS touch icon
    let favLink = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-dynamic]');
    if (!favLink) {
      favLink = document.createElement("link");
      favLink.rel = "icon";
      favLink.setAttribute("data-dynamic", "1");
      document.head.appendChild(favLink);
    }
    favLink.href = opts.iconUrl;

    // iOS "Add to Homescreen" — replace any existing touch-icon links
    document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach(l => l.remove());
    const touchLink = document.createElement("link");
    touchLink.rel = "apple-touch-icon";
    touchLink.sizes = "192x192";
    touchLink.href = opts.iconUrl;
    document.head.appendChild(touchLink);
    return;
  }

  // Fallback: render emoji to a 256x256 PNG canvas
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

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

  let favLink = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-dynamic]');
  if (!favLink) {
    favLink = document.createElement("link");
    favLink.rel = "icon";
    favLink.setAttribute("data-dynamic", "1");
    document.head.appendChild(favLink);
  }
  favLink.href = dataUrl;

  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach(l => l.remove());
  const touchLink = document.createElement("link");
  touchLink.rel = "apple-touch-icon";
  touchLink.sizes = "256x256";
  touchLink.href = dataUrl;
  document.head.appendChild(touchLink);
}
