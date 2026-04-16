import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "group list",
  description: "List all groups on the connected node",
  schema: z.object({}),
  handler: async (ctx) => ({
    groups: await ctx.bcosRpc.call<string[]>("getGroupList", []),
  }),
});
