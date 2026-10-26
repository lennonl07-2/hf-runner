import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("undici", () => ({ Agent: class {}, fetch: mocks.fetch }));
import { remote } from "../src/lib/server/http";
beforeEach(() => mocks.fetch.mockReset());
it("HEAD ignora Content-Length del recurso porque no descarga el cuerpo", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(null, {
      status: 200,
      headers: { "Content-Length": "200000" },
    }),
  );
  expect(
    (await remote("https://demo.hf.space/", { method: "HEAD", maxBytes: 0 }))
      .status,
  ).toBe(200);
});
it("bloquea redirects a localhost antes de solicitarlos", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/admin" },
    }),
  );
  await expect(
    remote("https://huggingface.co/api/models/a/b"),
  ).rejects.toThrow();
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
it("aplica límite de bytes sin depender de Content-Length", async () => {
  mocks.fetch.mockResolvedValue(new Response("too big"));
  await expect(
    remote("https://demo.hf.space/info", { maxBytes: 3 }),
  ).rejects.toThrow("demasiado grande");
});
it("no reenvía token a un origen de redirección distinto", async () => {
  vi.stubEnv("HF_TOKEN", "test-secret");
  mocks.fetch
    .mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://another.hf.space/info" },
      }),
    )
    .mockResolvedValueOnce(new Response("{}"));
  await remote("https://huggingface.co/api/models/a/b", { auth: true });
  expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe(
    "Bearer test-secret",
  );
  expect(mocks.fetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
  vi.unstubAllEnvs();
});
it("respeta Retry-After", async () => {
  mocks.fetch.mockResolvedValue(
    new Response("", { status: 429, headers: { "Retry-After": "21" } }),
  );
  await expect(
    remote("https://huggingface.co/api/models/a/b"),
  ).rejects.toMatchObject({ status: 429, retryAfter: "21" });
});
it("limita redirects", async () => {
  mocks.fetch.mockImplementation(
    async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://demo.hf.space/info" },
      }),
  );
  await expect(remote("https://demo.hf.space/info")).rejects.toThrow(
    "redirecciones",
  );
  expect(mocks.fetch).toHaveBeenCalledTimes(4);
});
