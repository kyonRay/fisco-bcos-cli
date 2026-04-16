import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "config list-chains",
  description: "List all profiles loaded from the config file",
  schema: z.object({}),
  handler: async (ctx) => ({
    defaultChain: ctx.fileConfig?.defaultChain,
    chains: ctx.fileConfig ? Object.keys(ctx.fileConfig.chains) : [],
  }),
});
