import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ remote: vi.fn(), target: vi.fn() }));
vi.mock("../src/lib/server/http", async (original) => ({
  ...(await original<typeof import("../src/lib/server/http")>()),
  remote: mock.remote,
}));
vi.mock("../src/lib/server/gradio", () => ({ executionTarget: mock.target }));
import { runSpace } from "../src/lib/server/run";
import { parseGradioSchema } from "../src/lib/gradio";
beforeEach(() => {
  mock.remote.mockReset();
  mock.target.mockResolvedValue({
    host: "https://demo.hf.space",
    api: parseGradioSchema({
      named_endpoints: {
        "/generate": {
          parameters: [
            {
              parameter_name: "prompt",
              component: "Textbox",
              type: { type: "string" },
            },
          ],
          returns: [{ component: "Image" }],
        },
      },
    }),
  });
});
it("envía parámetros y recibe resultado SSE de un endpoint descubierto", async () => {
  mock.remote
    .mockResolvedValueOnce({ ok: true, text: '{"event_id":"abc"}' })
    .mockResolvedValueOnce({
      ok: true,
      text: 'event: heartbeat\ndata: null\n\nevent: complete\ndata: [{"url":"https://demo.hf.space/gradio_api/file=x.png"}]\n\n',
    });
  const result = await runSpace("author/demo", "/generate", ["hello"]);
  expect(mock.remote.mock.calls[0][0]).toBe(
    "https://demo.hf.space/gradio_api/call/generate",
  );
  expect(JSON.parse(mock.remote.mock.calls[0][1].body)).toEqual({
    data: ["hello"],
  });
  expect(result.data).toEqual([
    { url: "https://demo.hf.space/gradio_api/file=x.png" },
  ]);
});
it("no ejecuta endpoints no declarados", async () => {
  await expect(runSpace("author/demo", "/delete_all", [])).rejects.toThrow();
  expect(mock.remote).not.toHaveBeenCalled();
});
it("traduce errores de cuota del stream", async () => {
  mock.remote
    .mockResolvedValueOnce({ ok: true, text: '{"event_id":"abc"}' })
    .mockResolvedValueOnce({
      ok: true,
      text: 'event: error\ndata: "GPU quota exceeded"\n\n',
    });
  await expect(
    runSpace("author/demo", "/generate", ["hello"]),
  ).rejects.toMatchObject({ status: 429 });
});
