import { z } from "zod";
import { encodeFunctionData, decodeFunctionResult, type Abi, type Hex } from "viem";
import { defineCommand } from "./registry.js";
import { hexAddress } from "../validators.js";
import { BcosCliError } from "../errors.js";

defineCommand({
  name: "call",
  description: "Read-only call to a contract method using registered ABI",
  schema: z.object({
    address: hexAddress,
    method: z.string(),
    args: z.array(z.string()).default([]),
  }),
  handler: async (ctx, args) => {
    const entry = await ctx.abiRegistry.get(args.address);
    if (!entry) {
      throw new BcosCliError("ABI_NOT_FOUND",
        `no ABI registered for ${args.address}; run 'bcos abi add' first`);
    }
    let encoded: Hex;
    try {
      encoded = encodeFunctionData({
        abi: entry.abi as Abi, functionName: args.method, args: args.args,
      });
    } catch (err) {
      throw new BcosCliError("INVALID_ARGUMENT",
        `cannot encode call: ${(err as Error).message}`);
    }
    const raw = await ctx.bcosRpc.call<string>("call", [{ to: args.address, data: encoded }]);
    let decoded: unknown;
    try {
      decoded = decodeFunctionResult({
        abi: entry.abi as Abi, functionName: args.method, data: raw as Hex,
      });
    } catch (err) {
      return { raw, decoded: null, decodeError: (err as Error).message, degraded: true };
    }
    return { raw, decoded };
  },
});
