import { describe, expect, it } from "vitest";

import { Query } from "../src/query";
import type { SDKMessage, Transport } from "../src/types";
import { AsyncQueue } from "../src/utils/asyncQueue";

class TestTransport implements Transport {
  readonly written: string[] = [];
  private readonly messageQueue = new AsyncQueue<SDKMessage>();
  private awaiting: Array<{ count: number; resolve: () => void }> = [];
  private nextControlResponse: Record<string, unknown> | null | undefined;

  setNextControlResponse(response: Record<string, unknown> | null): void {
    this.nextControlResponse = response;
  }

  async connect(): Promise<void> {
    // no-op
  }

  async write(payload: string): Promise<void> {
    this.written.push(payload);
    this.maybeResolve();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return;
    }

    if (parsed.type === "control_request") {
      const requestId = parsed.request_id as string;
      const responsePayload =
        this.nextControlResponse === undefined ? {} : this.nextControlResponse;
      this.nextControlResponse = undefined;

      this.messageQueue.push({
        type: "control_response",
        response: {
          subtype: "success",
          request_id: requestId,
          response: responsePayload,
        },
      });
    }
  }

  async endInput(): Promise<void> {
    // no-op
  }

  async *readMessages(): AsyncIterable<SDKMessage> {
    for await (const message of this.messageQueue) {
      yield message;
    }
  }

  async close(): Promise<void> {
    this.messageQueue.close();
  }

  isReady(): boolean {
    return true;
  }

  pushMessage(message: SDKMessage): void {
    this.messageQueue.push(message);
  }

  waitForWrites(count: number): Promise<void> {
    if (this.written.length >= count) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.awaiting.push({ count, resolve });
    });
  }

  private maybeResolve(): void {
    if (this.awaiting.length === 0) {
      return;
    }

    const remaining: Array<{ count: number; resolve: () => void }> = [];
    for (const entry of this.awaiting) {
      if (this.written.length >= entry.count) {
        entry.resolve();
      } else {
        remaining.push(entry);
      }
    }
    this.awaiting = remaining;
  }
}

class FakeMcpServer {
  connectCalls = 0;
  lastMessage: Record<string, unknown> | undefined;

  async connect(transport: {
    onmessage?: (message: Record<string, unknown>) => Promise<void> | void;
    send: (message: Record<string, unknown>) => Promise<void>;
  }): Promise<void> {
    this.connectCalls += 1;
    transport.onmessage = async (message) => {
      this.lastMessage = message;
      await transport.send({
        jsonrpc: (message.jsonrpc as string) ?? "2.0",
        id: message.id,
        result: { echoed: message.params },
      });
    };
  }
}

describe("Query", () => {
  it("skips initialization control flow in non-streaming mode", async () => {
    const transport = new TestTransport();
    const query = new Query({ transport, isStreamingMode: false });

    await query.start();
    const result = await query.initialize();

    expect(result).toBeNull();
    expect(transport.written).toHaveLength(0);

    await query.close();
  });

  it("passes blocked path to canUseTool context and responds", async () => {
    const transport = new TestTransport();
    transport.setNextControlResponse({});

    const contexts: unknown[] = [];
    const query = new Query({
      transport,
      isStreamingMode: true,
      canUseTool: async (_tool, _input, context) => {
        contexts.push(context);
        return { behavior: "allow" } as const;
      },
    });

    await query.start();

    const initPromise = query.initialize();
    await transport.waitForWrites(1);
    await initPromise;

    transport.pushMessage({
      type: "control_request",
      request_id: "req_tool",
      request: {
        subtype: "can_use_tool",
        tool_name: "Bash",
        input: { value: 1 },
        permission_suggestions: [],
        blocked_path: "/tmp/test",
      },
    });

    await transport.waitForWrites(2);
    const responsePayload = JSON.parse(
      transport.written[transport.written.length - 1]
    ) as Record<string, unknown>;

    const response = (responsePayload.response as Record<string, unknown>).response as Record<string, unknown>;

    expect((contexts[0] as { blockedPath: string | null }).blockedPath).toBe(
      "/tmp/test"
    );
    expect(response?.behavior).toBe("allow");

    await query.close();
  });

  it("converts hook callback output field names for CLI", async () => {
    const transport = new TestTransport();
    transport.setNextControlResponse({});

    const hookOutput = {
      async_: true,
      continue_: false,
      extra: "value",
    };

    const hooks = {
      PreToolUse: [
        {
          matcher: null,
          hooks: [async () => hookOutput],
        },
      ],
    };

    const query = new Query({
      transport,
      isStreamingMode: true,
      hooks,
    });

    await query.start();
    const initPromise = query.initialize();
    await transport.waitForWrites(1);
    const initPayload = JSON.parse(transport.written[0]) as {
      request: Record<string, unknown>;
    };

    const matcherConfig = initPayload.request.hooks as Record<string, Array<{ hookCallbackIds: string[] }>>;
    const callbackId = matcherConfig.PreToolUse[0].hookCallbackIds[0];
    await initPromise;

    transport.pushMessage({
      type: "control_request",
      request_id: "req_hook",
      request: {
        subtype: "hook_callback",
        callback_id: callbackId,
        input: {},
        tool_use_id: null,
      },
    });

    await transport.waitForWrites(2);
    const responsePayload = JSON.parse(transport.written[1]) as {
      response: { response: Record<string, unknown> };
    };

    expect(responsePayload.response.response).toMatchObject({
      async: true,
      continue: false,
      extra: "value",
    });

    await query.close();
  });

  it("routes SDK MCP messages to in-process servers", async () => {
    const transport = new TestTransport();
    transport.setNextControlResponse({});
    const fakeServer = new FakeMcpServer();

    const query = new Query({
      transport,
      isStreamingMode: true,
      sdkMcpServers: { demo: fakeServer },
    });

    await query.start();
    const initPromise = query.initialize();
    await transport.waitForWrites(1);
    await initPromise;

    transport.pushMessage({
      type: "control_request",
      request_id: "req_mcp",
      request: {
        subtype: "mcp_message",
        server_name: "demo",
        message: {
          jsonrpc: "2.0",
          id: 1,
          method: "echo",
          params: { value: 42 },
        },
      },
    });

    await transport.waitForWrites(2);
    const responsePayload = JSON.parse(transport.written[1]) as {
      response: { response: { mcp_response: Record<string, unknown> } };
    };

    expect(fakeServer.connectCalls).toBe(1);
    expect(fakeServer.lastMessage).toMatchObject({
      method: "echo",
      params: { value: 42 },
    });
    expect(responsePayload.response.response.mcp_response).toMatchObject({
      result: { echoed: { value: 42 } },
    });

    await query.close();
  });
});
