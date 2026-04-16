import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("group list", () => {
  beforeEach(async () => {
    __resetRegistry();
    await import("../../../src/commands/chain/groupList.js");
  });
  it("returns groups from RPC", async () => {
    const fakeGroups = ["group0", "group1", "group2"];
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g0", chainId: 1 } as never },
      fileConfig: null,
      bcosRpc: { call: async (m: string) => {
        if (m === "getGroupList") return fakeGroups;
        return null;
      } } as never,
      web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    const r = await getCommand("group list")!.handler(ctx, {}) as {
      groups: string[];
    };
    expect(r.groups).toEqual(fakeGroups);
  });
});
