# fisco-bcos-cli — Design Spec

**Date:** 2026-04-15
**Status:** Draft — awaiting user review
**Package name:** `fisco-bcos-cli`
**Binary name:** `bcos`

---

## 1. Goals and Non-goals

### 1.1 Goals

- Provide a first-class CLI for FISCO-BCOS chains that is equally useful to human operators (pretty output) and AI agents (JSON output, MCP server).
- Wrap both FISCO-BCOS native JSON-RPC (hereafter **BCOS RPC**) and the Ethereum-compatible **Web3 RPC** exposed by FISCO-BCOS nodes.
- Decode transaction inputs, event logs, and contract errors using a user-managed ABI registry so agents consume structured, already-interpreted data.
- Diagnose chain problems: single-transaction failure root cause, whole-chain health checks via RPC, and deep performance/health analysis by parsing local FISCO-BCOS 3.x node log files (identifying whether the bottleneck is tx-pool packaging, consensus, execution, or storage write).
- Ship an MCP server from the same binary so Claude Desktop, Cursor, and other MCP-capable agents can invoke commands as typed tools without spawning subprocesses per call.

### 1.2 Non-goals (explicitly out of MVP scope)

- Writing transactions, deploying contracts, or any operation that requires private keys. The configuration schema will not include a private-key field.
- Compiling Solidity. Users register pre-compiled ABI JSON via `bcos abi add`.
- Local block indexing or a SQLite cache of historical data. Search commands scan via RPC.
- Subscriptions / WebSocket real-time event streams.
- Integration with external block explorers, signature databases (4byte.directory), or contract verification services. The architecture leaves extension points but the MVP stays self-contained.
- FISCO-BCOS 2.x support for log parsing. Only 3.x log format is handled in MVP. Future compatibility would be added behind a `--log-format` switch.
- Docker image, single-binary builds (`bun build --compile`, `pkg`). MVP ships via npm only.

---

## 2. Target Users & Distribution

- **Primary:** SRE / DevOps operators running or monitoring FISCO-BCOS deployments, and AI agents invoked via MCP.
- **Language:** TypeScript targeting Node.js ≥ 18, ESM output.
- **Distribution:** npm package `fisco-bcos-cli`. Global install (`npm i -g fisco-bcos-cli`) or one-shot (`npx fisco-bcos-cli ...`). MCP clients configure `npx fisco-bcos-cli mcp` as the command.
- **Output defaults:** TTY stdout → `--pretty`; non-TTY stdout → `--json` (agents and pipes get JSON automatically). MCP mode always returns JSON.

---

## 3. Interface Modes

The same codebase and binary expose:

| Mode | Entry | Use case |
|---|---|---|
| CLI | `bcos <command> ...` | Humans + shell scripts |
| MCP stdio server | `bcos mcp` | Claude Desktop, Cursor, any MCP client |

A single command registry feeds both shells. Adding a new command means registering it once; both shells pick it up.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Entry Shells                                            │
│  ├── cli/index.ts          bcos <cmd>        (yargs)     │
│  └── mcp/server.ts         bcos mcp          (@mcp/sdk)  │
└──────────────┬──────────────────────────────────────────┘
               │ shells only: parse args → call handler → serialize
               ↓
┌─────────────────────────────────────────────────────────┐
│  Command Handlers (pure functions)                       │
│  defineCommand({ name, description, schema, handler })   │
│  handler(ctx, args) → data object                        │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│  Services (external I/O; interface-typed, injectable)    │
│  ├── BcosRpcClient       BCOS JSON-RPC (with groupId)    │
│  ├── Web3RpcClient       viem.createPublicClient         │
│  ├── AbiRegistry         ~/.bcos-cli/abi/*.json store    │
│  ├── TxDecoder           input + log decoding            │
│  ├── LogFileReader       BCOS 3.x log file traversal     │
│  ├── LogParser           log line → structured event     │
│  └── PerfAnalyzer        events → phase histogram        │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│  Config Layer — resolveActiveChain(flags, env, file)     │
└─────────────────────────────────────────────────────────┘
```

### 4.1 Design principles

- **Handlers are pure.** They accept `(ctx, args)`, return a data object. No `console.log`, no `process.exit`. Tests inject a fake `ctx`.
- **Single schema per command.** A Zod schema drives CLI argparse (via `zodToYargs`), MCP tool schema (via `zodToJsonSchema`), and runtime validation.
- **Services are interfaces.** Default implementations use `fetch` / `viem` / `node:fs`. Tests inject stubs.
- **Context injection, no singletons.** `ctx = { bcosRpc, web3Rpc, abiRegistry, logReader, config, logger }` built once per invocation.
- **Output separation.** `stdout` carries data only. `stderr` carries progress, warnings, debug. Non-TTY disables color on `--pretty`.

---

## 5. Directory Structure

```
fisco-bcos-cli/
├── package.json              "bin": { "bcos": "./dist/cli/index.js" }
├── tsconfig.json             strict, types: ["node"], ESM
├── vitest.config.ts
├── README.md
├── src/
│   ├── cli/
│   │   ├── index.ts          shebang, global flags, dispatch
│   │   ├── registerAll.ts    imports all command modules
│   │   ├── prettyRender.ts   data → table/colored text
│   │   └── zodToYargs.ts
│   ├── mcp/
│   │   ├── server.ts
│   │   └── zodToJsonSchema.ts
│   ├── commands/
│   │   ├── registry.ts       defineCommand / allCommands / getCommand
│   │   ├── block.ts
│   │   ├── tx.ts
│   │   ├── receipt.ts
│   │   ├── account.ts
│   │   ├── code.ts
│   │   ├── call.ts
│   │   ├── chain/{info,peers,groupList,consensus}.ts
│   │   ├── abi/{add,list,show,rm}.ts
│   │   ├── event.ts
│   │   ├── search.ts
│   │   ├── doctor/{tx,chain,perf,health,sync}.ts
│   │   ├── eth/{block,tx,receipt,call,logs,chainId,gasPrice,blockNumber}.ts
│   │   └── config/{show,listChains}.ts
│   ├── services/
│   │   ├── bcosRpc.ts
│   │   ├── web3Rpc.ts
│   │   ├── abiRegistry.ts
│   │   ├── txDecoder.ts
│   │   ├── logReader.ts
│   │   ├── logParser.ts
│   │   └── perfAnalyzer.ts
│   ├── config/
│   │   ├── schema.ts
│   │   ├── load.ts
│   │   └── resolve.ts
│   ├── context.ts            buildContext(config, chainName) → AppContext
│   ├── errors.ts             BcosCliError + ErrorCode union
│   ├── serialize.ts          bigint → decimal string
│   ├── validators.ts         hex address / hash / block tag
│   └── types.ts              shared types
├── test/
│   ├── unit/                 mirrors src/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│       ├── rpc/{bcos,web3}/
│       └── logs/{node0-3x-healthy,node0-3x-slow-exec,...}/
├── docs/superpowers/specs/
└── examples/{config.example.yaml,mcp-claude-desktop.json}
```

---

## 6. Commands

### 6.1 Global flags

```
--chain <name>        Profile name (default: fileConfig.defaultChain)
--config <path>       Config file (default: ~/.bcos-cli/config.yaml)
--rpc-url <url>       Override bcosRpcUrl
--web3-rpc-url <url>  Override web3RpcUrl
--group-id <id>       Override groupId
--log-dir <path>      Override logDir
--pretty              Human output (default on TTY)
--json                Force JSON (default on non-TTY)
--strict              Treat degraded responses as errors
--no-retry            Disable RPC retry
--quiet               Suppress stderr progress/warnings
--verbose, -v         Debug logs to stderr
--help, -h
--version
```

### 6.2 Environment variable mapping

```
BCOS_CLI_CHAIN          → --chain
BCOS_CLI_CONFIG         → --config
BCOS_CLI_RPC_URL        → --rpc-url
BCOS_CLI_WEB3_RPC_URL   → --web3-rpc-url
BCOS_CLI_GROUP_ID       → --group-id
BCOS_CLI_LOG_DIR        → --log-dir
```

### 6.3 Argument and output conventions

- Addresses and hashes accept with or without `0x`; output always has `0x` and addresses are EIP-55 checksummed.
- Block argument accepts decimal string / `latest` / `earliest` / `pending` / block hash.
- Numeric fields that may exceed `Number.MAX_SAFE_INTEGER` (block number, nonce, gas, value, ns timestamp) serialize as **decimal strings** in JSON; `--pretty` renders with thousands separators and units.
- Exit codes: `0` success; `1` runtime error; `2` usage/config error.

### 6.4 Command list

**Basic reads (BCOS RPC)**

```
bcos block <block> [--with-txs]
bcos tx <hash> [--no-decode]
bcos receipt <hash>
bcos account <address>
bcos code <address>
bcos call <address> <method> [args...] [--abi <path|address>]
```

**Chain / node state (BCOS RPC)**

```
bcos chain info
bcos peers
bcos group list
bcos consensus status
```

**ABI & events**

```
bcos abi add <address> <abi.json> [--name <n>]
bcos abi list
bcos abi show <address>
bcos abi rm <address>
bcos event <address> --from-block <n> --to-block <n> [--name <eventName>]
bcos search tx [--from <addr>] [--to <addr>] --from-block <n> --to-block <n>
```

**Doctor (diagnostics)**

```
bcos doctor tx <hash>                 # single-tx failure root cause (RPC)
bcos doctor chain                     # whole-chain health check (RPC)
bcos doctor perf   [--since <dur>]    # phase-time breakdown (logDir required)
bcos doctor health                    # severe-problem scan (logDir required)
bcos doctor sync                      # sync-state report (logDir required)
```

`--since` accepts `10m`, `2h`, `1d`.

**Web3 RPC subtree**

```
bcos eth block <block> [--with-txs]
bcos eth tx <hash>
bcos eth receipt <hash>
bcos eth call <address> <data>
bcos eth logs --from-block <n> --to-block <n> [--address <a>] [--topic <t>]
bcos eth chain-id
bcos eth gas-price
bcos eth block-number
```

**Utility**

```
bcos config show                      # print merged effective config
bcos config list-chains               # list all profiles
bcos mcp                              # start stdio MCP server
bcos version
```

### 6.5 JSON output envelope

Success:
```json
{
  "ok": true,
  "data": { "...": "command-specific" },
  "meta": {
    "chain": "prod-g1",
    "source": "bcos_rpc",
    "durationMs": 42,
    "degraded": false,
    "warnings": []
  }
}
```

Failure:
```json
{
  "ok": false,
  "error": {
    "code": "RPC_ERROR",
    "message": "short human sentence",
    "details": { "rpcCode": -32000, "rpcMessage": "..." }
  },
  "meta": { "chain": "prod-g1" }
}
```

### 6.6 Sub-command names in MCP

Registry keys use space-delimited full names: `"chain info"`, `"doctor perf"`, `"eth block"`. The CLI shell declares them as yargs nested commands. The MCP shell replaces spaces with underscores for tool names (`chain_info`, `doctor_perf`, `eth_block`) to comply with MCP tool-name conventions.

---

## 7. Output Conventions

- **JSON on stdout by default** for non-TTY; `--pretty` for TTY.
- **BigInt & large numbers → decimal strings** in JSON.
- **Errors are JSON too** in both CLI and MCP, using the envelope above.
- **Warnings, progress, debug go to stderr**, never stdout.
- **Provenance:** every response includes `meta.source` (`bcos_rpc` / `web3_rpc` / `log_file` / `mixed`) and `meta.degraded: boolean`.
- `--pretty` renderers are dispatched by result kind: `Block`, `Tx`, `Receipt`, `ChainInfo`, `Peers`, `DoctorPerf`, etc. Each has its own render function in `prettyRender.ts`.

---

## 8. Configuration

### 8.1 File format

Location: `~/.bcos-cli/config.yaml` (overridable via `--config` / `BCOS_CLI_CONFIG`).

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

### 8.2 Zod schema (sketch)

```ts
const ChainProfile = z.object({
  bcosRpcUrl: z.string().url(),
  web3RpcUrl: z.string().url().optional(),
  groupId: z.string().default("group0"),
  chainId: z.number().int().optional(),
  logDir: z.string().optional(),
  requestTimeoutMs: z.number().int().positive().optional(),
  maxLogScanLines: z.number().int().positive().optional(),
});

const ConfigFile = z.object({
  defaultChain: z.string(),
  defaults: ChainProfile.partial().optional(),
  chains: z.record(z.string(), ChainProfile),
  abiStoreDir: z.string().default("~/.bcos-cli/abi"),
});
```

### 8.3 Priority and resolution

Resolution happens in `src/config/resolve.ts` as a pure function:

1. Pick chain name: `flags.chain` > `env.BCOS_CLI_CHAIN` > `fileConfig.defaultChain`.
2. Look up `fileConfig.chains[name]`; shallow-merge with `fileConfig.defaults`.
3. Apply env overrides per field.
4. Apply flag overrides per field (highest priority).
5. Validate: `bcosRpcUrl` required; `logDir` required for doctor perf/health/sync.

Errors raised: `CHAIN_NOT_FOUND`, `CONFIG_MISSING`, `INVALID_CONFIG`, `LOG_DIR_REQUIRED`.

### 8.4 First-run behavior

If `~/.bcos-cli/config.yaml` does not exist:
- Commands needing RPC fail with `CONFIG_MISSING` unless `--rpc-url` or `BCOS_CLI_RPC_URL` is provided.
- `bcos config show` works and reports "no config file loaded".
- MVP does not auto-create config; README includes a template.

---

## 9. Command Registry

`src/commands/registry.ts`:

```ts
export interface CommandDef<S extends z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  capabilities?: {
    requiresLogDir?: boolean;
    requiresExplorer?: boolean;  // reserved for future
  };
  handler: (ctx: AppContext, args: z.infer<S>) => Promise<unknown>;
}
```

- Modules call `defineCommand(...)` at top level; `registerAll.ts` imports them so registration side-effects run.
- Both shells `import './registerAll'` to guarantee identical command sets.
- CLI shell iterates registry, generates yargs subcommands via `zodToYargs`.
- MCP shell iterates registry, generates MCP tools via `zodToJsonSchema`.

---

## 10. Service Responsibilities

| Service | Responsibility | External I/O |
|---|---|---|
| `BcosRpcClient` | BCOS JSON-RPC request/response, groupId injection, retry logic | `fetch` |
| `Web3RpcClient` | Ethereum-compatible RPC via viem `PublicClient` | `viem.http` |
| `AbiRegistry` | Read/write ABI JSON files under `abiStoreDir`; in-memory cache with mtime invalidation | `node:fs` |
| `TxDecoder` | Decode tx input, event logs, revert reasons using registered ABIs; viem `decodeFunctionData`, `decodeEventLog` | None |
| `LogFileReader` | Discover node log files (rotation-aware), stream lines with a byte/line budget | `node:fs` |
| `LogParser` | BCOS 3.x log line → structured event `{ timestamp, level, module, phase, durationMs, fields }` | None |
| `PerfAnalyzer` | Aggregate parsed events into phase histograms, bottleneck judgments | None |

### 10.1 Log parser (3.x)

Parses lines of the form emitted by FISCO-BCOS 3.x nodes. Recognizes module tags (`TxPool`, `Sealer`, `PBFT`, `Executor`, `Storage`) and common phase markers (`seal`, `commit`, `execute`, `write`). Emits structured events; unparsable lines are counted but not fatal. Exact regex details are an implementation detail and will be captured during implementation using real log samples in `test/fixtures/logs/`.

### 10.2 Perf analyzer

Given a window (`--since 10m`), produces:

```json
{
  "window": { "from": "...", "to": "..." },
  "stages": {
    "txpool":    { "p50Ms": "...", "p95Ms": "...", "p99Ms": "...", "count": "..." },
    "consensus": { ... },
    "execution": { ... },
    "storage":   { ... }
  },
  "bottleneck": "execution",
  "bottleneckReason": "execution p99 accounted for 64% of end-to-end block time"
}
```

Thresholds for bottleneck labeling are implementation-time constants validated against fixture logs.

---

## 11. Error Model

### 11.1 Error codes

**Usage / config (exit 2)**
- `INVALID_ARGUMENT` — bad flag or positional format
- `UNKNOWN_COMMAND`
- `CHAIN_NOT_FOUND` — `--chain` references unknown profile
- `CONFIG_MISSING` — no `bcosRpcUrl` from any source
- `INVALID_CONFIG` — YAML or schema failure
- `LOG_DIR_REQUIRED` — doctor command without logDir

**Runtime (exit 1)**
- `RPC_ERROR` — JSON-RPC error response
- `RPC_TIMEOUT`
- `RPC_UNREACHABLE` — network-level failure
- `NOT_FOUND` — tx/block/account missing
- `ABI_NOT_FOUND`
- `DECODE_FAILED` — ABI present, decode still failed
- `LOG_DIR_NOT_FOUND`
- `LOG_PARSE_FAILED`
- `FILE_IO_ERROR`
- `INTERNAL` — catch-all; includes stack in `details`

### 11.2 Shell-level handling

CLI shell catches at the top level, calls `writeError` → structured stdout JSON (or pretty red rendering), then `process.exit(exitCode)`.

MCP shell catches the same way, returns `{ isError: true, content: [{ type: "text", text: JSON.stringify(envelope) }] }`; server keeps running.

### 11.3 Retry policy

- Default: 2 retries with exponential backoff (200ms, 600ms) for `RPC_UNREACHABLE` and HTTP 5xx.
- JSON-RPC business errors are not retried.
- `--no-retry` disables.
- Each retry writes a warning to stderr (suppressed by `--quiet`).

### 11.4 Degradation

These return `ok: true` with `meta.degraded: true` / warnings rather than throwing:

| Situation | Behavior |
|---|---|
| Tx exists but ABI not registered | Return raw tx, warning `abi_not_found` |
| Partial decode in event-log batch | Undecoded entries keep `raw`; each log carries `decoded: null, decodeError` |
| `--with-txs` fails on some txs | Failing txs appear as `{ hash, error }` placeholders |
| `doctor perf` window has partial coverage | Result + warning `partial_window` |
| Individual log lines fail to parse | Count in `meta.stats.unparsedLines`, don't fail |

`--strict` promotes any degraded response to an error (exit 1), useful for CI.

---

## 12. Testing Strategy

### 12.1 Pyramid

```
   E2E (fixture server + CLI binary)  ~10
   Integration (handler → mocked svc) ~30
   Unit (per source file)             ~150
```

Framework: **Vitest**. ESM-native, fast, built-in coverage.

### 12.2 Unit focus areas

- `config/resolve.ts` — priority merge across all input combinations.
- `serialize.ts` — bigint, nested, circular, null/undefined.
- `validators.ts` — address/hash/block-tag edge cases.
- `services/bcosRpc.ts` — `fetch` mocked; success, JSON-RPC error, 5xx retry, timeout, unreachable.
- `services/txDecoder.ts` — fixture ABI + positive/negative cases.
- `services/logParser.ts` — BCOS 3.x samples → structured events.
- `services/perfAnalyzer.ts` — synthetic event streams → correct bottleneck.
- `errors.ts` — code → exit code mapping.
- `commands/registry.ts` — duplicate registration throws; iteration order stable.
- `cli/zodToYargs.ts` + `mcp/zodToJsonSchema.ts` — same schema produces semantically equivalent descriptors.

### 12.3 Integration

Per command, at least a happy path plus one error path. Fake `AppContext`; assert returned data shape and that mocked services were called with expected arguments. No subprocess, no CLI parsing.

### 12.4 E2E / fixtures

- **CLI smoke:** `execa` spawns compiled binary against a local fixture HTTP server that replays `test/fixtures/rpc/*.json` responses keyed by `method + params`.
- **Record mode:** `RECORD=1` env proxies misses to a real node and saves the response; disabled in CI.
- **MCP smoke:** spawn `bcos mcp`, drive via stdio, call `tools/list` and a couple of `tools/call`, assert JSON envelopes.
- **Doctor commands:** run against `test/fixtures/logs/node0-3x-*/` samples, one fixture per scenario (healthy, slow-exec, consensus-timeout, sync-stall).

### 12.5 Fixture layout

```
test/fixtures/
├── rpc/
│   ├── bcos/<method>_<paramHash>.json
│   └── web3/<method>_<paramHash>.json
└── logs/
    ├── node0-3x-healthy/
    ├── node0-3x-slow-exec/
    ├── node0-3x-consensus-timeout/
    └── node0-3x-sync-stall/
```

Log fixtures must be scrubbed of any production IPs or addresses.

### 12.6 Coverage thresholds

- `services/` + `config/` + `serialize.ts` + `errors.ts`: **≥90%** branch coverage.
- `commands/*`: **≥80%**.
- `cli/prettyRender.ts`: **≥60%**.
- Overall line coverage gate: **≥80%** in CI.

### 12.7 Isolation

- No test touches `~/.bcos-cli/`. Config loader accepts `homeDir`; tests pass a tmpdir.
- ABI registry path injected via ctx; in-memory implementation for most tests.
- Log reader accepts an absolute path; tests point to `fixtures/logs/`.

### 12.8 CI matrix

GitHub Actions: Node 18 / 20 / 22 × ubuntu-latest / macos-latest. Steps: `pnpm install` → `tsc --noEmit` → `lint` → `test` → `build`. Coverage threshold enforced in `vitest.config.ts`.

---

## 13. Out of scope (deferred)

1. `bcos config init` interactive wizard.
2. Writing transactions, keystores, signing.
3. Local SQLite caching of blocks/txs/events.
4. Block explorer integration (`ExplorerClient`).
5. Signature database integration (4byte.directory).
6. Sourcify contract verification integration.
7. HTTP server shell (`bcos serve`).
8. Library entry point (`import { ... } from 'fisco-bcos-cli/lib'`).
9. Single-binary distribution (`bun build --compile`, `pkg`).
10. Docker image.
11. FISCO-BCOS 2.x log format.
12. WebSocket / subscription streams.
13. Solidity compilation.

Each deferred item has a natural extension point in the architecture (new service, new command, new shell) so adding them later does not require restructuring.

---

## 14. Open Implementation Details

These are deliberately unresolved in the spec; they will be resolved during implementation against real data:

- Exact regex / parser grammar for BCOS 3.x log lines — requires real log samples captured in `test/fixtures/logs/`.
- Exact thresholds for `bottleneck` labeling in `PerfAnalyzer`.
- `chain info` field shape — depends on which BCOS RPC methods are available on the target version; will align with `getSystemConfigByKey` / `getSyncStatus` / `getPbftView` / `getGroupPeers`.
- `prettyRender` format for each result kind — iterated during implementation, driven by what reads cleanly in a terminal.

---

## 15. Success Criteria

MVP is considered done when:

1. All command listed in §6.4 are implemented, with handler unit tests and integration tests.
2. `bcos mcp` lists and executes all commands via MCP stdio and returns structured JSON envelopes.
3. `bcos doctor perf/health/sync` produces meaningful results on each log fixture in `test/fixtures/logs/`.
4. `bcos tx <hash>` with a registered ABI shows decoded input and decoded event logs; without registered ABI returns raw data with `meta.degraded: true`.
5. CI matrix (Node 18/20/22, ubuntu + macos) passes with ≥80% line coverage.
6. `npx fisco-bcos-cli version` runs against the published package.
7. README documents installation, config, MCP setup, and 5 common operator recipes.
