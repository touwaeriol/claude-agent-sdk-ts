import { CLIConnectionError } from "./errors";
import { Query } from "./query";
import { SubprocessCLITransport } from "./transport";
import type {
  ClaudeAgentOptions,
  HookMatcher,
  PermissionMode,
  PromptMessage,
  SDKMessage,
  Transport,
} from "./types";

function isAsyncIterable(
  value: unknown
): value is AsyncIterable<PromptMessage> {
  return (
    value !== null &&
    typeof value === "object" &&
    Symbol.asyncIterator in (value as Record<string, unknown>)
  );
}

async function* emptyPromptStream(): AsyncGenerator<PromptMessage> {
  return;
}

function convertHooks(
  hooks: Record<string, HookMatcher[]> | undefined
): Record<string, HookMatcher[]> | undefined {
  if (!hooks) {
    return undefined;
  }
  return hooks;
}

export class ClaudeAgentSDKClient {
  readonly options: ClaudeAgentOptions;
  private readonly customTransport: Transport | undefined;
  private transport: Transport | undefined;
  private queryInstance: Query | undefined;

  constructor(options: ClaudeAgentOptions = {}, transport?: Transport) {
    this.options = options;
    this.customTransport = transport;
    process.env.CLAUDE_CODE_ENTRYPOINT = "sdk-ts-client";
  }

  async connect(
    prompt?: string | AsyncIterable<PromptMessage>
  ): Promise<void> {
    if (this.queryInstance) {
      await this.disconnect();
    }

    if (
      this.options.canUseTool &&
      this.options.permissionPromptToolName
    ) {
      throw new CLIConnectionError(
        "canUseTool 回调与 permissionPromptToolName 互斥，请二选一。"
      );
    }

    if (this.customTransport && typeof prompt === "string") {
      throw new CLIConnectionError(
        "使用自定义 Transport 时暂不支持字符串提示。"
      );
    }

    const transportOptions: ClaudeAgentOptions = {
      ...this.options,
      allowedTools: this.options.allowedTools?.slice(),
      disallowedTools: this.options.disallowedTools?.slice(),
      addDirs: this.options.addDirs?.slice(),
      extraArgs: this.options.extraArgs
        ? { ...this.options.extraArgs }
        : undefined,
    };

    let promptSource: string | AsyncIterable<PromptMessage>;
    let isStreamingMode = true;

    if (!this.customTransport) {
      if (prompt === undefined) {
        promptSource = emptyPromptStream();
      } else if (typeof prompt === "string") {
        promptSource = prompt;
        isStreamingMode = false;
      } else if (isAsyncIterable(prompt)) {
        promptSource = prompt;
      } else {
        throw new CLIConnectionError(
          "prompt 仅支持字符串或 AsyncIterable。"
        );
      }
    } else {
      promptSource = emptyPromptStream();
    }

    if (this.options.canUseTool && !isStreamingMode) {
      throw new CLIConnectionError(
        "字符串提示模式不支持 canUseTool 回调，请改用流式提示。"
      );
    }

    if (
      this.options.canUseTool &&
      !transportOptions.permissionPromptToolName
    ) {
      transportOptions.permissionPromptToolName = "stdio";
    }

    const sdkMcpServers: Record<string, unknown> = {};
    if (
      this.options.mcpServers &&
      typeof this.options.mcpServers !== "string"
    ) {
      for (const [name, config] of Object.entries(this.options.mcpServers)) {
        if (
          config &&
          typeof config === "object" &&
          (config as { type?: string }).type === "sdk"
        ) {
          const instance = (config as { instance?: unknown }).instance;
          if (instance) {
            sdkMcpServers[name] = instance;
          }
        }
      }
    }

    const transport =
      this.customTransport ??
      new SubprocessCLITransport(promptSource, transportOptions);
    await transport.connect();

    this.transport = transport;
    this.queryInstance = new Query({
      transport,
      canUseTool: transportOptions.canUseTool,
      hooks: convertHooks(transportOptions.hooks),
      sdkMcpServers,
      isStreamingMode: isStreamingMode || Boolean(this.customTransport),
    });

    await this.queryInstance.start();
    await this.queryInstance.initialize();

    if (
      (this.customTransport || isStreamingMode) &&
      prompt &&
      typeof prompt !== "string"
    ) {
      void this.queryInstance.streamInput(prompt);
    }
  }

  receiveMessages(): AsyncIterable<SDKMessage> {
    if (!this.queryInstance) {
      throw new CLIConnectionError("请先调用 connect() 建立连接。");
    }
    return this.queryInstance.receiveMessages();
  }

  async query(
    prompt: string | AsyncIterable<PromptMessage>,
    sessionId = "default"
  ): Promise<void> {
    if (!this.transport || !this.queryInstance) {
      throw new CLIConnectionError("请先调用 connect() 建立连接。");
    }

    if (typeof prompt === "string") {
      const message = {
        type: "user",
        message: {
          role: "user",
          content: prompt,
        },
        parent_tool_use_id: null,
        session_id: sessionId,
      };
      await this.transport.write(`${JSON.stringify(message)}\n`);
      return;
    }

    for await (const message of prompt) {
      if (!("session_id" in message)) {
        message.session_id = sessionId;
      }
      await this.transport.write(`${JSON.stringify(message)}\n`);
    }
  }

  async interrupt(): Promise<void> {
    if (!this.queryInstance) {
      throw new CLIConnectionError("请先调用 connect() 建立连接。");
    }
    await this.queryInstance.interrupt();
  }

  async setPermissionMode(mode: PermissionMode): Promise<void> {
    if (!this.queryInstance) {
      throw new CLIConnectionError("请先调用 connect() 建立连接。");
    }
    await this.queryInstance.setPermissionMode(mode);
  }

  async setModel(model: string | null): Promise<void> {
    if (!this.queryInstance) {
      throw new CLIConnectionError("请先调用 connect() 建立连接。");
    }
    await this.queryInstance.setModel(model);
  }

  getServerInfo(): Record<string, unknown> | null {
    return this.queryInstance?.getInitializationResult() ?? null;
  }

  async disconnect(): Promise<void> {
    if (!this.queryInstance) {
      return;
    }

    await this.queryInstance.close();
    this.queryInstance = undefined;
    this.transport = undefined;
  }
}
