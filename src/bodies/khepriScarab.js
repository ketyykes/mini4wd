// 聖甲蟲凱布利推日（body-khepri-scarab，神話組・埃及）：照四視圖 05 的「圓弧車殼、鼻端大橢圓進氣口、長座艙、鴨尾車尾＋兩排格柵、車身分割帶」建模；車上沒有甲蟲的頭、眼、觸角、腳，也沒有人像。
// 甲蟲殼 → 車殼平面：兩輪之間鼓成 ±36 的橢圓殼（最寬處在收腰段），四個輪子露在殼外，俯視像一片圓拱的甲蟲背殼；座艙罩是不透明的金色聖甲蟲圓頂。
// 鞘翅 → 座艙後方的兩片深青金石鞘翅面板：中央金色鞘翅縫、金色外框，外緣一列綠松石／青金石交錯的羽格（翼片）；車尾是往上翹的鴨尾，尾面兩排格柵。
// 日盤 → 鼻端大橢圓進氣口正上方一枚直立的紅玉髓金框日盤，聖甲蟲把太陽往前推（MYTH_RESEARCH E-a）；只有一枚日盤，鼻端沒有燈眼。
// 胸飾 → 引擎蓋上一道弧形金框紅玉髓格帶；側面一條金色寬分割帶，上方綠松石、下方青金石。
// 設計：shared/design/body-khepri-scarab/DESIGN.md（MYTH_RESEARCH 埃及節 E1、E2、E3；黑名單 E10：不用 V 形引擎蓋、沒有大顎）。
// 塗裝：綠松石（費昂斯釉）為主色，青金石側面下半與深青金石鞘翅、金（真金屬）分割帶與圓頂、紅玉髓日盤與胸飾格；不含任何廠商 / 作品名稱、商標、文字或神的人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：鴨尾車尾 −58、鈍鼻 70（鼻端正面高 8.6，放進氣口） */
const XS = [-58, -52, -46, -40, -34, -16, -4, 8, 20, 34, 40, 46, 54, 62, 66, 70];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬：橢圓甲蟲殼——收腰段最寬（±36），前後輪上方收到 ±30 / ±33（輪子露在殼外），圓鼻 ±26.5，鴨尾車尾 ±27.5
  hw: monoCurve(XS, [27.5, 30.5, 33, 33, 34.5, 35.7, 36, 35, 33.5, 30, 30, 30, 29.5, 29, 28, 26.5]),
  // 中央頂線：鴨尾往上翹（35.6），往前一路降到鈍鼻（21.4）
  yC: monoCurve(XS, [35.6, 34.2, 33.4, 33, 32.8, 32, 31.2, 30, 28.6, 26.2, 25.4, 24.6, 23.6, 22.6, 22, 21.4]),
  // 殼肩（0.68 半寬）
  yF: monoCurve(XS, [36, 35, 34, 33.6, 33, 30.6, 29.6, 29.4, 29.6, 30.6, 31, 30.4, 27.6, 24.6, 23, 21.8]),
  // 最寬處：前後輪上方鼓到 30 以上（31 mm 輪胎頂 28.5 + 間隙），前段比引擎蓋高，像兩道擋泥板隆起
  yE: monoCurve(XS, [31.6, 31, 30.4, 30.4, 29.8, 26.2, 25.4, 25.6, 27, 29.6, 30.2, 29.6, 26.4, 23.6, 22.4, 20.8]),
  // 側壁下緣
  yLow: monoCurve(XS, [19, 16, 13.8, 13, 12.9, 12.6, 12.5, 12.5, 12.5, 12.6, 13, 13.4, 13.6, 13.2, 12.9, 12.8]),
};

/**
 * 半剖面 7 點：圓拱殼（中線 → 殼肩 → 最寬處平滑相接），只有最寬處是稜線，其下是內收的側壁
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yF = P.yF(x);
  const yE = P.yE(x);
  const hw = P.hw(x);
  return [
    [0, yC],
    [0.22 * hw, yC - 0.25],
    [0.46 * hw, lerp(yC, yF, 0.65)],
    [0.68 * hw, yF],
    [0.88 * hw, lerp(yF, yE, 0.5)],
    [hw, yE],
    [hw - 0.8, P.yLow(x)],
  ];
};

const STATIONS = buildStations(-58, 70, 1.5, profile);

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22 },
];

/** @type {(x: number, z: number) => boolean} 側壁（最寬處以下；側壁往下內收 0.8 mm、下緣再內收 0.8 mm，所以門檻放到半寬 − 1.8） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 1.8;

/**
 * 側面分割高度（金色寬分割帶的下緣；以下青金石、帶上方綠松石）：前段 19.5 → 鼻端 17，車尾段往鴨尾斜升到 23
 * @type {(x: number) => number}
 */
const splitY = (x) => {
  if (x > 30) {
    return lerp(19.5, 17, Math.min(1, (x - 30) / 40));
  }
  if (x > -20) {
    return 19.5;
  }
  return lerp(19.5, 23, Math.min(1, (-20 - x) / 38));
};

/**
 * 鞘翅面板內距（正值 = 在面板內）：座艙後方 x −10 到車尾、中線兩側 0.9 半寬以內
 * @type {(x: number, z: number) => number}
 */
const elytraInset = (x, z) => Math.min(-10 - x, 0.9 * P.hw(x) - Math.abs(z));

/**
 * 引擎蓋胸飾格帶：以 (x 22, z 0) 為圓心、半徑 30.5 → 33.5 的弧形帶（正值 = 在帶內），只取 x 36 以前、0.64 半寬以內
 * @type {(x: number, z: number) => number}
 */
const pectoralInset = (x, z) => {
  const r = Math.hypot(x - 22, z * 1.15);
  return Math.min(r - 30.5, 33.5 - r, 0.64 * P.hw(x) - Math.abs(z), x - 36);
};

/** @type {number} 金色分割帶寬 */
const BAND_W = 2.6;

/**
 * 由半剖面折線反查某高度的殼外表面 z（剖面點 z 由中線往外遞增、y 由上往下遞減）
 * @type {(pts: number[][], y: number) => number} 高於殼頂回傳 0，低於下緣回傳下緣 z
 */
export const profileZAtY = (pts, y) => {
  if (y >= pts[0][1]) {
    return 0;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) {
      const t = Math.abs(y1 - y0) < 1e-6 ? 0 : (y - y0) / (y1 - y0);
      return lerp(z0, z1, t);
    }
  }
  return pts[pts.length - 1][0];
};

/**
 * 輪拱內襯（參考 zeppelin-xtail 的 buildHullLiner）：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3，只取上半圈），
 * 每個角度的 z 範圍 = [zFrom, 殼內面]；殼內面 z 由該站剖面反查（外表面 − inset）。擋住從輪拱看進去的殼內空腔與底盤空隙
 * @type {(arch: { x: number, y: number, radius: number }, zFrom: number, profileFn: (x: number) => number[][], inset?: number) => THREE.BufferGeometry}
 */
export function buildProfileLiner(arch, zFrom, profileFn, inset = 1.2) {
  const r = arch.radius + 0.3;
  const n = 48;
  const a0 = 0.12;
  const a1 = Math.PI - 0.12;
  const pos = [];
  /** @type {(t: number) => number} 該角度的殼內面 z */
  const zIn = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    return Math.max(zFrom, profileZAtY(profileFn(x), y) - inset);
  };
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zFrom);
      const B = p(t1, zFrom);
      const C = p(t1, zIn(t1));
      const D = p(t0, zIn(t0));
      // 法線朝輪心（內襯面向輪胎）
      if (sg > 0) {
        pos.push(...A, ...C, ...B, ...A, ...D, ...C);
      } else {
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 綠松石（費昂斯釉，亮面）：主色
  faience: namedMaterial('paint-faience-turquoise', { color: 0x2f9e98, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1 }),
  // 青金石珍珠漆（亮面清漆＋微金屬）：側面下半
  lapis: namedMaterial('paint-lapis-pearl', { color: 0x1f4f96, roughness: 0.26, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  // 深青金石：鞘翅面板
  elytra: namedMaterial('paint-lapis-deep', { color: 0x14306a, roughness: 0.3, metalness: 0.4, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
  // 玄武岩黑：下緣（霧面）
  basalt: namedMaterial('paint-basalt-black', { color: 0x1c1e23, roughness: 0.66 }),
  // 真金屬金（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a227, metalness: 0.82, roughness: 0.32, clearcoat: 0.3 }),
  // 紅玉髓：拋光寶石（日盤盤心）
  carnelian: namedMaterial('paint-carnelian-red', { color: 0xb1342a, roughness: 0.28, clearcoat: 0.8 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x1d4a78, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.DoubleSide }),
  // 聖甲蟲圓頂：不透明金色座艙罩（電鍍金）
  dome: namedMaterial('trim-gold-canopy-brass', { color: 0xd4ad3a, metalness: 0.8, roughness: 0.22, clearcoat: 0.6, side: THREE.DoubleSide }),
  // 進氣口內的深色底板與尾面格柵槽
  void: namedMaterial('shell-intake-dark-matte', { color: 0x0a0b0d, roughness: 0.95 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-basalt', { color: 0x2a2c31, roughness: 0.7, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-gold-leaf', { color: 0xd1aa35, metalness: 0.75, roughness: 0.34 }),
  dCarnelian: decalMaterial('decal-carnelian', { color: 0xb1342a, roughness: 0.32, clearcoat: 0.7 }),
  dTurquoise: decalMaterial('decal-turquoise', { color: 0x3fb8af, roughness: 0.4 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
});

/** 座艙罩（長而低，四視圖 05 的長座艙）：x 34 → −20 */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(34, -20, u);
      const halfW = i === 0 || i === n ? 2.4 : 12 * Math.sin(Math.PI * u ** 0.8) ** 0.5;
      const rise = 6.8 * Math.sin(Math.PI * u ** 0.7) ** 0.65;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {{ x: number, lift: number, tiltDeg: number, r: number }} 鼻端日盤：中心 x、中心離殼面的高度、盤面法線仰角、半徑（下半埋進鼻端） */
const SUN = { x: 66.4, lift: 1.4, tiltDeg: 12, r: 5.4 };

/** @type {{ x: number, y: number, rz: number, ry: number }} 鼻端大橢圓進氣口：正面 x、中心高度、半寬、半高 */
const INTAKE = { x: 70, y: 16.8, rz: 11, ry: 2.9 };

/** @type {(rz: number, ry: number, depth: number, x: number, y: number, seg?: number) => THREE.BufferGeometry} 軸向沿 x 的橢圓柱 */
const ovalSlab = (rz, ry, depth, x, y, seg = 24) => {
  const g = new THREE.CylinderGeometry(1, 1, depth, seg);
  g.rotateZ(Math.PI / 2);
  g.scale(1, ry, rz);
  g.translate(x, y, 0);
  return g;
};

export const khepriScarabBody = makePolyBody({
  id: 'body-khepri-scarab',
  name: '聖甲蟲凱布利',
  style: 'myth',
  phase: 13,
  mythSeries: 'egyptian',
  mythTheme: 'khepri-scarab',
  form: 'scarab-oval-shell',
  roof: 'canopy',
  wing: 'elytra-ducktail',
  theme: '綠松石＋青金石圓弧四驅車：兩輪之間鼓成橢圓甲蟲殼、四輪露在殼外；鈍鼻正面一個金唇大橢圓進氣口（內有兩道橫格），進氣口正上方一枚直立的紅玉髓金框日盤（聖甲蟲推日）；引擎蓋上弧形金框紅玉髓胸飾格帶；長而低的金色聖甲蟲圓頂座艙罩；座艙後方兩片深青金石鞘翅面板（金色鞘翅縫與外框、外緣綠松石羽格）收成往上翹的鴨尾，鴨尾上一片金色翹唇、尾面兩排格柵；側面金色寬分割帶，上方綠松石、下方青金石',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 0.8,
  step: 0.8,
  hard: [5],
  wheelArches: ARCHES,
  canopy: CANOPY,
  sideZMin: 24,
  zones: () => [
    // 側面最下緣玄武岩黑（1.6 mm）
    { mat: 'basalt', keep: (x, y, z) => (onSide(x, z) ? P.yLow(x) + 1.6 - y : -1) },
    // 金色寬分割帶
    { mat: 'gold', keep: (x, y, z) => (onSide(x, z) ? Math.min(y - splitY(x), splitY(x) + BAND_W - y) : -1) },
    // 側面下半青金石
    { mat: 'lapis', keep: (x, y, z) => (onSide(x, z) ? splitY(x) - y : -1) },
    { mat: 'elytra', keep: (x, y, z) => (onSide(x, z) ? -1 : elytraInset(x, z)) },
    { mat: 'faience', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'faience', cockpit: 'cockpit', glass: 'dome', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 鼻端日盤（實體件）：金框圓盤＋紅玉髓盤心，盤面朝前、微微仰起，下半埋進鼻端，立在進氣口正上方 ──
    {
      const cy = kit.surf.topY(SUN.x, 0) + SUN.lift;
      /** @type {(r: number, h: number) => THREE.BufferGeometry} 往前上方傾的圓盤 */
      const disc = (r, h) => {
        const g = new THREE.CylinderGeometry(r, r, h, 24);
        g.rotateZ(-((90 - SUN.tiltDeg) * Math.PI) / 180);
        g.translate(SUN.x, cy, 0);
        return g;
      };
      parts.push({ geometry: disc(SUN.r, 1.4), mat: 'gold', solid: true, outline: true, name: 'sun-disc-rim' });
      parts.push({ geometry: disc(SUN.r - 1.1, 1.8), mat: 'carnelian', solid: true, name: 'sun-disc-face' });
    }

    // ── 鼻端大橢圓進氣口：金色唇框、深色底板（擋住後方底盤）、兩道綠松石橫格 ──
    parts.push({ geometry: ovalSlab(INTAKE.rz + 1.1, INTAKE.ry + 1.1, 0.8, INTAKE.x + 0.1, INTAKE.y), mat: 'gold', solid: true, outline: true, name: 'intake-lip' });
    parts.push({ geometry: ovalSlab(INTAKE.rz, INTAKE.ry, 0.8, INTAKE.x + 0.3, INTAKE.y), mat: 'void', solid: true, name: 'intake-void' });
    {
      /** @type {THREE.BufferGeometry[]} */
      const slats = [];
      for (const dy of [-0.95, 0.95]) {
        const w = 2 * INTAKE.rz * Math.sqrt(1 - (dy / INTAKE.ry) ** 2) - 0.6;
        slats.push(new THREE.BoxGeometry(0.6, 0.55, w).translate(INTAKE.x + 0.9, INTAKE.y + dy, 0));
      }
      parts.push({ geometry: mergeGeos(slats), mat: 'faience', solid: true, name: 'intake-slats' });
    }

    // ── 鴨尾金色翹唇（後緣上翹 14°）與尾面兩排格柵 ──
    {
      const lip = new THREE.BoxGeometry(7, 1, 2 * 25.6);
      lip.rotateZ(-(14 * Math.PI) / 180);
      lip.translate(-56.2, kit.surf.topY(-56.2, 0) + 0.9, 0);
      parts.push({ geometry: lip, mat: 'gold', solid: true, outline: true, name: 'ducktail-lip' });
      /** @type {THREE.BufferGeometry[]} */
      const slots = [];
      for (const y of [25.4, 28.6]) {
        for (let k = 0; k < 5; k++) {
          const z = 5.4 + k * 3.6;
          for (const sg of [-1, 1]) {
            slots.push(new THREE.BoxGeometry(0.6, 1.6, 2.6).translate(-58.2, y, sg * z));
          }
        }
      }
      parts.push({ geometry: mergeGeos(slots), mat: 'void', solid: true, name: 'tail-grille-slots' });
    }

    // 輪拱內襯（前後，R17.5）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.4, profile))), mat: 'liner', shell: true, name: 'arch-liners' });

    // ── 貼紙（金箔）──
    // 鞘翅縫：中線一道金線（寬 1），座艙後方到鴨尾；鞘翅外框（寬 0.8）；外緣羽格的金色格線（0.5 → 0.86 半寬、每格長 4.2）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z) || x > -10.6) {
          return -1;
        }
        const az = Math.abs(z);
        const hw = P.hw(x);
        const seam = x < -21 ? 0.5 - az : -1;
        const frame = 0.4 - Math.abs(elytraInset(x, z) - 0.6);
        let cells = -1;
        if (x < -22 && x > -54 && az > 0.5 * hw - 0.25 && az < 0.86 * hw) {
          const lu = (((x + 22) % 4.2) + 4.2) % 4.2;
          cells = 0.25 - Math.min(Math.abs(az - 0.5 * hw), Math.abs(az - 0.68 * hw), lu, 4.2 - lu);
        }
        return Math.max(seam, frame, cells);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-elytra-lines',
    });
    // 羽格：外緣兩列，綠松石與深青金石底色交錯（棋盤格）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        const hw = P.hw(x);
        if (onSide(x, z) || x >= -22 || x <= -54 || az < 0.5 * hw || az > 0.86 * hw) {
          return -1;
        }
        const col = az < 0.68 * hw ? 0 : 1;
        const row = Math.floor((-22 - x) / 4.2);
        return (row + col) % 2 === 0 ? 1 : -1;
      }, { offset: 0.08 }),
      mat: 'dTurquoise',
      name: 'decal-elytra-feather-cells',
    });
    // 引擎蓋胸飾：弧形金帶（寬 3）裡一列紅玉髓方格
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? -1 : pectoralInset(x, z)), { offset: 0.08 }),
      mat: 'dGold',
      name: 'decal-pectoral-band',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z) || pectoralInset(x, z) < 0.5) {
          return -1;
        }
        const a = Math.atan2(z * 1.15, x - 22) * 32;
        const la = ((a % 2.4) + 2.4) % 2.4;
        return Math.min(la - 0.5, 1.9 - la);
      }, { offset: 0.12 }),
      mat: 'dCarnelian',
      name: 'decal-pectoral-cells',
    });
    // 尾燈：鴨尾左右一對細長紅燈
    {
      /** @type {THREE.BufferGeometry[]} */
      const lamps = [];
      for (const sg of [-1, 1]) {
        const l = new THREE.BoxGeometry(0.8, 1.4, 9);
        l.translate(-58.2, 32, sg * 14);
        lamps.push(l);
      }
      parts.push({ geometry: mergeGeos(lamps), mat: 'tail', solid: true, name: 'lamp-tail' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，造型比例取自 shared/design/body-khepri-scarab/fourview.png 與 fourview_trace.txt，縮到底盤尺寸）：殼長 128（鴨尾 −58 ~ 圓鼻 70）；鴨尾頂 35.6、中央頂 33.4、座艙罩頂約 37.6、日盤頂約 28；鼻端正面 12.8 ~ 21.4；寬：收腰 ±36、前輪上方 ±30、後輪上方 ±33、鼻端 ±26.5、鴨尾 ±27.5',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm）',
    sunDisc: '鼻端日盤：ABS 圓盤 R5.4、厚 1.4（金框）＋R4.3、厚 1.8（紅玉髓盤心），盤面法線仰角 12°（推估）',
    intake: '鼻端進氣口：橢圓 22 × 5.8，金唇框 24.2 × 8、深色底板與兩道橫格（ABS 實體件，推估）',
    ducktail: '鴨尾翹唇：ABS 板 7 × 51.2、厚 1，後緣上翹 14°；尾面兩排格柵槽各 10 個（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
