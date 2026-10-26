import { lookup } from "node:dns";
import ipaddr from "ipaddr.js";
import { Agent, fetch as request, type FormData } from "undici";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter?: string,
    public code?: string,
  ) {
    super(message);
  }
}
export function isPublicIp(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function validateRemoteUrl(input: string): URL {
  const u = new URL(input);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    (u.hostname !== "huggingface.co" &&
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.hf\.space$/.test(u.hostname))
  )
    throw new AppError("Destino remoto no permitido.", 400);
  if (
    /\.(safetensors|bin|ckpt|gguf|pt|pth)(?:$|\/)/i.test(
      decodeURIComponent(u.pathname),
    )
  )
    throw new AppError("La descarga de pesos está bloqueada.", 400);
  return u;
}
const dispatcher = new Agent({
  connect: {
    lookup(host, options, callback) {
      lookup(host, { all: true }, (error, addresses) => {
        if (error) return callback(error, [], undefined);
        if (!addresses.length || addresses.some((a) => !isPublicIp(a.address)))
          return callback(new Error("Dirección bloqueada"), [], undefined);
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      });
    },
  },
});
export interface HttpOptions {
  method?: string;
  body?: string | FormData;
  headers?: Record<string, string>;
  timeout?: number;
  maxBytes?: number;
  auth?: boolean;
  spaceAuth?: boolean;
}
export async function remote(input: string, options: HttpOptions = {}) {
  let url = validateRemoteUrl(input);
  const initial = url.origin;
  const signal = AbortSignal.timeout(options.timeout ?? 8000);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...options.headers,
      };
      // Token stays server-side and is scoped to the validated original HF destination.
      if (
        url.origin === initial &&
        ((options.auth && url.hostname === "huggingface.co") ||
          (options.spaceAuth && url.hostname.endsWith(".hf.space"))) &&
        process.env.HF_TOKEN
      )
        headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;
      const response = await request(url, {
        dispatcher,
        signal,
        redirect: "manual",
        method: options.method ?? "GET",
        headers,
        body: options.body,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || redirects === 3)
          throw new AppError("Demasiadas redirecciones remotas.");
        const next = validateRemoteUrl(new URL(location, url).href);
        if (
          options.method &&
          options.method !== "GET" &&
          next.origin !== initial
        )
          throw new AppError("Redirección de ejecución bloqueada.");
        url = next;
        continue;
      }
      const max = options.maxBytes ?? 2_000_000;
      if (
        options.method !== "HEAD" &&
        Number(response.headers.get("content-length")) > max
      ) {
        await response.body?.cancel();
        throw new AppError("Respuesta remota demasiado grande.");
      }
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > max)
              throw new AppError("Respuesta remota demasiado grande.");
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
      }
      const text = Buffer.concat(chunks).toString("utf8");
      if (response.status === 429)
        throw new AppError(
          options.spaceAuth && /quota|gpu.*limit/i.test(text)
            ? "Has alcanzado la cuota disponible de este Space/ZeroGPU."
            : "Hugging Face alcanzó su límite de solicitudes. Inténtalo más tarde.",
          429,
          response.headers.get("retry-after") ??
            response.headers.get("ratelimit")?.match(/\bt=(\d+)/)?.[1] ??
            "60",
          options.spaceAuth && /quota|gpu.*limit/i.test(text) ? "QUOTA_EXCEEDED" : "RATE_LIMITED",
        );
      return {
        status: response.status,
        ok: response.ok,
        text,
        headers: response.headers,
      };
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "El servicio remoto no respondió a tiempo o no es accesible.",
      504,
    );
  }
  throw new AppError("No se pudo acceder al recurso.");
}
export async function hub(path: string) {
  const base = process.env.HF_API_BASE || "https://huggingface.co";
  if (new URL(base).origin !== "https://huggingface.co")
    throw new AppError("HF_API_BASE debe apuntar al Hub oficial.", 500);
  const response = await remote(`https://huggingface.co${path}`, {
    auth: true,
  });
  if ([401, 403, 404].includes(response.status))
    throw new AppError(
      "No encontramos el repositorio o requiere permisos de acceso.",
      response.status === 404 ? 404 : 403,
    );
  if (!response.ok)
    throw new AppError("Hugging Face no está disponible en este momento.");
  try {
    return JSON.parse(response.text) as unknown;
  } catch {
    throw new AppError("Respuesta inesperada de Hugging Face.");
  }
}
