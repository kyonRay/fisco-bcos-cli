import { z } from "zod";
import { defineCommand } from "./registry.js";
import { blockTag } from "../validators.js";
import { BcosCliError } from "../errors.js";

const schema = z.object({
  block: blockTag,
  withTxs: z.boolean().default(false),
});

defineCommand({
  name: "block",
  description: "Fetch a block by number, tag, or hash",
  schema,
  handler: async (ctx, args) => {
    const method = args.block.kind === "hash" ? "getBlockByHash" : "getBlockByNumber";
    const result = await ctx.bcosRpc.call<unknown>(method, [args.block.value, args.withTxs]);
    if (!result) throw new BcosCliError("NOT_FOUND", `block ${args.block.value} not found`);
    return { block: result };
  },
});
