import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth logs",
  description: "eth_getLogs with optional address + single topic",
  schema: z.object({
    fromBlock: z.string(),
    toBlock: z.string(),
    address: hexAddress.optional(),
    topic: z.string().optional(),
  }),
  handler: async (ctx, args) => ({
    logs: await ctx.web3Rpc.getLogs({
      address: args.address as Hex | undefined,
      fromBlock: BigInt(args.fromBlock),
      toBlock: BigInt(args.toBlock),
      topics: args.topic ? [args.topic as Hex] : undefined,
    }),
  }),
});
