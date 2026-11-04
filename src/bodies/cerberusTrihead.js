// 三頭犬（body-cerberus-trihead，第八階段神話組・希臘）：低趴、肩部寬厚的全罩，車頭橫向並排三個低矮往前伸的犬吻
// （俯視三瓣鼻、中間略長、三吻之間深槽；實體件，根部從引擎蓋下長出）、中後段暗紅煙燻座艙罩、
// 車尾一條往上彎再往後的蛇形尾鰭（實體件，扁平斷面，尾端一個小蛇頭）。
// 設計：shared/design/body-cerberus-trihead/DESIGN.md（羅浮宮 E 701 卡厄瑞水罐、偽阿波羅多洛斯《書庫》2.122 的「三個犬頭、蛇尾」）。
// 塗裝：黑繪陶風格——赭紅陶土（霧面）＋光亮黑釉、刻線（露出陶土色的細線）、白 / 深紅加彩、頸部項圈與回紋飾帶；全為自創，不含任何文字或商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-71, -66, -58, -48, -40, -28, -14, 0, 14, 28, 40, 48, 53, 56];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：低趴（最高 32），車尾往下收；前段引擎蓋往前下斜（兩肩高於中線），三個犬頭從斜面上長出
  yC: monoCurve(XS, [24.5, 27.5, 30, 31.2, 31.6, 31.8, 32, 32, 32, 31.8, 30.6, 28.4, 25.8, 23.6]),
  // 側肩稜線：前後輪上方隆起（肩、臀），兩輪之間的腰部降低
  yE: monoCurve(XS, [21.5, 24.5, 28.5, 30.6, 31, 30.2, 27.6, 27, 28, 30.8, 31.6, 31, 29.4, 27]),
  // 半寬（俯視楔形）：肩部最寬厚（46.5，前輪上方），往後一路收窄成細瘦的後半身（後輪上方 32，後輪外側露出），車尾 27
  hw: monoCurve(XS, [24.5, 26, 27.6, 28.6, 29, 29.4, 30.2, 32.4, 37.6, 45.4, 48.2, 46.6, 41.4, 33.5]),
  // 側壁下緣
  yLow: monoCurve(XS, [19, 17.2, 14.5, 13, 12.6, 12.5, 12.5, 12.5, 12.5, 12.5, 12.6, 13.4, 15, 16.6]),
};

/**
 * 半剖面 7 點：中線頂 → 背 → 肩肌隆起 → 肩外坡 → 肩稜（銳利）→ 側壁 → 側壁下緣（內收）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yE = P.yE(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const yS = Math.max(yC - 0.2, yE + 1.6);
  return [
    [0, yC],
    [0.35 * hw, Math.max(yC - 0.3, yS - 0.8)],
    [0.68 * hw, yS],
    [hw - 2.4, yE + 1.1],
    [hw, yE],
    [hw, lerp(yE, yLow, 0.55)],
    [hw - 0.6, yLow],
  ];
};

const STATIONS = buildStations(-71, 56, 1.5, profile);

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 側壁（肩稜以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 0.3;

/** 回紋飾帶（側壁下段赭紅帶上的黑色回紋）：帶的上下緣高度 */
const FRIEZE = { y0: 13.6, y1: 18.6 };

/**
 * 線段距離（膠囊）
 * @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number}
 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/**
 * 回紋（鉤形連續回紋，週期 4 單位、高 3 單位，線寬 0.6 單位）：u 沿帶、v 由帶下緣往上（單位 mm × scale）
 * 每個週期：底線全長＋往上的鉤（x+3 上到頂、往回 2 格、下 2 格、往前 1 格）
 * @type {(u: number, v: number, unit: number) => number} 回傳距離（負值 = 線內）
 */
const meanderSd = (u, v, unit) => {
  const uu = u / unit;
  const vv = v / unit;
  const p = Math.floor(uu / 4) * 4;
  const lu = uu - p;
  /** @type {number[][]} 單一週期的折線（含相鄰週期的端點避免接縫斷線） */
  const segs = [
    [-4, 0, 8, 0],
    [3, 0, 3, 3],
    [3, 3, 1, 3],
    [1, 3, 1, 1],
    [1, 1, 2, 1],
    [-1, 0, -1, 3],
    [-1, 3, -3, 3],
    [7, 0, 7, 3],
    [7, 3, 5, 3],
    [5, 3, 5, 1],
    [5, 1, 6, 1],
  ];
  let d = Infinity;
  for (const [ax, ay, bx, by] of segs) {
    d = Math.min(d, segDist(lu, vv, ax, ay, bx, by));
  }
  return (d - 0.3) * unit;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 黑釉：黑繪陶的光亮黑（半光澤，只用在犬身），赭紅陶土為霧面
  black: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.15 }),
  black2: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.15, side: THREE.DoubleSide }),
  clay: namedMaterial('paint-terracotta-clay', { color: 0xc0623a, roughness: 0.72, clearcoat: 0.0 }),
  clay2: namedMaterial('paint-terracotta-clay', { color: 0xc0623a, roughness: 0.72, clearcoat: 0.0, side: THREE.DoubleSide }),
  // 加彩：深紅（項圈）、白（眼、項圈細環）——陶繪加彩是霧面礦物顏料
  addedRed: namedMaterial('paint-added-red', { color: 0x7e2220, roughness: 0.66, clearcoat: 0.05 }),
  addedWhite: namedMaterial('paint-added-white', { color: 0xeee6d6, roughness: 0.6, clearcoat: 0.05 }),
  nose: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.15 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1412, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-clay', { color: 0xa9532f, roughness: 0.7, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x1a1412, roughness: 0.85, side: THREE.DoubleSide }),
  // 暗紅煙燻座艙罩（有色透明 PC：保留色相）
  glass: namedMaterial('pc-tint-garnet-smoke', { color: 0x5a1416, roughness: 0.06, specularIntensity: 0.6, transparent: true, opacity: 0.62, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-clay', { color: 0x5a2c1c, roughness: 0.8, side: THREE.DoubleSide }),
  dIncised: decalMaterial('decal-incised-clay', { color: 0xc0623a, roughness: 0.72 }),
  dBlack: decalMaterial('decal-figure-black', { color: 0x141110, roughness: 0.4 }),
  dRed: decalMaterial('decal-added-red', { color: 0x7e2220, roughness: 0.66 }),
  dWhite: decalMaterial('decal-added-white', { color: 0xeee6d6, roughness: 0.6 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯（沿垂直側壁內側裁切，參考 zeppelin 的 buildHullLiner）：只取上半圈，擋住從輪拱看進去的殼內空腔與底盤空隙
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.12;
  const a1 = Math.PI - 0.12;
  const pos = [];
  /** @type {(t: number) => number} 該角度的側壁內面 z */
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
 * 犬吻設定：中線路徑（後 → 前）與斷面 [半寬, 半高] 隨 t 變化
 * @typedef {{ path: number[][], rz: number[], ry: number[] }} SnoutDef
 */
/** @type {SnoutDef[]} 中間（較長）＋左右兩個犬吻 */
const SNOUTS = [
  { path: [[48, 25.8, 0], [55, 26.6, 0], [63, 25, 0], [71, 22.4, 0], [78, 20.4, 0]], rz: [5.9, 2.4], ry: [5.1, 2.6] },
  ...[-1, 1].map((sg) => ({
    path: [[48, 25.4, sg * 15.6], [54, 25.8, sg * 16.8], [60.5, 24.2, sg * 18.2], [66.5, 22.2, sg * 19.4], [72, 20.6, sg * 20]],
    rz: [5.2, 2.2],
    ry: [4.5, 2.4],
  })),
];

/** @type {(s: SnoutDef) => THREE.CatmullRomCurve3} */
const snoutCurve = (s) => new THREE.CatmullRomCurve3(s.path.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
/** @type {(s: SnoutDef, t: number) => number[]} 斷面半徑：前 35% 是頭骨（緩收），之後收成犬吻 */
const snoutR = (s, t) => {
  const k = t < 0.35 ? 0.25 * (t / 0.35) : 0.25 + 0.75 * ((t - 0.35) / 0.65) ** 0.9;
  return [lerp(s.rz[0], s.rz[1], k), lerp(s.ry[0], s.ry[1], k)];
};

/** 蛇形尾鰭路徑（從座艙後方的背上順著往上彎、再往後微垂；根部沿背脊拉長融進殼面） */
const TAIL_PATH = [[-36, 29.6, 0], [-46, 32.4, 0], [-55, 36.2, 0], [-62, 39.2, 0], [-66.4, 39.4, 0], [-68.6, 38.4, 0]];

/** 座艙罩（暗紅煙燻，中後段）：x 12 → −32 */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(12, -32, u);
      const halfW = i === 0 || i === n ? 2.5 : 11.5 * Math.sin(Math.PI * u ** 0.9) ** 0.55;
      const rise = 8.2 * Math.sin(Math.PI * u ** 0.75) ** 0.65;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定（神話組欄位由下方匯出時補進 BodyDef） */
const CONFIG = {
  id: 'body-cerberus-trihead',
  name: '冥府三頭犬',
  style: 'myth',
  phase: 8,
  mythSeries: 'greek',
  mythTheme: 'cerberus',
  form: 'tri-snout',
  roof: 'canopy',
  wing: 'serpent-tail',
  theme: '低趴寬肩全罩、車頭並排三個往前伸的犬吻（中間略長、深槽分隔）、中後段暗紅煙燻座艙罩、車尾往上彎再往後的蛇形尾鰭；黑繪陶的赭紅＋黑釉＋刻線',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 0.8,
  // 平滑剖面：只有肩稜（4）是銳利稜線
  hard: [4],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  canopy: CANOPY,
  sideZMin: 28,
  zones: () => [
    // 黑釉：輪拱外 1.6 mm 一圈（側面赭紅底上的黑色輪拱框）
    { mat: 'black', keep: (x, y, z) => (onSide(x, z) ? 1.6 - archRingDist(x, y) : -1) },
    // 赭紅陶土：整片側壁（肩稜以下）——陶繪的赭紅底；犬身（背、肩、頭）是黑釉，俯視黑、側視赭紅
    { mat: 'clay', keep: (x, y, z) => (onSide(x, z) ? 1 : -1) },
    // 赭紅陶土：前胸（三個犬頭之間的頸根，像陶繪的底色從頸間露出；兩肩前緣維持黑釉）
    { mat: 'clay', keep: (x, y, z) => Math.min(x - 54.5, 27 - Math.abs(z)) },
    { mat: 'black', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 三個犬吻（實體件）：根部埋在前段斜引擎蓋下（x 48 起），從頸根往前下伸出；中間最長（鼻尖 x ≈ 78），兩側 x ≈ 72 ──
    /** @type {THREE.BufferGeometry[]} */
    const heads = [];
    /** @type {THREE.BufferGeometry[]} */
    const noses = [];
    /** @type {THREE.BufferGeometry[]} */
    const eyes = [];
    /** @type {THREE.BufferGeometry[]} */
    const ears = [];
    /** @type {THREE.BufferGeometry[]} */
    const collarsRed = [];
    /** @type {THREE.BufferGeometry[]} */
    const collarsWhite = [];
    /** @type {THREE.BufferGeometry[]} */
    const mouths = [];
    for (const s of SNOUTS) {
      const curve = snoutCurve(s);
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const p = curve.getPointAt(i / 12);
        pts.push([p.x, p.y, p.z]);
      }
      heads.push(smoothNormals(sweepEllipse(pts, 36, (t) => snoutR(s, t), 20)));
      // 鼻頭：犬吻尖端的黑色小圓
      const tip = curve.getPointAt(1);
      const tipR = snoutR(s, 1);
      const nose = new THREE.SphereGeometry(1, 14, 10);
      nose.scale(1.5, tipR[1] * 0.8, tipR[0] * 0.9);
      nose.translate(tip.x + 0.2, tip.y + 0.3, tip.z);
      noses.push(nose);
      // 眼睛（白色加彩）：頭骨兩側
      const pe = curve.getPointAt(0.56);
      const re = snoutR(s, 0.56);
      for (const sg of [-1, 1]) {
        const e = new THREE.SphereGeometry(1, 12, 8);
        e.scale(1.3, 0.8, 0.6);
        e.translate(pe.x, pe.y + 0.35 * re[1], pe.z + sg * 0.86 * re[0]);
        eyes.push(e);
      }
      // 嘴線（深紅細條，犬吻兩側往後上斜）
      const m0 = curve.getPointAt(0.62);
      const m1 = curve.getPointAt(0.96);
      const r0 = snoutR(s, 0.62);
      const r1 = snoutR(s, 0.96);
      for (const sg of [-1, 1]) {
        mouths.push(sweepEllipse([[m0.x, m0.y - 0.35 * r0[1], m0.z + sg * 0.88 * r0[0]], [m1.x, m1.y - 0.4 * r1[1], m1.z + sg * 0.84 * r1[0]]], 6, () => [0.35, 0.35], 8));
      }
      // 耳朵：頭骨後上方一對往後上的短三角板（厚 1.2，往外 18°）
      const pk = curve.getPointAt(0.4);
      const rk = snoutR(s, 0.4);
      for (const sg of [-1, 1]) {
        const y0 = pk.y + 0.7 * rk[1];
        ears.push(finPlate([[pk.x + 2.6, y0 - 0.6], [pk.x - 2.4, y0 - 0.6], [pk.x - 3.4, y0 + 3.6]], pk.z + sg * 0.5 * rk[0], 1.2, -sg * 18));
      }
      // 項圈（頸部）：深紅寬環＋白色細環（陶繪加彩）
      for (const [t, mat, w] of [[0.24, collarsRed, 1.1], [0.3, collarsWhite, 0.55]]) {
        const pc = curve.getPointAt(t);
        const rc = snoutR(s, t);
        // 細環（管徑 0.12 × 半徑，約 0.6 mm 凸出犬頸表面）；沿 x 的厚度 = w
        const ring = new THREE.TorusGeometry(1, 0.12, 8, 36);
        ring.scale(rc[0] + 0.1, rc[1] + 0.1, w / 2 / 0.12);
        ring.rotateY(Math.PI / 2);
        ring.translate(pc.x, pc.y, pc.z);
        mat.push(ring);
      }
    }
    parts.push({ geometry: mergeGeos(heads), mat: 'black2', solid: true, outline: true, name: 'snouts' });
    parts.push({ geometry: mergeGeos(noses), mat: 'nose', solid: true, outline: true, name: 'snout-noses' });
    parts.push({ geometry: mergeGeos(eyes), mat: 'addedWhite', solid: true, name: 'snout-eyes' });
    parts.push({ geometry: mergeGeos(mouths), mat: 'addedRed', solid: true, name: 'snout-mouth-lines' });
    parts.push({ geometry: mergeGeos(ears), mat: 'black2', solid: true, outline: true, name: 'snout-ears' });
    parts.push({ geometry: mergeGeos(collarsRed), mat: 'addedRed', solid: true, name: 'collars-red' });
    parts.push({ geometry: mergeGeos(collarsWhite), mat: 'addedWhite', solid: true, name: 'collars-white' });

    // ── 蛇形尾鰭（尾翼，實體件）：扁平斷面（左右 1.2、上下 3.4），從背上往上彎再往後；尾端蛇頭；尾下一片鰭膜連到背上 ──
    parts.push({
      geometry: smoothNormals(sweepEllipse(TAIL_PATH, 40, (t) => [lerp(1.2, 0.85, t), lerp(3.4, 1.6, t)], 16)),
      mat: 'black2',
      solid: true,
      outline: true,
      name: 'serpent-tail',
    });
    {
      // 鰭膜（厚 1.2）：蛇尾下緣到背脊之間的薄板，讓蛇尾讀成尾鰭而不是提把
      const curve = new THREE.CatmullRomCurve3(TAIL_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
      /** @type {number[][]} */
      const outline = [];
      for (let i = 2; i <= 16; i++) {
        const t = 0.12 + (0.7 * i) / 16;
        const p = curve.getPointAt(t);
        outline.push([p.x, p.y - lerp(3.4, 1.6, t) * 0.5]);
      }
      const xEnd = outline[outline.length - 1][0];
      const xStart = outline[0][0];
      outline.push([xEnd + 0.6, kit.surf.topY(xEnd + 0.6, 0) - 1]);
      outline.push([xStart, kit.surf.topY(xStart, 0) - 1]);
      parts.push({ geometry: finPlate(outline.reverse(), 0, 1.2), mat: 'black2', solid: true, outline: true, name: 'serpent-fin-web' });
    }
    {
      const g = new THREE.SphereGeometry(1, 18, 12);
      g.scale(2.4, 1.5, 1.7);
      g.rotateZ(0.12);
      g.translate(-69.4, 38.1, 0);
      parts.push({ geometry: g, mat: 'black2', solid: true, outline: true, name: 'serpent-head' });
      const eye = new THREE.SphereGeometry(0.55, 10, 8);
      eye.scale(1, 1, 0.6);
      parts.push({
        geometry: mergeGeos([-1, 1].map((sg) => eye.clone().translate(-70, 38.7, sg * 1.45))),
        mat: 'addedWhite',
        solid: true,
        name: 'serpent-eyes',
      });
    }
    // 尾鰭上的赭紅刻線鱗紋（沿尾鰭兩側一列小環）：做成細薄環片
    {
      const curve = new THREE.CatmullRomCurve3(TAIL_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
      /** @type {THREE.BufferGeometry[]} */
      const bands = [];
      for (const t of [0.22, 0.4, 0.58, 0.76]) {
        const p = curve.getPointAt(t);
        const tg = curve.getTangentAt(t);
        const ring = new THREE.TorusGeometry(1, 0.2, 6, 28);
        ring.scale(lerp(1.2, 0.85, t) + 0.1, lerp(3.4, 1.6, t) + 0.1, 1);
        // 環面法線對齊尾鰭切線
        ring.rotateY(Math.PI / 2);
        ring.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.atan2(tg.y, tg.x)));
        ring.translate(p.x, p.y, p.z);
        bands.push(ring);
      }
      parts.push({ geometry: mergeGeos(bands), mat: 'clay2', solid: true, name: 'serpent-bands' });
    }

    // 輪拱內襯（前後，R15.2）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(a, 2.2))), mat: 'liner', shell: true, name: 'arch-liners' });

    // ── 貼紙（黑繪陶紋樣）──
    // 回紋飾帶：側壁下段赭紅帶上的黑色鉤形回紋（線寬 0.6 mm），帶上下各一條黑邊線
    /** @type {(u: number, v: number) => number} u = 往前為正的 x、v = 高度 */
    const frieze = (u, v) => {
      if (archRingDist(u, v) < 2.4 || u > 52 || u < -64) {
        return 1;
      }
      const edgeLines = Math.min(Math.abs(v - FRIEZE.y0 + 0.2), Math.abs(v - FRIEZE.y1 - 0.2)) - 0.3;
      const key = v > FRIEZE.y0 + 0.4 && v < FRIEZE.y1 - 0.4 ? meanderSd(u + 64, v - (FRIEZE.y0 + 0.9), 1.05) : 1;
      return Math.min(edgeLines, key);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(frieze, { x0: 0, y0: 0, zMin: 28, side: 1 }), { offset: 0.1 }),
        kit.decal(sideDecal((u, v) => frieze(-u, v), { x0: 0, y0: 0, zMin: 28, side: -1 }), { offset: 0.1 }),
      ]),
      mat: 'dBlack',
      name: 'decal-meander-frieze',
    });
    // 頸部項圈帶（殼面）：前胸頸根處一道深紅寬帶＋白點列（陶繪加彩）
    parts.push({ geometry: kit.decal((x) => 1.4 - Math.abs(x - 51), { offset: 0.1 }), mat: 'dRed', name: 'decal-collar-band' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const ph = ((Math.abs(z) % 3.2) + 3.2) % 3.2;
        return 0.5 - Math.hypot(x - 51, Math.min(ph, 3.2 - ph));
      }, { offset: 0.16 }),
      mat: 'dWhite',
      name: 'decal-collar-dots',
    });
    // 黑線（赭紅側壁上）：肩肌弧線＋臀部弧線＋肋線
    /** @type {(u: number, v: number) => number} */
    const muscle = (u, v) => {
      const shoulder = Math.abs(Math.hypot(u - 40, (v - 13) * 1.15) - 19.6) - 0.32;
      const haunch = Math.abs(Math.hypot(u + 40, (v - 13) * 1.15) - 19.6) - 0.32;
      const ribs = Math.min(...[-14, -8, -2, 4].map((xr) => Math.max(Math.abs(u - xr - 0.35 * (v - 22)) - 0.3, Math.abs(v - 22.6) - 3.2)));
      return Math.max(Math.min(shoulder, haunch, ribs), FRIEZE.y1 + 1.6 - v);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(muscle, { x0: 0, y0: 0, zMin: 28, side: 1 }), { offset: 0.1 }),
        kit.decal(sideDecal((u, v) => muscle(-u, v), { x0: 0, y0: 0, zMin: 28, side: -1 }), { offset: 0.1 }),
      ]),
      mat: 'dBlack',
      name: 'decal-muscle-lines',
    });
    // 刻線：背上兩條波浪（蛇鬃——典籍說背上長滿蛇頭），從頸根沿座艙兩側到尾根
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > 46 || x < -52 || y < 26) {
          return -1;
        }
        const zc = 16.5 + 1.6 * Math.sin((x + 52) / 3.1);
        return 0.32 - Math.abs(Math.abs(z) - zc);
      }, { offset: 0.1 }),
      mat: 'dIncised',
      name: 'decal-incised-serpent-mane',
    });
    // 蛇鬃上的蛇頭點（白色加彩小點，每 12 mm 一顆）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > 44 || x < -48 || y < 26) {
          return -1;
        }
        const ph = (((x + 48) % 12) + 12) % 12;
        const xc = x - ph + 6;
        const zc = 16.5 + 1.6 * Math.sin((xc + 52) / 3.1);
        return 0.55 - Math.hypot(x - xc, Math.abs(z) - zc);
      }, { offset: 0.16 }),
      mat: 'dWhite',
      name: 'decal-serpent-mane-dots',
    });
    // 尾燈：車尾封口上方兩段紅色細帶
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(-69.6 - x, 0.9 - Math.abs(y - 22.5), Math.abs(z) - 8, 22 - Math.abs(z))),
      mat: 'tail',
      name: 'lamp-tail',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：車殼外框長 151.5（蛇頭 x −71.8 → 中間犬吻鼻尖 79.7）、殼頂 32、座艙罩頂約 40、蛇尾鰭頂 41.4；俯視楔形：肩寬 96.6、後輪上方 58（後輪外側露出）；SPEC 1.14a 車殼外框長 ≤ 153 mm',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm，同 owl-hush / mantis-scythe），cutZFrom 23.8；只對應 26 mm 輪（低車身）',
    snouts: '三個犬吻、耳、項圈、蛇形尾鰭為實心 ABS 件，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 只複製既有欄位：神話組分組欄位（mythSeries / mythTheme）在這裡補進 BodyDef
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const cerberusTriheadBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
