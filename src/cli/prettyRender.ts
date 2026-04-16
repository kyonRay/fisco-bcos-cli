import chalk from "chalk";
import { toSerializable } from "../serialize.js";
import type { Envelope } from "../types.js";

function renderValue(v: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (v === null || v === undefined) return chalk.gray("∅");
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return chalk.gray("[]");
    return "\n" + v.map((item) => `${pad}  - ${renderValue(item, indent + 1)}`).join("\n");
  }
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return chalk.gray("{}");
    return "\n" + entries.map(([k, val]) =>
      `${pad}  ${chalk.cyan(k)}: ${renderValue(val, indent + 1)}`).join("\n");
  }
  return String(v);
}

export function renderPretty(env: Envelope<unknown>): string {
  const safe = toSerializable(env) as Envelope<unknown>;
  if (safe.ok) {
    const body = renderValue(safe.data, 0);
    const meta = safe.meta?.degraded ? chalk.yellow(" (degraded)") : "";
    const warnings = safe.meta?.warnings?.length
      ? "\n" + chalk.yellow("warnings: " + safe.meta.warnings.join(", "))
      : "";
    return chalk.green("✓") + meta + body + warnings;
  }
  const details = safe.error.details ? "\n  " + renderValue(safe.error.details, 1) : "";
  return `${chalk.red("✗")} ${chalk.bold(safe.error.code)}: ${safe.error.message}${details}`;
}
