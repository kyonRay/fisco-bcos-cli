import { z } from "zod";
import { defineCommand } from "../registry.js";
import { parseLogLine } from "../../services/logParser.js";
import { analyzePerf } from "../../services/perfAnalyzer.js";
import { requireLogDir } from "../../buildContext.js";

function parseSince(s: string): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(s);
  if (!m) throw new Error(`invalid --since: ${s}`);
  const n = Number(m[1]);
  const unit = m[2]!;
  return unit === "s" ? n * 1000 : unit === "m" ? n * 60000 :
    unit === "h" ? n * 3600000 : n * 86400000;
}

defineCommand({
  name: "doctor perf",
  description: "Phase-time breakdown from node logs (txpool/consensus/execution/storage)",
  schema: z.object({ since: z.string().default("10m") }),
  capabilities: { requiresLogDir: true },
  handler: async (ctx, args) => {
    requireLogDir(ctx);
    const windowMs = parseSince(args.since);
    const cutoff = Date.now() - windowMs;
    const events = [];
    let total = 0, unparsed = 0;
    for await (const { line } of ctx.logReader.streamLines()) {
      total++;
      const e = parseLogLine(line);
      if (!e) { unparsed++; continue; }
      const t = Date.parse(e.timestamp.replace(" ", "T") + "Z");
      if (!Number.isFinite(t) || t >= cutoff) events.push(e);
    }
    const report = analyzePerf(events);
    return {
      window: { since: args.since, from: new Date(cutoff).toISOString() },
      ...report,
      stats: { lines: total, parsedEvents: events.length, unparsedLines: unparsed },
    };
  },
});
