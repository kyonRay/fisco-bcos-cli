import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexAddress } from "../validators.js";

defineCommand({
  name: "account",
  description: "Fetch account balance, nonce, and contract status",
  schema: z.object({ address: hexAddress }),
  handler: async (ctx, args) => {
    const [balanceRaw, codeRaw] = await Promise.all([
      ctx.bcosRpc.call<string>("getBalance", [args.address]).catch(() => "0x0"),
      ctx.bcosRpc.call<string>("getCode", [args.address]).catch(() => "0x"),
    ]);
    const isContract = !!codeRaw && codeRaw !== "0x";
    return {
      address: args.address,
      balance: BigInt(balanceRaw).toString(),
      isContract,
      codeSize: isContract ? (codeRaw.length - 2) / 2 : 0,
    };
  },
});
