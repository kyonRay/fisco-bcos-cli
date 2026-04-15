import type { ConfigFile, ChainProfile } from "./schema.js";
import { BcosCliError } from "../errors.js";

export interface ResolveFlags {
  chain?: string;
  config?: string;
  rpcUrl?: string;
  web3RpcUrl?: string;
  groupId?: string;
  logDir?: string;
}

export interface EnvVars {
  BCOS_CLI_CHAIN?: string;
  BCOS_CLI_CONFIG?: string;
  BCOS_CLI_RPC_URL?: string;
  BCOS_CLI_WEB3_RPC_URL?: string;
  BCOS_CLI_GROUP_ID?: string;
  BCOS_CLI_LOG_DIR?: string;
}

export interface ResolvedChain {
  chainName: string;
  profile: ChainProfile;
}

export function resolveActiveChain(opts: {
  flags: ResolveFlags;
  env: EnvVars;
  fileConfig: ConfigFile | null;
}): ResolvedChain {
  const { flags, env, fileConfig } = opts;
  const chainName = flags.chain ?? env.BCOS_CLI_CHAIN ?? fileConfig?.defaultChain;

  let profile: Partial<ChainProfile> = { groupId: "group0" };

  if (fileConfig) {
    if (!chainName) {
      throw new BcosCliError("CONFIG_MISSING", "no chain selected and no defaultChain");
    }
    const fromFile = fileConfig.chains[chainName];
    if (!fromFile && (flags.chain || env.BCOS_CLI_CHAIN)) {
      throw new BcosCliError("CHAIN_NOT_FOUND", `chain '${chainName}' not in config`, {
        available: Object.keys(fileConfig.chains),
      });
    }
    profile = { ...profile, ...fileConfig.defaults, ...fromFile };
  }

  if (env.BCOS_CLI_RPC_URL) profile.bcosRpcUrl = env.BCOS_CLI_RPC_URL;
  if (env.BCOS_CLI_WEB3_RPC_URL) profile.web3RpcUrl = env.BCOS_CLI_WEB3_RPC_URL;
  if (env.BCOS_CLI_GROUP_ID) profile.groupId = env.BCOS_CLI_GROUP_ID;
  if (env.BCOS_CLI_LOG_DIR) profile.logDir = env.BCOS_CLI_LOG_DIR;

  if (flags.rpcUrl) profile.bcosRpcUrl = flags.rpcUrl;
  if (flags.web3RpcUrl) profile.web3RpcUrl = flags.web3RpcUrl;
  if (flags.groupId) profile.groupId = flags.groupId;
  if (flags.logDir) profile.logDir = flags.logDir;

  if (!profile.bcosRpcUrl) {
    throw new BcosCliError("CONFIG_MISSING",
      "bcosRpcUrl required — set via config file, --rpc-url, or BCOS_CLI_RPC_URL");
  }

  return {
    chainName: chainName ?? "(ad-hoc)",
    profile: profile as ChainProfile,
  };
}
