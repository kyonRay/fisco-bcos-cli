export type UsageErrorCode =
  | "INVALID_ARGUMENT"
  | "UNKNOWN_COMMAND"
  | "CHAIN_NOT_FOUND"
  | "CONFIG_MISSING"
  | "INVALID_CONFIG"
  | "LOG_DIR_REQUIRED";

export type RuntimeErrorCode =
  | "RPC_ERROR"
  | "RPC_TIMEOUT"
  | "RPC_UNREACHABLE"
  | "NOT_FOUND"
  | "ABI_NOT_FOUND"
  | "DECODE_FAILED"
  | "LOG_DIR_NOT_FOUND"
  | "LOG_PARSE_FAILED"
  | "FILE_IO_ERROR"
  | "INTERNAL";

export type ErrorCode = UsageErrorCode | RuntimeErrorCode;

const USAGE_CODES = new Set<ErrorCode>([
  "INVALID_ARGUMENT", "UNKNOWN_COMMAND", "CHAIN_NOT_FOUND",
  "CONFIG_MISSING", "INVALID_CONFIG", "LOG_DIR_REQUIRED",
]);

export class BcosCliError extends Error {
  readonly name = "BcosCliError";
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
  }
}

export function exitCodeFor(code: ErrorCode): 1 | 2 {
  return USAGE_CODES.has(code) ? 2 : 1;
}

export function toBcosCliError(err: unknown): BcosCliError {
  if (err instanceof BcosCliError) return err;
  if (err instanceof Error) {
    return new BcosCliError("INTERNAL", err.message, { stack: err.stack }, err);
  }
  return new BcosCliError("INTERNAL", `non-error thrown: ${String(err)}`, {}, err);
}
