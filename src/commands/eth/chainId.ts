import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "eth chain-id",
  description: "Chain ID via Web3 RPC",
  schema: z.object({}),
  handler: async (ctx) => ({ chainId: await ctx.web3Rpc.chainId() }),
});
