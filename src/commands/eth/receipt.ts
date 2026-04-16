import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexHash } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth receipt",
  description: "Get transaction receipt via Web3 RPC",
  schema: z.object({ hash: hexHash }),
  handler: async (ctx, args) => ({
    receipt: await ctx.web3Rpc.getTransactionReceipt(args.hash as Hex),
  }),
});
