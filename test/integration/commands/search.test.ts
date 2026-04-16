import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import { register } from "../../../src/commands/search.js";
import type { AppContext } from "../../../src/context.js";

describe("search tx command", () => {
  beforeEach(() => {
    __resetRegistry();
    register();
  });

  it("finds matching tx by to address", async () => {
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
      fileConfig: null,
      bcosRpc: { call: async () => ({
        number: "0x1",
        transactions: [
          { hash: "0xaaa", from: "0x0000000000000000000000000000000000000001",
            to: "0xabc00000000000000000000000000000000000de" },
        ],
      }) } as never,
      web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    const r = await getCommand("search tx")!.handler(ctx, {
      to: "0xabc00000000000000000000000000000000000de",
      fromBlock: "1", toBlock: "1",
    }) as { matches: unknown[] };
    expect(r.matches).toHaveLength(1);
  });

  it("rejects when neither from nor to given", async () => {
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
      fileConfig: null,
      bcosRpc: {} as never, web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    await expect(getCommand("search tx")!.handler(ctx, {
      fromBlock: "1", toBlock: "1",
    })).rejects.toThrow(/from or --to/i);
  });
});
