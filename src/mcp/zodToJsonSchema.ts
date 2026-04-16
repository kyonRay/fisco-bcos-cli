import { zodToJsonSchema } from "zod-to-json-schema";
import type { CommandDef } from "../commands/registry.js";

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export function commandToTool(cmd: CommandDef): McpToolDescriptor {
  const schema = zodToJsonSchema(cmd.schema, { target: "openApi3" }) as {
    type?: string; properties?: Record<string, unknown>; required?: string[];
  };
  return {
    name: cmd.name.replace(/\s+/g, "_"),
    description: cmd.description,
    inputSchema: {
      type: "object",
      properties: schema.properties ?? {},
      required: schema.required ?? [],
    },
  };
}
