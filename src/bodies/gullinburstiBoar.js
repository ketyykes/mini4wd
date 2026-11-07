// 金鬃（body-gullinbursti-boar，神話組・北歐）：《散文埃達》中侏儒在鍛爐裡為 Freyr 打出的 Gullinbursti——鬃毛是金的、在黑夜裡發光、跑得比任何馬都快。
// 車上不做動物本體，只取「金鬃」與「鍛造」兩個元素做成賽車零件與塗裝：
// 車身側視是一把刀（F1 刀鋒滑翔型）：鼻尖 17.4 升到前輪上方的刀背最高點 34.2，再一路直降到車尾 22 的刀尖，後段比後輪頂還低；
// 俯視前寬後窄的水滴形，後輪露在殼外。
// 金鬃 → 背上左右各兩排立體的鋸齒金鬃背鰭（每排一片連續的拋光金薄片，齒高 4.2 → 2.4 mm、齒前緣後掠 40°），
// 從車頂中段順著刀背排到車尾，各接一片貼身的後掃金刃鰭；車尾左右各三片刃鰭由內而外愈倒愈平，後視是六片放射的扇（radiant-blades 尾翼）。
// 背鰭立在一塊從鼻尖往後張開的鍛鐵黑矛形脊甲上，脊甲外緣一圈餘燼橘的發光縫（黑夜裡發光的鬃）。
// 鍛造 → 腰線（刀刃稜線）以上整片拉絲金、側壁下緣一條鍛鐵黑裙板（側視是金色刀身墊一條黑色刀根），
// 分件線上一道餘燼發光縫、線下一排金鉚釘，裙板上整片鎚痕、兩輪之間三道斜切的鍛爐風口，肩部兩道鉚接板縫。
// 設計：shared/design/body-gullinbursti-boar/DESIGN.md（典故、借用的古代語彙、和市售車殼 / 現代作品 / 既有車殼的差異）。
// 塗裝全為自創：拉絲金車身＋鍛鐵黑裙板與脊甲＋拋光金背鰭與刃鰭＋餘燼橘發光縫；不用盧恩字母、不用任何被挪用的符號、不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位節點（x 由後到前；前後軸 x = ±40；車尾 −62、鼻尖 72） */
const XS = [-62, -60, -52, -40, -28, -14, 0, 12, 24, 36, 46, 54, 60, 64, 68, 72];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂（刀形）：鼻尖 17.4 → 前輪上方的刀背最高點 34.2（x 36；31 mm 輪拱頂 30.5 之上）→ 往後一路直降到車尾 22（刀尖）；
  // 後段只需高過後齒輪箱頂 21.4（x −40 殼頂 26），後輪頂（31 mm 輪 28.5）在側視高過車尾
  yC: monoCurve(XS, [22, 22.4, 24.4, 26, 27.8, 29.8, 31.6, 33.1, 33.9, 34.2, 32.6, 28, 23.8, 21.2, 19.2, 17.4]),
  // 最寬處高度（腰線，刀刃那條稜線）：鼻尖 16.6 → x 12 ~ 24 最高 23.5 → 往後降到車尾 20.4
  yS: monoCurve(XS, [20.4, 20.6, 21, 21.6, 22.2, 22.8, 23.3, 23.5, 23.5, 23, 22, 20.6, 19.2, 18.2, 17.4, 16.6]),
  // 半寬：俯視是前寬後窄的水滴形，前輪上方最寬 36.8（壓低正面面積），往後收成窄尾（後輪露在車殼外）；
  // 鼻段收成細長刀尖（x 60 → 72：11.5 → 4.5，V3 尖鼻楔形）
  hw: monoCurve(XS, [12.5, 14, 17.5, 21.5, 25, 29, 32.5, 35.5, 36.8, 36.8, 32, 20, 11.5, 8.6, 6.4, 4.5]),
  // 側壁下緣：中段 12.5，後輪之後往上收（車尾只剩約 3 mm 厚的刀尖）
  yLow: monoCurve(XS, [19.2, 18.4, 16.4, 14.6, 13.4, 12.8, 12.5, 12.5, 12.5, 12.8, 13.5, 14.5, 15, 15.2, 15.4, 15.6]),
};

/**
 * 半剖面 7 點：中線頂 → 背 → 肩 → 側腹上 → 最寬處（腰線）→ 下腹 → 側壁下緣；背線（點 2）與腰線（點 4）是稜線，其餘平滑
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yS = P.yS(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const dy = yC - yS;
  return [
    [0, yC],
    [0.34 * hw, yC - 0.07 * dy],
    [0.64 * hw, yC - 0.27 * dy],
    [0.87 * hw, yC - 0.62 * dy],
    [hw, yS],
    [hw - 0.9, lerp(yS, yLow, 0.6)],
    [hw - 1.8, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 鼻段每 1.5 mm 一站，其餘每 2 mm */
const STATIONS = [...buildStations(-62, 60, 2, profile).slice(0, -1), ...buildStations(60, 72, 1.5, profile)];

/**
 * 外殼在 (x, y) 高度的 |z|（沿剖面折線內插），給輪拱內襯定位用
 * @type {(x: number, y: number) => number}
 */
const shellZAt = (x, y) => {
  const pts = profile(x);
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (y >= lo && y <= hi && hi - lo > 1e-6) {
      return lerp(z0, z1, (y - y0) / (y1 - y0));
    }
  }
  return y > pts[0][1] ? 0 : pts[pts.length - 1][0];
};

/** @type {(t: number) => number} 夾在 0–1 */
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 主體：真金屬拉絲金（名稱含 -brass → Blender metallic 1），比刃鰭深一階、粗糙度高一點
  goldPaint: namedMaterial('trim-gold-body-brass', { color: 0xc8962f, metalness: 0.85, roughness: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.2 }),
  // 背鰭與刃鰭：更亮、更光滑的拋光金
  gold: namedMaterial('trim-gold-brass', { color: 0xf0c457, metalness: 0.9, roughness: 0.22, clearcoat: 0.3 }),
  // 鍛鐵黑（緞面、帶一點暖色）：脊甲與裙板；paint- 且 roughness > 0.5 → Blender 緞面
  iron: namedMaterial('paint-forged-iron-black', { color: 0x2a2624, roughness: 0.58, clearcoat: 0.12, clearcoatRoughness: 0.5 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x18191c, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-iron', { color: 0x3a3c42, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-iron', { color: 0x3a3c42, roughness: 0.7, side: THREE.DoubleSide }),
  // 金鉚釘（貼紙）：和刃鰭同一種拋光金
  dGold: decalMaterial('decal-gold-rivet', { color: 0xf0c457, metalness: 0.9, roughness: 0.22, clearcoat: 0.3 }),
  // 餘燼橘發光縫（低強度自發光，Blender 裡不過曝）
  dEmber: decalMaterial('decal-ember-glow', { color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.9, roughness: 0.3 }),
  // 鎚痕（貼紙）：比裙板亮一階的鍛鐵灰小橢圓
  dHammer: decalMaterial('decal-hammer-mark', { color: 0x4c4642, roughness: 0.5, metalness: 0.3 }),
  // 鉚接板縫：深烏銅細線
  dSeam: decalMaterial('decal-niello-seam', { color: 0x2e2118, roughness: 0.55 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

// ---------------------------------------------------------------------------
// 脊甲（鍛鐵黑矛形面板）、金鬃背鰭與刃鰭
// ---------------------------------------------------------------------------

/** @type {number} 脊甲前端 x（鼻尖後 2 mm） */
const SPINE_X0 = 70;

/**
 * 脊甲半寬：鼻尖 0 → 往後張開（每 134 mm 張開 24 mm），後段最多到殼半寬的 0.45 倍（兩側留寬的金色肩面到車尾）
 * @type {(x: number) => number}
 */
const spineHalfW = (x) => Math.min(lerp(0, 24, clamp01((SPINE_X0 - x) / 134)), 0.45 * P.hw(x));

/** @type {(x: number, y: number) => boolean} 背面（裙板分件線之上） */
const onBack = (x, y) => y > skirtY(x) + 0.5;

/**
 * 刃鰭（左右各 3 片，由內而外）：xf / xr 是鰭根前後端、tipX 是鰭尖 x、len 是鰭面高（外傾前）、z 是鰭根 |z|、tilt 是外傾角（度）。
 * 由內而外愈倒愈平、鰭根愈靠前，後視是六片放射的扇；鰭尖都不超出車尾 2 mm（x ≥ −64）
 * @type {{ xf: number, xr: number, tipX: number, len: number, z: number, tilt: number }[]}
 */
const BLADES = [
  { xf: -33, xr: -48, tipX: -63.5, len: 5.5, z: 4.2, tilt: 10 },
  { xf: -25, xr: -40, tipX: -59, len: 6.5, z: 8.2, tilt: 34 },
  { xf: -17, xr: -32, tipX: -54, len: 7, z: 12, tilt: 56 },
];

/**
 * 刃鰭側視輪廓（y 從鰭根 0 起算）：前緣微凸、後緣內凹的後掃尖刃
 * @type {(b: { xf: number, xr: number, tipX: number, len: number }) => number[][]}
 */
const bladeOutline = (b) => {
  const d = b.tipX - b.xf;
  return [
    [b.xf, 0],
    [b.xf + 0.45 * d, 0.52 * b.len],
    [b.xf + 0.8 * d, 0.88 * b.len],
    [b.tipX, b.len],
    [lerp(b.xr, b.tipX, 0.5), 0.36 * b.len],
    [b.xr, 0],
  ];
};

/**
 * 金鬃背鰭的排（左右各 2 排）：從 (x0, |z| z0) 直線排到內側兩片刃鰭的鰭根前端 (x1, |z| z1)，tilt 是外傾角（度）
 * @type {{ x0: number, z0: number, x1: number, z1: number, tilt: number }[]}
 */
const MANE_ROWS = [
  { x0: 24, z0: 2.6, x1: BLADES[0].xf, z1: BLADES[0].z, tilt: 6 },
  { x0: 16, z0: 6.6, x1: BLADES[1].xf, z1: BLADES[1].z, tilt: 24 },
];
/** @type {number} 鋸齒間距（mm） */
const TOOTH_PITCH = 6.5;
/** @type {number} 齒前緣後掠角的正切（40°） */
const TOOTH_TAN = Math.tan((40 * Math.PI) / 180);

/**
 * 一排金鬃背鰭：一片連續的鋸齒薄片（厚 1.2 mm，不倒角）。每 6.5 mm 一齒，齒前緣後掠 40° 升到齒尖、齒尖後緣往前收 0.7 mm（倒鉤），
 * 齒高由前往後 4.2 → 2.4 mm（刀背最高處的鬃最高，往車尾跟著刀形收低）；齒谷在殼面上 0.5 mm、底邊沿殼面埋進 1.5 mm
 * @type {(row: { x0: number, z0: number, x1: number, z1: number, tilt: number }, sg: number, topY: (x: number, z: number) => number) => THREE.BufferGeometry}
 */
const buildManeFin = (row, sg, topY) => {
  const dx = row.x0 - row.x1;
  const dz = row.z1 - row.z0;
  const len = Math.hypot(dx, dz);
  const n = Math.floor(len / TOOTH_PITCH);
  /** @type {(u: number) => number} 沿排往後 u mm 處的殼面高度 */
  const surfAt = (u) => topY(lerp(row.x0, row.x1, u / len), lerp(row.z0, row.z1, u / len));
  const yBase = Math.min(surfAt(0), surfAt(len)) - 1.5;
  const shape = new THREE.Shape();
  shape.moveTo(0, surfAt(0) - 1.5);
  for (let k = 0; k < n; k++) {
    const u = k * TOOTH_PITCH + 0.4;
    const h = lerp(4.2, 2.4, k / (n - 1));
    const uTip = u + (h - 0.5) / TOOTH_TAN;
    shape.lineTo(-u, surfAt(u) + 0.5);
    shape.lineTo(-uTip, surfAt(uTip) + h);
    shape.lineTo(-(uTip - 0.7), surfAt(uTip) + 0.5);
  }
  shape.lineTo(-len, surfAt(len) + 0.5);
  // 底邊沿殼面往回走（埋進殼面 1.5 mm），殼面往後降時鰭片不會在殼內長出一大塊
  for (let k = 8; k >= 0; k--) {
    shape.lineTo(-(len * k) / 8, surfAt((len * k) / 8) - 1.5);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
  g.translate(0, -yBase, -0.6);
  g.rotateX((-sg * row.tilt * Math.PI) / 180);
  g.rotateY(sg * Math.atan2(dz, dx));
  g.translate(row.x0, yBase, sg * row.z0);
  return g;
};

// ---------------------------------------------------------------------------
// 鍛鐵裙板（側面下半）
// ---------------------------------------------------------------------------

/**
 * 裙板分件線高度：腰線（刀刃稜線）往下 35% 的側壁高度——腰線以上整片拉絲金，只有側壁下緣一條鍛鐵黑裙板，
 * 側視是一片金色刀身下面墊一條黑色刀根
 * @type {(x: number) => number}
 */
const skirtY = (x) => lerp(P.yS(x), P.yLow(x), 0.35);

/** @type {(x: number, z: number) => boolean} 側面（半寬的 0.6 倍以外） */
const onSide = (x, z) => Math.abs(z) > 0.6 * P.hw(x);

/**
 * 鎚痕（貼紙）：裙板上交錯排列的小橢圓（長 1.8、高 1.1 mm，每 4.2 × 2.6 mm 一顆、隔排錯開半格）；回傳正值 = 在鎚痕內
 * @type {(x: number, y: number) => number}
 */
const hammerSd = (x, y) => {
  const row = Math.round(y / 2.6);
  const cx = (Math.round(x / 4.2 - 0.5 * (row & 1)) + 0.5 * (row & 1)) * 4.2;
  return 1 - Math.hypot((x - cx) / 0.9, (y - row * 2.6) / 0.55);
};

/** @type {number[]} 鍛爐風口（兩輪之間三道斜切縫）的中心 x */
const VENT_X = [-9, 0, 9];

/**
 * 鍛爐風口距離（側視）：每道是從 (cx − 2.2, 14.2) 斜到 (cx + 1.2, 18.4) 的短縫，半寬 0.8；回傳正值 = 在縫內
 * @type {(x: number, y: number) => number}
 */
const ventSd = (x, y) => {
  let best = -1;
  for (const cx of VENT_X) {
    const ax = cx - 2.2;
    const ay = 14.2;
    const dx = 3.4;
    const dy = 4.2;
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
    best = Math.max(best, 0.8 - Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
};

/** @type {number[]} 肩部鉚接板縫在分件線高度的 x（往上往後斜 0.5 mm / mm） */
const SEAM_X = [24, -10];

// ---------------------------------------------------------------------------
// 實體件
// ---------------------------------------------------------------------------

/**
 * 輪拱內襯（參考 zeppelin-xtail 的 buildHullLiner）：輪拱切口後面上半圈圓柱面，z 從殼內面（外殼 |z| − 1.2）往內 depth
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 16;
  /** @type {number[]} */
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = 0.2 + ((Math.PI - 0.4) * i) / n;
      const t1 = 0.2 + ((Math.PI - 0.4) * (i + 1)) / n;
      const x0 = arch.x + r * Math.cos(t0);
      const y0 = arch.y + r * Math.sin(t0);
      const x1 = arch.x + r * Math.cos(t1);
      const y1 = arch.y + r * Math.sin(t1);
      if (y0 < P.yLow(x0) + 0.4 || y1 < P.yLow(x1) + 0.4) {
        continue;
      }
      const zo0 = shellZAt(x0, y0) - 1.2;
      const zo1 = shellZAt(x1, y1) - 1.2;
      // 殼面在輪拱切口起點（|z| 21）以內的地方沒有被切開，不需要內襯
      if (zo0 < 21.5 || zo1 < 21.5) {
        continue;
      }
      const A = [x0, y0, sg * Math.max(21, zo0 - depth)];
      const B = [x1, y1, sg * Math.max(21, zo1 - depth)];
      const C = [x1, y1, sg * zo1];
      const D = [x0, y0, sg * zo0];
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
};

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];

export const gullinburstiBoarBody = makePolyBody({
  id: 'body-gullinbursti-boar',
  name: '金鬃',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'gullinbursti',
  form: 'forge-wedge',
  roof: 'closed',
  wing: 'radiant-blades',
  theme: '金鬃（鍛爐刀楔）：側視是一把刀的低趴全罩——鼻尖升到前輪上方的刀背最高點，再一路直降到比後輪頂還低的車尾刀尖；腰線以上整片拉絲金，側壁下緣一條鍛鐵黑裙板（鎚痕、金鉚釘、三道鍛爐風口）；背上一塊從鼻尖往後張開的鍛鐵黑矛形脊甲，上面左右各兩排立體的鋸齒金鬃背鰭順著刀背排到車尾（前高後低），接上六片貼身放射的後掃金刃鰭（radiant-blades 尾翼）；脊甲外緣與裙板分件線是餘燼橘發光縫',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 背線（點 2）與腰線（點 4）是稜線（肩線＋腰線貫穿車身）
  hard: [2, 4],
  wheelArches: ARCHES,
  sideZMin: 30,
  zones: () => [
    // 鍛鐵黑脊甲：背面中央的矛形面板
    { mat: 'iron', keep: (x, y, z) => (x < SPINE_X0 && onBack(x, y) ? spineHalfW(x) - Math.abs(z) : -1) },
    // 鍛鐵黑裙板：側面分件線以下（腰線以下整圈）
    { mat: 'iron', keep: (x, y, z) => (onSide(x, z) && x < 62 ? skirtY(x) - y : -1) },
    { mat: 'goldPaint', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'goldPaint', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 金刃鰭（尾翼）：左右各 3 片貼身的實體片（厚 1.6 mm），鰭根埋進殼面 1.5 mm
    /** @type {THREE.BufferGeometry[]} */
    const blades = [];
    for (const sg of [-1, 1]) {
      for (const b of BLADES) {
        const g = finPlate(bladeOutline(b), 0, 1.6, sg * b.tilt);
        g.translate(0, kit.surf.topY((b.xf + b.xr) / 2, b.z) - 1.5, sg * b.z);
        blades.push(g);
      }
    }
    parts.push({ geometry: mergeGeos(blades), mat: 'gold', solid: true, outline: true, name: 'radiant-blades' });
    // 金鬃背鰭：左右各 2 排連續的鋸齒薄片，從車頂中段排到內側兩片刃鰭的鰭根
    /** @type {THREE.BufferGeometry[]} */
    const mane = [];
    for (const sg of [-1, 1]) {
      for (const row of MANE_ROWS) {
        mane.push(buildManeFin(row, sg, kit.surf.topY));
      }
    }
    parts.push({ geometry: mergeGeos(mane), mat: 'gold', solid: true, outline: true, name: 'mane-fins' });
    // 脊甲外緣的餘燼發光縫（0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > SPINE_X0 - 4 || x < -60.5 || !onBack(x, y)) {
          return -1;
        }
        const d = Math.abs(z) - spineHalfW(x);
        return Math.min(d, 0.7 - d);
      }, { offset: 0.1 }),
      mat: 'dEmber',
      name: 'decal-spine-ember',
    });
    // 裙板分件線上的餘燼發光縫（0.7 mm）＋兩輪之間三道鍛爐風口
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 62 || x < -61) {
          return -1;
        }
        return Math.max(0.35 - Math.abs(y - skirtY(x) - 0.35), ventSd(x, y));
      }, { offset: 0.1 }),
      mat: 'dEmber',
      name: 'decal-skirt-ember',
    });
    // 裙板鎚痕：分件線下 3.4 mm 以下、側壁下緣 0.8 mm 以上，避開風口
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 58 || x < -60 || y > skirtY(x) - 3.4 || y < P.yLow(x) + 0.8 || ventSd(x, y) > -1) {
          return -1;
        }
        return hammerSd(x, y);
      }, { offset: 0.06 }),
      mat: 'dHammer',
      name: 'decal-hammer-marks',
    });
    // 肩部鉚接板縫：分件線上方兩道往後上斜的深色細縫（到背線為止）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || y < skirtY(x) + 1.2 || y > P.yC(x) - 0.3 * (P.yC(x) - P.yS(x))) {
          return -1;
        }
        let d = Infinity;
        for (const sx of SEAM_X) {
          d = Math.min(d, Math.abs(x - (sx - 0.5 * (y - 24))));
        }
        return 0.3 - d;
      }),
      mat: 'dSeam',
      name: 'decal-rivet-seams',
    });
    // 金鉚釘（貼紙圓點，直徑 1.7 mm）：裙板上、分件線下 1.8 mm 每 9 mm 一顆
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 58 || x < -60) {
          return -1;
        }
        const cx = Math.round((x - 3) / 9) * 9 + 3;
        return 0.85 - Math.hypot(x - cx, y - (skirtY(cx) - 1.8));
      }, { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-gold-rivets',
    });
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildLiner(a, 3))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P（推估）：車殼 x −62 ~ 72、背線最高 34.2（x 36）→ x −40 26（後齒輪箱頂 21.4 之上）→ 車尾 22、最寬 ±36.8（前輪上方）、鼻尖半寬 4.5；前輪上方殼頂約 33.6（31 mm 輪拱頂 30.5 之上）',
    mane: '金鬃背鰭為實心 ABS 鋸齒薄片（厚 1.2 mm，≥ 1.2 mm 射出薄件，不倒角），左右各 2 排：內排 x 24 → −33、|z| 2.6 → 4.2、外傾 6°；外排 x 16 → −25、|z| 6.6 → 8.2、外傾 24°；齒距 6.5 mm、齒高 4.2 → 2.4 mm、齒前緣後掠 40°（推估）',
    blades: '金刃鰭為實心 ABS 片（厚 1.6 mm），左右各 3 片：鰭根 |z| 4.2 / 8.2 / 12、外傾 10° / 34° / 56°、鰭面高 5.5 / 6.5 / 7 mm、鰭尖 x −63.5 / −59 / −54；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    livery: '脊甲半寬鼻尖 0 → 往後張開、最多殼半寬的 0.45 倍；餘燼發光縫 0.7 mm；裙板分件線 = 腰線往下 35% 的側壁高度；鎚痕是 1.8 × 1.1 mm 的貼紙橢圓、每 4.2 × 2.6 mm 一顆；金鉚釘是直徑 1.7 mm 的貼紙圓點、每 9 mm 一顆；皆為自繪（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），切口從 |z| 21 起＋3 mm 深內襯',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
