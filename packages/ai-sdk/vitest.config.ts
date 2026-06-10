import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Run tests against the a11y-tree (core) source, so this package can be
      // tested without building core first.
      'a11y-tree': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: true,
    },
    globals: true,
  },
});
