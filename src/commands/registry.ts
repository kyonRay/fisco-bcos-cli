import type { z } from "zod";
import type { AppContext } from "../context.js";

export interface CommandCapabilities {
  requiresLogDir?: boolean;
  requiresExplorer?: boolean;
}

export interface CommandDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  capabilities?: CommandCapabilities;
  handler: (ctx: AppContext, args: z.infer<S>) => Promise<unknown>;
}

const registry = new Map<string, CommandDef>();

export function defineCommand<S extends z.ZodTypeAny>(def: CommandDef<S>): void {
  if (registry.has(def.name)) {
    throw new Error(`duplicate command registration: ${def.name}`);
  }
  registry.set(def.name, def as unknown as CommandDef);
}

export function allCommands(): CommandDef[] {
  return [...registry.values()];
}

export function getCommand(name: string): CommandDef | undefined {
  return registry.get(name);
}

export function __resetRegistry(): void {
  registry.clear();
}
