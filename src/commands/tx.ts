import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexHash } from "../validators.js";
import { BcosCliError } from "../errors.js";
import type { Hex } from "viem";

const schema = z.object({
  hash: hexHash,
  decode: z.boolean().default(true),
});

interface BcosTx { hash: string; to?: string; input?: string; [k: string]: unknown; }
interface BcosReceipt { status?: string; logs?: Array<{ address: string; topics: string[]; data: string }>; [k: string]: unknown; }

defineCommand({
  name: "tx",
  description: "Fetch BCOS transaction by hash with decoded input and events",
  schema,
  handler: async (ctx, args) => {
    const tx = await ctx.bcosRpc.call<BcosTx | null>("getTransactionByHash", [args.hash]);
    if (!tx) throw new BcosCliError("NOT_FOUND", `transaction ${args.hash} not found`);
    const receipt = await ctx.bcosRpc.call<BcosReceipt | null>("getTransactionReceipt", [args.hash]);

    let decoded: unknown = undefined;
    let degraded = false;
    if (args.decode && tx.to && tx.input) {
      const r = await ctx.txDecoder.decodeInput(tx.to, tx.input as Hex, ctx.abiRegistry);
      decoded = r;
      if (r.status !== "ok") degraded = true;
    }

    const decodedLogs = args.decode && receipt?.logs
      ? await Promise.all(receipt.logs.map(async (log) => ({
          ...log,
          decoded: await ctx.txDecoder.decodeEvent({
            address: log.address, topics: log.topics as Hex[], data: log.data as Hex,
          }, ctx.abiRegistry),
        })))
      : receipt?.logs;
    if ((decodedLogs as Array<{ decoded?: { status: string } }> | undefined)
      ?.some((l) => l.decoded && l.decoded.status !== "ok")) degraded = true;

    return { tx, receipt: receipt ? { ...receipt, logs: decodedLogs } : null, decoded, degraded };
  },
});
