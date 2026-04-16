import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["test/**/*.hardhat.test.ts"],
    globalSetup: ["./test/integration/globalSetup.hardhat.ts"],
    testTimeout: 15000,
  },
});
