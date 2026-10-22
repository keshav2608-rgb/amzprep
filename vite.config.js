import { defineConfig } from "vite";
import { resolve } from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        privacy: resolve(root, "privacy.html")
      },
      output: {
        // Separate chunks so app-code changes don't invalidate the cached vendor library and dataset
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
          if (id.includes("/src/data/")) return "problems";
        }
      }
    }
  }
});
