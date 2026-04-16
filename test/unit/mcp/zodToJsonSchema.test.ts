import { describe, it, expect } from "vitest";
import { z } from "zod";
import { commandToTool } from "../../../src/mcp/zodToJsonSchema.js";

describe("commandToTool", () => {
  it("converts space-named command to underscore tool name", () => {
    const t = commandToTool({
      name: "doctor perf", description: "x",
      schema: z.object({ since: z.string().default("10m") }),
      handler: async () => null,
    });
    expect(t.name).toBe("doctor_perf");
    expect(t.inputSchema.type).toBe("object");
    expect(t.inputSchema.properties?.since).toBeDefined();
  });
});
