import { expect, it } from "vitest";
import {
  validateParameters,
  remoteExecutionError,
} from "../src/lib/server/run";
import { parseGradioSchema } from "../src/lib/gradio";
import { parseEvents } from "../src/lib/sse";
const endpoint = parseGradioSchema({
  named_endpoints: {
    "/run": {
      parameters: [
        {
          component: "Slider",
          type: { type: "integer", minimum: 1, maximum: 10 },
        },
        { component: "Textbox", type: { type: "string" } },
      ],
    },
  },
}).endpoints[0];
it("valida inputs en el servidor", () => {
  expect(validateParameters(endpoint, [3, "hello"])).toEqual([3, "hello"]);
  expect(() => validateParameters(endpoint, [11, "hello"])).toThrow();
  expect(() => validateParameters(endpoint, [2, {}])).toThrow();
  expect(() => validateParameters(endpoint, [2])).toThrow();
});
it("interpreta SSE y errores de cuota", () => {
  expect(
    parseEvents(
      'event: heartbeat\ndata: null\n\nevent: complete\ndata: ["ok"]\n\n',
    )[1].event,
  ).toBe("complete");
  expect(remoteExecutionError("GPU quota exceeded").status).toBe(429);
});
