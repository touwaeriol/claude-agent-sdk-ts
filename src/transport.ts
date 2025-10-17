import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { once } from "node:events";

import {
  CLIConnectionError,
  CLINotFoundError,
  ProcessError,
  SDKJSONDecodeError,
} from "./errors";
import type {
  ClaudeAgentOptions,
  McpServerConfig,
  McpSdkServerConfig,
  PromptSource,
  SDKMessage,
  Transport,
} from "./types";
import { SDK_VERSION } from "./version";

const DEFAULT_MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

function fileExists(path: string): boolean {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function findClaudeCLI(): string {
  const envPath = process.env.PATH ?? "";
  const paths = envPath.split(delimiter).filter(Boolean);

  for (const base of paths) {
    const candidate = resolve(base, "claude");
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  const fallbackLocations = [
    join(process.env.HOME ?? "", ".npm-global/bin/claude"),
    "/usr/local/bin/claude",
    join(process.env.HOME ?? "", ".local/bin/claude"),
    join(process.env.HOME ?? "", "node_modules/.bin/claude"),
    join(process.env.HOME ?? "", ".yarn/bin/claude"),
  ];

  for (const candidate of fallbackLocations) {
    if (candidate && fileExists(candidate)) {
      return candidate;
    }
  }

  throw new CLINotFoundError(
    "Claude Code CLI 未找到。请先执行 `npm install -g @anthropic-ai/claude-code` 并确认可执行文件在 PATH 中。"
  );
}

function isSdkServerConfig(config: McpServerConfig): config is McpSdkServerConfig {
  return (
    typeof config === "object" &&
    config !== null &&
    (config as { type?: string }).type === "sdk"
  );
}

function buildMcpConfigArgument(
  mcpServers: ClaudeAgentOptions["mcpServers"]
): string | undefined {
  if (!mcpServers) {
    return undefined;
  }

  if (typeof mcpServers === "string") {
    return mcpServers;
  }

  const serversForCli: Record<string, unknown> = {};

  for (const [name, config] of Object.entries(mcpServers)) {
    if (!config || typeof config !== "object") {
      serversForCli[name] = config;
      continue;
    }

    if (isSdkServerConfig(config)) {
      const { instance: _instance, ...rest } = config;
      serversForCli[name] = rest;
      continue;
    }

    serversForCli[name] = config;
  }

  if (Object.keys(serversForCli).length === 0) {
    return undefined;
  }

  return JSON.stringify({ mcpServers: serversForCli });
}

export class SubprocessCLITransport implements Transport {
  private readonly prompt: PromptSource;
  private readonly options: ClaudeAgentOptions;
  private readonly isStreaming: boolean;
  private readonly cliPath: string;
  private readonly cwd: string | undefined;
  private readonly maxBufferSize: number;
  private child: ChildProcess | undefined;
  private ready = false;
  private stderrBuffer = "";
  private exitCode: number | null | undefined;
  private exitSignal: NodeJS.Signals | null | undefined;
  private exitError: Error | null = null;

  constructor(prompt: PromptSource, options: ClaudeAgentOptions = {}) {
    this.prompt = prompt;
    this.options = options;
    this.isStreaming = typeof prompt !== "string";
    this.cliPath = options.cliPath ?? findClaudeCLI();
    this.cwd = options.cwd ?? undefined;
    this.maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
  }

  async connect(): Promise<void> {
    if (this.child) {
      return;
    }

    if (this.options.cliPath && !fileExists(this.options.cliPath)) {
      throw new CLINotFoundError(
        `Claude Code CLI 路径不存在：${this.options.cliPath}`
      );
    }

    const args = this.buildCommandArguments();

    const shouldPipeStderr =
      typeof this.options.stderr === "function" ||
      Boolean(this.options.extraArgs && "debug-to-stderr" in this.options.extraArgs);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(this.options.env ?? {}),
      CLAUDE_CODE_ENTRYPOINT: "sdk-ts",
      CLAUDE_AGENT_SDK_VERSION: SDK_VERSION,
    };

    if (this.cwd) {
      env.PWD = this.cwd;
    }

    try {
      const spawnOptions: SpawnOptions = {
        cwd: this.cwd,
        env,
        stdio: ["pipe", "pipe", shouldPipeStderr ? "pipe" : "inherit"],
      };
      this.child = spawn(this.cliPath, args, spawnOptions);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new CLINotFoundError(
          `Claude Code CLI 未找到，尝试位置：${this.cliPath}`
        );
      }

      throw new CLIConnectionError(
        `Claude Code CLI 启动失败：${(error as Error)?.message ?? String(error)}`
      );
    }

    const stdin = this.child.stdin;
    const stdout = this.child.stdout;
    const stderr = this.child.stderr;

    if (!stdout) {
      throw new CLIConnectionError("Claude Code CLI stdout 不可用。");
    }

    stdout.setEncoding("utf8");

    if (!this.isStreaming && stdin) {
      stdin.end();
    }

    if (stderr && shouldPipeStderr) {
      stderr.setEncoding("utf8");
      stderr.on("data", (chunk: string | Buffer) => {
        const text = chunk.toString();
        this.stderrBuffer += text;
        if (this.options.stderr) {
          for (const line of text.split(/\r?\n/)) {
            if (line.trim().length > 0) {
              this.options.stderr(line);
            }
          }
        }
      });
    }

    this.child.on("exit", (code, signal) => {
      this.exitCode = code;
      this.exitSignal = signal;
      if (code !== 0) {
        this.exitError = new ProcessError(
          `Claude Code CLI 退出码非零：${code}`,
          code,
          this.stderrBuffer
        );
      }
    });

    this.child.on("error", (error) => {
      this.exitError = new CLIConnectionError(
        `Claude Code CLI 进程错误：${(error as Error).message}`,
        { cause: error instanceof Error ? error : undefined }
      );
    });

    this.ready = true;
  }

  async write(payload: string): Promise<void> {
    if (!this.child || !this.child.stdin || !this.isStreaming) {
      throw new CLIConnectionError("CLI 进程尚未准备好接受输入或未处于流式模式。");
    }

    const stdin = this.child.stdin;
    await new Promise<void>((resolve, reject) => {
      stdin.write(payload, (error: Error | null | undefined) => {
        if (error) {
          this.ready = false;
          reject(
            new CLIConnectionError(
              `写入 Claude Code CLI 失败：${error.message}`,
              { cause: error }
            )
          );
          return;
        }
        resolve();
      });
    });
  }

  async endInput(): Promise<void> {
    if (!this.child?.stdin) {
      return;
    }

    const stdin = this.child.stdin;
    await new Promise<void>((resolve) => {
      stdin.end(() => resolve());
    });
  }

  async *readMessages(): AsyncIterable<SDKMessage> {
    if (!this.child?.stdout) {
      throw new CLIConnectionError("CLI 进程未启动或 stdout 不可用。");
    }

    const stdout = this.child.stdout;
    let buffer = "";
    let jsonBuffer = "";

    try {
      for await (const chunk of stdout) {
        buffer += chunk;

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          const trimmed = line.trim();
          if (trimmed.length === 0) {
            newlineIndex = buffer.indexOf("\n");
            continue;
          }

          jsonBuffer += trimmed;
          if (jsonBuffer.length > this.maxBufferSize) {
            const size = jsonBuffer.length;
            jsonBuffer = "";
            throw new SDKJSONDecodeError(
              `Claude CLI 输出超出缓冲区上限 ${this.maxBufferSize} 字节，实际 ${size} 字节。`
            );
          }

          try {
            const parsed = JSON.parse(jsonBuffer) as SDKMessage;
            jsonBuffer = "";
            yield parsed;
          } catch (error) {
            if (error instanceof SyntaxError) {
              // JSON 未完整，继续积累
              newlineIndex = buffer.indexOf("\n");
              continue;
            }
            throw error;
          }

          newlineIndex = buffer.indexOf("\n");
        }
      }

      if (jsonBuffer.trim().length > 0) {
        try {
          const parsed = JSON.parse(jsonBuffer) as SDKMessage;
          yield parsed;
        } catch (error) {
          throw new SDKJSONDecodeError(
            "Claude CLI 输出无法解析为 JSON。",
            error instanceof Error ? error : undefined
          );
        } finally {
          jsonBuffer = "";
        }
      }
    } catch (error) {
      if (error instanceof SDKJSONDecodeError) {
        throw error;
      }
      throw new CLIConnectionError(
        `读取 Claude Code CLI 输出失败：${(error as Error).message}`,
        { cause: error instanceof Error ? error : undefined }
      );
    } finally {
      await this.waitForExit();
    }

    if (this.exitError) {
      throw this.exitError;
    }
  }

  async close(): Promise<void> {
    this.ready = false;

    if (!this.child) {
      return;
    }

    if (this.child.stdin && !this.child.stdin.destroyed) {
      this.child.stdin.destroy();
    }

    if (this.child.stdout && !this.child.stdout.destroyed) {
      this.child.stdout.destroy();
    }

    if (this.child.stderr && !this.child.stderr.destroyed) {
      this.child.stderr.destroy();
    }

    if (!this.child.killed) {
      this.child.kill("SIGTERM");
      try {
        await once(this.child, "exit");
      } catch {
        // ignore
      }
    }

    this.child.removeAllListeners();
    this.child = undefined;
  }

  isReady(): boolean {
    return this.ready;
  }

  private buildCommandArguments(): string[] {
    const args = ["--output-format", "stream-json", "--verbose"];

    if (typeof this.options.systemPrompt === "string") {
      args.push("--system-prompt", this.options.systemPrompt);
    } else if (
      this.options.systemPrompt &&
      this.options.systemPrompt.type === "preset"
    ) {
      const preset = this.options.systemPrompt;
      if (preset.append) {
      args.push("--append-system-prompt", preset.append);
      }
    }

    if (this.options.allowedTools && this.options.allowedTools.length > 0) {
      args.push("--allowedTools", this.options.allowedTools.join(","));
    }
    if (this.options.disallowedTools && this.options.disallowedTools.length > 0) {
      args.push("--disallowedTools", this.options.disallowedTools.join(","));
    }
    if (this.options.maxTurns) {
      args.push("--max-turns", String(this.options.maxTurns));
    }
    if (this.options.model) {
      args.push("--model", this.options.model);
    }
    if (this.options.permissionPromptToolName) {
      args.push("--permission-prompt-tool", this.options.permissionPromptToolName);
    }
    if (this.options.permissionMode) {
      args.push("--permission-mode", this.options.permissionMode);
    }
    if (this.options.continueConversation) {
      args.push("--continue");
    }
    if (this.options.resume) {
      args.push("--resume", this.options.resume);
    }
    if (this.options.settings) {
      args.push("--settings", this.options.settings);
    }
    if (this.options.addDirs && this.options.addDirs.length > 0) {
      for (const directory of this.options.addDirs) {
        if (directory !== undefined && directory !== null) {
          args.push("--add-dir", String(directory));
        }
      }
    }
    if (this.options.includePartialMessages) {
      args.push("--include-partial-messages");
    }
    if (this.options.forkSession) {
      args.push("--fork-session");
    }
    if (this.options.agents && Object.keys(this.options.agents).length > 0) {
      args.push("--agents", JSON.stringify(this.options.agents));
    }
    if (this.options.settingSources && this.options.settingSources.length > 0) {
      args.push("--setting-sources", this.options.settingSources.join(","));
    }

    const mcpConfig = buildMcpConfigArgument(this.options.mcpServers);
    if (mcpConfig) {
      args.push("--mcp-config", mcpConfig);
    }

    if (this.options.extraArgs) {
      for (const [flag, value] of Object.entries(this.options.extraArgs)) {
        if (value === null) {
          args.push(`--${flag}`);
        } else {
          args.push(`--${flag}`, value);
        }
      }
    }

    if (this.isStreaming) {
      args.push("--input-format", "stream-json");
    } else {
      args.push("--print", "--", String(this.prompt));
    }

    return args;
  }

  private async waitForExit(): Promise<void> {
    if (!this.child) {
      return;
    }

    if (this.exitCode !== undefined || this.exitSignal !== undefined) {
      return;
    }

    try {
      await once(this.child, "exit");
    } catch {
      // ignore
    }
  }
}
