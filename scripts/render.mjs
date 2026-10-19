// 用 vite 啟動靜態伺服器，Playwright 無頭 Chromium 依序截圖到 renders/
import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iter = process.argv[2] ?? '00';
const views = (process.argv[3] ?? 'side,top,front34,bottom,track').split(',');
const extra = process.argv[4] ?? '';

const server = await createServer({ root, logLevel: 'error', server: { port: 5181 } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const v of views) {
  await page.goto(`http://localhost:5181/web/index.html?view=${v}${extra}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const out = path.join(root, 'renders', `iter-${iter}_${v}.png`);
  await page.locator('canvas').screenshot({ path: out });
  console.log('saved', out);
}
await browser.close();
await server.close();
