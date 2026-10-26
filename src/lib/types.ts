export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type Metadata = Record<string, Json>;
export type ModelTask = ReturnType<typeof import("./tasks").normalizeTask>;
export interface ModelInfo {
  id: string;
  author: string;
  name: string;
  task: string;
  friendlyTask: string;
  taskIcon: string;
  tags: string[];
  library?: string;
  downloads: number;
  likes: number;
  license?: string;
  private: boolean;
  gated: boolean | string;
  lastModified?: string;
  config: Metadata;
  cardData: Metadata;
  architecture: string[];
  parameters?: number;
  inference?: string;
  associatedSpaces: string[];
}
export interface ModelAnalysis {
  model: ModelInfo;
  spaces: SpaceExecutionOption[];
  providers: ProviderExecutionOption[];
  summary: {
    spacesFound: number;
    running: number;
    free: number;
    apiAccessible: number;
  };
  warnings: string[];
  connected: boolean;
}
export type ExecutionStatus =
  "RUNNING" | "SLEEPING" | "BUILDING" | "ERROR" | "STOPPED" | "UNKNOWN";
export type PricingStatus = "FREE" | "FREE WITH LIMITS" | "PAID" | "UNKNOWN";
export type Confidence = "EXACT" | "HIGH" | "MEDIUM" | "LOW";
export interface InputSchema {
  name: string;
  label: string;
  component: string;
  required: boolean;
  defaultValue: Json;
  choices: Json[];
  minimum?: number;
  maximum?: number;
  step?: number;
  schema: Metadata;
}
export interface OutputSchema {
  label: string;
  component: string;
  schema: Metadata;
}
export interface GradioEndpoint {
  apiName: string;
  inputs: InputSchema[];
  outputs: OutputSchema[];
  compatible: boolean;
}
export interface GradioApi {
  apiAvailable: boolean;
  framework: "gradio";
  endpoints: GradioEndpoint[];
  basePath: string;
}
interface BaseOption {
  id: string;
  title: string;
  url: string;
  pricing: PricingStatus;
  pricingEvidence: string;
  status: ExecutionStatus;
  score: number;
  reasons: string[];
  mode: "EMBEDDED/API" | "EXTERNAL" | "PROVIDER" | "UNAVAILABLE";
}
export interface SpaceExecutionOption extends BaseOption {
  kind: "space";
  author: string;
  likes: number;
  sdk: string;
  models: string[];
  tags: string[];
  lastModified?: string;
  runtime: Metadata;
  hardware?: string;
  host?: string;
  disabled: boolean;
  public: boolean;
  zeroGpu: true | false | "unknown";
  official: boolean;
  confidence: Confidence;
  api?: GradioApi;
  httpStatus?: number;
  checkedAt?: string;
}
export interface ProviderExecutionOption extends BaseOption {
  kind: "provider";
  provider: string;
  providerModelId?: string;
  task?: string;
  details: Metadata;
}
export type RemoteExecutionOption =
  SpaceExecutionOption | ProviderExecutionOption;
