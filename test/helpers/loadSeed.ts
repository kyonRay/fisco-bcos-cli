import { readFileSync } from "node:fs";
import type { SeedResult } from "./seedContracts.js";

export function loadSeed(envVar: string): SeedResult {
  const path = process.env[envVar];
  if (!path) throw new Error(`${envVar} not set — did globalSetup run?`);
  return JSON.parse(readFileSync(path, "utf8")) as SeedResult;
}
