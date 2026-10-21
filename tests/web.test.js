// P19 網頁換件（定義見 SPEC.md 第 2 部分 / GOAL.md）：Playwright 開 web/garage.html，
// 換零件與車殼後 1 秒內更新數值與 3D 模型，數值和 Node 端 assemble() / validateAssembly() 一致；
// 不合法組合顯示違規原因且停用「上賽道」；合法組合上賽道後車子會跑；URL 可還原組裝。
// 容許誤差寫在本檔，不得為通過而放寬。
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { assemble } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';

/** 網頁數值與 Node 端的容許誤差（g、mm） */
const TOL = 0.01;
/** 換件後數值面板與 3D 模型的更新時限（ms） */
const UPDATE_LIMIT_MS = 1000;
/** 上賽道後車速門檻（m/s）與等待時間（ms） */
const RACE_MIN_SPEED = 0.5;
const RACE_WAIT_MS = 20000;
/** 從起跑到通過第一次換道器的等待時間（ms；約 5 m，慢速電腦模擬可能低於即時） */
const LANE_CHANGE_WAIT_MS = 45000;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @type {import('vite').ViteDevServer} */
let server;
/** @type {import('playwright').Browser} */
let browser;
/** @type {import('playwright').Page} */
let page;
let baseUrl = '';
/** @type {string[]} */
const pageErrors = [];

/**
 * headless Chromium 的 WebGL：macOS 用 Metal（同 scripts/render.mjs），其他平台用 SwiftShader 軟體算圖
 * @type {() => string[]}
 */
const browserArgs = () => {
  if (process.platform === 'darwin') {
    return ['--use-angle=metal', '--enable-gpu'];
  }
  return ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
};

/** @type {(p: import('playwright').Page) => Promise<void>} 等首次組裝與 3D 模型完成，以及車殼幾何預先計算完成 */
const waitGarageReady = async (p) => {
  await p.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 90000 });
  await p.waitForFunction(() => window.__garage?.warmed === true, null, { timeout: 120000 });
};

/** @type {() => Promise<any>} */
const garageState = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__garage)));

/**
 * 在網頁上換一個選單，回傳數值面板與 3D 模型都更新完成所花的時間（ms）
 * @type {(slot: string, value: string) => Promise<number>}
 */
const changeSlot = async (slot, value) => {
  const before = await page.evaluate(() => ({ u: window.__garage.updateCount, m: window.__garage.modelUpdateCount }));
  const t0 = Date.now();
  await page.selectOption(`select[data-slot="${slot}"]`, value);
  await page.waitForFunction(
    (b) => window.__garage.updateCount > b.u && window.__garage.modelUpdateCount > b.m,
    before,
    { timeout: 30000, polling: 10 },
  );
  return Date.now() - t0;
};

/**
 * 網頁的組裝摘要與 Node 端同一組設定比對（質量、重心、外框、規則代碼）
 * @type {(g: any) => void}
 */
const expectMatchesNode = (g) => {
  const asm = assemble(g.config);
  const v = validateAssembly(asm);
  expect(Math.abs(g.asm.mass_g - asm.mass_g), `總重 web ${g.asm.mass_g} vs node ${asm.mass_g}`).toBeLessThan(TOL);
  for (const k of ['x', 'y', 'z']) {
    expect(Math.abs(g.asm.com_mm[k] - asm.com_mm[k]), `重心 ${k}`).toBeLessThan(TOL);
    expect(Math.abs(g.asm.bbox[k] - asm.bbox_mm.size[k]), `外框 ${k}`).toBeLessThan(TOL);
  }
  expect(g.validation.ok).toBe(v.ok);
  expect([...g.validation.codes].sort()).toEqual(v.violations.map((x) => x.code).sort());
};

beforeAll(async () => {
  // hmr 關閉：測試期間若有人改 src，不要讓 Vite 重新載入網頁打斷測試（新開的頁面仍會拿到新程式碼）
  server = await createServer({ root, logLevel: 'error', server: { port: 0, strictPort: false, hmr: false } });
  await server.listen();
  const addr = /** @type {import('node:net').AddressInfo} */ (server.httpServer?.address());
  baseUrl = `http://localhost:${addr.port}`;
  browser = await chromium.launch({ args: browserArgs() });
  page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  // 首頁（npm run dev 開的 /web/index.html，沒有 ?view=）要直接看到換件頁
  await page.goto(`${baseUrl}/web/index.html`);
  await page.waitForURL(/garage\.html/, { timeout: 30000 });
  await waitGarageReady(page);
}, 240000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('P19 網頁換件', () => {
  test('P19_首頁開啟即為換件頁且依 SLOTS 產生選單', async () => {
    const A = await import('../src/assembly.js');
    const { listParts } = await import('../src/parts/index.js');
    const { listBodies } = await import('../src/bodies/index.js');
    const SLOTS = A.SLOTS;
    /** @type {string[]} */
    const optional = Array.isArray(/** @type {any} */ (A).OPTIONAL_SLOTS) ? /** @type {any} */ (A).OPTIONAL_SLOTS : [];
    for (const slot of [...Object.keys(SLOTS), 'body', 'config']) {
      expect(await page.locator(`select[data-slot="${slot}"]`).count(), `選單 ${slot}`).toBe(1);
    }
    // 選項不寫死：每個 slot 的選項數 = 零件目錄（多安裝點零件每個安裝點一項）＋選配的「不裝」
    for (const [slot, category] of Object.entries(SLOTS)) {
      let n = 0;
      for (const p of listParts(category)) {
        n += Array.isArray(p.mountPoints) && p.mountPoints.length > 0 ? p.mountPoints.length : 1;
      }
      if (optional.includes(slot)) {
        n += 1;
      }
      const opts = await page.locator(`select[data-slot="${slot}"] option:not([data-temp])`).count();
      expect(opts, `slot ${slot} 選項數`).toBe(n);
    }
    // 車殼：目錄中每款車殼＋「不裝車殼」；預設組裝設定：listConfigs()
    expect(await page.locator('select[data-slot="body"] option').count()).toBe(listBodies().length + 1);
    expect(await page.locator('select[data-slot="config"] option').count()).toBe(A.listConfigs().length);
    await expect.poll(() => page.locator('[data-action="race"]').count()).toBe(1);
    const g = await garageState();
    expect(g.ready).toBe(true);
    expectMatchesNode(g);
    expect(pageErrors).toEqual([]);
  }, 60000);

  test('P19_換馬達／車殼／輪胎後 1 秒內更新且與 assemble()/validateAssembly() 一致', async () => {
    /** @type {[string, string][]} */
    const changes = [
      ['motor', 'motor-high-rev'],
      ['body', 'body-skeleton'],
      ['wheels', 'wheel-31-large'],
      ['wheels', 'wheel-26-lowprofile'],
      ['body', 'body-aero-wing'],
    ];
    /** @type {number | null} */
    let lastMass = null;
    for (const [slot, value] of changes) {
      const ms = await changeSlot(slot, value);
      const g = await garageState();
      console.log(`[P19] ${slot}=${value}：${ms} ms，總重 ${g.asm.mass_g.toFixed(2)} g，外框 ${g.asm.bbox.x.toFixed(1)}×${g.asm.bbox.z.toFixed(1)}×${g.asm.bbox.y.toFixed(1)} mm，規則 ${g.validation.ok ? '合法' : g.validation.codes.join(',')}`);
      expect(ms, `${slot}=${value} 更新時間`).toBeLessThan(UPDATE_LIMIT_MS);
      expect(g.config[slot]).toBe(value);
      expect(g.modelKey).toBe(JSON.stringify(g.config));
      expectMatchesNode(g);
      if (slot === 'body' || slot === 'wheels') {
        // 換車殼 / 輪胎一定改變總重（零件質量不同）
        expect(g.asm.mass_g).not.toBe(lastMass);
      }
      lastMass = g.asm.mass_g;
    }
    // URL 跟著更新（history.replaceState）
    const url = new URL(page.url());
    expect(url.searchParams.get('motor')).toBe('motor-high-rev');
    expect(url.searchParams.get('body')).toBe('body-aero-wing');
  }, 120000);

  test('P19_不合法組合顯示違規原因且停用上賽道', async () => {
    await page.selectOption('select[data-slot="config"]', 'default');
    await changeSlot('body', 'body-wedge');
    await changeSlot('wheels', 'wheel-31-large');
    const g = await garageState();
    expectMatchesNode(g);
    expect(g.validation.ok).toBe(false);
    expect(g.validation.codes).toContain('BODY_TIRE_CLEARANCE');
    expect(g.raceEnabled).toBe(false);
    await expect.poll(() => page.locator('[data-action="race"]').isDisabled()).toBe(true);
    const item = page.locator('#rules [data-code="BODY_TIRE_CLEARANCE"]');
    expect(await item.isVisible()).toBe(true);
    const nodeMsg = validateAssembly(assemble(g.config)).violations.find((v) => v.code === 'BODY_TIRE_CLEARANCE')?.message ?? '';
    expect(await item.textContent()).toContain(nodeMsg);
    // 相關選單標紅
    expect(await page.locator('.field.is-bad select[data-slot="wheels"]').count()).toBe(1);
    // 停用時點按鈕不會開始模擬
    await page.locator('[data-action="race"]').click({ force: true });
    expect((await garageState()).running).toBe(false);
  }, 60000);

  test('P19_合法組合上賽道後車子在賽道上跑且經換道器換車道', async () => {
    await changeSlot('wheels', 'wheel-26-lowprofile');
    const g0 = await garageState();
    expect(g0.validation.ok).toBe(true);
    await expect.poll(() => page.locator('[data-action="race"]').isEnabled()).toBe(true);
    await page.click('[data-action="race"]');
    await page.waitForFunction((v) => window.__garage.running && window.__garage.speed > v, RACE_MIN_SPEED, { timeout: RACE_WAIT_MS });
    const d1 = (await garageState()).distance;
    await page.waitForTimeout(1000);
    const g = await garageState();
    console.log(`[P19] 上賽道：車速 ${g.speed.toFixed(2)} m/s，行駛 ${g.distance.toFixed(2)} m，電壓 ${g.voltage.toFixed(2)} V，狀態 ${g.raceStatus}`);
    expect(g.speed).toBeGreaterThan(RACE_MIN_SPEED);
    expect(g.distance).toBeGreaterThan(d1);
    expect(g.voltage).toBeGreaterThan(0);
    expect(['running', 'finished']).toContain(g.raceStatus);
    // 經過換道器（第二條直線，s ≈ 3.3–5.0 m）後車道改變：內側（0）→ track.nextLane(0)
    const { buildCircuit } = await import('../src/track.js');
    const expectedLane = buildCircuit().nextLane(0);
    await page.waitForFunction(() => window.__garage.laneHistory.length >= 2 || !window.__garage.running || window.__garage.raceStatus !== 'running', null, { timeout: LANE_CHANGE_WAIT_MS });
    const g2 = await garageState();
    console.log(`[P19] 換道：車道紀錄 ${g2.laneHistory.join(' → ')}，行駛 ${g2.distance.toFixed(2)} m，狀態 ${g2.raceStatus}`);
    expect(g2.laneHistory[0]).toBe(0);
    expect(g2.laneHistory[1]).toBe(expectedLane);
    // 回車庫
    await page.click('[data-action="garage"]');
    await expect.poll(async () => (await garageState()).running).toBe(false);
    await expect.poll(() => page.locator('[data-action="race"]').isEnabled()).toBe(true);
  }, 120000);

  test('P19_不裝車殼（只看底盤）數值與 Node 端一致且可上賽道', async () => {
    await page.selectOption('select[data-slot="config"]', 'default');
    const ms = await changeSlot('body', '__none__');
    const g = await garageState();
    console.log(`[P19] 不裝車殼：${ms} ms，總重 ${g.asm.mass_g.toFixed(2)} g，外框 ${g.asm.bbox.x.toFixed(1)}×${g.asm.bbox.z.toFixed(1)}×${g.asm.bbox.y.toFixed(1)} mm，規則 ${g.validation.ok ? '合法' : g.validation.codes.join(',')}`);
    expect(ms).toBeLessThan(UPDATE_LIMIT_MS);
    expect(g.config.body).toBe(null);
    expect(g.asm.bodyMass_g).toBe(0);
    expectMatchesNode(g);
    expect(new URL(page.url()).searchParams.get('body')).toBe('none');
    // 3D 模型已依不裝車殼的設定重建：模型是非同步重建，依 SPEC P19「1 秒內更新」在期限內輪詢
    //（17:53 定時驗證時讀到重建前的 modelKey 而偶發失敗；判定標準不變）
    await expect.poll(async () => (await garageState()).modelKey, { timeout: UPDATE_LIMIT_MS }).toBe(JSON.stringify(g.config));
    // 拿掉車殼仍符合規則（總重 ≥ 90 g、尺寸變小），可以上賽道
    expect(g.validation.ok).toBe(true);
    await expect.poll(() => page.locator('[data-action="race"]').isEnabled()).toBe(true);
    await page.click('[data-action="race"]');
    await page.waitForFunction((v) => window.__garage.running && window.__garage.speed > v, RACE_MIN_SPEED, { timeout: RACE_WAIT_MS });
    const d1 = (await garageState()).distance;
    await page.waitForTimeout(800);
    expect((await garageState()).distance).toBeGreaterThan(d1);
    await page.click('[data-action="garage"]');
    await expect.poll(async () => (await garageState()).running).toBe(false);
    await changeSlot('body', 'body-wedge');
  }, 90000);

  test('P19_URL 參數可還原組裝', async () => {
    const p2 = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await p2.goto(`${baseUrl}/web/garage.html?motor=motor-high-rev&body=body-skeleton`);
    await p2.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 90000 });
    const g = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__garage)));
    expect(g.config.motor).toBe('motor-high-rev');
    expect(g.config.body).toBe('body-skeleton');
    expect(await p2.locator('select[data-slot="motor"]').inputValue()).toBe('motor-high-rev');
    expect(await p2.locator('select[data-slot="body"]').inputValue()).toBe('body-skeleton');
    expectMatchesNode(g);
    // 首頁帶參數也會轉到換件頁並保留參數
    await p2.goto(`${baseUrl}/web/index.html?gear=gear-4.0`);
    await p2.waitForURL(/garage\.html/, { timeout: 30000 });
    await p2.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 90000 });
    expect(await p2.evaluate(() => window.__garage.config.gear)).toBe('gear-4.0');
    await p2.close();
  }, 120000);
});
