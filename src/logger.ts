import type { AppLogger } from "./types.js";

export interface CreateLoggerOpts {
  verbose: boolean;
  quiet: boolean;
}

export function createStderrLogger({ verbose, quiet }: CreateLoggerOpts): AppLogger {
  const out = (level: string) => (msg: string, extra?: Record<string, unknown>) => {
    const line = extra ? `[${level}] ${msg} ${JSON.stringify(extra)}\n` : `[${level}] ${msg}\n`;
    process.stderr.write(line);
  };
  return {
    debug: verbose ? out("debug") : () => {},
    info:  quiet ? () => {} : out("info"),
    warn:  quiet ? () => {} : out("warn"),
    error: out("error"),
  };
}

export function createSilentLogger(): AppLogger {
  return { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
}
