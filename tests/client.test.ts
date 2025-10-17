import { describe, expect, it } from "vitest";

import { ClaudeAgentSDKClient } from "../src/client";
import type { SDKMessage, Transport } from "../src/types";
import { AsyncQueue } from "../src/utils/asyncQueue";

class MockTransport implements Transport {
  readonly written: string[] = [];
  readonly controlRequests: Array<Record<string, unknown>> = [];
  private readonly queue = new AsyncQueue<SDKMessage>();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async write(payload: string): Promise<void> {
    if (!this.connected) {
      throw new Error("Transport not connected");
    }

    this.written.push(payload);

    const data = JSON.parse(payload) as Record<string, unknown>;
    if (data.type === "control_request") {
      this.controlRequests.push(data);
      const response = {
        type: "control_response",
        response: {
          subtype: "success",
          request_id: data.request_id,
          response: { acknowledgement: data.request },
        },
      };
      this.queue.push(response);
    }
  }

  async endInput(): Promise<void> {
    // no-op for tests
  }

  async *readMessages(): AsyncIterable<SDKMessage> {
    for await (const value of this.queue) {
      yield value;
    }
  }

  async close(): Promise<void> {
    this.connected = false;
    this.queue.close();
  }

  isReady(): boolean {
    return this.connected;
  }

  pushMessage(message: SDKMessage): void {
    this.queue.push(message);
  }
}

describe("ClaudeAgentSDKClient", () => {
  it("sends control requests for permission mode and model changes", async () => {
    const transport = new MockTransport();
    const client = new ClaudeAgentSDKClient({}, transport);

    await client.connect();

    await client.setPermissionMode("acceptEdits");
    await client.setModel("claude-sonnet-4.1");

    const subtypes = transport.controlRequests.map(
      (request) =>
        ((request.request as Record<string, unknown>)?.subtype as string) ?? ""
    );

    expect(subtypes).toContain("initialize");
    expect(subtypes).toContain("set_permission_mode");
    expect(subtypes).toContain("set_model");
  });

  it("sends user prompt messages with session id", async () => {
    const transport = new MockTransport();
    const client = new ClaudeAgentSDKClient({}, transport);

    await client.connect();
    await client.query("hello world", "demo");

    const promptPayload = transport.written.find((payload) => {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      return parsed.type === "user";
    });

    expect(promptPayload).toBeDefined();
    const promptMessage = JSON.parse(promptPayload ?? "{}") as Record<
      string,
      unknown
    >;
    expect(promptMessage.session_id).toBe("demo");
    expect(
      (promptMessage.message as { content?: string } | undefined)?.content
    ).toBe("hello world");
  });

  it("yields streamed messages from transport", async () => {
    const transport = new MockTransport();
    const client = new ClaudeAgentSDKClient({}, transport);

    await client.connect();

    transport.pushMessage({
      type: "assistant_message",
      content: "Hello from Claude",
    });

    const iterator = client.receiveMessages()[Symbol.asyncIterator]();
    const { value } = await iterator.next();
    expect(value).toEqual({
      type: "assistant_message",
      content: "Hello from Claude",
    });
  });
});
