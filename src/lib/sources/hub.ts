import { z } from "zod";
import { normalizeTask } from "../tasks";
import { hub } from "../server/http";
import { cached } from "../server/cache";
import type { ModelSource } from "./interfaces";
import type { Metadata } from "../types";
export const object = (v: unknown): Metadata =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Metadata) : {};
export const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const schema = z.object({
  id: z.string(),
  author: z.string().optional(),
  pipeline_tag: z.string().optional(),
  library_name: z.string().optional(),
  downloads: z.number().default(0),
  likes: z.number().default(0),
  private: z.boolean().default(false),
  gated: z.union([z.boolean(), z.string()]).default(false),
  lastModified: z.string().optional(),
  tags: z.array(z.string()).default([]),
  config: z.unknown(),
  cardData: z.unknown(),
  safetensors: z.object({ total: z.number().optional() }).optional(),
  spaces: z.array(z.string()).default([]),
});
export class HuggingFaceHubSource implements ModelSource {
  async getModel(id: string) {
    return cached(`model:${id}`, 600_000, async () => {
      const raw = schema.parse(await hub(`/api/models/${id}`));
      const cardData = object(raw.cardData);
      const config = object(raw.config);
      const task = normalizeTask(
        raw.pipeline_tag ??
          (typeof cardData.pipeline_tag === "string"
            ? cardData.pipeline_tag
            : undefined),
      );
      return {
        id: raw.id,
        author: raw.author ?? raw.id.split("/")[0],
        name: raw.id.split("/")[1],
        task: task.id,
        friendlyTask: task.label,
        taskIcon: task.icon,
        tags: raw.tags,
        library: raw.library_name,
        downloads: raw.downloads,
        likes: raw.likes,
        private: raw.private,
        gated: raw.gated,
        lastModified: raw.lastModified,
        license:
          typeof cardData.license_name === "string"
            ? cardData.license_name
            : typeof cardData.license === "string"
              ? cardData.license
              : undefined,
        config,
        cardData,
        architecture: strings(config.architectures).concat(
          strings([object(config.diffusers)._class_name]),
        ),
        parameters: raw.safetensors?.total,
        associatedSpaces: raw.spaces,
      };
    });
  }
}
