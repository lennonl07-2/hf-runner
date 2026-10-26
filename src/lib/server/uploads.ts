import { randomUUID } from "node:crypto";
import { AppError } from "./http";
import type { Json } from "../types";
const uploads = new Map<
  string,
  { space: string; file: Json; expires: number }
>();
export function registerUpload(space: string, file: Json) {
  const id = randomUUID();
  for (const [k, v] of uploads) if (v.expires < Date.now()) uploads.delete(k);
  if (uploads.size >= 200) uploads.delete(uploads.keys().next().value!);
  uploads.set(id, { space, file, expires: Date.now() + 10 * 60_000 });
  return id;
}
export function resolveUpload(space: string, value: unknown): Json {
  if (
    !value ||
    typeof value !== "object" ||
    !("upload_id" in value) ||
    typeof value.upload_id !== "string"
  )
    throw new AppError("Selecciona y sube un archivo antes de ejecutar.", 400);
  const entry = uploads.get(value.upload_id);
  if (!entry || entry.space !== space || entry.expires < Date.now())
    throw new AppError(
      "El archivo subido caducó o pertenece a otro Space. Súbelo nuevamente.",
      400,
    );
  return entry.file;
}
export function validateUploadFile(file: File) {
  if (file.size === 0 || file.size > 10_000_000)
    throw new AppError("El archivo debe tener entre 1 byte y 10 MB.", 413);
  if (
    !/\.(png|jpe?g|webp|gif|wav|mp3|ogg|flac|m4a|mp4|webm|pdf|txt|csv|json)$/i.test(
      file.name,
    )
  )
    throw new AppError(
      "Formato no admitido. Usa imagen, audio, video, PDF o texto.",
      400,
    );
}
