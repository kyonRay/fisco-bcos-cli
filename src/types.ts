export type Hex = `0x${string}`;

export interface BlockTag {
  kind: "number" | "tag" | "hash";
  value: string;
}

export interface AppLogger {
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
  debug(msg: string, extra?: Record<string, unknown>): void;
}

export interface ResponseMeta {
  chain?: string;
  source?: "bcos_rpc" | "web3_rpc" | "log_file" | "mixed" | "local";
  durationMs?: number;
  degraded?: boolean;
  warnings?: string[];
  stats?: Record<string, number | string>;
}

export interface EnvelopeOk<T> {
  ok: true;
  data: T;
  meta: ResponseMeta;
}

export interface EnvelopeErr {
  ok: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
  meta: ResponseMeta;
}

export type Envelope<T> = EnvelopeOk<T> | EnvelopeErr;
