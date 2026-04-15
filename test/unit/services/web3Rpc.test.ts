import { describe, it, expect, vi } from "vitest";
import { createWeb3RpcClient } from "../../../src/services/web3Rpc.js";

describe("Web3RpcClient", () => {
  it("returns blockNumber as bigint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 0, result: "0xa" })));
    const c = createWeb3RpcClient({ url: "http://eth/", fetch: fetchMock });
    expect(await c.blockNumber()).toBe(10n);
  });

  it("chainId returns number", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 0, result: "0x2a" })));
    const c = createWeb3RpcClient({ url: "http://eth/", fetch: fetchMock });
    expect(await c.chainId()).toBe(42);
  });

  it("request() passes through method + params", async () => {
    const fetchMock = vi.fn(async (_u, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.method).toBe("eth_getBalance");
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 0, result: "0x64" }));
    });
    const c = createWeb3RpcClient({ url: "http://eth/", fetch: fetchMock });
    const r = await c.request({ method: "eth_getBalance",
      params: ["0x0000000000000000000000000000000000000001", "latest"] });
    expect(r).toBe("0x64");
  });
});
