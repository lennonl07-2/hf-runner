import { parseHuggingFaceUrl } from "@/lib/parse";
import { AppError } from "@/lib/server/http";
import { rateLimit, readJson, errorResponse } from "@/lib/server/api";
import { analyze } from "@/lib/server/analyze";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    rateLimit("analyze", 20);
    const body = await readJson(request);
    let id: string;
    try {
      id = parseHuggingFaceUrl((body as { input?: unknown })?.input);
    } catch {
      throw new AppError(
        "Introduce una URL válida de Hugging Face o autor/modelo.",
        400,
      );
    }
    if (!request.headers.get("accept")?.includes("text/event-stream"))
      return Response.json(await analyze(id), {
        headers: { "Cache-Control": "no-store" },
      });
    const encoder = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: string, data: unknown) => {
          if (!closed && !request.signal.aborted)
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
        };
        try {
          emit("progress", { message: "Analizando modelo…" });
          emit("complete", await analyze(id, emit, request.signal));
        } catch (error) {
          const e =
            error instanceof AppError
              ? error
              : new AppError("No se pudo completar el análisis.");
          emit("error", { error: e.message, retryAfter: e.retryAfter });
        } finally {
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      },
      cancel() {
        closed = true;
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
