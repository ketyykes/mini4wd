// 網頁換件頁截圖：換件頁一張、上賽道（車在立體換道橋上）一張
// 用法：node scripts/garage-shots.mjs <iter> [URL 查詢字串，例如 "body=body-owl-hush&rollers=roller-13-alu"]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iter = process.argv[2] ?? '00';
const query = process.argv[3] ?? '';

// port 0：由系統分配空閒埠，不佔用 dev server 的 47321
const server = await createServer({ root, logLevel: 'error', server: { port: 0 } });
await server.listen();
/** @type {string} */
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`${base}/web/garage.html${query ? `?${query}` : ''}`);
await page.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 120000 });
await page.waitForTimeout(1500);
const garagePath = path.join(root, 'renders', `iter-${iter}_garage.png`);
await page.screenshot({ path: garagePath });
console.log('saved', garagePath);

// 上賽道：等車子開上立體換道橋再拍
const race = page.locator('[data-action="race"]');
if (await race.isEnabled()) {
  await race.click();
  await page.waitForFunction(() => window.__garage?.onBridge === true, null, { timeout: 180000 });
  await page.waitForTimeout(150);
  const racePath = path.join(root, 'renders', `iter-${iter}_garage_race.png`);
  await page.screenshot({ path: racePath });
  console.log('saved', racePath);
} else {
  console.log('組裝不合法，「上賽道」停用，略過賽道截圖');
}
await browser.close();
await server.close();
