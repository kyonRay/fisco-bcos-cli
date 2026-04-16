import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AppContext } from "../../../src/context.js";

function fakeCtx(overrides: Partial<AppContext> = {}): AppContext {
  return {
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: { call: async () => null } as never,
    web3Rpc: {} as never,
    abiRegistry: {
      add: async () => ({} as never),
      get: async () => null,
      list: async () => [],
      remove: async () => false,
    },
    txDecoder: {
      decodeInput: async () => ({ status: "abi_not_found" as const }),
      decodeEvent: async () => ({ status: "abi_not_found" as const }),
    },
    logReader: {} as never,
    ...overrides,
  };
}

const FAKE_HASH = "0x" + "ab".repeat(32);
const FAKE_TX = {
  hash: FAKE_HASH,
  to: "0xabc00000000000000000000000000000000000de",
  input: "0xdeadbeef",
  nonce: "0x1",
  from: "0x1234567890123456789012345678901234567890",
};

describe("doctor tx command", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { __resetRegistry } = await import("../../../src/commands/registry.js");
    __resetRegistry();
    await import("../../../src/commands/doctor/tx.js");
  });

  it("throws NOT_FOUND when tx is not found", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("doctor tx")!;
    const ctx = fakeCtx({
      bcosRpc: { call: async () => null } as never,
    });
    await expect(cmd.handler(ctx, { hash: FAKE_HASH })).rejects.toThrow(/not found/i);
  });

  it("produces 'no receipt' finding when receipt is null", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("doctor tx")!;
    const ctx = fakeCtx({
      bcosRpc: {
        async call(method: string) {
          if (method === "getTransactionByHash") return FAKE_TX;
          if (method === "getTransactionReceipt") return null;
          return null;
        },
      } as never,
    });
    const res = await cmd.handler(ctx, { hash: FAKE_HASH }) as {
      tx: unknown;
      receipt: unknown;
      findings: string[];
    };
    expect(res.receipt).toBeNull();
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]).toMatch(/no receipt/i);
  });

  it("produces non-zero status finding when receipt status is non-zero", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("doctor tx")!;
    const ctx = fakeCtx({
      bcosRpc: {
        async call(method: string) {
          if (method === "getTransactionByHash") return FAKE_TX;
          if (method === "getTransactionReceipt") {
            return { status: "0x1", output: "0x", logs: [] };
          }
          return null;
        },
      } as never,
    });
    const res = await cmd.handler(ctx, { hash: FAKE_HASH }) as {
      tx: unknown;
      receipt: unknown;
      findings: string[];
    };
    expect(res.findings.some((f) => f.includes("non-zero status code"))).toBe(true);
  });

  it("returns empty findings for successful tx with zero status", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("doctor tx")!;
    const ctx = fakeCtx({
      bcosRpc: {
        async call(method: string) {
          if (method === "getTransactionByHash") return FAKE_TX;
          if (method === "getTransactionReceipt") {
            return { status: "0x0", output: "0x", logs: [] };
          }
          return null;
        },
      } as never,
    });
    const res = await cmd.handler(ctx, { hash: FAKE_HASH }) as {
      tx: unknown;
      receipt: unknown;
      findings: string[];
    };
    expect(res.findings).toHaveLength(0);
  });
});
