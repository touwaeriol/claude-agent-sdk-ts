import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/transport", () => {
  const instances: Array<{
    promptArg: unknown;
    optionsArg: Record<string, unknown> | undefined;
  }> = [];

  class MockSubprocessCLITransport {
    promptArg: unknown;
    optionsArg: Record<string, unknown> | undefined;

    constructor(prompt: unknown, options?: Record<string, unknown>) {
      this.promptArg = prompt;
      this.optionsArg = options;
      instances.push(this);
    }

    async connect(): Promise<void> {
      // no-op
    }

    async write(): Promise<void> {
      throw new Error("write not implemented in mock");
    }

    async endInput(): Promise<void> {
      // no-op
    }

    async *readMessages(): AsyncIterable<Record<string, unknown>> {
      if (false) {
        yield {};
      }
    }

    async close(): Promise<void> {
      // no-op
    }

    isReady(): boolean {
      return true;
    }
  }

  return {
    SubprocessCLITransport: MockSubprocessCLITransport,
    __transportMocks: {
      instances,
    },
  };
});

vi.mock("../src/query", () => {
  const optionsLog: Array<Record<string, unknown>> = [];

  class MockQuery {
    static instances: MockQuery[] = [];

    private readonly options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      optionsLog.push(options);
      MockQuery.instances.push(this);
    }

    async initialize(): Promise<Record<string, unknown> | null> {
      return {};
    }

    async start(): Promise<void> {
      // no-op
    }

    async streamInput(): Promise<void> {
      // no-op
    }

    receiveMessages(): AsyncIterable<Record<string, unknown>> {
      return {
        async *[Symbol.asyncIterator]() {
          if (false) {
            yield {};
          }
        },
      };
    }

    async interrupt(): Promise<void> {
      // no-op
    }

    async setPermissionMode(): Promise<void> {
      // no-op
    }

    async setModel(): Promise<void> {
      // no-op
    }

    getInitializationResult(): Record<string, unknown> | null {
      return {};
    }

    async close(): Promise<void> {
      // no-op
    }
  }

  return {
    Query: MockQuery,
    __queryMocks: {
      optionsLog,
    },
  };
});

describe("ClaudeAgentSDKClient connect variations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("uses non-streaming mode when prompt is string", async () => {
    const transportModule = await import("../src/transport");
    const queryModule = await import("../src/query");
    const { ClaudeAgentSDKClient } = await import("../src/client");

    const client = new ClaudeAgentSDKClient();
    await client.connect("hello world");

    const transportMocks = (transportModule as unknown as {
      __transportMocks: { instances: Array<{ promptArg: unknown }> };
    }).__transportMocks;

    const queryMocks = (queryModule as unknown as {
      __queryMocks: { optionsLog: Array<Record<string, unknown>> };
    }).__queryMocks;

    expect(transportMocks.instances).toHaveLength(1);
    expect(transportMocks.instances[0].promptArg).toBe("hello world");

    expect(queryMocks.optionsLog[0].isStreamingMode).toBe(false);

    await client.disconnect();
  });

  it("rejects string prompt when canUseTool is provided", async () => {
    const { ClaudeAgentSDKClient } = await import("../src/client");

    const client = new ClaudeAgentSDKClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canUseTool: async () => ({ behavior: "allow" } as any),
    });

    await expect(client.connect("hello"))
      .rejects.toThrow("字符串提示模式不支持 canUseTool 回调");
  });
});
