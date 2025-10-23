# Claude Agent SDK for TypeScript - 日本語版

Claude Code CLIを使用してカスタムエージェントワークフローを構築するためのTypeScript SDK。このオープンソースプロジェクトは、TypeScriptアプリケーションにClaude AI機能を統合するための使いやすいインターフェースを提供します。

**言語を選択：**
[English](./README.md) | [中文](./README.zh-CN.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

## プロジェクト概要

Claude Agent SDK TS の主な機能：

- **双方向ストリーミング通信**：`ClaudeAgentSDKClient`を使用してClaude Codeとの双方向ストリーミング会話を実現し、継続的なメッセージ交換をサポート
- **サブプロセスCLI転送**：`SubprocessCLITransport`を使用してClaude Code CLIをホストし、完全なパラメータ、作業ディレクトリ、環境変数のサポート
- **動的ランタイム設定**：`setPermissionMode`と`setModel`を使用して、セッション中に権限とモデルバージョンを動的に調整可能
- **型安全な抽象化**：権限、Hookコールバック、MCP設定などのTypeScript型定義を提供
- **包括的なテストカバレッジ：Vitestを使用した単体テストにより、重要な制御リクエストロジックが正確であることを確認

## 参考資料

このプロジェクトは以下の公式リソースに基づいています：

- [Agent SDK概要ドキュメント](https://docs.claude.com/en/api/agent-sdk/overview)
- [公式Python SDKリポジトリ](https://github.com/anthropics/claude-agent-sdk-python)
- [Python SDK PR #171 - 権限モードとモデル切り替え](https://github.com/anthropics/claude-agent-sdk-python/pull/171)

## インストール

```bash
npm install claude-agent-sdk-ts
```

### 前提条件

- Node.js 18以上
- Claude Code CLIがインストール済み：`npm install -g @anthropic-ai/claude-code`

## クイックスタート

```typescript
import { ClaudeAgentSDKClient } from "claude-agent-sdk-ts";

const client = new ClaudeAgentSDKClient();
await client.connect();

// 権限とモデルを設定
await client.setPermissionMode("acceptEdits");
await client.setModel("claude-sonnet-4.1");

// クエリを送信
await client.query("このTypeScript関数の実装をレビューしてください");

// ストリーミング応答を受信
for await (const message of client.receiveMessages()) {
  console.log(message);
}
```

## コア機能

### ClaudeAgentSDKClient

Claude Codeと対話するためのメインクライアントクラス：

```typescript
// カスタム設定でクライアントを作成
const client = new ClaudeAgentSDKClient({
  cliPath: "claude-code",
  workingDirectory: "/path/to/project",
  env: { /* カスタム環境変数 */ }
});

// Claude Codeに接続
await client.connect();

// ユーザーメッセージを送信してストリーミング応答を取得
await client.query("あなたのメッセージ");

// ストリーミングメッセージを反復処理
for await (const msg of client.receiveMessages()) {
  // 各メッセージを処理
}

// 動的設定
await client.setPermissionMode("blockAll"); // または "acceptAll"、"acceptEdits"
await client.setModel("claude-opus-4");
```

### SubprocessCLITransport

Claude Code CLIとのサブプロセス通信を処理：

- CLIプロセスのライフサイクル管理
- 標準I/Oストリームの処理
- 環境変数の注入をサポート
- エラーハンドリングとタイムアウト管理を提供

### 制御プロトコル

以下の制御プロトコル機能を実装：

- 制御リクエスト/レスポンス処理
- ツール権限とユーザーインタラクションのHookコールバック
- MCP（Model Context Protocol）設定
- ランタイム状態管理

## プロジェクト構成

```
claude-agent-sdk-ts/
├── src/
│   ├── client.ts          # メインSDKクライアント
│   ├── transport.ts       # CLIサブプロセス転送層
│   ├── query.ts           # 制御プロトコル実装
│   ├── types.ts           # TypeScript型定義
│   ├── errors.ts          # カスタムエラークラス
│   ├── index.ts           # パッケージエクスポート
│   ├── version.ts         # バージョン情報
│   └── utils/
│       └── asyncQueue.ts  # 非同期キューユーティリティ
├── tests/
│   └── ...                # Vitest単体テスト
├── package.json
├── tsconfig.json
└── README.md
```

## APIリファレンス

### 型定義

SDKが提供する主要なTypeScript型：

```typescript
// 権限モード
type PermissionMode = "blockAll" | "acceptEdits" | "acceptAll";

// メッセージ型
interface ControlRequest {
  type: string;
  // ... その他のフィールド
}

interface ControlResponse {
  type: string;
  // ... その他のフィールド
}

// Hook定義
interface HookCallback {
  type: "permission" | "interaction";
  // ... Hook固有のデータ
}
```

### メソッド

#### `ClaudeAgentSDKClient`

- `connect(): Promise<void>` - Claude Codeへの接続を確立
- `query(message: string): Promise<void>` - ユーザーメッセージを送信
- `receiveMessages(): AsyncIterable<any>` - ストリーミングメッセージイテレータを取得
- `setPermissionMode(mode: PermissionMode): Promise<void>` - 権限を更新
- `setModel(model: string): Promise<void>` - AIモデルを切り替え
- `disconnect(): Promise<void>` - 接続を閉じる

## 開発ガイド

### ビルド

```bash
npm run build
```

### リント

```bash
npm run lint
```

### テスト実行

```bash
npm test
```

### クリーンアップ

```bash
npm run clean
```

## 環境設定

Claude Code CLIの統合：

```bash
# Claude Code CLIをグローバルにインストール
npm install -g @anthropic-ai/claude-code

# インストールを確認
claude-code --version
```

## 設定

### カスタムCLI転送オプション

```typescript
const client = new ClaudeAgentSDKClient({
  cliPath: "claude-code",                    // Claude Code CLIへのパス
  workingDirectory: process.cwd(),           // CLIの作業ディレクトリ
  env: { ...process.env }                    // 環境変数
});
```

### 権限モード

- `blockAll` - すべてのツール実行をブロック（最も制限的）
- `acceptEdits` - ファイル編集と基本操作を許可
- `acceptAll` - すべての操作を許可（最も許容的）

### サポートされているモデル

- `claude-opus-4` - 最も強力なモデル
- `claude-sonnet-4.1` - 高速で効率的
- `claude-haiku-4.5-20251001` - 軽量

## 使用例

### 例1：コードレビュー

```typescript
const client = new ClaudeAgentSDKClient();
await client.connect();
await client.setPermissionMode("acceptEdits");

await client.query("TypeScriptコードをレビューして改善提案をしてください");

for await (const msg of client.receiveMessages()) {
  console.log(msg);
}
```

### 例2：ファイル分析

```typescript
const client = new ClaudeAgentSDKClient({
  workingDirectory: "/path/to/project"
});

await client.connect();
await client.setModel("claude-opus-4");

await client.query("このプロジェクトのテストカバレッジを分析してください");

for await (const msg of client.receiveMessages()) {
  console.log(msg);
}
```

### 例3：動的設定

```typescript
const client = new ClaudeAgentSDKClient();
await client.connect();

// 厳格な権限で開始
await client.setPermissionMode("blockAll");
await client.query("ファイルを一覧表示（読み取り専用）");

// その後、編集を許可
await client.setPermissionMode("acceptEdits");
await client.query("新しいテストファイルを作成");
```

## エラーハンドリング

```typescript
try {
  const client = new ClaudeAgentSDKClient();
  await client.connect();
  await client.query("あなたのメッセージ");

  for await (const msg of client.receiveMessages()) {
    // メッセージを処理
  }
} catch (error) {
  if (error instanceof ClaudeAgentSDKError) {
    console.error("SDKエラー：", error.message);
  } else {
    console.error("予期しないエラー：", error);
  }
}
```

## 貢献

貢献を歓迎します！Pull Requestをお気軽に送信してください。貢献する際のガイドライン：

1. 既存のコードスタイルに従う
2. 新機能についてテストを追加
3. 必要に応じてドキュメントを更新
4. すべてのテストが通ることを確認：`npm test`
5. コードをリント：`npm run lint`

### 開発ワークフロー

```bash
# リポジトリをクローン
git clone https://github.com/anthropics/claude-agent-sdk-ts.git
cd claude-agent-sdk-ts

# 依存関係をインストール
npm install

# 変更を加える
# ...

# テストを実行
npm test

# ビルド
npm run build

# Pull Requestを送信
```

## ライセンス

このプロジェクトはMIT Licenseの下でライセンスされています。詳細はLICENSEファイルを参照してください。

コミュニティの貢献を奨励し、公式の使用条件を遵守した上で、高度な機能（深いHook/MCPサポート、メッセージパーサーなど）の拡張を歓迎します。

## サポート

質問、問題、またはご提案：

- [Issue](https://github.com/anthropics/claude-agent-sdk-ts/issues)を提出
- [既存のディスカッション](https://github.com/anthropics/claude-agent-sdk-ts/discussions)を確認
- [Claudeドキュメント](https://docs.claude.com/)を読む

## 変更ログ

詳細は[CHANGELOG.md](./CHANGELOG.md)を参照してください。

## 関連プロジェクト

- [Claude Agent SDK (Python)](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude Code CLI](https://docs.claude.com/claude-code/claude_code_docs_map.md)
- [Anthropic ドキュメント](https://docs.claude.com/)

---

Anthropicがオープンソースコミュニティのために❤️で提供
