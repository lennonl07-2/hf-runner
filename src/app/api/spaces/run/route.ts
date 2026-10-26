import { z } from "zod";
import { parseHuggingFaceUrl } from "@/lib/parse";
import { AppError } from "@/lib/server/http";
import {
  rateLimit,
  readJson,
  errorResponse,
  assertSameOrigin,
} from "@/lib/server/api";
import { runSpace } from "@/lib/server/run";
export const runtime = "nodejs";
export const maxDuration = 150;
const schema = z
  .object({
    space_id: z.string().max(200),
    endpoint: z.string().regex(/^\/[a-zA-Z0-9_-]+$/),
    parameters: z.array(z.unknown()).max(30),
  })
  .strict();
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit("run", 8);
    const result = schema.safeParse(await readJson(request, 100_000));
    if (!result.success)
      throw new AppError("Solicitud de ejecución no válida.", 400);
    let id;
    try {
      id = parseHuggingFaceUrl(result.data.space_id);
    } catch {
      throw new AppError("Space ID no válido.", 400);
    }
    return Response.json(
      await runSpace(id, result.data.endpoint, result.data.parameters),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
