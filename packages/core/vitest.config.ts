import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The accessibility tree relies on real layout/visibility, so tests run in
    // a real browser via Playwright rather than jsdom.
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: true,
    },
    globals: true,
  },
});
