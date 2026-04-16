import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa } from "execa";
import { startFixtureRpcServer, type FixtureServer } from "../helpers/fixtureRpcServer.js";

describe("bcos CLI smoke", () => {
  let fx: FixtureServer;
  beforeAll(async () => { fx = await startFixtureRpcServer(); });
  afterAll(async () => { await fx.close(); });

  it("config show returns JSON envelope on non-TTY", async () => {
    const r = await execa("node", ["dist/cli/index.js", "config", "show"], {
      env: { ...process.env, BCOS_CLI_RPC_URL: fx.url, BCOS_CLI_CONFIG: "/nonexistent" },
      reject: false,
    });
    expect(r.exitCode).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(true);
  });

  it("exits 2 on unknown chain", async () => {
    const r = await execa("node", ["dist/cli/index.js", "config", "show", "--chain", "zzz"], {
      env: { ...process.env, BCOS_CLI_CONFIG: "/nonexistent" },
      reject: false,
    });
    expect(r.exitCode).toBe(2);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toMatch(/CONFIG_MISSING|CHAIN_NOT_FOUND/);
  });
});
