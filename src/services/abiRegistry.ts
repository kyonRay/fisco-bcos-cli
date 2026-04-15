import { mkdir, readFile, writeFile, readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { BcosCliError } from "../errors.js";

export interface AbiEntry {
  address: string;
  name?: string;
  abi: unknown[];
  savedAt: string;
}

export interface AbiRegistryService {
  add(address: string, abi: unknown[], name?: string): Promise<AbiEntry>;
  get(address: string): Promise<AbiEntry | null>;
  list(): Promise<AbiEntry[]>;
  remove(address: string): Promise<boolean>;
}

export interface CreateAbiRegistryOpts { storeDir: string; }

function fileFor(dir: string, address: string): string {
  return join(dir, `${address.toLowerCase()}.json`);
}

export function createAbiRegistry(opts: CreateAbiRegistryOpts): AbiRegistryService {
  const { storeDir } = opts;

  return {
    async add(address, abi, name) {
      await mkdir(storeDir, { recursive: true });
      const norm = address.toLowerCase();
      const entry: AbiEntry = { address: norm, name, abi, savedAt: new Date().toISOString() };
      await writeFile(fileFor(storeDir, norm), JSON.stringify(entry, null, 2), "utf8");
      return entry;
    },
    async get(address) {
      try {
        const raw = await readFile(fileFor(storeDir, address.toLowerCase()), "utf8");
        return JSON.parse(raw) as AbiEntry;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw new BcosCliError("FILE_IO_ERROR", "failed to read ABI", {}, err);
      }
    },
    async list() {
      try { await stat(storeDir); } catch { return []; }
      const files = await readdir(storeDir);
      const entries: AbiEntry[] = [];
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          entries.push(JSON.parse(await readFile(join(storeDir, f), "utf8")) as AbiEntry);
        } catch { /* skip malformed */ }
      }
      return entries.sort((a, b) => a.address.localeCompare(b.address));
    },
    async remove(address) {
      try {
        await unlink(fileFor(storeDir, address.toLowerCase()));
        return true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw new BcosCliError("FILE_IO_ERROR", "failed to remove ABI", {}, err);
      }
    },
  };
}
