# Integration Test with Real Nodes — Design Spec

**Date:** 2026-04-16
**Status:** Approved

---

## 1. Goal

Add real-node integration tests for fisco-bcos-cli using **two node backends**:

1. **Hardhat node** — standard Ethereum JSON-RPC, validates that `web3Rpc` layer + `eth` subtree commands work against any EVM-compatible node (not just FISCO-BCOS's compatibility layer). Fast startup (~1s), well-documented, no binary download.
2. **FISCO-BCOS v3.16.4 node** — native BCOS RPC, validates `bcosRpc` layer + all BCOS-specific commands (chain info, peers, doctor, etc.) and the full contract decode pipeline against the real chain.

Both deploy ERC20/ERC721/ERC1155/ERC4337 contracts and exercise ABI decoding, event parsing, and call decoding with real data.

Tests run locally (with `skipIf` when no node available) and in CI (GitHub Actions, ubuntu-latest + macos-latest).

---

## 2. Test Infrastructure

### 2.0 Hardhat Node Manager

**File:** `test/helpers/hardhatNode.ts`

Exports:
- `setupHardhat(): Promise<HardhatInfo>` — start `npx hardhat node` as child process, wait for ready
- `teardownHardhat(): Promise<void>` — kill process
- `HardhatInfo: { url: string, chainId: number, accounts: string[] }`

Behavior:
1. Spawn `npx hardhat node --port 8546` (use 8546 to avoid conflict with FISCO-BCOS on 8545)
2. Poll `http://127.0.0.1:8546` with `eth_blockNumber` until response, timeout 15s
3. Return `{ url: "http://127.0.0.1:8546", chainId: 31337, accounts: [...20 funded accounts] }`

Teardown: `SIGTERM` the child process.

**Dev dependency:** `hardhat` added to `devDependencies`. Minimal `hardhat.config.ts` at project root (empty config, only needed for `npx hardhat node`).

### 2.1 FISCO-BCOS Node Lifecycle Manager

**File:** `test/helpers/chainNode.ts`

Exports:
- `setupChain(): Promise<ChainInfo>` — download build_chain.sh, deploy 1-node chain, start it, poll until ready
- `teardownChain(): Promise<void>` — stop node, clean up files
- `ChainInfo: { bcosRpcUrl: string, web3RpcUrl: string, dataDir: string }`

Behavior:
1. `curl -LO` the build_chain.sh from `https://github.com/FISCO-BCOS/FISCO-BCOS/releases/download/v3.16.0/build_chain.sh`
2. Run `bash build_chain.sh -l 127.0.0.1:1 -p 30300,20200,8545` in a temp directory
3. Run `bash nodes/127.0.0.1/start_all.sh`
4. Poll `http://127.0.0.1:20200` with `getBlockNumber` JSON-RPC call every 1s, timeout 30s
5. Return `{ bcosRpcUrl: "http://127.0.0.1:20200", web3RpcUrl: "http://127.0.0.1:8545", dataDir }` once block number is returned

Teardown:
1. `bash nodes/127.0.0.1/stop_all.sh`
2. `rm -rf` the temp directory

### 2.2 Contract Seed (shared by both backends)

**File:** `test/helpers/seedContracts.ts`

After either node is ready, deploy contracts and execute transactions. Uses viem's `createWalletClient` + `createPublicClient` connected to the node's web3 RPC URL. The same seed function works for both Hardhat (port 8546) and FISCO-BCOS (port 8545).

**Contracts (minimal inline ABI + bytecode, no Solidity compilation at test time):**

| Contract | Key Functions | Key Events |
|---|---|---|
| SimpleERC20 | constructor(name, symbol, decimals), mint(amount), transfer(to, amount), balanceOf(addr) | Transfer(from, to, value) |
| SimpleERC721 | constructor(name, symbol), mint(to, tokenId), transferFrom(from, to, tokenId), ownerOf(tokenId) | Transfer(from, to, tokenId), Approval(owner, approved, tokenId) |
| SimpleERC1155 | constructor(uri), mint(to, id, amount, data), safeTransferFrom(from, to, id, amount, data), balanceOf(account, id) | TransferSingle(operator, from, to, id, value) |
| SimpleERC4337 | EntryPoint + SimpleAccount — executeUserOp through EntryPoint | UserOperationEvent(userOpHash, sender, paymaster, nonce, success) |

Each contract is ~30-50 lines of Solidity compiled output (ABI + bytecode inlined as constants).

**Seed sequence:**
1. Deploy ERC20 → mint(1000) → transfer(addr2, 100) → record tx hash
2. Deploy ERC721 → mint(tokenId=1) → transferFrom(addr1→addr2, tokenId=1) → record tx hash
3. Deploy ERC1155 → mint(addr1, id=1, amount=100) → safeTransferFrom(addr1→addr2, id=1, amount=50) → record tx hash
4. Deploy EntryPoint + SimpleAccount → executeUserOp → record tx hash
5. Export all addresses, tx hashes, block range to `SeedResult`

**`SeedResult` type:**
```ts
interface SeedResult {
  erc20: { address: string; transferTxHash: string; abi: unknown[] };
  erc721: { address: string; transferTxHash: string; abi: unknown[] };
  erc1155: { address: string; transferTxHash: string; abi: unknown[] };
  erc4337: { entryPointAddress: string; userOpTxHash: string; abi: unknown[] };
  blockRangeStart: number;
  blockRangeEnd: number;
  account1: string;
  account2: string;
}
```

### 2.3 Vitest Global Setup

Two separate global setups, one per backend:

**File:** `test/integration/globalSetup.hardhat.ts`
```
export async function setup() {
  const hardhat = await setupHardhat();
  const seed = await seedContracts({ web3RpcUrl: hardhat.url });
  // Write seed result to temp JSON + set HARDHAT_TEST_URL, HARDHAT_TEST_SEED_FILE
}
export async function teardown() {
  await teardownHardhat();
}
```

**File:** `test/integration/globalSetup.bcos.ts`
```
export async function setup() {
  const chain = await setupChain();
  const seed = await seedContracts({ web3RpcUrl: chain.web3RpcUrl });
  // Write seed result to temp JSON + set BCOS_TEST_RPC_URL, BCOS_TEST_WEB3_URL, BCOS_TEST_SEED_FILE
}
export async function teardown() {
  await teardownChain();
}
```

Two vitest configs:
- `vitest.hardhat.config.ts` — globalSetup hardhat, includes `**/*.hardhat.test.ts`
- `vitest.bcos.config.ts` — globalSetup bcos, includes `**/*.bcos.test.ts`

### 2.4 Skip Guard

Hardhat tests: `describe.skipIf(!process.env.HARDHAT_TEST_URL)`
BCOS tests: `describe.skipIf(!process.env.BCOS_TEST_RPC_URL)`

`pnpm test` (default) skips both. Separate scripts:
- `pnpm test:hardhat` — Hardhat-only integration tests
- `pnpm test:bcos` — FISCO-BCOS-only integration tests
- `pnpm test:real` — runs both sequentially

---

## 3. Test Cases

### 3.0 Hardhat — web3Rpc + eth commands (15 tests)

These run against Hardhat node (standard Ethereum). Validates that the web3Rpc layer and eth subtree commands work with any EVM node, not just FISCO-BCOS.

**File:** `test/integration/services/web3Rpc.hardhat.test.ts` (7 tests)

| # | Test | Assert |
|---|---|---|
| 1 | blockNumber() | bigint ≥ 0n |
| 2 | chainId() | 31337 (Hardhat default) |
| 3 | gasPrice() | bigint > 0n |
| 4 | getBlock(seed block number) | contains transactions |
| 5 | getTransaction(ERC20 tx hash) | to = ERC20 contract address |
| 6 | getTransactionReceipt(ERC20 tx hash) | contains logs (Transfer event) |
| 7 | getLogs(seed block range, ERC20 address) | contains Transfer event logs |

**File:** `test/integration/commands/eth.hardhat.test.ts` (8 tests)

Uses real `web3Rpc` client against Hardhat, with fake `bcosRpc` (eth commands don't use it).

| # | Command | Contract | Assert |
|---|---|---|---|
| 1 | eth block-number | — | returns blockNumber string |
| 2 | eth chain-id | — | returns 31337 |
| 3 | eth gas-price | — | returns non-zero string |
| 4 | eth block (seed block) | — | contains transactions |
| 5 | eth tx (ERC20 hash) | ERC20 | tx.to = contract address |
| 6 | eth receipt (ERC20 hash) | ERC20 | logs non-empty |
| 7 | eth call (balanceOf) | ERC20 | returns encoded balance |
| 8 | eth logs (seed range) | ERC20 | Transfer events |

### 3.1 FISCO-BCOS — bcosRpc (8 tests)

File: `test/integration/services/bcosRpc.real.test.ts`

| # | Test | Assert |
|---|---|---|
| 1 | getBlockNumber | returns non-null, height ≥ seed blockRangeEnd |
| 2 | getSyncStatus | returns object with blockNumber field |
| 3 | getSealerList | returns non-empty array |
| 4 | getGroupList | contains "group0" |
| 5 | getBlockByNumber(seed block) | returns block with transactions array |
| 6 | getTransactionByHash(ERC20 transfer tx) | returns tx with to/input/hash |
| 7 | getTransactionReceipt(ERC20 transfer tx) | returns receipt with status + logs |
| 8 | getTransactionByHash(nonexistent) | returns null |

### 3.2 Service Layer — web3Rpc (7 tests)

File: `test/integration/services/web3Rpc.real.test.ts`

| # | Test | Assert |
|---|---|---|
| 1 | blockNumber() | bigint ≥ seed blockRangeEnd |
| 2 | chainId() | number > 0 |
| 3 | gasPrice() | bigint ≥ 0n |
| 4 | getBlock(seed block number) | contains transactions |
| 5 | getTransaction(ERC20 tx hash) | to = ERC20 contract address |
| 6 | getTransactionReceipt(ERC20 tx hash) | contains logs (Transfer event) |
| 7 | getLogs(seed block range, ERC20 address) | contains Transfer event logs |

### 3.3 Command Layer (18 tests)

File: `test/integration/commands/real.test.ts`

Uses real `buildContext` with the test node's URLs.

| # | Command | Contract | Assert |
|---|---|---|---|
| 1 | tx (ERC20 transfer hash) | ERC20 | decoded input = transfer(to, amount), receipt has Transfer log |
| 2 | tx (ERC721 transferFrom hash) | ERC721 | decoded input = transferFrom, event has indexed tokenId |
| 3 | tx (ERC1155 safeTransferFrom hash) | ERC1155 | decoded input has id + amount, TransferSingle event |
| 4 | tx (ERC4337 userOp hash) | ERC4337 | nested call decode, UserOperationEvent |
| 5 | block (seed block) | — | block contains transactions |
| 6 | receipt (ERC20 tx) | ERC20 | status=0x0, logs non-empty |
| 7 | account (ERC20 contract) | ERC20 | isContract=true, codeSize > 0 |
| 8 | account (ERC721 contract) | ERC721 | isContract=true |
| 9 | code (ERC1155 contract) | ERC1155 | bytecode non-empty |
| 10 | call balanceOf(addr1) | ERC20 | returns decoded balance (900) |
| 11 | call ownerOf(tokenId=1) | ERC721 | returns addr2 |
| 12 | call balanceOf(addr2, id=1) | ERC1155 | returns 50 |
| 13 | event (ERC20, seed block range) | ERC20 | Transfer events present |
| 14 | event (ERC721, seed block range, name=Transfer) | ERC721 | filtered Transfer events |
| 15 | event (ERC1155, seed block range) | ERC1155 | TransferSingle events |
| 16 | chain info | — | syncStatus.blockNumber ≥ seed block |
| 17 | doctor chain | — | findings array exists |
| 18 | abi add + tx --decode | ERC20 | register ABI then tx decode → degraded=false |

**FISCO-BCOS subtotal: 33 tests** (8 + 7 + 18)

**Grand total: 48 tests** (Hardhat 15 + FISCO-BCOS 33)

---

## 4. CI Workflow

### 4.1 Two new jobs in `.github/workflows/ci.yml`

**Hardhat integration job** (fast, ~30s):
```yaml
integration-hardhat:
  runs-on: ${{ matrix.os }}
  strategy:
    fail-fast: false
    matrix:
      os: [ubuntu-latest, macos-latest]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with: { version: 9 }
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
    - run: pnpm test:hardhat
```

**FISCO-BCOS integration job** (slower, ~60s):
```yaml
integration-bcos:
  runs-on: ${{ matrix.os }}
  strategy:
    fail-fast: false
    matrix:
      os: [ubuntu-latest, macos-latest]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with: { version: 9 }
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
    - name: Deploy FISCO-BCOS node
      run: |
        curl -LO https://github.com/FISCO-BCOS/FISCO-BCOS/releases/download/v3.16.0/build_chain.sh
        bash build_chain.sh -l 127.0.0.1:1 -p 30300,20200,8545
        bash nodes/127.0.0.1/start_all.sh
    - name: Wait for node ready
      run: |
        for i in $(seq 1 30); do
          if curl -s -X POST http://127.0.0.1:20200 \
            -H 'content-type: application/json' \
            -d '{"jsonrpc":"2.0","id":1,"method":"getBlockNumber","params":["group0"]}' \
            | grep -q result; then
            echo "Node ready"; exit 0
          fi
          sleep 1
        done
        echo "Node failed to start"; exit 1
    - run: pnpm test:bcos
    - name: Stop node
      if: always()
      run: bash nodes/127.0.0.1/stop_all.sh 2>/dev/null || true
```

Both jobs run in parallel with the existing `test` job.

### 4.2 package.json scripts

Add:
```json
"test:hardhat": "vitest run --config vitest.hardhat.config.ts",
"test:bcos": "vitest run --config vitest.bcos.config.ts",
"test:real": "pnpm test:hardhat && pnpm test:bcos"
```

### 4.3 Vitest configs

**`vitest.hardhat.config.ts`:**
- `globalSetup: "./test/integration/globalSetup.hardhat.ts"`
- Includes only `**/*.hardhat.test.ts`
- Timeout: 15s per test

**`vitest.bcos.config.ts`:**
- `globalSetup: "./test/integration/globalSetup.bcos.ts"`
- Includes only `**/*.bcos.test.ts`
- Timeout: 30s per test (BCOS RPC is slower)

---

## 5. File Inventory

| File | Purpose |
|---|---|
| **Infrastructure** | |
| `test/helpers/hardhatNode.ts` | Hardhat node lifecycle (start/stop child process) |
| `test/helpers/chainNode.ts` | FISCO-BCOS node lifecycle (build_chain.sh deploy/start/stop) |
| `test/helpers/seedContracts.ts` | Deploy ERC20/721/1155/4337 + seed txs (shared by both backends) |
| `test/helpers/contracts/erc20.ts` | ERC20 ABI + bytecode constant |
| `test/helpers/contracts/erc721.ts` | ERC721 ABI + bytecode constant |
| `test/helpers/contracts/erc1155.ts` | ERC1155 ABI + bytecode constant |
| `test/helpers/contracts/erc4337.ts` | EntryPoint + SimpleAccount ABI + bytecode |
| **Global setup** | |
| `test/integration/globalSetup.hardhat.ts` | Hardhat global setup/teardown |
| `test/integration/globalSetup.bcos.ts` | FISCO-BCOS global setup/teardown |
| **Hardhat tests** | |
| `test/integration/services/web3Rpc.hardhat.test.ts` | 7 web3Rpc service tests against Hardhat |
| `test/integration/commands/eth.hardhat.test.ts` | 8 eth subtree command tests against Hardhat |
| **FISCO-BCOS tests** | |
| `test/integration/services/bcosRpc.bcos.test.ts` | 8 bcosRpc service tests against FISCO-BCOS |
| `test/integration/services/web3Rpc.bcos.test.ts` | 7 web3Rpc service tests against FISCO-BCOS |
| `test/integration/commands/real.bcos.test.ts` | 18 command-layer tests against FISCO-BCOS |
| **Config** | |
| `vitest.hardhat.config.ts` | Vitest config for Hardhat tests |
| `vitest.bcos.config.ts` | Vitest config for FISCO-BCOS tests |
| `hardhat.config.ts` | Minimal Hardhat config (needed for `npx hardhat node`) |
| `.github/workflows/ci.yml` | Updated with two integration jobs |

---

## 6. ERC4337 Caveat

ERC4337's EntryPoint contract is complex. If FISCO-BCOS v3.16.4 does not support required opcodes (e.g., `CREATE2` behavior differences), the ERC4337 tests gracefully degrade:
- Deploy-only test: verify EntryPoint deploys successfully
- If full UserOp fails, skip the UserOperationEvent decode test with a logged warning
- Do NOT block other tests

---

## 7. Design Constraints

- No Solidity compilation at test time — all bytecode is pre-compiled and inlined
- Node startup/teardown once per test suite (globalSetup), not per test
- Tests are idempotent: each run deploys fresh contracts (Hardhat resets on restart; build_chain.sh creates a fresh chain)
- `pnpm test` (default) skips all real-node tests — they only run via `pnpm test:hardhat`, `pnpm test:bcos`, or `pnpm test:real`
- CI has three independent jobs: unit tests, Hardhat integration, FISCO-BCOS integration
- Hardhat and FISCO-BCOS use different ports (8546 vs 8545) so they could theoretically run in parallel, but CI jobs are separate for clarity
- `seedContracts` is backend-agnostic — takes a web3 RPC URL and works with any EVM node
