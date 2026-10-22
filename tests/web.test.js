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
    // 第六階段：車殼選單依三組分群（比賽型 / 致敬 LG1 / 致敬 LG2），每款都在自己那一組
    /** @type {{ label: string, ids: string[] }[]} */
    const bodyGroups = await page.locator('select[data-slot="body"] optgroup').evaluateAll((gs) =>
      gs.map((g) => ({ label: /** @type {HTMLOptGroupElement} */ (g).label, ids: [...g.querySelectorAll('option')].map((o) => o.value) })),
    );
    /** @type {Record<string, string>} */
    const groupOf = {};
    for (const g of bodyGroups) {
      for (const id of g.ids) {
        groupOf[id] = g.label;
      }
    }
    for (const b of listBodies()) {
      let expected = '其他';
      if (b.style === 'race') {
        expected = '比賽常用車殼';
      } else if (b.homageSeries === 'lg1') {
        expected = '致敬《爆走兄弟》1';
      } else if (b.homageSeries === 'lg2') {
        expected = '致敬《爆走兄弟》2（WGP）';
      }
      expect(groupOf[b.id], `${b.id} 的選單分組`).toBe(expected);
    }
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
    await changeSlot('body', 'body-skeleton');
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
    await changeSlot('body', 'body-skeleton');
  }, 90000);

  test('P19_第四階段新零件（輕量輪框、鍍金端子、鹼性電池、原子馬達）網頁切換後數值與 assemble() 一致、URL 可還原', async () => {
    /** @type {[string, string][]} */
    const changes = [
      ['wheels', 'wheel-26-lightweight'],
      ['switch', 'switch-gold-terminal'],
      ['battery', 'battery-aa-alkaline'],
      ['motor', 'motor-atomic'],
      ['switch', 'switch-double-terminal'],
    ];
    for (const [slot, value] of changes) {
      const ms = await changeSlot(slot, value);
      const g = await garageState();
      const asm = assemble(g.config);
      console.log(`[P19] ${slot}=${value}：${ms} ms，總重 ${g.asm.mass_g.toFixed(2)} g，J_eq ${g.asm.spinInertia_gmm2.toFixed(1)} g·mm²，迴路 ${(g.asm.circuitResistance_ohm * 1000).toFixed(1)} mΩ，規則 ${g.validation.ok ? '合法' : g.validation.codes.join(',')}`);
      expect(ms, `${slot}=${value} 更新時間`).toBeLessThan(UPDATE_LIMIT_MS);
      expect(g.config[slot]).toBe(value);
      expectMatchesNode(g);
      // 第四階段的物理量（轉動慣量、迴路電阻、理論極速）也和 Node 端同一份組裝一致
      expect(Math.abs(g.asm.spinInertia_gmm2 - asm.spec.spin.total_gmm2)).toBeLessThan(1e-6);
      expect(Math.abs(g.asm.circuitResistance_ohm - asm.P.circuitResistance)).toBeLessThan(1e-9);
    }
    // 疊加端子違規：顯示 TERMINAL_MOD 並停用上賽道
    const g = await garageState();
    expect(g.validation.codes).toContain('TERMINAL_MOD');
    expect(g.raceEnabled).toBe(false);
    await changeSlot('switch', 'switch-standard');
    // URL 還原（新零件 id）
    const p2 = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await p2.goto(`${baseUrl}/web/garage.html?wheels=wheel-24-sponge&switch=switch-gold-terminal&axles=axle-hex-60-hollow&battery=battery-aa-nimh-2500`);
    await p2.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 90000 });
    const g2 = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__garage)));
    expect(g2.config.wheels).toBe('wheel-24-sponge');
    expect(g2.config.switch).toBe('switch-gold-terminal');
    expect(g2.config.axles).toBe('axle-hex-60-hollow');
    expect(g2.config.battery).toBe('battery-aa-nimh-2500');
    expect(await p2.locator('select[data-slot="wheels"]').inputValue()).toBe('wheel-24-sponge');
    expectMatchesNode(g2);
    expect(Math.abs(g2.asm.spinInertia_gmm2 - assemble(g2.config).spec.spin.total_gmm2)).toBeLessThan(1e-6);
    await p2.close();
  }, 180000);

  test('P19_前後導輪分開切換後數值與 assemble() 一致、錐形違規只標紅出問題的一端、URL 可還原（含舊參數 rollers=）', async () => {
    // 先切到 19 mm 錐形前導輪（標準前保桿 → ROLLER_TAPER_MOUNT），再換 FRP 前板（合法），最後後導輪換鋁 13 mm
    /** @type {[string, string, boolean][]} [slot, 零件, 預期合法] */
    const changes = [
      ['frontRollers', 'roller-19-tapered', false],
      ['frontStay', 'stay-front-frp', true],
      ['rearRollers', 'roller-13-alu', true],
    ];
    for (const [slot, value, legal] of changes) {
      const ms = await changeSlot(slot, value);
      const g = await garageState();
      console.log(`[P19] ${slot}=${value}：${ms} ms，總重 ${g.asm.mass_g.toFixed(2)} g，全長 ${g.asm.bbox.x.toFixed(1)} mm，規則 ${g.validation.ok ? '合法' : g.validation.codes.join(',')}`);
      expect(ms, `${slot}=${value} 更新時間`).toBeLessThan(UPDATE_LIMIT_MS);
      expect(g.config[slot]).toBe(value);
      expect(g.validation.ok).toBe(legal);
      expectMatchesNode(g);
      if (!legal) {
        // 錐形違規：只標紅前導輪與前導輪架，後導輪 / 後導輪架不標；說明標「推估」
        expect(g.validation.codes).toEqual(['ROLLER_TAPER_MOUNT']);
        expect(g.validation.messages[0]).toContain('推估');
        const badSlots = await page.evaluate(() => [...document.querySelectorAll('.field.is-bad select[data-slot]')].map((s) => /** @type {HTMLSelectElement} */ (s).dataset.slot).sort());
        expect(badSlots).toEqual(['frontRollers', 'frontStay']);
        expect(g.raceEnabled).toBe(false);
      }
    }
    // 網頁網址列即時反映前後兩個參數
    const url = new URL(page.url());
    expect(url.searchParams.get('frontRollers')).toBe('roller-19-tapered');
    expect(url.searchParams.get('rearRollers')).toBe('roller-13-alu');
    expect(url.searchParams.has('rollers')).toBe(false);
    for (const [slot, value] of [['frontRollers', 'roller-13'], ['rearRollers', 'roller-13'], ['frontStay', 'stay-front-standard']]) {
      await changeSlot(slot, value);
    }

    // 新參數還原
    const p2 = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await p2.goto(`${baseUrl}/web/garage.html?frontRollers=roller-19-tapered&rearRollers=roller-13-alu&frontStay=stay-front-frp`);
    await p2.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 90000 });
    const g2 = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__garage)));
    expect(g2.config.frontRollers).toBe('roller-19-tapered');
    expect(g2.config.rearRollers).toBe('roller-13-alu');
    expect(await p2.locator('select[data-slot="frontRollers"]').inputValue()).toBe('roller-19-tapered');
    expect(await p2.locator('select[data-slot="rearRollers"]').inputValue()).toBe('roller-13-alu');
    expect(g2.validation.ok).toBe(true);
    expectMatchesNode(g2);

    // 舊分享連結 rollers=<id> → 前後同款；同時給新參數時新參數覆寫該端
    await p2.goto(`${baseUrl}/web/garage.html?rollers=roller-19`);
    await p2.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 90000 });
    const g3 = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__garage)));
    expect(g3.config.frontRollers).toBe('roller-19');
    expect(g3.config.rearRollers).toBe('roller-19');
    expectMatchesNode(g3);
    expect(Math.abs(g3.asm.mass_g - assemble({ ...g3.config, rollers: 'roller-19' }).mass_g)).toBeLessThan(TOL);
    await p2.goto(`${baseUrl}/web/garage.html?rollers=roller-19&rearRollers=roller-13-alu`);
    await p2.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 90000 });
    const g4 = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__garage)));
    expect(g4.config.frontRollers).toBe('roller-19');
    expect(g4.config.rearRollers).toBe('roller-13-alu');
    expectMatchesNode(g4);
    await p2.close();
  }, 180000);

  test('P19_第五階段台灣零件網頁切換後數值與 assemble() 一致、URL 可還原', async () => {
    /** @type {[string, string][]} */
    const changes = [
      ['frontRollers', 'roller-19-rubber'],
      ['rearRollers', 'roller-19-plastic-ring'],
      ['frontRollers', 'roller-17-alu'],
      // iter-58：Rev-Tuned 2 PRO、31 mm 低摩擦胎（預設車殼 owl-hush 的輪拱放不下 31 mm → 違規，網頁也要一致）、MA 側制振器組
      ['motor', 'motor-rev'],
      ['wheels', 'wheel-31-lowfriction'],
      ['massDamper', 'damper-side-square-32'],
      // iter-59：中間齒輪軸（含氟塗層 / 中間齒輪培林組）、9 mm 培林導輪
      ['counterShaft', 'gear-shaft-ptfe'],
      ['counterShaft', 'counter-bearing-520'],
      ['rearRollers', 'roller-9-bearing'],
      // iter-60：碳纖大面積煞車架（沒裝海綿時只是選項，不影響數值）
      ['brakePlate', 'brake-plate-carbon'],
      // iter-61：前滑動保桿（軟彈簧；前導輪 17 mm 時行程端點全寬 107 mm → WIDTH，網頁也要一致）
      ['frontStay', 'stay-front-slide-soft'],
      ['frontRollers', 'roller-13'],
      // iter-63：滑動保桿換 HG 碳纖前寬板 2 mm
      ['frontStay', 'stay-front-slide-hard-carbon'],
      // iter-64：另外兩款塑膠環導輪
      ['rearRollers', 'roller-19-plastic-ring-dish'],
      ['rearRollers', 'roller-17-plastic-ring'],
    ];
    for (const [slot, value] of changes) {
      const ms = await changeSlot(slot, value);
      const g = await garageState();
      console.log(`[P19] ${slot}=${value}：${ms} ms，總重 ${g.asm.mass_g.toFixed(2)} g，全寬 ${g.asm.bbox.z.toFixed(1)} mm，規則 ${g.validation.ok ? '合法' : g.validation.codes.join(',')}`);
      expect(ms, `${slot}=${value} 更新時間`).toBeLessThan(UPDATE_LIMIT_MS);
      expect(g.config[slot]).toBe(value);
      expectMatchesNode(g);
    }
    for (const [slot, value] of [['frontRollers', 'roller-13'], ['rearRollers', 'roller-13'], ['motor', 'motor-standard'], ['wheels', 'wheel-26-lowprofile'], ['massDamper', '__none__'], ['counterShaft', 'counter-shaft-standard'], ['brakePlate', 'brake-plate-frp'], ['frontStay', 'stay-front-standard']]) {
      await changeSlot(slot, value);
    }
    const query = 'frontRollers=roller-19-rubber&rearRollers=roller-19-plastic-ring&motor=motor-rev&wheels=wheel-31-lowfriction&massDamper=damper-side-square-32&body=body-pc-box&counterShaft=counter-bearing-520&brakePlate=brake-plate-carbon&frontStay=stay-front-slide-hard';
    const p2 = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await p2.goto(`${baseUrl}/web/garage.html?${query}`);
    await p2.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 90000 });
    const g2 = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__garage)));
    for (const kv of query.split('&')) {
      const [slot, value] = kv.split('=');
      expect(g2.config[slot]).toBe(value);
      expect(await p2.locator(`select[data-slot="${slot}"]`).inputValue()).toBe(value);
    }
    expectMatchesNode(g2);
    await p2.close();
  }, 180000);

  test('P19_第七階段新零件網頁切換後數值與 assemble() 一致、URL 可還原', async () => {
    await page.selectOption('select[data-slot="config"]', 'default');
    /** @type {[string, string][]} */
    const changes = [
      // 制振器 7 款（球頭連桿 / 重型 / 細型需要 FRP 後板的制振座 → 預設後架違規 MOUNT_COMPAT，網頁也要一致）
      ['massDamper', 'damper-heavy'],
      ['massDamper', 'damper-balllink-square'],
      ['massDamper', 'damper-slim'],
      ['massDamper', 'damper-slim-short'],
      ['massDamper', 'damper-square-8x8x14'],
      ['massDamper', 'damper-square-8x8x32'],
      ['massDamper', 'damper-ar-side'],
      // 導輪 4 款
      ['frontRollers', 'roller-13-12-alu-double'],
      ['frontRollers', 'roller-13-12-alu-double-rubber'],
      ['rearRollers', 'roller-9-8-alu-double'],
      ['frontRollers', 'roller-19-19-plastic-double'],
      // 穩定頭 2 款（φ15 配 19 mm 前導輪）
      ['stabilizer', 'stabilizer-head-15'],
      ['stabilizer', 'stabilizer-head-11'],
      // 輪胎 4 款、煞車海綿 3 款、培林
      ['wheels', 'wheel-31-hard-slick'],
      ['wheels', 'wheel-31-soft-slick'],
      ['wheels', 'wheel-31-sponge-lowrebound'],
      ['wheels', 'wheel-26-oneway'],
      ['brakeSponge', 'sponge-3type-a'],
      ['brakeSponge', 'sponge-3type-b'],
      ['brakeSponge', 'sponge-3type-c'],
      ['bearings', 'bearing-620-hg'],
    ];
    for (const [slot, value] of changes) {
      const ms = await changeSlot(slot, value);
      const g = await garageState();
      console.log(`[P19] ${slot}=${value}：${ms} ms，總重 ${g.asm.mass_g.toFixed(2)} g，全寬 ${g.asm.bbox.z.toFixed(1)} mm，規則 ${g.validation.ok ? '合法' : g.validation.codes.join(',')}`);
      expect(ms, `${slot}=${value} 更新時間`).toBeLessThan(UPDATE_LIMIT_MS);
      expect(g.config[slot]).toBe(value);
      expectMatchesNode(g);
    }
    for (const [slot, value] of [['massDamper', '__none__'], ['frontRollers', 'roller-13'], ['rearRollers', 'roller-13'], ['stabilizer', '__none__'], ['wheels', 'wheel-26-lowprofile'], ['brakeSponge', '__none__'], ['bearings', 'bearing-620']]) {
      await changeSlot(slot, value);
    }
    // URL 還原：第七階段兩組示範設定的零件
    for (const query of [
      'rearStay=stay-rear-frp&massDamper=damper-balllink-square&wheels=wheel-26-oneway&bearings=bearing-620-hg&frontRollers=roller-11-bearing&rearRollers=roller-19-rubber&body=body-pc-box',
      'frontRollers=roller-19-19-plastic-double&stabilizer=stabilizer-head-15&rearRollers=roller-9-8-alu-double&rearStay=stay-rear-carbon-wide&wheels=wheel-31-hard-slick&massDamper=damper-slim&brakeSponge=sponge-3type-b&body=body-pc-box',
    ]) {
      const p2 = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      await p2.goto(`${baseUrl}/web/garage.html?${query}`);
      await p2.waitForFunction(() => window.__garage?.ready === true, null, { timeout: 90000 });
      const g2 = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__garage)));
      for (const kv of query.split('&')) {
        const [slot, value] = kv.split('=');
        expect(g2.config[slot]).toBe(value);
        expect(await p2.locator(`select[data-slot="${slot}"]`).inputValue()).toBe(value);
      }
      expect(g2.validation.ok).toBe(true);
      expectMatchesNode(g2);
      await p2.close();
    }
  }, 240000);

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
