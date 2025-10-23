# Claude Agent SDK for TypeScript - 한국어 버전

Claude Code CLI를 사용하여 사용자 정의 에이전트 워크플로우를 구축하기 위한 TypeScript SDK입니다. 이 오픈소스 프로젝트는 TypeScript 애플리케이션에 Claude AI 기능을 통합하기 위한 사용하기 쉬운 인터페이스를 제공합니다.

**언어 선택:**
[English](./README.md) | [中文](./README.zh-CN.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

## 프로젝트 개요

Claude Agent SDK TS의 주요 기능:

- **양방향 스트리밍 통신**: `ClaudeAgentSDKClient`를 통해 Claude Code와의 양방향 스트리밍 대화를 지원하며, 지속적인 메시지 교환을 가능하게 합니다
- **서브프로세스 CLI 전송**: `SubprocessCLITransport`를 사용하여 Claude Code CLI를 호스팅하며, 완전한 매개변수, 작업 디렉토리 및 환경 변수 지원
- **동적 런타임 구성**: `setPermissionMode`와 `setModel`을 사용하여 세션 중에 권한 및 모델 버전을 동적으로 조정 가능
- **타입 안전 추상화**: 권한, Hook 콜백, MCP 구성 등에 대한 TypeScript 타입 정의 제공
- **포괄적 테스트 커버리지**: Vitest를 사용한 단위 테스트로 중요한 제어 요청 로직의 정확성을 보장

## 참고 자료

이 프로젝트는 다음 공식 리소스를 기반으로 합니다:

- [Agent SDK 개요 문서](https://docs.claude.com/en/api/agent-sdk/overview)
- [공식 Python SDK 저장소](https://github.com/anthropics/claude-agent-sdk-python)
- [Python SDK PR #171 - 권한 모드 및 모델 전환](https://github.com/anthropics/claude-agent-sdk-python/pull/171)

## 설치

```bash
npm install claude-agent-sdk-ts
```

### 필수 조건

- Node.js 18 이상
- Claude Code CLI 설치됨: `npm install -g @anthropic-ai/claude-code`

## 빠른 시작

```typescript
import { ClaudeAgentSDKClient } from "claude-agent-sdk-ts";

const client = new ClaudeAgentSDKClient();
await client.connect();

// 권한 및 모델 설정
await client.setPermissionMode("acceptEdits");
await client.setModel("claude-sonnet-4.1");

// 쿼리 전송
await client.query("이 TypeScript 함수 구현을 검토해주세요");

// 스트리밍 응답 수신
for await (const message of client.receiveMessages()) {
  console.log(message);
}
```

## 핵심 기능

### ClaudeAgentSDKClient

Claude Code와 상호작용하는 주요 클라이언트 클래스:

```typescript
// 사용자 정의 구성으로 클라이언트 생성
const client = new ClaudeAgentSDKClient({
  cliPath: "claude-code",
  workingDirectory: "/path/to/project",
  env: { /* 사용자 정의 환경 변수 */ }
});

// Claude Code에 연결
await client.connect();

// 사용자 메시지를 전송하고 스트리밍 응답 받기
await client.query("당신의 메시지");

// 스트리밍 메시지를 반복
for await (const msg of client.receiveMessages()) {
  // 각 메시지 처리
}

// 동적 구성
await client.setPermissionMode("blockAll"); // 또는 "acceptAll", "acceptEdits"
await client.setModel("claude-opus-4");
```

### SubprocessCLITransport

Claude Code CLI와의 서브프로세스 통신 처리:

- CLI 프로세스 생명주기 관리
- 표준 I/O 스트림 처리
- 환경 변수 주입 지원
- 오류 처리 및 타임아웃 관리 제공

### 제어 프로토콜

다음 제어 프로토콜 기능 구현:

- 제어 요청/응답 처리
- 도구 권한 및 사용자 상호작용의 Hook 콜백
- MCP(Model Context Protocol) 구성
- 런타임 상태 관리

## 프로젝트 구조

```
claude-agent-sdk-ts/
├── src/
│   ├── client.ts          # 주요 SDK 클라이언트
│   ├── transport.ts       # CLI 서브프로세스 전송 계층
│   ├── query.ts           # 제어 프로토콜 구현
│   ├── types.ts           # TypeScript 타입 정의
│   ├── errors.ts          # 사용자 정의 오류 클래스
│   ├── index.ts           # 패키지 내보내기
│   ├── version.ts         # 버전 정보
│   └── utils/
│       └── asyncQueue.ts  # 비동기 큐 유틸리티
├── tests/
│   └── ...                # Vitest 단위 테스트
├── package.json
├── tsconfig.json
└── README.md
```

## API 참조

### 타입 정의

SDK가 제공하는 주요 TypeScript 타입:

```typescript
// 권한 모드
type PermissionMode = "blockAll" | "acceptEdits" | "acceptAll";

// 메시지 타입
interface ControlRequest {
  type: string;
  // ... 추가 필드
}

interface ControlResponse {
  type: string;
  // ... 추가 필드
}

// Hook 정의
interface HookCallback {
  type: "permission" | "interaction";
  // ... Hook 특정 데이터
}
```

### 메서드

#### `ClaudeAgentSDKClient`

- `connect(): Promise<void>` - Claude Code와의 연결 설정
- `query(message: string): Promise<void>` - 사용자 메시지 전송
- `receiveMessages(): AsyncIterable<any>` - 스트리밍 메시지 반복자 가져오기
- `setPermissionMode(mode: PermissionMode): Promise<void>` - 권한 업데이트
- `setModel(model: string): Promise<void>` - AI 모델 전환
- `disconnect(): Promise<void>` - 연결 종료

## 개발 가이드

### 빌드

```bash
npm run build
```

### 린트

```bash
npm run lint
```

### 테스트 실행

```bash
npm test
```

### 정리

```bash
npm run clean
```

## 환경 설정

Claude Code CLI 통합을 위해:

```bash
# Claude Code CLI를 전역으로 설치
npm install -g @anthropic-ai/claude-code

# 설치 확인
claude-code --version
```

## 구성

### 사용자 정의 CLI 전송 옵션

```typescript
const client = new ClaudeAgentSDKClient({
  cliPath: "claude-code",                    // Claude Code CLI의 경로
  workingDirectory: process.cwd(),           // CLI의 작업 디렉토리
  env: { ...process.env }                    // 환경 변수
});
```

### 권한 모드

- `blockAll` - 모든 도구 실행 차단 (가장 제한적)
- `acceptEdits` - 파일 편집 및 기본 작업 허용
- `acceptAll` - 모든 작업 허용 (가장 허용적)

### 지원되는 모델

- `claude-opus-4` - 가장 강력한 모델
- `claude-sonnet-4.1` - 빠르고 효율적
- `claude-haiku-4.5-20251001` - 경량

## 사용 예제

### 예제 1: 코드 검토

```typescript
const client = new ClaudeAgentSDKClient();
await client.connect();
await client.setPermissionMode("acceptEdits");

await client.query("TypeScript 코드를 검토하고 개선 사항을 제안해주세요");

for await (const msg of client.receiveMessages()) {
  console.log(msg);
}
```

### 예제 2: 파일 분석

```typescript
const client = new ClaudeAgentSDKClient({
  workingDirectory: "/path/to/project"
});

await client.connect();
await client.setModel("claude-opus-4");

await client.query("이 프로젝트의 테스트 커버리지를 분석해주세요");

for await (const msg of client.receiveMessages()) {
  console.log(msg);
}
```

### 예제 3: 동적 구성

```typescript
const client = new ClaudeAgentSDKClient();
await client.connect();

// 제한적 권한으로 시작
await client.setPermissionMode("blockAll");
await client.query("파일 나열 (읽기 전용)");

// 그 다음 편집 허용
await client.setPermissionMode("acceptEdits");
await client.query("새 테스트 파일 생성");
```

## 오류 처리

```typescript
try {
  const client = new ClaudeAgentSDKClient();
  await client.connect();
  await client.query("당신의 메시지");

  for await (const msg of client.receiveMessages()) {
    // 메시지 처리
  }
} catch (error) {
  if (error instanceof ClaudeAgentSDKError) {
    console.error("SDK 오류:", error.message);
  } else {
    console.error("예기치 않은 오류:", error);
  }
}
```

## 기여

기여를 환영합니다! Pull Request를 자유롭게 제출해주세요. 기여할 때 다음을 유의하세요:

1. 기존 코드 스타일 따르기
2. 새로운 기능에 대해 테스트 추가
3. 필요한 경우 문서 업데이트
4. 모든 테스트가 통과하는지 확인: `npm test`
5. 코드 린트: `npm run lint`

### 개발 워크플로우

```bash
# 저장소 클론
git clone https://github.com/anthropics/claude-agent-sdk-ts.git
cd claude-agent-sdk-ts

# 의존성 설치
npm install

# 변경 사항 적용
# ...

# 테스트 실행
npm test

# 빌드
npm run build

# Pull Request 제출
```

## 라이선스

이 프로젝트는 MIT License에 따라 라이선스됩니다. 자세한 내용은 LICENSE 파일을 참조하세요.

커뮤니티 기여를 장려하며, 공식 사용 조건을 준수하는 한 고급 기능(깊은 Hook/MCP 지원, 메시지 파서 등)의 확장을 환영합니다.

## 지원

질문, 문제 또는 제안사항:

- [이슈](https://github.com/anthropics/claude-agent-sdk-ts/issues) 제출
- [기존 토론](https://github.com/anthropics/claude-agent-sdk-ts/discussions) 확인
- [Claude 문서](https://docs.claude.com/) 읽기

## 변경 로그

자세한 내용은 [CHANGELOG.md](./CHANGELOG.md)를 참조하세요.

## 관련 프로젝트

- [Claude Agent SDK (Python)](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude Code CLI](https://docs.claude.com/claude-code/claude_code_docs_map.md)
- [Anthropic 문서](https://docs.claude.com/)

---

Anthropic에서 오픈소스 커뮤니티를 위해 만들었습니다 ❤️
