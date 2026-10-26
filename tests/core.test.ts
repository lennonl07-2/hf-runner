import { describe, it, expect } from "vitest";
import { parseHuggingFaceUrl } from "../src/lib/parse";
import { normalizeTask } from "../src/lib/tasks";
import { validateRemoteUrl, isPublicIp } from "../src/lib/server/http";
describe("parser", () => {
  it.each([
    "Qwen/Qwen-Image-2.1",
    "https://huggingface.co/Qwen/Qwen-Image-2.1",
    " huggingface.co/Qwen/Qwen-Image-2.1/ ",
  ])("normaliza %s", (v) =>
    expect(parseHuggingFaceUrl(v)).toBe("Qwen/Qwen-Image-2.1"),
  );
  it.each([
    "https://evil.com/Qwen/model",
    "https://huggingface.co.evil.com/Qwen/model",
    "https://user@huggingface.co/Qwen/model",
    "https://huggingface.co/spaces/a/b",
    "a/../b",
    "a/b/resolve/main/x",
    "a/%2e%2e",
    "model",
    "a/b\\x",
    "http://huggingface.co/a/b",
  ])("rechaza %s", (v) => expect(() => parseHuggingFaceUrl(v)).toThrow());
});
it("normaliza tareas y admite desconocidas", () => {
  expect(normalizeTask("text-to-image").label).toBe("Image Generation");
  expect(normalizeTask("new-task").id).toBe("new-task");
});
describe("SSRF", () => {
  it.each([
    "https://localhost",
    "https://127.0.0.1",
    "https://a.hf.space.evil.com",
    "https://hf.space",
    "https://a.b.hf.space",
    "https://a.hf.space:8080",
    "https://huggingface.co/a/model.safetensors",
    "http://a.hf.space",
    "https://a@demo.hf.space",
  ])("bloquea %s", (u) => expect(() => validateRemoteUrl(u)).toThrow());
  it("acepta hosts oficiales", () => {
    expect(
      validateRemoteUrl("https://demo-test.hf.space/gradio_api/info").hostname,
    ).toBe("demo-test.hf.space");
  });
  it.each([
    "127.0.0.1",
    "0.0.0.0",
    "10.0.0.1",
    "172.16.3.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "fc00::1",
  ])("bloquea IP %s", (ip) => expect(isPublicIp(ip)).toBe(false));
});
