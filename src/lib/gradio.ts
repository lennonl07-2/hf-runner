import type { GradioApi, GradioEndpoint, InputSchema, Json } from "./types";
import { object } from "./metadata";
export const supportedInputs = [
  "textbox",
  "number",
  "slider",
  "checkbox",
  "dropdown",
  "radio",
  "image",
  "file",
  "audio",
  "video",
];
export function parseGradioSchema(
  raw: unknown,
  basePath = "/gradio_api",
): GradioApi {
  const endpoints: GradioEndpoint[] = [];
  for (const [name, value] of Object.entries(
    object(object(raw).named_endpoints),
  )) {
    if (!/^\/[a-zA-Z0-9_-]+$/.test(name)) continue;
    const endpoint = object(value);
    if (endpoint.api_visibility === "private") continue;
    const inputs: InputSchema[] = (
      Array.isArray(endpoint.parameters) ? endpoint.parameters : []
    ).map((v, i) => {
      const p = object(v);
      const schema = object(p.type);
      const component = String(p.component ?? "unknown").toLowerCase();
      const choices = Array.isArray(schema.enum)
        ? schema.enum
        : Array.isArray(object(schema.items).enum)
          ? (object(schema.items).enum as Json[])
          : [];
      return {
        name: String(p.parameter_name ?? `input_${i}`),
        label: String(p.label ?? p.parameter_name ?? `Input ${i + 1}`),
        component,
        required: p.parameter_has_default !== true,
        defaultValue: p.parameter_default ?? null,
        choices,
        minimum:
          typeof schema.minimum === "number" ? schema.minimum : undefined,
        maximum:
          typeof schema.maximum === "number" ? schema.maximum : undefined,
        step: schema.type === "integer" ? 1 : undefined,
        schema,
      };
    });
    const outputs = (
      Array.isArray(endpoint.returns) ? endpoint.returns : []
    ).map((v) => {
      const p = object(v);
      return {
        label: String(p.label ?? "Resultado"),
        component: String(p.component ?? "unknown").toLowerCase(),
        schema: object(p.type),
      };
    });
    const compatible =
      !name.startsWith("/_") &&
      inputs.length <= 30 &&
      inputs.every(
        (p) =>
          supportedInputs.includes(p.component) &&
          (!["dropdown", "radio"].includes(p.component) ||
            (p.choices.length > 0 && p.schema.type !== "array")) &&
          (!["file", "audio", "video", "image"].includes(p.component) ||
            p.schema.type !== "array"),
      );
    endpoints.push({ apiName: name, inputs, outputs, compatible });
  }
  return {
    apiAvailable: endpoints.length > 0,
    framework: "gradio",
    endpoints,
    basePath,
  };
}
