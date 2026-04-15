import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import { ConfigFileSchema, type ConfigFile } from "./schema.js";
import { BcosCliError } from "../errors.js";

export function expandHome(path: string, homeDir: string): string {
  if (path.startsWith("~/")) return `${homeDir}/${path.slice(2)}`;
  if (path === "~") return homeDir;
  return path;
}

export async function loadConfigFile(path: string): Promise<ConfigFile | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw new BcosCliError("FILE_IO_ERROR", `failed to read ${path}`, { code }, err);
  }
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new BcosCliError("INVALID_CONFIG", `INVALID_CONFIG: YAML parse error in ${path}`, {}, err);
  }
  const result = ConfigFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new BcosCliError("INVALID_CONFIG", `INVALID_CONFIG: config schema error in ${path}`, {
      issues: result.error.issues,
    });
  }
  return result.data;
}
