import { describe, it, expect, beforeAll } from "vitest";
import { createWeb3RpcClient } from "../../../src/services/web3Rpc.js";
import { createSilentLogger } from "../../../src/logger.js";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";
import { loadSeed } from "../../helpers/loadSeed.js";

const skip = !process.env.HARDHAT_TEST_URL;

describe.skipIf(skip)("eth commands against Hardhat", () => {
  let ctx: AppContext;

  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/registerAll.js");
    const web3Rpc = createWeb3RpcClient({ url: process.env.HARDHAT_TEST_URL! });
    ctx = {
      logger: createSilentLogger(),
      chain: { chainName: "hardhat-test", profile: { bcosRpcUrl: "unused", groupId: "group0" } as never },
      fileConfig: null,
      bcosRpc: {} as never,
      web3Rpc,
      abiRegistry: { add: async () => ({} as never), get: async () => null, list: async () => [], remove: async () => false },
      txDecoder: {
        decodeInput: async () => ({ status: "abi_not_found" as const }),
        decodeEvent: async () => ({ status: "abi_not_found" as const }),
      },
      logReader: {} as never,
    };
  });

  const seed = () => loadSeed("HARDHAT_TEST_SEED_FILE");

  it("eth block-number", async () => {
    const r = await getCommand("eth block-number")!.handler(ctx, {}) as { blockNumber: string };
    expect(Number(r.blockNumber)).toBeGreaterThanOrEqual(0);
  });

  it("eth chain-id returns 31337", async () => {
    const r = await getCommand("eth chain-id")!.handler(ctx, {}) as { chainId: number };
    expect(r.chainId).toBe(31337);
  });

  it("eth gas-price", async () => {
    const r = await getCommand("eth gas-price")!.handler(ctx, {}) as { gasPrice: string };
    expect(BigInt(r.gasPrice)).toBeGreaterThan(0n);
  });

  it("eth block", async () => {
    const r = await getCommand("eth block")!.handler(ctx, {
      block: { kind: "number", value: String(seed().blockRangeEnd) }, withTxs: false,
    }) as { block: unknown };
    expect(r.block).toBeDefined();
  });

  it("eth tx", async () => {
    const r = await getCommand("eth tx")!.handler(ctx, { hash: seed().erc20.transferTxHash }) as { tx: { to?: string } };
    expect(r.tx.to?.toLowerCase()).toBe(seed().erc20.address.toLowerCase());
  });

  it("eth receipt", async () => {
    const r = await getCommand("eth receipt")!.handler(ctx, { hash: seed().erc20.transferTxHash }) as { receipt: { logs?: unknown[] } };
    expect(r.receipt.logs!.length).toBeGreaterThan(0);
  });

  it("eth call balanceOf", async () => {
    const r = await getCommand("eth call")!.handler(ctx, {
      address: seed().erc20.address,
      data: "0x70a08231000000000000000000000000" + seed().account1.slice(2).toLowerCase(),
    }) as { result: string };
    expect(r.result).toBeDefined();
  });

  it("eth logs", async () => {
    const r = await getCommand("eth logs")!.handler(ctx, {
      fromBlock: String(seed().blockRangeStart),
      toBlock: String(seed().blockRangeEnd),
      address: seed().erc20.address,
    }) as { logs: unknown[] };
    expect(r.logs.length).toBeGreaterThan(0);
  });
});
