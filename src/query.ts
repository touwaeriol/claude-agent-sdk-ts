import { randomBytes } from "node:crypto";

import { CLIConnectionError } from "./errors";
import type {
  HookMatcher,
  PermissionResult,
  PermissionResultAllow,
  PermissionResultDeny,
  PermissionUpdate,
  PromptMessage,
  SDKMessage,
  ToolPermissionContext,
  Transport,
} from "./types";
import { AsyncQueue } from "./utils/asyncQueue";

type ControlRequestMessage = SDKMessage & {
  type: "control_request";
  request_id: string;
  request: Record<string, unknown>;
};

type ControlResponseMessage = SDKMessage & {
  type: "control_response";
  response: {
    subtype: "success" | "error";
    request_id: string;
    response?: Record<string, unknown> | null;
    error?: string;
  };
};

function isControlResponseMessage(
  message: SDKMessage
): message is ControlResponseMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "control_response"
  );
}

function isControlRequestMessage(
  message: SDKMessage
): message is ControlRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "control_request"
  );
}

function serializePermissionUpdates(
  updates: PermissionUpdate[] | undefined
): Record<string, unknown>[] | undefined {
  if (!updates || updates.length === 0) {
    return undefined;
  }

  return updates.map((update) => {
    const result: Record<string, unknown> = {
      type: update.type,
    };

    if (update.destination) {
      result.destination = update.destination;
    }

    if (update.rules) {
      result.rules = update.rules.map((rule) => ({
        toolName: rule.toolName,
        ruleContent: rule.ruleContent ?? null,
      }));
    }

    if (update.behavior) {
      result.behavior = update.behavior;
    }

    if (update.mode) {
      result.mode = update.mode;
    }

    if (update.directories) {
      result.directories = update.directories;
    }

    return result;
  });
}

function convertHookOutputForCli(
  output: Record<string, unknown>
): Record<string, unknown> {
  const converted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(output)) {
    if (key === "async_") {
      converted.async = value;
    } else if (key === "continue_") {
      converted.continue = value;
    } else {
      converted[key] = value;
    }
  }

  return converted;
}

function buildHookConfig(
  hooks: Record<string, HookMatcher[]> | undefined,
  register: (id: string, callback: NonNullable<HookMatcher["hooks"]>[number]) => void
): Record<string, unknown> | undefined {
  if (!hooks) {
    return undefined;
  }

  const config: Record<string, unknown> = {};

  for (const [event, matchers] of Object.entries(hooks)) {
    if (!matchers || matchers.length === 0) {
      continue;
    }

    const matcherConfigs = [];
    for (const matcher of matchers) {
      const hookCallbackIds: string[] = [];
      if (matcher.hooks) {
        for (const callback of matcher.hooks) {
          const callbackId = `hook_${randomBytes(4).toString("hex")}`;
          register(callbackId, callback);
          hookCallbackIds.push(callbackId);
        }
      }

      matcherConfigs.push({
        matcher: matcher.matcher ?? null,
        hookCallbackIds,
      });
    }

    if (matcherConfigs.length > 0) {
      config[event] = matcherConfigs;
    }
  }

  if (Object.keys(config).length === 0) {
    return undefined;
  }

  return config;
}

type JsonRpcId = string | number | null;

type JsonRpcMessage = Record<string, unknown> & {
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
  jsonrpc?: string;
};

interface McpTransportLike {
  start(): Promise<void>;
  send(message: JsonRpcMessage, options?: unknown): Promise<void>;
  close(): Promise<void>;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JsonRpcMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;
}

class InMemoryMcpTransport implements McpTransportLike {
  onclose: (() => void) | undefined;
  onerror: ((error: Error) => void) | undefined;
  onmessage: ((message: JsonRpcMessage) => void) | undefined;
  sessionId: string | undefined;
  setProtocolVersion: ((version: string) => void) | undefined;

  private readonly outboundQueue = new AsyncQueue<JsonRpcMessage>();
  private readonly outboundIterator = this.outboundQueue[Symbol.asyncIterator]();
  private closed = false;

  async start(): Promise<void> {
    // no-op
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (this.closed) {
      throw new Error("MCP 传输已关闭，无法发送消息。");
    }
    this.outboundQueue.push(message);
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.outboundQueue.close();
    if (this.onclose) {
      this.onclose();
    }
  }

  async deliver(message: JsonRpcMessage): Promise<void> {
    if (this.closed) {
      throw new Error("MCP 传输已关闭。");
    }
    if (!this.onmessage) {
      throw new Error("MCP 传输尚未初始化消息处理器。");
    }

    try {
      await this.onmessage(message);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.onerror) {
        this.onerror(err);
        return;
      }
      throw err;
    }
  }

  async nextMessage(): Promise<JsonRpcMessage | undefined> {
    const { value, done } = await this.outboundIterator.next();
    if (done) {
      return undefined;
    }
    return value;
  }
}

async function waitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return await new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        if (timer) {
          clearTimeout(timer);
        }
        resolve(value);
      },
      (error) => {
        if (timer) {
          clearTimeout(timer);
        }
        reject(error);
      }
    );
  });
}

class McpServerBridge {
  private readonly transport = new InMemoryMcpTransport();
  private connected = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly instance: unknown) {}

  async handleRequest(message: JsonRpcMessage): Promise<JsonRpcMessage> {
    await this.queue;
    const pending = this.processRequest(message);
    this.queue = pending
      .then(() => undefined)
      .catch(() => undefined);
    return pending;
  }

  async close(): Promise<void> {
    await this.transport.close();

    const candidate = this.instance as { close?: () => Promise<void> | void };
    if (candidate && typeof candidate.close === "function") {
      await candidate.close();
    }
  }

  private async processRequest(message: JsonRpcMessage): Promise<JsonRpcMessage> {
    await this.ensureConnected();
    await this.transport.deliver(message);

    const requestId = message.id ?? null;
    if (requestId === undefined || requestId === null) {
      return {
        jsonrpc: typeof message.jsonrpc === "string" ? message.jsonrpc : "2.0",
        id: null,
        result: null,
      };
    }

    return await waitWithTimeout(
      this.waitForResponse(requestId),
      60_000,
      "等待 MCP 响应超时。"
    );
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }

    const candidate = this.instance as {
      connect?: (transport: McpTransportLike) => Promise<void> | void;
    };

    if (!candidate || typeof candidate.connect !== "function") {
      throw new Error("MCP 服务器实例缺少 connect() 方法。");
    }

    await candidate.connect(this.transport);
    this.connected = true;
  }

  private async waitForResponse(requestId: JsonRpcId): Promise<JsonRpcMessage> {
    const normalizedId = requestId === null ? null : String(requestId);

    while (true) {
      const message = await this.transport.nextMessage();
      if (!message) {
        throw new Error("MCP 服务器连接已关闭。");
      }

      const messageId =
        message.id === undefined || message.id === null
          ? null
          : String(message.id);

      if (messageId === normalizedId) {
        return message;
      }
      // 忽略与当前请求无关的通知等消息
    }
  }
}

export class Query {
  private readonly transport: Transport;
  private readonly canUseTool:
    | ((
        toolName: string,
        input: Record<string, unknown>,
        context: ToolPermissionContext
      ) => Promise<PermissionResult>)
    | undefined;
  private readonly hooks:
    | Record<string, HookMatcher[]>
    | undefined;
  private readonly isStreamingMode: boolean;
  private readonly sdkMcpServers: Record<string, unknown>;
  private readonly sdkMcpBridges = new Map<string, McpServerBridge>();
  private readonly messageQueue = new AsyncQueue<SDKMessage>();
  private readonly pendingControlRequests = new Map<
    string,
    {
      resolve: (value: Record<string, unknown>) => void;
      reject: (reason: unknown) => void;
    }
  >();
  private readonly hookCallbacks = new Map<
    string,
    NonNullable<HookMatcher["hooks"]>[number]
  >();
  private readLoopPromise: Promise<void> | undefined;
  private requestCounter = 0;
  private closed = false;
  private initializationResult: Record<string, unknown> | null = null;

  constructor(options: {
    transport: Transport;
    canUseTool?: Query["canUseTool"];
    hooks?: Record<string, HookMatcher[]>;
    sdkMcpServers?: Record<string, unknown>;
    isStreamingMode?: boolean;
  }) {
    this.transport = options.transport;
    this.canUseTool = options.canUseTool;
    this.hooks = options.hooks;
    this.isStreamingMode = options.isStreamingMode ?? true;
    this.sdkMcpServers = options.sdkMcpServers ?? {};
  }

  async initialize(): Promise<Record<string, unknown> | null> {
    if (!this.isStreamingMode) {
      this.initializationResult = null;
      return null;
    }

    const hookConfig = buildHookConfig(this.hooks, (id, callback) => {
      this.hookCallbacks.set(id, callback);
    });

    const response = await this.sendControlRequest({
      subtype: "initialize",
      hooks: hookConfig ?? null,
    });

    this.initializationResult = response;
    return response;
  }

  async start(): Promise<void> {
    if (!this.readLoopPromise) {
      this.readLoopPromise = this.readLoop().catch((error) => {
        this.messageQueue.fail(error);
      });
    }
  }

  receiveMessages(): AsyncIterable<SDKMessage> {
    return this.messageQueue;
  }

  async streamInput(stream: AsyncIterable<PromptMessage>): Promise<void> {
    if (!this.isStreamingMode) {
      throw new CLIConnectionError("非流式模式不支持 streamInput。");
    }
    for await (const message of stream) {
      await this.transport.write(`${JSON.stringify(message)}\n`);
    }
    await this.transport.endInput();
  }

  async interrupt(): Promise<void> {
    await this.sendControlRequest({ subtype: "interrupt" });
  }

  async setPermissionMode(mode: string): Promise<void> {
    await this.sendControlRequest({ subtype: "set_permission_mode", mode });
  }

  async setModel(model: string | null): Promise<void> {
    await this.sendControlRequest({ subtype: "set_model", model });
  }

  getInitializationResult(): Record<string, unknown> | null {
    return this.initializationResult;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.messageQueue.close();
    const bridges = Array.from(this.sdkMcpBridges.values());
    this.sdkMcpBridges.clear();
    for (const bridge of bridges) {
      try {
        await bridge.close();
      } catch {
        // 忽略 MCP server 关闭异常
      }
    }
    await this.transport.close();
    if (this.readLoopPromise) {
      try {
        await this.readLoopPromise;
      } catch {
        // 已在 fail 中处理
      }
    }
  }

  private async readLoop(): Promise<void> {
    try {
      for await (const message of this.transport.readMessages()) {
        if (this.closed) {
          break;
        }

        if (isControlResponseMessage(message)) {
          this.handleControlResponse(message);
          continue;
        }

        if (isControlRequestMessage(message)) {
          void this.handleControlRequest(message);
          continue;
        }

        if ((message.type as string | undefined) === "control_cancel_request") {
          // TODO: 支持取消逻辑
          continue;
        }

        this.messageQueue.push(message);
      }
    } catch (error) {
      this.messageQueue.fail(error);
    } finally {
      this.messageQueue.close();
    }
  }

  private handleControlResponse(message: ControlResponseMessage): void {
    const requestId = message.response.request_id;
    const pending = this.pendingControlRequests.get(requestId);
    if (!pending) {
      return;
    }

    this.pendingControlRequests.delete(requestId);

    if (message.response.subtype === "error") {
      pending.reject(
        new Error(message.response.error ?? "控制通道返回未知错误。")
      );
      return;
    }

    pending.resolve(message.response.response ?? {});
  }

  private async handleControlRequest(
    request: ControlRequestMessage
  ): Promise<void> {
    const { request_id: requestId } = request;
    const requestBody = request.request;
    const subtype = requestBody.subtype as string | undefined;

    try {
      if (!subtype) {
        throw new Error("控制请求缺少 subtype 字段。");
      }

      let responsePayload: Record<string, unknown> | undefined;

      if (subtype === "can_use_tool") {
        if (!this.canUseTool) {
          throw new Error("未提供 canUseTool 回调，无法处理工具权限请求。");
        }

        const toolName = String(requestBody.tool_name ?? "");
        const input = (requestBody.input as Record<string, unknown>) ?? {};
        const suggestions =
          (requestBody.permission_suggestions as PermissionUpdate[]) ?? [];

        const context: ToolPermissionContext = {
          signal: null,
          suggestions,
          blockedPath:
            (requestBody.blocked_path as string | null | undefined) ?? null,
        };

        const decision = await this.canUseTool(toolName, input, context);

        if ((decision as PermissionResultAllow).behavior === "allow") {
          const allowDecision = decision as PermissionResultAllow;
          responsePayload = {
            behavior: "allow",
            updatedInput: allowDecision.updatedInput ?? input,
          };

          const permissionUpdates = serializePermissionUpdates(
            allowDecision.updatedPermissions
          );
          if (permissionUpdates) {
            responsePayload.updatedPermissions = permissionUpdates;
          }
        } else if ((decision as PermissionResultDeny).behavior === "deny") {
          const denyDecision = decision as PermissionResultDeny;
          responsePayload = {
            behavior: "deny",
            message: denyDecision.message ?? "",
          };
          if (denyDecision.interrupt !== undefined) {
            responsePayload.interrupt = denyDecision.interrupt;
          }
        } else {
          throw new Error("canUseTool 回调返回了未知的 PermissionResult 类型。");
        }
      } else if (subtype === "hook_callback") {
        const callbackId = String(requestBody.callback_id ?? "");
        const callback = this.hookCallbacks.get(callbackId);
        if (!callback) {
          throw new Error(`未找到 hook 回调：${callbackId}`);
        }
        const hookOutput = await callback(
          requestBody.input as Record<string, unknown> | undefined,
          (requestBody.tool_use_id as string | null | undefined) ?? null,
          { signal: null }
        );
        responsePayload = convertHookOutputForCli(hookOutput);
      } else if (subtype === "mcp_message") {
        const serverName = String(requestBody.server_name ?? "");
        if (!serverName) {
          throw new Error("MCP 控制请求缺少 server_name。");
        }

        const message = requestBody.message;
        if (!message || typeof message !== "object") {
          throw new Error("MCP 控制请求缺少有效的 message 字段。");
        }

        const bridge = this.getOrCreateMcpServerBridge(serverName);
        const mcpResponse = await bridge.handleRequest(
          message as JsonRpcMessage
        );
        responsePayload = { mcp_response: mcpResponse };
      } else {
        throw new Error(`不支持的控制请求子类型：${subtype}`);
      }

      const success: ControlResponseMessage = {
        type: "control_response",
        response: {
          subtype: "success",
          request_id: requestId,
          response: responsePayload ?? {},
        },
      };
      await this.transport.write(`${JSON.stringify(success)}\n`);
    } catch (error) {
      const failure: ControlResponseMessage = {
        type: "control_response",
        response: {
          subtype: "error",
          request_id: requestId,
          error: (error as Error).message,
        },
      };
      await this.transport.write(`${JSON.stringify(failure)}\n`);
    }
  }

  private async sendControlRequest(
    request: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.isStreamingMode) {
      throw new CLIConnectionError("控制请求仅在流式模式下可用。");
    }
    const requestId = `req_${++this.requestCounter}_${randomBytes(4).toString(
      "hex"
    )}`;

    const payload: ControlRequestMessage = {
      type: "control_request",
      request_id: requestId,
      request,
    };

    const responsePromise = new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        this.pendingControlRequests.set(requestId, { resolve, reject });
      }
    );

    await this.transport.write(`${JSON.stringify(payload)}\n`);

    try {
      return await responsePromise;
    } catch (error) {
      throw new CLIConnectionError(
        `控制请求失败：${(error as Error).message}`,
        { cause: error instanceof Error ? error : undefined }
      );
    } finally {
      this.pendingControlRequests.delete(requestId);
    }
  }

  private getOrCreateMcpServerBridge(serverName: string): McpServerBridge {
    let bridge = this.sdkMcpBridges.get(serverName);
    if (bridge) {
      return bridge;
    }

    const instance = this.sdkMcpServers[serverName];
    if (!instance) {
      throw new Error(`未找到名为 ${serverName} 的 SDK MCP 服务器实例。`);
    }

    bridge = new McpServerBridge(instance);
    this.sdkMcpBridges.set(serverName, bridge);
    return bridge;
  }
}
