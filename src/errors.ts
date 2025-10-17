export class CLIConnectionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CLIConnectionError";
  }
}

export class CLINotFoundError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CLINotFoundError";
  }
}

export class ProcessError extends Error {
  readonly exitCode: number | null | undefined;
  readonly stderr: string | undefined;

  constructor(message: string, exitCode?: number | null, stderr?: string) {
    super(message);
    this.name = "ProcessError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export class SDKJSONDecodeError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause: cause instanceof Error ? cause : undefined });
    this.name = "SDKJSONDecodeError";
  }
}
