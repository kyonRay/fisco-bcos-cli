import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "config show",
  description: "Show the merged effective configuration for the current invocation",
  schema: z.object({}),
  handler: async (ctx) => ({
    chain: ctx.chain.chainName,
    profile: ctx.chain.profile,
    hasFileConfig: !!ctx.fileConfig,
  }),
});
