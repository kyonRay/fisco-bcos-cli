import type { ParsedLogEvent, LogStage } from "./logParser.js";

export interface StageStats {
  count: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  sumMs: number;
}

export interface PerfReport {
  stages: Partial<Record<LogStage, StageStats>>;
  bottleneck: LogStage | "none";
  bottleneckReason: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

export function analyzePerf(events: ParsedLogEvent[]): PerfReport {
  const buckets: Partial<Record<LogStage, number[]>> = {};
  for (const e of events) {
    const cost = e.fields.costMs;
    if (typeof cost !== "number") continue;
    (buckets[e.stage] ??= []).push(cost);
  }
  const stages: Partial<Record<LogStage, StageStats>> = {};
  for (const [stage, arr] of Object.entries(buckets) as [LogStage, number[]][]) {
    const sorted = [...arr].sort((a, b) => a - b);
    stages[stage] = {
      count: sorted.length,
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
      sumMs: sorted.reduce((s, x) => s + x, 0),
    };
  }
  const total = Object.values(stages).reduce((s, x) => s + (x?.sumMs ?? 0), 0);
  let bottleneck: LogStage | "none" = "none";
  let bestShare = 0;
  let reason = "no cost data found";
  for (const [stage, s] of Object.entries(stages) as [LogStage, StageStats][]) {
    const share = total > 0 ? s.sumMs / total : 0;
    if (share > bestShare) {
      bestShare = share;
      bottleneck = stage;
      reason = `${stage} accounts for ${(share * 100).toFixed(1)}% of observed cost (p99=${s.p99Ms}ms)`;
    }
  }
  return { stages, bottleneck, bottleneckReason: reason };
}
