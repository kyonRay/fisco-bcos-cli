import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import { createAbiRegistry } from "../../../src/services/abiRegistry.js";
import type { AppContext } from "../../../src/context.js";

function ctxWithRegistry(dir: string): AppContext {
  return {
    logger: { debug(){}, info(){}, warn(){}, error(){} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: {} as never, web3Rpc: {} as never,
    abiRegistry: createAbiRegistry({ storeDir: dir }),
    txDecoder: {} as never, logReader: {} as never,
  };
}

describe("abi add / show / list / rm", () => {
  let dir: string;
  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/abi/add.js");
    await import("../../../src/commands/abi/show.js");
    await import("../../../src/commands/abi/list.js");
    await import("../../../src/commands/abi/rm.js");
  });
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "abicmd-"));
  });

  it("add + show round-trip", async () => {
    const abiFile = join(dir, "abi.json");
    writeFileSync(abiFile, JSON.stringify([{ type: "function", name: "x", inputs: [] }]));
    const ctx = ctxWithRegistry(dir);
    await getCommand("abi add")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de",
      abiPath: abiFile, name: "X",
    });
    const shown = await getCommand("abi show")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de",
    }) as { entry: { name?: string } };
    expect(shown.entry.name).toBe("X");
  });

  it("rm returns removed: true", async () => {
    const abiFile = join(dir, "abi.json");
    writeFileSync(abiFile, JSON.stringify([]));
    const ctx = ctxWithRegistry(dir);
    await getCommand("abi add")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de", abiPath: abiFile,
    });
    const res = await getCommand("abi rm")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de",
    }) as { removed: boolean };
    expect(res.removed).toBe(true);
  });

  it("rejects non-JSON file", async () => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "not json");
    const ctx = ctxWithRegistry(dir);
    await expect(getCommand("abi add")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de", abiPath: bad,
    })).rejects.toThrow(/invalid JSON/i);
  });
});
