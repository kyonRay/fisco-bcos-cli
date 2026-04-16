import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

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

describe("bcos block", () => {
  beforeAll(async () => { __resetRegistry(); await import("../../../src/commands/block.js"); });

  it("returns block data", async () => {
    const out = await getCommand("block")!.handler(ctx({ number: "0xa" }),
      { block: { kind: "number", value: "10" }, withTxs: false }) as { block: unknown };
    expect(out.block).toEqual({ number: "0xa" });
  });

  it("throws NOT_FOUND on null", async () => {
    await expect(getCommand("block")!.handler(ctx(null),
      { block: { kind: "number", value: "10" }, withTxs: false }))
      .rejects.toThrow(/not found/i);
  });
});
