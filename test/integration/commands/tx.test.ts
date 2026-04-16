import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AppContext } from "../../../src/context.js";

function fakeCtx(overrides: Partial<AppContext> = {}): AppContext {
  return {
    logger: { debug(){}, info(){}, warn(){}, error(){} },
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
    txDecoder: { decodeInput: async () => ({ status: "abi_not_found" as const }),
      decodeEvent: async () => ({ status: "abi_not_found" as const }) },
    logReader: {} as never,
    ...overrides,
  };
}

describe("bcos tx command", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { __resetRegistry } = await import("../../../src/commands/registry.js");
    __resetRegistry();
    await import("../../../src/commands/tx.js");
  });

  it("returns tx + receipt; marks degraded when no ABI", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("tx")!;
    const calls: string[] = [];
    const ctx = fakeCtx({
      bcosRpc: {
        async call(method: string) {
          calls.push(method);
          if (method === "getTransactionByHash") {
            return { hash: "0x" + "ab".repeat(32),
              to: "0xabc00000000000000000000000000000000000de",
              input: "0xdeadbeef", nonce: "0x1" };
          }
          if (method === "getTransactionReceipt") {
            return { status: "0x0", logs: [] };
          }
          return null;
        },
      } as never,
    });
    const res = await cmd.handler(ctx, { hash: "0x" + "ab".repeat(32), decode: true }) as {
      tx: unknown; receipt: unknown; decoded: unknown; degraded: boolean;
    };
    expect(calls).toContain("getTransactionByHash");
    expect(calls).toContain("getTransactionReceipt");
    expect(res.degraded).toBe(true);
  });

  it("throws NOT_FOUND when tx missing", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("tx")!;
    const ctx = fakeCtx({ bcosRpc: { call: async () => null } as never });
    await expect(cmd.handler(ctx, {
      hash: "0x" + "ab".repeat(32), decode: true,
    })).rejects.toThrow(/not found/i);
  });
});
