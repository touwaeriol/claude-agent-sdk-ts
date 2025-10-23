# Claude Agent SDK for TypeScript - 中文版

用于通过 Claude Code CLI 构建自定义 Agent 工作流的 TypeScript SDK。这是一个开源项目，为您的 TypeScript 应用程序集成 Claude AI 能力提供了一个易于使用的接口。

**选择语言：**
[English](./README.md) | [中文](./README.zh-CN.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

## 项目概览

Claude Agent SDK TS 的主要功能包括：

- **双向流式通信**：通过 `ClaudeAgentSDKClient` 与 Claude Code 进行双向流式对话，支持持续消息交换
- **子进程 CLI 传输**：使用 `SubprocessCLITransport` 托管 Claude Code CLI，支持完整的参数、工作目录和环境变量配置
- **动态运行时配置**：通过 `setPermissionMode` 和 `setModel` 在会话过程中动态调整权限和模型版本
- **类型安全抽象**：提供权限、Hook 回调、MCP 配置等的 TypeScript 类型定义
- **完整测试覆盖**：使用 Vitest 编写单元测试，确保关键控制请求的发送逻辑正确

## 参考资料

本项目基于以下官方资源开发：

- [Agent SDK 概览文档](https://docs.claude.com/en/api/agent-sdk/overview)
- [官方 Python SDK 仓库](https://github.com/anthropics/claude-agent-sdk-python)
- [Python SDK PR #171 - 权限模式与模型切换](https://github.com/anthropics/claude-agent-sdk-python/pull/171)

## 安装

```bash
npm install claude-agent-sdk-ts
```

### 前提条件

- Node.js 18 或更高版本
- Claude Code CLI 已安装：`npm install -g @anthropic-ai/claude-code`

## 快速开始

```typescript
import { ClaudeAgentSDKClient } from "claude-agent-sdk-ts";

const client = new ClaudeAgentSDKClient();
await client.connect();

// 设置权限和模型
await client.setPermissionMode("acceptEdits");
await client.setModel("claude-sonnet-4.1");

// 发送查询
await client.query("请审阅这个 TypeScript 函数的实现");

// 接收流式响应
for await (const message of client.receiveMessages()) {
  console.log(message);
}
```

## 核心功能

### ClaudeAgentSDKClient

与 Claude Code 交互的主要客户端类：

```typescript
// 使用自定义配置创建客户端
const client = new ClaudeAgentSDKClient({
  cliPath: "claude-code",
  workingDirectory: "/path/to/project",
  env: { /* 自定义环境变量 */ }
});

// 连接到 Claude Code
await client.connect();

// 发送用户消息并获取流式响应
await client.query("你的消息");

// 遍历流式消息
for await (const msg of client.receiveMessages()) {
  // 处理每条消息
}

// 动态配置
await client.setPermissionMode("blockAll"); // 或 "acceptAll"、"acceptEdits"
await client.setModel("claude-opus-4");
```

### SubprocessCLITransport

处理与 Claude Code CLI 的子进程通信：

- 管理 CLI 进程生命周期
- 处理标准 I/O 流
- 支持环境变量注入
- 提供错误处理和超时管理

### 控制协议

实现以下控制协议功能：

- 控制请求/响应处理
- 工具权限和用户交互的 Hook 回调
- MCP（Model Context Protocol）配置
- 运行时状态管理

## 项目结构

```
claude-agent-sdk-ts/
├── src/
│   ├── client.ts          # 主 SDK 客户端
│   ├── transport.ts       # CLI 子进程传输层
│   ├── query.ts           # 控制协议实现
│   ├── types.ts           # TypeScript 类型定义
│   ├── errors.ts          # 自定义错误类
│   ├── index.ts           # 包导出
│   ├── version.ts         # 版本信息
│   └── utils/
│       └── asyncQueue.ts  # 异步队列工具
├── tests/
│   └── ...                # Vitest 单元测试
├── package.json
├── tsconfig.json
└── README.md
```

## API 参考

### 类型定义

SDK 提供的关键 TypeScript 类型：

```typescript
// 权限模式
type PermissionMode = "blockAll" | "acceptEdits" | "acceptAll";

// 消息类型
interface ControlRequest {
  type: string;
  // ... 其他字段
}

interface ControlResponse {
  type: string;
  // ... 其他字段
}

// Hook 定义
interface HookCallback {
  type: "permission" | "interaction";
  // ... 特定于 Hook 的数据
}
```

### 方法

#### `ClaudeAgentSDKClient`

- `connect(): Promise<void>` - 建立与 Claude Code 的连接
- `query(message: string): Promise<void>` - 发送用户消息
- `receiveMessages(): AsyncIterable<any>` - 获取流式消息迭代器
- `setPermissionMode(mode: PermissionMode): Promise<void>` - 更新权限
- `setModel(model: string): Promise<void>` - 切换 AI 模型
- `disconnect(): Promise<void>` - 关闭连接

## 开发指南

### 构建

```bash
npm run build
```

### 代码检查

```bash
npm run lint
```

### 运行测试

```bash
npm test
```

### 清理构建产物

```bash
npm run clean
```

## 环境设置

为了集成 Claude Code CLI：

```bash
# 全局安装 Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 验证安装
claude-code --version
```

## 配置

### 自定义 CLI 传输选项

```typescript
const client = new ClaudeAgentSDKClient({
  cliPath: "claude-code",                    // Claude Code CLI 的路径
  workingDirectory: process.cwd(),           // CLI 的工作目录
  env: { ...process.env }                    // 环境变量
});
```

### 权限模式

- `blockAll` - 阻止所有工具执行（最严格）
- `acceptEdits` - 允许文件编辑和基本操作
- `acceptAll` - 允许所有操作（最宽松）

### 支持的模型

- `claude-opus-4` - 功能最强大的模型
- `claude-sonnet-4.1` - 快速高效
- `claude-haiku-4.5-20251001` - 轻量级

## 使用示例

### 示例 1：代码审阅

```typescript
const client = new ClaudeAgentSDKClient();
await client.connect();
await client.setPermissionMode("acceptEdits");

await client.query("审阅我的 TypeScript 代码并提出改进建议");

for await (const msg of client.receiveMessages()) {
  console.log(msg);
}
```

### 示例 2：文件分析

```typescript
const client = new ClaudeAgentSDKClient({
  workingDirectory: "/path/to/project"
});

await client.connect();
await client.setModel("claude-opus-4");

await client.query("分析这个项目的测试覆盖率");

for await (const msg of client.receiveMessages()) {
  console.log(msg);
}
```

### 示例 3：动态配置

```typescript
const client = new ClaudeAgentSDKClient();
await client.connect();

// 开始使用严格权限
await client.setPermissionMode("blockAll");
await client.query("列出文件（只读）");

// 然后允许编辑
await client.setPermissionMode("acceptEdits");
await client.query("创建新的测试文件");
```

## 错误处理

```typescript
try {
  const client = new ClaudeAgentSDKClient();
  await client.connect();
  await client.query("你的消息");

  for await (const msg of client.receiveMessages()) {
    // 处理消息
  }
} catch (error) {
  if (error instanceof ClaudeAgentSDKError) {
    console.error("SDK 错误：", error.message);
  } else {
    console.error("未预期的错误：", error);
  }
}
```

## 贡献

欢迎贡献！请随时提交 Pull Request。贡献时请注意：

1. 遵循现有的代码风格
2. 为新功能添加测试
3. 根据需要更新文档
4. 确保所有测试通过：`npm test`
5. 检查代码风格：`npm run lint`

### 开发工作流

```bash
# 克隆仓库
git clone https://github.com/anthropics/claude-agent-sdk-ts.git
cd claude-agent-sdk-ts

# 安装依赖
npm install

# 做你的修改
# ...

# 运行测试
npm test

# 构建
npm run build

# 提交 Pull Request
```

## 许可协议

本项目以 MIT License 发布。详见 LICENSE 文件。

我们鼓励社区贡献，在遵守官方使用条款的前提下，欢迎扩展更多高级特性（如深度 Hook/MCP 支持、消息解析器等）。

## 技术支持

如有问题、疑问或建议：

- 提交 [Issue](https://github.com/anthropics/claude-agent-sdk-ts/issues)
- 查看 [现有讨论](https://github.com/anthropics/claude-agent-sdk-ts/discussions)
- 阅读 [Claude 文档](https://docs.claude.com/)

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md) 了解版本历史和更新内容。

## 相关项目

- [Claude Agent SDK (Python)](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude Code CLI](https://docs.claude.com/claude-code/claude_code_docs_map.md)
- [Anthropic 文档](https://docs.claude.com/)

---

由 Anthropic 为开源社区贡献 ❤️
