import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexHash } from "../validators.js";
import { BcosCliError } from "../errors.js";

defineCommand({
  name: "receipt",
  description: "Fetch a transaction receipt",
  schema: z.object({ hash: hexHash }),
  handler: async (ctx, args) => {
    const r = await ctx.bcosRpc.call<unknown>("getTransactionReceipt", [args.hash]);
    if (!r) throw new BcosCliError("NOT_FOUND", `receipt ${args.hash} not found`);
    return { receipt: r };
  },
});
