import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AppContext } from "../../../src/context.js";

function fakeCtx(overrides: Partial<AppContext> = {}): AppContext {
  return {
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: { call: async () => null } as never,
    web3Rpc: {} as never,
    abiRegistry: {
      add: async () => ({} as never),
      get: async () => null,
      list: async () => [],
      remove: async () => false,
    },
    txDecoder: {
      decodeInput: async () => ({ status: "abi_not_found" as const }),
      decodeEvent: async () => ({ status: "abi_not_found" as const }),
    },
    logReader: {} as never,
    ...overrides,
  };
}

describe("doctor chain command", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { __resetRegistry } = await import("../../../src/commands/registry.js");
    __resetRegistry();
    await import("../../../src/commands/doctor/chain.js");
  });

  it("produces 'no peers connected' finding when peer list is empty", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("doctor chain")!;
    const ctx = fakeCtx({
      bcosRpc: {
        async call(method: string) {
          if (method === "getSyncStatus") {
            return { blockNumber: "0x64", knownLatestBlockNumber: "0x64" };
          }
          if (method === "getPbftView") return "0x5";
          if (method === "getPeers") return [];
          if (method === "getSealerList") return ["a", "b", "c", "d"];
          return null;
        },
      } as never,
    });
    const res = await cmd.handler(ctx, {}) as {
      sync: unknown;
      view: unknown;
      peerCount: number;
      sealerCount: number;
      findings: string[];
    };
    expect(res.peerCount).toBe(0);
    expect(res.findings).toContain("no peers connected");
  });

  it("produces PBFT sealer finding when fewer than 4 sealers", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("doctor chain")!;
    const ctx = fakeCtx({
      bcosRpc: {
        async call(method: string) {
          if (method === "getSyncStatus") {
            return { blockNumber: "0x64", knownLatestBlockNumber: "0x64" };
          }
          if (method === "getPbftView") return "0x5";
          if (method === "getPeers") return [{ nodeId: "peer1" }];
          if (method === "getSealerList") return ["a", "b", "c"];
          return null;
        },
      } as never,
    });
    const res = await cmd.handler(ctx, {}) as {
      sync: unknown;
      view: unknown;
      peerCount: number;
      sealerCount: number;
      findings: string[];
    };
    expect(res.sealerCount).toBe(3);
    expect(res.findings.some((f) => f.includes("3 sealers"))).toBe(true);
    expect(res.findings.some((f) => f.includes("PBFT"))).toBe(true);
  });

  it("produces block lag finding when node is significantly behind", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("doctor chain")!;
    const ctx = fakeCtx({
      bcosRpc: {
        async call(method: string) {
          if (method === "getSyncStatus") {
            return { blockNumber: "0x1", knownLatestBlockNumber: "0x64" };
          }
          if (method === "getPbftView") return "0x5";
          if (method === "getPeers") return [{ nodeId: "peer1" }, { nodeId: "peer2" }];
          if (method === "getSealerList") return ["a", "b", "c", "d"];
          return null;
        },
      } as never,
    });
    const res = await cmd.handler(ctx, {}) as {
      sync: unknown;
      view: unknown;
      peerCount: number;
      sealerCount: number;
      findings: string[];
    };
    expect(res.findings.some((f) => f.includes("blocks behind"))).toBe(true);
  });

  it("returns no findings for a healthy chain", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const cmd = getCommand("doctor chain")!;
    const ctx = fakeCtx({
      bcosRpc: {
        async call(method: string) {
          if (method === "getSyncStatus") {
            return { blockNumber: "0x64", knownLatestBlockNumber: "0x64" };
          }
          if (method === "getPbftView") return "0x5";
          if (method === "getPeers") return [{ nodeId: "p1" }, { nodeId: "p2" }, { nodeId: "p3" }];
          if (method === "getSealerList") return ["a", "b", "c", "d"];
          return null;
        },
      } as never,
    });
    const res = await cmd.handler(ctx, {}) as {
      sync: unknown;
      view: unknown;
      peerCount: number;
      sealerCount: number;
      findings: string[];
    };
    expect(res.findings).toHaveLength(0);
    expect(res.peerCount).toBe(3);
    expect(res.sealerCount).toBe(4);
  });
});
