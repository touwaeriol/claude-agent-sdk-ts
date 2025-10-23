# Claude Agent SDK for TypeScript

A TypeScript SDK for building custom Agent workflows with Claude Code CLI. This open-source project provides an easy-to-use interface for integrating Claude AI capabilities into your TypeScript applications.

**Choose your language:**
[English](./README.md) | [中文](./README.zh-CN.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

## Overview

Claude Agent SDK TS enables you to:

- **Bi-directional streaming communication** with Claude Code via the `ClaudeAgentSDKClient`, supporting continuous message exchange
- **Subprocess-based CLI transport** (`SubprocessCLITransport`) for hosting Claude Code CLI with full parameter, working directory, and environment variable support
- **Dynamic runtime configuration** with `setPermissionMode` and `setModel` for adjusting permissions and model versions mid-session
- **Type-safe abstractions** with TypeScript types for permissions, Hook callbacks, MCP configuration, and more
- **Comprehensive test coverage** using Vitest to ensure critical control request logic is correct

## References

This project is based on the following official resources:

- [Agent SDK Overview Documentation](https://docs.claude.com/en/api/agent-sdk/overview)
- [Official Python SDK Repository](https://github.com/anthropics/claude-agent-sdk-python)
- [Python SDK PR #171 - Permission Modes & Model Switching](https://github.com/anthropics/claude-agent-sdk-python/pull/171)

## Installation

```bash
npm install claude-agent-sdk-ts
```

### Prerequisites

- Node.js 18 or higher
- Claude Code CLI installed: `npm install -g @anthropic-ai/claude-code`

## Quick Start

```typescript
import { ClaudeAgentSDKClient } from "claude-agent-sdk-ts";

const client = new ClaudeAgentSDKClient();
await client.connect();

// Set permissions and model
await client.setPermissionMode("acceptEdits");
await client.setModel("claude-sonnet-4.1");

// Send a query
await client.query("Please review this TypeScript function implementation");

// Receive streaming responses
for await (const message of client.receiveMessages()) {
  console.log(message);
}
```

## Core Features

### ClaudeAgentSDKClient

The main client class for interacting with Claude Code:

```typescript
// Create client with custom configuration
const client = new ClaudeAgentSDKClient({
  cliPath: "claude-code",
  workingDirectory: "/path/to/project",
  env: { /* custom environment variables */ }
});

// Connect to Claude Code
await client.connect();

// Send user message and get streaming response
await client.query("Your message here");

// Iterate through streaming messages
for await (const msg of client.receiveMessages()) {
  // Handle each message
}

// Dynamic configuration
await client.setPermissionMode("blockAll"); // or "acceptAll", "acceptEdits"
await client.setModel("claude-opus-4");
```

### SubprocessCLITransport

Handles subprocess communication with Claude Code CLI:

- Manages CLI process lifecycle
- Handles standard I/O streams
- Supports environment variable injection
- Provides error handling and timeout management

### Control Protocol

Implements the control protocol for:

- Control request/response handling
- Hook callbacks for tool permissions and user interaction
- MCP (Model Context Protocol) configuration
- Runtime state management

## Project Structure

```
claude-agent-sdk-ts/
├── src/
│   ├── client.ts          # Main SDK client
│   ├── transport.ts       # CLI subprocess transport layer
│   ├── query.ts           # Control protocol implementation
│   ├── types.ts           # TypeScript type definitions
│   ├── errors.ts          # Custom error classes
│   ├── index.ts           # Package exports
│   ├── version.ts         # Version information
│   └── utils/
│       └── asyncQueue.ts  # Async queue utilities
├── tests/
│   └── ...                # Vitest unit tests
├── package.json
├── tsconfig.json
└── README.md
```

## API Reference

### Types

Key TypeScript types provided by the SDK:

```typescript
// Permission modes
type PermissionMode = "blockAll" | "acceptEdits" | "acceptAll";

// Message types
interface ControlRequest {
  type: string;
  // ... additional fields
}

interface ControlResponse {
  type: string;
  // ... additional fields
}

// Hook definitions
interface HookCallback {
  type: "permission" | "interaction";
  // ... hook-specific data
}
```

### Methods

#### `ClaudeAgentSDKClient`

- `connect(): Promise<void>` - Establish connection to Claude Code
- `query(message: string): Promise<void>` - Send a user message
- `receiveMessages(): AsyncIterable<any>` - Get streaming message iterator
- `setPermissionMode(mode: PermissionMode): Promise<void>` - Update permissions
- `setModel(model: string): Promise<void>` - Switch AI model
- `disconnect(): Promise<void>` - Close connection

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Test

```bash
npm test
```

### Clean

```bash
npm run clean
```

## Environment Setup

For Claude Code CLI integration:

```bash
# Install Claude Code CLI globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude-code --version
```

## Configuration

### Custom CLI Transport Options

```typescript
const client = new ClaudeAgentSDKClient({
  cliPath: "claude-code",                    // Path to Claude Code CLI
  workingDirectory: process.cwd(),           // Working directory for CLI
  env: { ...process.env }                    // Environment variables
});
```

### Permission Modes

- `blockAll` - Block all tool execution (most restrictive)
- `acceptEdits` - Allow file edits and basic operations
- `acceptAll` - Allow all operations (most permissive)

### Supported Models

- `claude-opus-4` - Most capable model
- `claude-sonnet-4.1` - Fast and efficient
- `claude-haiku-4.5-20251001` - Lightweight

## Examples

### Example 1: Code Review

```typescript
const client = new ClaudeAgentSDKClient();
await client.connect();
await client.setPermissionMode("acceptEdits");

await client.query("Review my TypeScript code and suggest improvements");

for await (const msg of client.receiveMessages()) {
  console.log(msg);
}
```

### Example 2: File Analysis

```typescript
const client = new ClaudeAgentSDKClient({
  workingDirectory: "/path/to/project"
});

await client.connect();
await client.setModel("claude-opus-4");

await client.query("Analyze the test coverage of this project");

for await (const msg of client.receiveMessages()) {
  console.log(msg);
}
```

### Example 3: Dynamic Configuration

```typescript
const client = new ClaudeAgentSDKClient();
await client.connect();

// Start restrictive
await client.setPermissionMode("blockAll");
await client.query("List files (read-only)");

// Then allow edits
await client.setPermissionMode("acceptEdits");
await client.query("Create a new test file");
```

## Error Handling

```typescript
try {
  const client = new ClaudeAgentSDKClient();
  await client.connect();
  await client.query("Your message");

  for await (const msg of client.receiveMessages()) {
    // Process message
  }
} catch (error) {
  if (error instanceof ClaudeAgentSDKError) {
    console.error("SDK Error:", error.message);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. When contributing:

1. Follow the existing code style
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all tests pass: `npm test`
5. Lint your code: `npm run lint`

### Development Workflow

```bash
# Clone the repository
git clone https://github.com/anthropics/claude-agent-sdk-ts.git
cd claude-agent-sdk-ts

# Install dependencies
npm install

# Make your changes
# ...

# Run tests
npm test

# Build
npm run build

# Submit a pull request
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

We encourage community contributions and extensions of advanced features (such as deep Hook/MCP support, message parsers, etc.) while complying with the official terms of use.

## Support

For issues, questions, or suggestions:

- Open an [Issue](https://github.com/anthropics/claude-agent-sdk-ts/issues)
- Check [existing discussions](https://github.com/anthropics/claude-agent-sdk-ts/discussions)
- Read the [Claude documentation](https://docs.claude.com/)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and updates.

## Related Projects

- [Claude Agent SDK (Python)](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude Code CLI](https://docs.claude.com/claude-code/claude_code_docs_map.md)
- [Anthropic Documentation](https://docs.claude.com/)

---

Made with ❤️ for the open-source community by Anthropic
