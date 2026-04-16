import { z } from "zod";
import { readFile } from "node:fs/promises";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";
import { BcosCliError } from "../../errors.js";

defineCommand({
  name: "abi add",
  description: "Register an ABI JSON file for a contract address",
  schema: z.object({
    address: hexAddress,
    abiPath: z.string(),
    name: z.string().optional(),
  }),
  handler: async (ctx, args) => {
    let raw: string;
    try {
      raw = await readFile(args.abiPath, "utf8");
    } catch (err) {
      throw new BcosCliError("FILE_IO_ERROR",
        `cannot read ${args.abiPath}`, {}, err);
    }
    let abi: unknown;
    try { abi = JSON.parse(raw); }
    catch (err) {
      throw new BcosCliError("INVALID_ARGUMENT", `invalid JSON in ${args.abiPath}`, {}, err);
    }
    const normalized = Array.isArray(abi)
      ? abi
      : Array.isArray((abi as { abi?: unknown }).abi)
        ? (abi as { abi: unknown[] }).abi
        : null;
    if (!normalized) {
      throw new BcosCliError("INVALID_ARGUMENT",
        "ABI must be an array or an object with an 'abi' array field");
    }
    const entry = await ctx.abiRegistry.add(args.address, normalized, args.name);
    return { stored: entry };
  },
});
