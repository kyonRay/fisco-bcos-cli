import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAbiRegistry } from "../../../src/services/abiRegistry.js";

const SAMPLE_ABI = [{ type: "function", name: "transfer",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ type: "bool" }] }];

describe("AbiRegistry", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "abi-")); });

  it("add then list returns the entry", async () => {
    const r = createAbiRegistry({ storeDir: dir });
    await r.add("0xabc00000000000000000000000000000000000de", SAMPLE_ABI, "Token");
    const list = await r.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Token");
  });

  it("get is case-insensitive on address", async () => {
    const r = createAbiRegistry({ storeDir: dir });
    await r.add("0xabc00000000000000000000000000000000000de", SAMPLE_ABI);
    const entry = await r.get("0xABC00000000000000000000000000000000000DE");
    expect(entry?.abi).toEqual(SAMPLE_ABI);
  });

  it("returns null when missing", async () => {
    const r = createAbiRegistry({ storeDir: dir });
    expect(await r.get("0xabc00000000000000000000000000000000000de")).toBeNull();
  });

  it("remove drops entry and returns true", async () => {
    const r = createAbiRegistry({ storeDir: dir });
    await r.add("0xabc00000000000000000000000000000000000de", SAMPLE_ABI);
    expect(await r.remove("0xabc00000000000000000000000000000000000de")).toBe(true);
    expect(await r.get("0xabc00000000000000000000000000000000000de")).toBeNull();
  });

  it("persists across instances", async () => {
    const r1 = createAbiRegistry({ storeDir: dir });
    await r1.add("0xabc00000000000000000000000000000000000de", SAMPLE_ABI, "X");
    const r2 = createAbiRegistry({ storeDir: dir });
    expect((await r2.get("0xabc00000000000000000000000000000000000de"))?.name).toBe("X");
  });
});
