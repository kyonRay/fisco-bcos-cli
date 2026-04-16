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
