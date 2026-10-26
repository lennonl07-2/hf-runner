import { expect, it, vi } from "vitest";
import fixture from "./fixtures/qwen-model.json";
vi.mock("../src/lib/server/http", () => ({ hub: vi.fn(async () => fixture) }));
import { HuggingFaceHubSource } from "../src/lib/sources/hub";
it("normaliza metadata real sin consultar archivos del repositorio", async () => {
  const model = await new HuggingFaceHubSource().getModel(
    "Qwen/Qwen-Image-2.1",
  );
  expect(model.task).toBe("text-to-image");
  expect(model.parameters).toBe(7115124736);
  expect(model.license).toBe("qwen-research");
  expect(model.architecture).toContain("QwenImage21Pipeline");
  expect(model.associatedSpaces.length).toBeGreaterThan(0);
});
