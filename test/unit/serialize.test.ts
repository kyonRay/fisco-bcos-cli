import { describe, it, expect } from "vitest";
import { toSerializable, stringify } from "../../src/serialize.js";

describe("toSerializable", () => {
  it("converts bigint to decimal string", () => {
    expect(toSerializable(123n)).toBe("123");
    expect(toSerializable(2n ** 64n)).toBe("18446744073709551616");
  });

  it("recurses into arrays and objects", () => {
    expect(toSerializable({ a: 1n, b: [2n, { c: 3n }] }))
      .toEqual({ a: "1", b: ["2", { c: "3" }] });
  });

  it("leaves primitives untouched", () => {
    expect(toSerializable("hi")).toBe("hi");
    expect(toSerializable(42)).toBe(42);
    expect(toSerializable(null)).toBe(null);
    expect(toSerializable(true)).toBe(true);
  });

  it("handles circular references by marking them", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    const out = toSerializable(a) as Record<string, unknown>;
    expect(out.x).toBe(1);
    expect(out.self).toBe("[Circular]");
  });

  it("handles Uint8Array as 0x-hex", () => {
    expect(toSerializable(new Uint8Array([0xde, 0xad, 0xbe, 0xef])))
      .toBe("0xdeadbeef");
  });

  it("converts Date to ISO string", () => {
    const d = new Date("2025-01-02T03:04:05.678Z");
    expect(toSerializable(d)).toBe("2025-01-02T03:04:05.678Z");
  });

  it("does not false-positive on DAG (shared non-circular refs)", () => {
    const shared = { x: 1 };
    const out = toSerializable({ a: shared, b: shared }) as {
      a: { x: number }; b: { x: number };
    };
    expect(out.a).toEqual({ x: 1 });
    expect(out.b).toEqual({ x: 1 });
  });

  it("still detects actual cycles", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    const out = toSerializable(a) as Record<string, unknown>;
    expect(out.self).toBe("[Circular]");
  });

  it("handles negative and zero bigint", () => {
    expect(toSerializable(-1n)).toBe("-1");
    expect(toSerializable(0n)).toBe("0");
  });
});

describe("stringify", () => {
  it("produces valid JSON for bigint", () => {
    expect(stringify({ n: 10n })).toBe('{"n":"10"}');
  });
  it("accepts indent", () => {
    expect(stringify({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
  });
});
