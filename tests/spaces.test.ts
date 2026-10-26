import { expect, it } from "vitest";
import {
  normalizeSpace,
  deduplicateSpaces,
  runtimeStatus,
} from "../src/lib/spaces";
import type { ModelInfo } from "../src/lib/types";
import {referencesExactModel} from '../src/lib/spaces';
it('una referencia a una variante no se confunde con el modelo exacto',()=>{expect(referencesExactModel('Uses Qwen/Test-Other','Qwen/Test')).toBe(false);expect(referencesExactModel('https://huggingface.co/Qwen/Test/blob/main/README.md','Qwen/Test')).toBe(true);});
const model = { id: "Qwen/Test", name: "Test", author: "Qwen" } as ModelInfo;
it("deduplica IDs", () =>
  expect(deduplicateSpaces([{ id: "a/B" }, { id: "a/b" }])).toHaveLength(1));
it("diferencia dormido, error y construcción", () => {
  expect(runtimeStatus("SLEEPING")).toBe("SLEEPING");
  expect(runtimeStatus("BUILD_ERROR")).toBe("ERROR");
  expect(runtimeStatus("RUNTIME_ERROR")).toBe("ERROR");
});
it("no supone gratis por ser público, ni oficial por nombre", () => {
  const s = normalizeSpace(
    { id: "fake/Qwen-Test", models: ["Qwen/Test"], private: false },
    model,
  )!;
  expect(s.confidence).toBe("EXACT");
  expect(s.pricing).toBe("UNKNOWN");
  expect(s.official).toBe(false);
});
it("coincidencias débiles y hosts inválidos", () => {
  const s = normalizeSpace(
    { id: "a/unrelated", private: false, subdomain: "localhost:3000" },
    model,
  )!;
  expect(s.confidence).toBe("LOW");
  expect(s.host).toBeUndefined();
});
