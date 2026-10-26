import { parseHuggingFaceUrl } from "./parse";
import type { ModelAnalysis } from "./types";
export interface RecentModel {
  id: string;
  date: string;
  summary: { spacesFound: number; running: number };
}
export function loadRecents(): RecentModel[] {
  try {
    const raw = JSON.parse(localStorage.getItem("hf-runner:recent") ?? "[]");
    return Array.isArray(raw)
      ? raw
          .filter((v): v is RecentModel => {
            try {
              return (
                typeof v.date === "string" &&
                parseHuggingFaceUrl(v.id) === v.id &&
                typeof v.summary?.spacesFound === "number" &&
                typeof v.summary?.running === "number"
              );
            } catch {
              return false;
            }
          })
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}
export function saveRecent(data: ModelAnalysis) {
  if (data.model.private) return;
  try {
    const next = [
      {
        id: data.model.id,
        date: new Date().toISOString(),
        summary: {
          spacesFound: data.summary.spacesFound,
          running: data.summary.running,
        },
      },
      ...loadRecents().filter((m) => m.id !== data.model.id),
    ].slice(0, 10);
    localStorage.setItem("hf-runner:recent", JSON.stringify(next));
  } catch {}
}
export function loadFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem("hf-runner:favorites") ?? "[]");
    return Array.isArray(raw)
      ? raw
          .filter((v): v is string => {
            try {
              return parseHuggingFaceUrl(v) === v;
            } catch {
              return false;
            }
          })
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
export function saveFavorites(ids: string[]) {
  try {
    localStorage.setItem(
      "hf-runner:favorites",
      JSON.stringify(ids.slice(0, 50)),
    );
  } catch {}
}
