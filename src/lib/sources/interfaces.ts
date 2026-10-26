import type {
  ModelInfo,
  SpaceExecutionOption,
  ProviderExecutionOption,
} from "../types";
export interface ModelSource {
  getModel(id: string): Promise<ModelInfo>;
}
export interface SpaceSource {
  discover(
    model: ModelInfo,
  ): Promise<{ spaces: SpaceExecutionOption[]; warnings: string[] }>;
}
export interface InferenceSource {
  discover(model: ModelInfo): Promise<ProviderExecutionOption[]>;
}
