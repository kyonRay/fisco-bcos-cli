import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfigFile, expandHome } from "../../../src/config/load.js";
import { BcosCliError } from "../../../src/errors.js";

function tmp(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "bcos-cfg-"));
  const file = join(dir, "config.yaml");
  writeFileSync(file, content);
  return file;
}

describe("expandHome", () => {
  it("expands ~ to homeDir", () => {
    expect(expandHome("~/foo", "/home/u")).toBe("/home/u/foo");
  });
  it("leaves absolute paths", () => {
    expect(expandHome("/abs", "/home/u")).toBe("/abs");
  });
});

describe("loadConfigFile", () => {
  it("returns null when file missing", async () => {
    expect(await loadConfigFile("/nonexistent/xyz.yaml")).toBeNull();
  });

  it("parses YAML", async () => {
    const file = tmp(`
defaultChain: local
chains:
  local:
    bcosRpcUrl: http://127.0.0.1:20200
`);
    try {
      const cfg = await loadConfigFile(file);
      expect(cfg?.defaultChain).toBe("local");
      expect(cfg?.chains.local.bcosRpcUrl).toBe("http://127.0.0.1:20200");
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("throws INVALID_CONFIG on malformed YAML", async () => {
    const file = tmp("not: [valid");
    try {
      await expect(loadConfigFile(file)).rejects.toSatisfy(
        (err: unknown) => err instanceof BcosCliError && err.code === "INVALID_CONFIG",
      );
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("throws INVALID_CONFIG on schema failure", async () => {
    const file = tmp(`
defaultChain: local
chains:
  local: {}
`);
    try {
      await expect(loadConfigFile(file)).rejects.toSatisfy(
        (err: unknown) => err instanceof BcosCliError && err.code === "INVALID_CONFIG",
      );
    } finally {
      rmSync(file, { force: true });
    }
  });
});
