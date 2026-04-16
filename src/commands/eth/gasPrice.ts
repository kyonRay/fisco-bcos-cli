import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "eth gas-price",
  description: "Gas price via Web3 RPC",
  schema: z.object({}),
  handler: async (ctx) => ({ gasPrice: (await ctx.web3Rpc.gasPrice()).toString() }),
});
