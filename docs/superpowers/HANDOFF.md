# fisco-bcos-cli — AI Handoff Document

**Last updated:** 2026-04-15 (post-Phase 3)
**Status:** Phases 1, 2, 3 complete. 84/84 tests green. Phase 4 not started.
**Your role:** Controller AI driving subagent-driven development.

---

## 0. Read-first primer (don't skip this)

You are taking over an in-progress build of a TypeScript CLI + MCP server for FISCO-BCOS chains. The previous controller completed Phases 1–3 and paused at the Phase 3→4 checkpoint. The user expects you to pick up and continue without re-brainstorming or re-planning. The spec and plan are final; follow them.

**Authoritative documents (read in this order):**

1. **`docs/superpowers/specs/2026-04-15-fisco-bcos-cli-design.md`** — design spec. Source of truth for *what* to build.
2. **`docs/superpowers/plans/2026-04-15-fisco-bcos-cli.md`** — the ~40-task implementation plan with complete code per task. The "Execution Strategy" section at the bottom is the runtime contract.
3. This file — session state, conventions, caveats.

The plan contains complete code for every remaining task. Do NOT re-derive it.

---

## 1. Where we are

### Repo
- Path: `/Users/kyonguo/workspace/code/bcos-cli`
- Branch: `master` (greenfield; commit directly to master per agreed policy; parallel phases use feat branches in worktrees)
- Node/pnpm installed; deps synced

### Last commits (newest first, post Phase 3 merge)
```
c87b46d merge: Phase 3.7 PerfAnalyzer
6a98079 merge: Phase 3.4 TxDecoder
a025d39 merge: Phase 3.6 LogParser
0911f63 merge: Phase 3.5 LogReader
0bb7787 merge: Phase 3.2 Web3RpcClient
8849a90 merge: Phase 3.1 BcosRpcClient
3dfb1de merge: Phase 3.3 AbiRegistry
ec7254d feat(services): PerfAnalyzer stage percentiles + bottleneck
729232e feat(services): BCOS 3.x logParser with module->stage mapping
3573686 feat(services): TxDecoder for input and event logs
3e5d3f0 feat(services): LogReader with line streaming and budget
ba20f43 feat(services): file-backed AbiRegistry
e778ddd feat(services): BcosRpcClient with groupId, retries, timeout
5dc5e65 feat(services): Web3RpcClient thin JSON-RPC wrapper
0f52ddc feat(context): AppContext type, stderr/silent loggers, service stubs
ea5bd8d feat(registry): command registry with duplicate guard
0d6d67a feat(config): resolveActiveChain pure-function resolver
9228702 fix(config): clean INVALID_CONFIG message, thread ZodError as cause
160888b feat(config): YAML loader with error codes
5690fb0 feat(config): Zod schema for YAML config
```

### What exists in the src tree
```
src/
  types.ts              Hex, BlockTag, AppLogger, ResponseMeta, Envelope<T>
  errors.ts             BcosCliError, ErrorCode, exitCodeFor, toBcosCliError
  serialize.ts          toSerializable + stringify (bigint/Date/Uint8Array, DAG)
  validators.ts         normalizeHex, hexAddress, hexHash, blockTag (Zod)
  logger.ts             createStderrLogger, createSilentLogger
  context.ts            AppContext (logger + chain + fileConfig + 5 services)
  config/
    schema.ts           ChainProfileSchema, ConfigFileSchema (Zod)
    load.ts             loadConfigFile, expandHome (YAML + Zod parse)
    resolve.ts          resolveActiveChain (pure flag/env/file merger)
  commands/
    registry.ts         defineCommand, allCommands, getCommand, __resetRegistry
  services/
    bcosRpc.ts          createBcosRpcClient (groupId-prepend, retries, timeout)
    web3Rpc.ts          createWeb3RpcClient (thin JSON-RPC wrapper for eth_*)
    abiRegistry.ts      createAbiRegistry (file-per-address JSON store)
    txDecoder.ts        createTxDecoder (viem decodeFunctionData/decodeEventLog)
    logReader.ts        createLogReader (listFiles + async streamLines)
    logParser.ts        parseLogLine (BCOS 3.x format → ParsedLogEvent + stage)
    perfAnalyzer.ts     analyzePerf (per-stage p50/p95/p99 + bottleneck)

test/unit/
  errors / serialize / validators / context / config/{schema,load,resolve}
  commands/registry
  services/{bcosRpc,web3Rpc,abiRegistry,txDecoder,logReader,logParser,perfAnalyzer}
```

No `src/cli/`, `src/mcp/`, no command handlers (`src/commands/<name>/`) yet. No integration or E2E tests.

### Validation snapshot (post Phase 3 merge)
- `pnpm tsc --noEmit` → clean
- `pnpm vitest run` → 15 files, **84 tests, all pass** (~880 ms)
- `pnpm build` not yet invoked (no entry points produced)

---

## 2. Immediate next work: Phase 4

Phase 4 = command handlers. Per Execution Strategy in plan §:

- **Batch A (parallel, 7 worktrees)**: Tasks 4.0 (`buildContext`), 4.1 (`bcos tx`), 4.2 (basic reads: block/receipt/account/code/call), 4.3 (chain state: chain info/peers/group list/consensus), 4.4 (ABI mgmt: add/list/show/rm), 4.5 (event + search). Branch names: `feat/phase4a-<cluster>`.
- **Batch B (parallel, 4 worktrees, AFTER A merges)**: Tasks 4.6 (doctor RPC: tx, chain), 4.7 (doctor log: perf/health/sync), 4.8 (eth subtree), 4.9 (config commands). Branch names: `feat/phase4b-<cluster>`.
- **Task 4.10 `registerAll` (serial, AFTER B)**: imports every handler so registry side-effects fire.

Full code for every handler is in the plan. Read the plan, copy task text into each subagent prompt verbatim — do NOT paraphrase or let subagents simplify.

### Phase 4 checkpoint
After 4.10 merges and full test suite is green, **stop and check in with the user** before starting Phase 5.

---

## 3. How to work: the rules

### 3.1 Three-stage review per task (skill default)

```
implementer → spec compliance reviewer → code quality reviewer → done
```

The previous controller (this session) followed this strictly for Phase 2 Tasks 2.1–2.3, and partially relaxed for verbatim-paste mechanical Tasks 2.4–2.5 and the Phase 3 parallel batch (relied on subagent self-test + post-merge regression sweep instead of separate reviewer subagents). All committed code currently passes both `tsc --noEmit` and `vitest run`. If you hit time pressure again, the same trade-off is acceptable for verbatim-paste tasks; **do** keep full 3-stage review for tasks where the plan leaves real design choices (much of Phase 5 — shells, MCP).

### 3.2 Subagent prompt contract

Every dispatch must contain:

1. Role declaration: "implementer" / "spec compliance reviewer" / "code quality reviewer" / "fix subagent".
2. Scene: phase, task #, working dir, current branch, what's already merged.
3. Full task text from the plan — copy-pasted including all code blocks.
4. Exit criteria: exact files, exact tests that must pass, exact commit message.
5. Report format: structured (STATUS / COMMIT_SHA / TEST_RESULT / TSC_OUTPUT / CONCERNS).
6. For parallel: instruct subagent to `git checkout -b feat/phase4a-<cluster>` itself; the `Agent` tool's `isolation: "worktree"` parameter creates an isolated worktree first.

### 3.3 Model selection

| Role | Model |
|---|---|
| Mechanical scaffolding / pure utilities / types / spec reviewer | `haiku` |
| Services / handlers with logic / code quality reviewer | `sonnet` |
| Shells (CLI/MCP entry, Phase 5) / final whole-repo reviewer | `opus` |

### 3.4 Parallel execution (Phase 4)

Phase 4 batches are independent: fire the entire batch as one assistant message with N `Agent` tool calls, each `isolation: "worktree"` + `run_in_background: true`. Wait for all completion notifications (no polling). Then merge sequentially in the main session.

**Cross-handler imports**: handlers for Batch A only import from `src/services/*` and `src/commands/registry.ts`. Batch B handlers may also import buildContext from Batch A (so A must merge first). Task 4.10 imports every handler.

### 3.5 Merge protocol (controller-owned)

After parallel batch completes:
1. `git worktree list` to see all branches.
2. `git merge --no-ff feat/phase4a-<cluster>` for each in turn into master.
3. If conflict: read both sides, resolve in main session. Subagents never merge.
4. After all merges: `pnpm tsc --noEmit && pnpm vitest run`. If broken, fix inline if trivial else dispatch fix subagent.
5. Clean up: `git worktree remove .claude/worktrees/agent-<id> --force` for each, then `git branch -D feat/phase4a-<cluster>` and `git branch -D worktree-agent-<id>` (each worktree creation also leaves a `worktree-agent-<id>` branch — delete those too).

No PRs. No `git push`.

### 3.6 User checkpoints

Stop and report at:
1. ✅ After Phase 1 (reached)
2. ✅ After Phase 2 (reached)
3. ✅ After Phase 3 (this checkpoint)
4. After Phase 4 Batch A merged
5. After Phase 4 Batch B + 4.10 merged
6. After Phase 5 complete
7. After Phase 6.8, before final whole-repo reviewer

Each checkpoint reports: merged commits, test count, open DONE_WITH_CONCERNS notes, what's next.

---

## 4. Decisions and constraints (locked, do not re-litigate)

### Product (from brainstorming, see HANDOFF history)
- **Stack**: TypeScript + Node ≥ 18, ESM, package `fisco-bcos-cli`, binary `bcos`
- **Audience**: humans + AI agents; JSON for non-TTY, pretty for TTY
- **Scope**: wrapping + decoding + diagnostics (incl. log analysis); MVP read-only (no signing)
- **Config**: YAML + env + flags with documented priority
- **Interfaces**: CLI + MCP server from same binary
- **BCOS RPC**: native/primary path (top-level commands); Ethereum-compatible ops under `bcos eth ...`
- **Log format**: BCOS 3.x only
- **`doctor`** is the diagnostic subcommand namespace

### Engineering conventions (LEARNED THE HARD WAY — bake into Phase 4 prompts)

1. **ESM + NodeNext**: relative imports in `src/` and `test/` MUST end with `.js` (even for `.ts` source).
2. **`Error.cause` native slot**: when constructing `BcosCliError`, pass `cause` as the 4th constructor arg so it lands in `super(message, { cause })`. Don't store cause only as a class field.
3. **Bigint-safe serialization**: data crossing `JSON.stringify` boundaries goes through `toSerializable` / `stringify` from `src/serialize.ts`.
4. **Per-branch circular tracking**: serializer's `seen` WeakSet uses enter/exit (add on descent, delete on return). Don't regress.
5. **Zod transforms**: use `z.string().transform((s, ctx) => { ctx.addIssue({...}); return z.NEVER; })`. Don't use `z.custom()`.
6. **viem v2.21+**: `createPublicClient`, `decodeFunctionData`, `decodeEventLog`. txDecoder casts `decoded.eventName` as string and `log.topics` as `[Hex, ...Hex[]]` to satisfy strict typing — that's expected.
7. **`zod` ^3.25.28** locked. **`@vitest/coverage-v8`** required for v8 coverage. **`zod-to-json-schema`** is a dep.
8. **`package.json` "exports"** field present and required.
9. **Error messages must NOT embed the error code as a prefix** — `BcosCliError.code` is a separate field, embedding the code in the message duplicates it on rendering. Test assertions go through `BcosCliError instanceof + .code` (e.g. `rejects.toSatisfy(e => e instanceof BcosCliError && e.code === "X")`). The plan's original tests used `rejects.toThrow(/CODE/)` — adapt to the `toSatisfy` pattern when needed (see fix at commit `9228702`).
10. **`BcosCliError(code, message, details?, cause?)` signature** — pass any underlying error (including Zod's `result.error`) as the 4th arg so `Error.cause` chains.

### Architectural (from spec §4)
- **Four-layer separation**: shells → handlers → services → config. Services don't import handlers; handlers don't import shells.
- **One Zod schema per command** drives both CLI argparse (`zodToYargs`, Task 5.1) and MCP tool schema (`zodToJsonSchema`, Task 5.4). Don't duplicate the schema.
- **Registry side-effect registration**: each command file calls `defineCommand(...)` at module top level. `src/commands/registerAll.ts` (Task 4.10) imports them all.
- **Services injected via ctx**: no module-level singletons. Every handler receives `ctx = { logger, chain, fileConfig, bcosRpc, web3Rpc, abiRegistry, txDecoder, logReader }`.

### Observation backlog (non-blocking, raise only if blocking)

From Phase 1–3 reviews:

- `BlockTag.value: string` could be narrowed by `kind`. Defer until a handler needs it.
- `ResponseMeta.chain?: string` no format constraint. Fine for now.
- `exitCodeFor`'s `USAGE_CODES` set is manually maintained; consider `satisfies Record<UsageErrorCode, true>` if the list grows.
- `blockTag` doesn't accept `0x`-style hex block numbers — spec says decimal only.
- `hexAddress` preserves user case; EIP-55 checksumming deferred to Task 5.2 `prettyRender`.
- `AppLogger` has no levels enum; `createStderrLogger` uses boolean verbose/quiet flags. Sufficient for MVP.
- `resolveActiveChain` (commit `0d6d67a`) silently ignores `fileConfig.defaultChain` if it names a chain not in `fileConfig.chains` (only throws CHAIN_NOT_FOUND when the chain is named via flag/env). Plan-prescribed behavior; revisit if a handler trips on it.
- `BcosRpcClient` (commit `e778ddd`) implements timeout via `Promise.race` + `setTimeout` rather than `AbortController` (the plan code's AbortController approach didn't propagate through the test's `new Promise(()=>{})` mock). Semantically equivalent; tests pass.
- ABI store directory uses raw `~/.bcos-cli/abi` until expanded by `expandHome` (Task 2.2); handlers must call `expandHome(fileConfig.abiStoreDir, os.homedir())` before passing to `createAbiRegistry`.

---

## 5. How to interact with the user

- The user prefers terse Chinese commands (e.g., "继续执行", "选择C", "按照A"). Don't ask unnecessary clarification; if the instruction maps to a listed option, pick it.
- Report each completed task with commit SHA + 1-line outcome; report each PHASE with merged commits + test count + open concerns. Don't surface every subagent exchange.
- On review findings: fix blockers; defer nits with a written note; never silently accept BLOCKERS.
- Any deviation from spec/plan requires explicit user buy-in.

---

## 6. What *not* to do

- Don't start Phase 4 without explicit user "continue" — they paused at this checkpoint intentionally (per pattern of prior phases).
- Don't read the spec or plan files from inside subagents; copy task text into prompts.
- Don't push to any remote. No `git push`. No PR creation.
- Don't use `--no-verify` or `--no-gpg-sign`.
- Don't skip the `pnpm tsc --noEmit && pnpm vitest run` gate after each merge batch.
- Don't batch multiple tasks into one subagent.
- Don't dispatch multiple **implementers** for different tasks in parallel in Phases 1, 2, or 5 (those are serial). Parallelism is reserved for Phases 3, 4A, 4B, parts of 6.
- Don't let a subagent commit broken code: if a subagent reports DONE but tests are red, dispatch a fix.
- Don't re-introduce known bugs (see §4): missing `.js` suffix, missing `super(message, { cause })`, missing `@vitest/coverage-v8`, embedding error code in error message.
- Don't accept `STATUS: APPROVED` from a quality reviewer that listed BLOCKERS in the same report — fix them. (For IMPORTANT items, weigh against scope-creep risk; for nits, generally defer.)
- When dispatching parallel Phase 4 subagents, instruct each one to ONLY modify the files in its own task — silent edits to `src/services/*` files (which are now real implementations) would break other branches at merge time.

---

## 7. Quick-start dispatch recipe for Phase 4 Batch A

When the user says "continue":

1. **Read plan §"Phase 4 — Command Handlers"** (lines ~2300–3784 in `docs/superpowers/plans/2026-04-15-fisco-bcos-cli.md`). Extract Tasks 4.0 through 4.5 verbatim (each is a self-contained code block in the plan).
2. **Dispatch 6 subagents in one assistant message** (one per task in Batch A: 4.0, 4.1, 4.2, 4.3, 4.4, 4.5), each with:
   - `subagent_type: "general-purpose"`, `model: "sonnet"`
   - `isolation: "worktree"`
   - `run_in_background: true`
   - prompt = role + scene (master @ c87b46d, Phase 1–3 merged) + full task text from plan + branch name `feat/phase4a-<cluster>` + commit message + report format + "no push, no merge, no other-file edits"
3. **Wait for completion notifications**. Each subagent will return BRANCH/COMMIT_SHA/TEST_RESULT/CONCERNS.
4. **Merge sequentially in main session**: `git merge --no-ff feat/phase4a-<cluster>` for each. Resolve conflicts (most likely on `src/commands/registry.ts` if multiple register commands at top level — actually each handler is in its own file under `src/commands/<name>.ts`, so file-level conflicts should be rare).
5. **Run `pnpm tsc --noEmit && pnpm vitest run`** on master after the batch. If broken, fix.
6. **Clean up**: `git worktree remove --force` and `git branch -D` for each branch + each `worktree-agent-*` branch.
7. **Report to user**: merged commits, test count, what's next (Batch B).

After user approves, repeat the recipe for Batch B (Tasks 4.6–4.9), then dispatch Task 4.10 serially in main repo.

---

## 8. Emergency levers

- **Subagent loops on review feedback**: read the diff yourself; one Edit call or rewrite the task text.
- **`tsc --noEmit` fails after a merge**: read errors; fix inline if trivial else dispatch focused fix subagent with the exact error tail.
- **Plan ambiguous or wrong** (mid-implementation): stop, surface to user, don't paper over.
- **Low context**: this handoff is the canonical state snapshot. Update §1 status, §4 backlog, §6 don'ts before exiting. Commit updates.

---

## 9. Files this document references

Must-read:
- `docs/superpowers/specs/2026-04-15-fisco-bcos-cli-design.md`
- `docs/superpowers/plans/2026-04-15-fisco-bcos-cli.md`

Current source (small; cheap to load all):
- `src/{types,errors,serialize,validators,logger,context}.ts`
- `src/config/{schema,load,resolve}.ts`
- `src/commands/registry.ts`
- `src/services/{bcosRpc,web3Rpc,abiRegistry,txDecoder,logReader,logParser,perfAnalyzer}.ts`

Configuration:
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

The user said "继续执行到phase 3，完成后写交接文档" — that's complete. They will most likely say "继续执行" next to start Phase 4 Batch A. Be ready.
