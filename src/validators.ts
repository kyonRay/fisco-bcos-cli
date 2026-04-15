import { z } from "zod";

export function normalizeHex(s: string): string {
  const clean = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
  return "0x" + clean.toLowerCase();
}

export const hexAddress = z.string().transform((s, ctx) => {
  const norm = s.startsWith("0x") || s.startsWith("0X") ? s : "0x" + s;
  if (!/^0x[0-9a-fA-F]{40}$/.test(norm)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid address" });
    return z.NEVER;
  }
  return norm;
});

export const hexHash = z.string().transform((s, ctx) => {
  const norm = s.startsWith("0x") || s.startsWith("0X") ? s : "0x" + s;
  if (!/^0x[0-9a-fA-F]{64}$/.test(norm)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid hash" });
    return z.NEVER;
  }
  return norm;
});

export const blockTag = z.string().transform((s, ctx) => {
  if (s === "latest" || s === "earliest" || s === "pending") {
    return { kind: "tag" as const, value: s };
  }
  if (/^\d+$/.test(s)) return { kind: "number" as const, value: s };
  const withPrefix = s.startsWith("0x") ? s : "0x" + s;
  if (/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    return { kind: "hash" as const, value: withPrefix };
  }
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid block tag" });
  return z.NEVER;
});
