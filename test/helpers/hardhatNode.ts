import { spawn, type ChildProcess } from "node:child_process";

export interface HardhatInfo {
  url: string;
  chainId: number;
  accounts: string[];
}

const HARDHAT_ACCOUNTS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
];

let child: ChildProcess | null = null;

async function poll(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      });
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Hardhat node failed to start within timeout");
}

export async function setupHardhat(): Promise<HardhatInfo> {
  child = spawn("npx", ["hardhat", "node", "--port", "8546"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
    detached: false,
  });

  child.stderr?.on("data", (d: Buffer) => {
    if (process.env.DEBUG) process.stderr.write(`[hardhat] ${d}`);
  });

  await poll("http://127.0.0.1:8546", 15000);

  return {
    url: "http://127.0.0.1:8546",
    chainId: 31337,
    accounts: HARDHAT_ACCOUNTS,
  };
}

export async function teardownHardhat(): Promise<void> {
  if (child) {
    child.kill("SIGTERM");
    await new Promise<void>((r) => {
      child!.on("exit", () => r());
      setTimeout(() => { child?.kill("SIGKILL"); r(); }, 3000);
    });
    child = null;
  }
}
