import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "doctor chain",
  description: "Whole-chain health check via RPC",
  schema: z.object({}),
  handler: async (ctx) => {
    const [sync, view, peers, sealers] = await Promise.all([
      ctx.bcosRpc.call<{ blockNumber?: string; knownLatestBlockNumber?: string; nodes?: unknown[] }>(
        "getSyncStatus", []).catch(() => null),
      ctx.bcosRpc.call<unknown>("getPbftView", []).catch(() => null),
      ctx.bcosRpc.call<unknown[]>("getPeers", []).catch(() => []),
      ctx.bcosRpc.call<unknown[]>("getSealerList", []).catch(() => []),
    ]);
    const findings: string[] = [];
    if (sync && sync.blockNumber && sync.knownLatestBlockNumber) {
      const local = BigInt(sync.blockNumber);
      const known = BigInt(sync.knownLatestBlockNumber);
      const gap = known - local;
      if (gap > 10n) findings.push(`node is ${gap.toString()} blocks behind network`);
    }
    if (Array.isArray(peers) && peers.length === 0) findings.push("no peers connected");
    if (Array.isArray(sealers) && sealers.length < 4) {
      findings.push(`only ${sealers.length} sealers — PBFT requires ≥4 for BFT safety`);
    }
    return { sync, view, peerCount: Array.isArray(peers) ? peers.length : 0,
      sealerCount: Array.isArray(sealers) ? sealers.length : 0, findings };
  },
});
