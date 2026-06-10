import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  // a11y-tree (dependency) and ai/zod (peers) are auto-externalized by tsdown
  // from package.json, so they are not bundled into the output.
});
