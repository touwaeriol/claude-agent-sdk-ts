# Claude Agent SDK TS

本项目旨在提供一个面向开源社区的 TypeScript 版本 Claude Agent SDK，用于通过 Claude Code CLI 构建自定义 Agent 工作流。**所有 AI 协作者在接入本仓库时，必须首先读取本文件，了解项目背景、参考资料与使用约束。**我们通过软链接 `AGENTS.md → CLAUDE.md` 让其他 AI 工具可以在标准入口加载同一份提示上下文。实现过程中重点参考了以下资料：

- 官方文档《Agent SDK overview》：<https://docs.claude.com/en/api/agent-sdk/overview>
- 官方 Python 版 SDK 仓库：<https://github.com/anthropics/claude-agent-sdk-python>
- PR #171 对 Python 版新增的权限模式与模型切换能力：<https://github.com/anthropics/claude-agent-sdk-python/pull/171>

## 功能概览

- 通过 `ClaudeAgentSDKClient` 发起与 Claude Code 的双向流式对话，支持持续发送用户消息并接收流式返回。
- 内置 `SubprocessCLITransport`，以子进程方式托管 Claude Code CLI，兼容 CLI 参数、工作目录、环境变量等配置。
- 支持运行时调用 `setPermissionMode`、`setModel`，在会话过程中动态调整权限策略与模型版本。
- 提供基础类型定义（权限更新、Hook 回调、MCP 配置等），方便上层应用进行强类型开发。
- 利用 Vitest 编写单元测试，确保关键控制请求的发送逻辑正确。

## 使用说明（AI 协作者必读）

- 任何自动化或 AI 接口都应通过 `AGENTS.md`（指向本文件）加载提示上下文，避免遗漏项目约束或重复编写说明。
- 如需更新项目原则或协作指南，请直接修改 `CLAUDE.md`，软链接会自动生效。
- 保持本文档与官方资料同步更新，确保后续开发者理解项目来源与实现差异。

## 使用方式（简述）

```ts
import { ClaudeAgentSDKClient } from "claude-agent-sdk-ts";

const client = new ClaudeAgentSDKClient();
await client.connect();

await client.setPermissionMode("acceptEdits");
await client.setModel("claude-sonnet-4.1");

await client.query("帮我审阅一下这个 TypeScript 函数的实现");

for await (const message of client.receiveMessages()) {
  console.log(message);
}
```

> 注意：实际运行需确保本地已经安装并配置好 Claude Code CLI（`npm install -g @anthropic-ai/claude-code`），并根据业务需要设置权限模式、模型及工具白名单等参数。

## 目录结构

- `src/`：核心 TypeScript 实现。
  - `client.ts`：高层 SDK 客户端，封装连接、消息发送、权限/模型切换等能力。
  - `transport.ts`：CLI 子进程传输层，负责命令行参数拼装、标准流读写、错误处理。
  - `query.ts`：控制协议实现，处理控制请求响应、Hook 回调、工具权限等。
  - `types.ts` / `errors.ts` / `utils/`：类型定义、错误类与辅助工具。
- `tests/`：Vitest 单元测试。

## 许可协议

本项目以 MIT License 发布，鼓励社区贡献并在遵守官方使用条款的前提下扩展更多高级特性（如 Hook/MCP 深度支持、消息解析器等）。欢迎提交 Issue 或 PR 共同完善 TypeScript 生态。
