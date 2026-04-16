import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("chain info", () => {
  beforeEach(async () => {
    __resetRegistry();
    await import("../../../src/commands/chain/info.js");
  });
  it("aggregates sync, view, groupList", async () => {
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g0", chainId: 1 } as never },
      fileConfig: null,
      bcosRpc: { call: async (m: string) => {
        if (m === "getSyncStatus") return { h: 100 };
        if (m === "getPbftView") return 5;
        if (m === "getGroupList") return ["group0", "group1"];
        return null;
      } } as never,
      web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    const r = await getCommand("chain info")!.handler(ctx, {}) as {
      syncStatus: unknown; pbftView: unknown; groupList: string[];
    };
    expect(r.syncStatus).toEqual({ h: 100 });
    expect(r.pbftView).toBe(5);
    expect(r.groupList).toEqual(["group0", "group1"]);
  });
});
