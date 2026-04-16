import { describe, it, expect, beforeAll } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("doctor health", () => {
  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/doctor/health.js");
  });

  it("counts fatals and adds findings", async () => {
    const lines = [
      "fatal|2099-01-01 00:00:01.000000|[PBFT] something went very wrong",
      "fatal|2099-01-01 00:00:02.000000|[PBFT] another fatal error",
      "error|2099-01-01 00:00:03.000000|[EXECUTOR] some error",
      "info|2099-01-01 00:00:04.000000|[SEALER] sealed block, height=42",
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

    const r = await getCommand("doctor health")!.handler(ctx, {}) as {
      fatals: number;
      errors: number;
      viewchanges: number;
      lastSealerHeight: number | undefined;
      sampleFatals: string[];
      findings: string[];
    };

    expect(r.fatals).toBe(2);
    expect(r.errors).toBe(1);
    expect(r.sampleFatals).toHaveLength(2);
    expect(r.findings.some(f => f.includes("2 fatal"))).toBe(true);
    // sealer height found — no halt finding
    expect(r.findings.some(f => f.includes("possible halt"))).toBe(false);
    expect(r.lastSealerHeight).toBe(42);
  });

  it("detects viewchange storm", async () => {
    const lines = Array.from({ length: 15 }, (_, i) =>
      `info|2099-01-01 00:00:0${i % 9}.000000|[PBFT] viewchange triggered, view=${i}`
    );
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

    const r = await getCommand("doctor health")!.handler(ctx, {}) as {
      viewchanges: number;
      findings: string[];
    };

    expect(r.viewchanges).toBe(15);
    expect(r.findings.some(f => f.includes("consensus instability"))).toBe(true);
  });
});
