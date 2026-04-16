import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema }
  from "@modelcontextprotocol/sdk/types.js";
import { allCommands, getCommand } from "../commands/registry.js";
import "../commands/registerAll.js";
import { loadConfigFile } from "../config/load.js";
import { buildContext } from "../buildContext.js";
import { createSilentLogger } from "../logger.js";
import { toBcosCliError } from "../errors.js";
import { toSerializable } from "../serialize.js";
import { commandToTool } from "./zodToJsonSchema.js";
import { homedir } from "node:os";
import { join } from "node:path";

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "fisco-bcos-cli", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allCommands().map(commandToTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const toolName = req.params.name;
    const commandName = toolName.replace(/_/g, " ");
    const cmd = getCommand(commandName);
    if (!cmd) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({
          ok: false, error: { code: "UNKNOWN_COMMAND", message: `no such command: ${toolName}` },
          meta: {},
        }) }],
      };
    }
    const configPath = process.env.BCOS_CLI_CONFIG ?? join(homedir(), ".bcos-cli/config.yaml");
    try {
      const fileConfig = await loadConfigFile(configPath);
      const ctx = buildContext({
        flags: {},
        env: {
          BCOS_CLI_CHAIN: process.env.BCOS_CLI_CHAIN,
          BCOS_CLI_RPC_URL: process.env.BCOS_CLI_RPC_URL,
          BCOS_CLI_WEB3_RPC_URL: process.env.BCOS_CLI_WEB3_RPC_URL,
          BCOS_CLI_GROUP_ID: process.env.BCOS_CLI_GROUP_ID,
          BCOS_CLI_LOG_DIR: process.env.BCOS_CLI_LOG_DIR,
        },
        fileConfig,
        logger: createSilentLogger(),
      });
      const args = cmd.schema.parse(req.params.arguments ?? {});
      const data = await cmd.handler(ctx, args);
      const envelope = {
        ok: true as const,
        data: toSerializable(data),
        meta: { chain: ctx.chain.chainName,
          degraded: (data as { degraded?: boolean })?.degraded ?? false },
      };
      return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
    } catch (err) {
      const e = toBcosCliError(err);
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({
          ok: false,
          error: { code: e.code, message: e.message, details: e.details },
          meta: {},
        }) }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
