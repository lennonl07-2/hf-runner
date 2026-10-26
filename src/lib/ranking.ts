import type {
  RemoteExecutionOption,
  SpaceExecutionOption,
  Metadata,
} from "./types";
import { object } from "./metadata";
export const rankWeights = {
  zeroGpu: 50,
  api: 40,
  running: 30,
  freeProvider: 25,
  gradio: 20,
  official: 15,
  popular: 10,
  recent: 10,
  error: -30,
  stopped: -25,
  noApi: -20,
  insufficient: -15,
};
export function detectZeroGpu(runtime: Metadata): true | false | "unknown" {
  const current = object(runtime.hardware).current;
  return typeof current !== "string"
    ? "unknown"
    : current.startsWith("zero-")
      ? true
      : false;
}
export function scoreOption(
  option: RemoteExecutionOption,
  weights = rankWeights,
  now = Date.now(),
) {
  let score =
    option.status === "RUNNING"
      ? weights.running
      : option.status === "ERROR"
        ? weights.error
        : option.status === "STOPPED"
          ? weights.stopped
          : 0;
  if (option.kind === "provider")
    return score + (option.pricing === "FREE" ? weights.freeProvider : 0);
  if (option.zeroGpu === true) score += weights.zeroGpu;
  if (option.api?.apiAvailable) score += weights.api;
  if (option.sdk === "gradio" && option.api?.apiAvailable)
    score += weights.gradio;
  if (option.api && !option.api.apiAvailable) score += weights.noApi;
  if (option.official) score += weights.official;
  if (option.likes >= 50) score += weights.popular;
  if (
    option.lastModified &&
    now - Date.parse(option.lastModified) < 30 * 86400_000
  )
    score += weights.recent;
  if (option.confidence === "LOW" || !option.host)
    score += weights.insufficient;
  return score;
}
export function rankOptions<T extends RemoteExecutionOption>(
  options: T[],
): T[] {
  return options
    .map((o) => ({ ...o, score: scoreOption(o) }))
    .sort((a, b) => {
      const preferred = (o: RemoteExecutionOption) =>
        o.pricing.startsWith("FREE") && o.status === "RUNNING" ? 1 : 0;
      return preferred(b) - preferred(a) || b.score - a.score;
    });
}
export function enrichZeroGpu(
  space: SpaceExecutionOption,
): SpaceExecutionOption {
  const zeroGpu = detectZeroGpu(space.runtime);
  return {
    ...space,
    zeroGpu,
    ...(zeroGpu === true
      ? {
          pricing: "FREE WITH LIMITS" as const,
          pricingEvidence:
            "Hardware ZeroGPU confirmado por el Hub. Hugging Face ofrece cuota gratuita; el Space puede imponer requisitos adicionales.",
          reasons: [
            ...space.reasons,
            `runtime.hardware.current = ${space.hardware}.`,
          ],
        }
      : {}),
  };
}
