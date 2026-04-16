import { z } from "zod";
import { defineCommand, getCommand } from "./registry.js";
import { hexAddress } from "../validators.js";
import { BcosCliError } from "../errors.js";

interface BcosBlockWithTxs {
  number?: string;
  transactions?: Array<{ hash: string; from?: string; to?: string; [k: string]: unknown }>;
}

export function register(): void {
  if (getCommand("search tx")) return;
  defineCommand({
    name: "search tx",
    description: "Scan blocks for transactions matching from/to filters",
    schema: z.object({
      from: hexAddress.optional(),
      to: hexAddress.optional(),
      fromBlock: z.string(),
      toBlock: z.string(),
    }),
    handler: async (ctx, args) => {
      if (!args.from && !args.to) {
        throw new BcosCliError("INVALID_ARGUMENT", "at least one of --from or --to required");
      }
      const start = BigInt(args.fromBlock), end = BigInt(args.toBlock);
      if (end < start) throw new BcosCliError("INVALID_ARGUMENT", "toBlock < fromBlock");
      const matches: Array<{ block: string; tx: unknown }> = [];
      for (let i = start; i <= end; i++) {
        const blk = await ctx.bcosRpc.call<BcosBlockWithTxs | null>(
          "getBlockByNumber", ["0x" + i.toString(16), true]);
        if (!blk?.transactions) continue;
        for (const tx of blk.transactions) {
          const okFrom = !args.from || tx.from?.toLowerCase() === args.from.toLowerCase();
          const okTo = !args.to || tx.to?.toLowerCase() === args.to.toLowerCase();
          if (okFrom && okTo) matches.push({ block: i.toString(), tx });
        }
      }
      return { scanned: (end - start + 1n).toString(), matches };
    },
  });
}

register();
