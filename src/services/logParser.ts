export type LogStage = "txpool" | "sealer" | "consensus" | "execution" | "storage" | "sync" | "other";

export interface ParsedLogEvent {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  timestamp: string;
  module: string;
  message: string;
  fields: Record<string, string | number>;
  stage: LogStage;
}

const LINE_RE = /^(trace|debug|info|warn|warning|error|fatal)\|([^|]+)\|\[([^\]]+)\]\s*(.*)$/i;

function moduleToStage(module: string): LogStage {
  const m = module.toUpperCase();
  if (m.startsWith("TXPOOL")) return "txpool";
  if (m.startsWith("SEALER")) return "sealer";
  if (m.startsWith("PBFT") || m.startsWith("CONSENSUS") || m.startsWith("RAFT")) return "consensus";
  if (m.startsWith("EXECUTOR") || m.startsWith("EXECUTE")) return "execution";
  if (m.startsWith("STORAGE") || m.startsWith("LEDGER")) return "storage";
  if (m.startsWith("SYNC")) return "sync";
  return "other";
}

function parseFields(rest: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const part of rest.split(/[,\s]+/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim().replace(/[,;]$/, "");
    if (!k) continue;
    if (/^-?\d+$/.test(v)) out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

function normLevel(l: string): ParsedLogEvent["level"] {
  const lo = l.toLowerCase();
  if (lo === "warning") return "warn";
  return lo as ParsedLogEvent["level"];
}

export function parseLogLine(line: string): ParsedLogEvent | null {
  const m = LINE_RE.exec(line);
  if (!m) return null;
  const [, level, timestamp, module, body] = m;
  return {
    level: normLevel(level!),
    timestamp: timestamp!.trim(),
    module: module!,
    message: body!.trim(),
    fields: parseFields(body!),
    stage: moduleToStage(module!),
  };
}
