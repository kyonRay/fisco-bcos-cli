import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AppContext } from "../../../src/context.js";
import type { Web3RpcClient } from "../../../src/services/web3Rpc.js";
import type { Hex } from "viem";

const HASH = ("0x" + "a".repeat(64)) as Hex;
const ADDR = ("0x" + "b".repeat(40)) as Hex;

function makeCtx(web3Rpc: Partial<Web3RpcClient>): AppContext {
  return {
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: {} as never,
    web3Rpc: web3Rpc as Web3RpcClient,
    abiRegistry: {
      add: async () => ({} as never),
      get: async () => null,
      list: async () => [],
      remove: async () => false,
    },
    txDecoder: {
      decodeInput: async () => ({ status: "abi_not_found" as const }),
      decodeEvent: async () => ({ status: "abi_not_found" as const }),
    },
    logReader: {} as never,
  };
}

describe("eth subtree handlers", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { __resetRegistry } = await import("../../../src/commands/registry.js");
    __resetRegistry();
    await import("../../../src/commands/eth/blockNumber.js");
    await import("../../../src/commands/eth/chainId.js");
    await import("../../../src/commands/eth/gasPrice.js");
    await import("../../../src/commands/eth/block.js");
    await import("../../../src/commands/eth/tx.js");
    await import("../../../src/commands/eth/receipt.js");
    await import("../../../src/commands/eth/call.js");
    await import("../../../src/commands/eth/logs.js");
  });

  it("eth block-number: returns blockNumber as string", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const ctx = makeCtx({ blockNumber: async () => 42n });
    const out = await getCommand("eth block-number")!.handler(ctx, {}) as { blockNumber: string };
    expect(out.blockNumber).toBe("42");
  });

  it("eth chain-id: returns chainId as number", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const ctx = makeCtx({ chainId: async () => 1 });
    const out = await getCommand("eth chain-id")!.handler(ctx, {}) as { chainId: number };
    expect(out.chainId).toBe(1);
  });

  it("eth gas-price: returns gasPrice as string", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const ctx = makeCtx({ gasPrice: async () => 1000000000n });
    const out = await getCommand("eth gas-price")!.handler(ctx, {}) as { gasPrice: string };
    expect(out.gasPrice).toBe("1000000000");
  });

  it("eth block: fetches by block number", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const fakeBlock = { number: "0xa", hash: HASH };
    const ctx = makeCtx({ getBlock: async () => fakeBlock });
    const out = await getCommand("eth block")!.handler(ctx, {
      block: { kind: "number", value: "10" },
      withTxs: false,
    }) as { block: unknown };
    expect(out.block).toEqual(fakeBlock);
  });

  it("eth block: fetches by block hash", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const fakeBlock = { number: "0x5", hash: HASH };
    const ctx = makeCtx({ getBlock: async () => fakeBlock });
    const out = await getCommand("eth block")!.handler(ctx, {
      block: { kind: "hash", value: HASH },
      withTxs: false,
    }) as { block: unknown };
    expect(out.block).toEqual(fakeBlock);
  });

  it("eth block: fetches latest (tag)", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const fakeBlock = { number: "0x64" };
    const ctx = makeCtx({ getBlock: async () => fakeBlock });
    const out = await getCommand("eth block")!.handler(ctx, {
      block: { kind: "tag", value: "latest" },
      withTxs: false,
    }) as { block: unknown };
    expect(out.block).toEqual(fakeBlock);
  });

  it("eth tx: returns transaction", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const fakeTx = { hash: HASH, from: ADDR };
    const ctx = makeCtx({ getTransaction: async () => fakeTx });
    const out = await getCommand("eth tx")!.handler(ctx, { hash: HASH }) as { tx: unknown };
    expect(out.tx).toEqual(fakeTx);
  });

  it("eth receipt: returns receipt", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const fakeReceipt = { status: "0x1", transactionHash: HASH };
    const ctx = makeCtx({ getTransactionReceipt: async () => fakeReceipt });
    const out = await getCommand("eth receipt")!.handler(ctx, { hash: HASH }) as { receipt: unknown };
    expect(out.receipt).toEqual(fakeReceipt);
  });

  it("eth call: returns call result", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const ctx = makeCtx({ call: async () => "0xdeadbeef" });
    const out = await getCommand("eth call")!.handler(ctx, {
      address: ADDR,
      data: "0x1234" as Hex,
    }) as { result: unknown };
    expect(out.result).toBe("0xdeadbeef");
  });

  it("eth logs: returns logs without filter", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const fakeLogs = [{ logIndex: "0x0" }];
    const ctx = makeCtx({ getLogs: async () => fakeLogs });
    const out = await getCommand("eth logs")!.handler(ctx, {
      fromBlock: "1",
      toBlock: "10",
    }) as { logs: unknown };
    expect(out.logs).toEqual(fakeLogs);
  });

  it("eth logs: returns logs with address and topic filters", async () => {
    const { getCommand } = await import("../../../src/commands/registry.js");
    const fakeLogs = [{ logIndex: "0x1", address: ADDR }];
    const ctx = makeCtx({ getLogs: async () => fakeLogs });
    const TOPIC = ("0x" + "c".repeat(64)) as Hex;
    const out = await getCommand("eth logs")!.handler(ctx, {
      fromBlock: "100",
      toBlock: "200",
      address: ADDR,
      topic: TOPIC,
    }) as { logs: unknown };
    expect(out.logs).toEqual(fakeLogs);
  });
});
