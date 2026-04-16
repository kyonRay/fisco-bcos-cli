import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import { buildContext } from "../../../src/buildContext.js";
import { createSilentLogger } from "../../../src/logger.js";
import { createAbiRegistry } from "../../../src/services/abiRegistry.js";
import type { AppContext } from "../../../src/context.js";
import { loadSeed } from "../../helpers/loadSeed.js";
import type { SeedResult } from "../../helpers/seedContracts.js";

const skip = !process.env.BCOS_TEST_RPC_URL;

describe.skipIf(skip)("commands against FISCO-BCOS", () => {
  let ctx: AppContext;
  let s: SeedResult;

  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/registerAll.js");
    s = loadSeed("BCOS_TEST_SEED_FILE");
    const abiDir = mkdtempSync(join(tmpdir(), "bcos-abi-test-"));
    ctx = buildContext({
      flags: { rpcUrl: process.env.BCOS_TEST_RPC_URL! },
      env: {},
      fileConfig: null,
      logger: createSilentLogger(),
      fetchImpl: globalThis.fetch,
    });
    ctx = { ...ctx, abiRegistry: createAbiRegistry({ storeDir: abiDir }) };
  });

  it("tx (ERC20 transfer) returns tx + receipt", async () => {
    const r = await getCommand("tx")!.handler(ctx, { hash: s.erc20.transferTxHash, decode: false }) as {
      tx: { hash: string }; receipt: unknown;
    };
    expect(r.tx.hash.toLowerCase()).toBe(s.erc20.transferTxHash.toLowerCase());
    expect(r.receipt).toBeDefined();
  });

  it("tx (ERC721 transferFrom)", async () => {
    const r = await getCommand("tx")!.handler(ctx, { hash: s.erc721.transferTxHash, decode: false }) as { tx: unknown };
    expect(r.tx).toBeDefined();
  });

  it("tx (ERC1155 safeTransferFrom)", async () => {
    const r = await getCommand("tx")!.handler(ctx, { hash: s.erc1155.transferTxHash, decode: false }) as { tx: unknown };
    expect(r.tx).toBeDefined();
  });

  it("tx (ERC4337 handleOps)", async () => {
    const r = await getCommand("tx")!.handler(ctx, { hash: s.erc4337.userOpTxHash, decode: false }) as { tx: unknown };
    expect(r.tx).toBeDefined();
  });

  it("block returns data", async () => {
    const r = await getCommand("block")!.handler(ctx, {
      block: { kind: "number", value: String(s.blockRangeEnd) }, withTxs: false,
    }) as { block: unknown };
    expect(r.block).toBeDefined();
  });

  it("receipt returns receipt", async () => {
    const r = await getCommand("receipt")!.handler(ctx, { hash: s.erc20.transferTxHash }) as { receipt: unknown };
    expect(r.receipt).toBeDefined();
  });

  it("account (ERC20) is contract", async () => {
    const r = await getCommand("account")!.handler(ctx, { address: s.erc20.address }) as {
      isContract: boolean; codeSize: number;
    };
    expect(r.isContract).toBe(true);
    expect(r.codeSize).toBeGreaterThan(0);
  });

  it("account (ERC721) is contract", async () => {
    const r = await getCommand("account")!.handler(ctx, { address: s.erc721.address }) as { isContract: boolean };
    expect(r.isContract).toBe(true);
  });

  it("code (ERC1155) returns bytecode", async () => {
    const r = await getCommand("code")!.handler(ctx, { address: s.erc1155.address }) as { code: string };
    expect(r.code.length).toBeGreaterThan(2);
  });

  it("call balanceOf (ERC20)", async () => {
    await ctx.abiRegistry.add(s.erc20.address, s.erc20.abi, "ERC20");
    const r = await getCommand("call")!.handler(ctx, {
      address: s.erc20.address, method: "balanceOf", args: [s.account1],
    }) as { decoded: unknown };
    expect(r.decoded).toBeDefined();
  });

  it("call ownerOf (ERC721)", async () => {
    await ctx.abiRegistry.add(s.erc721.address, s.erc721.abi, "ERC721");
    const r = await getCommand("call")!.handler(ctx, {
      address: s.erc721.address, method: "ownerOf", args: ["1"],
    }) as { decoded: unknown };
    expect(r.decoded).toBeDefined();
  });

  it("call balanceOf (ERC1155)", async () => {
    await ctx.abiRegistry.add(s.erc1155.address, s.erc1155.abi, "ERC1155");
    const r = await getCommand("call")!.handler(ctx, {
      address: s.erc1155.address, method: "balanceOf", args: [s.account2, "1"],
    }) as { decoded: unknown };
    expect(r.decoded).toBeDefined();
  });

  it("event (ERC20 Transfer)", async () => {
    const r = await getCommand("event")!.handler(ctx, {
      address: s.erc20.address,
      fromBlock: String(s.blockRangeStart),
      toBlock: String(s.blockRangeEnd),
    }) as { count: number };
    expect(r.count).toBeGreaterThan(0);
  });

  it("event (ERC721 Transfer filtered)", async () => {
    const r = await getCommand("event")!.handler(ctx, {
      address: s.erc721.address,
      fromBlock: String(s.blockRangeStart),
      toBlock: String(s.blockRangeEnd),
      name: "Transfer",
    }) as { logs: unknown[] };
    expect(r.logs.length).toBeGreaterThan(0);
  });

  it("event (ERC1155 TransferSingle)", async () => {
    const r = await getCommand("event")!.handler(ctx, {
      address: s.erc1155.address,
      fromBlock: String(s.blockRangeStart),
      toBlock: String(s.blockRangeEnd),
    }) as { count: number };
    expect(r.count).toBeGreaterThan(0);
  });

  it("chain info returns sync status", async () => {
    const r = await getCommand("chain info")!.handler(ctx, {}) as { syncStatus: unknown };
    expect(r.syncStatus).toBeDefined();
  });

  it("doctor chain returns findings", async () => {
    const r = await getCommand("doctor chain")!.handler(ctx, {}) as { findings: string[] };
    expect(Array.isArray(r.findings)).toBe(true);
  });

  it("abi add + tx decode = not degraded", async () => {
    await ctx.abiRegistry.add(s.erc20.address, s.erc20.abi, "ERC20");
    const r = await getCommand("tx")!.handler(ctx, {
      hash: s.erc20.transferTxHash, decode: true,
    }) as { degraded: boolean; decoded: { status: string } };
    expect(r.degraded).toBe(false);
    expect(r.decoded.status).toBe("ok");
  });
});
