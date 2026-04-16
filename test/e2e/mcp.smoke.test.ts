import { describe, it, expect } from "vitest";
import { execa } from "execa";

describe("bcos mcp smoke", () => {
  it("responds to tools/list", async () => {
    const child = execa("node", ["dist/cli/index.js", "mcp"], {
      env: { ...process.env, BCOS_CLI_RPC_URL: "http://127.0.0.1:1", BCOS_CLI_CONFIG: "/nonexistent" },
      reject: false,
    });
    const w = (obj: unknown) => child.stdin!.write(JSON.stringify(obj) + "\n");

    const responses: unknown[] = [];
    const done = new Promise<void>((resolve) => {
      child.stdout!.on("data", (chunk: Buffer) => {
        for (const line of chunk.toString("utf8").split("\n")) {
          if (!line.trim()) continue;
          try { responses.push(JSON.parse(line)); } catch { /* ignore */ }
          if (responses.length >= 2) resolve();
        }
      });
    });

    w({ jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "0" } } });
    setTimeout(() => w({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }), 100);

    await Promise.race([done, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000))]);

    child.kill("SIGTERM");
    await child.catch(() => null);

    const toolsListResult = responses.find((r) =>
      (r as { id?: number }).id === 2) as { result?: { tools?: unknown[] } } | undefined;
    expect(toolsListResult?.result?.tools).toBeDefined();
    expect(Array.isArray(toolsListResult!.result!.tools)).toBe(true);
    expect(toolsListResult!.result!.tools!.length).toBeGreaterThan(10);
  });
});
