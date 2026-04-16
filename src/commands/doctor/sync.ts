import { z } from "zod";
import { defineCommand } from "../registry.js";
import { parseLogLine } from "../../services/logParser.js";
import { requireLogDir } from "../../buildContext.js";

defineCommand({
  name: "doctor sync",
  description: "Report block-sync activity from logs",
  schema: z.object({}),
  capabilities: { requiresLogDir: true },
  handler: async (ctx) => {
    requireLogDir(ctx);
    let syncEvents = 0;
    let minHeight: number | undefined, maxHeight: number | undefined;
    const failures: string[] = [];
    for await (const { line } of ctx.logReader.streamLines()) {
      const e = parseLogLine(line);
      if (!e || e.stage !== "sync") continue;
      syncEvents++;
      const h = e.fields.height;
      if (typeof h === "number") {
        minHeight = minHeight === undefined ? h : Math.min(minHeight, h);
        maxHeight = maxHeight === undefined ? h : Math.max(maxHeight, h);
      }
      if (e.level === "error" && failures.length < 5) failures.push(line);
    }
    return {
      syncEvents, minHeight, maxHeight,
      progressedBlocks: minHeight !== undefined && maxHeight !== undefined ? maxHeight - minHeight : 0,
      failures,
    };
  },
});
