import type { Metadata } from "./types";
export const object = (v: unknown): Metadata =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Metadata) : {};
export const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
