import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("config list-chains", () => {
  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/config/listChains.js");
  });
  it("returns chains from fileConfig", async () => {
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "local", profile: { bcosRpcUrl: "http://localhost:8545", groupId: "group0" } as never },
      fileConfig: {
        defaultChain: "local",
        chains: {
          local: { bcosRpcUrl: "http://localhost:8545", groupId: "group0" },
        },
        abiStoreDir: "~/.bcos-cli/abi",
      },
      bcosRpc: {} as never, web3Rpc: {} as never, abiRegistry: {} as never,
      txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    const r = await getCommand("config list-chains")!.handler(ctx, {}) as { defaultChain: string; chains: string[] };
    expect(r.defaultChain).toBe("local");
    expect(r.chains).toEqual(["local"]);
  });
});
