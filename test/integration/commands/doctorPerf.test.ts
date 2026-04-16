import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("doctor perf", () => {
  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/doctor/perf.js");
  });
  it("summarizes stages from lines", async () => {
    const lines = [
      "info|2099-01-01 00:00:00.000000|[EXECUTOR] x, costMs=30",
      "info|2099-01-01 00:00:00.000000|[EXECUTOR] x, costMs=200",
      "info|2099-01-01 00:00:00.000000|[STORAGE] x, costMs=5",
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
    const r = await getCommand("doctor perf")!.handler(ctx, { since: "1000d" }) as {
      bottleneck: string; stages: Record<string, { count: number }>;
    };
    expect(r.bottleneck).toBe("execution");
    expect(r.stages.execution?.count).toBe(2);
  });
});
