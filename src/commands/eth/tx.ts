import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexHash } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth tx",
  description: "Get transaction via Web3 RPC",
  schema: z.object({ hash: hexHash }),
  handler: async (ctx, args) => ({
    tx: await ctx.web3Rpc.getTransaction(args.hash as Hex),
  }),
});
