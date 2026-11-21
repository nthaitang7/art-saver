import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@art/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
});