import { describe, it, expect } from "vitest";
import { ChainProfileSchema, ConfigFileSchema } from "../../../src/config/schema.js";

describe("ChainProfileSchema", () => {
  it("requires bcosRpcUrl", () => {
    expect(() => ChainProfileSchema.parse({})).toThrow();
  });
  it("applies groupId default", () => {
    const p = ChainProfileSchema.parse({ bcosRpcUrl: "http://x" });
    expect(p.groupId).toBe("group0");
  });
  it("accepts full profile", () => {
    const p = ChainProfileSchema.parse({
      bcosRpcUrl: "http://x",
      web3RpcUrl: "http://y",
      groupId: "group1",
      chainId: 20200,
      logDir: "/log",
      requestTimeoutMs: 30000,
    });
    expect(p.chainId).toBe(20200);
  });
});

describe("ConfigFileSchema", () => {
  it("requires defaultChain and chains", () => {
    expect(() => ConfigFileSchema.parse({})).toThrow();
  });
  it("applies abiStoreDir default", () => {
    const c = ConfigFileSchema.parse({
      defaultChain: "local",
      chains: { local: { bcosRpcUrl: "http://x" } },
    });
    expect(c.abiStoreDir).toBe("~/.bcos-cli/abi");
  });
});
