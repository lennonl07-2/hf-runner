import { remote, AppError } from "./http";
import { cached } from "./cache";
import { parseGradioSchema } from "../gradio";
import type { GradioApi, SpaceExecutionOption } from "../types";
import { spaceInfo } from "../sources/spaces";
import { object } from "../sources/hub";
export async function discoverGradio(host: string): Promise<GradioApi> {
  return cached(`gradio:${host}`, 300_000, async () => {
    for (const base of ["/gradio_api", ""]) {
      try {
        const response = await remote(`${host}${base}/info`, {
          timeout: 5000,
          maxBytes: 1_000_000,
        });
        if (response.ok)
          return parseGradioSchema(JSON.parse(response.text), base);
      } catch {}
    }
    return {
      apiAvailable: false,
      framework: "gradio",
      endpoints: [],
      basePath: "/gradio_api",
    };
  });
}
export async function inspectGradio(
  space: SpaceExecutionOption,
): Promise<SpaceExecutionOption> {
  if (
    space.sdk !== "gradio" ||
    !space.host ||
    !space.public ||
    ["STOPPED", "ERROR", "BUILDING"].includes(space.status)
  )
    return space;
  const api = await discoverGradio(space.host);
  if (!api.apiAvailable) {
    try {
      await remote(`https://huggingface.co/spaces/${space.id}/agents.md`, {
        timeout: 3000,
        maxBytes: 60_000,
      });
    } catch {}
  }
  return {
    ...space,
    api,
    mode:
      api.apiAvailable && api.endpoints.some((e) => e.compatible)
        ? "EMBEDDED/API"
        : space.mode,
    reasons: [
      ...space.reasons,
      api.apiAvailable
        ? "Expone un schema Gradio público; no se ha ejecutado inferencia durante el análisis."
        : "No se pudo descubrir una API Gradio pública.",
    ],
  };
}
export async function executionTarget(id: string) {
  const info = object(await spaceInfo(id));
  if (info.private !== false || info.disabled === true || info.sdk !== "gradio")
    throw new AppError(
      "Este Space no permite ejecución pública compatible.",
      400,
    );
  if (
    typeof info.subdomain !== "string" ||
    !/^[a-z0-9][a-z0-9-]*$/.test(info.subdomain)
  )
    throw new AppError("No se pudo verificar el host del Space.", 400);
  const host = `https://${info.subdomain}.hf.space`;
  const api = await discoverGradio(host);
  return { host, api };
}
