import { it, expect } from "vitest";
import {
  registerUpload,
  resolveUpload,
  validateUploadFile,
} from "../src/lib/server/uploads";
it("vincula uploads al Space y rechaza paths arbitrarios", () => {
  const id = registerUpload("a/b", { path: "/tmp/gradio/x.png" });
  expect(resolveUpload("a/b", { upload_id: id })).toEqual({
    path: "/tmp/gradio/x.png",
  });
  expect(() => resolveUpload("a/c", { upload_id: id })).toThrow();
  expect(() => resolveUpload("a/b", { path: "http://127.0.0.1" })).toThrow();
});
it("bloquea pesos y archivos vacíos", () => {
  expect(() =>
    validateUploadFile(new File(["x"], "model.safetensors")),
  ).toThrow();
  expect(() => validateUploadFile(new File([], "empty.txt"))).toThrow();
  expect(() =>
    validateUploadFile(new File(["hello"], "hello.txt")),
  ).not.toThrow();
});
