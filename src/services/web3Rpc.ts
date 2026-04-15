import type { Hex } from "viem";

export interface Web3RpcClient {
  blockNumber(): Promise<bigint>;
  chainId(): Promise<number>;
  gasPrice(): Promise<bigint>;
  getBlock(opts: { blockNumber?: bigint; blockHash?: Hex; includeTransactions?: boolean }): Promise<unknown>;
  getTransaction(hash: Hex): Promise<unknown>;
  getTransactionReceipt(hash: Hex): Promise<unknown>;
  call(opts: { to: Hex; data: Hex }): Promise<unknown>;
  getLogs(opts: { address?: Hex; fromBlock: bigint; toBlock: bigint; topics?: (Hex | null)[] }): Promise<unknown>;
  request<T = unknown>(args: { method: string; params: unknown[] }): Promise<T>;
}

export interface CreateWeb3RpcOpts {
  url: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function createWeb3RpcClient(opts: CreateWeb3RpcOpts): Web3RpcClient {
  const f = opts.fetch ?? fetch;
  let reqId = 0;

  async function rpc<T>(method: string, params: unknown[]): Promise<T> {
    const res = await f(opts.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++reqId, method, params }),
    });
    const j = await res.json() as { result?: T; error?: { code: number; message: string } };
    if (j.error) throw new Error(`${j.error.code}: ${j.error.message}`);
    return j.result as T;
  }

  function hex(n: bigint): string { return "0x" + n.toString(16); }

  return {
    async blockNumber() { return BigInt(await rpc<string>("eth_blockNumber", [])); },
    async chainId() { return Number(BigInt(await rpc<string>("eth_chainId", []))); },
    async gasPrice() { return BigInt(await rpc<string>("eth_gasPrice", [])); },
    async getBlock(o) {
      if (o.blockHash) return rpc("eth_getBlockByHash", [o.blockHash, !!o.includeTransactions]);
      const tag = o.blockNumber != null ? hex(o.blockNumber) : "latest";
      return rpc("eth_getBlockByNumber", [tag, !!o.includeTransactions]);
    },
    getTransaction(hash) { return rpc("eth_getTransactionByHash", [hash]); },
    getTransactionReceipt(hash) { return rpc("eth_getTransactionReceipt", [hash]); },
    call(o) { return rpc("eth_call", [{ to: o.to, data: o.data }, "latest"]); },
    getLogs(o) {
      return rpc("eth_getLogs", [{
        address: o.address, fromBlock: hex(o.fromBlock), toBlock: hex(o.toBlock), topics: o.topics,
      }]);
    },
    request(args) { return rpc(args.method, args.params); },
  };
}
