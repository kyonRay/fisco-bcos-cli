import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ChainInfo {
  bcosRpcUrl: string;
  web3RpcUrl: string;
  dataDir: string;
}

const BUILD_CHAIN_URL =
  "https://github.com/FISCO-BCOS/FISCO-BCOS/releases/download/v3.16.0/build_chain.sh";

let dataDir: string | null = null;

async function poll(url: string, body: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (res.ok) {
        const j = await res.json() as { result?: unknown };
        if (j.result !== undefined) return;
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("FISCO-BCOS node failed to start within timeout");
}

function run(cmd: string, args: string[], cwd: string): void {
  execFileSync(cmd, args, {
    cwd,
    stdio: process.env.DEBUG ? "inherit" : "pipe",
    timeout: 120000,
  });
}

export async function setupChain(): Promise<ChainInfo> {
  dataDir = mkdtempSync(join(tmpdir(), "bcos-test-"));

  run("curl", ["-LO", BUILD_CHAIN_URL], dataDir);
  run("bash", ["build_chain.sh", "-l", "127.0.0.1:1", "-p", "30300,20200,8545"], dataDir);

  const startScript = join(dataDir, "nodes/127.0.0.1/start_all.sh");
  if (!existsSync(startScript)) {
    throw new Error(`start_all.sh not found at ${startScript}`);
  }
  run("bash", [startScript], dataDir);

  await poll(
    "http://127.0.0.1:20200",
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBlockNumber", params: ["group0"] }),
    30000,
  );

  return {
    bcosRpcUrl: "http://127.0.0.1:20200",
    web3RpcUrl: "http://127.0.0.1:8545",
    dataDir,
  };
}

export async function teardownChain(): Promise<void> {
  if (!dataDir) return;
  try {
    const stopScript = join(dataDir, "nodes/127.0.0.1/stop_all.sh");
    if (existsSync(stopScript)) {
      run("bash", [stopScript], dataDir);
    }
  } catch { /* best effort */ }
  try {
    execFileSync("rm", ["-rf", dataDir], { stdio: "pipe" });
  } catch { /* best effort */ }
  dataDir = null;
}
