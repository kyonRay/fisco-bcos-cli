import type { AppLogger } from "./types.js";
import type { ResolvedChain } from "./config/resolve.js";
import type { ConfigFile } from "./config/schema.js";
import type { BcosRpcClient } from "./services/bcosRpc.js";
import type { Web3RpcClient } from "./services/web3Rpc.js";
import type { AbiRegistryService } from "./services/abiRegistry.js";
import type { TxDecoderService } from "./services/txDecoder.js";
import type { LogReaderService } from "./services/logReader.js";

export interface AppContext {
  logger: AppLogger;
  chain: ResolvedChain;
  fileConfig: ConfigFile | null;
  bcosRpc: BcosRpcClient;
  web3Rpc: Web3RpcClient;
  abiRegistry: AbiRegistryService;
  txDecoder: TxDecoderService;
  logReader: LogReaderService;
}
