# Integration Test with Real FISCO-BCOS Node — Design Spec

**Date:** 2026-04-16
**Status:** Approved

---

## 1. Goal

Add real-node integration tests for fisco-bcos-cli that run against a locally deployed FISCO-BCOS v3.16.4 single-node chain. Tests cover both the service layer (bcosRpc, web3Rpc) and the command layer (handlers), using deployed ERC20/ERC721/ERC1155/ERC4337 contracts to exercise ABI decoding, event parsing, and call decoding with real data.

Tests run locally (with `skipIf` when no node available) and in CI (GitHub Actions, ubuntu-latest + macos-latest).

---

## 2. Test Infrastructure

### 2.1 Node Lifecycle Manager

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

### 2.2 Contract Seed

**File:** `test/helpers/seedContracts.ts`

After node is ready, deploy contracts and execute transactions. Uses viem's `createWalletClient` + `createPublicClient` connected to `http://127.0.0.1:8545`.

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

**File:** `test/integration/globalSetup.real.ts`

```
export async function setup() {
  const chain = await setupChain();
  const seed = await seedContracts(chain);
  // Write to a temp JSON file for test processes to read
  // Set env vars: BCOS_TEST_RPC_URL, BCOS_TEST_WEB3_URL, BCOS_TEST_SEED_FILE
}
export async function teardown() {
  await teardownChain();
}
```

A separate vitest config `vitest.real.config.ts` uses this globalSetup, running only `**/*.real.test.ts` files.

### 2.4 Skip Guard

All `*.real.test.ts` files start with:
```ts
import { describe } from "vitest";
const skip = !process.env.BCOS_TEST_RPC_URL;
describe.skipIf(skip)("...", () => { ... });
```

This means `pnpm test` (the default config) skips them. Only `pnpm test:real` (using vitest.real.config.ts) runs them.

---

## 3. Test Cases

### 3.1 Service Layer — bcosRpc (8 tests)

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

**Total: 33 tests** (8 + 7 + 18)

---

## 4. CI Workflow

### 4.1 New job in `.github/workflows/ci.yml`

```yaml
integration:
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
    - run: pnpm test:real
    - name: Stop node
      if: always()
      run: bash nodes/127.0.0.1/stop_all.sh 2>/dev/null || true
```

### 4.2 package.json scripts

Add:
```json
"test:real": "vitest run --config vitest.real.config.ts"
```

### 4.3 vitest.real.config.ts

Separate config that:
- Uses `globalSetup: "./test/integration/globalSetup.real.ts"`
- Includes only `**/*.real.test.ts`
- Sets higher timeout (30s per test for RPC calls)

---

## 5. File Inventory

| File | Purpose |
|---|---|
| `test/helpers/chainNode.ts` | Node lifecycle (setup/teardown) |
| `test/helpers/seedContracts.ts` | Deploy contracts + execute seed transactions |
| `test/helpers/contracts/erc20.ts` | ERC20 ABI + bytecode constant |
| `test/helpers/contracts/erc721.ts` | ERC721 ABI + bytecode constant |
| `test/helpers/contracts/erc1155.ts` | ERC1155 ABI + bytecode constant |
| `test/helpers/contracts/erc4337.ts` | EntryPoint + SimpleAccount ABI + bytecode |
| `test/integration/globalSetup.real.ts` | Vitest global setup/teardown |
| `test/integration/services/bcosRpc.real.test.ts` | 8 service-layer tests |
| `test/integration/services/web3Rpc.real.test.ts` | 7 service-layer tests |
| `test/integration/commands/real.test.ts` | 18 command-layer tests |
| `vitest.real.config.ts` | Vitest config for real-node tests |
| `.github/workflows/ci.yml` | Updated with integration job |

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
- Tests are idempotent: each run deploys fresh contracts (node state from prior runs doesn't matter since build_chain.sh creates a fresh chain)
- `pnpm test` (default) skips all real-node tests — they only run via `pnpm test:real`
- CI integration job is independent from the existing unit test job
