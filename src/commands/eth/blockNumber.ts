import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "eth block-number",
  description: "Latest block number via Web3 RPC",
  schema: z.object({}),
  handler: async (ctx) => ({ blockNumber: (await ctx.web3Rpc.blockNumber()).toString() }),
});
