import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("config show", () => {
  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/config/show.js");
  });
  it("returns chain info", async () => {
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "x", profile: { bcosRpcUrl: "u", groupId: "g" } as never },
      fileConfig: null,
      bcosRpc: {} as never, web3Rpc: {} as never, abiRegistry: {} as never,
      txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    const r = await getCommand("config show")!.handler(ctx, {}) as { chain: string };
    expect(r.chain).toBe("x");
  });
});
