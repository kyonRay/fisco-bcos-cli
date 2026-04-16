import { z } from "zod";
import { defineCommand, getCommand } from "./registry.js";
import { hexAddress } from "../validators.js";
import type { Hex } from "viem";

interface EthLog { address: string; topics: string[]; data: string; blockNumber?: string; transactionHash?: string; }

export function register(): void {
  if (getCommand("event")) return;
  defineCommand({
    name: "event",
    description: "Query and decode contract event logs within a block range",
    schema: z.object({
      address: hexAddress,
      fromBlock: z.string(),
      toBlock: z.string(),
      name: z.string().optional(),
    }),
    handler: async (ctx, args) => {
      const logs = await ctx.bcosRpc.call<EthLog[]>("getLogs", [{
        address: args.address, fromBlock: args.fromBlock, toBlock: args.toBlock,
      }]);
      const decoded = await Promise.all(logs.map(async (log) => {
        const d = await ctx.txDecoder.decodeEvent({
          address: log.address, topics: log.topics as Hex[], data: log.data as Hex,
        }, ctx.abiRegistry);
        return { ...log, decoded: d };
      }));
      const filtered = args.name
        ? decoded.filter((l) => l.decoded.status === "ok" && l.decoded.eventName === args.name)
        : decoded;
      return {
        count: filtered.length,
        logs: filtered,
        degraded: filtered.some((l) => l.decoded.status !== "ok"),
      };
    },
  });
}

register();
