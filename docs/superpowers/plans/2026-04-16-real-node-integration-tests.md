# Real-Node Integration Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 48 integration tests running against Hardhat (Ethereum) and FISCO-BCOS v3.16.4 nodes with ERC20/ERC721/ERC1155/ERC4337 contracts.

**Architecture:** Two test backends share a common contract seed layer. Hardhat validates standard Ethereum compatibility (web3Rpc + eth commands); FISCO-BCOS validates native RPC + full command pipeline. Contracts compiled once via Hardhat, artifacts committed.

**Tech Stack:** Hardhat (devDep, compile + local node), viem (wallet/public client for seeding), vitest (globalSetup per backend), FISCO-BCOS build_chain.sh v3.16.4.

---

## Phase A — Contracts & Compilation

### Task A.1: Hardhat project setup + ERC20 contract

**Files:**
- Create: `hardhat.config.ts`
- Create: `contracts/SimpleERC20.sol`
- Modify: `package.json` (add hardhat devDep + compile script)

- [ ] **Step 1: Install hardhat**

Run: `pnpm add -D hardhat @nomicfoundation/hardhat-toolbox`

- [ ] **Step 2: Create hardhat.config.ts**

```ts
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  paths: {
    sources: "./contracts",
    artifacts: "./test/helpers/contracts/artifacts",
  },
};

export default config;
```

- [ ] **Step 3: Create contracts/SimpleERC20.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(uint256 amount) external {
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
        emit Transfer(address(0), msg.sender, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "not approved");
        require(balanceOf[from] >= amount, "insufficient");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
```

- [ ] **Step 4: Add compile script to package.json**

Add to `scripts`:
```json
"compile:contracts": "hardhat compile"
```

- [ ] **Step 5: Compile and verify**

Run: `pnpm compile:contracts`
Expected: `test/helpers/contracts/artifacts/contracts/SimpleERC20.sol/SimpleERC20.json` created with `abi` and `bytecode` fields.

- [ ] **Step 6: Commit**

```bash
git add hardhat.config.ts contracts/SimpleERC20.sol package.json pnpm-lock.yaml test/helpers/contracts/artifacts/
git commit -m "build: Hardhat setup + SimpleERC20 contract"
```

---

### Task A.2: ERC721 + ERC1155 + ERC4337 contracts

**Files:**
- Create: `contracts/SimpleERC721.sol`
- Create: `contracts/SimpleERC1155.sol`
- Create: `contracts/SimpleEntryPoint.sol`

- [ ] **Step 1: Create contracts/SimpleERC721.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleERC721 {
    string public name;
    string public symbol;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == address(0), "exists");
        ownerOf[tokenId] = to;
        balanceOf[to]++;
        emit Transfer(address(0), to, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from, "not owner");
        require(msg.sender == from || getApproved[tokenId] == msg.sender, "not approved");
        ownerOf[tokenId] = to;
        balanceOf[from]--;
        balanceOf[to]++;
        delete getApproved[tokenId];
        emit Transfer(from, to, tokenId);
    }

    function approve(address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == msg.sender, "not owner");
        getApproved[tokenId] = to;
        emit Approval(msg.sender, to, tokenId);
    }
}
```

- [ ] **Step 2: Create contracts/SimpleERC1155.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleERC1155 {
    string public uri;
    mapping(uint256 => mapping(address => uint256)) public balanceOf;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);

    constructor(string memory _uri) {
        uri = _uri;
    }

    function mint(address to, uint256 id, uint256 amount, bytes calldata) external {
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        require(msg.sender == from, "not owner");
        require(balanceOf[id][from] >= amount, "insufficient");
        balanceOf[id][from] -= amount;
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            result[i] = balanceOf[ids[i]][accounts[i]];
        }
        return result;
    }
}
```

- [ ] **Step 3: Create contracts/SimpleEntryPoint.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes callData;
}

contract SimpleEntryPoint {
    mapping(address => uint256) public nonces;

    event UserOperationEvent(
        bytes32 indexed userOpHash,
        address indexed sender,
        address indexed paymaster,
        uint256 nonce,
        bool success
    );

    function handleOps(UserOperation[] calldata ops, address payable beneficiary) external {
        for (uint256 i = 0; i < ops.length; i++) {
            UserOperation calldata op = ops[i];
            bytes32 opHash = keccak256(abi.encode(op.sender, op.nonce, keccak256(op.callData)));
            require(nonces[op.sender] == op.nonce, "invalid nonce");
            nonces[op.sender]++;
            (bool success,) = op.sender.call(op.callData);
            emit UserOperationEvent(opHash, op.sender, address(0), op.nonce, success);
        }
        if (beneficiary != address(0)) {
            (bool sent,) = beneficiary.call{value: 0}("");
            require(sent || true);
        }
    }
}

contract SimpleAccount {
    address public entryPoint;
    address public owner;
    uint256 public value;

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
        owner = msg.sender;
    }

    function execute(uint256 _value) external {
        value = _value;
    }

    fallback() external payable {}
    receive() external payable {}
}
```

- [ ] **Step 4: Compile all contracts**

Run: `pnpm compile:contracts`
Expected: artifacts generated for all 5 contracts (SimpleERC20, SimpleERC721, SimpleERC1155, SimpleEntryPoint, SimpleAccount).

- [ ] **Step 5: Commit**

```bash
git add contracts/ test/helpers/contracts/artifacts/
git commit -m "build: ERC721, ERC1155, and ERC4337 contracts"
```

---

### Task A.3: Contract artifact loader

**Files:**
- Create: `test/helpers/contracts/index.ts`

- [ ] **Step 1: Create test/helpers/contracts/index.ts**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Artifact {
  abi: unknown[];
  bytecode: string;
}

function loadArtifact(contractDir: string, name: string): Artifact {
  const raw = readFileSync(
    join(new URL("./artifacts/contracts/", import.meta.url).pathname, contractDir, `${name}.json`),
    "utf8",
  );
  const { abi, bytecode } = JSON.parse(raw) as { abi: unknown[]; bytecode: string };
  return { abi, bytecode };
}

export const ERC20_ARTIFACT = loadArtifact("SimpleERC20.sol", "SimpleERC20");
export const ERC721_ARTIFACT = loadArtifact("SimpleERC721.sol", "SimpleERC721");
export const ERC1155_ARTIFACT = loadArtifact("SimpleERC1155.sol", "SimpleERC1155");
export const ENTRY_POINT_ARTIFACT = loadArtifact("SimpleEntryPoint.sol", "SimpleEntryPoint");
export const SIMPLE_ACCOUNT_ARTIFACT = loadArtifact("SimpleEntryPoint.sol", "SimpleAccount");
```

- [ ] **Step 2: Commit**

```bash
git add test/helpers/contracts/index.ts
git commit -m "test: contract artifact loader for integration tests"
```

---

## Phase B — Node Managers

### Task B.1: Hardhat node manager

**Files:**
- Create: `test/helpers/hardhatNode.ts`

- [ ] **Step 1: Create test/helpers/hardhatNode.ts**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add test/helpers/hardhatNode.ts
git commit -m "test: Hardhat node lifecycle manager"
```

---

### Task B.2: FISCO-BCOS node manager

**Files:**
- Create: `test/helpers/chainNode.ts`

Note: the existing `test/helpers/fixtureRpcServer.ts` is untouched — this is a separate file.

- [ ] **Step 1: Create test/helpers/chainNode.ts**

```ts
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ChainInfo {
  bcosRpcUrl: string;
  web3RpcUrl: string;
  dataDir: string;
}

const BUILD_CHAIN_URL =
  "https://github.com/FISCO-BCOS/FISCO-BCOS/releases/download/v3.16.0/build_chain.sh";

let dataDir: string | null = null;

async function poll(url: string, body: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (res.ok) {
        const j = await res.json() as { result?: unknown };
        if (j.result !== undefined) return;
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("FISCO-BCOS node failed to start within timeout");
}

function run(cmd: string, args: string[], cwd: string): void {
  execFileSync(cmd, args, {
    cwd,
    stdio: process.env.DEBUG ? "inherit" : "pipe",
    timeout: 120000,
  });
}

export async function setupChain(): Promise<ChainInfo> {
  dataDir = mkdtempSync(join(tmpdir(), "bcos-test-"));

  run("curl", ["-LO", BUILD_CHAIN_URL], dataDir);
  run("bash", ["build_chain.sh", "-l", "127.0.0.1:1", "-p", "30300,20200,8545"], dataDir);

  const startScript = join(dataDir, "nodes/127.0.0.1/start_all.sh");
  if (!existsSync(startScript)) {
    throw new Error(`start_all.sh not found at ${startScript}`);
  }
  run("bash", [startScript], dataDir);

  await poll(
    "http://127.0.0.1:20200",
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBlockNumber", params: ["group0"] }),
    30000,
  );

  return {
    bcosRpcUrl: "http://127.0.0.1:20200",
    web3RpcUrl: "http://127.0.0.1:8545",
    dataDir,
  };
}

export async function teardownChain(): Promise<void> {
  if (!dataDir) return;
  try {
    const stopScript = join(dataDir, "nodes/127.0.0.1/stop_all.sh");
    if (existsSync(stopScript)) {
      run("bash", [stopScript], dataDir);
    }
  } catch { /* best effort */ }
  try {
    execFileSync("rm", ["-rf", dataDir], { stdio: "pipe" });
  } catch { /* best effort */ }
  dataDir = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add test/helpers/chainNode.ts
git commit -m "test: FISCO-BCOS node lifecycle manager (build_chain.sh)"
```

---

## Phase C — Contract Seeding

### Task C.1: Seed contracts helper

**Files:**
- Create: `test/helpers/seedContracts.ts`

- [ ] **Step 1: Create test/helpers/seedContracts.ts**

```ts
import { createPublicClient, createWalletClient, http, type Hex, type Abi,
  encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ERC20_ARTIFACT, ERC721_ARTIFACT, ERC1155_ARTIFACT,
  ENTRY_POINT_ARTIFACT, SIMPLE_ACCOUNT_ARTIFACT,
} from "./contracts/index.js";

export interface SeedResult {
  erc20: { address: string; transferTxHash: string; abi: unknown[] };
  erc721: { address: string; transferTxHash: string; abi: unknown[] };
  erc1155: { address: string; transferTxHash: string; abi: unknown[] };
  erc4337: { entryPointAddress: string; accountAddress: string; userOpTxHash: string; abi: unknown[] };
  blockRangeStart: number;
  blockRangeEnd: number;
  account1: string;
  account2: string;
}

const PRIVATE_KEY_1 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const PRIVATE_KEY_2 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

export interface SeedOpts {
  web3RpcUrl: string;
  chainId?: number;
}

async function deployContract(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  artifact: { abi: unknown[]; bytecode: string },
  args: unknown[],
): Promise<{ address: Hex; deployTxHash: Hex }> {
  const hash = await walletClient.deployContract({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode as Hex,
    args,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("deploy failed: no contract address");
  return { address: receipt.contractAddress, deployTxHash: hash };
}

export async function seedContracts(opts: SeedOpts): Promise<SeedResult> {
  const chain = {
    id: opts.chainId ?? 31337,
    name: "test",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [opts.web3RpcUrl] } },
  };
  const transport = http(opts.web3RpcUrl);
  const account1 = privateKeyToAccount(PRIVATE_KEY_1);
  const account2 = privateKeyToAccount(PRIVATE_KEY_2);
  const walletClient = createWalletClient({ account: account1, chain, transport });
  const publicClient = createPublicClient({ chain, transport });

  const startBlock = Number(await publicClient.getBlockNumber());

  // --- ERC20 ---
  const erc20 = await deployContract(walletClient, publicClient, ERC20_ARTIFACT, ["TestToken", "TT", 18]);
  await publicClient.waitForTransactionReceipt({
    hash: await walletClient.writeContract({
      address: erc20.address, abi: ERC20_ARTIFACT.abi as Abi,
      functionName: "mint", args: [1000n],
    }),
  });
  const erc20TransferHash = await walletClient.writeContract({
    address: erc20.address, abi: ERC20_ARTIFACT.abi as Abi,
    functionName: "transfer", args: [account2.address, 100n],
  });
  await publicClient.waitForTransactionReceipt({ hash: erc20TransferHash });

  // --- ERC721 ---
  const erc721 = await deployContract(walletClient, publicClient, ERC721_ARTIFACT, ["TestNFT", "TNFT"]);
  await publicClient.waitForTransactionReceipt({
    hash: await walletClient.writeContract({
      address: erc721.address, abi: ERC721_ARTIFACT.abi as Abi,
      functionName: "mint", args: [account1.address, 1n],
    }),
  });
  const erc721TransferHash = await walletClient.writeContract({
    address: erc721.address, abi: ERC721_ARTIFACT.abi as Abi,
    functionName: "transferFrom", args: [account1.address, account2.address, 1n],
  });
  await publicClient.waitForTransactionReceipt({ hash: erc721TransferHash });

  // --- ERC1155 ---
  const erc1155 = await deployContract(walletClient, publicClient, ERC1155_ARTIFACT, ["https://example.com/{id}"]);
  await publicClient.waitForTransactionReceipt({
    hash: await walletClient.writeContract({
      address: erc1155.address, abi: ERC1155_ARTIFACT.abi as Abi,
      functionName: "mint", args: [account1.address, 1n, 100n, "0x"],
    }),
  });
  const erc1155TransferHash = await walletClient.writeContract({
    address: erc1155.address, abi: ERC1155_ARTIFACT.abi as Abi,
    functionName: "safeTransferFrom", args: [account1.address, account2.address, 1n, 50n, "0x"],
  });
  await publicClient.waitForTransactionReceipt({ hash: erc1155TransferHash });

  // --- ERC4337 (simplified) ---
  const entryPoint = await deployContract(walletClient, publicClient, ENTRY_POINT_ARTIFACT, []);
  const simpleAccount = await deployContract(walletClient, publicClient, SIMPLE_ACCOUNT_ARTIFACT, [entryPoint.address]);

  const executeCalldata = encodeFunctionData({
    abi: SIMPLE_ACCOUNT_ARTIFACT.abi as Abi,
    functionName: "execute",
    args: [42n],
  });
  const userOp = {
    sender: simpleAccount.address,
    nonce: 0n,
    callData: executeCalldata,
  };
  const handleOpsHash = await walletClient.writeContract({
    address: entryPoint.address,
    abi: ENTRY_POINT_ARTIFACT.abi as Abi,
    functionName: "handleOps",
    args: [[userOp], account1.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: handleOpsHash });

  const endBlock = Number(await publicClient.getBlockNumber());

  return {
    erc20: { address: erc20.address, transferTxHash: erc20TransferHash, abi: ERC20_ARTIFACT.abi },
    erc721: { address: erc721.address, transferTxHash: erc721TransferHash, abi: ERC721_ARTIFACT.abi },
    erc1155: { address: erc1155.address, transferTxHash: erc1155TransferHash, abi: ERC1155_ARTIFACT.abi },
    erc4337: {
      entryPointAddress: entryPoint.address, accountAddress: simpleAccount.address,
      userOpTxHash: handleOpsHash, abi: ENTRY_POINT_ARTIFACT.abi,
    },
    blockRangeStart: startBlock,
    blockRangeEnd: endBlock,
    account1: account1.address,
    account2: account2.address,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add test/helpers/seedContracts.ts
git commit -m "test: contract seed helper (ERC20/721/1155/4337)"
```

---

## Phase D — Vitest Configs & Global Setups

### Task D.1: Hardhat global setup + vitest config

**Files:**
- Create: `test/integration/globalSetup.hardhat.ts`
- Create: `vitest.hardhat.config.ts`
- Modify: `package.json` (add test:hardhat script)

- [ ] **Step 1: Create test/integration/globalSetup.hardhat.ts**

```ts
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupHardhat, teardownHardhat } from "../helpers/hardhatNode.js";
import { seedContracts } from "../helpers/seedContracts.js";

const SEED_FILE = join(tmpdir(), "bcos-cli-hardhat-seed.json");

export async function setup(): Promise<void> {
  const hardhat = await setupHardhat();
  const seed = await seedContracts({ web3RpcUrl: hardhat.url, chainId: hardhat.chainId });
  writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
  process.env.HARDHAT_TEST_URL = hardhat.url;
  process.env.HARDHAT_TEST_SEED_FILE = SEED_FILE;
}

export async function teardown(): Promise<void> {
  await teardownHardhat();
}
```

- [ ] **Step 2: Create vitest.hardhat.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["test/**/*.hardhat.test.ts"],
    globalSetup: ["./test/integration/globalSetup.hardhat.ts"],
    testTimeout: 15000,
  },
});
```

- [ ] **Step 3: Add test:hardhat script to package.json**

Add to `scripts`:
```json
"test:hardhat": "vitest run --config vitest.hardhat.config.ts"
```

- [ ] **Step 4: Commit**

```bash
git add test/integration/globalSetup.hardhat.ts vitest.hardhat.config.ts package.json
git commit -m "test: Hardhat global setup + vitest config"
```

---

### Task D.2: FISCO-BCOS global setup + vitest config

**Files:**
- Create: `test/integration/globalSetup.bcos.ts`
- Create: `vitest.bcos.config.ts`
- Modify: `package.json` (add test:bcos and test:real scripts)

- [ ] **Step 1: Create test/integration/globalSetup.bcos.ts**

```ts
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupChain, teardownChain } from "../helpers/chainNode.js";
import { seedContracts } from "../helpers/seedContracts.js";

const SEED_FILE = join(tmpdir(), "bcos-cli-bcos-seed.json");

export async function setup(): Promise<void> {
  const chain = await setupChain();
  const seed = await seedContracts({ web3RpcUrl: chain.web3RpcUrl });
  writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
  process.env.BCOS_TEST_RPC_URL = chain.bcosRpcUrl;
  process.env.BCOS_TEST_WEB3_URL = chain.web3RpcUrl;
  process.env.BCOS_TEST_SEED_FILE = SEED_FILE;
}

export async function teardown(): Promise<void> {
  await teardownChain();
}
```

- [ ] **Step 2: Create vitest.bcos.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["test/**/*.bcos.test.ts"],
    globalSetup: ["./test/integration/globalSetup.bcos.ts"],
    testTimeout: 30000,
  },
});
```

- [ ] **Step 3: Add scripts to package.json**

Add to `scripts`:
```json
"test:bcos": "vitest run --config vitest.bcos.config.ts",
"test:real": "pnpm test:hardhat && pnpm test:bcos"
```

- [ ] **Step 4: Commit**

```bash
git add test/integration/globalSetup.bcos.ts vitest.bcos.config.ts package.json
git commit -m "test: FISCO-BCOS global setup + vitest config"
```

---

### Task D.3: Shared seed data loader

**Files:**
- Create: `test/helpers/loadSeed.ts`

- [ ] **Step 1: Create test/helpers/loadSeed.ts**

```ts
import { readFileSync } from "node:fs";
import type { SeedResult } from "./seedContracts.js";

export function loadSeed(envVar: string): SeedResult {
  const path = process.env[envVar];
  if (!path) throw new Error(`${envVar} not set — did globalSetup run?`);
  return JSON.parse(readFileSync(path, "utf8")) as SeedResult;
}
```

- [ ] **Step 2: Commit**

```bash
git add test/helpers/loadSeed.ts
git commit -m "test: seed data loader helper"
```

---

## Phase E — Hardhat Integration Tests

### Task E.1: web3Rpc service tests against Hardhat (7 tests)

**Files:**
- Create: `test/integration/services/web3Rpc.hardhat.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { createWeb3RpcClient } from "../../../src/services/web3Rpc.js";
import { loadSeed } from "../../helpers/loadSeed.js";
import type { Hex } from "viem";

const skip = !process.env.HARDHAT_TEST_URL;

describe.skipIf(skip)("web3Rpc against Hardhat", () => {
  const client = () => createWeb3RpcClient({ url: process.env.HARDHAT_TEST_URL! });
  const seed = () => loadSeed("HARDHAT_TEST_SEED_FILE");

  it("blockNumber returns bigint >= 0n", async () => {
    expect(await client().blockNumber()).toBeGreaterThanOrEqual(0n);
  });

  it("chainId returns 31337", async () => {
    expect(await client().chainId()).toBe(31337);
  });

  it("gasPrice returns bigint > 0n", async () => {
    expect(await client().gasPrice()).toBeGreaterThan(0n);
  });

  it("getBlock with seed block", async () => {
    const block = await client().getBlock({ blockNumber: BigInt(seed().blockRangeEnd), includeTransactions: true });
    expect(block).toBeDefined();
  });

  it("getTransaction returns tx with correct to", async () => {
    const tx = await client().getTransaction(seed().erc20.transferTxHash as Hex) as { to?: string };
    expect(tx.to?.toLowerCase()).toBe(seed().erc20.address.toLowerCase());
  });

  it("getTransactionReceipt has logs", async () => {
    const receipt = await client().getTransactionReceipt(seed().erc20.transferTxHash as Hex) as { logs?: unknown[] };
    expect(receipt.logs!.length).toBeGreaterThan(0);
  });

  it("getLogs returns Transfer events", async () => {
    const logs = await client().getLogs({
      address: seed().erc20.address as Hex,
      fromBlock: BigInt(seed().blockRangeStart),
      toBlock: BigInt(seed().blockRangeEnd),
    }) as unknown[];
    expect(logs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test:hardhat`
Expected: 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/integration/services/web3Rpc.hardhat.test.ts
git commit -m "test: web3Rpc integration tests against Hardhat node"
```

---

### Task E.2: eth command tests against Hardhat (8 tests)

**Files:**
- Create: `test/integration/commands/eth.hardhat.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createWeb3RpcClient } from "../../../src/services/web3Rpc.js";
import { createSilentLogger } from "../../../src/logger.js";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import type { AppContext } from "../../../src/context.js";
import { loadSeed } from "../../helpers/loadSeed.js";

const skip = !process.env.HARDHAT_TEST_URL;

describe.skipIf(skip)("eth commands against Hardhat", () => {
  let ctx: AppContext;

  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/registerAll.js");
    const web3Rpc = createWeb3RpcClient({ url: process.env.HARDHAT_TEST_URL! });
    ctx = {
      logger: createSilentLogger(),
      chain: { chainName: "hardhat-test", profile: { bcosRpcUrl: "unused", groupId: "group0" } as never },
      fileConfig: null,
      bcosRpc: {} as never,
      web3Rpc,
      abiRegistry: { add: async () => ({} as never), get: async () => null, list: async () => [], remove: async () => false },
      txDecoder: { decodeInput: async () => ({ status: "abi_not_found" as const }), decodeEvent: async () => ({ status: "abi_not_found" as const }) },
      logReader: {} as never,
    };
  });

  const seed = () => loadSeed("HARDHAT_TEST_SEED_FILE");

  it("eth block-number", async () => {
    const r = await getCommand("eth block-number")!.handler(ctx, {}) as { blockNumber: string };
    expect(Number(r.blockNumber)).toBeGreaterThanOrEqual(0);
  });

  it("eth chain-id returns 31337", async () => {
    const r = await getCommand("eth chain-id")!.handler(ctx, {}) as { chainId: number };
    expect(r.chainId).toBe(31337);
  });

  it("eth gas-price", async () => {
    const r = await getCommand("eth gas-price")!.handler(ctx, {}) as { gasPrice: string };
    expect(BigInt(r.gasPrice)).toBeGreaterThan(0n);
  });

  it("eth block", async () => {
    const r = await getCommand("eth block")!.handler(ctx, {
      block: { kind: "number", value: String(seed().blockRangeEnd) }, withTxs: false,
    }) as { block: unknown };
    expect(r.block).toBeDefined();
  });

  it("eth tx", async () => {
    const r = await getCommand("eth tx")!.handler(ctx, { hash: seed().erc20.transferTxHash }) as { tx: { to?: string } };
    expect(r.tx.to?.toLowerCase()).toBe(seed().erc20.address.toLowerCase());
  });

  it("eth receipt", async () => {
    const r = await getCommand("eth receipt")!.handler(ctx, { hash: seed().erc20.transferTxHash }) as { receipt: { logs?: unknown[] } };
    expect(r.receipt.logs!.length).toBeGreaterThan(0);
  });

  it("eth call balanceOf", async () => {
    const r = await getCommand("eth call")!.handler(ctx, {
      address: seed().erc20.address,
      data: "0x70a08231000000000000000000000000" + seed().account1.slice(2).toLowerCase(),
    }) as { result: string };
    expect(r.result).toBeDefined();
  });

  it("eth logs", async () => {
    const r = await getCommand("eth logs")!.handler(ctx, {
      fromBlock: String(seed().blockRangeStart),
      toBlock: String(seed().blockRangeEnd),
      address: seed().erc20.address,
    }) as { logs: unknown[] };
    expect(r.logs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test:hardhat`
Expected: 15 tests pass (7 service + 8 command).

- [ ] **Step 3: Commit**

```bash
git add test/integration/commands/eth.hardhat.test.ts
git commit -m "test: eth command integration tests against Hardhat node"
```

---

## Phase F — FISCO-BCOS Integration Tests

### Task F.1: bcosRpc service tests (8 tests)

**Files:**
- Create: `test/integration/services/bcosRpc.bcos.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { createBcosRpcClient } from "../../../src/services/bcosRpc.js";
import { createSilentLogger } from "../../../src/logger.js";
import { loadSeed } from "../../helpers/loadSeed.js";

const skip = !process.env.BCOS_TEST_RPC_URL;

describe.skipIf(skip)("bcosRpc against FISCO-BCOS", () => {
  const client = () => createBcosRpcClient({
    url: process.env.BCOS_TEST_RPC_URL!,
    groupId: "group0",
    fetch: globalThis.fetch,
    logger: createSilentLogger(),
    retries: 1,
    timeoutMs: 10000,
  });
  const seed = () => loadSeed("BCOS_TEST_SEED_FILE");

  it("getBlockNumber returns result", async () => {
    const result = await client().call<unknown>("getBlockNumber", []);
    expect(result).toBeDefined();
  });

  it("getSyncStatus returns object", async () => {
    const result = await client().call<unknown>("getSyncStatus", []);
    expect(result).toBeDefined();
  });

  it("getSealerList returns array", async () => {
    const result = await client().call<unknown[]>("getSealerList", []);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getGroupList contains group0", async () => {
    const result = await client().call<string[]>("getGroupList", []);
    expect(result).toContain("group0");
  });

  it("getBlockByNumber returns block", async () => {
    const block = await client().call<{ transactions?: unknown[] }>(
      "getBlockByNumber", [String(seed().blockRangeEnd), true],
    );
    expect(block).toBeDefined();
  });

  it("getTransactionByHash returns tx", async () => {
    const tx = await client().call<{ to?: string }>(
      "getTransactionByHash", [seed().erc20.transferTxHash],
    );
    expect(tx).toBeDefined();
    expect(tx.to?.toLowerCase()).toBe(seed().erc20.address.toLowerCase());
  });

  it("getTransactionReceipt returns receipt", async () => {
    const receipt = await client().call<{ status?: string }>(
      "getTransactionReceipt", [seed().erc20.transferTxHash],
    );
    expect(receipt).toBeDefined();
  });

  it("getTransactionByHash for nonexistent returns null", async () => {
    const result = await client().call<unknown>(
      "getTransactionByHash", ["0x" + "00".repeat(32)],
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add test/integration/services/bcosRpc.bcos.test.ts
git commit -m "test: bcosRpc integration tests against FISCO-BCOS node"
```

---

### Task F.2: web3Rpc service tests against FISCO-BCOS (7 tests)

**Files:**
- Create: `test/integration/services/web3Rpc.bcos.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { createWeb3RpcClient } from "../../../src/services/web3Rpc.js";
import { loadSeed } from "../../helpers/loadSeed.js";
import type { Hex } from "viem";

const skip = !process.env.BCOS_TEST_WEB3_URL;

describe.skipIf(skip)("web3Rpc against FISCO-BCOS", () => {
  const client = () => createWeb3RpcClient({ url: process.env.BCOS_TEST_WEB3_URL! });
  const seed = () => loadSeed("BCOS_TEST_SEED_FILE");

  it("blockNumber returns bigint >= seed end", async () => {
    expect(await client().blockNumber()).toBeGreaterThanOrEqual(BigInt(seed().blockRangeEnd));
  });

  it("chainId returns number > 0", async () => {
    expect(await client().chainId()).toBeGreaterThan(0);
  });

  it("gasPrice returns bigint >= 0n", async () => {
    expect(await client().gasPrice()).toBeGreaterThanOrEqual(0n);
  });

  it("getBlock with seed block", async () => {
    const block = await client().getBlock({ blockNumber: BigInt(seed().blockRangeEnd) });
    expect(block).toBeDefined();
  });

  it("getTransaction returns tx", async () => {
    const tx = await client().getTransaction(seed().erc20.transferTxHash as Hex) as { to?: string };
    expect(tx.to?.toLowerCase()).toBe(seed().erc20.address.toLowerCase());
  });

  it("getTransactionReceipt has logs", async () => {
    const receipt = await client().getTransactionReceipt(seed().erc20.transferTxHash as Hex) as { logs?: unknown[] };
    expect(receipt.logs).toBeDefined();
  });

  it("getLogs returns events", async () => {
    const logs = await client().getLogs({
      address: seed().erc20.address as Hex,
      fromBlock: BigInt(seed().blockRangeStart),
      toBlock: BigInt(seed().blockRangeEnd),
    }) as unknown[];
    expect(logs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add test/integration/services/web3Rpc.bcos.test.ts
git commit -m "test: web3Rpc integration tests against FISCO-BCOS node"
```

---

### Task F.3: Command-layer tests against FISCO-BCOS (18 tests)

**Files:**
- Create: `test/integration/commands/real.bcos.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __resetRegistry, getCommand } from "../../../src/commands/registry.js";
import { buildContext } from "../../../src/buildContext.js";
import { createSilentLogger } from "../../../src/logger.js";
import { createAbiRegistry } from "../../../src/services/abiRegistry.js";
import type { AppContext } from "../../../src/context.js";
import { loadSeed } from "../../helpers/loadSeed.js";
import type { SeedResult } from "../../helpers/seedContracts.js";

const skip = !process.env.BCOS_TEST_RPC_URL;

describe.skipIf(skip)("commands against FISCO-BCOS", () => {
  let ctx: AppContext;
  let s: SeedResult;

  beforeAll(async () => {
    __resetRegistry();
    await import("../../../src/commands/registerAll.js");
    s = loadSeed("BCOS_TEST_SEED_FILE");
    const abiDir = mkdtempSync(join(tmpdir(), "bcos-abi-test-"));
    ctx = buildContext({
      flags: { rpcUrl: process.env.BCOS_TEST_RPC_URL! },
      env: {},
      fileConfig: null,
      logger: createSilentLogger(),
      fetchImpl: globalThis.fetch,
    });
    ctx = { ...ctx, abiRegistry: createAbiRegistry({ storeDir: abiDir }) };
  });

  it("tx (ERC20 transfer) returns tx + receipt", async () => {
    const r = await getCommand("tx")!.handler(ctx, { hash: s.erc20.transferTxHash, decode: false }) as {
      tx: { hash: string }; receipt: unknown;
    };
    expect(r.tx.hash.toLowerCase()).toBe(s.erc20.transferTxHash.toLowerCase());
    expect(r.receipt).toBeDefined();
  });

  it("tx (ERC721 transferFrom)", async () => {
    const r = await getCommand("tx")!.handler(ctx, { hash: s.erc721.transferTxHash, decode: false }) as { tx: unknown };
    expect(r.tx).toBeDefined();
  });

  it("tx (ERC1155 safeTransferFrom)", async () => {
    const r = await getCommand("tx")!.handler(ctx, { hash: s.erc1155.transferTxHash, decode: false }) as { tx: unknown };
    expect(r.tx).toBeDefined();
  });

  it("tx (ERC4337 handleOps)", async () => {
    const r = await getCommand("tx")!.handler(ctx, { hash: s.erc4337.userOpTxHash, decode: false }) as { tx: unknown };
    expect(r.tx).toBeDefined();
  });

  it("block returns data", async () => {
    const r = await getCommand("block")!.handler(ctx, {
      block: { kind: "number", value: String(s.blockRangeEnd) }, withTxs: false,
    }) as { block: unknown };
    expect(r.block).toBeDefined();
  });

  it("receipt returns receipt", async () => {
    const r = await getCommand("receipt")!.handler(ctx, { hash: s.erc20.transferTxHash }) as { receipt: unknown };
    expect(r.receipt).toBeDefined();
  });

  it("account (ERC20) is contract", async () => {
    const r = await getCommand("account")!.handler(ctx, { address: s.erc20.address }) as {
      isContract: boolean; codeSize: number;
    };
    expect(r.isContract).toBe(true);
    expect(r.codeSize).toBeGreaterThan(0);
  });

  it("account (ERC721) is contract", async () => {
    const r = await getCommand("account")!.handler(ctx, { address: s.erc721.address }) as { isContract: boolean };
    expect(r.isContract).toBe(true);
  });

  it("code (ERC1155) returns bytecode", async () => {
    const r = await getCommand("code")!.handler(ctx, { address: s.erc1155.address }) as { code: string };
    expect(r.code.length).toBeGreaterThan(2);
  });

  it("call balanceOf (ERC20)", async () => {
    await ctx.abiRegistry.add(s.erc20.address, s.erc20.abi, "ERC20");
    const r = await getCommand("call")!.handler(ctx, {
      address: s.erc20.address, method: "balanceOf", args: [s.account1],
    }) as { decoded: unknown };
    expect(r.decoded).toBeDefined();
  });

  it("call ownerOf (ERC721)", async () => {
    await ctx.abiRegistry.add(s.erc721.address, s.erc721.abi, "ERC721");
    const r = await getCommand("call")!.handler(ctx, {
      address: s.erc721.address, method: "ownerOf", args: ["1"],
    }) as { decoded: unknown };
    expect(r.decoded).toBeDefined();
  });

  it("call balanceOf (ERC1155)", async () => {
    await ctx.abiRegistry.add(s.erc1155.address, s.erc1155.abi, "ERC1155");
    const r = await getCommand("call")!.handler(ctx, {
      address: s.erc1155.address, method: "balanceOf", args: [s.account2, "1"],
    }) as { decoded: unknown };
    expect(r.decoded).toBeDefined();
  });

  it("event (ERC20 Transfer)", async () => {
    const r = await getCommand("event")!.handler(ctx, {
      address: s.erc20.address,
      fromBlock: String(s.blockRangeStart),
      toBlock: String(s.blockRangeEnd),
    }) as { count: number };
    expect(r.count).toBeGreaterThan(0);
  });

  it("event (ERC721 Transfer filtered)", async () => {
    const r = await getCommand("event")!.handler(ctx, {
      address: s.erc721.address,
      fromBlock: String(s.blockRangeStart),
      toBlock: String(s.blockRangeEnd),
      name: "Transfer",
    }) as { logs: unknown[] };
    expect(r.logs.length).toBeGreaterThan(0);
  });

  it("event (ERC1155 TransferSingle)", async () => {
    const r = await getCommand("event")!.handler(ctx, {
      address: s.erc1155.address,
      fromBlock: String(s.blockRangeStart),
      toBlock: String(s.blockRangeEnd),
    }) as { count: number };
    expect(r.count).toBeGreaterThan(0);
  });

  it("chain info returns sync status", async () => {
    const r = await getCommand("chain info")!.handler(ctx, {}) as { syncStatus: unknown };
    expect(r.syncStatus).toBeDefined();
  });

  it("doctor chain returns findings", async () => {
    const r = await getCommand("doctor chain")!.handler(ctx, {}) as { findings: string[] };
    expect(Array.isArray(r.findings)).toBe(true);
  });

  it("abi add + tx decode = not degraded", async () => {
    await ctx.abiRegistry.add(s.erc20.address, s.erc20.abi, "ERC20");
    const r = await getCommand("tx")!.handler(ctx, {
      hash: s.erc20.transferTxHash, decode: true,
    }) as { degraded: boolean; decoded: { status: string } };
    expect(r.degraded).toBe(false);
    expect(r.decoded.status).toBe("ok");
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add test/integration/commands/real.bcos.test.ts
git commit -m "test: 18 command-layer integration tests against FISCO-BCOS"
```

---

## Phase G — CI Workflow

### Task G.1: Update CI with integration jobs

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update .github/workflows/ci.yml**

Replace the entire file with:

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

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

  integration-hardhat:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm compile:contracts
      - run: pnpm test:hardhat

  integration-bcos:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm compile:contracts
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

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Hardhat + FISCO-BCOS integration test jobs"
```

---

## Execution Strategy

| Phase | Mode | Tasks | Rationale |
|---|---|---|---|
| A (Contracts) | Serial | A.1, A.2, A.3 | A.2 depends on A.1 (hardhat config); A.3 depends on compiled artifacts |
| B (Node managers) | Parallel | B.1, B.2 | Independent: Hardhat vs FISCO-BCOS |
| C (Seed) | Serial | C.1 | Depends on A.3 (artifact loader) |
| D (Config) | Serial | D.1, D.2, D.3 | D.1/D.2 depend on B + C; D.3 is shared |
| E (Hardhat tests) | Parallel | E.1, E.2 | Independent test files |
| F (BCOS tests) | Serial | F.1, F.2, F.3 | F.3 depends on command registry which shares state |
| G (CI) | Serial | G.1 | Final step |

Model selection:
- All tasks: **sonnet** (integration concerns, multi-file awareness)
- Exception: G.1 (CI yaml) can use **haiku** (mechanical)
