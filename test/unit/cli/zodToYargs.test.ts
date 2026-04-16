import { describe, it, expect } from "vitest";
import { z } from "zod";
import { collectArgs } from "../../../src/cli/zodToYargs.js";

describe("collectArgs", () => {
  it("lists positional + optional fields from a flat object schema", () => {
    const schema = z.object({
      hash: z.string(),
      decode: z.boolean().default(true),
      name: z.string().optional(),
    });
    const info = collectArgs(schema);
    const byName = Object.fromEntries(info.map((i) => [i.name, i]));
    expect(byName.hash?.kind).toBe("string");
    expect(byName.decode?.kind).toBe("boolean");
    expect(byName.decode?.default).toBe(true);
    expect(byName.name?.optional).toBe(true);
  });

  it("supports z.array(z.string())", () => {
    const schema = z.object({ args: z.array(z.string()).default([]) });
    const info = collectArgs(schema);
    expect(info[0]!.kind).toBe("array");
  });
});
