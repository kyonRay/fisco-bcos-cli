import { describe, it, expect } from "vitest";
import { parseLogLine } from "../../../src/services/logParser.js";

describe("parseLogLine", () => {
  it("parses EXECUTOR line as execution stage", () => {
    const e = parseLogLine(
      "info|2026-04-15 10:00:01.170000|[EXECUTOR] execute block, height=100, costMs=35");
    expect(e).toMatchObject({
      level: "info",
      module: "EXECUTOR",
      stage: "execution",
      fields: { height: 100, costMs: 35 },
    });
  });

  it("parses Sealer as sealer stage", () => {
    const e = parseLogLine(
      "info|2026-04-15 10:00:01.120000|[Sealer] seal block, height=100, txs=50");
    expect(e?.stage).toBe("sealer");
  });

  it("parses PBFT as consensus stage", () => {
    const e = parseLogLine(
      "info|2026-04-15 10:00:01.130000|[PBFT] prePrepare, view=1, height=100");
    expect(e?.stage).toBe("consensus");
  });

  it("parses STORAGE as storage stage", () => {
    const e = parseLogLine(
      "info|2026-04-15 10:00:01.205000|[STORAGE] write block, height=100, costMs=12");
    expect(e?.stage).toBe("storage");
  });

  it("captures error level", () => {
    const e = parseLogLine(
      "error|2026-04-15 10:00:02.000000|[PBFT] viewchange, view=2, reason=timeout");
    expect(e?.level).toBe("error");
    expect(e?.fields.reason).toBe("timeout");
  });

  it("returns null for unrecognized line", () => {
    expect(parseLogLine("garbage line")).toBeNull();
  });
});
