export function toSerializable(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === "bigint") return value.toString(10);
  if (value instanceof Uint8Array) return "0x" + Buffer.from(value).toString("hex");
  if (value instanceof Date) return value.toISOString();
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);
  try {
    if (Array.isArray(value)) return value.map((v) => toSerializable(v, seen));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toSerializable(v, seen);
    }
    return out;
  } finally {
    seen.delete(value as object);
  }
}

export function stringify(value: unknown, indent?: number): string {
  return JSON.stringify(toSerializable(value), null, indent);
}
