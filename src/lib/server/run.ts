import { resolveUpload } from "./uploads";
import { AppError, remote } from "./http";
import { executionTarget } from "./gradio";
import { parseEvents } from "../sse";
import type { GradioEndpoint, Json } from "../types";
export function validateParameters(
  endpoint: GradioEndpoint,
  parameters: unknown,
  spaceId?: string,
): Json[] {
  if (
    !Array.isArray(parameters) ||
    parameters.length !== endpoint.inputs.length
  )
    throw new AppError("Los parámetros no coinciden con el endpoint.", 400);
  return endpoint.inputs.map((p, i) => {
    const value = parameters[i];
    if (value === null && !p.required) return null;
    if (p.component === "textbox") {
      if (typeof value !== "string" || value.length > 20_000)
        throw new AppError(`Revisa el campo ${p.label}.`, 400);
      return value;
    }
    if (p.component === "checkbox") {
      if (typeof value !== "boolean")
        throw new AppError(`Revisa el campo ${p.label}.`, 400);
      return value;
    }
    if (["number", "slider"].includes(p.component)) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (p.schema.type === "integer" && !Number.isInteger(value)) ||
        (p.minimum !== undefined && value < p.minimum) ||
        (p.maximum !== undefined && value > p.maximum)
      )
        throw new AppError(`Revisa el valor numérico de ${p.label}.`, 400);
      return value;
    }
    if (["dropdown", "radio"].includes(p.component)) {
      if (!p.choices.some((c) => JSON.stringify(c) === JSON.stringify(value)))
        throw new AppError(`Elige una opción válida para ${p.label}.`, 400);
      return value;
    }
    if (["image", "file", "audio", "video"].includes(p.component) && spaceId) {
      const uploaded = resolveUpload(spaceId, value);
      return p.component === "video" ? { video: uploaded } : uploaded;
    }
    throw new AppError("Este tipo de entrada todavía no es compatible.", 400);
  });
}
export function remoteExecutionError(text: string) {
  return /quota|gpu.*limit|exceeded.*gpu/i.test(text)
    ? new AppError(
        "Has alcanzado la cuota disponible de este Space/ZeroGPU.",
        429,
        undefined,
        "QUOTA_EXCEEDED",
      )
    : new AppError(
        "El Space no pudo ejecutar la solicitud. Puede requerir iniciar sesión, tener la cola llena o usar una API incompatible.",
        502,
      );
}
export async function runSpace(
  spaceId: string,
  name: string,
  parameters: unknown,
) {
  const start = Date.now();
  const { host, api } = await executionTarget(spaceId);
  const endpoint = api.endpoints.find((e) => e.apiName === name);
  if (!endpoint?.compatible)
    throw new AppError(
      "API detectada, pero interfaz automática no disponible para este endpoint.",
      400,
    );
  const data = validateParameters(endpoint, parameters, spaceId);
  const path = `${host}${api.basePath}/call/${name.slice(1)}`;
  const response = await remote(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
    timeout: 15_000,
    maxBytes: 100_000,
    spaceAuth: true,
  });
  if (!response.ok) throw remoteExecutionError(response.text);
  let id: unknown;
  try {
    id = JSON.parse(response.text).event_id;
  } catch {}
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new AppError(
      "El Space devolvió un identificador de ejecución incompatible.",
    );
  const events = await remote(`${path}/${id}`, {
    timeout: 120_000,
    maxBytes: 4_000_000,
    headers: { Accept: "text/event-stream" },
    spaceAuth: true,
  });
  if (!events.ok) throw remoteExecutionError(events.text);
  for (const e of parseEvents(events.text)) {
    if (e.event === "error") throw remoteExecutionError(e.data);
    if (e.event === "complete") {
      let result: Json;
      try {
        result = JSON.parse(e.data);
      } catch {
        throw new AppError("Resultado remoto no compatible.");
      }
      console.info(
        JSON.stringify({
          event: "execution",
          space_id: spaceId,
          status: "complete",
          latency_ms: Date.now() - start,
        }),
      );
      return { data: result, host, outputs: endpoint.outputs };
    }
  }
  throw new AppError(
    "El Space no completó la ejecución dentro del tiempo disponible.",
    504,
  );
}
