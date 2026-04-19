export function setPageMeta(title: string, emoji: string, manifestHref?: string) {
  document.title = title;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.font = "52px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 32, 36);

  let iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-dynamic]');
  if (!iconLink) {
    iconLink = document.createElement("link");
    iconLink.rel = "icon";
    iconLink.setAttribute("data-dynamic", "1");
    document.head.appendChild(iconLink);
  }
  iconLink.href = canvas.toDataURL("image/png");

  if (manifestHref) {
    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestHref;
  }
}
