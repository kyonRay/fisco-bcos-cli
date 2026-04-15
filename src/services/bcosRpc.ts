import { BcosCliError } from "../errors.js";
import type { AppLogger } from "../types.js";

export interface BcosRpcClient {
  call<T = unknown>(method: string, params: unknown[]): Promise<T>;
}

export interface CreateBcosRpcOpts {
  url: string;
  groupId: string;
  fetch: typeof fetch;
  logger: AppLogger;
  retries?: number;
  timeoutMs?: number;
}

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|EAI_AGAIN|fetch failed/i.test(err.message);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createBcosRpcClient(opts: CreateBcosRpcOpts): BcosRpcClient {
  const { url, groupId, fetch: f, logger } = opts;
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 10000;
  let reqId = 0;

  async function once(method: string, params: unknown[]): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new BcosCliError("RPC_TIMEOUT", `RPC ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const body = JSON.stringify({
        jsonrpc: "2.0", id: ++reqId, method, params: [groupId, ...params],
      });
      const fetchPromise = f(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body, signal: controller.signal,
      });
      const res = await Promise.race([fetchPromise, timeoutPromise]);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (RETRYABLE_STATUS.has(res.status)) {
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        throw new BcosCliError("RPC_ERROR", `HTTP ${res.status}`,
          { status: res.status, body: text.slice(0, 500) });
      }
      const payload = await res.json() as { result?: unknown; error?: { code: number; message: string } };
      if (payload.error) {
        throw new BcosCliError("RPC_ERROR", payload.error.message,
          { rpcCode: payload.error.code });
      }
      return payload.result;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new BcosCliError("RPC_TIMEOUT", `RPC ${method} timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async call<T>(method: string, params: unknown[]): Promise<T> {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await once(method, params) as T;
        } catch (err) {
          if (err instanceof BcosCliError && err.code !== "RPC_TIMEOUT") throw err;
          const retryable = isNetworkError(err) ||
            (err instanceof Error && /HTTP 5\d\d/.test(err.message)) ||
            (err instanceof BcosCliError && err.code === "RPC_TIMEOUT");
          if (!retryable || attempt === retries) {
            if (err instanceof BcosCliError) throw err;
            throw new BcosCliError("RPC_UNREACHABLE",
              `RPC ${method} failed after ${attempt + 1} attempts`,
              { message: (err as Error).message }, err);
          }
          const backoff = 200 * Math.pow(3, attempt);
          logger.warn(`rpc retry ${attempt + 1}/${retries}`, { method, backoff });
          await sleep(backoff);
        }
      }
      throw new BcosCliError("INTERNAL", "rpc retry loop fell through");
    },
  };
}
