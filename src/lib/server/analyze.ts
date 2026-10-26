import { HuggingFaceHubSource } from "../sources/hub";
import { HuggingFaceSpaceSource } from "../sources/spaces";
import { HuggingFaceInferenceSource } from "../sources/inference";
import { mapSettled } from "./concurrency";
import { checkHealth } from "./health";
import { inspectGradio } from "./gradio";
import { rankOptions } from "../ranking";
import type { ModelAnalysis, SpaceExecutionOption } from "../types";
export async function analyze(
  id: string,
  emit: (event: string, data: unknown) => void = () => {},
  signal?: AbortSignal,
): Promise<ModelAnalysis> {
  const start = Date.now();
  const model = { ...(await new HuggingFaceHubSource().getModel(id)) };
  const result: ModelAnalysis = {
    model,
    spaces: [],
    providers: [],
    summary: { spacesFound: 0, running: 0, free: 0, apiAccessible: 0 },
    warnings: [],
    connected: !!process.env.HF_TOKEN,
  };
  emit("snapshot", result);
  emit("progress", { message: "Modelo encontrado. Buscando proveedores…" });
  try {
    result.providers = await new HuggingFaceInferenceSource().discover(model);
  } catch {
    result.warnings.push(
      "No se pudo consultar Inference Providers; el resultado es parcial.",
    );
  }
  emit("snapshot", result);
  emit("progress", {
    message: `${result.providers.length} proveedores encontrados. Buscando Spaces…`,
  });
  const found = await new HuggingFaceSpaceSource().discover(model);
  result.spaces = found.spaces;
  result.warnings.push(...found.warnings);
  emit("snapshot", result);
  emit("progress", {
    message: `${result.spaces.length} Spaces encontrados. Comprobando disponibilidad y APIs…`,
  });
  let completed = 0;
  const checked = await mapSettled(result.spaces, 4, async (space) => {
    if (signal?.aborted) return space;
    let next = await checkHealth(space);
    if (!signal?.aborted) next = await inspectGradio(next);
    emit("space", next);
    emit("progress", {
      message: `Disponibilidad y API: ${++completed} de ${result.spaces.length} comprobados`,
    });
    return next;
  });
  result.spaces = rankOptions(
    checked.map((r, i): SpaceExecutionOption =>
      r.status === "fulfilled" ? r.value : result.spaces[i],
    ),
  );
  result.summary = {
    spacesFound: result.spaces.length,
    running: result.spaces.filter((s) => s.status === "RUNNING").length,
    free:
      result.spaces.filter(
        (s) => s.pricing.startsWith("FREE") && s.status === "RUNNING",
      ).length +
      result.providers.filter(
        (p) => p.pricing === "FREE" && p.status === "RUNNING",
      ).length,
    apiAccessible: result.spaces.filter((s) => s.api?.apiAvailable).length,
  };
  console.info(
    JSON.stringify({
      event: "analysis",
      repo_id: id,
      latency_ms: Date.now() - start,
      status: "complete",
      spaces: result.spaces.length,
    }),
  );
  return result;
}
