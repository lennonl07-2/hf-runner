const part = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,94}[a-zA-Z0-9])?$/;
export function parseHuggingFaceUrl(input: unknown): string {
  if (typeof input !== "string" || input.length > 500)
    throw new Error("Pega una URL de modelo o un ID con formato autor/modelo.");
  let value = input.trim();
  if (
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(value) ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error("La ruta del modelo no es válida.");
  if (value.startsWith("huggingface.co/")) value = `https://${value}`;
  if (value.includes("://")) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "huggingface.co" ||
      url.username ||
      url.password ||
      url.port ||
      /%|\\/.test(value)
    )
      throw new Error("Solo se admiten enlaces HTTPS de huggingface.co.");
    value = url.pathname.replace(/^\//, "").replace(/\/$/, "");
  } else value = value.replace(/\/$/, "");
  const parts = value.split("/");
  if (
    parts.length !== 2 ||
    parts.some((p) => !part.test(p) || p.includes("..") || p.includes("--")) ||
    ["spaces", "datasets", "api", "models", "settings"].includes(
      parts[0].toLowerCase(),
    )
  )
    throw new Error("Usa la página principal del modelo: autor/modelo.");
  return value;
}
