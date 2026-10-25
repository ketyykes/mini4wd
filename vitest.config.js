import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    // WASM races and Chromium compete for CPU/memory. Limit file workers;
    // keep the existing per-test deadlines and physics tolerances unchanged.
    maxWorkers: 2,
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
