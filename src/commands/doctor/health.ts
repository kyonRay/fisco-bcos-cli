import { z } from "zod";
import { defineCommand } from "../registry.js";
import { parseLogLine } from "../../services/logParser.js";
import { requireLogDir } from "../../buildContext.js";

defineCommand({
  name: "doctor health",
  description: "Scan logs for severe problems: fatal errors, viewchange storms, sync stalls",
  schema: z.object({}),
  capabilities: { requiresLogDir: true },
  handler: async (ctx) => {
    requireLogDir(ctx);
    let fatals = 0, errors = 0, viewchanges = 0, lastHeight: number | undefined;
    const sampleFatals: string[] = [];
    for await (const { line } of ctx.logReader.streamLines()) {
      const e = parseLogLine(line);
      if (!e) continue;
      if (e.level === "fatal") { fatals++; if (sampleFatals.length < 5) sampleFatals.push(line); }
      if (e.level === "error") errors++;
      if (/viewchange/i.test(e.message)) viewchanges++;
      if (e.stage === "sealer" && typeof e.fields.height === "number") lastHeight = e.fields.height;
    }
    const findings: string[] = [];
    if (fatals > 0) findings.push(`${fatals} fatal log entries found`);
    if (viewchanges > 10) findings.push(`${viewchanges} viewchange events — consensus instability`);
    if (lastHeight === undefined) findings.push("no sealer activity in scanned window — possible halt");
    return { fatals, errors, viewchanges, lastSealerHeight: lastHeight, sampleFatals, findings };
  },
});
