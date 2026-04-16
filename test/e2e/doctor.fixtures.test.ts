import { describe, it, expect } from "vitest";
import { execa } from "execa";
import { join } from "node:path";

const FIX = new URL("../fixtures/logs/", import.meta.url).pathname;

async function runDoctor(sub: string, scenario: string, extra: string[] = []): Promise<{ exitCode: number; stdout: string }> {
  const r = await execa("node", ["dist/cli/index.js", "doctor", sub,
    "--log-dir", join(FIX, scenario), "--rpc-url", "http://127.0.0.1:1", ...extra], {
    env: { ...process.env, BCOS_CLI_CONFIG: "/nonexistent" }, reject: false,
  });
  return { exitCode: r.exitCode, stdout: r.stdout };
}

describe("doctor against log fixtures", () => {
  it("slow-exec → bottleneck=execution", async () => {
    const r = await runDoctor("perf", "node0-3x-slow-exec", ["--since", "1000d"]);
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout);
    expect(env.data.bottleneck).toBe("execution");
  });

  it("consensus-timeout → viewchanges reported", async () => {
    const r = await runDoctor("health", "node0-3x-consensus-timeout");
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout);
    expect(env.data.viewchanges).toBeGreaterThanOrEqual(11);
    expect(env.data.findings.some((f: string) => /viewchange/i.test(f))).toBe(true);
  });

  it("sync-stall → sync events counted", async () => {
    const r = await runDoctor("sync", "node0-3x-sync-stall");
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout);
    expect(env.data.syncEvents).toBeGreaterThan(0);
    expect(env.data.failures.length).toBeGreaterThan(0);
  });
});
