import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("peers", () => {
  beforeEach(async () => {
    __resetRegistry();
    await import("../../../src/commands/chain/peers.js");
  });
  it("returns peers and groupPeers from RPC", async () => {
    const fakePeers = [{ nodeId: "abc", ipPort: "127.0.0.1:30300" }];
    const fakeGroupPeers = ["nodeA", "nodeB"];
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g0", chainId: 1 } as never },
      fileConfig: null,
      bcosRpc: { call: async (m: string) => {
        if (m === "getPeers") return fakePeers;
        if (m === "getGroupPeers") return fakeGroupPeers;
        return null;
      } } as never,
      web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    const r = await getCommand("peers")!.handler(ctx, {}) as {
      peers: unknown; groupPeers: unknown;
    };
    expect(r.peers).toEqual(fakePeers);
    expect(r.groupPeers).toEqual(fakeGroupPeers);
  });
});
