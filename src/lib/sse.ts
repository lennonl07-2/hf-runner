export interface ServerEvent {
  event: string;
  data: string;
}
export function parseEvents(text: string): ServerEvent[] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .filter(Boolean)
    .map((block) => ({
      event:
        block
          .split("\n")
          .find((l) => l.startsWith("event:"))
          ?.slice(6)
          .trim() ?? "message",
      data: block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n"),
    }));
}
export async function readEvents(
  response: Response,
  onEvent: (event: ServerEvent) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No se recibió respuesta.");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        parseEvents(block).forEach(onEvent);
      }
    }
    if (buffer.trim()) parseEvents(buffer).forEach(onEvent);
  } finally {
    await reader.cancel();
  }
}
