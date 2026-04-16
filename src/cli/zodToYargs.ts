import { z } from "zod";

export type ArgKind = "string" | "number" | "boolean" | "array";

export interface ArgInfo {
  name: string;
  kind: ArgKind;
  optional: boolean;
  default?: unknown;
  description?: string;
}

function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; optional: boolean; def: unknown } {
  let cur: z.ZodTypeAny = schema;
  let optional = false;
  let def: unknown;
  while (true) {
    if (cur instanceof z.ZodOptional) { optional = true; cur = cur.unwrap(); continue; }
    if (cur instanceof z.ZodDefault) { def = (cur._def as { defaultValue: () => unknown }).defaultValue(); cur = cur._def.innerType; continue; }
    if (cur instanceof z.ZodNullable) { optional = true; cur = cur.unwrap(); continue; }
    if (cur instanceof z.ZodEffects) { cur = cur._def.schema; continue; }
    break;
  }
  return { inner: cur, optional, def };
}

function kindOf(schema: z.ZodTypeAny): ArgKind {
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodArray) return "array";
  return "string";
}

export function collectArgs(schema: z.ZodTypeAny): ArgInfo[] {
  const obj = schema instanceof z.ZodObject ? schema : null;
  if (!obj) return [];
  const shape = obj.shape as Record<string, z.ZodTypeAny>;
  return Object.entries(shape).map(([name, field]) => {
    const { inner, optional, def } = unwrap(field);
    return { name, kind: kindOf(inner), optional, default: def,
      description: field.description };
  });
}
