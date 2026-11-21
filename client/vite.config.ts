import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@art/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ["@art/shared"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});