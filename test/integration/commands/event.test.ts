import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import { register } from "../../../src/commands/event.js";
import type { AppContext } from "../../../src/context.js";

describe("event command", () => {
  beforeEach(() => {
    __resetRegistry();
    register();
  });

  it("returns decoded event logs", async () => {
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
      fileConfig: null,
      bcosRpc: { call: async () => [
        { address: "0xabc00000000000000000000000000000000000de", topics: ["0x1"], data: "0x" }
      ] } as never,
      web3Rpc: {} as never,
      abiRegistry: { get: async () => null, add: async () => ({} as never), list: async () => [], remove: async () => false },
      txDecoder: {
        decodeInput: async () => ({ status: "abi_not_found" as const }),
        decodeEvent: async () => ({ status: "abi_not_found" as const }),
      },
      logReader: {} as never,
    } as AppContext;
    const r = await getCommand("event")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de",
      fromBlock: "0", toBlock: "10",
    }) as { count: number; degraded: boolean };
    expect(r.count).toBe(1);
    expect(r.degraded).toBe(true);
  });
});
