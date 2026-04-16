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
