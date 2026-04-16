import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexAddress } from "../validators.js";

defineCommand({
  name: "code",
  description: "Fetch contract bytecode",
  schema: z.object({ address: hexAddress }),
  handler: async (ctx, args) => ({
    address: args.address,
    code: await ctx.bcosRpc.call<string>("getCode", [args.address]),
  }),
});
