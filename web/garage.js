// 換件車庫頁：依 SLOTS 動態產生零件選單 → assemble() / validateAssembly() → 3D 模型、數值、規則檢查即時更新；
// 合法組合可上 3 線道賽道跑 src/sim.js 的 Rapier 模擬。組裝狀態寫在 URL（只寫跟預設組裝設定不同的 slot）
// 所有物理量都來自 src/（assembly、regulation、powertrain、sim），本檔不另寫物理公式
import * as Assembly from '../src/assembly.js';
import { listParts } from '../src/parts/index.js';
import { listBodies, bodyMassProps } from '../src/bodies/index.js';
import { validateAssembly } from '../src/regulation.js';
import { theoreticalTopSpeed } from '../src/powertrain.js';
import { buildCarModel } from '../src/model.js';
import { createGarageScene } from './garageScene.js';
import { startRace } from './garageRace.js';

/** @typedef {import('../src/parts/types').PartBase} PartBase */
/** @typedef {{ code: string, message: string }} Violation */
/** @typedef {Record<string, any>} AssemblyConfig */

const { SLOTS, listConfigs, loadConfig, assemble } = Assembly;

/** @type {string[]} 可以「不裝」的選配 slot（src/assembly.js 若尚未匯出 OPTIONAL_SLOTS 則為空） */
const OPTIONAL_SLOTS = Array.isArray(/** @type {any} */ (Assembly).OPTIONAL_SLOTS) ? /** @type {any} */ (Assembly).OPTIONAL_SLOTS : [];

/** 選單中代表「不裝」的值；URL 中寫成 none */
const NONE = '__none__';
/** 選單中代表設定檔裡 { base, ...覆寫 } 的自訂零件 */
const CUSTOM = '__custom__';
const DEFAULT_PRESET = 'default';

/** @type {Record<string, string>} slot 的中文名稱（新 slot 沒列到時由 slotLabel 推測） */
const SLOT_LABELS = {
  chassis: '底盤',
  motor: '馬達',
  gear: '齒輪組',
  wheels: '輪胎＋輪框',
  bearings: '軸承',
  rollers: '導輪',
  frontStay: '前導輪架',
  rearStay: '後導輪架',
  battery: '電池',
  batteryCover: '電池蓋',
  switch: '開關',
  axles: '輪軸',
  gearCover: '齒輪蓋',
  hardware: '小五金',
  massDamper: '制振器',
  brakeSponge: '煞車海綿',
  ballast: '配重',
};

/** @type {Record<string, string>} 安裝點的中文名稱 */
const MOUNT_LABELS = { front: '前', center: '中', rear: '後' };

/** @type {Record<string, string>} 預設組裝設定的中文名稱 */
const PRESET_LABELS = {
  default: '預設（標準）',
  speed: '速度型',
  technical: '技術賽道型',
  light: '輕量型',
  'race-frp': '比賽型（FRP 導輪板）',
  'carbon-damper': '比賽型（碳纖＋制振器）',
};

/** @type {Record<string, string[]>} 違規代碼 → 相關 slot（用來把選單標紅） */
const CODE_SLOTS = {
  BODY_TIRE_CLEARANCE: ['wheels', 'body'],
  BODY_ROLLER_CLEARANCE: ['rollers', 'body'],
  TIRE_DIAMETER: ['wheels'],
  TIRE_WIDTH: ['wheels'],
  GEAR_RATIO: ['gear'],
  GEAR_CHASSIS: ['gear', 'chassis'],
  MOTOR_CLASS: ['motor', 'chassis'],
  BATTERY: ['battery'],
  DRIVE_4WD: ['chassis'],
};

/** @type {Record<string, string[]>} 干涉代碼（X_Y_CLEARANCE）的零件群組 → slot */
const GROUP_SLOTS = {
  TIRE: ['wheels'],
  ROLLER: ['rollers'],
  STAY: ['frontStay', 'rearStay'],
  DAMPER: ['massDamper'],
  SPONGE: ['brakeSponge'],
  BALLAST: ['ballast'],
  BODY: ['body'],
};

/** @type {(code: string) => string[]} 違規代碼相關的 slot（干涉代碼依群組名稱推得） */
const slotsForCode = (code) => {
  if (CODE_SLOTS[code]) {
    return CODE_SLOTS[code];
  }
  const m = /^([A-Z]+)_([A-Z]+)_CLEARANCE$/.exec(code);
  if (m) {
    return [...(GROUP_SLOTS[m[1]] ?? []), ...(GROUP_SLOTS[m[2]] ?? [])];
  }
  return [];
};

/** @type {(slot: string) => string} */
const slotLabel = (slot) => {
  if (SLOT_LABELS[slot]) {
    return SLOT_LABELS[slot];
  }
  if (/damper/i.test(slot)) {
    return '制振器';
  }
  if (/brake/i.test(slot)) {
    return '煞車';
  }
  if (/weight|ballast/i.test(slot)) {
    return '配重';
  }
  if (/plate/i.test(slot)) {
    return '補強板';
  }
  return slot;
};

/** @type {(name: string) => string} 零件名稱去掉全形括號內的補充說明（完整名稱放 tooltip） */
const shortName = (name) => {
  const i = name.indexOf('（');
  if (i > 0) {
    return name.slice(0, i);
  }
  return name;
};

/** @type {(v: unknown) => v is number} */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * 選項上顯示的關鍵規格（依零件類別；欄位不存在時略過）
 * @type {(part: PartBase) => string}
 */
const keySpec = (part) => {
  /** @type {any} */
  const p = part;
  if (part.category === 'motor' && isNum(p.noLoadRpm_atRated)) {
    return `${p.noLoadRpm_atRated.toLocaleString('en-US')} rpm`;
  }
  if (part.category === 'gear' && isNum(p.ratio)) {
    return `${p.ratio}:1`;
  }
  if ((part.category === 'wheel' || part.category === 'roller') && isNum(p.diameter_mm)) {
    return `⌀${p.diameter_mm} mm`;
  }
  if (part.category === 'battery' && isNum(p.capacity_mAh)) {
    return `${p.capacity_mAh} mAh`;
  }
  return '';
};

/** @type {(part: PartBase) => string} 選項文字：中文名稱｜關鍵規格｜質量 */
const partOptionText = (part) => {
  const bits = [shortName(part.name)];
  const k = keySpec(part);
  // 名稱已含規格（例如「3.5:1 齒輪組」）就不重複
  if (k && !part.name.includes(k)) {
    bits.push(k);
  }
  if (isNum(part.mass_g)) {
    // 推導出的質量（例如板材密度 × 面積）可能有很多位小數，顯示到 0.01 g
    bits.push(`${Number(part.mass_g.toFixed(2))} g`);
  }
  return bits.join('｜');
};

/** @type {(v: unknown) => boolean} slot 值為「不裝」 */
const isEmptyValue = (v) => v === null || v === undefined;

/** @type {(a: unknown, b: unknown) => boolean} */
const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ---------------------------------------------------------------------------
// 狀態
// ---------------------------------------------------------------------------

/** @type {string[]} 所有可換的 key：SLOTS 的 slot ＋ body */
const SLOT_KEYS = [...Object.keys(SLOTS), 'body'];

/**
 * @typedef {object} GarageState
 * @property {boolean} ready 首次組裝與模型完成
 * @property {boolean} warmed 所有車殼的幾何已預先計算（之後換車殼不會卡頓）
 * @property {string} preset 目前的預設組裝設定名稱
 * @property {AssemblyConfig} config 目前組裝設定（body 為 null 表示不裝車殼）
 * @property {{ mass_g: number, com_mm: { x: number, y: number, z: number }, bbox: { x: number, y: number, z: number }, groundClearance_mm: number, topSpeed_ms: number, bodyMass_g: number } | null} asm 組裝摘要
 * @property {{ ok: boolean, codes: string[], messages: string[] }} validation 規則檢查
 * @property {boolean} raceEnabled 「上賽道」按鈕可按
 * @property {boolean} running 正在賽道上模擬
 * @property {string | null} raceStatus running / finished / derailed
 * @property {number} speed 目前車速 m/s
 * @property {number} distance 行駛距離 m
 * @property {number} laps 完成圈數
 * @property {number} voltage 電池端電壓 V
 * @property {number} lane 目前車道（0 = 內側）
 * @property {boolean} onBridge 目前在換道器立體橋上
 * @property {number[]} laneHistory 這一場依序跑過的車道
 * @property {number} lastUpdateMs 數值面板最後更新時間（Date.now()）
 * @property {number} updateCount 數值面板更新次數
 * @property {number} modelUpdateCount 3D 模型重建次數
 * @property {number} modelUpdatedMs 3D 模型最後重建時間（Date.now()）
 * @property {string | null} modelKey 目前 3D 模型對應的組裝設定（JSON）
 * @property {string | null} error 組裝失敗訊息
 * @property {string[]} notices URL 解析等提示
 */

/** @type {GarageState} */
const garage = {
  ready: false,
  warmed: false,
  preset: DEFAULT_PRESET,
  config: {},
  asm: null,
  validation: { ok: false, codes: [], messages: [] },
  raceEnabled: false,
  running: false,
  raceStatus: null,
  speed: 0,
  distance: 0,
  laps: 0,
  voltage: 0,
  lane: 0,
  onBridge: false,
  laneHistory: [],
  lastUpdateMs: 0,
  updateCount: 0,
  modelUpdateCount: 0,
  modelUpdatedMs: 0,
  modelKey: null,
  error: null,
  notices: [],
};
/** @type {any} */ (window).__garage = garage;

/** @type {any} 目前的完整組裝結果（給 3D 與上賽道用） */
let currentAsm = null;
/** @type {ReturnType<typeof createGarageScene>} */
let scene;
/** @type {Awaited<ReturnType<typeof startRace>> | null} */
let race = null;
let modelPending = false;

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

/** @type {<T extends HTMLElement>(id: string) => T} */
const $ = (id) => /** @type {any} */ (document.getElementById(id));

const selConfig = /** @type {HTMLSelectElement} */ ($('sel-config'));
const selBody = /** @type {HTMLSelectElement} */ ($('sel-body'));
const slotFields = $('slot-fields');
const statsEl = $('stats');
const rulesEl = $('rules');
const statusPill = $('status-pill');
const btnRace = /** @type {HTMLButtonElement} */ ($('btn-race'));
const btnGarage = /** @type {HTMLButtonElement} */ ($('btn-garage'));
const raceHint = $('race-hint');
const loadingEl = $('loading');
const hud = $('hud');
const warmHint = $('warm-hint');
const presetModified = $('preset-modified');
const chkCom = /** @type {HTMLInputElement} */ ($('chk-com'));

/** @type {Map<string, HTMLSelectElement>} slot → 選單 */
const selects = new Map([['body', selBody]]);

/** @type {(slot: string) => boolean} */
const isOptional = (slot) => slot === 'body' || OPTIONAL_SLOTS.includes(slot);

/** 建立預設組裝設定選單 */
const buildPresetSelect = () => {
  for (const name of listConfigs()) {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = PRESET_LABELS[name] ?? name;
    selConfig.appendChild(o);
  }
};

/** 建立車殼選單（質量在預先計算後補上） */
const buildBodySelect = () => {
  for (const b of listBodies()) {
    const o = document.createElement('option');
    o.value = b.id;
    o.textContent = b.name;
    o.title = `${b.name}（${b.id}，${b.material ?? ''}）`;
    selBody.appendChild(o);
  }
  const none = document.createElement('option');
  none.value = NONE;
  none.textContent = '不裝車殼（只看底盤）';
  selBody.appendChild(none);
};

/** @type {(id: string) => void} 車殼幾何算好後，選項補上質量 */
const labelBodyMass = (id) => {
  for (const o of selBody.options) {
    const b = listBodies().find((x) => x.id === o.value);
    if (b && b.id === id) {
      o.textContent = `${b.name}｜${bodyMassProps(b).mass_g.toFixed(1)} g`;
    }
  }
};

/** 依 SLOTS 建立每個零件槽的選單（選配 slot 放在「選配零件」群組並多一個「不裝」） */
const buildSlotSelects = () => {
  const main = Object.keys(SLOTS).filter((s) => !OPTIONAL_SLOTS.includes(s));
  const optional = Object.keys(SLOTS).filter((s) => OPTIONAL_SLOTS.includes(s));
  /** @type {(slot: string) => void} */
  const addField = (slot) => {
    const field = document.createElement('div');
    field.className = 'field';
    field.dataset.field = slot;
    const id = `sel-${slot}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = slotLabel(slot);
    const sel = document.createElement('select');
    sel.id = id;
    sel.dataset.slot = slot;
    if (isOptional(slot)) {
      const o = document.createElement('option');
      o.value = NONE;
      o.textContent = '不裝';
      sel.appendChild(o);
    }
    for (const part of listParts(SLOTS[slot])) {
      // 有多個安裝點的零件（例如配重前 / 中 / 後）每個安裝點一個選項，值為 id@安裝點（src/parts/index.js resolvePart）
      /** @type {string[]} */
      const mounts = Array.isArray(part.mountPoints) ? /** @type {string[]} */ (part.mountPoints) : [];
      if (mounts.length === 0) {
        sel.appendChild(makeOption(part.id, partOptionText(part), `${part.name}（${part.id}）`));
        continue;
      }
      for (const m of mounts) {
        const text = `${partOptionText(part)}｜裝在${MOUNT_LABELS[m] ?? m}`;
        sel.appendChild(makeOption(`${part.id}@${m}`, text, `${part.name}（${part.id}@${m}）`));
      }
    }
    sel.addEventListener('change', () => onSlotChange(slot, sel.value));
    field.append(label, sel);
    slotFields.appendChild(field);
    selects.set(slot, sel);
  };
  main.forEach(addField);
  if (optional.length > 0) {
    const h = document.createElement('h3');
    h.className = 'group-title';
    h.textContent = '選配零件';
    slotFields.appendChild(h);
    optional.forEach(addField);
  }
};

/** @type {(value: string, text: string, title: string) => HTMLOptionElement} */
const makeOption = (value, text, title) => {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  o.title = title;
  return o;
};

/** @type {(sel: HTMLSelectElement, value: string) => boolean} */
const hasOption = (sel, value) => [...sel.options].some((o) => o.value === value);

/**
 * 把 slot 值反映到選單：
 * - 沒寫安裝點的多安裝點零件 → 對應到預設安裝點的選項
 * - 設定檔的 { base, ...覆寫 } 或選單沒有的值 → 加一個暫時選項（下次同步時移除）
 * @type {(sel: HTMLSelectElement, value: any) => void}
 */
const setSelectValue = (sel, value) => {
  for (const o of [...sel.querySelectorAll('option[data-temp]')]) {
    o.remove();
  }
  if (isEmptyValue(value)) {
    sel.value = NONE;
    return;
  }
  if (typeof value === 'string') {
    if (hasOption(sel, value)) {
      sel.value = value;
      return;
    }
    const slot = sel.dataset.slot ?? '';
    const part = slot in SLOTS ? listParts(SLOTS[slot]).find((p) => p.id === value) : undefined;
    const withMount = `${value}@${part?.defaultMount}`;
    if (part && hasOption(sel, withMount)) {
      sel.value = withMount;
      return;
    }
    const o = makeOption(value, `${value}（設定值）`, value);
    o.dataset.temp = '1';
    sel.appendChild(o);
    sel.value = value;
    return;
  }
  const o = makeOption(CUSTOM, `設定檔自訂（以 ${value.base} 為底）`, JSON.stringify(value));
  o.dataset.temp = '1';
  sel.appendChild(o);
  sel.value = CUSTOM;
};

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

/** @type {(name: string) => AssemblyConfig} 讀預設組裝設定，body 以外的選配 slot 缺值時補 null */
const presetConfig = (name) => {
  const c = loadConfig(name);
  for (const s of OPTIONAL_SLOTS) {
    if (c[s] === undefined) {
      c[s] = null;
    }
  }
  return c;
};

/** @type {(slot: string, id: string) => boolean} 零件 id 是否存在於該 slot 的類別 */
const isKnownId = (slot, id) => {
  if (slot === 'body') {
    return listBodies().some((b) => b.id === id);
  }
  // id@安裝點：零件 id 存在即可（安裝點不合法時由規則檢查器擋下並說明）
  const baseId = id.split('@')[0];
  return listParts(SLOTS[slot]).some((p) => p.id === baseId);
};

/** 從 URL 還原組裝（未知的參數略過並提示） */
const readUrl = () => {
  const params = new URLSearchParams(location.search);
  let preset = params.get('config') ?? DEFAULT_PRESET;
  if (!listConfigs().includes(preset)) {
    garage.notices.push(`URL 的組裝設定「${preset}」不存在，改用預設`);
    preset = DEFAULT_PRESET;
  }
  const config = presetConfig(preset);
  for (const slot of SLOT_KEYS) {
    const v = params.get(slot);
    if (v === null) {
      continue;
    }
    if (v === 'none' && isOptional(slot)) {
      config[slot] = null;
    } else if (isKnownId(slot, v)) {
      config[slot] = v;
    } else {
      garage.notices.push(`URL 參數 ${slot}=${v} 無法辨識，已忽略`);
    }
  }
  garage.preset = preset;
  garage.config = config;
};

/** 把目前組裝寫回 URL（只寫跟預設組裝設定不同的 slot） */
const writeUrl = () => {
  const base = presetConfig(garage.preset);
  const params = new URLSearchParams();
  if (garage.preset !== DEFAULT_PRESET) {
    params.set('config', garage.preset);
  }
  for (const slot of SLOT_KEYS) {
    const v = garage.config[slot];
    if (sameValue(v, base[slot]) || (typeof v === 'object' && v !== null)) {
      continue;
    }
    if (isEmptyValue(v)) {
      params.set(slot, 'none');
    } else {
      params.set(slot, String(v));
    }
  }
  const qs = params.toString();
  let url = location.pathname;
  if (qs) {
    url += `?${qs}`;
  }
  history.replaceState(null, '', url);
  const modified = SLOT_KEYS.some((s) => !sameValue(garage.config[s], base[s]));
  presetModified.hidden = !modified;
};

// ---------------------------------------------------------------------------
// 組裝 → 數值 / 規則 / 3D
// ---------------------------------------------------------------------------

/** @type {(fit: { tire_mm: number, roller_mm: number } | null, key: 'tire_mm' | 'roller_mm') => string} 不裝車殼時沒有間隙 */
const clearanceText = (fit, key) => {
  if (!fit) {
    return '—（不裝車殼）';
  }
  return `${fit[key].toFixed(2)} mm`;
};

/** @type {(x: number, d?: number) => string} */
const fx = (x, d = 1) => x.toFixed(d);

/**
 * 數值面板
 * @type {(asm: any, codes: Set<string>, topSpeed: number) => void}
 */
const renderStats = (asm, codes, topSpeed) => {
  const s = asm.bbox_mm.size;
  /** @type {[string, string, string, boolean, string?][]} 名稱、數值、規則上限說明、是否違規、樣式 */
  const rows = [
    ['總重', `${fx(asm.mass_g, 2)} g`, '規則 ≥ 90 g（含電池、馬達）', codes.has('MASS'), 'em'],
    ['重心 x / y / z', `${fx(asm.com_mm.x)} / ${fx(asm.com_mm.y)} / ${fx(asm.com_mm.z)} mm`, 'x 往前、y 往上（地面 = 0）', false],
    ['全長', `${fx(s.x)} mm`, '規則 < 165 mm', codes.has('LENGTH')],
    ['全寬', `${fx(s.z)} mm`, '規則 < 105 mm', codes.has('WIDTH')],
    ['全高', `${fx(s.y)} mm`, '規則 < 70 mm', codes.has('HEIGHT')],
    ['離地高度', `${fx(asm.groundClearance_mm, 2)} mm`, '規則 ≥ 1 mm', codes.has('GROUND_CLEARANCE')],
    ['車殼與輪胎間隙', clearanceText(asm.fit, 'tire_mm'), '須 ≥ 1 mm', codes.has('BODY_TIRE_CLEARANCE')],
    ['車殼與導輪間隙', clearanceText(asm.fit, 'roller_mm'), '須 ≥ 1 mm', codes.has('BODY_ROLLER_CLEARANCE')],
    ['齒輪比', `${asm.gearRatio}:1`, '', codes.has('GEAR_RATIO')],
    ['理論極速', `${fx(topSpeed, 2)} m/s（${fx(topSpeed * 3.6)} km/h）`, '滿電、平直路面的力平衡解', false, 'em'],
  ];
  statsEl.replaceChildren();
  for (const [name, value, limit, bad, cls] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = name;
    const dd = document.createElement('dd');
    const v = document.createElement('span');
    v.textContent = value;
    if (cls) {
      v.className = cls;
    }
    dd.appendChild(v);
    if (limit) {
      const l = document.createElement('span');
      l.className = 'limit';
      l.textContent = limit;
      dd.appendChild(l);
    }
    if (bad) {
      dt.classList.add('is-bad');
      dd.classList.add('is-bad');
    }
    statsEl.append(dt, dd);
  }
};

/**
 * 規則檢查面板
 * @type {(violations: Violation[], notes: string[]) => void}
 */
const renderRules = (violations, notes) => {
  rulesEl.replaceChildren();
  if (violations.length === 0) {
    const ok = document.createElement('div');
    ok.className = 'rule-ok';
    ok.textContent = '✓ 符合比賽規則';
    rulesEl.appendChild(ok);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'rule-list';
    ul.setAttribute('aria-label', '違規項目');
    for (const v of violations) {
      const li = document.createElement('li');
      li.dataset.code = v.code;
      const code = document.createElement('span');
      code.className = 'rule-code';
      code.textContent = v.code;
      li.append(code, document.createTextNode(v.message));
      ul.appendChild(li);
    }
    rulesEl.appendChild(ul);
  }
  for (const n of notes) {
    const p = document.createElement('div');
    p.className = 'rule-note';
    p.textContent = n;
    rulesEl.appendChild(p);
  }
};

/** @type {(violations: Violation[]) => void} 把違規相關的選單標紅 */
const markBadFields = (violations) => {
  /** @type {Set<string>} */
  const bad = new Set();
  for (const v of violations) {
    for (const s of slotsForCode(v.code)) {
      bad.add(s);
    }
    if (v.code === 'MOUNT_COMPAT') {
      // 安裝點不相容：訊息寫明「slot X」；配重安裝點錯誤的訊息沒有 slot，屬於 ballast
      const m = /slot (\w+)/.exec(v.message);
      bad.add(m ? m[1] : 'ballast');
    }
  }
  for (const [slot, sel] of selects) {
    const field = sel.closest('.field');
    if (field) {
      field.classList.toggle('is-bad', bad.has(slot));
    }
  }
};

/** @type {(ok: boolean, reason: string) => void} */
const setRaceEnabled = (ok, reason) => {
  garage.raceEnabled = ok;
  btnRace.disabled = !ok || garage.running;
  btnRace.setAttribute('aria-disabled', String(btnRace.disabled));
  raceHint.textContent = reason;
};

/** 重新組裝並更新全部面板；3D 模型在下一幀重建（數值先出來） */
const update = () => {
  /** @type {string[]} */
  const notes = [...garage.notices];
  try {
    // 不裝車殼時 config.body = null，assemble() 直接組出沒有車殼的整車（asm.body、asm.fit 為 null）
    const asm = assemble(garage.config);
    const validation = validateAssembly(asm);
    const top = theoreticalTopSpeed({ assembly: asm }).vTheory;
    currentAsm = asm;
    garage.error = null;
    const codes = new Set(validation.violations.map((v) => v.code));
    garage.asm = {
      mass_g: asm.mass_g,
      com_mm: { ...asm.com_mm },
      bbox: { ...asm.bbox_mm.size },
      groundClearance_mm: asm.groundClearance_mm,
      topSpeed_ms: top,
      bodyMass_g: asm.body ? asm.body.mass_g : 0,
    };
    garage.validation = {
      ok: validation.ok,
      codes: [...codes],
      messages: validation.violations.map((v) => v.message),
    };
    renderStats(asm, codes, top);
    renderRules(validation.violations, notes);
    markBadFields(validation.violations);
    if (!validation.ok) {
      setRaceEnabled(false, '組合不合法，修正上方違規項目後才能上賽道');
    } else {
      setRaceEnabled(true, '在 3 線道賽道上跑 3 圈（Rapier 物理模擬）');
    }
    statusPill.textContent = validation.ok ? '✓ 合法組合' : `✕ 違規 ${validation.violations.length} 項`;
    statusPill.classList.toggle('is-ok', validation.ok);
    statusPill.classList.toggle('is-bad', !validation.ok);
  } catch (err) {
    // 例如零件類別不符或 src 暫時壞掉：顯示原因並停用上賽道
    const msg = err instanceof Error ? err.message : String(err);
    currentAsm = null;
    garage.error = msg;
    garage.asm = null;
    garage.validation = { ok: false, codes: ['ASSEMBLY_ERROR'], messages: [msg] };
    statsEl.replaceChildren();
    renderRules([{ code: 'ASSEMBLY_ERROR', message: `無法組裝：${msg}` }], notes);
    setRaceEnabled(false, '無法組裝，不能上賽道');
    statusPill.textContent = '✕ 無法組裝';
    statusPill.classList.remove('is-ok');
    statusPill.classList.add('is-bad');
  }
  garage.lastUpdateMs = Date.now();
  garage.updateCount += 1;
  writeUrl();
  scheduleModel();
};

/** 下一幀重建 3D 模型（連續換件時只建最後一次） */
const scheduleModel = () => {
  if (modelPending) {
    return;
  }
  modelPending = true;
  loadingEl.hidden = false;
  loadingEl.textContent = '更新 3D 模型…';
  requestAnimationFrame(() => {
    modelPending = false;
    rebuildModel();
  });
};

const rebuildModel = () => {
  if (!currentAsm) {
    loadingEl.hidden = true;
    return;
  }
  const showBody = !isEmptyValue(garage.config.body);
  const model = buildCarModel(currentAsm, { body: showBody });
  scene.setCar(model, currentAsm.com_mm);
  garage.modelKey = JSON.stringify(garage.config);
  garage.modelUpdateCount += 1;
  garage.modelUpdatedMs = Date.now();
  garage.ready = true;
  loadingEl.hidden = true;
};

/** @type {(slot: string, value: string) => void} */
const onSlotChange = (slot, value) => {
  if (garage.running || value === CUSTOM) {
    return;
  }
  if (value === NONE) {
    garage.config[slot] = null;
  } else {
    garage.config[slot] = value;
  }
  update();
};

/** @type {(name: string) => void} 套用預設組裝設定（清掉所有個別修改） */
const onPresetChange = (name) => {
  if (garage.running) {
    return;
  }
  garage.preset = name;
  garage.config = presetConfig(name);
  syncSelects();
  update();
};

/** 把 garage.config 反映到所有選單 */
const syncSelects = () => {
  selConfig.value = garage.preset;
  for (const [slot, sel] of selects) {
    setSelectValue(sel, garage.config[slot]);
  }
};

/** @type {(disabled: boolean) => void} 上賽道時鎖住選單 */
const lockSelects = (disabled) => {
  selConfig.disabled = disabled;
  for (const sel of selects.values()) {
    sel.disabled = disabled;
  }
};

// ---------------------------------------------------------------------------
// 上賽道
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const RACE_STATUS_TEXT = {
  running: '',
  finished: '完賽：官方 3 圈，經 3 次換道器，三條車道各跑一圈',
  derailed: '車子翻覆或飛出賽道，模擬停止',
  stalled: '車子卡住不動，模擬停止',
};

const onRace = async () => {
  if (!garage.raceEnabled || garage.running || !currentAsm) {
    return;
  }
  garage.running = true;
  btnRace.disabled = true;
  lockSelects(true);
  loadingEl.hidden = false;
  loadingEl.textContent = '建立 Rapier 物理世界與賽道…';
  try {
    race = await startRace(currentAsm);
    scene.enterRace(race.track);
    hud.hidden = false;
    $('viewport-hint').hidden = true;
    garage.raceStatus = 'running';
    garage.speed = 0;
    garage.distance = 0;
    garage.laps = 0;
    garage.lane = 0;
    garage.onBridge = false;
    garage.laneHistory = [0];
    btnGarage.focus();
  } catch (err) {
    garage.running = false;
    lockSelects(false);
    raceHint.textContent = `無法開始模擬：${err instanceof Error ? err.message : String(err)}`;
    btnRace.disabled = !garage.raceEnabled;
  }
  loadingEl.hidden = true;
};

const onGarage = () => {
  if (race) {
    race.dispose();
    race = null;
  }
  garage.running = false;
  garage.raceStatus = null;
  garage.speed = 0;
  scene.exitRace();
  hud.hidden = true;
  $('viewport-hint').hidden = false;
  lockSelects(false);
  btnRace.disabled = !garage.raceEnabled;
  btnRace.focus();
};

/** 更新賽道 HUD 與 window.__garage */
const updateHud = () => {
  if (!race) {
    return;
  }
  const s = race.snapshot();
  garage.speed = s.speed;
  garage.distance = s.distance;
  garage.laps = s.laps;
  garage.voltage = s.voltage;
  garage.raceStatus = s.status;
  $('hud-kmh').textContent = fx(s.speed * 3.6);
  $('hud-ms').textContent = `${fx(s.speed, 2)} m/s`;
  let lapText = `${fx(s.lapProgress, 2)} / ${race.laps}`;
  if (s.status === 'finished') {
    lapText = `${race.laps} / ${race.laps}（完賽）`;
  }
  $('hud-laps').textContent = lapText;
  $('hud-dist').textContent = `${fx(s.distance, 2)} m`;
  $('hud-volt').textContent = `${fx(s.voltage, 2)} V`;
  $('hud-amp').textContent = `${fx(s.current, 2)} A`;
  let laneText = `第 ${s.lane + 1} 道`;
  if (s.onBridge) {
    laneText += '（換道橋上）';
  }
  $('hud-lane').textContent = laneText;
  garage.lane = s.lane;
  garage.onBridge = s.onBridge;
  garage.laneHistory = s.laneHistory;
  $('hud-time').textContent = `${fx(s.simTime, 2)} s`;
  let note = RACE_STATUS_TEXT[s.status] ?? '';
  if (s.status === 'running' && s.realtimeRatio < 0.95) {
    note = `模擬速率 ${fx(s.realtimeRatio * 100, 0)}%（物理步長 0.25 ms，電腦算不及時放慢播放）`;
  }
  $('hud-note').textContent = note;
};

// ---------------------------------------------------------------------------
// 預先計算車殼幾何（第一次組裝某款車殼要建幾何、算質量與間隙，可能要數秒）
// ---------------------------------------------------------------------------

const warmBodies = () => {
  const ids = listBodies().map((b) => b.id);
  let i = 0;
  const next = () => {
    if (i >= ids.length) {
      garage.warmed = true;
      warmHint.textContent = '';
      return;
    }
    const id = ids[i];
    i += 1;
    warmHint.textContent = `背景預先計算車殼幾何 ${i}/${ids.length}…`;
    try {
      // 用目前的輪胎 / 導輪組裝一次：建立車殼幾何快取、質量與間隙快取
      assemble({ ...garage.config, body: id });
      labelBodyMass(id);
    } catch {
      // 個別車殼失敗不影響其他車殼
    }
    setTimeout(next, 30);
  };
  setTimeout(next, 30);
};

// ---------------------------------------------------------------------------
// 主迴圈與初始化
// ---------------------------------------------------------------------------

let lastFrame = performance.now();
/** @type {FrameRequestCallback} */
const loop = (now) => {
  const dt = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  if (race && garage.running) {
    race.advance(dt);
    const { pos, rot } = race.pose();
    scene.updateRacePose(pos, rot, dt);
    updateHud();
  }
  scene.render();
  requestAnimationFrame(loop);
};

const init = () => {
  scene = createGarageScene($('viewport'));
  buildPresetSelect();
  buildBodySelect();
  buildSlotSelects();
  readUrl();
  syncSelects();
  selConfig.addEventListener('change', () => onPresetChange(selConfig.value));
  selBody.addEventListener('change', () => onSlotChange('body', selBody.value));
  btnRace.addEventListener('click', onRace);
  btnGarage.addEventListener('click', onGarage);
  chkCom.addEventListener('change', () => scene.setComVisible(chkCom.checked));
  // 首次組裝；3D 模型在下一幀建立，建好後 garage.ready = true
  update();
  if (currentAsm && !isEmptyValue(garage.config.body)) {
    labelBodyMass(garage.config.body);
  }
  requestAnimationFrame(loop);
  warmBodies();
};

init();
