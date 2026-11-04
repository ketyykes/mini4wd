// 特洛伊木馬（body-trojan-horse，第八階段神話組・希臘）：木板拼成的方正馬身（側面橫向木板分條、上緣倒角）、
// 側面一排六個小方窗（士兵窗，凹槽）、青銅鉚釘點列與兩道青銅馬具帶、車頭前上方收短往上翹的幾何化馬頸與馬頭（實體件）、
// 頸後梳狀短鬃片、車尾三片短束的馬尾鰭（尾翼）。四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝（古代圖像中馬腳下的輪子）。
// 設計：shared/design/body-trojan-horse/DESIGN.md（米科諾斯島浮雕陶甕 Pithos 2240，約西元前 675–670 年）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：淺橡木＋深胡桃木（霧面）＋青銅（金屬）＋陶甕赭紅點綴；不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-70, -66, -60, -50, -40, -20, 0, 20, 40, 48, 54, 58, 61, 63.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 馬背（中線頂）：車尾臀部略低，中段平直，車頭往前下收成前胸斜面
  yT: monoCurve(XS, [33.5, 35, 36.2, 36.8, 37, 37, 37, 37, 37, 36.4, 34.6, 31.5, 27.5, 23]),
  // 半寬（俯視馬形）：寬厚的前胸（33.5，前輪上方）→ 收細的馬腹（23.4）→ 臀部（29，後輪上方）；
  // 輪胎外側（|z| 到 34.75）露在車身外 = 古代圖像中馬腳下外露的輪子；胸前與臀部尾端收窄
  hw: monoCurve(XS, [26, 27.6, 28.6, 29, 28.6, 24.6, 23.4, 27, 33.2, 33.6, 32.6, 30.6, 28, 25.2]),
  // 側壁下緣：中段 13（底盤側框禁入區由 loft.js 自動讓開），車尾抬高離開後保桿
  yLow: monoCurve(XS, [19, 17.5, 15.5, 13.5, 13, 13, 13, 13, 13, 13.2, 13.8, 14.4, 15, 15.5]),
};

/** @type {number} 馬背兩側倒角寬度（俯視 z 方向、側視 y 方向同值） */
const CH = 3;

/**
 * 半剖面 6 點：中線頂 → 背板中段（微拱）→ 倒角起點（銳利）→ 倒角終點／側板頂（銳利）→ 側板中段 → 側板下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yT = P.yT(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const ch = Math.min(CH, Math.max(1.2, (yT - yLow) * 0.3));
  const ySide = yT - 0.8 - ch;
  return [
    [0, yT],
    [0.5 * (hw - ch), yT - 0.35],
    [hw - ch, yT - 0.8],
    [hw, ySide],
    [hw, lerp(ySide, yLow, 0.5)],
    [hw, yLow],
  ];
};

// 前胸斜面每 1 mm 一站（曲率大）
const STATIONS = [...buildStations(-70, 50, 2, profile).slice(0, -1), ...buildStations(50, 63.5, 1, profile)];

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（側視，31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5 },
  { x: -40, y: 13, radius: 17.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** 木板寬度（側面橫向木板的高度、背板縱向木板的寬度） */
const PLANK_SIDE = 4.2;
const PLANK_TOP = 6.8;
/** 側面木板起算高度（最下一條木板的下緣） */
const PLANK_Y0 = 15.4;

/** 士兵窗（側面一排六個小方窗：x 中心、窗寬 4.8、高 5，y 26.4–31.4） */
const WINDOW_XS = [-21, -12.6, -4.2, 4.2, 12.6, 21];
const WINDOW = { w: 4.8, y0: 26.4, y1: 31.4 };

/** 青銅馬具帶（從側板下緣繞過馬背到另一側）的 x 位置 */
const STRAPS = [-27, 27];

/**
 * 週期分條：奇數條內為正（帶內距離）、偶數條內為負
 * @type {(v: number, v0: number, p: number) => number}
 */
const oddBand = (v, v0, p) => {
  const q = (v - v0) / p;
  const f = q - Math.floor(q);
  const d = Math.min(f, 1 - f) * p;
  return Math.floor(q) % 2 !== 0 ? d : -d;
};

/** @type {(x: number, z: number) => boolean} 側板（倒角以下的垂直面） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 0.4;
/** @type {(x: number, z: number) => boolean} 背板（倒角以內的頂面） */
const onTop = (x, z) => Math.abs(z) < P.hw(x) - CH - 0.1;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 木作：霧面（roughness 0.62–0.72、幾乎無清漆）
  oak: namedMaterial('paint-oak-light', { color: 0xb98a55, roughness: 0.66, clearcoat: 0.05 }),
  oakMid: namedMaterial('paint-oak-mid', { color: 0x946238, roughness: 0.68, clearcoat: 0.05 }),
  walnut: namedMaterial('paint-walnut-dark', { color: 0x5c3a21, roughness: 0.7, clearcoat: 0.04 }),
  walnut2: namedMaterial('paint-walnut-dark', { color: 0x5c3a21, roughness: 0.7, clearcoat: 0.04, side: THREE.DoubleSide }),
  oak2: namedMaterial('paint-oak-light', { color: 0xb98a55, roughness: 0.66, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 陶甕赭紅（霧面陶土）
  terracotta: namedMaterial('paint-terracotta-ochre', { color: 0xa5482b, roughness: 0.74, clearcoat: 0.0 }),
  // 青銅（真金屬：名稱含 -brass）
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb07a3c, roughness: 0.32, metalness: 0.78, clearcoat: 0.2 }),
  bronze2: namedMaterial('trim-bronze-brass', { color: 0xb07a3c, roughness: 0.32, metalness: 0.78, clearcoat: 0.2, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-walnut', { color: 0x4a2f1b, roughness: 0.7, side: THREE.DoubleSide }),
  // 士兵窗槽底（窗內的暗處）與槽壁
  recess: namedMaterial('plastic-window-black', { color: 0x0d0a08, roughness: 0.9, side: THREE.DoubleSide }),
  recessWall: namedMaterial('paint-walnut-dark', { color: 0x4a2f1b, roughness: 0.72, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-walnut', { color: 0x3a2516, roughness: 0.8, side: THREE.DoubleSide }),
  dGroove: decalMaterial('decal-walnut-groove', { color: 0x2c1b0f, roughness: 0.8 }),
  dBronze: decalMaterial('decal-bronze', { color: 0xb07a3c, roughness: 0.34, metalness: 0.72 }),
  dTerracotta: decalMaterial('decal-terracotta', { color: 0xa5482b, roughness: 0.74 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯（沿垂直側板內側裁切，參考 zeppelin 的 buildHullLiner）：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3，只取上半圈），
 * 每個角度的 z 範圍 = [側板內面 − depth, 側板內面]，擋住從輪拱看進去的殼內空腔與底盤空隙
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.12;
  const a1 = Math.PI - 0.12;
  const pos = [];
  /** @type {(t: number) => number} 該角度的側板內面 z */
  const zIn = (t) => P.hw(arch.x + r * Math.cos(t)) - 1.2;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zIn(t0) - depth);
      const B = p(t1, zIn(t1) - depth);
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
};

/**
 * 沿一條曲線的一段掃掠六角斷面（幾何化的木雕馬頸 / 馬頭：平頂、平底、側面有稜線，不平滑法線 → 刻面感）
 * @type {(curve: THREE.CatmullRomCurve3, t0: number, t1: number, radius: (t: number) => number[]) => THREE.BufferGeometry}
 */
const sweepHexRange = (curve, t0, t1, radius) => {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const p = curve.getPointAt(lerp(t0, t1, i / 8));
    pts.push([p.x, p.y, p.z]);
  }
  return sweepEllipse(pts, 16, (u) => radius(lerp(t0, t1, u)), 6);
};

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定（神話組欄位由下方匯出時補進 BodyDef） */
const CONFIG = {
  id: 'body-trojan-horse',
  name: '特洛伊木馬',
  style: 'myth',
  phase: 8,
  mythSeries: 'greek',
  mythTheme: 'trojan-horse',
  form: 'plank-wagon',
  roof: 'closed',
  wing: 'horse-tail',
  theme: '木板拼成的方正馬身＋一排士兵小方窗、青銅鉚釘與馬具帶、車頭往上翹的幾何化馬頸馬頭與梳狀鬃片、車尾短束馬尾鰭；31 mm 大輪是馬腳下的輪子',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面：倒角兩條稜線（2、3）為銳利稜線，背板與側板各自是平面
  hard: [2, 3],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
  ],
  recesses: WINDOW_XS.map((xc, i) => ({
    id: `士兵窗-${i + 1}`,
    view: 'side',
    x: [xc - WINDOW.w / 2, xc + WINDOW.w / 2],
    y: [WINDOW.y0, WINDOW.y1],
    r: 0.4,
    depth: 1.2,
  })),
  innerSkipRecess: true,
  sideZMin: 22,
  zones: () => [
    // 陶甕赭紅底板：側板最下一條（y < 15.4）與輪拱外緣 1.4 mm 一圈（馬腳下的輪座）
    { mat: 'terracotta', keep: (x, y, z) => (onSide(x, z) ? Math.max(PLANK_Y0 - y, 1.4 - archRingDist(x, y)) : -1) },
    // 深胡桃木：馬背兩側倒角（框邊木條）
    { mat: 'walnut', keep: (x, y, z) => (!onSide(x, z) && !onTop(x, z) ? 1 : -1) },
    // 中橡木：側板橫向木板隔條交錯（和淺橡木只差一階，像同一批木料的色差，不做成斑馬紋）
    { mat: 'oakMid', keep: (x, y, z) => (onSide(x, z) ? oddBand(y, PLANK_Y0, PLANK_SIDE) : -1) },
    // 中橡木：背板縱向木板隔條交錯（中線一條淺橡木）
    { mat: 'oakMid', keep: (x, y, z) => (onTop(x, z) ? oddBand(Math.abs(z), -PLANK_TOP / 2, PLANK_TOP) : -1) },
    { mat: 'oak', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'walnut', recess: 'recess', recessWall: 'recessWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 馬頸與馬頭（實體件）：從前胸頂往上翹（不往前伸），六角斷面的幾何化木雕；根部埋進殼面下 3 mm、斷面放大融進馬背 ──
    const neckCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(44, 33.6, 0), new THREE.Vector3(49.5, 40, 0), new THREE.Vector3(54.5, 47.5, 0), new THREE.Vector3(58, 53, 0)], false, 'centripetal');
    // [半寬, 前後厚]：根部 6.4 × 8.6 往上收到 4 × 5
    const neckR = (t) => {
      const flare = Math.max(0, 1 - t / 0.3) ** 2;
      return [lerp(4.6, 3.8, t) + 1.8 * flare, lerp(6, 4.8, t) + 2.6 * flare];
    };
    parts.push({ geometry: sweepHexRange(neckCurve, 0, 1, neckR), mat: 'oak', solid: true, outline: true, name: 'horse-neck' });
    // 馬頭：從頸頂往前下（口鼻端 x ≈ 77.5），斷面 [半寬, 高] 4 × 4.4 收到 2.5 × 2.9
    const headCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(56.2, 55, 0), new THREE.Vector3(62, 55.6, 0), new THREE.Vector3(69, 53.6, 0), new THREE.Vector3(76.6, 50.2, 0)], false, 'centripetal');
    const headR = (t) => [lerp(3.9, 2.5, t), lerp(4.4, 2.9, t)];
    parts.push({ geometry: sweepHexRange(headCurve, 0, 0.72, headR), mat: 'oak', solid: true, outline: true, name: 'horse-head' });
    // 青銅鼻革（馬具）：口鼻前的一段略粗的青銅帶
    parts.push({ geometry: sweepHexRange(headCurve, 0.72, 0.82, (t) => headR(t).map((r) => r + 0.35)), mat: 'bronze', solid: true, outline: true, name: 'horse-noseband' });
    // 口鼻端（深胡桃木）
    parts.push({ geometry: sweepHexRange(headCurve, 0.82, 1, headR), mat: 'walnut', solid: true, outline: true, name: 'horse-muzzle' });
    // 眼睛：頭側一對青銅圓釘（半徑 1）
    /** @type {THREE.BufferGeometry[]} */
    const eyes = [];
    for (const sg of [-1, 1]) {
      const g = new THREE.SphereGeometry(1, 14, 10);
      g.scale(1, 1, 0.6);
      g.translate(63, 56.4, sg * 3.35);
      eyes.push(g);
    }
    parts.push({ geometry: mergeGeos(eyes), mat: 'bronze', solid: true, name: 'horse-eyes' });
    // 耳朵：頭頂後方一對短三角板（厚 1.4，往外 12°）
    /** @type {THREE.BufferGeometry[]} */
    const ears = [];
    for (const sg of [-1, 1]) {
      ears.push(finPlate([[57.6, 58.2], [61.4, 58.6], [58.4, 61.6]], sg * 2.1, 1.4, sg * -12));
    }
    parts.push({ geometry: mergeGeos(ears), mat: 'walnut2', solid: true, outline: true, name: 'horse-ears' });
    // 梳狀短鬃：沿頸後緣一列 6 齒（厚 1.6），根部埋在頸內
    {
      const a = neckCurve.getPointAt(0.18);
      const b = neckCurve.getPointAt(1);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      // 頸後方向（往後上）
      const nx = -uy;
      const ny = ux;
      const pts = [];
      const n = 6;
      /** @type {(s: number, h: number) => number[]} s = 沿頸、h = 往頸後的距離 */
      const at = (s, h) => [a.x + ux * s + nx * h, a.y + uy * s + ny * h];
      pts.push(at(0, 1.5));
      for (let i = 0; i < n; i++) {
        const s0 = (len * i) / n;
        const s1 = (len * (i + 1)) / n;
        // 每齒：齒根 → 齒尖（往頸後外 7 mm，略往下梳）→ 回到齒根
        pts.push(at(s0 + 0.15 * (s1 - s0), 4.6));
        pts.push(at(s0 + 0.35 * (s1 - s0), 7.2));
        pts.push(at(s0 + 0.75 * (s1 - s0), 7.0));
        pts.push(at(s1, 4.6));
      }
      pts.push(at(len + 1.2, 1.5));
      // 多邊形頂點順序要一致（沿頸往上走的外緣）；最後回到起點由 Shape 自動閉合
      parts.push({ geometry: finPlate(pts, 0, 1.6), mat: 'walnut2', solid: true, outline: true, name: 'horse-mane' });
    }

    // ── 馬尾鰭（尾翼）：車尾馬背上三片短束的尾鰭（中片最長），往後上翹、尖端不超出車尾；根部一個青銅束環 ──
    /** @type {(tipX: number, tipY: number) => number[][]} */
    const tuft = (tipX, tipY) => [
      [-55, top(-55, 0) - 1.4],
      [-59, top(-59, 0) + 3.6],
      [-64.5, tipY - 2.2],
      [tipX, tipY],
      [-67.8, tipY - 3.6],
      [-64.6, top(-64.6, 0) + 1.2],
      [-62.5, top(-62.5, 0) - 1.4],
    ];
    parts.push({
      geometry: mergeGeos([finPlate(tuft(-71.6, 45.5), 0, 1.6), finPlate(tuft(-70.4, 43.2), -2.4, 1.4, 14), finPlate(tuft(-70.4, 43.2), 2.4, 1.4, -14)]),
      mat: 'walnut2',
      solid: true,
      outline: true,
      name: 'horse-tail-fins',
    });
    {
      const g = new THREE.SphereGeometry(1, 20, 12);
      g.scale(2.6, 1.8, 4.6);
      g.translate(-58.4, top(-58.4, 0) + 0.5, 0);
      parts.push({ geometry: g, mat: 'bronze', solid: true, outline: true, name: 'horse-tail-binding' });
    }

    // 輪拱內襯（前後，31 mm 大輪拱）：擋住從輪拱看進去的殼內空腔
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildLiner(a, 2.4))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });

    // ── 貼紙 ──
    // 木板接縫：側板橫向細縫、背板縱向細縫（深色 0.6 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z)) {
          const q = (y - PLANK_Y0) / PLANK_SIDE;
          return y < PLANK_Y0 - 0.3 ? -1 : 0.3 - Math.abs(q - Math.round(q)) * PLANK_SIDE;
        }
        if (onTop(x, z)) {
          const q = (Math.abs(z) + PLANK_TOP / 2) / PLANK_TOP;
          return 0.3 - Math.abs(q - Math.round(q)) * PLANK_TOP;
        }
        return -1;
      }),
      mat: 'dGroove',
      name: 'decal-plank-seams',
    });
    // 背板橫向接頭縫（每 34 mm 一道，木板錯開接）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, z)) {
          return -1;
        }
        const k = Math.floor((Math.abs(z) + PLANK_TOP / 2) / PLANK_TOP);
        const xs = k % 2 === 0 ? [-48, -14, 20] : [-31, 3, 37];
        return 0.3 - Math.min(...xs.map((xj) => Math.abs(x - xj)));
      }),
      mat: 'dGroove',
      name: 'decal-plank-butt-joints',
    });
    // 青銅馬具帶：兩道 2 mm 寬的帶，從側板下緣繞過馬背
    parts.push({
      geometry: kit.decal((x, y, z) => Math.max(...STRAPS.map((xs) => 1 - Math.abs(x - xs))), { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-harness-straps',
    });
    // 胸帶：前胸斜面上一道橫向青銅帶
    parts.push({
      geometry: kit.decal((x, y, z) => (x > 55 ? 0.9 - Math.abs(y - (P.yT(x) - 0.8 - CH) + 0.2) : -1), { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-breast-strap',
    });
    // 青銅鉚釘點列：側板上緣與底板上方各一列（每 3.2 mm 一顆，直徑 0.9），避開馬具帶與輪拱邊
    /** @type {(u: number, v: number) => number} u = 往前為正的 x */
    const rivets = (u, v) => {
      const ph = ((u % 3.2) + 3.2) % 3.2;
      const du = Math.min(ph, 3.2 - ph);
      const d = Math.min(Math.hypot(du, v - 33.2), Math.hypot(du, v - 16.4)) - 0.45;
      return Math.max(d, u - 58, -66 - u, 2.2 - Math.min(...STRAPS.map((xs) => Math.abs(u - xs))), 2.4 - archRingDist(u, v));
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(rivets, { x0: 0, y0: 0, zMin: 22, side: 1 }), { offset: 0.1 }),
        kit.decal(sideDecal((u, v) => rivets(-u, v), { x0: 0, y0: 0, zMin: 22, side: -1 }), { offset: 0.1 }),
      ]),
      mat: 'dBronze',
      name: 'decal-rivets',
    });
    // 馬具帶上的鉚釘（每帶側面 4 顆，深色，像釘頭）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        let d = Infinity;
        for (const xs of STRAPS) {
          for (const yy of [19, 23.2, 27.4, 31.6]) {
            d = Math.min(d, Math.hypot(x - xs, y - yy) - 0.42);
          }
        }
        return -d;
      }, { offset: 0.16 }),
      mat: 'dGroove',
      name: 'decal-strap-rivets',
    });
    // 士兵窗的赭紅窗框（0.7 mm，陶甕上的窗格）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        let d = Infinity;
        for (const xc of WINDOW_XS) {
          const dx = Math.abs(x - xc) - WINDOW.w / 2;
          const dy = Math.abs(y - (WINDOW.y0 + WINDOW.y1) / 2) - (WINDOW.y1 - WINDOW.y0) / 2;
          d = Math.min(d, Math.max(dx, dy));
        }
        // 窗外 0–0.8 mm 的一圈
        return Math.min(d, 0.8 - d);
      }, { offset: 0.1 }),
      mat: 'dTerracotta',
      name: 'decal-window-frames',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：車殼外框長 149.4（尾鰭尖 x −71.8 → 馬口鼻 77.6）、馬背 37、馬頭頂約 60、耳尖 61.9；俯視馬形：前胸寬 67.4、馬腹 46.8、臀部 58；SPEC 1.14a 車殼外框長 ≤ 153 mm（立體橋不刮地）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯深 2.4 mm',
    windows: '士兵窗：米科諾斯島浮雕陶甕（Pithos 2240）木馬側面的小方窗；本款 6 個 4.8 × 5 mm、深 1.2 mm 凹槽（尺寸推估）',
    headNeck: '馬頸、馬頭、鬃片、耳朵、尾鰭為實心 ABS 件（鬃片 / 尾鰭厚 1.4–1.6 mm），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 只複製既有欄位：神話組分組欄位（mythSeries / mythTheme）在這裡補進 BodyDef
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const trojanHorseBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
