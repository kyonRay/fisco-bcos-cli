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
