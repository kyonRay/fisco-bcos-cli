import { describe, it, expect } from "vitest";
import { createWeb3RpcClient } from "../../../src/services/web3Rpc.js";
import { loadSeed } from "../../helpers/loadSeed.js";
import type { Hex } from "viem";

const skip = !process.env.BCOS_TEST_WEB3_URL;

describe.skipIf(skip)("web3Rpc against FISCO-BCOS", () => {
  const client = () => createWeb3RpcClient({ url: process.env.BCOS_TEST_WEB3_URL! });
  const seed = () => loadSeed("BCOS_TEST_SEED_FILE");

  it("blockNumber returns bigint >= seed end", async () => {
    expect(await client().blockNumber()).toBeGreaterThanOrEqual(BigInt(seed().blockRangeEnd));
  });

  it("chainId returns number > 0", async () => {
    expect(await client().chainId()).toBeGreaterThan(0);
  });

  it("gasPrice returns bigint >= 0n", async () => {
    expect(await client().gasPrice()).toBeGreaterThanOrEqual(0n);
  });

  it("getBlock with seed block", async () => {
    const block = await client().getBlock({ blockNumber: BigInt(seed().blockRangeEnd) });
    expect(block).toBeDefined();
  });

  it("getTransaction returns tx", async () => {
    const tx = await client().getTransaction(seed().erc20.transferTxHash as Hex) as { to?: string };
    expect(tx.to?.toLowerCase()).toBe(seed().erc20.address.toLowerCase());
  });

  it("getTransactionReceipt has logs", async () => {
    const receipt = await client().getTransactionReceipt(seed().erc20.transferTxHash as Hex) as { logs?: unknown[] };
    expect(receipt.logs).toBeDefined();
  });

  it("getLogs returns events", async () => {
    const logs = await client().getLogs({
      address: seed().erc20.address as Hex,
      fromBlock: BigInt(seed().blockRangeStart),
      toBlock: BigInt(seed().blockRangeEnd),
    }) as unknown[];
    expect(logs.length).toBeGreaterThan(0);
  });
});
