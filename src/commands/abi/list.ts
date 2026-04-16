import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "abi list",
  description: "List all registered contract ABIs",
  schema: z.object({}),
  handler: async (ctx) => ({ entries: await ctx.abiRegistry.list() }),
});
