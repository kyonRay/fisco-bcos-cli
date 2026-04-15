import { describe, it, expect } from "vitest";
import { createTxDecoder } from "../../../src/services/txDecoder.js";
import type { AbiRegistryService, AbiEntry } from "../../../src/services/abiRegistry.js";
import { encodeFunctionData, type Hex } from "viem";

const ERC20_ABI = [
  { type: "function", name: "transfer",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "event", name: "Transfer", inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false }] },
] as const;

function fakeRegistry(entries: AbiEntry[]): AbiRegistryService {
  const map = new Map(entries.map((e) => [e.address.toLowerCase(), e]));
  return {
    add: async () => { throw new Error("n/a"); },
    get: async (a) => map.get(a.toLowerCase()) ?? null,
    list: async () => [...map.values()],
    remove: async () => false,
  };
}

describe("TxDecoder.decodeInput", () => {
  it("decodes when ABI registered", async () => {
    const input = encodeFunctionData({
      abi: ERC20_ABI, functionName: "transfer",
      args: ["0x0000000000000000000000000000000000000001", 1000n],
    }) as Hex;
    const reg = fakeRegistry([{
      address: "0xabc00000000000000000000000000000000000de",
      abi: [...ERC20_ABI] as unknown[], savedAt: "now",
    }]);
    const d = createTxDecoder();
    const out = await d.decodeInput("0xabc00000000000000000000000000000000000de", input, reg);
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.functionName).toBe("transfer");
  });

  it("returns abi_not_found when no abi", async () => {
    const d = createTxDecoder();
    const out = await d.decodeInput(
      "0xabc00000000000000000000000000000000000de", "0xdeadbeef", fakeRegistry([]));
    expect(out.status).toBe("abi_not_found");
  });

  it("returns decode_failed on unknown selector", async () => {
    const reg = fakeRegistry([{
      address: "0xabc00000000000000000000000000000000000de",
      abi: [...ERC20_ABI] as unknown[], savedAt: "now",
    }]);
    const d = createTxDecoder();
    const out = await d.decodeInput(
      "0xabc00000000000000000000000000000000000de", "0xdeadbeef", reg);
    expect(out.status).toBe("decode_failed");
  });
});
