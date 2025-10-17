export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "bypassPermissions";

export type PermissionUpdateDestination =
  | "userSettings"
  | "projectSettings"
  | "localSettings"
  | "session";

export type PermissionBehavior = "allow" | "deny" | "ask";

export interface PermissionRuleValue {
  toolName: string;
  ruleContent?: string | null;
}

export interface PermissionUpdate {
  type:
    | "addRules"
    | "replaceRules"
    | "removeRules"
    | "setMode"
    | "addDirectories"
    | "removeDirectories";
  rules?: PermissionRuleValue[];
  behavior?: PermissionBehavior;
  mode?: PermissionMode;
  directories?: string[];
  destination?: PermissionUpdateDestination;
}

export interface ToolPermissionContext {
  signal: AbortSignal | null;
  suggestions: PermissionUpdate[];
  blockedPath?: string | null;
}

export interface PermissionResultAllow {
  behavior: "allow";
  updatedInput?: Record<string, unknown>;
  updatedPermissions?: PermissionUpdate[];
}

export interface PermissionResultDeny {
  behavior: "deny";
  message?: string;
  interrupt?: boolean;
}

export type PermissionResult = PermissionResultAllow | PermissionResultDeny;

export interface HookContext {
  signal: AbortSignal | null;
}

export type HookJSONOutput = Record<string, unknown>;

export type HookEvent = string;

export type HookCallback = (
  input: Record<string, unknown> | undefined,
  toolUseId: string | null,
  context: HookContext
) => Promise<HookJSONOutput>;

export interface HookMatcher {
  matcher?: string | null;
  hooks?: HookCallback[];
}

export interface SystemPromptPreset {
  type: "preset";
  preset: "claude_code";
  append?: string;
}

export interface ClaudeAgentEnv {
  [key: string]: string | undefined;
}

export interface McpStdioServerConfig {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpSseServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

export interface McpHttpServerConfig {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}

export interface McpSdkServerConfig {
  type: "sdk";
  name: string;
  instance: unknown;
}

export type McpServerConfig =
  | McpStdioServerConfig
  | McpSseServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfig;

export interface AgentDefinition {
  description: string;
  prompt: string;
  tools?: string[];
  model?: "sonnet" | "opus" | "haiku" | "inherit" | null;
}

export type SettingSource = "user" | "project" | "local";

export interface ClaudeAgentOptions {
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string | SystemPromptPreset | null;
  mcpServers?: Record<string, McpServerConfig> | string;
  permissionMode?: PermissionMode | null;
  continueConversation?: boolean;
  resume?: string | null;
  maxTurns?: number | null;
  model?: string | null;
  permissionPromptToolName?: string | null;
  cwd?: string | null;
  cliPath?: string | null;
  settings?: string | null;
  addDirs?: string[];
  env?: Record<string, string>;
  extraArgs?: Record<string, string | null>;
  maxBufferSize?: number | null;
  stderr?: (line: string) => void;
  canUseTool?: (
    toolName: string,
    input: Record<string, unknown>,
    context: ToolPermissionContext
  ) => Promise<PermissionResult>;
  hooks?: Record<HookEvent, HookMatcher[]>;
  user?: string | null;
  includePartialMessages?: boolean;
  forkSession?: boolean;
  agents?: Record<string, AgentDefinition>;
  settingSources?: SettingSource[];
}

export type PromptMessage = Record<string, unknown>;

export type PromptSource = string | AsyncIterable<PromptMessage>;

export type SDKMessage = Record<string, unknown>;

export interface Transport {
  connect(): Promise<void>;
  write(payload: string): Promise<void>;
  endInput(): Promise<void>;
  readMessages(): AsyncIterable<SDKMessage>;
  close(): Promise<void>;
  isReady(): boolean;
}
