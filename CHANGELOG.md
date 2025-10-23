# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- Deep Hook/MCP support enhancements
- Message parser utilities
- Advanced error recovery mechanisms
- Performance optimizations
- Extended CLI configuration options

## [1.0.0] - 2025-10-23

### Added
- **Multi-language Documentation Support**
  - English README (README.md)
  - Simplified Chinese README (README.zh-CN.md)
  - Japanese README (README.ja.md)
  - Korean README (README.ko.md)
  - Language switcher links for easy navigation

- **Documentation Improvements**
  - Comprehensive API reference with TypeScript types
  - Complete development guide with build, test, and deployment instructions
  - Detailed configuration section covering permission modes and supported models
  - Three practical usage examples (code review, file analysis, dynamic configuration)
  - Error handling patterns and best practices
  - Contributing guidelines and development workflow

### Features (Carried over from v1.0.0-initial)
- Bi-directional streaming communication with Claude Code via `ClaudeAgentSDKClient`
- Subprocess-based CLI transport with `SubprocessCLITransport`
- Full support for CLI parameters, working directory, and environment variables
- Dynamic runtime configuration with `setPermissionMode` and `setModel`
- Type-safe abstractions with TypeScript type definitions
- Comprehensive unit test coverage using Vitest
- Support for permission modes: `blockAll`, `acceptEdits`, `acceptAll`
- Support for Claude models: `claude-opus-4`, `claude-sonnet-4.1`, `claude-haiku-4.5-20251001`

### Documentation
- [Agent SDK Overview Documentation](https://docs.claude.com/en/api/agent-sdk/overview)
- [Official Python SDK Repository](https://github.com/anthropics/claude-agent-sdk-python)
- [Python SDK PR #171 - Permission Modes & Model Switching](https://github.com/anthropics/claude-agent-sdk-python/pull/171)

### License
- Distributed under MIT License

---

## [1.0.0-initial] - 2025-10-17

### Added
- **Core SDK Implementation**
  - `ClaudeAgentSDKClient` - Main client class for Claude Code interaction
  - `SubprocessCLITransport` - Subprocess communication layer for Claude Code CLI
  - Control protocol implementation (`query.ts`)
  - Type definitions for permissions, hooks, and MCP configuration (`types.ts`)
  - Custom error handling (`errors.ts`)
  - Async queue utilities (`utils/asyncQueue.ts`)
  - Package version tracking (`version.ts`)

- **TypeScript Support**
  - Full TypeScript 5.9+ support
  - Type-safe API with comprehensive type definitions
  - Source maps and declaration files

- **Testing Infrastructure**
  - Vitest unit test framework integration
  - Test configuration and examples
  - Node.js 18+ compatibility

- **Build & Development Tools**
  - TypeScript compilation with `npm run build`
  - Code linting with `npm run lint`
  - Test execution with `npm test`
  - Clean build artifacts with `npm run clean`

- **Package Configuration**
  - npm package metadata
  - CommonJS module support
  - Proper export configuration

### Project Structure
```
claude-agent-sdk-ts/
├── src/
│   ├── client.ts
│   ├── transport.ts
│   ├── query.ts
│   ├── types.ts
│   ├── errors.ts
│   ├── index.ts
│   ├── version.ts
│   └── utils/
│       └── asyncQueue.ts
├── tests/
├── package.json
├── tsconfig.json
└── .gitignore
```

### Requirements
- Node.js 18 or higher
- Claude Code CLI pre-installed

### Initial Commit
- chore: initial commit (e2c41d5)

---

## Notes

### Version Naming Convention
- **v1.0.0-initial**: First release with core SDK functionality
- **v1.0.0**: First stable release with complete documentation
- **latest**: Points to the most recent stable release

### Breaking Changes
None in initial releases. This project follows semantic versioning, and any breaking changes will be clearly documented.

### Migration Guides
Not applicable for initial releases.

### Known Issues
None reported. Please open an issue on GitHub if you encounter any problems.

### Support
For issues, questions, or feature requests:
- [GitHub Issues](https://github.com/touwaeriol/claude-agent-sdk-ts/issues)
- [GitHub Discussions](https://github.com/touwaeriol/claude-agent-sdk-ts/discussions)
- [Claude Documentation](https://docs.claude.com/)

---

## References

This project is based on:
- [Agent SDK Overview](https://docs.claude.com/en/api/agent-sdk/overview)
- [Official Python SDK](https://github.com/anthropics/claude-agent-sdk-python)
- [Python SDK PR #171](https://github.com/anthropics/claude-agent-sdk-python/pull/171)

## License

MIT License - See LICENSE file for details
