import { stat, readdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { BcosCliError } from "../errors.js";

export interface LogLine { file: string; line: string; lineNo: number; }

export interface LogReaderService {
  listFiles(): Promise<string[]>;
  streamLines(): AsyncIterable<LogLine>;
}

export interface CreateLogReaderOpts {
  logDir: string;
  maxLines?: number;
  filePattern?: RegExp;
}

const DEFAULT_PATTERN = /\.log(\.\d+)?$/;

export function createLogReader(opts: CreateLogReaderOpts): LogReaderService {
  const { logDir, filePattern = DEFAULT_PATTERN } = opts;
  const maxLines = opts.maxLines ?? Number.POSITIVE_INFINITY;

  async function listFiles(): Promise<string[]> {
    try {
      const s = await stat(logDir);
      if (!s.isDirectory()) {
        throw new BcosCliError("LOG_DIR_NOT_FOUND", `${logDir} is not a directory`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new BcosCliError("LOG_DIR_NOT_FOUND", `${logDir} does not exist`);
      }
      if (err instanceof BcosCliError) throw err;
      throw new BcosCliError("FILE_IO_ERROR", `stat ${logDir}`, {}, err);
    }
    const entries = await readdir(logDir);
    return entries.filter((f) => filePattern.test(f)).sort().map((f) => join(logDir, f));
  }

  async function* streamLines(): AsyncIterable<LogLine> {
    const files = await listFiles();
    let emitted = 0;
    for (const file of files) {
      const stream = createReadStream(file, { encoding: "utf8" });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      let lineNo = 0;
      for await (const line of rl) {
        lineNo++;
        emitted++;
        yield { file, line, lineNo };
        if (emitted >= maxLines) { rl.close(); stream.destroy(); return; }
      }
    }
  }

  return { listFiles, streamLines };
}
