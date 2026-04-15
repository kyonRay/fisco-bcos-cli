import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { createLogReader } from "../../../src/services/logReader.js";
import { BcosCliError } from "../../../src/errors.js";

describe("LogReader", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "logs-")); });

  it("throws LOG_DIR_NOT_FOUND when path missing", async () => {
    const r = createLogReader({ logDir: "/does/not/exist/xyz" });
    await expect(r.listFiles()).rejects.toSatisfy(
      (e: unknown) => e instanceof BcosCliError && e.code === "LOG_DIR_NOT_FOUND"
    );
  });

  it("lists only .log files sorted by name", async () => {
    writeFileSync(join(dir, "log_info_2026041200.00.log"), "a\n");
    writeFileSync(join(dir, "log_info_2026041300.00.log"), "b\n");
    writeFileSync(join(dir, "other.txt"), "skip\n");
    const r = createLogReader({ logDir: dir });
    const files = (await r.listFiles()).map((f) => basename(f));
    expect(files).toEqual([
      "log_info_2026041200.00.log", "log_info_2026041300.00.log",
    ]);
  });

  it("streams lines up to maxLines", async () => {
    writeFileSync(join(dir, "a.log"), "l1\nl2\nl3\n");
    const r = createLogReader({ logDir: dir, maxLines: 2 });
    const out: string[] = [];
    for await (const { line } of r.streamLines()) out.push(line);
    expect(out).toEqual(["l1", "l2"]);
  });

  it("streams across multiple files in sorted order", async () => {
    writeFileSync(join(dir, "a.log"), "a1\na2\n");
    writeFileSync(join(dir, "b.log"), "b1\n");
    const r = createLogReader({ logDir: dir });
    const lines: string[] = [];
    for await (const t of r.streamLines()) lines.push(t.line);
    expect(lines).toEqual(["a1", "a2", "b1"]);
  });
});
