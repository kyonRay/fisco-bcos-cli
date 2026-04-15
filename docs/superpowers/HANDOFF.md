# fisco-bcos-cli — AI Handoff Document

**Last updated:** 2026-04-15
**Status:** Phase 1 (Foundation) complete, 27/27 tests green. Phase 2 not started.
**Your role:** Controller AI driving subagent-driven development.

---

## 0. Read-first primer (don't skip this)

You are taking over an in-progress build of a TypeScript CLI + MCP server for FISCO-BCOS chains. The previous controller completed Phase 1 and paused at the Phase 1→2 checkpoint. The user expects you to pick up and continue without re-brainstorming or re-planning. The spec and plan are final; follow them.

**Authoritative documents (read in this order):**

1. **`docs/superpowers/specs/2026-04-15-fisco-bcos-cli-design.md`** — the design spec. Source of truth for *what* to build. Don't renegotiate decisions here without explicit user request.
2. **`docs/superpowers/plans/2026-04-15-fisco-bcos-cli.md`** — the ~40-task implementation plan with complete code for every task. The "Execution Strategy" section at the bottom is the runtime contract you operate under.
3. This file (`HANDOFF.md`) — session state, conventions, and caveats accumulated so far.

The spec and plan together contain the complete code for every remaining task. Do NOT re-derive it.

---

## 1. Where we are

### Repo
- Path: `/Users/kyonguo/workspace/code/bcos-cli`
- Branch: `master` (greenfield; committing directly to master is the agreed policy — only parallel phases use feat branches / worktrees)
- Node/pnpm installed; dependencies synced

### Last commits (newest first)
```
2129ddf feat(validators): address, hash, block-tag Zod schemas          ← Task 1.5
2374aea fix(serialize): Date support and per-branch circular tracking   ← Task 1.4 fix
010ad01 feat(serialize): bigint/Uint8Array safe JSON serializer         ← Task 1.4
eb3470f fix(errors): thread cause to native Error.cause via ErrorOptions← Task 1.3 fix
319c0a0 feat(errors): BcosCliError, exitCodeFor, toBcosCliError         ← Task 1.3
5ad5072 feat(types): shared primitive and envelope types                ← Task 1.2
d831009 chore: address Task 1.1 review — add coverage-v8, tighten zod   ← Task 1.1 fix
ecd543d chore: scaffold fisco-bcos-cli package                          ← Task 1.1
4e4b35b Add execution strategy section to plan
17a807c Add fisco-bcos-cli implementation plan
c510671 Add fisco-bcos-cli design spec
```

### What exists in the src tree
```
src/
  types.ts          Hex, BlockTag, AppLogger, ResponseMeta, Envelope<T>
  errors.ts         BcosCliError, ErrorCode, exitCodeFor, toBcosCliError
  serialize.ts      toSerializable (bigint/Date/Uint8Array-aware, DAG-safe), stringify
  validators.ts     normalizeHex, hexAddress, hexHash, blockTag (Zod schemas)
test/unit/
  errors.test.ts    7 tests
  serialize.test.ts 11 tests
  validators.test.ts 9 tests
```

No `src/commands/`, `src/services/`, `src/cli/`, `src/mcp/`, `src/config/` yet. No integration or E2E tests.

### Validation snapshot
- `pnpm tsc --noEmit` → clean
- `pnpm vitest run` → 3 files, 27 tests, all pass
- `pnpm build` not yet invoked (no entry points produced)

---

## 2. Immediate next work: Phase 2

Phase 2 is **serial, in main repo, no worktree** (per Execution Strategy section of the plan).

### Tasks in order

| # | Task | File(s) | Model |
|---|---|---|---|
| 2.1 | Config Zod schema | `src/config/schema.ts` + test | haiku |
| 2.2 | YAML config loader | `src/config/load.ts` + test (uses `expandHome` helper exposed from same module) | haiku |
| 2.3 | `resolveActiveChain` | `src/config/resolve.ts` + test | haiku |
| 2.4 | Command registry + placeholder `src/context.ts` | `src/commands/registry.ts`, `src/context.ts` (placeholder body per plan) + test | haiku |
| 2.5 | `AppContext` final shape, logger, service stub files | `src/context.ts` (replaces placeholder), `src/logger.ts`, stubs at `src/services/{bcosRpc,web3Rpc,abiRegistry,txDecoder,logReader}.ts` + test | haiku |

The full code for every one of these tasks is in the plan. Read it and dispatch verbatim — do not paraphrase the code into subagent prompts, and do not let subagents "simplify" it. Changes to the design go through the user, not through implementation shortcuts.

### Phase 2 checkpoint
After 2.5 merges and all tests are green, **stop and check in with the user** before starting Phase 3. Phase 3 switches to parallel worktrees.

---

## 3. How to work: the rules you must follow

### 3.1 Three-stage review per task (non-negotiable)

Every task follows this loop, dispatched as separate `Agent` calls:

```
implementer → spec compliance reviewer → code quality reviewer → (mark done)
                ↓ FAIL                         ↓ FAIL
              fix subagent                  fix subagent
                ↓                             ↓
              re-review                     re-review
```

The user explicitly asked for strict skill adherence: **do not skip either review stage, even for trivial tasks**. The cost (3 subagent calls per task minimum) is accepted.

### 3.2 Subagent prompt contract

Every dispatch must contain:

1. **Role declaration**: "You are an implementer subagent" / "spec compliance reviewer" / "code quality reviewer" / "fix subagent".
2. **Scene**: which phase, which task #, working dir, current branch, what's already merged that the task can depend on.
3. **Full task text from the plan** — copy-pasted including all code blocks. The subagent should never have to read the plan file itself.
4. **Exit criteria**: exact files, exact tests that must pass, exact commit message.
5. **Report format**: structured (STATUS / COMMIT_SHA / TEST_RESULT / CONCERNS). Parse the report, don't ingest free-form prose.

### 3.3 Model selection (follow the matrix in plan §Execution Strategy)

| Role | Model |
|---|---|
| Mechanical scaffolding / pure utilities / types / simple handlers / spec reviewer | `haiku` |
| Services with integration concerns / code quality reviewer / handlers with logic | `sonnet` |
| Shells (CLI / MCP entry) / final whole-repo reviewer / ambiguous design calls | `opus` |

Use the `model` parameter in the `Agent` tool. Don't overpay; don't underpay.

### 3.4 Parallel execution (Phase 3 onward)

Phase 3 services are independent and should fire as a **single parallel batch** of 6–7 `Agent` calls in one assistant message, each with:

- `isolation: "worktree"` parameter set on the Agent call
- A unique branch name (e.g., `feat/phase3-bcosRpc`, `feat/phase3-logParser`)
- Each subagent creates the worktree itself via the `EnterWorktree` tool it has access to, OR if you pre-create worktrees via `EnterWorktree` in the controller, the subagent just operates in its assigned worktree path

After all parallel subagents finish, **you (the controller) merge each branch back to `master` sequentially** in the main session. The user explicitly reserved merge + conflict resolution to the main session; subagents never merge.

Phase 4 parallel batches follow the same rule, organized in two waves (Batch A: basic handlers; Batch B: doctor/eth/config), with `registerAll` (Task 4.10) strictly last and serial because it imports every handler.

### 3.5 Merge protocol

After a parallel batch completes:

```
1. Verify every branch built and tested green in its worktree.
2. For each branch in turn:
     git merge --no-ff <branch>
   Resolve conflicts yourself by reading both sides and writing the merged result.
3. After all merges, run:
     pnpm tsc --noEmit && pnpm vitest run
   If anything regresses, either fix inline (if trivial) or dispatch a focused
   fix subagent with the exact failure output.
4. Clean up worktrees (ExitWorktree) and delete merged branches.
```

Do not push anywhere. No PRs. The user wants fast iteration on a solo repo.

### 3.6 User checkpoints (per Execution Strategy §)

Stop and report at these points. The user will respond with "continue" or with changes.

1. After Phase 1 merged → ✅ already reached (this handoff is the checkpoint)
2. After Phase 2 merged
3. After Phase 3 parallel batch merged
4. After Phase 4 Batch A merged
5. After Phase 4 Batch B + Task 4.10 merged
6. After Phase 5 complete
7. After Phase 6.8, before dispatching the final whole-repo reviewer

Each checkpoint reports: merged commits, test count, any open DONE_WITH_CONCERNS notes, what's next.

---

## 4. Decisions and constraints that have already been made

Don't re-litigate these with the user; they are locked.

### Product decisions (from brainstorming)
- **Language**: TypeScript / Node.js ≥ 18, ESM
- **Distribution**: npm only, package name `fisco-bcos-cli`, binary name `bcos`
- **Audience**: humans and AI agents equally; JSON for non-TTY, pretty for TTY
- **Depth**: wrapping + decoding + diagnostics (including log file analysis)
- **Config**: YAML file + env + flags with documented priority; MVP read-only (no signing / writing txs / keystore)
- **External deps**: none in MVP — no block explorer, no signature DB, no Sourcify. Architecture leaves extension points.
- **Interfaces**: CLI + MCP server from same binary; MCP tool names use underscores (`chain_info`), CLI uses spaces (`chain info`).
- **BCOS RPC vs Web3 RPC split**: BCOS RPC is the native/primary path (top-level commands); Ethereum-compatible ops live under `bcos eth ...` subtree.
- **Log format**: FISCO-BCOS 3.x only; 2.x deferred.
- **`doctor`** is the diagnostic subcommand namespace (not `diagnose`, not `doc`).

### Engineering conventions (accumulated during Phase 1 reviews)

These were learned the hard way through review loops. Bake them into subagent prompts for later phases so the lessons aren't lost:

1. **ESM + NodeNext**: all relative imports in `src/` and `test/` must end with `.js` (TypeScript's NodeNext requirement). Example: `import { BcosCliError } from "../../src/errors.js";` even though the source file is `.ts`.
2. **Error.cause native slot**: when extending `Error`, use `super(message, { cause })` — don't store `cause` only as a class field. Prior controllers got caught on this for `BcosCliError`.
3. **Bigint-safe serialization everywhere**: any place data touches `JSON.stringify`, route through `toSerializable` / `stringify` from `src/serialize.ts`. This handles bigint → decimal string, `Uint8Array` → `0x`-hex, `Date` → ISO string, and DAG (shared non-circular refs) correctly.
4. **Circular-ref tracking is per-branch, not global**: the `seen` WeakSet uses enter/exit pattern (add on descent, delete on return). Don't regress this.
5. **Zod schemas in ESM with transforms**: use `z.string().transform((s, ctx) => { ctx.addIssue({...}); return z.NEVER; })` for validation-with-transformation. Do not use `z.custom()` or unnecessary `.refine().transform()` chains.
6. **`viem` version is locked**: `^2.21.0`. Services using viem (`web3Rpc`, `txDecoder`) should target its v2 API (`createPublicClient`, `decodeFunctionData`, `decodeEventLog`).
7. **`zod-to-json-schema` peer dep**: `zod` was tightened to `^3.25.28` in Task 1.1 review. Don't downgrade.
8. **`@vitest/coverage-v8`** is a required peer for `vitest 2.x` v8 coverage. It was missed initially in Task 1.1 and added in the review fix. Don't remove it.
9. **`package.json` "exports" field**: present and must stay present. Matters for ESM resolvers.

### Architectural decisions (from spec §4)
- **Four-layer separation**: shells (CLI / MCP) → handlers (pure fns) → services (external I/O) → config. Don't let services import handlers, don't let handlers import shells.
- **One Zod schema per command** drives CLI argparse via `zodToYargs` (Task 5.1) and MCP tool schema via `zodToJsonSchema` (Task 5.4). Subagents must not duplicate the schema in two places.
- **Registry side-effect registration**: each command file calls `defineCommand(...)` at module top level. `src/commands/registerAll.ts` imports them all to trigger registration (Task 4.10).
- **Services injected via ctx**: no module-level singletons. Every handler receives `ctx = { logger, chain, fileConfig, bcosRpc, web3Rpc, abiRegistry, txDecoder, logReader }`.

### Observation backlog (non-blocking, from Phase 1 reviews)

These were flagged but deliberately deferred. Surface them again only if they become blockers during later tasks:

- `BlockTag.value: string` — could be narrowed by `kind` (e.g., `Hex` for `"hash"`) if a downstream handler forces the issue.
- `ResponseMeta.chain?: string` — no format constraint; fine for now.
- `exitCodeFor`'s `USAGE_CODES` set is manually maintained; a `satisfies Record<UsageErrorCode, true>` guard would catch drift if the code list grows.
- `blockTag` doesn't accept `0x64`-style hex block numbers — spec says decimal only; revisit only if UX proves it matters.
- `hexAddress` preserves user case; EIP-55 checksumming is deferred to the output serializer/pretty-renderer (Task 5.2 `prettyRender` should handle it).
- `AppLogger` contract has no levels enum; `createStderrLogger` (Task 2.5) hardcodes verbosity via boolean flags. Sufficient for MVP.

---

## 5. How to interact with the user

The user is experienced and prefers terse updates. Observed pattern from the first session:

- The user commands in short Chinese (e.g., "继续执行", "选择C", "按照A"). Don't ask unnecessary clarification; if the instruction maps to a listed option, pick it.
- When ambiguity genuinely exists (e.g., "doc" vs "doctor"), one quick disambiguating question is welcome — but only one.
- The user wants **checkpoints between phases**, not play-by-play. Don't surface every subagent exchange; do report each completed task with final commit SHA + one-line outcome.
- On review findings: the user agreed to strict three-stage review. If a reviewer finds blockers or important issues, **fix them** rather than accepting and moving on.
- Any proposal to deviate from the spec or plan requires explicit user buy-in.

---

## 6. What *not* to do

- Don't start Phase 2 without confirming with the user (they paused the loop here intentionally).
- Don't read the spec or plan files from inside subagents — copy the relevant task text into the prompt. Subagent context is precious.
- Don't push to any remote. No `git push`. No PR creation.
- Don't use `--no-verify` or `--no-gpg-sign` on commits.
- Don't skip the `pnpm tsc --noEmit && pnpm vitest run` gate before each commit.
- Don't batch multiple tasks into one subagent — one task, one subagent, one commit.
- Don't dispatch multiple **implementers** for different tasks in parallel in Phases 1, 2, or 5. Those are serial. Parallelism is reserved for Phases 3, 4A, 4B, and parts of 6.
- Don't let a subagent commit broken code to `master`. If a subagent reports DONE but tests are red, dispatch a fix.
- Don't re-introduce any of the bugs listed in §4 "Engineering conventions" above — the `.js` import suffix, the `super(message, { cause })`, the missing `@vitest/coverage-v8`, etc.
- Don't accept `STATUS: APPROVED` from a reviewer that listed BLOCKERS or IMPORTANT items in the same report. Fix them.

---

## 7. Quick-start dispatch template for the next task (Task 2.1)

When the user says "continue", dispatch Task 2.1 with this structure:

```
Role: implementer subagent
Scene: Phase 2, Task 2.1 of fisco-bcos-cli.
  Working dir: /Users/kyonguo/workspace/code/bcos-cli
  Branch: master
  Phase 1 merged (errors, serialize, validators, types all available).
  No worktree — serial phase.
Task text: <paste Task 2.1 block from plan verbatim>
Exit criteria: src/config/schema.ts + test/unit/config/schema.test.ts,
  all tests pass, tsc --noEmit clean, one commit with message
  "feat(config): Zod schema for YAML config"
Report format: STATUS / COMMIT_SHA / TEST_RESULT / TSC_OUTPUT / CONCERNS
```

After implementer reports DONE, dispatch spec reviewer (haiku) and code quality reviewer (sonnet) against that commit in parallel. Handle any review findings with fix subagents. When both reviewers approve, mark the task complete and dispatch Task 2.2.

Repeat for 2.2, 2.3, 2.4, 2.5 in order. After 2.5 approved and all tests green, check in with the user — that's the next checkpoint.

---

## 8. Emergency levers

- **If a subagent loops (same review feedback 3 times)**: read the actual diff yourself, either fix it in one Edit call or rewrite the task text for the next subagent attempt.
- **If `tsc --noEmit` fails after a merge**: read the errors, if trivial fix inline; otherwise dispatch a targeted fix subagent with the exact error tail.
- **If the plan is ambiguous or wrong** (discovered mid-implementation): stop, surface it to the user, don't let a subagent paper over it.
- **If you run low on context**: this handoff document is the canonical state snapshot. Update its §1 (status), §4 (backlog), and §6 (what-not-to-do) as decisions accumulate. Commit updates before handing off again.

---

## 9. Files this document references (for you to load)

Must-read:
- `docs/superpowers/specs/2026-04-15-fisco-bcos-cli-design.md`
- `docs/superpowers/plans/2026-04-15-fisco-bcos-cli.md`

Current source (small; cheap to load all):
- `src/types.ts`, `src/errors.ts`, `src/serialize.ts`, `src/validators.ts`
- `test/unit/errors.test.ts`, `test/unit/serialize.test.ts`, `test/unit/validators.test.ts`

Configuration:
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

Welcome to the build. The user said "开始执行" last turn — they want the momentum to continue, so once this handoff is committed, be ready to dispatch Task 2.1 on their next "continue" signal.
