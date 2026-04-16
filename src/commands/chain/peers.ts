import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "peers",
  description: "List peer nodes and their status",
  schema: z.object({}),
  handler: async (ctx) => ({
    peers: await ctx.bcosRpc.call<unknown>("getPeers", []),
    groupPeers: await ctx.bcosRpc.call<unknown>("getGroupPeers", []).catch(() => null),
  }),
});
