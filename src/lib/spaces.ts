import type {
  ExecutionStatus,
  ModelInfo,
  SpaceExecutionOption,
  Confidence,
} from "./types";
import { object, strings } from "./metadata";
import { parseHuggingFaceUrl } from "./parse";
export function referencesExactModel(text: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-zA-Z0-9_.-])${escaped}(?![a-zA-Z0-9_.-])`, "i").test(text);
}
export function runtimeStatus(stage: unknown): ExecutionStatus {
  if (typeof stage !== "string") return "UNKNOWN";
  if (stage === "RUNNING") return "RUNNING";
  if (stage === "SLEEPING") return "SLEEPING";
  if (stage.includes("ERROR")) return "ERROR";
  if (
    stage.includes("BUILD") ||
    stage === "STARTING" ||
    stage === "RUNNING_APP_STARTING"
  )
    return "BUILDING";
  if (stage.includes("ERROR")) return "ERROR";
  if (["STOPPED", "PAUSED", "NO_APP", "DELETING"].includes(stage))
    return "STOPPED";
  return "UNKNOWN";
}
export function deduplicateSpaces<T extends { id: string }>(spaces: T[]): T[] {
  return [...new Map(spaces.map((s) => [s.id.toLowerCase(), s])).values()];
}
export function normalizeSpace(
  value: unknown,
  model: ModelInfo,
): SpaceExecutionOption | null {
  const raw = object(value);
  if (typeof raw.id !== "string") return null;
  try {
    parseHuggingFaceUrl(raw.id);
  } catch {
    return null;
  }
  const author = raw.id.split("/")[0];
  const card = object(raw.cardData);
  const runtime = object(raw.runtime);
  const models = [
    ...new Set([...strings(raw.models), ...strings(card.models)]),
  ];
  const tags = strings(raw.tags);
  const title =
    typeof card.title === "string" ? card.title : raw.id.split("/")[1];
  const exact = models.some((m) => m.toLowerCase() === model.id.toLowerCase());
  const confidence: Confidence = exact
    ? "EXACT"
    : `${raw.id} ${title} ${tags.join(" ")}`
          .toLowerCase()
          .includes(model.name.toLowerCase())
      ? "MEDIUM"
      : "LOW";
  let host: string | undefined;
  if (
    typeof raw.subdomain === "string" &&
    /^[a-z0-9][a-z0-9-]*$/.test(raw.subdomain)
  )
    host = `https://${raw.subdomain}.hf.space`;
  const status = raw.disabled ? "STOPPED" : runtimeStatus(runtime.stage);
  return {
    kind: "space",
    id: raw.id,
    title,
    author,
    url: `https://huggingface.co/spaces/${raw.id}`,
    pricing: "UNKNOWN",
    pricingEvidence: "Un Space público no demuestra acceso gratuito.",
    status,
    score: 0,
    reasons: [
      exact
        ? `Declara ${model.id} como modelo asociado.`
        : confidence === "MEDIUM"
          ? "El nombre o los tags coinciden; la relación aún no está confirmada."
          : "Coincidencia textual débil; puede tratarse de otro modelo.",
    ],
    mode: ["ERROR", "STOPPED"].includes(status) ? "UNAVAILABLE" : "EXTERNAL",
    likes: typeof raw.likes === "number" ? raw.likes : 0,
    sdk: typeof raw.sdk === "string" ? raw.sdk : "unknown",
    models,
    tags,
    lastModified:
      typeof raw.lastModified === "string" ? raw.lastModified : undefined,
    runtime,
    hardware:
      typeof object(runtime.hardware).current === "string"
        ? String(object(runtime.hardware).current)
        : undefined,
    host,
    disabled: raw.disabled === true,
    public: raw.private === false,
    zeroGpu: "unknown",
    official: author.toLowerCase() === model.author.toLowerCase(),
    confidence,
  };
}
