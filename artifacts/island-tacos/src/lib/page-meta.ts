export function setPageMeta(title: string, emoji: string) {
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

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-dynamic]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-dynamic", "1");
    document.head.appendChild(link);
  }
  link.href = canvas.toDataURL("image/png");
}
