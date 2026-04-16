import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

const ADDRESS = "0x" + "1".repeat(40);

function ctx(balanceResult: string, codeResult: string): AppContext {
  return {
    logger: { debug(){}, info(){}, warn(){}, error(){} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: {
      call: async (_method: string, _params: unknown[]) => {
        if (_method === "getBalance") return balanceResult;
        if (_method === "getCode") return codeResult;
        return null;
      },
    } as never,
    web3Rpc: {} as never,
    abiRegistry: { add: async () => ({} as never), get: async () => null,
      list: async () => [], remove: async () => false },
    txDecoder: { decodeInput: async () => ({ status: "abi_not_found" as const }),
      decodeEvent: async () => ({ status: "abi_not_found" as const }) },
    logReader: {} as never,
  };
}

describe("bcos account", () => {
  beforeAll(async () => { __resetRegistry(); await import("../../../src/commands/account.js"); });

  it("returns EOA info when no code", async () => {
    const out = await getCommand("account")!.handler(
      ctx("0x64", "0x"),
      { address: ADDRESS },
    ) as { address: string; balance: string; isContract: boolean; codeSize: number };
    expect(out.address).toBe(ADDRESS);
    expect(out.balance).toBe("100");
    expect(out.isContract).toBe(false);
    expect(out.codeSize).toBe(0);
  });

  it("detects contract when code present", async () => {
    const out = await getCommand("account")!.handler(
      ctx("0x0", "0x6080"),
      { address: ADDRESS },
    ) as { isContract: boolean; codeSize: number };
    expect(out.isContract).toBe(true);
    expect(out.codeSize).toBe(2); // "6080" = 2 bytes
  });
});
