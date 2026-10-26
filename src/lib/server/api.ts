import { AppError } from "./http";
const limits = new Map<string, { count: number; reset: number }>();
export function rateLimit(action: string, max: number) {
  // Global per-process budget: spoofed forwarded headers cannot bypass this limit.
  const now = Date.now();
  let bucket = limits.get(action);
  if (!bucket || bucket.reset <= now) {
    bucket = { count: 0, reset: now + 60_000 };
    limits.set(action, bucket);
  }
  if (++bucket.count > max)
    throw new AppError(
      "Demasiadas solicitudes. Espera un momento.",
      429,
      String(Math.ceil((bucket.reset - now) / 1000)),
    );
}
export async function readJson(request: Request, max = 8192): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("Envía datos JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Faltan datos.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max)
        throw new AppError("La solicitud es demasiado grande.", 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new AppError("JSON no válido.", 400);
  }
}
export function errorResponse(error: unknown) {
  const e =
    error instanceof AppError
      ? error
      : new AppError("No se pudo completar la solicitud.", 500);
  console.warn(JSON.stringify({ event: "api_error", status: e.status }));
  return Response.json(
    { error: e.message, code: e.code, retryAfter: e.retryAfter },
    {
      status: e.status,
      headers: {
        "Cache-Control": "no-store",
        ...(e.retryAfter ? { "Retry-After": e.retryAfter } : {}),
      },
    },
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError("Solicitud desde un origen no permitido.", 403);
}
