// 匯出整台車為 GLB（給 render/ 的 Blender 展示圖管線使用）
// 用法：node scripts/export-glb.mjs [bodyId]   → exports/<bodyId>.glb（bodyId 預設 legacy）
// 流程：vite 起伺服器 → Playwright 無頭 Chromium 開 web/export.html?body=<id> → 頁面內 GLTFExporter → base64 傳回 node 寫檔
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {string} app/ 根目錄 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** @type {string} */
const bodyId = process.argv[2] ?? 'legacy';
/** @type {number} 與 render.mjs（5181）錯開，兩者可同時跑 */
const port = 5182;

const server = await createServer({ root, logLevel: 'error', server: { port, strictPort: false } });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${port}/`;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
let exitCode = 0;
try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${url}web/export.html?body=${encodeURIComponent(bodyId)}`);
  await page.waitForFunction(() => window.__glb !== undefined || window.__exportError !== undefined, null, { timeout: 120000 });
  const error = await page.evaluate(() => window.__exportError);
  if (error) {
    throw new Error(`頁面匯出失敗：${error}`);
  }
  const report = await page.evaluate(() => window.__exportReport);
  const b64 = await page.evaluate(() => window.__glb);
  const outDir = path.join(root, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${bodyId}.glb`);
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  // 完整報告（含每個材質的類別與屬性）寫到 exports/<bodyId>.report.json，終端只印統計
  fs.writeFileSync(path.join(outDir, `${bodyId}.report.json`), JSON.stringify(report, null, 2));
  const { materialList, ...summary } = report;
  console.log(JSON.stringify(summary));
  console.log('saved', outPath);
} catch (e) {
  console.error(e);
  exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
process.exit(exitCode);
