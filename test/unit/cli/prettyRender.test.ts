import { describe, it, expect } from "vitest";
import { renderPretty } from "../../../src/cli/prettyRender.js";

describe("renderPretty", () => {
  it("renders a success envelope as key=value lines", () => {
    const out = renderPretty({
      ok: true, data: { foo: 1, bar: "x" },
      meta: { chain: "local", source: "bcos_rpc" },
    });
    expect(out).toContain("foo");
    expect(out).toContain("1");
    expect(out).toContain("bar");
  });

  it("renders an error envelope with code and message", () => {
    const out = renderPretty({
      ok: false,
      error: { code: "RPC_ERROR", message: "boom" },
      meta: {},
    });
    expect(out).toMatch(/RPC_ERROR/);
    expect(out).toMatch(/boom/);
  });
});
