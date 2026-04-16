import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["test/**/*.bcos.test.ts"],
    globalSetup: ["./test/integration/globalSetup.bcos.ts"],
    testTimeout: 30000,
  },
});
