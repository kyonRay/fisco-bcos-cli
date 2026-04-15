import { decodeFunctionData, decodeEventLog, type Abi, type Hex } from "viem";
import type { AbiRegistryService } from "./abiRegistry.js";

export type DecodeInputResult =
  | { status: "ok"; functionName: string; args: readonly unknown[] }
  | { status: "abi_not_found" }
  | { status: "decode_failed"; reason: string };

export type DecodeEventResult =
  | { status: "ok"; eventName: string; args: Record<string, unknown> }
  | { status: "abi_not_found" }
  | { status: "decode_failed"; reason: string };

export interface TxDecoderService {
  decodeInput(address: string, input: Hex, registry: AbiRegistryService): Promise<DecodeInputResult>;
  decodeEvent(
    log: { address: string; topics: Hex[]; data: Hex }, registry: AbiRegistryService,
  ): Promise<DecodeEventResult>;
}

export function createTxDecoder(): TxDecoderService {
  return {
    async decodeInput(address, input, registry) {
      const entry = await registry.get(address);
      if (!entry) return { status: "abi_not_found" };
      if (!input || input === "0x") return { status: "decode_failed", reason: "empty input" };
      try {
        const result = decodeFunctionData({ abi: entry.abi as Abi, data: input });
        return { status: "ok", functionName: result.functionName, args: result.args ?? [] };
      } catch (err) {
        return { status: "decode_failed", reason: (err as Error).message };
      }
    },
    async decodeEvent(log, registry) {
      const entry = await registry.get(log.address);
      if (!entry) return { status: "abi_not_found" };
      try {
        const topics = log.topics as [Hex, ...Hex[]];
        const decoded = decodeEventLog({ abi: entry.abi as Abi, topics, data: log.data });
        const eventName = decoded.eventName as unknown as string;
        return { status: "ok", eventName,
          args: (decoded.args ?? {}) as Record<string, unknown> };
      } catch (err) {
        return { status: "decode_failed", reason: (err as Error).message };
      }
    },
  };
}
