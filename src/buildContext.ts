import type { AppContext } from "./context.js";
import type { ConfigFile } from "./config/schema.js";
import type { ResolveFlags, EnvVars } from "./config/resolve.js";
import { resolveActiveChain } from "./config/resolve.js";
import { createBcosRpcClient } from "./services/bcosRpc.js";
import { createWeb3RpcClient } from "./services/web3Rpc.js";
import { createAbiRegistry } from "./services/abiRegistry.js";
import { createTxDecoder } from "./services/txDecoder.js";
import { createLogReader } from "./services/logReader.js";
import { expandHome } from "./config/load.js";
import { BcosCliError } from "./errors.js";
import { homedir } from "node:os";
import type { AppLogger } from "./types.js";

export interface BuildContextOpts {
  flags: ResolveFlags;
  env: EnvVars;
  fileConfig: ConfigFile | null;
  logger: AppLogger;
  homeDir?: string;
  fetchImpl?: typeof fetch;
}

export function buildContext(opts: BuildContextOpts): AppContext {
  const chain = resolveActiveChain({
    flags: opts.flags, env: opts.env, fileConfig: opts.fileConfig,
  });
  const home = opts.homeDir ?? homedir();
  const f = opts.fetchImpl ?? fetch;
  const bcosRpc = createBcosRpcClient({
    url: chain.profile.bcosRpcUrl,
    groupId: chain.profile.groupId,
    fetch: f,
    logger: opts.logger,
    timeoutMs: chain.profile.requestTimeoutMs,
  });
  const web3Rpc = createWeb3RpcClient({
    url: chain.profile.web3RpcUrl ?? chain.profile.bcosRpcUrl,
    fetch: f,
    timeoutMs: chain.profile.requestTimeoutMs,
  });
  const abiStoreDir = expandHome(
    opts.fileConfig?.abiStoreDir ?? "~/.bcos-cli/abi", home);
  const abiRegistry = createAbiRegistry({ storeDir: abiStoreDir });
  const txDecoder = createTxDecoder();
  const logReader = chain.profile.logDir
    ? createLogReader({
        logDir: chain.profile.logDir,
        maxLines: chain.profile.maxLogScanLines,
      })
    : createLogReader({ logDir: "/__no_log_dir__" });
  return { logger: opts.logger, chain, fileConfig: opts.fileConfig,
    bcosRpc, web3Rpc, abiRegistry, txDecoder, logReader };
}

export function requireLogDir(ctx: AppContext): void {
  if (!ctx.chain.profile.logDir) {
    throw new BcosCliError("LOG_DIR_REQUIRED",
      "this command requires logDir (set in profile or via --log-dir)");
  }
}
