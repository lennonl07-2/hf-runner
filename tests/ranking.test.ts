import { expect, it } from "vitest";
import { detectZeroGpu, scoreOption, rankOptions } from "../src/lib/ranking";
import type { SpaceExecutionOption } from "../src/lib/types";
it("ZeroGPU requiere hardware actual", () => {
  expect(detectZeroGpu({ hardware: { current: "zero-a10g" } })).toBe(true);
  expect(detectZeroGpu({ hardware: { requested: "zero-a10g" } })).toBe(
    "unknown",
  );
  expect(
    detectZeroGpu({ hardware: { current: "cpu-basic" }, tags: ["zerogpu"] }),
  ).toBe(false);
});
it("prioriza opción gratuita y disponible", () => {
  const base = {
    kind: "space",
    status: "RUNNING",
    pricing: "UNKNOWN",
    confidence: "EXACT",
    likes: 0,
    host: "https://demo.hf.space",
  } as SpaceExecutionOption;
  const free = {
    ...base,
    id: "free",
    zeroGpu: true,
    pricing: "FREE WITH LIMITS",
  } as SpaceExecutionOption;
  expect(scoreOption(free)).toBeGreaterThan(scoreOption(base));
  expect(rankOptions([base, free])[0].id).toBe("free");
});
