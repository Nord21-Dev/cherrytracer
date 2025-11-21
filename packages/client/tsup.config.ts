import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"], // Support require() and import
  dts: true, // Generate types
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true, // Keep it tiny
  treeshake: true,
  target: "es2020",
});