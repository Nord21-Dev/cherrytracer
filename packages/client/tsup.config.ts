import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"], // Support require() and import
  dts: true, // Generate types
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false, // Keep it readable for now to avoid collisions
  treeshake: true,
  target: "es2020",
});