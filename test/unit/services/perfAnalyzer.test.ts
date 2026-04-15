import { describe, it, expect } from "vitest";
import { analyzePerf } from "../../../src/services/perfAnalyzer.js";
import type { ParsedLogEvent } from "../../../src/services/logParser.js";

function ev(stage: ParsedLogEvent["stage"], costMs: number): ParsedLogEvent {
  return { level: "info", timestamp: "now", module: stage, message: "",
    fields: { costMs }, stage };
}

describe("analyzePerf", () => {
  it("computes p50/p95/p99 per stage", () => {
    const events = Array.from({ length: 100 }, (_, i) => ev("execution", i + 1));
    const r = analyzePerf(events);
    expect(r.stages.execution?.count).toBe(100);
    expect(r.stages.execution?.p50Ms).toBeGreaterThanOrEqual(49);
    expect(r.stages.execution?.p50Ms).toBeLessThanOrEqual(51);
  });

  it("labels the dominant stage as bottleneck", () => {
    const events: ParsedLogEvent[] = [
      ...Array.from({ length: 50 }, () => ev("txpool", 5)),
      ...Array.from({ length: 50 }, () => ev("sealer", 3)),
      ...Array.from({ length: 50 }, () => ev("consensus", 10)),
      ...Array.from({ length: 50 }, () => ev("execution", 200)),
      ...Array.from({ length: 50 }, () => ev("storage", 5)),
    ];
    expect(analyzePerf(events).bottleneck).toBe("execution");
  });

  it("returns 'none' when no costMs", () => {
    const events: ParsedLogEvent[] = [{
      level: "info", timestamp: "x", module: "X", message: "", fields: {}, stage: "other",
    }];
    expect(analyzePerf(events).bottleneck).toBe("none");
  });
});
