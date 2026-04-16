import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

const ADDRESS = "0x" + "2".repeat(40);

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

describe("bcos code", () => {
  beforeAll(async () => { __resetRegistry(); await import("../../../src/commands/code.js"); });

  it("returns address and code", async () => {
    const out = await getCommand("code")!.handler(
      ctx("0x6080604052"),
      { address: ADDRESS },
    ) as { address: string; code: string };
    expect(out.address).toBe(ADDRESS);
    expect(out.code).toBe("0x6080604052");
  });

  it("returns empty code for EOA", async () => {
    const out = await getCommand("code")!.handler(
      ctx("0x"),
      { address: ADDRESS },
    ) as { code: string };
    expect(out.code).toBe("0x");
  });
});
