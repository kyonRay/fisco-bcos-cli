import { describe, it, expect } from "vitest";
import { resolveActiveChain } from "../../../src/config/resolve.js";
import type { ConfigFile } from "../../../src/config/schema.js";
import { BcosCliError } from "../../../src/errors.js";

const fileConfig: ConfigFile = {
  defaultChain: "local",
  defaults: { requestTimeoutMs: 10000 },
  chains: {
    local: { bcosRpcUrl: "http://127.0.0.1:20200", groupId: "group0" },
    prod: { bcosRpcUrl: "http://prod:20200", groupId: "group1", chainId: 20200,
      logDir: "/var/log/fisco", requestTimeoutMs: 30000 },
  },
  abiStoreDir: "~/.bcos-cli/abi",
};

describe("resolveActiveChain", () => {
  it("uses defaultChain when no override", () => {
    const r = resolveActiveChain({ flags: {}, env: {}, fileConfig });
    expect(r.chainName).toBe("local");
    expect(r.profile.bcosRpcUrl).toBe("http://127.0.0.1:20200");
    expect(r.profile.requestTimeoutMs).toBe(10000);
  });

  it("env overrides defaultChain", () => {
    const r = resolveActiveChain({ flags: {}, env: { BCOS_CLI_CHAIN: "prod" }, fileConfig });
    expect(r.chainName).toBe("prod");
  });

  it("flags beat env beat file", () => {
    const r = resolveActiveChain({
      flags: { chain: "local" },
      env: { BCOS_CLI_CHAIN: "prod" },
      fileConfig,
    });
    expect(r.chainName).toBe("local");
  });

  it("flag rpcUrl overrides profile", () => {
    const r = resolveActiveChain({
      flags: { rpcUrl: "http://flag/", chain: "prod" },
      env: {},
      fileConfig,
    });
    expect(r.profile.bcosRpcUrl).toBe("http://flag/");
  });

  it("env rpcUrl overrides profile", () => {
    const r = resolveActiveChain({
      flags: {},
      env: { BCOS_CLI_RPC_URL: "http://env/" },
      fileConfig,
    });
    expect(r.profile.bcosRpcUrl).toBe("http://env/");
  });

  it("throws CHAIN_NOT_FOUND for unknown chain", () => {
    try {
      resolveActiveChain({
        flags: { chain: "zzz" }, env: {}, fileConfig,
      });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(BcosCliError);
      expect((e as BcosCliError).code).toBe("CHAIN_NOT_FOUND");
    }
  });

  it("works with no fileConfig if flags supply bcosRpcUrl", () => {
    const r = resolveActiveChain({
      flags: { rpcUrl: "http://direct/" }, env: {}, fileConfig: null,
    });
    expect(r.profile.bcosRpcUrl).toBe("http://direct/");
    expect(r.chainName).toBe("(ad-hoc)");
  });

  it("throws CONFIG_MISSING if no source gives bcosRpcUrl", () => {
    try {
      resolveActiveChain({
        flags: {}, env: {}, fileConfig: null,
      });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(BcosCliError);
      expect((e as BcosCliError).code).toBe("CONFIG_MISSING");
    }
  });

  it("chain profile fields beat defaults", () => {
    const r = resolveActiveChain({ flags: { chain: "prod" }, env: {}, fileConfig });
    expect(r.profile.requestTimeoutMs).toBe(30000);
  });
});
