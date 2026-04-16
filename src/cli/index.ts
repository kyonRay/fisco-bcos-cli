#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { homedir } from "node:os";
import { join } from "node:path";
import { allCommands, type CommandDef } from "../commands/registry.js";
import "../commands/registerAll.js";
import { loadConfigFile } from "../config/load.js";
import { buildContext } from "../buildContext.js";
import { createStderrLogger } from "../logger.js";
import { toBcosCliError, exitCodeFor, BcosCliError } from "../errors.js";
import { stringify } from "../serialize.js";
import { collectArgs } from "./zodToYargs.js";
import { renderPretty } from "./prettyRender.js";

const GLOBAL_FLAGS = {
  chain:       { type: "string",  describe: "profile name" },
  config:      { type: "string",  describe: "config file path" },
  "rpc-url":   { type: "string",  describe: "override bcosRpcUrl" },
  "web3-rpc-url":{ type: "string",describe: "override web3RpcUrl" },
  "group-id":  { type: "string",  describe: "override groupId" },
  "log-dir":   { type: "string",  describe: "override logDir" },
  pretty:      { type: "boolean", describe: "human-readable output" },
  json:        { type: "boolean", describe: "force JSON output" },
  strict:      { type: "boolean", default: false, describe: "treat degraded results as errors" },
  verbose:     { type: "boolean", alias: "v", default: false },
  quiet:       { type: "boolean", default: false },
  "no-retry":  { type: "boolean", default: false },
} as const;

function isTty(): boolean { return !!process.stdout.isTTY; }

function decideFormat(argv: Record<string, unknown>): "pretty" | "json" {
  if (argv.json) return "json";
  if (argv.pretty) return "pretty";
  return isTty() ? "pretty" : "json";
}

function mcpEntry(): Promise<void> {
  return import("../mcp/server.js").then((m) => m.startMcpServer());
}

async function runCommand(cmd: CommandDef, argv: Record<string, unknown>): Promise<void> {
  const format = decideFormat(argv);
  const logger = createStderrLogger({ verbose: !!argv.verbose, quiet: !!argv.quiet });

  const configPath = (argv.config as string | undefined)
    ?? process.env.BCOS_CLI_CONFIG
    ?? join(homedir(), ".bcos-cli/config.yaml");

  try {
    const fileConfig = await loadConfigFile(configPath);
    const ctx = buildContext({
      flags: {
        chain: argv.chain as string | undefined,
        rpcUrl: argv["rpc-url"] as string | undefined,
        web3RpcUrl: argv["web3-rpc-url"] as string | undefined,
        groupId: argv["group-id"] as string | undefined,
        logDir: argv["log-dir"] as string | undefined,
      },
      env: {
        BCOS_CLI_CHAIN: process.env.BCOS_CLI_CHAIN,
        BCOS_CLI_CONFIG: process.env.BCOS_CLI_CONFIG,
        BCOS_CLI_RPC_URL: process.env.BCOS_CLI_RPC_URL,
        BCOS_CLI_WEB3_RPC_URL: process.env.BCOS_CLI_WEB3_RPC_URL,
        BCOS_CLI_GROUP_ID: process.env.BCOS_CLI_GROUP_ID,
        BCOS_CLI_LOG_DIR: process.env.BCOS_CLI_LOG_DIR,
      },
      fileConfig,
      logger,
    });

    const parseInput: Record<string, unknown> = {};
    const positionals = argv._ as string[];
    const shape = (cmd.schema as { shape?: Record<string, unknown> }).shape ?? {};
    const argInfos = collectArgs(cmd.schema);
    const namePartsCount = cmd.name.split(" ").length;
    let posIdx = namePartsCount;
    for (const info of argInfos) {
      if (Object.prototype.hasOwnProperty.call(argv, info.name) && argv[info.name] !== undefined) {
        parseInput[info.name] = argv[info.name];
      } else if (posIdx < positionals.length && (info.kind === "string" || info.kind === "array")) {
        if (info.kind === "array") {
          parseInput[info.name] = positionals.slice(posIdx);
          posIdx = positionals.length;
        } else {
          parseInput[info.name] = positionals[posIdx++];
        }
      }
    }
    void shape;
    const parsed = cmd.schema.parse(parseInput);
    const start = Date.now();
    const data = await cmd.handler(ctx, parsed);
    const envelope = {
      ok: true as const,
      data,
      meta: {
        chain: ctx.chain.chainName,
        durationMs: Date.now() - start,
        degraded: (data as { degraded?: boolean })?.degraded ?? false,
      },
    };
    if (argv.strict && envelope.meta.degraded) {
      throw new BcosCliError("INTERNAL", "degraded result with --strict");
    }
    process.stdout.write(format === "pretty" ? renderPretty(envelope) + "\n" : stringify(envelope) + "\n");
    process.exit(0);
  } catch (err) {
    const e = toBcosCliError(err);
    const envelope = {
      ok: false as const,
      error: { code: e.code, message: e.message, details: e.details },
      meta: {},
    };
    process.stdout.write(format === "pretty" ? renderPretty(envelope) + "\n" : stringify(envelope) + "\n");
    process.exit(exitCodeFor(e.code));
  }
}

async function main(): Promise<void> {
  const argv = hideBin(process.argv);

  if (argv[0] === "mcp") { await mcpEntry(); return; }

  let builder = yargs(argv).scriptName("bcos").strict(false).help();
  for (const [name, spec] of Object.entries(GLOBAL_FLAGS)) {
    builder = builder.option(name, spec as never);
  }

  function buildOptions(yb: ReturnType<typeof yargs>, cmd: CommandDef) {
    const argInfos = collectArgs(cmd.schema);
    let y = yb;
    for (const info of argInfos) {
      if (info.kind === "boolean") {
        y = y.option(info.name, { type: "boolean", default: info.default as boolean | undefined,
          describe: info.description });
      } else if (info.kind === "number") {
        y = y.option(info.name, { type: "number", default: info.default as number | undefined });
      } else if (info.kind === "array") {
        // positional array; no option registration
      } else {
        if (info.optional || info.default !== undefined) {
          y = y.option(info.name, { type: "string", default: info.default as string | undefined });
        }
      }
    }
    return y;
  }

  function positionalSuffix(cmd: CommandDef): string {
    return collectArgs(cmd.schema)
      .filter((a) => a.kind === "string" || a.kind === "array")
      .filter((a) => !a.optional && a.default === undefined)
      .map((a) => a.kind === "array" ? `[${a.name}...]` : `[${a.name}]`)
      .join(" ");
  }

  const grouped = new Map<string, CommandDef[]>();
  const toplevel: CommandDef[] = [];
  for (const cmd of allCommands()) {
    const parts = cmd.name.split(" ");
    if (parts.length === 1) {
      toplevel.push(cmd);
    } else {
      const group = parts[0]!;
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(cmd);
    }
  }

  for (const cmd of toplevel) {
    const pos = positionalSuffix(cmd);
    const usage = pos ? `${cmd.name} ${pos}` : cmd.name;
    builder = builder.command(
      usage, cmd.description,
      (yb) => buildOptions(yb, cmd),
      async (parsed) => { await runCommand(cmd, parsed as Record<string, unknown>); },
    );
  }

  for (const [group, cmds] of grouped) {
    builder = builder.command(
      group, `${group} commands`,
      (yb) => {
        let y = yb;
        for (const cmd of cmds) {
          const sub = cmd.name.slice(group.length + 1);
          const pos = positionalSuffix(cmd);
          const usage = pos ? `${sub} ${pos}` : sub;
          y = y.command(
            usage, cmd.description,
            (syb) => buildOptions(syb, cmd),
            async (parsed) => { await runCommand(cmd, parsed as Record<string, unknown>); },
          );
        }
        return y.demandCommand(1);
      },
    );
  }

  await builder.demandCommand(1, "a command is required").parse();
}

main().catch((err) => {
  process.stderr.write(`fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
