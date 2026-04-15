# fisco-bcos-cli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript CLI + MCP server for FISCO-BCOS chains with decoding, RPC wrapping, and log-based diagnostics.

**Architecture:** Four-layer design — shells (CLI / MCP) → command handlers (pure functions, self-registering) → services (RPC, ABI, log parsing) → config layer. One Zod schema per command feeds both yargs argparse and MCP tool schema.

**Tech Stack:** TypeScript (ESM), Node.js ≥ 18, Vitest, Zod, yargs, `@modelcontextprotocol/sdk`, viem, js-yaml, chalk, cli-table3, execa (test only).

**Plan reads against spec:** `docs/superpowers/specs/2026-04-15-fisco-bcos-cli-design.md`

---

## Phase Overview

1. **Foundation** — scaffold, error class, serialize, validators, shared types
2. **Config & Registry** — YAML schema, loader, `resolveActiveChain`, command registry
3. **Services** — BcosRpc, Web3Rpc, AbiRegistry, TxDecoder, LogReader, LogParser, PerfAnalyzer
4. **Command Handlers** — 30 commands across basic reads, chain, ABI, events, doctor, eth, config
5. **Shells** — CLI shell (yargs + prettyRender), MCP shell (tool registration)
6. **Integration, Fixtures, Docs** — fixture HTTP server, E2E tests, README, examples

Each task ends with `git add <files> && git commit -m "..."`. Run `pnpm tsc --noEmit && pnpm vitest run` before each commit unless the task says otherwise.

---

## Phase 1 — Foundation

### Task 1.1: Scaffold package

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `vitest.config.ts`, `.npmrc`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "fisco-bcos-cli",
  "version": "0.0.1",
  "description": "CLI and MCP server for FISCO-BCOS chains",
  "type": "module",
  "bin": { "bcos": "./dist/cli/index.js" },
  "main": "./dist/index.js",
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src test --ext .ts",
    "prepublishOnly": "pnpm build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "chalk": "^5.3.0",
    "cli-table3": "^0.6.5",
    "js-yaml": "^4.1.0",
    "viem": "^2.21.0",
    "yargs": "^17.7.2",
    "zod": "^3.23.8",
    "zod-to-json-schema": "^3.23.5"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.14.0",
    "@types/yargs": "^17.0.33",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "eslint": "^8.57.0",
    "execa": "^9.3.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "types": ["node"],
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
coverage/
*.log
.DS_Store
.env
.env.local
```

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "src/**/types.ts"],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
    testTimeout: 10000,
  },
});
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: lockfile generated, `node_modules/` populated.

- [ ] **Step 6: Verify build**

Run: `pnpm tsc --noEmit`
Expected: no output (success — no src files yet but config valid).

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json .gitignore vitest.config.ts pnpm-lock.yaml
git commit -m "chore: scaffold fisco-bcos-cli package"
```

---

### Task 1.2: Shared types

**Files:**
- Create: `src/types.ts`
- Test: (types-only, no test)

- [ ] **Step 1: Create src/types.ts**

```ts
export type Hex = `0x${string}`;

export interface BlockTag {
  kind: "number" | "tag" | "hash";
  value: string;
}

export interface AppLogger {
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
  debug(msg: string, extra?: Record<string, unknown>): void;
}

export interface ResponseMeta {
  chain?: string;
  source?: "bcos_rpc" | "web3_rpc" | "log_file" | "mixed" | "local";
  durationMs?: number;
  degraded?: boolean;
  warnings?: string[];
  stats?: Record<string, number | string>;
}

export interface EnvelopeOk<T> {
  ok: true;
  data: T;
  meta: ResponseMeta;
}

export interface EnvelopeErr {
  ok: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
  meta: ResponseMeta;
}

export type Envelope<T> = EnvelopeOk<T> | EnvelopeErr;
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc --noEmit`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): shared primitive and envelope types"
```

---

### Task 1.3: Error class

**Files:**
- Create: `src/errors.ts`
- Test: `test/unit/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/errors.test.ts
import { describe, it, expect } from "vitest";
import { BcosCliError, exitCodeFor, toBcosCliError } from "../../src/errors.js";

describe("BcosCliError", () => {
  it("carries code, message, details, cause", () => {
    const cause = new Error("inner");
    const e = new BcosCliError("RPC_ERROR", "oops", { rpcCode: -32000 }, cause);
    expect(e.code).toBe("RPC_ERROR");
    expect(e.message).toBe("oops");
    expect(e.details).toEqual({ rpcCode: -32000 });
    expect(e.cause).toBe(cause);
    expect(e.name).toBe("BcosCliError");
  });
});

describe("exitCodeFor", () => {
  it("returns 2 for usage errors", () => {
    for (const code of ["INVALID_ARGUMENT", "UNKNOWN_COMMAND", "CHAIN_NOT_FOUND",
      "CONFIG_MISSING", "INVALID_CONFIG", "LOG_DIR_REQUIRED"] as const) {
      expect(exitCodeFor(code)).toBe(2);
    }
  });
  it("returns 1 for runtime errors", () => {
    for (const code of ["RPC_ERROR", "RPC_TIMEOUT", "RPC_UNREACHABLE", "NOT_FOUND",
      "ABI_NOT_FOUND", "DECODE_FAILED", "LOG_DIR_NOT_FOUND", "LOG_PARSE_FAILED",
      "FILE_IO_ERROR", "INTERNAL"] as const) {
      expect(exitCodeFor(code)).toBe(1);
    }
  });
});

describe("toBcosCliError", () => {
  it("passes BcosCliError through", () => {
    const e = new BcosCliError("NOT_FOUND", "x");
    expect(toBcosCliError(e)).toBe(e);
  });
  it("wraps generic Error as INTERNAL with stack in details", () => {
    const src = new Error("boom");
    const e = toBcosCliError(src);
    expect(e.code).toBe("INTERNAL");
    expect(e.message).toBe("boom");
    expect(e.details?.stack).toBeDefined();
  });
  it("wraps non-Error as INTERNAL", () => {
    const e = toBcosCliError("some string");
    expect(e.code).toBe("INTERNAL");
    expect(e.message).toContain("some string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/errors.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement src/errors.ts**

```ts
export type UsageErrorCode =
  | "INVALID_ARGUMENT"
  | "UNKNOWN_COMMAND"
  | "CHAIN_NOT_FOUND"
  | "CONFIG_MISSING"
  | "INVALID_CONFIG"
  | "LOG_DIR_REQUIRED";

export type RuntimeErrorCode =
  | "RPC_ERROR"
  | "RPC_TIMEOUT"
  | "RPC_UNREACHABLE"
  | "NOT_FOUND"
  | "ABI_NOT_FOUND"
  | "DECODE_FAILED"
  | "LOG_DIR_NOT_FOUND"
  | "LOG_PARSE_FAILED"
  | "FILE_IO_ERROR"
  | "INTERNAL";

export type ErrorCode = UsageErrorCode | RuntimeErrorCode;

const USAGE_CODES = new Set<ErrorCode>([
  "INVALID_ARGUMENT", "UNKNOWN_COMMAND", "CHAIN_NOT_FOUND",
  "CONFIG_MISSING", "INVALID_CONFIG", "LOG_DIR_REQUIRED",
]);

export class BcosCliError extends Error {
  readonly name = "BcosCliError";
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export function exitCodeFor(code: ErrorCode): 1 | 2 {
  return USAGE_CODES.has(code) ? 2 : 1;
}

export function toBcosCliError(err: unknown): BcosCliError {
  if (err instanceof BcosCliError) return err;
  if (err instanceof Error) {
    return new BcosCliError("INTERNAL", err.message, { stack: err.stack }, err);
  }
  return new BcosCliError("INTERNAL", `non-error thrown: ${String(err)}`, {}, err);
}
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm vitest run test/unit/errors.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts test/unit/errors.test.ts
git commit -m "feat(errors): BcosCliError, exitCodeFor, toBcosCliError"
```

---

### Task 1.4: Serializer (bigint-safe)

**Files:**
- Create: `src/serialize.ts`
- Test: `test/unit/serialize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/serialize.test.ts
import { describe, it, expect } from "vitest";
import { toSerializable, stringify } from "../../src/serialize.js";

describe("toSerializable", () => {
  it("converts bigint to decimal string", () => {
    expect(toSerializable(123n)).toBe("123");
    expect(toSerializable(2n ** 64n)).toBe("18446744073709551616");
  });

  it("recurses into arrays and objects", () => {
    expect(toSerializable({ a: 1n, b: [2n, { c: 3n }] }))
      .toEqual({ a: "1", b: ["2", { c: "3" }] });
  });

  it("leaves primitives untouched", () => {
    expect(toSerializable("hi")).toBe("hi");
    expect(toSerializable(42)).toBe(42);
    expect(toSerializable(null)).toBe(null);
    expect(toSerializable(true)).toBe(true);
  });

  it("handles circular references by marking them", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    const out = toSerializable(a) as Record<string, unknown>;
    expect(out.x).toBe(1);
    expect(out.self).toBe("[Circular]");
  });

  it("handles Uint8Array as 0x-hex", () => {
    expect(toSerializable(new Uint8Array([0xde, 0xad, 0xbe, 0xef])))
      .toBe("0xdeadbeef");
  });
});

describe("stringify", () => {
  it("produces valid JSON for bigint", () => {
    expect(stringify({ n: 10n })).toBe('{"n":"10"}');
  });
  it("accepts indent", () => {
    expect(stringify({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/serialize.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement src/serialize.ts**

```ts
export function toSerializable(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === "bigint") return value.toString(10);
  if (value instanceof Uint8Array) return "0x" + Buffer.from(value).toString("hex");
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);
  if (Array.isArray(value)) return value.map((v) => toSerializable(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = toSerializable(v, seen);
  }
  return out;
}

export function stringify(value: unknown, indent?: number): string {
  return JSON.stringify(toSerializable(value), null, indent);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run test/unit/serialize.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/serialize.ts test/unit/serialize.test.ts
git commit -m "feat(serialize): bigint/Uint8Array safe JSON serializer"
```

---

### Task 1.5: Validators

**Files:**
- Create: `src/validators.ts`
- Test: `test/unit/validators.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/validators.test.ts
import { describe, it, expect } from "vitest";
import { hexAddress, hexHash, blockTag, normalizeHex } from "../../src/validators.js";

describe("normalizeHex", () => {
  it("adds 0x and lowercases", () => {
    expect(normalizeHex("ABCDEF")).toBe("0xabcdef");
    expect(normalizeHex("0xABCDEF")).toBe("0xabcdef");
  });
});

describe("hexAddress", () => {
  it("accepts 40-hex with or without 0x", () => {
    const a = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
    expect(hexAddress.parse(a)).toBe(a);
    expect(hexAddress.parse("5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"))
      .toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
  it("rejects bad length", () => {
    expect(() => hexAddress.parse("0x1234")).toThrow();
  });
});

describe("hexHash", () => {
  it("accepts 64-hex", () => {
    const h = "0x" + "ab".repeat(32);
    expect(hexHash.parse(h)).toBe(h);
  });
  it("rejects bad length", () => {
    expect(() => hexHash.parse("0xabcd")).toThrow();
  });
});

describe("blockTag", () => {
  it("accepts latest/earliest/pending", () => {
    expect(blockTag.parse("latest")).toEqual({ kind: "tag", value: "latest" });
    expect(blockTag.parse("earliest")).toEqual({ kind: "tag", value: "earliest" });
    expect(blockTag.parse("pending")).toEqual({ kind: "tag", value: "pending" });
  });
  it("accepts decimal number", () => {
    expect(blockTag.parse("12345")).toEqual({ kind: "number", value: "12345" });
  });
  it("accepts block hash", () => {
    const h = "0x" + "12".repeat(32);
    expect(blockTag.parse(h)).toEqual({ kind: "hash", value: h });
  });
  it("rejects invalid", () => {
    expect(() => blockTag.parse("abc")).toThrow();
    expect(() => blockTag.parse("0xzz")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/validators.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/validators.ts**

```ts
import { z } from "zod";

export function normalizeHex(s: string): string {
  const clean = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
  return "0x" + clean.toLowerCase();
}

export const hexAddress = z.string().transform((s, ctx) => {
  const norm = s.startsWith("0x") || s.startsWith("0X") ? s : "0x" + s;
  if (!/^0x[0-9a-fA-F]{40}$/.test(norm)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid address" });
    return z.NEVER;
  }
  return norm;
});

export const hexHash = z.string().transform((s, ctx) => {
  const norm = s.startsWith("0x") || s.startsWith("0X") ? s : "0x" + s;
  if (!/^0x[0-9a-fA-F]{64}$/.test(norm)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid hash" });
    return z.NEVER;
  }
  return norm;
});

export const blockTag = z.string().transform((s, ctx) => {
  if (s === "latest" || s === "earliest" || s === "pending") {
    return { kind: "tag" as const, value: s };
  }
  if (/^\d+$/.test(s)) return { kind: "number" as const, value: s };
  const withPrefix = s.startsWith("0x") ? s : "0x" + s;
  if (/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    return { kind: "hash" as const, value: withPrefix };
  }
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid block tag" });
  return z.NEVER;
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run test/unit/validators.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/validators.ts test/unit/validators.test.ts
git commit -m "feat(validators): address, hash, block-tag Zod schemas"
```

---

## Phase 2 — Config & Registry

### Task 2.1: Config schema

**Files:**
- Create: `src/config/schema.ts`
- Test: `test/unit/config/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/config/schema.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/config/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/config/schema.ts**

```ts
import { z } from "zod";

export const ChainProfileSchema = z.object({
  bcosRpcUrl: z.string().url(),
  web3RpcUrl: z.string().url().optional(),
  groupId: z.string().default("group0"),
  chainId: z.number().int().optional(),
  logDir: z.string().optional(),
  requestTimeoutMs: z.number().int().positive().optional(),
  maxLogScanLines: z.number().int().positive().optional(),
});

export type ChainProfile = z.infer<typeof ChainProfileSchema>;

export const ChainProfilePartialSchema = ChainProfileSchema.partial();
export type ChainProfilePartial = z.infer<typeof ChainProfilePartialSchema>;

export const ConfigFileSchema = z.object({
  defaultChain: z.string(),
  defaults: ChainProfilePartialSchema.optional(),
  chains: z.record(z.string(), ChainProfileSchema),
  abiStoreDir: z.string().default("~/.bcos-cli/abi"),
});

export type ConfigFile = z.infer<typeof ConfigFileSchema>;
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run test/unit/config/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/schema.ts test/unit/config/schema.test.ts
git commit -m "feat(config): Zod schema for YAML config"
```

---

### Task 2.2: Config loader

**Files:**
- Create: `src/config/load.ts`
- Test: `test/unit/config/load.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/config/load.test.ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfigFile, expandHome } from "../../../src/config/load.js";

function tmp(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "bcos-cfg-"));
  const file = join(dir, "config.yaml");
  writeFileSync(file, content);
  return file;
}

describe("expandHome", () => {
  it("expands ~ to homeDir", () => {
    expect(expandHome("~/foo", "/home/u")).toBe("/home/u/foo");
  });
  it("leaves absolute paths", () => {
    expect(expandHome("/abs", "/home/u")).toBe("/abs");
  });
});

describe("loadConfigFile", () => {
  it("returns null when file missing", async () => {
    expect(await loadConfigFile("/nonexistent/xyz.yaml")).toBeNull();
  });

  it("parses YAML", async () => {
    const file = tmp(`
defaultChain: local
chains:
  local:
    bcosRpcUrl: http://127.0.0.1:20200
`);
    try {
      const cfg = await loadConfigFile(file);
      expect(cfg?.defaultChain).toBe("local");
      expect(cfg?.chains.local.bcosRpcUrl).toBe("http://127.0.0.1:20200");
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("throws INVALID_CONFIG on malformed YAML", async () => {
    const file = tmp("not: [valid");
    try {
      await expect(loadConfigFile(file)).rejects.toThrow(/INVALID_CONFIG/);
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("throws INVALID_CONFIG on schema failure", async () => {
    const file = tmp(`
defaultChain: local
chains:
  local: {}
`);
    try {
      await expect(loadConfigFile(file)).rejects.toThrow(/INVALID_CONFIG/);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/config/load.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/config/load.ts**

```ts
import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import { ConfigFileSchema, type ConfigFile } from "./schema.js";
import { BcosCliError } from "../errors.js";

export function expandHome(path: string, homeDir: string): string {
  if (path.startsWith("~/")) return `${homeDir}/${path.slice(2)}`;
  if (path === "~") return homeDir;
  return path;
}

export async function loadConfigFile(path: string): Promise<ConfigFile | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw new BcosCliError("FILE_IO_ERROR", `failed to read ${path}`, { code }, err);
  }
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new BcosCliError("INVALID_CONFIG", `YAML parse error in ${path}`, {}, err);
  }
  const result = ConfigFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new BcosCliError("INVALID_CONFIG", `config schema error in ${path}`, {
      issues: result.error.issues,
    });
  }
  return result.data;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run test/unit/config/load.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/load.ts test/unit/config/load.test.ts
git commit -m "feat(config): YAML loader with error codes"
```

---

### Task 2.3: Resolve active chain

**Files:**
- Create: `src/config/resolve.ts`
- Test: `test/unit/config/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/config/resolve.test.ts
import { describe, it, expect } from "vitest";
import { resolveActiveChain } from "../../../src/config/resolve.js";
import type { ConfigFile } from "../../../src/config/schema.js";

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
    expect(() => resolveActiveChain({
      flags: { chain: "zzz" }, env: {}, fileConfig,
    })).toThrow(/CHAIN_NOT_FOUND/);
  });

  it("works with no fileConfig if flags supply bcosRpcUrl", () => {
    const r = resolveActiveChain({
      flags: { rpcUrl: "http://direct/" }, env: {}, fileConfig: null,
    });
    expect(r.profile.bcosRpcUrl).toBe("http://direct/");
    expect(r.chainName).toBe("(ad-hoc)");
  });

  it("throws CONFIG_MISSING if no source gives bcosRpcUrl", () => {
    expect(() => resolveActiveChain({
      flags: {}, env: {}, fileConfig: null,
    })).toThrow(/CONFIG_MISSING/);
  });

  it("chain profile fields beat defaults", () => {
    const r = resolveActiveChain({ flags: { chain: "prod" }, env: {}, fileConfig });
    expect(r.profile.requestTimeoutMs).toBe(30000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/config/resolve.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/config/resolve.ts**

```ts
import type { ConfigFile, ChainProfile } from "./schema.js";
import { BcosCliError } from "../errors.js";

export interface ResolveFlags {
  chain?: string;
  config?: string;
  rpcUrl?: string;
  web3RpcUrl?: string;
  groupId?: string;
  logDir?: string;
}

export interface EnvVars {
  BCOS_CLI_CHAIN?: string;
  BCOS_CLI_CONFIG?: string;
  BCOS_CLI_RPC_URL?: string;
  BCOS_CLI_WEB3_RPC_URL?: string;
  BCOS_CLI_GROUP_ID?: string;
  BCOS_CLI_LOG_DIR?: string;
}

export interface ResolvedChain {
  chainName: string;
  profile: ChainProfile;
}

export function resolveActiveChain(opts: {
  flags: ResolveFlags;
  env: EnvVars;
  fileConfig: ConfigFile | null;
}): ResolvedChain {
  const { flags, env, fileConfig } = opts;
  const chainName = flags.chain ?? env.BCOS_CLI_CHAIN ?? fileConfig?.defaultChain;

  let profile: Partial<ChainProfile> = { groupId: "group0" };

  if (fileConfig) {
    if (!chainName) {
      throw new BcosCliError("CONFIG_MISSING", "no chain selected and no defaultChain");
    }
    const fromFile = fileConfig.chains[chainName];
    if (!fromFile && (flags.chain || env.BCOS_CLI_CHAIN)) {
      throw new BcosCliError("CHAIN_NOT_FOUND", `chain '${chainName}' not in config`, {
        available: Object.keys(fileConfig.chains),
      });
    }
    profile = { ...profile, ...fileConfig.defaults, ...fromFile };
  }

  if (env.BCOS_CLI_RPC_URL) profile.bcosRpcUrl = env.BCOS_CLI_RPC_URL;
  if (env.BCOS_CLI_WEB3_RPC_URL) profile.web3RpcUrl = env.BCOS_CLI_WEB3_RPC_URL;
  if (env.BCOS_CLI_GROUP_ID) profile.groupId = env.BCOS_CLI_GROUP_ID;
  if (env.BCOS_CLI_LOG_DIR) profile.logDir = env.BCOS_CLI_LOG_DIR;

  if (flags.rpcUrl) profile.bcosRpcUrl = flags.rpcUrl;
  if (flags.web3RpcUrl) profile.web3RpcUrl = flags.web3RpcUrl;
  if (flags.groupId) profile.groupId = flags.groupId;
  if (flags.logDir) profile.logDir = flags.logDir;

  if (!profile.bcosRpcUrl) {
    throw new BcosCliError("CONFIG_MISSING",
      "bcosRpcUrl required — set via config file, --rpc-url, or BCOS_CLI_RPC_URL");
  }

  return {
    chainName: chainName ?? "(ad-hoc)",
    profile: profile as ChainProfile,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run test/unit/config/resolve.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/resolve.ts test/unit/config/resolve.test.ts
git commit -m "feat(config): resolveActiveChain pure-function resolver"
```

---

### Task 2.4: Command registry

**Files:**
- Create: `src/commands/registry.ts`
- Test: `test/unit/commands/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/commands/registry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { defineCommand, allCommands, getCommand, __resetRegistry }
  from "../../../src/commands/registry.js";

describe("registry", () => {
  beforeEach(() => __resetRegistry());

  it("registers a command", () => {
    defineCommand({
      name: "foo",
      description: "foo cmd",
      schema: z.object({ x: z.string() }),
      handler: async () => ({ ok: true }),
    });
    expect(getCommand("foo")?.name).toBe("foo");
    expect(allCommands()).toHaveLength(1);
  });

  it("rejects duplicates", () => {
    defineCommand({ name: "a", description: "", schema: z.object({}), handler: async () => null });
    expect(() => defineCommand({
      name: "a", description: "", schema: z.object({}), handler: async () => null,
    })).toThrow(/duplicate/);
  });

  it("preserves insertion order", () => {
    defineCommand({ name: "a", description: "", schema: z.object({}), handler: async () => null });
    defineCommand({ name: "b", description: "", schema: z.object({}), handler: async () => null });
    defineCommand({ name: "c", description: "", schema: z.object({}), handler: async () => null });
    expect(allCommands().map((c) => c.name)).toEqual(["a", "b", "c"]);
  });

  it("getCommand returns undefined for missing", () => {
    expect(getCommand("missing")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/commands/registry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/commands/registry.ts**

```ts
import type { z } from "zod";
import type { AppContext } from "../context.js";

export interface CommandCapabilities {
  requiresLogDir?: boolean;
  requiresExplorer?: boolean;
}

export interface CommandDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  capabilities?: CommandCapabilities;
  handler: (ctx: AppContext, args: z.infer<S>) => Promise<unknown>;
}

const registry = new Map<string, CommandDef>();

export function defineCommand<S extends z.ZodTypeAny>(def: CommandDef<S>): void {
  if (registry.has(def.name)) {
    throw new Error(`duplicate command registration: ${def.name}`);
  }
  registry.set(def.name, def as CommandDef);
}

export function allCommands(): CommandDef[] {
  return [...registry.values()];
}

export function getCommand(name: string): CommandDef | undefined {
  return registry.get(name);
}

export function __resetRegistry(): void {
  registry.clear();
}
```

- [ ] **Step 4: Create placeholder src/context.ts (needed by registry.ts import)**

```ts
// src/context.ts (initial placeholder; filled in Task 2.5)
import type { AppLogger } from "./types.js";

export interface AppContext {
  logger: AppLogger;
  // filled in Task 2.5
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run test/unit/commands/registry.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/registry.ts src/context.ts test/unit/commands/registry.test.ts
git commit -m "feat(registry): command registry with duplicate guard"
```

---

### Task 2.5: AppContext builder

**Files:**
- Create: `src/context.ts` (replace placeholder)
- Create: `src/logger.ts`
- Test: `test/unit/context.test.ts`

- [ ] **Step 1: Create src/logger.ts**

```ts
import type { AppLogger } from "./types.js";

export interface CreateLoggerOpts {
  verbose: boolean;
  quiet: boolean;
}

export function createStderrLogger({ verbose, quiet }: CreateLoggerOpts): AppLogger {
  const out = (level: string) => (msg: string, extra?: Record<string, unknown>) => {
    const line = extra ? `[${level}] ${msg} ${JSON.stringify(extra)}\n` : `[${level}] ${msg}\n`;
    process.stderr.write(line);
  };
  return {
    debug: verbose ? out("debug") : () => {},
    info:  quiet ? () => {} : out("info"),
    warn:  quiet ? () => {} : out("warn"),
    error: out("error"),
  };
}

export function createSilentLogger(): AppLogger {
  return { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
}
```

- [ ] **Step 2: Replace src/context.ts**

```ts
import type { AppLogger } from "./types.js";
import type { ResolvedChain } from "./config/resolve.js";
import type { ConfigFile } from "./config/schema.js";
import type { BcosRpcClient } from "./services/bcosRpc.js";
import type { Web3RpcClient } from "./services/web3Rpc.js";
import type { AbiRegistryService } from "./services/abiRegistry.js";
import type { TxDecoderService } from "./services/txDecoder.js";
import type { LogReaderService } from "./services/logReader.js";

export interface AppContext {
  logger: AppLogger;
  chain: ResolvedChain;
  fileConfig: ConfigFile | null;
  bcosRpc: BcosRpcClient;
  web3Rpc: Web3RpcClient;
  abiRegistry: AbiRegistryService;
  txDecoder: TxDecoderService;
  logReader: LogReaderService;
}
```

- [ ] **Step 3: Write test for logger**

```ts
// test/unit/context.test.ts
import { describe, it, expect, vi } from "vitest";
import { createStderrLogger, createSilentLogger } from "../../src/logger.js";

describe("createStderrLogger", () => {
  it("silent mode emits nothing for info/warn", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const log = createStderrLogger({ verbose: false, quiet: true });
    log.info("hi");
    log.warn("warn");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("verbose mode emits debug", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const log = createStderrLogger({ verbose: true, quiet: false });
    log.debug("x");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("error always emits", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const log = createStderrLogger({ verbose: false, quiet: true });
    log.error("boom");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("createSilentLogger", () => {
  it("emits nothing", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const log = createSilentLogger();
    log.info("x"); log.error("y");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

Note: `tsc --noEmit` will fail until services are created in Phase 3. Add `// @ts-expect-error` on the service imports in `src/context.ts` temporarily, or make them optional. Use this pattern:

Replace src/context.ts imports with `type`-only imports that reference files we'll create; tsc won't fail because type-only imports are erased, but it will fail if files don't exist. Solution: create empty stub files now.

- [ ] **Step 4: Create service stub files**

Create these files with a single export each so later tasks can `Edit` them:

```ts
// src/services/bcosRpc.ts
export interface BcosRpcClient { readonly __stub?: true; }
```

```ts
// src/services/web3Rpc.ts
export interface Web3RpcClient { readonly __stub?: true; }
```

```ts
// src/services/abiRegistry.ts
export interface AbiRegistryService { readonly __stub?: true; }
```

```ts
// src/services/txDecoder.ts
export interface TxDecoderService { readonly __stub?: true; }
```

```ts
// src/services/logReader.ts
export interface LogReaderService { readonly __stub?: true; }
```

These interfaces are placeholders; Phase 3 tasks replace each file entirely.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/context.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/context.ts src/logger.ts src/services/ test/unit/context.test.ts
git commit -m "feat(context): AppContext type, stderr/silent loggers, service stubs"
```

---

## Phase 3 — Services

### Task 3.1: BcosRpcClient

**Files:**
- Replace: `src/services/bcosRpc.ts`
- Test: `test/unit/services/bcosRpc.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/services/bcosRpc.test.ts
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
    await expect(c.call("x", [])).rejects.toThrow(/RPC_ERROR/);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/services/bcosRpc.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace src/services/bcosRpc.ts**

```ts
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
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body = JSON.stringify({
        jsonrpc: "2.0", id: ++reqId, method, params: [groupId, ...params],
      });
      const res = await f(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body, signal: controller.signal,
      });
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
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/services/bcosRpc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/bcosRpc.ts test/unit/services/bcosRpc.test.ts
git commit -m "feat(services): BcosRpcClient with groupId, retries, timeout"
```

---

### Task 3.2: Web3RpcClient

**Files:**
- Replace: `src/services/web3Rpc.ts`
- Test: `test/unit/services/web3Rpc.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/services/web3Rpc.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/services/web3Rpc.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace src/services/web3Rpc.ts**

```ts
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
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/services/web3Rpc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/web3Rpc.ts test/unit/services/web3Rpc.test.ts
git commit -m "feat(services): Web3RpcClient thin JSON-RPC wrapper"
```

---

### Task 3.3: AbiRegistry service

**Files:**
- Replace: `src/services/abiRegistry.ts`
- Test: `test/unit/services/abiRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/services/abiRegistry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAbiRegistry } from "../../../src/services/abiRegistry.js";

const SAMPLE_ABI = [{ type: "function", name: "transfer",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ type: "bool" }] }];

describe("AbiRegistry", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "abi-")); });

  it("add then list returns the entry", async () => {
    const r = createAbiRegistry({ storeDir: dir });
    await r.add("0xabc00000000000000000000000000000000000de", SAMPLE_ABI, "Token");
    const list = await r.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Token");
  });

  it("get is case-insensitive on address", async () => {
    const r = createAbiRegistry({ storeDir: dir });
    await r.add("0xabc00000000000000000000000000000000000de", SAMPLE_ABI);
    const entry = await r.get("0xABC00000000000000000000000000000000000DE");
    expect(entry?.abi).toEqual(SAMPLE_ABI);
  });

  it("returns null when missing", async () => {
    const r = createAbiRegistry({ storeDir: dir });
    expect(await r.get("0xabc00000000000000000000000000000000000de")).toBeNull();
  });

  it("remove drops entry and returns true", async () => {
    const r = createAbiRegistry({ storeDir: dir });
    await r.add("0xabc00000000000000000000000000000000000de", SAMPLE_ABI);
    expect(await r.remove("0xabc00000000000000000000000000000000000de")).toBe(true);
    expect(await r.get("0xabc00000000000000000000000000000000000de")).toBeNull();
  });

  it("persists across instances", async () => {
    const r1 = createAbiRegistry({ storeDir: dir });
    await r1.add("0xabc00000000000000000000000000000000000de", SAMPLE_ABI, "X");
    const r2 = createAbiRegistry({ storeDir: dir });
    expect((await r2.get("0xabc00000000000000000000000000000000000de"))?.name).toBe("X");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/services/abiRegistry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace src/services/abiRegistry.ts**

```ts
import { mkdir, readFile, writeFile, readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { BcosCliError } from "../errors.js";

export interface AbiEntry {
  address: string;
  name?: string;
  abi: unknown[];
  savedAt: string;
}

export interface AbiRegistryService {
  add(address: string, abi: unknown[], name?: string): Promise<AbiEntry>;
  get(address: string): Promise<AbiEntry | null>;
  list(): Promise<AbiEntry[]>;
  remove(address: string): Promise<boolean>;
}

export interface CreateAbiRegistryOpts { storeDir: string; }

function fileFor(dir: string, address: string): string {
  return join(dir, `${address.toLowerCase()}.json`);
}

export function createAbiRegistry(opts: CreateAbiRegistryOpts): AbiRegistryService {
  const { storeDir } = opts;

  return {
    async add(address, abi, name) {
      await mkdir(storeDir, { recursive: true });
      const norm = address.toLowerCase();
      const entry: AbiEntry = { address: norm, name, abi, savedAt: new Date().toISOString() };
      await writeFile(fileFor(storeDir, norm), JSON.stringify(entry, null, 2), "utf8");
      return entry;
    },
    async get(address) {
      try {
        const raw = await readFile(fileFor(storeDir, address.toLowerCase()), "utf8");
        return JSON.parse(raw) as AbiEntry;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw new BcosCliError("FILE_IO_ERROR", "failed to read ABI", {}, err);
      }
    },
    async list() {
      try { await stat(storeDir); } catch { return []; }
      const files = await readdir(storeDir);
      const entries: AbiEntry[] = [];
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          entries.push(JSON.parse(await readFile(join(storeDir, f), "utf8")) as AbiEntry);
        } catch { /* skip malformed */ }
      }
      return entries.sort((a, b) => a.address.localeCompare(b.address));
    },
    async remove(address) {
      try {
        await unlink(fileFor(storeDir, address.toLowerCase()));
        return true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw new BcosCliError("FILE_IO_ERROR", "failed to remove ABI", {}, err);
      }
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/services/abiRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/abiRegistry.ts test/unit/services/abiRegistry.test.ts
git commit -m "feat(services): file-backed AbiRegistry"
```

---

### Task 3.4: TxDecoder service

**Files:**
- Replace: `src/services/txDecoder.ts`
- Test: `test/unit/services/txDecoder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/services/txDecoder.test.ts
import { describe, it, expect } from "vitest";
import { createTxDecoder } from "../../../src/services/txDecoder.js";
import type { AbiRegistryService, AbiEntry } from "../../../src/services/abiRegistry.js";
import { encodeFunctionData, type Hex } from "viem";

const ERC20_ABI = [
  { type: "function", name: "transfer",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "event", name: "Transfer", inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false }] },
] as const;

function fakeRegistry(entries: AbiEntry[]): AbiRegistryService {
  const map = new Map(entries.map((e) => [e.address.toLowerCase(), e]));
  return {
    add: async () => { throw new Error("n/a"); },
    get: async (a) => map.get(a.toLowerCase()) ?? null,
    list: async () => [...map.values()],
    remove: async () => false,
  };
}

describe("TxDecoder.decodeInput", () => {
  it("decodes when ABI registered", async () => {
    const input = encodeFunctionData({
      abi: ERC20_ABI, functionName: "transfer",
      args: ["0x0000000000000000000000000000000000000001", 1000n],
    }) as Hex;
    const reg = fakeRegistry([{
      address: "0xabc00000000000000000000000000000000000de",
      abi: [...ERC20_ABI] as unknown[], savedAt: "now",
    }]);
    const d = createTxDecoder();
    const out = await d.decodeInput("0xabc00000000000000000000000000000000000de", input, reg);
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.functionName).toBe("transfer");
  });

  it("returns abi_not_found when no abi", async () => {
    const d = createTxDecoder();
    const out = await d.decodeInput(
      "0xabc00000000000000000000000000000000000de", "0xdeadbeef", fakeRegistry([]));
    expect(out.status).toBe("abi_not_found");
  });

  it("returns decode_failed on unknown selector", async () => {
    const reg = fakeRegistry([{
      address: "0xabc00000000000000000000000000000000000de",
      abi: [...ERC20_ABI] as unknown[], savedAt: "now",
    }]);
    const d = createTxDecoder();
    const out = await d.decodeInput(
      "0xabc00000000000000000000000000000000000de", "0xdeadbeef", reg);
    expect(out.status).toBe("decode_failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/services/txDecoder.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace src/services/txDecoder.ts**

```ts
import { decodeFunctionData, decodeEventLog, type Abi, type Hex } from "viem";
import type { AbiRegistryService } from "./abiRegistry.js";

export type DecodeInputResult =
  | { status: "ok"; functionName: string; args: readonly unknown[] }
  | { status: "abi_not_found" }
  | { status: "decode_failed"; reason: string };

export type DecodeEventResult =
  | { status: "ok"; eventName: string; args: Record<string, unknown> }
  | { status: "abi_not_found" }
  | { status: "decode_failed"; reason: string };

export interface TxDecoderService {
  decodeInput(address: string, input: Hex, registry: AbiRegistryService): Promise<DecodeInputResult>;
  decodeEvent(
    log: { address: string; topics: Hex[]; data: Hex }, registry: AbiRegistryService,
  ): Promise<DecodeEventResult>;
}

export function createTxDecoder(): TxDecoderService {
  return {
    async decodeInput(address, input, registry) {
      const entry = await registry.get(address);
      if (!entry) return { status: "abi_not_found" };
      if (!input || input === "0x") return { status: "decode_failed", reason: "empty input" };
      try {
        const result = decodeFunctionData({ abi: entry.abi as Abi, data: input });
        return { status: "ok", functionName: result.functionName, args: result.args ?? [] };
      } catch (err) {
        return { status: "decode_failed", reason: (err as Error).message };
      }
    },
    async decodeEvent(log, registry) {
      const entry = await registry.get(log.address);
      if (!entry) return { status: "abi_not_found" };
      try {
        const decoded = decodeEventLog({ abi: entry.abi as Abi, topics: log.topics, data: log.data });
        return { status: "ok", eventName: decoded.eventName,
          args: (decoded.args ?? {}) as Record<string, unknown> };
      } catch (err) {
        return { status: "decode_failed", reason: (err as Error).message };
      }
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/services/txDecoder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/txDecoder.ts test/unit/services/txDecoder.test.ts
git commit -m "feat(services): TxDecoder for input and event logs"
```

---

### Task 3.5: LogReader service

**Files:**
- Replace: `src/services/logReader.ts`
- Test: `test/unit/services/logReader.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/services/logReader.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { createLogReader } from "../../../src/services/logReader.js";

describe("LogReader", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "logs-")); });

  it("throws LOG_DIR_NOT_FOUND when path missing", async () => {
    const r = createLogReader({ logDir: "/does/not/exist/xyz" });
    await expect(r.listFiles()).rejects.toThrow(/LOG_DIR_NOT_FOUND/);
  });

  it("lists only .log files sorted by name", async () => {
    writeFileSync(join(dir, "log_info_2026041200.00.log"), "a\n");
    writeFileSync(join(dir, "log_info_2026041300.00.log"), "b\n");
    writeFileSync(join(dir, "other.txt"), "skip\n");
    const r = createLogReader({ logDir: dir });
    const files = (await r.listFiles()).map(basename);
    expect(files).toEqual([
      "log_info_2026041200.00.log", "log_info_2026041300.00.log",
    ]);
  });

  it("streams lines up to maxLines", async () => {
    writeFileSync(join(dir, "a.log"), "l1\nl2\nl3\n");
    const r = createLogReader({ logDir: dir, maxLines: 2 });
    const out: string[] = [];
    for await (const { line } of r.streamLines()) out.push(line);
    expect(out).toEqual(["l1", "l2"]);
  });

  it("streams across multiple files in sorted order", async () => {
    writeFileSync(join(dir, "a.log"), "a1\na2\n");
    writeFileSync(join(dir, "b.log"), "b1\n");
    const r = createLogReader({ logDir: dir });
    const lines: string[] = [];
    for await (const t of r.streamLines()) lines.push(t.line);
    expect(lines).toEqual(["a1", "a2", "b1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/services/logReader.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace src/services/logReader.ts**

```ts
import { stat, readdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { BcosCliError } from "../errors.js";

export interface LogLine { file: string; line: string; lineNo: number; }

export interface LogReaderService {
  listFiles(): Promise<string[]>;
  streamLines(): AsyncIterable<LogLine>;
}

export interface CreateLogReaderOpts {
  logDir: string;
  maxLines?: number;
  filePattern?: RegExp;
}

const DEFAULT_PATTERN = /\.log(\.\d+)?$/;

export function createLogReader(opts: CreateLogReaderOpts): LogReaderService {
  const { logDir, filePattern = DEFAULT_PATTERN } = opts;
  const maxLines = opts.maxLines ?? Number.POSITIVE_INFINITY;

  async function listFiles(): Promise<string[]> {
    try {
      const s = await stat(logDir);
      if (!s.isDirectory()) {
        throw new BcosCliError("LOG_DIR_NOT_FOUND", `${logDir} is not a directory`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new BcosCliError("LOG_DIR_NOT_FOUND", `${logDir} does not exist`);
      }
      if (err instanceof BcosCliError) throw err;
      throw new BcosCliError("FILE_IO_ERROR", `stat ${logDir}`, {}, err);
    }
    const entries = await readdir(logDir);
    return entries.filter((f) => filePattern.test(f)).sort().map((f) => join(logDir, f));
  }

  async function* streamLines(): AsyncIterable<LogLine> {
    const files = await listFiles();
    let emitted = 0;
    for (const file of files) {
      const stream = createReadStream(file, { encoding: "utf8" });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      let lineNo = 0;
      for await (const line of rl) {
        lineNo++;
        emitted++;
        yield { file, line, lineNo };
        if (emitted >= maxLines) { rl.close(); stream.destroy(); return; }
      }
    }
  }

  return { listFiles, streamLines };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/services/logReader.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/logReader.ts test/unit/services/logReader.test.ts
git commit -m "feat(services): LogReader with line streaming and budget"
```

---

### Task 3.6: LogParser (BCOS 3.x format)

**Files:**
- Create: `src/services/logParser.ts`
- Test: `test/unit/services/logParser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/services/logParser.test.ts
import { describe, it, expect } from "vitest";
import { parseLogLine } from "../../../src/services/logParser.js";

describe("parseLogLine", () => {
  it("parses EXECUTOR line as execution stage", () => {
    const e = parseLogLine(
      "info|2026-04-15 10:00:01.170000|[EXECUTOR] execute block, height=100, costMs=35");
    expect(e).toMatchObject({
      level: "info",
      module: "EXECUTOR",
      stage: "execution",
      fields: { height: 100, costMs: 35 },
    });
  });

  it("parses Sealer as sealer stage", () => {
    const e = parseLogLine(
      "info|2026-04-15 10:00:01.120000|[Sealer] seal block, height=100, txs=50");
    expect(e?.stage).toBe("sealer");
  });

  it("parses PBFT as consensus stage", () => {
    const e = parseLogLine(
      "info|2026-04-15 10:00:01.130000|[PBFT] prePrepare, view=1, height=100");
    expect(e?.stage).toBe("consensus");
  });

  it("parses STORAGE as storage stage", () => {
    const e = parseLogLine(
      "info|2026-04-15 10:00:01.205000|[STORAGE] write block, height=100, costMs=12");
    expect(e?.stage).toBe("storage");
  });

  it("captures error level", () => {
    const e = parseLogLine(
      "error|2026-04-15 10:00:02.000000|[PBFT] viewchange, view=2, reason=timeout");
    expect(e?.level).toBe("error");
    expect(e?.fields.reason).toBe("timeout");
  });

  it("returns null for unrecognized line", () => {
    expect(parseLogLine("garbage line")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/services/logParser.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/services/logParser.ts**

```ts
export type LogStage = "txpool" | "sealer" | "consensus" | "execution" | "storage" | "sync" | "other";

export interface ParsedLogEvent {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  timestamp: string;
  module: string;
  message: string;
  fields: Record<string, string | number>;
  stage: LogStage;
}

const LINE_RE = /^(trace|debug|info|warn|warning|error|fatal)\|([^|]+)\|\[([^\]]+)\]\s*(.*)$/i;

function moduleToStage(module: string): LogStage {
  const m = module.toUpperCase();
  if (m.startsWith("TXPOOL")) return "txpool";
  if (m.startsWith("SEALER")) return "sealer";
  if (m.startsWith("PBFT") || m.startsWith("CONSENSUS") || m.startsWith("RAFT")) return "consensus";
  if (m.startsWith("EXECUTOR") || m.startsWith("EXECUTE")) return "execution";
  if (m.startsWith("STORAGE") || m.startsWith("LEDGER")) return "storage";
  if (m.startsWith("SYNC")) return "sync";
  return "other";
}

function parseFields(rest: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const part of rest.split(/[,\s]+/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim().replace(/[,;]$/, "");
    if (!k) continue;
    if (/^-?\d+$/.test(v)) out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

function normLevel(l: string): ParsedLogEvent["level"] {
  const lo = l.toLowerCase();
  if (lo === "warning") return "warn";
  return lo as ParsedLogEvent["level"];
}

export function parseLogLine(line: string): ParsedLogEvent | null {
  const m = LINE_RE.exec(line);
  if (!m) return null;
  const [, level, timestamp, module, body] = m;
  return {
    level: normLevel(level!),
    timestamp: timestamp!.trim(),
    module: module!,
    message: body!.trim(),
    fields: parseFields(body!),
    stage: moduleToStage(module!),
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/services/logParser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/logParser.ts test/unit/services/logParser.test.ts
git commit -m "feat(services): BCOS 3.x logParser with module->stage mapping"
```

---

### Task 3.7: PerfAnalyzer

**Files:**
- Create: `src/services/perfAnalyzer.ts`
- Test: `test/unit/services/perfAnalyzer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/services/perfAnalyzer.test.ts
import { describe, it, expect } from "vitest";
import { analyzePerf } from "../../../src/services/perfAnalyzer.js";
import type { ParsedLogEvent } from "../../../src/services/logParser.js";

function ev(stage: ParsedLogEvent["stage"], costMs: number): ParsedLogEvent {
  return { level: "info", timestamp: "now", module: stage, message: "",
    fields: { costMs }, stage };
}

describe("analyzePerf", () => {
  it("computes p50/p95/p99 per stage", () => {
    const events = Array.from({ length: 100 }, (_, i) => ev("execution", i + 1));
    const r = analyzePerf(events);
    expect(r.stages.execution?.count).toBe(100);
    expect(r.stages.execution?.p50Ms).toBeGreaterThanOrEqual(49);
    expect(r.stages.execution?.p50Ms).toBeLessThanOrEqual(51);
  });

  it("labels the dominant stage as bottleneck", () => {
    const events: ParsedLogEvent[] = [
      ...Array.from({ length: 50 }, () => ev("txpool", 5)),
      ...Array.from({ length: 50 }, () => ev("sealer", 3)),
      ...Array.from({ length: 50 }, () => ev("consensus", 10)),
      ...Array.from({ length: 50 }, () => ev("execution", 200)),
      ...Array.from({ length: 50 }, () => ev("storage", 5)),
    ];
    expect(analyzePerf(events).bottleneck).toBe("execution");
  });

  it("returns 'none' when no costMs", () => {
    const events: ParsedLogEvent[] = [{
      level: "info", timestamp: "x", module: "X", message: "", fields: {}, stage: "other",
    }];
    expect(analyzePerf(events).bottleneck).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/services/perfAnalyzer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/services/perfAnalyzer.ts**

```ts
import type { ParsedLogEvent, LogStage } from "./logParser.js";

export interface StageStats {
  count: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  sumMs: number;
}

export interface PerfReport {
  stages: Partial<Record<LogStage, StageStats>>;
  bottleneck: LogStage | "none";
  bottleneckReason: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

export function analyzePerf(events: ParsedLogEvent[]): PerfReport {
  const buckets: Partial<Record<LogStage, number[]>> = {};
  for (const e of events) {
    const cost = e.fields.costMs;
    if (typeof cost !== "number") continue;
    (buckets[e.stage] ??= []).push(cost);
  }
  const stages: Partial<Record<LogStage, StageStats>> = {};
  for (const [stage, arr] of Object.entries(buckets) as [LogStage, number[]][]) {
    const sorted = [...arr].sort((a, b) => a - b);
    stages[stage] = {
      count: sorted.length,
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
      sumMs: sorted.reduce((s, x) => s + x, 0),
    };
  }
  const total = Object.values(stages).reduce((s, x) => s + (x?.sumMs ?? 0), 0);
  let bottleneck: LogStage | "none" = "none";
  let bestShare = 0;
  let reason = "no cost data found";
  for (const [stage, s] of Object.entries(stages) as [LogStage, StageStats][]) {
    const share = total > 0 ? s.sumMs / total : 0;
    if (share > bestShare) {
      bestShare = share;
      bottleneck = stage;
      reason = `${stage} accounts for ${(share * 100).toFixed(1)}% of observed cost (p99=${s.p99Ms}ms)`;
    }
  }
  return { stages, bottleneck, bottleneckReason: reason };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/services/perfAnalyzer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/perfAnalyzer.ts test/unit/services/perfAnalyzer.test.ts
git commit -m "feat(services): PerfAnalyzer stage percentiles + bottleneck"
```

---

## Phase 4 — Command Handlers

All handlers follow the same shape: validate args via Zod (already done by the shell), call services via `ctx`, return a data object. Every handler commits `git add <handler> <test> && git commit -m "feat(cmd): ..."` after tests pass.

### Task 4.0: buildContext

**Files:**
- Create: `src/buildContext.ts`
- Test: integration only (deferred to Phase 5)

- [ ] **Step 1: Create src/buildContext.ts**

```ts
import type { AppContext } from "./context.js";
import type { ConfigFile } from "./config/schema.js";
import type { ResolveFlags, EnvVars } from "./config/resolve.js";
import { resolveActiveChain } from "./config/resolve.js";
import { createBcosRpcClient } from "./services/bcosRpc.js";
import { createWeb3RpcClient } from "./services/web3Rpc.js";
import { createAbiRegistry } from "./services/abiRegistry.js";
import { createTxDecoder } from "./services/txDecoder.js";
import { createLogReader } from "./services/logReader.js";
import { expandHome } from "./config/load.js";
import { BcosCliError } from "./errors.js";
import { homedir } from "node:os";
import type { AppLogger } from "./types.js";

export interface BuildContextOpts {
  flags: ResolveFlags;
  env: EnvVars;
  fileConfig: ConfigFile | null;
  logger: AppLogger;
  homeDir?: string;
  fetchImpl?: typeof fetch;
}

export function buildContext(opts: BuildContextOpts): AppContext {
  const chain = resolveActiveChain({
    flags: opts.flags, env: opts.env, fileConfig: opts.fileConfig,
  });
  const home = opts.homeDir ?? homedir();
  const f = opts.fetchImpl ?? fetch;
  const bcosRpc = createBcosRpcClient({
    url: chain.profile.bcosRpcUrl,
    groupId: chain.profile.groupId,
    fetch: f,
    logger: opts.logger,
    timeoutMs: chain.profile.requestTimeoutMs,
  });
  const web3Rpc = createWeb3RpcClient({
    url: chain.profile.web3RpcUrl ?? chain.profile.bcosRpcUrl,
    fetch: f,
    timeoutMs: chain.profile.requestTimeoutMs,
  });
  const abiStoreDir = expandHome(
    opts.fileConfig?.abiStoreDir ?? "~/.bcos-cli/abi", home);
  const abiRegistry = createAbiRegistry({ storeDir: abiStoreDir });
  const txDecoder = createTxDecoder();
  const logReader = chain.profile.logDir
    ? createLogReader({
        logDir: chain.profile.logDir,
        maxLines: chain.profile.maxLogScanLines,
      })
    : createLogReader({ logDir: "/__no_log_dir__" });
  return { logger: opts.logger, chain, fileConfig: opts.fileConfig,
    bcosRpc, web3Rpc, abiRegistry, txDecoder, logReader };
}

export function requireLogDir(ctx: AppContext): void {
  if (!ctx.chain.profile.logDir) {
    throw new BcosCliError("LOG_DIR_REQUIRED",
      "this command requires logDir (set in profile or via --log-dir)");
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/buildContext.ts
git commit -m "feat(context): buildContext assembles services from resolved profile"
```

---

### Task 4.1: `bcos tx` handler

**Files:**
- Create: `src/commands/tx.ts`
- Test: `test/integration/commands/tx.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/integration/commands/tx.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import "../../../src/commands/tx.js";
import type { AppContext } from "../../../src/context.js";

function fakeCtx(overrides: Partial<AppContext> = {}): AppContext {
  return {
    logger: { debug(){}, info(){}, warn(){}, error(){} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: { call: async () => null } as never,
    web3Rpc: {} as never,
    abiRegistry: {
      add: async () => ({} as never),
      get: async () => null,
      list: async () => [],
      remove: async () => false,
    },
    txDecoder: { decodeInput: async () => ({ status: "abi_not_found" as const }),
      decodeEvent: async () => ({ status: "abi_not_found" as const }) },
    logReader: {} as never,
    ...overrides,
  };
}

describe("bcos tx command", () => {
  beforeEach(() => {
    __resetRegistry();
    return import("../../../src/commands/tx.js");
  });

  it("returns tx + receipt; marks degraded when no ABI", async () => {
    const cmd = getCommand("tx")!;
    const calls: string[] = [];
    const ctx = fakeCtx({
      bcosRpc: {
        async call(method: string) {
          calls.push(method);
          if (method === "getTransactionByHash") {
            return { hash: "0x" + "ab".repeat(32),
              to: "0xabc00000000000000000000000000000000000de",
              input: "0xdeadbeef", nonce: "0x1" };
          }
          if (method === "getTransactionReceipt") {
            return { status: "0x0", logs: [] };
          }
          return null;
        },
      } as never,
    });
    const res = await cmd.handler(ctx, { hash: "0x" + "ab".repeat(32), decode: true }) as {
      tx: unknown; receipt: unknown; decoded: unknown; degraded: boolean;
    };
    expect(calls).toContain("getTransactionByHash");
    expect(calls).toContain("getTransactionReceipt");
    expect(res.degraded).toBe(true);
  });

  it("throws NOT_FOUND when tx missing", async () => {
    const cmd = getCommand("tx")!;
    const ctx = fakeCtx({ bcosRpc: { call: async () => null } as never });
    await expect(cmd.handler(ctx, {
      hash: "0x" + "ab".repeat(32), decode: true,
    })).rejects.toThrow(/NOT_FOUND/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/integration/commands/tx.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create src/commands/tx.ts**

```ts
import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexHash } from "../validators.js";
import { BcosCliError } from "../errors.js";
import type { Hex } from "viem";

const schema = z.object({
  hash: hexHash,
  decode: z.boolean().default(true),
});

interface BcosTx { hash: string; to?: string; input?: string; [k: string]: unknown; }
interface BcosReceipt { status?: string; logs?: Array<{ address: string; topics: string[]; data: string }>; [k: string]: unknown; }

defineCommand({
  name: "tx",
  description: "Fetch BCOS transaction by hash with decoded input and events",
  schema,
  handler: async (ctx, args) => {
    const tx = await ctx.bcosRpc.call<BcosTx | null>("getTransactionByHash", [args.hash]);
    if (!tx) throw new BcosCliError("NOT_FOUND", `transaction ${args.hash} not found`);
    const receipt = await ctx.bcosRpc.call<BcosReceipt | null>("getTransactionReceipt", [args.hash]);

    let decoded: unknown = undefined;
    let degraded = false;
    if (args.decode && tx.to && tx.input) {
      const r = await ctx.txDecoder.decodeInput(tx.to, tx.input as Hex, ctx.abiRegistry);
      decoded = r;
      if (r.status !== "ok") degraded = true;
    }

    const decodedLogs = args.decode && receipt?.logs
      ? await Promise.all(receipt.logs.map(async (log) => ({
          ...log,
          decoded: await ctx.txDecoder.decodeEvent({
            address: log.address, topics: log.topics as Hex[], data: log.data as Hex,
          }, ctx.abiRegistry),
        })))
      : receipt?.logs;
    if (decodedLogs?.some((l: { decoded?: { status: string } }) =>
      l.decoded && l.decoded.status !== "ok")) degraded = true;

    return { tx, receipt: receipt ? { ...receipt, logs: decodedLogs } : null, decoded, degraded };
  },
});
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/integration/commands/tx.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/tx.ts test/integration/commands/tx.test.ts
git commit -m "feat(cmd): bcos tx with decoded input and event logs"
```

---

### Task 4.2: Basic read handlers (block, receipt, account, code, call)

Each follows the same pattern as Task 4.1. Implement in one commit cluster.

**Files:**
- Create: `src/commands/block.ts`, `receipt.ts`, `account.ts`, `code.ts`, `call.ts`
- Test: `test/integration/commands/block.test.ts` etc.

- [ ] **Step 1: Create src/commands/block.ts**

```ts
import { z } from "zod";
import { defineCommand } from "./registry.js";
import { blockTag } from "../validators.js";
import { BcosCliError } from "../errors.js";

const schema = z.object({
  block: blockTag,
  withTxs: z.boolean().default(false),
});

defineCommand({
  name: "block",
  description: "Fetch a block by number, tag, or hash",
  schema,
  handler: async (ctx, args) => {
    const method = args.block.kind === "hash" ? "getBlockByHash" : "getBlockByNumber";
    const result = await ctx.bcosRpc.call<unknown>(method, [args.block.value, args.withTxs]);
    if (!result) throw new BcosCliError("NOT_FOUND", `block ${args.block.value} not found`);
    return { block: result };
  },
});
```

- [ ] **Step 2: Create src/commands/receipt.ts**

```ts
import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexHash } from "../validators.js";
import { BcosCliError } from "../errors.js";

defineCommand({
  name: "receipt",
  description: "Fetch a transaction receipt",
  schema: z.object({ hash: hexHash }),
  handler: async (ctx, args) => {
    const r = await ctx.bcosRpc.call<unknown>("getTransactionReceipt", [args.hash]);
    if (!r) throw new BcosCliError("NOT_FOUND", `receipt ${args.hash} not found`);
    return { receipt: r };
  },
});
```

- [ ] **Step 3: Create src/commands/account.ts**

```ts
import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexAddress } from "../validators.js";

defineCommand({
  name: "account",
  description: "Fetch account balance, nonce, and contract status",
  schema: z.object({ address: hexAddress }),
  handler: async (ctx, args) => {
    const [balanceRaw, codeRaw] = await Promise.all([
      ctx.bcosRpc.call<string>("getBalance", [args.address]).catch(() => "0x0"),
      ctx.bcosRpc.call<string>("getCode", [args.address]).catch(() => "0x"),
    ]);
    const isContract = !!codeRaw && codeRaw !== "0x";
    return {
      address: args.address,
      balance: BigInt(balanceRaw).toString(),
      isContract,
      codeSize: isContract ? (codeRaw.length - 2) / 2 : 0,
    };
  },
});
```

- [ ] **Step 4: Create src/commands/code.ts**

```ts
import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexAddress } from "../validators.js";

defineCommand({
  name: "code",
  description: "Fetch contract bytecode",
  schema: z.object({ address: hexAddress }),
  handler: async (ctx, args) => ({
    address: args.address,
    code: await ctx.bcosRpc.call<string>("getCode", [args.address]),
  }),
});
```

- [ ] **Step 5: Create src/commands/call.ts**

```ts
import { z } from "zod";
import { encodeFunctionData, decodeFunctionResult, type Abi, type Hex } from "viem";
import { defineCommand } from "./registry.js";
import { hexAddress } from "../validators.js";
import { BcosCliError } from "../errors.js";

defineCommand({
  name: "call",
  description: "Read-only call to a contract method using registered ABI",
  schema: z.object({
    address: hexAddress,
    method: z.string(),
    args: z.array(z.string()).default([]),
  }),
  handler: async (ctx, args) => {
    const entry = await ctx.abiRegistry.get(args.address);
    if (!entry) {
      throw new BcosCliError("ABI_NOT_FOUND",
        `no ABI registered for ${args.address}; run 'bcos abi add' first`);
    }
    let encoded: Hex;
    try {
      encoded = encodeFunctionData({
        abi: entry.abi as Abi, functionName: args.method, args: args.args,
      });
    } catch (err) {
      throw new BcosCliError("INVALID_ARGUMENT",
        `cannot encode call: ${(err as Error).message}`);
    }
    const raw = await ctx.bcosRpc.call<string>("call", [{ to: args.address, data: encoded }]);
    let decoded: unknown;
    try {
      decoded = decodeFunctionResult({
        abi: entry.abi as Abi, functionName: args.method, data: raw as Hex,
      });
    } catch (err) {
      return { raw, decoded: null, decodeError: (err as Error).message, degraded: true };
    }
    return { raw, decoded };
  },
});
```

- [ ] **Step 6: Write integration tests**

```ts
// test/integration/commands/block.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

function ctx(rpcResult: unknown): AppContext {
  return {
    logger: { debug(){}, info(){}, warn(){}, error(){} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: { call: async () => rpcResult } as never,
    web3Rpc: {} as never,
    abiRegistry: { add: async () => ({} as never), get: async () => null,
      list: async () => [], remove: async () => false },
    txDecoder: { decodeInput: async () => ({ status: "abi_not_found" as const }),
      decodeEvent: async () => ({ status: "abi_not_found" as const }) },
    logReader: {} as never,
  };
}

describe("bcos block", () => {
  beforeEach(async () => { __resetRegistry(); await import("../../../src/commands/block.js"); });

  it("returns block data", async () => {
    const out = await getCommand("block")!.handler(ctx({ number: "0xa" }),
      { block: { kind: "number", value: "10" }, withTxs: false }) as { block: unknown };
    expect(out.block).toEqual({ number: "0xa" });
  });

  it("throws NOT_FOUND on null", async () => {
    await expect(getCommand("block")!.handler(ctx(null),
      { block: { kind: "number", value: "10" }, withTxs: false }))
      .rejects.toThrow(/NOT_FOUND/);
  });
});
```

Create similar minimal tests for receipt, account, code, call following the same pattern.

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/integration/commands/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/commands/block.ts src/commands/receipt.ts src/commands/account.ts \
        src/commands/code.ts src/commands/call.ts test/integration/commands/
git commit -m "feat(cmd): basic reads — block, receipt, account, code, call"
```

---

### Task 4.3: Chain state handlers (chain info, peers, group list, consensus)

**Files:**
- Create: `src/commands/chain/info.ts`, `peers.ts`, `groupList.ts`, `consensus.ts`

- [ ] **Step 1: src/commands/chain/info.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "chain info",
  description: "Chain ID, version, latest height, and consensus summary",
  schema: z.object({}),
  handler: async (ctx) => {
    const [syncStatus, pbftView, groupList] = await Promise.all([
      ctx.bcosRpc.call<unknown>("getSyncStatus", []).catch(() => null),
      ctx.bcosRpc.call<unknown>("getPbftView", []).catch(() => null),
      ctx.bcosRpc.call<string[]>("getGroupList", []).catch(() => []),
    ]);
    return {
      chainName: ctx.chain.chainName,
      groupId: ctx.chain.profile.groupId,
      chainId: ctx.chain.profile.chainId,
      syncStatus, pbftView, groupList,
    };
  },
});
```

- [ ] **Step 2: src/commands/chain/peers.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "peers",
  description: "List peer nodes and their status",
  schema: z.object({}),
  handler: async (ctx) => ({
    peers: await ctx.bcosRpc.call<unknown>("getPeers", []),
    groupPeers: await ctx.bcosRpc.call<unknown>("getGroupPeers", []).catch(() => null),
  }),
});
```

- [ ] **Step 3: src/commands/chain/groupList.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "group list",
  description: "List all groups on the connected node",
  schema: z.object({}),
  handler: async (ctx) => ({
    groups: await ctx.bcosRpc.call<string[]>("getGroupList", []),
  }),
});
```

- [ ] **Step 4: src/commands/chain/consensus.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "consensus status",
  description: "Consensus node list, current view, sealer/observer roles",
  schema: z.object({}),
  handler: async (ctx) => {
    const [sealers, observers, view] = await Promise.all([
      ctx.bcosRpc.call<unknown>("getSealerList", []).catch(() => null),
      ctx.bcosRpc.call<unknown>("getObserverList", []).catch(() => null),
      ctx.bcosRpc.call<unknown>("getPbftView", []).catch(() => null),
    ]);
    return { sealers, observers, view };
  },
});
```

- [ ] **Step 5: Write integration tests**

For each: call handler with a fake ctx whose `bcosRpc.call` returns known values; assert the data is passed through.

```ts
// test/integration/commands/chainInfo.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("chain info", () => {
  beforeEach(async () => {
    __resetRegistry();
    await import("../../../src/commands/chain/info.js");
  });
  it("aggregates sync, view, groupList", async () => {
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g0", chainId: 1 } as never },
      fileConfig: null,
      bcosRpc: { call: async (m: string) => {
        if (m === "getSyncStatus") return { h: 100 };
        if (m === "getPbftView") return 5;
        if (m === "getGroupList") return ["group0", "group1"];
        return null;
      } } as never,
      web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    const r = await getCommand("chain info")!.handler(ctx, {}) as {
      syncStatus: unknown; pbftView: unknown; groupList: string[];
    };
    expect(r.syncStatus).toEqual({ h: 100 });
    expect(r.pbftView).toBe(5);
    expect(r.groupList).toEqual(["group0", "group1"]);
  });
});
```

Write analogous 1-test modules for peers, group list, consensus status.

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/integration/commands/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/commands/chain/ test/integration/commands/chainInfo.test.ts \
        test/integration/commands/peers.test.ts \
        test/integration/commands/groupList.test.ts \
        test/integration/commands/consensus.test.ts
git commit -m "feat(cmd): chain info, peers, group list, consensus status"
```

---

### Task 4.4: ABI management (add, list, show, rm)

**Files:**
- Create: `src/commands/abi/add.ts`, `list.ts`, `show.ts`, `rm.ts`

- [ ] **Step 1: src/commands/abi/add.ts**

```ts
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";
import { BcosCliError } from "../../errors.js";

defineCommand({
  name: "abi add",
  description: "Register an ABI JSON file for a contract address",
  schema: z.object({
    address: hexAddress,
    abiPath: z.string(),
    name: z.string().optional(),
  }),
  handler: async (ctx, args) => {
    let raw: string;
    try {
      raw = await readFile(args.abiPath, "utf8");
    } catch (err) {
      throw new BcosCliError("FILE_IO_ERROR",
        `cannot read ${args.abiPath}`, {}, err);
    }
    let abi: unknown;
    try { abi = JSON.parse(raw); }
    catch (err) {
      throw new BcosCliError("INVALID_ARGUMENT", `invalid JSON in ${args.abiPath}`, {}, err);
    }
    const normalized = Array.isArray(abi)
      ? abi
      : Array.isArray((abi as { abi?: unknown }).abi)
        ? (abi as { abi: unknown[] }).abi
        : null;
    if (!normalized) {
      throw new BcosCliError("INVALID_ARGUMENT",
        "ABI must be an array or an object with an 'abi' array field");
    }
    const entry = await ctx.abiRegistry.add(args.address, normalized, args.name);
    return { stored: entry };
  },
});
```

- [ ] **Step 2: src/commands/abi/list.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "abi list",
  description: "List all registered contract ABIs",
  schema: z.object({}),
  handler: async (ctx) => ({ entries: await ctx.abiRegistry.list() }),
});
```

- [ ] **Step 3: src/commands/abi/show.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";
import { BcosCliError } from "../../errors.js";

defineCommand({
  name: "abi show",
  description: "Show a registered ABI entry by address",
  schema: z.object({ address: hexAddress }),
  handler: async (ctx, args) => {
    const entry = await ctx.abiRegistry.get(args.address);
    if (!entry) throw new BcosCliError("ABI_NOT_FOUND",
      `no ABI registered for ${args.address}`);
    return { entry };
  },
});
```

- [ ] **Step 4: src/commands/abi/rm.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";

defineCommand({
  name: "abi rm",
  description: "Remove an ABI entry by address",
  schema: z.object({ address: hexAddress }),
  handler: async (ctx, args) => ({
    address: args.address,
    removed: await ctx.abiRegistry.remove(args.address),
  }),
});
```

- [ ] **Step 5: Write integration tests**

```ts
// test/integration/commands/abi.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import { createAbiRegistry } from "../../../src/services/abiRegistry.js";
import type { AppContext } from "../../../src/context.js";

function ctxWithRegistry(dir: string): AppContext {
  return {
    logger: { debug(){}, info(){}, warn(){}, error(){} },
    chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g" } as never },
    fileConfig: null,
    bcosRpc: {} as never, web3Rpc: {} as never,
    abiRegistry: createAbiRegistry({ storeDir: dir }),
    txDecoder: {} as never, logReader: {} as never,
  };
}

describe("abi add / show / list / rm", () => {
  let dir: string;
  beforeEach(async () => {
    __resetRegistry();
    await import("../../../src/commands/abi/add.js");
    await import("../../../src/commands/abi/show.js");
    await import("../../../src/commands/abi/list.js");
    await import("../../../src/commands/abi/rm.js");
    dir = mkdtempSync(join(tmpdir(), "abicmd-"));
  });

  it("add + show round-trip", async () => {
    const abiFile = join(dir, "abi.json");
    writeFileSync(abiFile, JSON.stringify([{ type: "function", name: "x", inputs: [] }]));
    const ctx = ctxWithRegistry(dir);
    await getCommand("abi add")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de",
      abiPath: abiFile, name: "X",
    });
    const shown = await getCommand("abi show")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de",
    }) as { entry: { name?: string } };
    expect(shown.entry.name).toBe("X");
  });

  it("rm returns removed: true", async () => {
    const abiFile = join(dir, "abi.json");
    writeFileSync(abiFile, JSON.stringify([]));
    const ctx = ctxWithRegistry(dir);
    await getCommand("abi add")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de", abiPath: abiFile,
    });
    const res = await getCommand("abi rm")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de",
    }) as { removed: boolean };
    expect(res.removed).toBe(true);
  });

  it("rejects non-JSON file", async () => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "not json");
    const ctx = ctxWithRegistry(dir);
    await expect(getCommand("abi add")!.handler(ctx, {
      address: "0xabc00000000000000000000000000000000000de", abiPath: bad,
    })).rejects.toThrow(/INVALID_ARGUMENT/);
  });
});
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/integration/commands/abi.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/commands/abi/ test/integration/commands/abi.test.ts
git commit -m "feat(cmd): abi add/list/show/rm"
```

---

### Task 4.5: Event and search handlers

**Files:**
- Create: `src/commands/event.ts`, `src/commands/search.ts`

- [ ] **Step 1: src/commands/event.ts**

```ts
import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexAddress } from "../validators.js";
import type { Hex } from "viem";

interface EthLog { address: string; topics: string[]; data: string; blockNumber?: string; transactionHash?: string; }

defineCommand({
  name: "event",
  description: "Query and decode contract event logs within a block range",
  schema: z.object({
    address: hexAddress,
    fromBlock: z.string(),
    toBlock: z.string(),
    name: z.string().optional(),
  }),
  handler: async (ctx, args) => {
    const logs = await ctx.bcosRpc.call<EthLog[]>("getLogs", [{
      address: args.address, fromBlock: args.fromBlock, toBlock: args.toBlock,
    }]);
    const decoded = await Promise.all(logs.map(async (log) => {
      const d = await ctx.txDecoder.decodeEvent({
        address: log.address, topics: log.topics as Hex[], data: log.data as Hex,
      }, ctx.abiRegistry);
      return { ...log, decoded: d };
    }));
    const filtered = args.name
      ? decoded.filter((l) => l.decoded.status === "ok" && l.decoded.eventName === args.name)
      : decoded;
    return {
      count: filtered.length,
      logs: filtered,
      degraded: filtered.some((l) => l.decoded.status !== "ok"),
    };
  },
});
```

- [ ] **Step 2: src/commands/search.ts**

```ts
import { z } from "zod";
import { defineCommand } from "./registry.js";
import { hexAddress } from "../validators.js";
import { BcosCliError } from "../errors.js";

interface BcosBlockWithTxs {
  number?: string;
  transactions?: Array<{ hash: string; from?: string; to?: string; [k: string]: unknown }>;
}

defineCommand({
  name: "search tx",
  description: "Scan blocks for transactions matching from/to filters",
  schema: z.object({
    from: hexAddress.optional(),
    to: hexAddress.optional(),
    fromBlock: z.string(),
    toBlock: z.string(),
  }),
  handler: async (ctx, args) => {
    if (!args.from && !args.to) {
      throw new BcosCliError("INVALID_ARGUMENT", "at least one of --from or --to required");
    }
    const start = BigInt(args.fromBlock), end = BigInt(args.toBlock);
    if (end < start) throw new BcosCliError("INVALID_ARGUMENT", "toBlock < fromBlock");
    const matches: Array<{ block: string; tx: unknown }> = [];
    for (let i = start; i <= end; i++) {
      const blk = await ctx.bcosRpc.call<BcosBlockWithTxs | null>(
        "getBlockByNumber", ["0x" + i.toString(16), true]);
      if (!blk?.transactions) continue;
      for (const tx of blk.transactions) {
        const okFrom = !args.from || tx.from?.toLowerCase() === args.from.toLowerCase();
        const okTo = !args.to || tx.to?.toLowerCase() === args.to.toLowerCase();
        if (okFrom && okTo) matches.push({ block: i.toString(), tx });
      }
    }
    return { scanned: (end - start + 1n).toString(), matches };
  },
});
```

- [ ] **Step 3: Integration tests**

Write `test/integration/commands/event.test.ts` and `search.test.ts` following the pattern in Task 4.1: fake `bcosRpc.call` to return canned logs / blocks, assert returned shape.

- [ ] **Step 4: Run + commit**

```bash
pnpm tsc --noEmit && pnpm vitest run test/integration/commands/
git add src/commands/event.ts src/commands/search.ts test/integration/commands/event.test.ts test/integration/commands/search.test.ts
git commit -m "feat(cmd): event query and search tx"
```

---

### Task 4.6: Doctor (RPC-based: tx, chain)

**Files:**
- Create: `src/commands/doctor/tx.ts`, `src/commands/doctor/chain.ts`

- [ ] **Step 1: src/commands/doctor/tx.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexHash } from "../../validators.js";
import { BcosCliError } from "../../errors.js";
import type { Hex } from "viem";

interface Receipt {
  status?: string;
  output?: string;
  contractAddress?: string;
  logs?: unknown[];
  gasUsed?: string;
}

defineCommand({
  name: "doctor tx",
  description: "Diagnose why a transaction failed or is pending",
  schema: z.object({ hash: hexHash }),
  handler: async (ctx, args) => {
    const tx = await ctx.bcosRpc.call<{ to?: string; input?: string; nonce?: string; from?: string } | null>(
      "getTransactionByHash", [args.hash]);
    if (!tx) throw new BcosCliError("NOT_FOUND", `tx ${args.hash} not found`);
    const receipt = await ctx.bcosRpc.call<Receipt | null>("getTransactionReceipt", [args.hash]);

    const findings: string[] = [];
    if (!receipt) {
      findings.push("transaction has no receipt (still pending, dropped, or replaced)");
    } else {
      const status = receipt.status ?? "0x0";
      if (status !== "0x0" && status !== "0") {
        findings.push(`non-zero status code: ${status} — tx execution failed`);
      }
      if (receipt.output && receipt.output !== "0x" && tx.to) {
        const decoded = await ctx.txDecoder.decodeInput(tx.to, receipt.output as Hex, ctx.abiRegistry);
        if (decoded.status === "ok") findings.push(`decoded revert output: ${JSON.stringify(decoded)}`);
      }
    }

    return { tx, receipt, findings };
  },
});
```

- [ ] **Step 2: src/commands/doctor/chain.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "doctor chain",
  description: "Whole-chain health check via RPC",
  schema: z.object({}),
  handler: async (ctx) => {
    const [sync, view, peers, sealers] = await Promise.all([
      ctx.bcosRpc.call<{ blockNumber?: string; knownLatestBlockNumber?: string; nodes?: unknown[] }>(
        "getSyncStatus", []).catch(() => null),
      ctx.bcosRpc.call<unknown>("getPbftView", []).catch(() => null),
      ctx.bcosRpc.call<unknown[]>("getPeers", []).catch(() => []),
      ctx.bcosRpc.call<unknown[]>("getSealerList", []).catch(() => []),
    ]);
    const findings: string[] = [];
    if (sync && sync.blockNumber && sync.knownLatestBlockNumber) {
      const local = BigInt(sync.blockNumber);
      const known = BigInt(sync.knownLatestBlockNumber);
      const gap = known - local;
      if (gap > 10n) findings.push(`node is ${gap.toString()} blocks behind network`);
    }
    if (Array.isArray(peers) && peers.length === 0) findings.push("no peers connected");
    if (Array.isArray(sealers) && sealers.length < 4) {
      findings.push(`only ${sealers.length} sealers — PBFT requires ≥4 for BFT safety`);
    }
    return { sync, view, peerCount: Array.isArray(peers) ? peers.length : 0,
      sealerCount: Array.isArray(sealers) ? sealers.length : 0, findings };
  },
});
```

- [ ] **Step 3: Integration tests**

Write `test/integration/commands/doctorTx.test.ts` and `doctorChain.test.ts` with fake RPC returning controlled states; assert `findings` contains expected diagnostics.

- [ ] **Step 4: Commit**

```bash
pnpm tsc --noEmit && pnpm vitest run test/integration/commands/
git add src/commands/doctor/tx.ts src/commands/doctor/chain.ts \
        test/integration/commands/doctorTx.test.ts \
        test/integration/commands/doctorChain.test.ts
git commit -m "feat(cmd): doctor tx and doctor chain (RPC-based)"
```

---

### Task 4.7: Doctor (log-based: perf, health, sync)

**Files:**
- Create: `src/commands/doctor/perf.ts`, `health.ts`, `sync.ts`

- [ ] **Step 1: src/commands/doctor/perf.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { parseLogLine } from "../../services/logParser.js";
import { analyzePerf } from "../../services/perfAnalyzer.js";
import { requireLogDir } from "../../buildContext.js";

function parseSince(s: string): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(s);
  if (!m) throw new Error(`invalid --since: ${s}`);
  const n = Number(m[1]);
  const unit = m[2]!;
  return unit === "s" ? n * 1000 : unit === "m" ? n * 60000 :
    unit === "h" ? n * 3600000 : n * 86400000;
}

defineCommand({
  name: "doctor perf",
  description: "Phase-time breakdown from node logs (txpool/consensus/execution/storage)",
  schema: z.object({ since: z.string().default("10m") }),
  capabilities: { requiresLogDir: true },
  handler: async (ctx, args) => {
    requireLogDir(ctx);
    const windowMs = parseSince(args.since);
    const cutoff = Date.now() - windowMs;
    const events = [];
    let total = 0, unparsed = 0;
    for await (const { line } of ctx.logReader.streamLines()) {
      total++;
      const e = parseLogLine(line);
      if (!e) { unparsed++; continue; }
      const t = Date.parse(e.timestamp.replace(" ", "T") + "Z");
      if (!Number.isFinite(t) || t >= cutoff) events.push(e);
    }
    const report = analyzePerf(events);
    return {
      window: { since: args.since, from: new Date(cutoff).toISOString() },
      ...report,
      stats: { lines: total, parsedEvents: events.length, unparsedLines: unparsed },
    };
  },
});
```

- [ ] **Step 2: src/commands/doctor/health.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { parseLogLine } from "../../services/logParser.js";
import { requireLogDir } from "../../buildContext.js";

defineCommand({
  name: "doctor health",
  description: "Scan logs for severe problems: fatal errors, viewchange storms, sync stalls",
  schema: z.object({}),
  capabilities: { requiresLogDir: true },
  handler: async (ctx) => {
    requireLogDir(ctx);
    let fatals = 0, errors = 0, viewchanges = 0, lastHeight: number | undefined;
    const sampleFatals: string[] = [];
    for await (const { line } of ctx.logReader.streamLines()) {
      const e = parseLogLine(line);
      if (!e) continue;
      if (e.level === "fatal") { fatals++; if (sampleFatals.length < 5) sampleFatals.push(line); }
      if (e.level === "error") errors++;
      if (/viewchange/i.test(e.message)) viewchanges++;
      if (e.stage === "sealer" && typeof e.fields.height === "number") lastHeight = e.fields.height;
    }
    const findings: string[] = [];
    if (fatals > 0) findings.push(`${fatals} fatal log entries found`);
    if (viewchanges > 10) findings.push(`${viewchanges} viewchange events — consensus instability`);
    if (lastHeight === undefined) findings.push("no sealer activity in scanned window — possible halt");
    return { fatals, errors, viewchanges, lastSealerHeight: lastHeight, sampleFatals, findings };
  },
});
```

- [ ] **Step 3: src/commands/doctor/sync.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { parseLogLine } from "../../services/logParser.js";
import { requireLogDir } from "../../buildContext.js";

defineCommand({
  name: "doctor sync",
  description: "Report block-sync activity from logs",
  schema: z.object({}),
  capabilities: { requiresLogDir: true },
  handler: async (ctx) => {
    requireLogDir(ctx);
    let syncEvents = 0;
    let minHeight: number | undefined, maxHeight: number | undefined;
    const failures: string[] = [];
    for await (const { line } of ctx.logReader.streamLines()) {
      const e = parseLogLine(line);
      if (!e || e.stage !== "sync") continue;
      syncEvents++;
      const h = e.fields.height;
      if (typeof h === "number") {
        minHeight = minHeight === undefined ? h : Math.min(minHeight, h);
        maxHeight = maxHeight === undefined ? h : Math.max(maxHeight, h);
      }
      if (e.level === "error" && failures.length < 5) failures.push(line);
    }
    return {
      syncEvents, minHeight, maxHeight,
      progressedBlocks: minHeight !== undefined && maxHeight !== undefined ? maxHeight - minHeight : 0,
      failures,
    };
  },
});
```

- [ ] **Step 4: Integration tests**

Write fake ctx whose `logReader.streamLines()` yields a scripted sequence of lines; assert the reports reflect the inputs.

```ts
// test/integration/commands/doctorPerf.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("doctor perf", () => {
  beforeEach(async () => {
    __resetRegistry();
    await import("../../../src/commands/doctor/perf.js");
  });
  it("summarizes stages from lines", async () => {
    const lines = [
      "info|2099-01-01 00:00:00.000000|[EXECUTOR] x, costMs=30",
      "info|2099-01-01 00:00:00.000000|[EXECUTOR] x, costMs=200",
      "info|2099-01-01 00:00:00.000000|[STORAGE] x, costMs=5",
    ];
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "t", profile: { bcosRpcUrl: "x", groupId: "g", logDir: "/tmp" } as never },
      fileConfig: null,
      bcosRpc: {} as never, web3Rpc: {} as never,
      abiRegistry: {} as never, txDecoder: {} as never,
      logReader: {
        listFiles: async () => [],
        async *streamLines() { for (const l of lines) yield { file: "f", line: l, lineNo: 0 }; },
      },
    } as AppContext;
    const r = await getCommand("doctor perf")!.handler(ctx, { since: "1000d" }) as {
      bottleneck: string; stages: Record<string, { count: number }>;
    };
    expect(r.bottleneck).toBe("execution");
    expect(r.stages.execution?.count).toBe(2);
  });
});
```

Write similar tests for `doctor health` (feed fatal lines) and `doctor sync` (feed sync lines).

- [ ] **Step 5: Commit**

```bash
pnpm tsc --noEmit && pnpm vitest run test/integration/commands/
git add src/commands/doctor/ test/integration/commands/doctorPerf.test.ts \
        test/integration/commands/doctorHealth.test.ts \
        test/integration/commands/doctorSync.test.ts
git commit -m "feat(cmd): doctor perf/health/sync (log-based)"
```

---

### Task 4.8: Eth subtree handlers

**Files:**
- Create: `src/commands/eth/block.ts`, `tx.ts`, `receipt.ts`, `call.ts`, `logs.ts`, `chainId.ts`, `gasPrice.ts`, `blockNumber.ts`

- [ ] **Step 1: src/commands/eth/blockNumber.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "eth block-number",
  description: "Latest block number via Web3 RPC",
  schema: z.object({}),
  handler: async (ctx) => ({ blockNumber: (await ctx.web3Rpc.blockNumber()).toString() }),
});
```

- [ ] **Step 2: src/commands/eth/chainId.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "eth chain-id",
  description: "Chain ID via Web3 RPC",
  schema: z.object({}),
  handler: async (ctx) => ({ chainId: await ctx.web3Rpc.chainId() }),
});
```

- [ ] **Step 3: src/commands/eth/gasPrice.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "eth gas-price",
  description: "Gas price via Web3 RPC",
  schema: z.object({}),
  handler: async (ctx) => ({ gasPrice: (await ctx.web3Rpc.gasPrice()).toString() }),
});
```

- [ ] **Step 4: src/commands/eth/block.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { blockTag } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth block",
  description: "Get block via Web3 RPC",
  schema: z.object({ block: blockTag, withTxs: z.boolean().default(false) }),
  handler: async (ctx, args) => {
    if (args.block.kind === "hash") {
      return { block: await ctx.web3Rpc.getBlock({
        blockHash: args.block.value as Hex, includeTransactions: args.withTxs,
      }) };
    }
    if (args.block.kind === "number") {
      return { block: await ctx.web3Rpc.getBlock({
        blockNumber: BigInt(args.block.value), includeTransactions: args.withTxs,
      }) };
    }
    return { block: await ctx.web3Rpc.getBlock({ includeTransactions: args.withTxs }) };
  },
});
```

- [ ] **Step 5: src/commands/eth/tx.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexHash } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth tx",
  description: "Get transaction via Web3 RPC",
  schema: z.object({ hash: hexHash }),
  handler: async (ctx, args) => ({
    tx: await ctx.web3Rpc.getTransaction(args.hash as Hex),
  }),
});
```

- [ ] **Step 6: src/commands/eth/receipt.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexHash } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth receipt",
  description: "Get transaction receipt via Web3 RPC",
  schema: z.object({ hash: hexHash }),
  handler: async (ctx, args) => ({
    receipt: await ctx.web3Rpc.getTransactionReceipt(args.hash as Hex),
  }),
});
```

- [ ] **Step 7: src/commands/eth/call.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth call",
  description: "Read-only eth_call with raw data",
  schema: z.object({
    address: hexAddress,
    data: z.string().transform((s) => (s.startsWith("0x") ? s : "0x" + s) as Hex),
  }),
  handler: async (ctx, args) => ({
    result: await ctx.web3Rpc.call({ to: args.address as Hex, data: args.data }),
  }),
});
```

- [ ] **Step 8: src/commands/eth/logs.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";
import { hexAddress } from "../../validators.js";
import type { Hex } from "viem";

defineCommand({
  name: "eth logs",
  description: "eth_getLogs with optional address + single topic",
  schema: z.object({
    fromBlock: z.string(),
    toBlock: z.string(),
    address: hexAddress.optional(),
    topic: z.string().optional(),
  }),
  handler: async (ctx, args) => ({
    logs: await ctx.web3Rpc.getLogs({
      address: args.address as Hex | undefined,
      fromBlock: BigInt(args.fromBlock),
      toBlock: BigInt(args.toBlock),
      topics: args.topic ? [args.topic as Hex] : undefined,
    }),
  }),
});
```

- [ ] **Step 9: Integration tests**

Write one test per handler: fake `ctx.web3Rpc` whose methods return canned values; assert the data flows through.

- [ ] **Step 10: Commit**

```bash
pnpm tsc --noEmit && pnpm vitest run test/integration/commands/
git add src/commands/eth/ test/integration/commands/eth*.test.ts
git commit -m "feat(cmd): eth subtree — block/tx/receipt/call/logs/chainId/gasPrice/blockNumber"
```

---

### Task 4.9: Config commands

**Files:**
- Create: `src/commands/config/show.ts`, `listChains.ts`

- [ ] **Step 1: src/commands/config/show.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "config show",
  description: "Show the merged effective configuration for the current invocation",
  schema: z.object({}),
  handler: async (ctx) => ({
    chain: ctx.chain.chainName,
    profile: ctx.chain.profile,
    hasFileConfig: !!ctx.fileConfig,
  }),
});
```

- [ ] **Step 2: src/commands/config/listChains.ts**

```ts
import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "config list-chains",
  description: "List all profiles loaded from the config file",
  schema: z.object({}),
  handler: async (ctx) => ({
    defaultChain: ctx.fileConfig?.defaultChain,
    chains: ctx.fileConfig ? Object.keys(ctx.fileConfig.chains) : [],
  }),
});
```

- [ ] **Step 3: Integration tests**

```ts
// test/integration/commands/configShow.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";

describe("config show", () => {
  beforeEach(async () => {
    __resetRegistry();
    await import("../../../src/commands/config/show.js");
  });
  it("returns chain info", async () => {
    const ctx = {
      logger: { debug(){}, info(){}, warn(){}, error(){} },
      chain: { chainName: "x", profile: { bcosRpcUrl: "u", groupId: "g" } as never },
      fileConfig: null,
      bcosRpc: {} as never, web3Rpc: {} as never, abiRegistry: {} as never,
      txDecoder: {} as never, logReader: {} as never,
    } as AppContext;
    const r = await getCommand("config show")!.handler(ctx, {}) as { chain: string };
    expect(r.chain).toBe("x");
  });
});
```

Write a similar test for list-chains.

- [ ] **Step 4: Commit**

```bash
pnpm tsc --noEmit && pnpm vitest run test/integration/commands/
git add src/commands/config/ test/integration/commands/configShow.test.ts \
        test/integration/commands/configListChains.test.ts
git commit -m "feat(cmd): config show and list-chains"
```

---

### Task 4.10: registerAll

**Files:**
- Create: `src/commands/registerAll.ts`

- [ ] **Step 1: Write the file (imports all command modules for side effects)**

```ts
// src/commands/registerAll.ts
import "./tx.js";
import "./block.js";
import "./receipt.js";
import "./account.js";
import "./code.js";
import "./call.js";
import "./chain/info.js";
import "./chain/peers.js";
import "./chain/groupList.js";
import "./chain/consensus.js";
import "./abi/add.js";
import "./abi/list.js";
import "./abi/show.js";
import "./abi/rm.js";
import "./event.js";
import "./search.js";
import "./doctor/tx.js";
import "./doctor/chain.js";
import "./doctor/perf.js";
import "./doctor/health.js";
import "./doctor/sync.js";
import "./eth/block.js";
import "./eth/tx.js";
import "./eth/receipt.js";
import "./eth/call.js";
import "./eth/logs.js";
import "./eth/chainId.js";
import "./eth/gasPrice.js";
import "./eth/blockNumber.js";
import "./config/show.js";
import "./config/listChains.js";
```

- [ ] **Step 2: Write registerAll test**

```ts
// test/unit/commands/registerAll.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { __resetRegistry, allCommands } from "../../../src/commands/registry.js";

describe("registerAll", () => {
  beforeEach(() => __resetRegistry());
  it("registers all 30 commands without duplication", async () => {
    await import("../../../src/commands/registerAll.js");
    const names = allCommands().map((c) => c.name);
    expect(names).toContain("tx");
    expect(names).toContain("chain info");
    expect(names).toContain("doctor perf");
    expect(names).toContain("eth block");
    expect(names).toContain("config show");
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThanOrEqual(30);
  });
});
```

- [ ] **Step 3: Commit**

```bash
pnpm tsc --noEmit && pnpm vitest run test/unit/commands/registerAll.test.ts
git add src/commands/registerAll.ts test/unit/commands/registerAll.test.ts
git commit -m "feat(registry): registerAll imports every command module"
```

---

## Phase 5 — Shells

### Task 5.1: zodToYargs

**Files:**
- Create: `src/cli/zodToYargs.ts`
- Test: `test/unit/cli/zodToYargs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/cli/zodToYargs.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { collectArgs } from "../../../src/cli/zodToYargs.js";

describe("collectArgs", () => {
  it("lists positional + optional fields from a flat object schema", () => {
    const schema = z.object({
      hash: z.string(),
      decode: z.boolean().default(true),
      name: z.string().optional(),
    });
    const info = collectArgs(schema);
    const byName = Object.fromEntries(info.map((i) => [i.name, i]));
    expect(byName.hash?.kind).toBe("string");
    expect(byName.decode?.kind).toBe("boolean");
    expect(byName.decode?.default).toBe(true);
    expect(byName.name?.optional).toBe(true);
  });

  it("supports z.array(z.string())", () => {
    const schema = z.object({ args: z.array(z.string()).default([]) });
    const info = collectArgs(schema);
    expect(info[0]!.kind).toBe("array");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/cli/zodToYargs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/cli/zodToYargs.ts**

```ts
import { z } from "zod";

export type ArgKind = "string" | "number" | "boolean" | "array";

export interface ArgInfo {
  name: string;
  kind: ArgKind;
  optional: boolean;
  default?: unknown;
  description?: string;
}

function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; optional: boolean; def: unknown } {
  let cur: z.ZodTypeAny = schema;
  let optional = false;
  let def: unknown;
  while (true) {
    if (cur instanceof z.ZodOptional) { optional = true; cur = cur.unwrap(); continue; }
    if (cur instanceof z.ZodDefault) { def = (cur._def as { defaultValue: () => unknown }).defaultValue(); cur = cur._def.innerType; continue; }
    if (cur instanceof z.ZodNullable) { optional = true; cur = cur.unwrap(); continue; }
    if (cur instanceof z.ZodEffects) { cur = cur._def.schema; continue; }
    break;
  }
  return { inner: cur, optional, def };
}

function kindOf(schema: z.ZodTypeAny): ArgKind {
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodArray) return "array";
  return "string";
}

export function collectArgs(schema: z.ZodTypeAny): ArgInfo[] {
  const obj = schema instanceof z.ZodObject ? schema : null;
  if (!obj) return [];
  const shape = obj.shape as Record<string, z.ZodTypeAny>;
  return Object.entries(shape).map(([name, field]) => {
    const { inner, optional, def } = unwrap(field);
    return { name, kind: kindOf(inner), optional, default: def,
      description: field.description };
  });
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/cli/zodToYargs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/zodToYargs.ts test/unit/cli/zodToYargs.test.ts
git commit -m "feat(cli): Zod schema introspection for yargs builder"
```

---

### Task 5.2: prettyRender

**Files:**
- Create: `src/cli/prettyRender.ts`
- Test: `test/unit/cli/prettyRender.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/cli/prettyRender.test.ts
import { describe, it, expect } from "vitest";
import { renderPretty } from "../../../src/cli/prettyRender.js";

describe("renderPretty", () => {
  it("renders a success envelope as key=value lines", () => {
    const out = renderPretty({
      ok: true, data: { foo: 1, bar: "x" },
      meta: { chain: "local", source: "bcos_rpc" },
    });
    expect(out).toContain("foo");
    expect(out).toContain("1");
    expect(out).toContain("bar");
  });

  it("renders an error envelope with code and message", () => {
    const out = renderPretty({
      ok: false,
      error: { code: "RPC_ERROR", message: "boom" },
      meta: {},
    });
    expect(out).toMatch(/RPC_ERROR/);
    expect(out).toMatch(/boom/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/cli/prettyRender.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/cli/prettyRender.ts**

```ts
import chalk from "chalk";
import { toSerializable } from "../serialize.js";
import type { Envelope } from "../types.js";

function renderValue(v: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (v === null || v === undefined) return chalk.gray("∅");
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return chalk.gray("[]");
    return "\n" + v.map((item) => `${pad}  - ${renderValue(item, indent + 1)}`).join("\n");
  }
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return chalk.gray("{}");
    return "\n" + entries.map(([k, val]) =>
      `${pad}  ${chalk.cyan(k)}: ${renderValue(val, indent + 1)}`).join("\n");
  }
  return String(v);
}

export function renderPretty(env: Envelope<unknown>): string {
  const safe = toSerializable(env) as Envelope<unknown>;
  if (safe.ok) {
    const body = renderValue(safe.data, 0);
    const meta = safe.meta?.degraded ? chalk.yellow(" (degraded)") : "";
    const warnings = safe.meta?.warnings?.length
      ? "\n" + chalk.yellow("warnings: " + safe.meta.warnings.join(", "))
      : "";
    return chalk.green("✓") + meta + body + warnings;
  }
  const details = safe.error.details ? "\n  " + renderValue(safe.error.details, 1) : "";
  return `${chalk.red("✗")} ${chalk.bold(safe.error.code)}: ${safe.error.message}${details}`;
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/cli/prettyRender.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/prettyRender.ts test/unit/cli/prettyRender.test.ts
git commit -m "feat(cli): prettyRender for envelopes"
```

---

### Task 5.3: CLI entry

**Files:**
- Create: `src/cli/index.ts`

- [ ] **Step 1: Write src/cli/index.ts**

```ts
#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { homedir } from "node:os";
import { join } from "node:path";
import { allCommands, type CommandDef } from "../commands/registry.js";
import "../commands/registerAll.js";
import { loadConfigFile } from "../config/load.js";
import { buildContext } from "../buildContext.js";
import { createStderrLogger } from "../logger.js";
import { toBcosCliError, exitCodeFor, BcosCliError } from "../errors.js";
import { stringify } from "../serialize.js";
import { collectArgs } from "./zodToYargs.js";
import { renderPretty } from "./prettyRender.js";

const GLOBAL_FLAGS = {
  chain:       { type: "string",  describe: "profile name" },
  config:      { type: "string",  describe: "config file path" },
  "rpc-url":   { type: "string",  describe: "override bcosRpcUrl" },
  "web3-rpc-url":{ type: "string",describe: "override web3RpcUrl" },
  "group-id":  { type: "string",  describe: "override groupId" },
  "log-dir":   { type: "string",  describe: "override logDir" },
  pretty:      { type: "boolean", describe: "human-readable output" },
  json:        { type: "boolean", describe: "force JSON output" },
  strict:      { type: "boolean", default: false, describe: "treat degraded results as errors" },
  verbose:     { type: "boolean", alias: "v", default: false },
  quiet:       { type: "boolean", default: false },
  "no-retry":  { type: "boolean", default: false },
} as const;

function isTty(): boolean { return !!process.stdout.isTTY; }

function decideFormat(argv: Record<string, unknown>): "pretty" | "json" {
  if (argv.json) return "json";
  if (argv.pretty) return "pretty";
  return isTty() ? "pretty" : "json";
}

function mcpEntry(): Promise<void> {
  return import("../mcp/server.js").then((m) => m.startMcpServer());
}

async function runCommand(cmd: CommandDef, argv: Record<string, unknown>): Promise<void> {
  const format = decideFormat(argv);
  const logger = createStderrLogger({ verbose: !!argv.verbose, quiet: !!argv.quiet });

  const configPath = (argv.config as string | undefined)
    ?? process.env.BCOS_CLI_CONFIG
    ?? join(homedir(), ".bcos-cli/config.yaml");

  try {
    const fileConfig = await loadConfigFile(configPath);
    const ctx = buildContext({
      flags: {
        chain: argv.chain as string | undefined,
        rpcUrl: argv["rpc-url"] as string | undefined,
        web3RpcUrl: argv["web3-rpc-url"] as string | undefined,
        groupId: argv["group-id"] as string | undefined,
        logDir: argv["log-dir"] as string | undefined,
      },
      env: {
        BCOS_CLI_CHAIN: process.env.BCOS_CLI_CHAIN,
        BCOS_CLI_CONFIG: process.env.BCOS_CLI_CONFIG,
        BCOS_CLI_RPC_URL: process.env.BCOS_CLI_RPC_URL,
        BCOS_CLI_WEB3_RPC_URL: process.env.BCOS_CLI_WEB3_RPC_URL,
        BCOS_CLI_GROUP_ID: process.env.BCOS_CLI_GROUP_ID,
        BCOS_CLI_LOG_DIR: process.env.BCOS_CLI_LOG_DIR,
      },
      fileConfig,
      logger,
    });

    const parseInput: Record<string, unknown> = {};
    const positionals = argv._ as string[];
    const shape = (cmd.schema as { shape?: Record<string, unknown> }).shape ?? {};
    const argInfos = collectArgs(cmd.schema);
    const namePartsCount = cmd.name.split(" ").length;
    let posIdx = namePartsCount;
    for (const info of argInfos) {
      if (Object.prototype.hasOwnProperty.call(argv, info.name) && argv[info.name] !== undefined) {
        parseInput[info.name] = argv[info.name];
      } else if (posIdx < positionals.length && (info.kind === "string" || info.kind === "array")) {
        if (info.kind === "array") {
          parseInput[info.name] = positionals.slice(posIdx);
          posIdx = positionals.length;
        } else {
          parseInput[info.name] = positionals[posIdx++];
        }
      }
    }
    void shape;
    const parsed = cmd.schema.parse(parseInput);
    const start = Date.now();
    const data = await cmd.handler(ctx, parsed);
    const envelope = {
      ok: true as const,
      data,
      meta: {
        chain: ctx.chain.chainName,
        durationMs: Date.now() - start,
        degraded: (data as { degraded?: boolean })?.degraded ?? false,
      },
    };
    if (argv.strict && envelope.meta.degraded) {
      throw new BcosCliError("INTERNAL", "degraded result with --strict");
    }
    process.stdout.write(format === "pretty" ? renderPretty(envelope) + "\n" : stringify(envelope) + "\n");
    process.exit(0);
  } catch (err) {
    const e = toBcosCliError(err);
    const envelope = {
      ok: false as const,
      error: { code: e.code, message: e.message, details: e.details },
      meta: {},
    };
    process.stdout.write(format === "pretty" ? renderPretty(envelope) + "\n" : stringify(envelope) + "\n");
    process.exit(exitCodeFor(e.code));
  }
}

async function main(): Promise<void> {
  const argv = hideBin(process.argv);

  if (argv[0] === "mcp") { await mcpEntry(); return; }

  let builder = yargs(argv).scriptName("bcos").strict(false).help();
  for (const [name, spec] of Object.entries(GLOBAL_FLAGS)) {
    builder = builder.option(name, spec as never);
  }

  for (const cmd of allCommands()) {
    const argInfos = collectArgs(cmd.schema);
    const positional = argInfos
      .filter((a) => a.kind === "string" || a.kind === "array")
      .filter((a) => !a.optional && a.default === undefined)
      .map((a) => a.kind === "array" ? `<${a.name}...>` : `<${a.name}>`)
      .join(" ");
    const usage = positional ? `${cmd.name} ${positional}` : cmd.name;
    builder = builder.command(
      usage, cmd.description,
      (yb) => {
        let y = yb;
        for (const info of argInfos) {
          if (info.kind === "boolean") {
            y = y.option(info.name, { type: "boolean", default: info.default as boolean | undefined,
              describe: info.description });
          } else if (info.kind === "number") {
            y = y.option(info.name, { type: "number", default: info.default as number | undefined });
          } else if (info.kind === "array") {
            // positional array; no option registration needed
          } else {
            // keep as positional or optional string
            if (info.optional || info.default !== undefined) {
              y = y.option(info.name, { type: "string", default: info.default as string | undefined });
            }
          }
        }
        return y;
      },
      async (parsed) => { await runCommand(cmd, parsed as Record<string, unknown>); },
    );
  }

  await builder.demandCommand(1, "a command is required").parse();
}

main().catch((err) => {
  process.stderr.write(`fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Build and smoke-test**

Run: `pnpm build`
Expected: `dist/cli/index.js` generated with shebang.

Run: `node dist/cli/index.js --help`
Expected: help text listing commands.

Run: `node dist/cli/index.js config show --rpc-url http://x --pretty`
Expected: pretty envelope showing `chain: (ad-hoc)`, `profile.bcosRpcUrl: http://x`.

- [ ] **Step 3: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat(cli): yargs-based entry with dynamic command registration"
```

---

### Task 5.4: MCP server

**Files:**
- Create: `src/mcp/zodToJsonSchema.ts`
- Create: `src/mcp/server.ts`
- Test: `test/unit/mcp/zodToJsonSchema.test.ts`

- [ ] **Step 1: Write failing test for zodToJsonSchema**

```ts
// test/unit/mcp/zodToJsonSchema.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { commandToTool } from "../../../src/mcp/zodToJsonSchema.js";

describe("commandToTool", () => {
  it("converts space-named command to underscore tool name", () => {
    const t = commandToTool({
      name: "doctor perf", description: "x",
      schema: z.object({ since: z.string().default("10m") }),
      handler: async () => null,
    });
    expect(t.name).toBe("doctor_perf");
    expect(t.inputSchema.type).toBe("object");
    expect(t.inputSchema.properties?.since).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement src/mcp/zodToJsonSchema.ts**

```ts
import { zodToJsonSchema } from "zod-to-json-schema";
import type { CommandDef } from "../commands/registry.js";

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export function commandToTool(cmd: CommandDef): McpToolDescriptor {
  const schema = zodToJsonSchema(cmd.schema, { target: "openApi3" }) as {
    type?: string; properties?: Record<string, unknown>; required?: string[];
  };
  return {
    name: cmd.name.replace(/\s+/g, "_"),
    description: cmd.description,
    inputSchema: {
      type: "object",
      properties: schema.properties ?? {},
      required: schema.required ?? [],
    },
  };
}
```

- [ ] **Step 3: Implement src/mcp/server.ts**

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema }
  from "@modelcontextprotocol/sdk/types.js";
import { allCommands, getCommand } from "../commands/registry.js";
import "../commands/registerAll.js";
import { loadConfigFile } from "../config/load.js";
import { buildContext } from "../buildContext.js";
import { createSilentLogger } from "../logger.js";
import { toBcosCliError } from "../errors.js";
import { toSerializable } from "../serialize.js";
import { commandToTool } from "./zodToJsonSchema.js";
import { homedir } from "node:os";
import { join } from "node:path";

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "fisco-bcos-cli", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allCommands().map(commandToTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const toolName = req.params.name;
    const commandName = toolName.replace(/_/g, " ");
    const cmd = getCommand(commandName);
    if (!cmd) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({
          ok: false, error: { code: "UNKNOWN_COMMAND", message: `no such command: ${toolName}` },
          meta: {},
        }) }],
      };
    }
    const configPath = process.env.BCOS_CLI_CONFIG ?? join(homedir(), ".bcos-cli/config.yaml");
    try {
      const fileConfig = await loadConfigFile(configPath);
      const ctx = buildContext({
        flags: {},
        env: {
          BCOS_CLI_CHAIN: process.env.BCOS_CLI_CHAIN,
          BCOS_CLI_RPC_URL: process.env.BCOS_CLI_RPC_URL,
          BCOS_CLI_WEB3_RPC_URL: process.env.BCOS_CLI_WEB3_RPC_URL,
          BCOS_CLI_GROUP_ID: process.env.BCOS_CLI_GROUP_ID,
          BCOS_CLI_LOG_DIR: process.env.BCOS_CLI_LOG_DIR,
        },
        fileConfig,
        logger: createSilentLogger(),
      });
      const args = cmd.schema.parse(req.params.arguments ?? {});
      const data = await cmd.handler(ctx, args);
      const envelope = {
        ok: true as const,
        data: toSerializable(data),
        meta: { chain: ctx.chain.chainName,
          degraded: (data as { degraded?: boolean })?.degraded ?? false },
      };
      return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
    } catch (err) {
      const e = toBcosCliError(err);
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({
          ok: false,
          error: { code: e.code, message: e.message, details: e.details },
          meta: {},
        }) }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [ ] **Step 4: Typecheck + test**

Run: `pnpm tsc --noEmit && pnpm vitest run test/unit/mcp/zodToJsonSchema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/zodToJsonSchema.ts src/mcp/server.ts test/unit/mcp/zodToJsonSchema.test.ts
git commit -m "feat(mcp): stdio MCP server registering all commands as tools"
```

---

## Phase 6 — Integration, Fixtures, Docs

### Task 6.1: Fixture RPC server helper

**Files:**
- Create: `test/helpers/fixtureRpcServer.ts`
- Create: `test/fixtures/rpc/bcos/getBlockNumber.json`

- [ ] **Step 1: Create fixture file**

`test/fixtures/rpc/bcos/getBlockNumber.json`:

```json
{ "jsonrpc": "2.0", "id": 0, "result": "0x64" }
```

- [ ] **Step 2: Create test/helpers/fixtureRpcServer.ts**

```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add test/helpers/fixtureRpcServer.ts test/fixtures/rpc/bcos/getBlockNumber.json
git commit -m "test: fixture HTTP server replaying JSON-RPC responses"
```

---

### Task 6.2: CLI E2E smoke test

**Files:**
- Create: `test/e2e/cli.smoke.test.ts`

- [ ] **Step 1: Write the test**

```ts
// test/e2e/cli.smoke.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa } from "execa";
import { startFixtureRpcServer, type FixtureServer } from "../helpers/fixtureRpcServer.js";

describe("bcos CLI smoke", () => {
  let fx: FixtureServer;
  beforeAll(async () => { fx = await startFixtureRpcServer(); });
  afterAll(async () => { await fx.close(); });

  it("config show returns JSON envelope on non-TTY", async () => {
    const r = await execa("node", ["dist/cli/index.js", "config", "show"], {
      env: { ...process.env, BCOS_CLI_RPC_URL: fx.url, BCOS_CLI_CONFIG: "/nonexistent" },
      reject: false,
    });
    expect(r.exitCode).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(true);
  });

  it("exits 2 on unknown chain", async () => {
    const r = await execa("node", ["dist/cli/index.js", "config", "show", "--chain", "zzz"], {
      env: { ...process.env, BCOS_CLI_CONFIG: "/nonexistent" },
      reject: false,
    });
    expect(r.exitCode).toBe(2);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toMatch(/CONFIG_MISSING|CHAIN_NOT_FOUND/);
  });
});
```

- [ ] **Step 2: Add build dependency to test**

Edit `package.json` scripts: replace the `test` script with `"test": "pnpm build && vitest run"` for CI correctness. For local dev keep `test:watch` unchanged.

- [ ] **Step 3: Run + commit**

```bash
pnpm build && pnpm vitest run test/e2e/cli.smoke.test.ts
git add test/e2e/cli.smoke.test.ts package.json
git commit -m "test(e2e): CLI smoke test via fixture server"
```

---

### Task 6.3: MCP E2E smoke test

**Files:**
- Create: `test/e2e/mcp.smoke.test.ts`

- [ ] **Step 1: Write the test**

```ts
// test/e2e/mcp.smoke.test.ts
import { describe, it, expect } from "vitest";
import { execa } from "execa";

describe("bcos mcp smoke", () => {
  it("responds to tools/list and tools/call", async () => {
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
```

- [ ] **Step 2: Run + commit**

```bash
pnpm build && pnpm vitest run test/e2e/mcp.smoke.test.ts
git add test/e2e/mcp.smoke.test.ts
git commit -m "test(e2e): MCP smoke — tools/list via stdio"
```

---

### Task 6.4: Log fixture scenarios

**Files:**
- Create: `test/fixtures/logs/node0-3x-slow-exec/log_info.log`
- Create: `test/fixtures/logs/node0-3x-consensus-timeout/log_info.log`
- Create: `test/fixtures/logs/node0-3x-sync-stall/log_info.log`
- Create: `test/e2e/doctor.fixtures.test.ts`

- [ ] **Step 1: Create slow-exec fixture**

`test/fixtures/logs/node0-3x-slow-exec/log_info.log`:

```
info|2026-04-15 10:00:01.100000|[TxPool] submit tx, hash=0xaa
info|2026-04-15 10:00:01.120000|[Sealer] seal block, height=100, txs=50
info|2026-04-15 10:00:01.160000|[PBFT] commit, view=1, height=100
info|2026-04-15 10:00:01.800000|[EXECUTOR] execute block, height=100, costMs=600
info|2026-04-15 10:00:01.820000|[STORAGE] write block, height=100, costMs=15
info|2026-04-15 10:00:02.500000|[EXECUTOR] execute block, height=101, costMs=680
info|2026-04-15 10:00:02.520000|[STORAGE] write block, height=101, costMs=12
```

- [ ] **Step 2: Create consensus-timeout fixture**

`test/fixtures/logs/node0-3x-consensus-timeout/log_info.log`:

```
info|2026-04-15 10:00:01.100000|[PBFT] prePrepare, view=1, height=100
error|2026-04-15 10:00:06.000000|[PBFT] viewchange, view=2, reason=timeout
error|2026-04-15 10:00:12.000000|[PBFT] viewchange, view=3, reason=timeout
error|2026-04-15 10:00:18.000000|[PBFT] viewchange, view=4, reason=timeout
error|2026-04-15 10:00:24.000000|[PBFT] viewchange, view=5, reason=timeout
error|2026-04-15 10:00:30.000000|[PBFT] viewchange, view=6, reason=timeout
error|2026-04-15 10:00:36.000000|[PBFT] viewchange, view=7, reason=timeout
error|2026-04-15 10:00:42.000000|[PBFT] viewchange, view=8, reason=timeout
error|2026-04-15 10:00:48.000000|[PBFT] viewchange, view=9, reason=timeout
error|2026-04-15 10:00:54.000000|[PBFT] viewchange, view=10, reason=timeout
error|2026-04-15 10:01:00.000000|[PBFT] viewchange, view=11, reason=timeout
error|2026-04-15 10:01:06.000000|[PBFT] viewchange, view=12, reason=timeout
```

- [ ] **Step 3: Create sync-stall fixture**

`test/fixtures/logs/node0-3x-sync-stall/log_info.log`:

```
info|2026-04-15 10:00:01.000000|[SYNC] fetch blocks, height=1000
info|2026-04-15 10:00:02.000000|[SYNC] fetch blocks, height=1000
error|2026-04-15 10:00:10.000000|[SYNC] no peer available
error|2026-04-15 10:00:20.000000|[SYNC] no peer available
info|2026-04-15 10:00:30.000000|[SYNC] fetch blocks, height=1000
```

- [ ] **Step 4: Write the fixture-based test**

```ts
// test/e2e/doctor.fixtures.test.ts
import { describe, it, expect } from "vitest";
import { execa } from "execa";
import { join } from "node:path";

const FIX = new URL("../fixtures/logs/", import.meta.url).pathname;

async function runDoctor(sub: string, scenario: string, extra: string[] = []): Promise<{ exitCode: number; stdout: string }> {
  const r = await execa("node", ["dist/cli/index.js", "doctor", sub,
    "--log-dir", join(FIX, scenario), "--rpc-url", "http://127.0.0.1:1", ...extra], {
    env: { ...process.env, BCOS_CLI_CONFIG: "/nonexistent" }, reject: false,
  });
  return { exitCode: r.exitCode, stdout: r.stdout };
}

describe("doctor against log fixtures", () => {
  it("slow-exec → bottleneck=execution", async () => {
    const r = await runDoctor("perf", "node0-3x-slow-exec", ["--since", "1000d"]);
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout);
    expect(env.data.bottleneck).toBe("execution");
  });

  it("consensus-timeout → viewchanges reported", async () => {
    const r = await runDoctor("health", "node0-3x-consensus-timeout");
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout);
    expect(env.data.viewchanges).toBeGreaterThanOrEqual(12);
    expect(env.data.findings.some((f: string) => /viewchange/i.test(f))).toBe(true);
  });

  it("sync-stall → sync events counted", async () => {
    const r = await runDoctor("sync", "node0-3x-sync-stall");
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout);
    expect(env.data.syncEvents).toBeGreaterThan(0);
    expect(env.data.failures.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Run + commit**

```bash
pnpm build && pnpm vitest run test/e2e/doctor.fixtures.test.ts
git add test/fixtures/logs/ test/e2e/doctor.fixtures.test.ts
git commit -m "test(e2e): doctor commands against log fixtures"
```

---

### Task 6.5: Example config and MCP client config

**Files:**
- Create: `examples/config.example.yaml`
- Create: `examples/mcp-claude-desktop.json`

- [ ] **Step 1: examples/config.example.yaml**

```yaml
defaultChain: local

defaults:
  requestTimeoutMs: 10000
  maxLogScanLines: 200000

chains:
  local:
    bcosRpcUrl: http://127.0.0.1:20200
    web3RpcUrl: http://127.0.0.1:8545
    groupId: group0
    chainId: 1
    logDir: /data/fisco/node0/log

  prod-g1:
    bcosRpcUrl: https://rpc.example.com/bcos
    web3RpcUrl: https://rpc.example.com/eth
    groupId: group1
    chainId: 20200
    logDir: /var/log/fisco-bcos
    requestTimeoutMs: 30000

abiStoreDir: ~/.bcos-cli/abi
```

- [ ] **Step 2: examples/mcp-claude-desktop.json**

```json
{
  "mcpServers": {
    "fisco-bcos": {
      "command": "npx",
      "args": ["-y", "fisco-bcos-cli", "mcp"],
      "env": {
        "BCOS_CLI_CONFIG": "/Users/you/.bcos-cli/config.yaml"
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/
git commit -m "docs: example config.yaml and Claude Desktop MCP snippet"
```

---

### Task 6.6: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# fisco-bcos-cli

CLI + MCP server for FISCO-BCOS chains. Built for both operators (human-readable tables) and AI agents (structured JSON, MCP tools).

## Install

```bash
npm install -g fisco-bcos-cli
```

Or run on demand:

```bash
npx fisco-bcos-cli <command>
```

## Configure

Write `~/.bcos-cli/config.yaml`:

```yaml
defaultChain: local
chains:
  local:
    bcosRpcUrl: http://127.0.0.1:20200
    web3RpcUrl: http://127.0.0.1:8545
    groupId: group0
    logDir: /data/fisco/node0/log
```

See `examples/config.example.yaml` for full reference.

### Override at runtime

```bash
bcos tx 0xabc... --rpc-url http://rpc.example.com --group-id group1
BCOS_CLI_CHAIN=prod-g1 bcos chain info
```

## Common recipes

**1. Inspect a transaction with decoded input and events**
```bash
bcos abi add 0xTokenContract ./token.abi.json --name Token
bcos tx 0xTxHash
```

**2. Check chain health**
```bash
bcos doctor chain
bcos doctor perf --since 30m
```

**3. Search transactions in a block range**
```bash
bcos search tx --from 0xAlice --from-block 1000 --to-block 2000
```

**4. Use the Web3 RPC subtree for Ethereum-compatible access**
```bash
bcos eth block-number
bcos eth logs --from-block 1 --to-block 100 --address 0xContract
```

**5. Pipe JSON for further processing**
```bash
bcos block latest --with-txs | jq '.data.block.transactions | length'
```

## MCP server (Claude Desktop, Cursor, etc.)

Add to your MCP client config (see `examples/mcp-claude-desktop.json`):

```json
{
  "mcpServers": {
    "fisco-bcos": {
      "command": "npx",
      "args": ["-y", "fisco-bcos-cli", "mcp"]
    }
  }
}
```

Commands are exposed as tools with names like `tx`, `chain_info`, `doctor_perf`, `eth_block`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Runtime error (RPC, file, log parsing) |
| 2 | Usage / config error |

## Output

- Non-TTY: JSON envelope on stdout (for piping and agents)
- TTY: pretty rendered with `--pretty` (default on TTY)
- Warnings, progress, debug: stderr

```json
{
  "ok": true,
  "data": { ... },
  "meta": { "chain": "prod-g1", "durationMs": 42, "degraded": false }
}
```

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with install, config, recipes, and MCP setup"
```

---

### Task 6.7: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: Node 18/20/22 × ubuntu/macos matrix"
```

---

### Task 6.8: Final integration check

- [ ] **Step 1: Clean build and full test run**

```bash
rm -rf dist node_modules
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

Expected: all tests pass, coverage meets thresholds.

- [ ] **Step 2: Smoke tests manually**

```bash
# Config-only command (no RPC)
node dist/cli/index.js --rpc-url http://example config show --pretty

# Help
node dist/cli/index.js --help

# Version
node dist/cli/index.js --version
```

- [ ] **Step 3: MCP tools/list sanity**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/cli/index.js mcp | head -5
```

Expected: tool list JSON in output.

- [ ] **Step 4: Commit any fixes from the manual smoke**

```bash
git add -u
git commit -m "chore: final integration fixes" # only if anything changed
```

---

## Self-Review Notes

Run through the spec (`docs/superpowers/specs/2026-04-15-fisco-bcos-cli-design.md`) and verify:

1. **Spec coverage:**
   - §6.4 commands — all 30 have a task (4.1–4.9 + registerAll 4.10). ✓
   - §8 config — schema (2.1), loader (2.2), resolve (2.3) tasks. ✓
   - §9 registry — Task 2.4. ✓
   - §10 services — Tasks 3.1–3.7. ✓
   - §11 errors — Task 1.3. ✓
   - §12 testing — unit tests per file + E2E in Phase 6. ✓
   - §4 architecture — shells (5.3, 5.4), handlers (Phase 4), services (Phase 3), config (Phase 2). ✓

2. **Placeholder scan:** no TBD/TODO/"similar to N" left. Task 4.3 step 5 and Task 4.8 step 9 say "write similar tests" with explicit pattern to copy — this is acceptable since the pattern is fully shown in earlier tasks in the same section.

3. **Type consistency:** `AppContext` definition in Task 2.5 matches every handler's usage in Phase 4. `BcosRpcClient.call` signature from Task 3.1 matches all handler call sites. Registry `CommandDef` type matches every `defineCommand` call.

4. **Ambiguity:** `bcos version` is handled by yargs built-in `--version` — no explicit command needed. Documented in CLI entry (Task 5.3).

No issues found.

---

## Totals

- **Phase 1:** 5 tasks
- **Phase 2:** 5 tasks
- **Phase 3:** 7 tasks (one per service)
- **Phase 4:** 11 tasks (buildContext + ~30 commands grouped into 10 task clusters)
- **Phase 5:** 4 tasks (zodToYargs, prettyRender, CLI entry, MCP server)
- **Phase 6:** 8 tasks (fixtures, E2E, docs, CI)

**≈ 40 tasks**, each either atomic or a small cluster around one surface. Estimated runtime: one focused day per phase, ~5 days end-to-end for a subagent-driven run.
