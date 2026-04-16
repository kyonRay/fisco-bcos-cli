import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";
import { BcosCliError } from "../../errors.js";

defineCommand({
  name: "abi show",
  description: "Show a registered ABI entry by address",
  schema: z.object({ address: hexAddress }),
  handler: async (ctx, args) => {
    const entry = await ctx.abiRegistry.get(args.address);
    if (!entry) throw new BcosCliError("ABI_NOT_FOUND",
      `no ABI registered for ${args.address}`);
    return { entry };
  },
});
