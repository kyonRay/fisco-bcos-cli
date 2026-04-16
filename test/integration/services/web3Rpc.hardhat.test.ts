import { describe, it, expect } from "vitest";
import { createWeb3RpcClient } from "../../../src/services/web3Rpc.js";
import { loadSeed } from "../../helpers/loadSeed.js";
import type { Hex } from "viem";

const skip = !process.env.HARDHAT_TEST_URL;

describe.skipIf(skip)("web3Rpc against Hardhat", () => {
  const client = () => createWeb3RpcClient({ url: process.env.HARDHAT_TEST_URL! });
  const seed = () => loadSeed("HARDHAT_TEST_SEED_FILE");

  it("blockNumber returns bigint >= 0n", async () => {
    expect(await client().blockNumber()).toBeGreaterThanOrEqual(0n);
  });

  it("chainId returns 31337", async () => {
    expect(await client().chainId()).toBe(31337);
  });

  it("gasPrice returns bigint > 0n", async () => {
    expect(await client().gasPrice()).toBeGreaterThan(0n);
  });

  it("getBlock with seed block", async () => {
    const block = await client().getBlock({ blockNumber: BigInt(seed().blockRangeEnd), includeTransactions: true });
    expect(block).toBeDefined();
  });

  it("getTransaction returns tx with correct to", async () => {
    const tx = await client().getTransaction(seed().erc20.transferTxHash as Hex) as { to?: string };
    expect(tx.to?.toLowerCase()).toBe(seed().erc20.address.toLowerCase());
  });

  it("getTransactionReceipt has logs", async () => {
    const receipt = await client().getTransactionReceipt(seed().erc20.transferTxHash as Hex) as { logs?: unknown[] };
    expect(receipt.logs!.length).toBeGreaterThan(0);
  });

  it("getLogs returns Transfer events", async () => {
    const logs = await client().getLogs({
      address: seed().erc20.address as Hex,
      fromBlock: BigInt(seed().blockRangeStart),
      toBlock: BigInt(seed().blockRangeEnd),
    }) as unknown[];
    expect(logs.length).toBeGreaterThan(0);
  });
});
