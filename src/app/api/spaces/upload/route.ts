import { FormData as RemoteFormData } from "undici";
import { AppError, remote } from "@/lib/server/http";
import { executionTarget } from "@/lib/server/gradio";
import { parseHuggingFaceUrl } from "@/lib/parse";
import { rateLimit, errorResponse, assertSameOrigin } from "@/lib/server/api";
import { registerUpload, validateUploadFile } from "@/lib/server/uploads";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit("upload", 10);
    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("multipart/form-data;"))
      throw new AppError("Se requiere un formulario de archivo.", 415);
    const reader = request.body?.getReader();
    if (!reader) throw new AppError("Falta el archivo.", 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 10_100_000)
          throw new AppError("El archivo supera 10 MB.", 413);
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    let form: FormData;
    try {
      form = await new Response(Buffer.concat(chunks), {
        headers: { "Content-Type": type },
      }).formData();
    } catch {
      throw new AppError("Formulario de archivo inválido.", 400);
    }
    let id: string;
    try {
      id = parseHuggingFaceUrl(form.get("space_id"));
    } catch {
      throw new AppError("Space ID no válido.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File))
      throw new AppError("Selecciona un archivo.", 400);
    validateUploadFile(file);
    const { host, api } = await executionTarget(id);
    if (!api.apiAvailable)
      throw new AppError("El Space no expone API de archivos compatible.", 400);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const remoteForm = new RemoteFormData();
    remoteForm.append("files", file, safeName);
    const response = await remote(`${host}${api.basePath}/upload`, {
      method: "POST",
      body: remoteForm,
      timeout: 30_000,
      maxBytes: 100_000,
      spaceAuth: true,
    });
    if (!response.ok)
      throw new AppError("El Space rechazó la subida del archivo.");
    let path: unknown;
    try {
      path = JSON.parse(response.text)[0];
    } catch {}
    if (
      typeof path !== "string" ||
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("..") ||
      path.length > 2000
    )
      throw new AppError("Respuesta de subida incompatible.");
    const upload_id = registerUpload(id, {
      path,
      orig_name: safeName,
      mime_type: file.type,
      meta: { _type: "gradio.FileData" },
    });
    return Response.json(
      { upload_id, name: safeName },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
