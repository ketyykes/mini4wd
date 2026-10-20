// 用 vite 啟動靜態伺服器，Playwright 無頭 Chromium 依序截圖到 renders/
// 用法：node scripts/render.mjs <iter> [views] [bodies] [extra query]
//   views 預設 side,top,front34,bottom,track；bodies 預設三款原創車殼（逗號分隔）
//   每款車殼輸出 renders/iter-NN_<body>_<view>.png，另外輸出 iter-NN_chassis_front34.png（拿掉車殼）
import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iter = process.argv[2] ?? '00';
const views = (process.argv[3] ?? 'side,top,front34,bottom,track').split(',');
const bodies = (process.argv[4] ?? 'body-wedge,body-skeleton,body-aero-wing').split(',');
const extra = process.argv[5] ?? '';

const server = await createServer({ root, logLevel: 'error', server: { port: 5181 } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

/** @type {{ body: string, view: string, name: string }[]} */
const jobs = [];
for (const b of bodies) {
  for (const v of views) {
    jobs.push({ body: b, view: v, name: `iter-${iter}_${b}_${v}.png` });
  }
}
jobs.push({ body: 'none', view: 'front34', name: `iter-${iter}_chassis_front34.png` });

for (const j of jobs) {
  await page.goto(`http://localhost:5181/web/index.html?view=${j.view}&body=${j.body}${extra}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const out = path.join(root, 'renders', j.name);
  await page.locator('canvas').screenshot({ path: out });
  console.log('saved', out);
}
await browser.close();
await server.close();
