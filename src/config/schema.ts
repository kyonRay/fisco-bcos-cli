import { z } from "zod";

export const ChainProfileSchema = z.object({
  bcosRpcUrl: z.string().url(),
  web3RpcUrl: z.string().url().optional(),
  groupId: z.string().default("group0"),
  chainId: z.number().int().optional(),
  logDir: z.string().optional(),
  requestTimeoutMs: z.number().int().positive().optional(),
  maxLogScanLines: z.number().int().positive().optional(),
});

export type ChainProfile = z.infer<typeof ChainProfileSchema>;

export const ChainProfilePartialSchema = ChainProfileSchema.partial();
export type ChainProfilePartial = z.infer<typeof ChainProfilePartialSchema>;

export const ConfigFileSchema = z.object({
  defaultChain: z.string(),
  defaults: ChainProfilePartialSchema.optional(),
  chains: z.record(z.string(), ChainProfileSchema),
  abiStoreDir: z.string().default("~/.bcos-cli/abi"),
});

export type ConfigFile = z.infer<typeof ConfigFileSchema>;
