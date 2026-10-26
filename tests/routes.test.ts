import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  remote: vi.fn(),
  target: vi.fn(),
  run: vi.fn(),
}));
vi.mock("../src/lib/server/http", async (original) => ({
  ...(await original<typeof import("../src/lib/server/http")>()),
  remote: mock.remote,
}));
vi.mock("../src/lib/server/gradio", () => ({ executionTarget: mock.target }));
vi.mock("../src/lib/server/run", () => ({ runSpace: mock.run }));
import { POST as upload } from "../src/app/api/spaces/upload/route";
import { POST as run } from "../src/app/api/spaces/run/route";
import { resolveUpload } from "../src/lib/server/uploads";
beforeEach(() => {
  vi.clearAllMocks();
  mock.target.mockResolvedValue({
    host: "https://demo.hf.space",
    api: { apiAvailable: true, basePath: "/gradio_api" },
  });
});
it("sube multipart al host reconstruido y devuelve una referencia opaca", async () => {
  mock.remote.mockResolvedValue({
    ok: true,
    text: '["/tmp/gradio/abcd/input.png"]',
  });
  const body = new FormData();
  body.append("space_id", "author/demo");
  body.append(
    "file",
    new File(["PNG fixture"], "image.png", { type: "image/png" }),
  );
  const response = await upload(
    new Request("http://localhost/api/spaces/upload", { method: "POST", body }),
  );
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.upload_id).toBeTypeOf("string");
  expect(result.path).toBeUndefined();
  expect(
    resolveUpload("author/demo", { upload_id: result.upload_id }),
  ).toMatchObject({ path: "/tmp/gradio/abcd/input.png" });
  expect(mock.remote.mock.calls[0][0]).toBe(
    "https://demo.hf.space/gradio_api/upload",
  );
  expect(mock.remote.mock.calls[0][1].body.get("files").name).toBe("image.png");
});
it("rechaza URL arbitraria en el endpoint de ejecución", async () => {
  const response = await run(
    new Request("http://localhost/api/spaces/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        space_id: "author/demo",
        endpoint: "/run",
        parameters: [],
        url: "http://localhost",
      }),
    }),
  );
  expect(response.status).toBe(400);
  expect(mock.run).not.toHaveBeenCalled();
});
it("bloquea ejecución desde otro origen", async () => {
  const response = await run(
    new Request("http://localhost/api/spaces/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.com",
      },
      body: "{}",
    }),
  );
  expect(response.status).toBe(403);
  expect(mock.run).not.toHaveBeenCalled();
});
it("rechaza JSON malformado sin convertirlo en error interno", async () => {
  const response = await run(
    new Request("http://localhost/api/spaces/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
  );
  expect(response.status).toBe(400);
});
