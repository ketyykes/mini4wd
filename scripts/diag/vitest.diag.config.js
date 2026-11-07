// P06 穿透診斷用（不屬於 P01–P10 正式測試）：pnpm exec vitest run --config scripts/diag/vitest.diag.config.js --silent=false
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['scripts/diag/**/*.test.js'], testTimeout: 600000 } });
