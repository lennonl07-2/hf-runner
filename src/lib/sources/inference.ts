import type { InferenceSource } from "./interfaces";
import type {
  ModelInfo,
  ProviderExecutionOption,
  PricingStatus,
} from "../types";
import { object } from "./hub";
import { hub } from "../server/http";
import { cached } from "../server/cache";
export function providerPricing(raw: unknown): PricingStatus {
  const data = object(raw);
  if (data.is_free === true) return "FREE";
  if (data.is_free === false) return "PAID";
  const prices = Object.values(object(data.pricing));
  return prices.some((p) => typeof p === "number" && p > 0)
    ? "PAID"
    : "UNKNOWN";
}
export function normalizeProviders(
  raw: unknown,
  model: ModelInfo,
): ProviderExecutionOption[] {
  return Object.entries(object(object(raw).inferenceProviderMapping)).map(
    ([provider, value]) => {
      const d = object(value);
      const pricing = providerPricing(d);
      return {
        kind: "provider",
        id: provider,
        provider,
        title: provider,
        providerModelId:
          typeof d.providerId === "string" ? d.providerId : undefined,
        task: typeof d.task === "string" ? d.task : undefined,
        url: `https://huggingface.co/${model.id}?inference_provider=${encodeURIComponent(provider)}`,
        pricing,
        pricingEvidence:
          pricing === "FREE"
            ? "La metadata declara is_free=true; puede ser una promoción temporal."
            : pricing === "PAID"
              ? "La metadata indica un servicio de pago."
              : "El Hub confirma el proveedor, pero no publica una tarifa suficiente para clasificarlo.",
        status:
          d.status === "live"
            ? "RUNNING"
            : d.status === "error"
              ? "ERROR"
              : "UNKNOWN",
        score: pricing === "FREE" ? 25 : 0,
        reasons: [
          `El Hub incluye ${provider} en inferenceProviderMapping. Estado: ${String(d.status ?? "desconocido")}.`,
        ],
        mode: d.status === "live" ? "PROVIDER" : "UNAVAILABLE",
        details: d,
      };
    },
  );
}
export class HuggingFaceInferenceSource implements InferenceSource {
  async discover(model: ModelInfo) {
    const metadata = await cached(`providers:${model.id}`, 600_000, async () =>
      object(
        await hub(
          `/api/models/${model.id}?expand=inferenceProviderMapping&expand=inference`,
        ),
      ),
    );
    if (typeof metadata.inference === "string")
      model.inference = metadata.inference;
    return normalizeProviders(metadata, model);
  }
}
