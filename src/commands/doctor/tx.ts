import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexHash } from "../../validators.js";
import { BcosCliError } from "../../errors.js";
import type { Hex } from "viem";

interface Receipt {
  status?: string;
  output?: string;
  contractAddress?: string;
  logs?: unknown[];
  gasUsed?: string;
}

defineCommand({
  name: "doctor tx",
  description: "Diagnose why a transaction failed or is pending",
  schema: z.object({ hash: hexHash }),
  handler: async (ctx, args) => {
    const tx = await ctx.bcosRpc.call<{ to?: string; input?: string; nonce?: string; from?: string } | null>(
      "getTransactionByHash", [args.hash]);
    if (!tx) throw new BcosCliError("NOT_FOUND", `tx ${args.hash} not found`);
    const receipt = await ctx.bcosRpc.call<Receipt | null>("getTransactionReceipt", [args.hash]);

    const findings: string[] = [];
    if (!receipt) {
      findings.push("transaction has no receipt (still pending, dropped, or replaced)");
    } else {
      const status = receipt.status ?? "0x0";
      if (status !== "0x0" && status !== "0") {
        findings.push(`non-zero status code: ${status} — tx execution failed`);
      }
      if (receipt.output && receipt.output !== "0x" && tx.to) {
        const decoded = await ctx.txDecoder.decodeInput(tx.to, receipt.output as Hex, ctx.abiRegistry);
        if (decoded.status === "ok") findings.push(`decoded revert output: ${JSON.stringify(decoded)}`);
      }
    }

    return { tx, receipt, findings };
  },
});
