import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("consensus status", () => {
  beforeEach(async () => {
    __resetRegistry();
    await import("../../../src/commands/chain/consensus.js");
  });
  it("returns sealers, observers, and pbft view from RPC", async () => {
    const fakeSealers = ["node0", "node1"];
    const fakeObservers = ["node2"];
    const fakeView = 42;
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g0", chainId: 1 } as never },
      fileConfig: null,
      bcosRpc: { call: async (m: string) => {
        if (m === "getSealerList") return fakeSealers;
        if (m === "getObserverList") return fakeObservers;
        if (m === "getPbftView") return fakeView;
        return null;
      } } as never,
      web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    const r = await getCommand("consensus status")!.handler(ctx, {}) as {
      sealers: unknown; observers: unknown; view: unknown;
    };
    expect(r.sealers).toEqual(fakeSealers);
    expect(r.observers).toEqual(fakeObservers);
    expect(r.view).toBe(fakeView);
  });
});
