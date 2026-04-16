import { z } from "zod";
import { defineCommand } from "../registry.js";
import { blockTag } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth block",
  description: "Get block via Web3 RPC",
  schema: z.object({ block: blockTag, withTxs: z.boolean().default(false) }),
  handler: async (ctx, args) => {
    if (args.block.kind === "hash") {
      return { block: await ctx.web3Rpc.getBlock({
        blockHash: args.block.value as Hex, includeTransactions: args.withTxs,
      }) };
    }
    if (args.block.kind === "number") {
      return { block: await ctx.web3Rpc.getBlock({
        blockNumber: BigInt(args.block.value), includeTransactions: args.withTxs,
      }) };
    }
    return { block: await ctx.web3Rpc.getBlock({ includeTransactions: args.withTxs }) };
  },
});
