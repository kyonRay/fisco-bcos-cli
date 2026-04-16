import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";
import { BcosCliError } from "../../../src/errors.js";

const ADDRESS = "0x" + "3".repeat(40);

function ctx(abiEntry: unknown, rpcResult?: unknown): AppContext {
  return {
    logger: { debug(){}, info(){}, warn(){}, error(){} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: { call: async () => rpcResult ?? null } as never,
    web3Rpc: {} as never,
    abiRegistry: {
      add: async () => ({} as never),
      get: async () => abiEntry,
      list: async () => [],
      remove: async () => false,
    },
    txDecoder: { decodeInput: async () => ({ status: "abi_not_found" as const }),
      decodeEvent: async () => ({ status: "abi_not_found" as const }) },
    logReader: {} as never,
  };
}

describe("bcos call", () => {
  beforeAll(async () => { __resetRegistry(); await import("../../../src/commands/call.js"); });

  it("throws ABI_NOT_FOUND when no registry entry", async () => {
    const err = await getCommand("call")!.handler(
      ctx(null),
      { address: ADDRESS, method: "getValue", args: [] },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BcosCliError);
    expect((err as BcosCliError).code).toBe("ABI_NOT_FOUND");
  });

  it("throws INVALID_ARGUMENT when method not in ABI", async () => {
    const entry = { abi: [{ type: "function", name: "getValue", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }] };
    const err = await getCommand("call")!.handler(
      ctx(entry),
      { address: ADDRESS, method: "nonExistentMethod", args: [] },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BcosCliError);
    expect((err as BcosCliError).code).toBe("INVALID_ARGUMENT");
  });
});
