// 匯出整台車為 GLB（給 render/ 的 Blender 展示圖管線使用）
// 用法：node scripts/export-glb.mjs [bodyId] [--config <名稱>] [--out <檔名>]
//   不帶 --config：exports/<bodyId>.glb（預設組裝設定，bodyId 預設 body-owl-hush）
//   帶 --config：exports/config-<名稱>[-<bodyId>].glb（bodyId 省略 = 用設定裡的車殼；none = 只有底盤與零件）
// 流程：vite 起伺服器 → Playwright 無頭 Chromium 開 web/export.html?body=<id> → 頁面內 GLTFExporter → base64 傳回 node 寫檔
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {string} app/ 根目錄 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** @type {string} */
/** @type {string[]} 命令列參數 */
const argv = process.argv.slice(2);
/** @type {(flag: string) => string | undefined} */
const flagValue = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
/** @type {string} */
const configName = flagValue('--config') ?? '';
/** @type {string[]} 去掉旗標與其值後的位置參數 */
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
/** @type {string} */
const bodyId = positional[0] ?? (configName ? '' : 'body-owl-hush');
/** @type {string} 輸出檔名（不含副檔名） */
const outName = flagValue('--out') ?? (configName ? `config-${configName}${bodyId ? `-${bodyId}` : ''}` : bodyId);
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
  const query = new URLSearchParams();
  if (bodyId) {
    query.set('body', bodyId);
  }
  if (configName) {
    query.set('config', configName);
  }
  await page.goto(`${url}web/export.html?${query.toString()}`);
  await page.waitForFunction(() => window.__glb !== undefined || window.__exportError !== undefined, null, { timeout: 120000 });
  const error = await page.evaluate(() => window.__exportError);
  if (error) {
    throw new Error(`頁面匯出失敗：${error}`);
  }
  const report = await page.evaluate(() => window.__exportReport);
  const b64 = await page.evaluate(() => window.__glb);
  const outDir = path.join(root, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${outName}.glb`);
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  // 完整報告（含每個材質的類別與屬性）寫到 exports/<輸出檔名>.report.json，終端只印統計
  fs.writeFileSync(path.join(outDir, `${outName}.report.json`), JSON.stringify(report, null, 2));
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
