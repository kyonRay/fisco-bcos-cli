import { describe, it, expect } from "vitest";
import { BcosCliError, exitCodeFor, toBcosCliError } from "../../src/errors.js";

describe("BcosCliError", () => {
  it("carries code, message, details, cause", () => {
    const cause = new Error("inner");
    const e = new BcosCliError("RPC_ERROR", "oops", { rpcCode: -32000 }, cause);
    expect(e.code).toBe("RPC_ERROR");
    expect(e.message).toBe("oops");
    expect(e.details).toEqual({ rpcCode: -32000 });
    expect(e.cause).toBe(cause);
    expect(e.name).toBe("BcosCliError");
  });
});

describe("exitCodeFor", () => {
  it("returns 2 for usage errors", () => {
    for (const code of ["INVALID_ARGUMENT", "UNKNOWN_COMMAND", "CHAIN_NOT_FOUND",
      "CONFIG_MISSING", "INVALID_CONFIG", "LOG_DIR_REQUIRED"] as const) {
      expect(exitCodeFor(code)).toBe(2);
    }
  });
  it("returns 1 for runtime errors", () => {
    for (const code of ["RPC_ERROR", "RPC_TIMEOUT", "RPC_UNREACHABLE", "NOT_FOUND",
      "ABI_NOT_FOUND", "DECODE_FAILED", "LOG_DIR_NOT_FOUND", "LOG_PARSE_FAILED",
      "FILE_IO_ERROR", "INTERNAL"] as const) {
      expect(exitCodeFor(code)).toBe(1);
    }
  });
});

describe("toBcosCliError", () => {
  it("passes BcosCliError through", () => {
    const e = new BcosCliError("NOT_FOUND", "x");
    expect(toBcosCliError(e)).toBe(e);
  });
  it("wraps generic Error as INTERNAL with stack in details", () => {
    const src = new Error("boom");
    const e = toBcosCliError(src);
    expect(e.code).toBe("INTERNAL");
    expect(e.message).toBe("boom");
    expect(e.details?.stack).toBeDefined();
  });
  it("wraps non-Error as INTERNAL", () => {
    const e = toBcosCliError("some string");
    expect(e.code).toBe("INTERNAL");
    expect(e.message).toContain("some string");
  });
});
