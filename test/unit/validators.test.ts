import { describe, it, expect } from "vitest";
import { hexAddress, hexHash, blockTag, normalizeHex } from "../../src/validators.js";

describe("normalizeHex", () => {
  it("adds 0x and lowercases", () => {
    expect(normalizeHex("ABCDEF")).toBe("0xabcdef");
    expect(normalizeHex("0xABCDEF")).toBe("0xabcdef");
  });
});

describe("hexAddress", () => {
  it("accepts 40-hex with or without 0x", () => {
    const a = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
    expect(hexAddress.parse(a)).toBe(a);
    expect(hexAddress.parse("5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"))
      .toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
  it("rejects bad length", () => {
    expect(() => hexAddress.parse("0x1234")).toThrow();
  });
});

describe("hexHash", () => {
  it("accepts 64-hex", () => {
    const h = "0x" + "ab".repeat(32);
    expect(hexHash.parse(h)).toBe(h);
  });
  it("rejects bad length", () => {
    expect(() => hexHash.parse("0xabcd")).toThrow();
  });
});

describe("blockTag", () => {
  it("accepts latest/earliest/pending", () => {
    expect(blockTag.parse("latest")).toEqual({ kind: "tag", value: "latest" });
    expect(blockTag.parse("earliest")).toEqual({ kind: "tag", value: "earliest" });
    expect(blockTag.parse("pending")).toEqual({ kind: "tag", value: "pending" });
  });
  it("accepts decimal number", () => {
    expect(blockTag.parse("12345")).toEqual({ kind: "number", value: "12345" });
  });
  it("accepts block hash", () => {
    const h = "0x" + "12".repeat(32);
    expect(blockTag.parse(h)).toEqual({ kind: "hash", value: h });
  });
  it("rejects invalid", () => {
    expect(() => blockTag.parse("abc")).toThrow();
    expect(() => blockTag.parse("0xzz")).toThrow();
  });
});
