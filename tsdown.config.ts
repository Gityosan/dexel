import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/mcp/server.ts",
    "src/mcp/stdio.ts",
    "src/cli/run.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
});
