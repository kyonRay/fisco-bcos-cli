import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createBcosRpcClient } from "../../../src/services/bcosRpc.js";

function silentLogger() {
  return { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
}

describe("BcosRpcClient", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  function mockFetch(sequence: Array<Response | Error>) {
    let i = 0;
    return vi.fn(async () => {
      const next = sequence[i++];
      if (next instanceof Error) throw next;
      return next!;
    });
  }

  it("sends JSON-RPC envelope with groupId prepended to params", async () => {
    const fetchMock = mockFetch([
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { number: "0xa" } })),
    ]);
    const c = createBcosRpcClient({
      url: "http://rpc/", groupId: "group0", fetch: fetchMock, logger: silentLogger(),
      retries: 0, timeoutMs: 1000,
    });
    const res = await c.call("getBlockNumber", []);
    expect(res).toEqual({ number: "0xa" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.method).toBe("getBlockNumber");
    expect(body.params[0]).toBe("group0");
  });

  it("surfaces JSON-RPC error as RPC_ERROR", async () => {
    const fetchMock = mockFetch([
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1,
        error: { code: -32000, message: "tx not found" } })),
    ]);
    const c = createBcosRpcClient({
      url: "http://rpc/", groupId: "group0", fetch: fetchMock, logger: silentLogger(),
      retries: 0, timeoutMs: 1000,
    });
    await expect(c.call("x", [])).rejects.toThrow();
  });

  it("retries on HTTP 5xx then succeeds", async () => {
    const fetchMock = mockFetch([
      new Response("err", { status: 503 }),
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: 7 })),
    ]);
    const c = createBcosRpcClient({
      url: "http://rpc/", groupId: "g", fetch: fetchMock, logger: silentLogger(),
      retries: 1, timeoutMs: 1000,
    });
    const p = c.call("x", []);
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails with RPC_UNREACHABLE after retries exhausted on network errors", async () => {
    const netErr = new Error("ECONNREFUSED");
    const fetchMock = mockFetch([netErr, netErr]);
    const c = createBcosRpcClient({
      url: "http://rpc/", groupId: "g", fetch: fetchMock, logger: silentLogger(),
      retries: 1, timeoutMs: 1000,
    });
    const p = c.call("x", []).catch((e) => e);
    await vi.advanceTimersByTimeAsync(500);
    const err = await p;
    expect(err.code).toBe("RPC_UNREACHABLE");
  });

  it("times out with RPC_TIMEOUT", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    const c = createBcosRpcClient({
      url: "http://rpc/", groupId: "g", fetch: fetchMock, logger: silentLogger(),
      retries: 0, timeoutMs: 100,
    });
    const p = c.call("x", []).catch((e) => e);
    await vi.advanceTimersByTimeAsync(200);
    const err = await p;
    expect(err.code).toBe("RPC_TIMEOUT");
  });
});
