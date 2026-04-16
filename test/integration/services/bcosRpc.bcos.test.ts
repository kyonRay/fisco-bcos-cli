import { describe, it, expect } from "vitest";
import { createBcosRpcClient } from "../../../src/services/bcosRpc.js";
import { createSilentLogger } from "../../../src/logger.js";
import { loadSeed } from "../../helpers/loadSeed.js";

const skip = !process.env.BCOS_TEST_RPC_URL;

describe.skipIf(skip)("bcosRpc against FISCO-BCOS", () => {
  const client = () => createBcosRpcClient({
    url: process.env.BCOS_TEST_RPC_URL!,
    groupId: "group0",
    fetch: globalThis.fetch,
    logger: createSilentLogger(),
    retries: 1,
    timeoutMs: 10000,
  });
  const seed = () => loadSeed("BCOS_TEST_SEED_FILE");

  it("getBlockNumber returns result", async () => {
    const result = await client().call<unknown>("getBlockNumber", []);
    expect(result).toBeDefined();
  });

  it("getSyncStatus returns object", async () => {
    const result = await client().call<unknown>("getSyncStatus", []);
    expect(result).toBeDefined();
  });

  it("getSealerList returns array", async () => {
    const result = await client().call<unknown[]>("getSealerList", []);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getGroupList contains group0", async () => {
    const result = await client().call<string[]>("getGroupList", []);
    expect(result).toContain("group0");
  });

  it("getBlockByNumber returns block", async () => {
    const block = await client().call<{ transactions?: unknown[] }>(
      "getBlockByNumber", [String(seed().blockRangeEnd), true],
    );
    expect(block).toBeDefined();
  });

  it("getTransactionByHash returns tx", async () => {
    const tx = await client().call<{ to?: string }>(
      "getTransactionByHash", [seed().erc20.transferTxHash],
    );
    expect(tx).toBeDefined();
    expect(tx.to?.toLowerCase()).toBe(seed().erc20.address.toLowerCase());
  });

  it("getTransactionReceipt returns receipt", async () => {
    const receipt = await client().call<{ status?: string }>(
      "getTransactionReceipt", [seed().erc20.transferTxHash],
    );
    expect(receipt).toBeDefined();
  });

  it("getTransactionByHash for nonexistent returns null", async () => {
    const result = await client().call<unknown>(
      "getTransactionByHash", ["0x" + "00".repeat(32)],
    );
    expect(result).toBeNull();
  });
});
