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

  const startBlock = Number(await publicClient.getBlockNumber({ cacheTime: 0 }));

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

  const endBlock = Number(await publicClient.getBlockNumber({ cacheTime: 0 }));

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
