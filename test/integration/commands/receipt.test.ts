import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

const HASH = "0x" + "a".repeat(64);

function ctx(rpcResult: unknown): AppContext {
  return {
    logger: { debug(){}, info(){}, warn(){}, error(){} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: { call: async () => rpcResult } as never,
    web3Rpc: {} as never,
    abiRegistry: { add: async () => ({} as never), get: async () => null,
      list: async () => [], remove: async () => false },
    txDecoder: { decodeInput: async () => ({ status: "abi_not_found" as const }),
      decodeEvent: async () => ({ status: "abi_not_found" as const }) },
    logReader: {} as never,
  };
}

describe("bcos receipt", () => {
  beforeAll(async () => { __resetRegistry(); await import("../../../src/commands/receipt.js"); });

  it("returns receipt data", async () => {
    const out = await getCommand("receipt")!.handler(ctx({ status: "0x0" }),
      { hash: HASH }) as { receipt: unknown };
    expect(out.receipt).toEqual({ status: "0x0" });
  });

  it("throws NOT_FOUND on null", async () => {
    await expect(getCommand("receipt")!.handler(ctx(null), { hash: HASH }))
      .rejects.toThrow(/not found/i);
  });
});
