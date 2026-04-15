import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { defineCommand, allCommands, getCommand, __resetRegistry }
  from "../../../src/commands/registry.js";

describe("registry", () => {
  beforeEach(() => __resetRegistry());

  it("registers a command", () => {
    defineCommand({
      name: "foo",
      description: "foo cmd",
      schema: z.object({ x: z.string() }),
      handler: async () => ({ ok: true }),
    });
    expect(getCommand("foo")?.name).toBe("foo");
    expect(allCommands()).toHaveLength(1);
  });

  it("rejects duplicates", () => {
    defineCommand({ name: "a", description: "", schema: z.object({}), handler: async () => null });
    expect(() => defineCommand({
      name: "a", description: "", schema: z.object({}), handler: async () => null,
    })).toThrow(/duplicate/);
  });

  it("preserves insertion order", () => {
    defineCommand({ name: "a", description: "", schema: z.object({}), handler: async () => null });
    defineCommand({ name: "b", description: "", schema: z.object({}), handler: async () => null });
    defineCommand({ name: "c", description: "", schema: z.object({}), handler: async () => null });
    expect(allCommands().map((c) => c.name)).toEqual(["a", "b", "c"]);
  });

  it("getCommand returns undefined for missing", () => {
    expect(getCommand("missing")).toBeUndefined();
  });
});
