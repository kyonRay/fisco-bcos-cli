# fisco-bcos-cli — AI Handoff Document

**Last updated:** 2026-04-16 (post-Phase 5)
**Status:** Phases 1–5 complete. 138/138 tests green. Phase 6 not started.
**Your role:** Controller AI driving subagent-driven development.

---

## 0. Read-first primer

You are continuing a TypeScript CLI + MCP server build for FISCO-BCOS chains. Phases 1–5 are done. The user expects you to execute Phase 6 (Integration, Fixtures, Docs) next.

**Authoritative docs:**
1. `docs/superpowers/specs/2026-04-15-fisco-bcos-cli-design.md` — design spec
2. `docs/superpowers/plans/2026-04-15-fisco-bcos-cli.md` — implementation plan with verbatim code
3. This file — session state

---

## 1. Where we are

### Repo
- Path: `/Users/kyonguo/workspace/code/bcos-cli`
- Branch: `master` @ `67d7dcb`
- 40 test files, **138 tests**, tsc clean

### Completed phases

| Phase | Tasks | Tests added | Key commits |
|---|---|---|---|
| 1 Foundation | 1.1–1.5 | 27 | types, errors, serialize, validators |
| 2 Config & Registry | 2.1–2.5 | 28 | config schema/load/resolve, registry, context+logger+stubs |
| 3 Services (parallel) | 3.1–3.7 | 29 | bcosRpc, web3Rpc, abiRegistry, txDecoder, logReader, logParser, perfAnalyzer |
| 4 Handlers (parallel batches) | 4.0–4.10 | 49 | buildContext, tx, basic reads, chain state, abi mgmt, event+search, doctor rpc/log, eth subtree, config cmds, registerAll |
| 5 Shells | 5.1–5.4 | 5 | zodToYargs, prettyRender, CLI entry (yargs), MCP server (stdio) |

### Source tree overview
```
src/
  types.ts, errors.ts, serialize.ts, validators.ts, logger.ts, context.ts, buildContext.ts
  config/{schema,load,resolve}.ts
  commands/{registry,registerAll,tx,block,receipt,account,code,call,event,search}.ts
  commands/chain/{info,peers,groupList,consensus}.ts
  commands/abi/{add,list,show,rm}.ts
  commands/doctor/{tx,chain,perf,health,sync}.ts
  commands/eth/{block,tx,receipt,call,logs,chainId,gasPrice,blockNumber}.ts
  commands/config/{show,listChains}.ts
  cli/{index,zodToYargs,prettyRender}.ts
  mcp/{server,zodToJsonSchema}.ts
```

---

## 2. Next work: Phase 6

Phase 6 = Integration, Fixtures, Docs. Per plan execution strategy:

| Task | Mode | Description |
|---|---|---|
| 6.1 | parallel batch | Fixture RPC server helper |
| 6.4 | parallel batch | Log fixture scenarios |
| 6.5 | parallel batch | Example config + MCP client config |
| 6.2 | serial (after build) | CLI E2E smoke test |
| 6.3 | serial (after build) | MCP E2E smoke test |
| 6.6 | serial | README |
| 6.7 | serial | CI workflow |
| 6.8 | serial | Final integration check |

After 6.8, dispatch final whole-repo reviewer (opus), then stop for user.

---

## 3. Rules

Same as prior handoff. Key points:
- 3-stage review per task (implementer → spec → quality). Can relax for verbatim-paste tasks.
- `.js` suffix on all relative imports
- `BcosCliError(code, message, details?, cause?)` — don't embed code in message
- Don't push, don't PR, don't use --no-verify
- Subagents never merge; controller merges

### Engineering conventions accumulated through Phases 1–5

All Phase 1–3 conventions still apply (see plan §Execution Strategy). Additional from Phase 4–5:

- **ESM module caching in tests**: `beforeEach(() => { __resetRegistry(); import("...") })` is broken — ESM caches the module so `defineCommand` runs only on first import. Two patterns work: (a) `vi.resetModules()` + dynamic import in each `beforeEach`, or (b) `beforeAll` for import + accept registry persists across tests in that describe block. Subagents discovered this independently across multiple tasks.
- **event.ts / search.ts** wrap `defineCommand` in an exported `register()` function with idempotency guard, called at module level. `registerAll.ts` imports them as side-effect modules and it works because `register()` runs.
- **`@modelcontextprotocol/sdk`** installed at v1.29.0.
- **`chalk`** v5.6.2 (ESM-only). prettyRender uses it for colored output.
- **`yargs`** + `@types/yargs` installed. CLI entry uses yargs with dynamic command registration from the registry.

---

## 4. Observation backlog

All prior observations still apply. New from Phase 4–5:
- `buildContext` creates a dummy logReader with `logDir: "/__no_log_dir__"` when no logDir configured. `requireLogDir` throws before any log command runs, so the dummy is never used — but it's ugly. Could be improved to a lazy-init pattern.
- CLI `process.exit()` in `runCommand` makes unit-testing the CLI entry hard. E2E tests (Phase 6) are the coverage path.

---

## 5. Quick-start for Phase 6

Read plan lines ~4344–4933 for Tasks 6.1–6.8. Dispatch 6.1, 6.4, 6.5 as a parallel batch first (fixture creation is read-only to codebase). Then 6.2, 6.3 serial after build. Then 6.6, 6.7, 6.8 serial.
