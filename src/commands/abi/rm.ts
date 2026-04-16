import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";

defineCommand({
  name: "abi rm",
  description: "Remove an ABI entry by address",
  schema: z.object({ address: hexAddress }),
  handler: async (ctx, args) => ({
    address: args.address,
    removed: await ctx.abiRegistry.remove(args.address),
  }),
});
