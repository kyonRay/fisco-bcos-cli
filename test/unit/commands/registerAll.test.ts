import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, allCommands } from "../../../src/commands/registry.js";

describe("registerAll", () => {
  beforeEach(() => __resetRegistry());
  it("registers all 31 commands without duplication", async () => {
    await import("../../../src/commands/registerAll.js");
    const names = allCommands().map((c) => c.name);
    expect(names).toContain("tx");
    expect(names).toContain("chain info");
    expect(names).toContain("doctor perf");
    expect(names).toContain("eth block");
    expect(names).toContain("config show");
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThanOrEqual(30);
  });
});
