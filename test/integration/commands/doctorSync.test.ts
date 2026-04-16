import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("doctor sync", () => {
  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/doctor/sync.js");
  });

  it("counts sync events and tracks height range", async () => {
    const lines = [
      "info|2099-01-01 00:00:01.000000|[SYNC] syncing block, height=100",
      "info|2099-01-01 00:00:02.000000|[SYNC] syncing block, height=150",
      "info|2099-01-01 00:00:03.000000|[SYNC] syncing block, height=200",
      // non-sync line — should be ignored
      "info|2099-01-01 00:00:04.000000|[EXECUTOR] executed block, costMs=10",
    ];
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g", logDir: "/tmp" } as never },
      fileConfig: null,
      bcosRpc: {} as never, web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never,
      logReader: {
        listFiles: async () => [],
        async *streamLines() { for (const l of lines) yield { file: "f", line: l, lineNo: 0 }; },
      },
    } as AppContext;

    const r = await getCommand("doctor sync")!.handler(ctx, {}) as {
      syncEvents: number;
      minHeight: number | undefined;
      maxHeight: number | undefined;
      progressedBlocks: number;
      failures: string[];
    };

    expect(r.syncEvents).toBe(3);
    expect(r.minHeight).toBe(100);
    expect(r.maxHeight).toBe(200);
    expect(r.progressedBlocks).toBe(100);
    expect(r.failures).toHaveLength(0);
  });

  it("collects sync error failures", async () => {
    const lines = [
      "error|2099-01-01 00:00:01.000000|[SYNC] failed to fetch block, height=50",
      "error|2099-01-01 00:00:02.000000|[SYNC] peer disconnected, height=51",
    ];
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g", logDir: "/tmp" } as never },
      fileConfig: null,
      bcosRpc: {} as never, web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never,
      logReader: {
        listFiles: async () => [],
        async *streamLines() { for (const l of lines) yield { file: "f", line: l, lineNo: 0 }; },
      },
    } as AppContext;

    const r = await getCommand("doctor sync")!.handler(ctx, {}) as {
      syncEvents: number;
      failures: string[];
    };

    expect(r.syncEvents).toBe(2);
    expect(r.failures).toHaveLength(2);
  });
});
