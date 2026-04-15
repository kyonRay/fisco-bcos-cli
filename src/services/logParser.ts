// TYPE-ONLY STUB for Task 3.7 (perfAnalyzer) compilation.
// Task 3.6 (logParser) builds the full implementation in a sibling worktree.
// Controller will resolve merge conflict — full logParser.ts wins over this stub.

export type LogStage = "txpool" | "sealer" | "consensus" | "execution" | "storage" | "sync" | "other";

export interface ParsedLogEvent {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  timestamp: string;
  module: string;
  message: string;
  fields: Record<string, string | number>;
  stage: LogStage;
}

export function parseLogLine(_line: string): ParsedLogEvent | null { return null; }
