// src/services/abiRegistry.ts — minimal interface (Task 3.3 provides impl)
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
