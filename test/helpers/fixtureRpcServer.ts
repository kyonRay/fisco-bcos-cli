import { createServer, type Server } from "node:http";
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";

export interface FixtureServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

const FIXTURE_ROOT = new URL("../fixtures/rpc/bcos/", import.meta.url).pathname;

export async function startFixtureRpcServer(): Promise<FixtureServer> {
  const server: Server = createServer((req, res) => {
    if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { method } = JSON.parse(body) as { method: string };
        const path = join(FIXTURE_ROOT, `${method}.json`);
        try { await access(path); }
        catch {
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ jsonrpc: "2.0", id: 0,
            error: { code: -32601, message: `no fixture for ${method}` } }));
          return;
        }
        const raw = await readFile(path, "utf8");
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(raw);
      } catch (err) {
        res.statusCode = 400;
        res.end((err as Error).message);
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("fixture server: unknown port");
  return {
    port: addr.port,
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
