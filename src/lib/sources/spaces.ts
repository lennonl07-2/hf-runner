import type { SpaceSource } from "./interfaces";
import type { ModelInfo, SpaceExecutionOption } from "../types";
import { hub, remote } from "../server/http";
import { cached } from "../server/cache";
import { mapSettled } from "../server/concurrency";
import { normalizeSpace, deduplicateSpaces, referencesExactModel } from "../spaces";
import { parseHuggingFaceUrl } from "../parse";
const fields = [
  "runtime",
  "models",
  "sdk",
  "subdomain",
  "likes",
  "cardData",
  "tags",
  "lastModified",
  "private",
  "disabled",
];
export function spaceQuery(params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, limit: "30" });
  fields.forEach((f) => q.append("expand", f));
  return `/api/spaces?${q}`;
}
export async function spaceInfo(id: string) {
  parseHuggingFaceUrl(id);
  return cached(`space:${id}`, 300_000, () => hub(`/api/spaces/${id}`));
}
export class HuggingFaceScraperFallback {
  async discover(model: ModelInfo): Promise<string[]> {
    const response = await remote(`https://huggingface.co/${model.id}`, {
      maxBytes: 1_000_000,
    });
    if (!response.ok) return [];
    return [
      ...response.text.matchAll(
        /href="(?:https:\/\/huggingface.co)?\/spaces\/([\w.-]+\/[\w.-]+)"/g,
      ),
    ]
      .map((m) => m[1])
      .slice(0, 20);
  }
}
export class HuggingFaceSpaceSource implements SpaceSource {
  async discover(model: ModelInfo) {
    return cached(`spaces:${model.id}`, 300_000, async () => {
      const spaces: SpaceExecutionOption[] = [];
      const warnings: string[] = [];
      const add = (raw: unknown) => {
        const s = normalizeSpace(raw, model);
        if (s && s.public) spaces.push(s);
      };
      const queries: Record<string, string>[] = [
        { models: model.id },
        { search: model.id },
        { search: model.name },
        { author: model.author, search: model.name },
      ];
      for (const q of queries) {
        try {
          const list = await hub(spaceQuery(q));
          if (Array.isArray(list)) {
            list.forEach(add);
            if (list.length >= 30)
              warnings.push(
                "La búsqueda está limitada a 30 resultados por consulta.",
              );
          }
        } catch {
          warnings.push(
            "Una búsqueda de Spaces no pudo completarse; los resultados pueden ser parciales.",
          );
        }
      }
      const missing = model.associatedSpaces
        .filter((id) => !spaces.some((s) => s.id === id))
        .slice(0, 15);
      const linked = await mapSettled(missing, 4, spaceInfo);
      linked.forEach((r) => {
        if (r.status === "fulfilled") add(r.value);
      });
      if (spaces.length < 3) {
        try {
          const tag = model.tags.find(
            (t) => !t.includes(":") && t !== model.library,
          );
          if (tag) {
            const list = await hub(
              spaceQuery({ search: model.name, filter: tag }),
            );
            if (Array.isArray(list)) list.forEach(add);
          }
        } catch {
          warnings.push("No se completó la búsqueda complementaria por tags.");
        }
      }
      if (spaces.length < 3) {
        try {
          const card = await remote(
            `https://huggingface.co/${model.id}/raw/main/README.md`,
            { maxBytes: 300_000, auth: true },
          );
          const ids = [
            ...card.text.matchAll(
              /https:\/\/huggingface\.co\/spaces\/([\w.-]+\/[\w.-]+)/g,
            ),
          ].map((m) => m[1]);
          if (!ids.length)
            ids.push(
              ...(await new HuggingFaceScraperFallback().discover(model)),
            );
          const results = await mapSettled(
            [...new Set(ids)].slice(0, 15),
            4,
            spaceInfo,
          );
          results.forEach((r) => {
            if (r.status === "fulfilled") add(r.value);
          });
        } catch {
          warnings.push("La búsqueda secundaria no pudo completarse.");
        }
      }
      const unique = deduplicateSpaces(spaces).slice(0, 40);
      const verified = await mapSettled(unique, 4, async (s) => {
        if (s.confidence === "EXACT") return s;
        try {
          const readme = await remote(
            `https://huggingface.co/spaces/${s.id}/raw/main/README.md`,
            { maxBytes: 180_000 },
          );
          if (
            readme.ok &&
            referencesExactModel(readme.text, model.id)
          )
            return {
              ...s,
              confidence: "HIGH" as const,
              reasons: [`El README referencia ${model.id}.`],
            };
        } catch {}
        return s;
      });
      return {
        spaces: verified.flatMap((r) =>
          r.status === "fulfilled" ? [r.value] : [],
        ),
        warnings: [...new Set(warnings)],
      };
    });
  }
}
