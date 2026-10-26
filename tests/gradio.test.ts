import { expect, it } from "vitest";
import { parseGradioSchema } from "../src/lib/gradio";
import fixture from "./fixtures/gradio-qwen.json";
it("interpreta schema real de Qwen sin ejecutar código ni endpoints auxiliares", () => {
  const api = parseGradioSchema(fixture);
  expect(api.apiAvailable).toBe(true);
  expect(
    api.endpoints.find((e) => e.apiName === "/rewritten_prompt")?.compatible,
  ).toBe(true);
  expect(
    api.endpoints.find((e) => e.apiName === "/_check_login_status")?.compatible,
  ).toBe(false);
});
it("normaliza schemas y mantiene fallback para inputs incompatibles", () => {
  const api = parseGradioSchema({
    named_endpoints: {
      "/generate": {
        parameters: [
          {
            parameter_name: "prompt",
            label: "Prompt",
            component: "Textbox",
            type: { type: "string" },
          },
        ],
        returns: [{ component: "Image" }],
      },
      "/custom": { parameters: [{ component: "Model3D" }] },
      "/secret": { api_visibility: "private" },
      "/../../evil": {},
    },
  });
  expect(api.endpoints).toHaveLength(2);
  expect(api.endpoints[0].compatible).toBe(true);
  expect(api.endpoints[0].inputs[0].required).toBe(true);
  expect(api.endpoints[1].compatible).toBe(false);
});
it("schema vacío no significa API funcional", () =>
  expect(parseGradioSchema({}).apiAvailable).toBe(false));
