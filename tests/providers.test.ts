import { expect, it } from "vitest";
import {
  providerPricing,
  normalizeProviders,
} from "../src/lib/sources/inference";
import type { ModelInfo } from "../src/lib/types";
it("exige evidencia explícita para gratuidad", () => {
  expect(providerPricing({})).toBe("UNKNOWN");
  expect(providerPricing({ pricing: { input: 0 } })).toBe("UNKNOWN");
  expect(providerPricing({ is_free: true })).toBe("FREE");
  expect(providerPricing({ is_free: false })).toBe("PAID");
  expect(providerPricing({ pricing: { input: 0.1 } })).toBe("PAID");
});
it("conserva proveedor en staging sin ofrecer ejecución disponible", () => {
  const p = normalizeProviders(
    {
      inferenceProviderMapping: {
        demo: { status: "staging", providerId: "test", task: "text-to-image" },
      },
    },
    { id: "Qwen/Test" } as ModelInfo,
  )[0];
  expect(p.mode).toBe("UNAVAILABLE");
  expect(p.pricing).toBe("UNKNOWN");
  expect(p.providerModelId).toBe("test");
});
