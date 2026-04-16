# fisco-bcos-cli

CLI + MCP server for FISCO-BCOS chains. Built for both operators (human-readable tables) and AI agents (structured JSON, MCP tools).

## Install

```bash
npm install -g fisco-bcos-cli
```

Or run on demand:

```bash
npx fisco-bcos-cli <command>
```

## Configure

Write `~/.bcos-cli/config.yaml`:

```yaml
defaultChain: local
chains:
  local:
    bcosRpcUrl: http://127.0.0.1:20200
    web3RpcUrl: http://127.0.0.1:8545
    groupId: group0
    logDir: /data/fisco/node0/log
```

See `examples/config.example.yaml` for full reference.

### Override at runtime

```bash
bcos tx 0xabc... --rpc-url http://rpc.example.com --group-id group1
BCOS_CLI_CHAIN=prod-g1 bcos chain info
```

## Common recipes

**1. Inspect a transaction with decoded input and events**
```bash
bcos abi add 0xTokenContract ./token.abi.json --name Token
bcos tx 0xTxHash
```

**2. Check chain health**
```bash
bcos doctor chain
bcos doctor perf --since 30m
```

**3. Search transactions in a block range**
```bash
bcos search tx --from 0xAlice --from-block 1000 --to-block 2000
```

**4. Use the Web3 RPC subtree for Ethereum-compatible access**
```bash
bcos eth block-number
bcos eth logs --from-block 1 --to-block 100 --address 0xContract
```

**5. Pipe JSON for further processing**
```bash
bcos block latest --with-txs | jq '.data.block.transactions | length'
```

## MCP server (Claude Desktop, Cursor, etc.)

Add to your MCP client config (see `examples/mcp-claude-desktop.json`):

```json
{
  "mcpServers": {
    "fisco-bcos": {
      "command": "npx",
      "args": ["-y", "fisco-bcos-cli", "mcp"]
    }
  }
}
```

Commands are exposed as tools with names like `tx`, `chain_info`, `doctor_perf`, `eth_block`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Runtime error (RPC, file, log parsing) |
| 2 | Usage / config error |

## Output

- Non-TTY: JSON envelope on stdout (for piping and agents)
- TTY: pretty rendered with `--pretty` (default on TTY)
- Warnings, progress, debug: stderr

```json
{
  "ok": true,
  "data": { ... },
  "meta": { "chain": "prod-g1", "durationMs": 42, "degraded": false }
}
```

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

MIT
