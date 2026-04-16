import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth call",
  description: "Read-only eth_call with raw data",
  schema: z.object({
    address: hexAddress,
    data: z.string().transform((s) => (s.startsWith("0x") ? s : "0x" + s) as Hex),
  }),
  handler: async (ctx, args) => ({
    result: await ctx.web3Rpc.call({ to: args.address as Hex, data: args.data }),
  }),
});
