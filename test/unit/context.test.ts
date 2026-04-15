import { describe, it, expect, vi } from "vitest";
import { createStderrLogger, createSilentLogger } from "../../src/logger.js";

describe("createStderrLogger", () => {
  it("silent mode emits nothing for info/warn", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const log = createStderrLogger({ verbose: false, quiet: true });
    log.info("hi");
    log.warn("warn");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("verbose mode emits debug", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const log = createStderrLogger({ verbose: true, quiet: false });
    log.debug("x");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("error always emits", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const log = createStderrLogger({ verbose: false, quiet: true });
    log.error("boom");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("createSilentLogger", () => {
  it("emits nothing", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const log = createSilentLogger();
    log.info("x"); log.error("y");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
