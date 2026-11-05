// 三頭犬（body-cerberus-trihead，第八階段神話組・希臘；第十階段 iter-128 從頭重塑成 LG1 F2 擋泥板肌肉型）：
// 三頭犬的「三」變成車身形狀——中央鼻錐最長（中間的犬吻，伸到 x 72），左右前擋泥板各往前伸出一個較短的犬吻量體（到 x 64），
// 俯視是三根往前的吻部，中間最長；吻端只有亮面黑鼻墊與餘燼色眼縫，不做公仔狗頭。
// 四輪擋泥板各自鼓起成肩 / 臀，中段收腰，中央一條隆起的直脊（不是 V 形）；座艙罩在中段、壓低的暗紅煙燻罩。
// 大件：蛇尾——從座艙後方沿背脊往後、在車尾往右側甩出的貼身蛇尾擴散器唇（扁平斷面、尾端收成楔形蛇頭），全車最低的尾部、沒有架高翼。
// 設計：shared/design/body-cerberus-trihead/DESIGN.md（「第十階段重塑（iter-128）」節；MYTH_RESEARCH G3–G5、G12：羅浮宮 E 701 卡厄瑞水罐、
// 《書庫》2.122 的「三個犬頭、蛇尾」、黑繪技法）。
// 塗裝：黑繪陶風格——赭紅陶土（霧面）車身＋半光澤黑釉的四個擋泥板量體與三個犬吻、刻線、白 / 深紅加彩、回紋飾帶；
// 不用 Black Saber 的黑＋紅灰＋金座艙組合，也沒有架高尾翼與端板；全為自創，不含任何文字或商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-65, -61, -55, -48, -40, -30, -18, -4, 10, 24, 34, 42, 50, 56, 62, 68, 72];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬：後擋泥板（臀）±43.8、收腰 ±28（x −18 ~ −4）、前擋泥板（肩）±44（前寬後窄的猛獸胸）；前擋泥板在 x 44 後急收，只留中央犬吻往前伸到 ±4
  hw: monoCurve(XS, [25, 34, 41.5, 43.6, 43.8, 39.5, 28.5, 28, 33, 40.5, 44, 43.6, 24, 12, 9.5, 7.2, 4.5]),
  // 中央直脊頂
  yC: monoCurve(XS, [26.5, 28, 29.6, 30.4, 30.6, 30.2, 29.6, 29.4, 29.6, 30.2, 30.8, 30.4, 28.4, 25.4, 22.6, 20.2, 18.6]),
  // 擋泥板拱頂（在 0.76 半寬處）：前後輪上方鼓起，比中央脊高 → 四個角的量體
  yF: monoCurve(XS, [25, 28, 31.6, 33.4, 33.6, 32, 28.8, 28, 28.6, 31.6, 33.8, 34, 32, 25, 22, 19.6, 18.2]),
  // 肩線（拱頂外側銳利稜線）：擋泥板處高、收腰處低
  yE: monoCurve(XS, [22.5, 25, 29, 30.8, 31, 29, 24.6, 23.4, 24, 28.6, 31.2, 31.4, 29, 22.6, 20, 18.4, 17.4]),
  // 側壁下緣
  yLow: monoCurve(XS, [19, 17, 14.4, 13, 12.6, 12.5, 12.5, 12.5, 12.5, 12.5, 12.6, 13, 13.8, 14.6, 15.2, 15.6, 16]),
};

/**
 * 半剖面 8 點：中央直脊（3 點）→ 擋泥板拱頂（2 點）→ 肩稜（銳利）→ 側壁 → 側壁下緣（內收）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yF = P.yF(x);
  const yE = P.yE(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const yValley = Math.min(yC - 1.1, yF - 0.4);
  return [
    [0, yC],
    [0.06 * hw, yC - 0.3],
    [0.14 * hw, yValley],
    [0.45 * hw, lerp(yValley, yF, 0.7)],
    [0.76 * hw, yF],
    [hw, yE],
    [hw, lerp(yE, yLow, 0.55)],
    [hw - 0.8, yLow],
  ];
};

const STATIONS = buildStations(-65, 72, 1.5, profile);

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 側壁（肩稜以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 0.3;

/** @type {(x: number, z: number) => boolean} 擋泥板量體（拱頂 0.3 半寬以外、前後輪 ±20 mm 內） */
const onFender = (x, z) => Math.abs(z) > 0.34 * P.hw(x) && (Math.abs(x - 40) < 21 || Math.abs(x + 40) < 21 || x > 56);

/** 回紋飾帶（收腰段側壁上的黑色回紋）：帶的上下緣高度 */
const FRIEZE = { y0: 14.2, y1: 19.2 };

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
  // 黑釉：黑繪陶的半光澤黑（iter-113 改緞面 roughness 0.56：原 0.3 亮面在 Blender 出現大片波浪反光），赭紅陶土為霧面
  black: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.4 }),
  black2: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.4, side: THREE.DoubleSide }),
  clay: namedMaterial('paint-terracotta-clay', { color: 0xc0623a, roughness: 0.72, clearcoat: 0.0 }),
  clay2: namedMaterial('paint-terracotta-clay', { color: 0xc0623a, roughness: 0.72, clearcoat: 0.0, side: THREE.DoubleSide }),
  // 加彩：深紅（項圈）、白（眼、項圈細環）——陶繪加彩是霧面礦物顏料
  addedRed: namedMaterial('paint-added-red', { color: 0x7e2220, roughness: 0.66, clearcoat: 0.05 }),
  addedWhite: namedMaterial('paint-added-white', { color: 0xeee6d6, roughness: 0.6, clearcoat: 0.05 }),
  // 鼻墊：全車唯一的亮面黑（和緞面黑釉的犬頭做出光澤對比）
  nose: namedMaterial('paint-nose-gloss-black', { color: 0x0b0a0a, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
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
  // iter-121（材質與發光）：犬眼改成冥府餘燼色自發光（強度低，Blender 不過曝）
  eyeGlow: namedMaterial('lamp-ember-eye', { color: 0xff8a3a, emissive: 0xd8501a, emissiveIntensity: 0.8, roughness: 0.3, clearcoat: 0.6 }),
  // iter-121 第二版：側面進氣口內緣的餘燼色發光線（貼紙）
  dEmber: decalMaterial('decal-ember-glow', { color: 0xff7a2a, emissive: 0xd8501a, emissiveIntensity: 0.8, roughness: 0.4 }),
  // iter-124：進氣口凹口內面（比黑釉更暗的霧面黑）與口內導流柵（槍灰）
  dVoid: decalMaterial('decal-intake-void', { color: 0x040303, roughness: 0.95 }),
  dLouver: decalMaterial('decal-intake-louver', { color: 0x55504c, roughness: 0.45 }),
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

/** 座艙罩（暗紅煙燻，收腰段正上方）：x 14 → −22 */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(14, -22, u);
      const halfW = i === 0 || i === n ? 2.2 : 9 * Math.sin(Math.PI * u ** 0.85) ** 0.55;
      const rise = 5.2 * Math.sin(Math.PI * u ** 0.7) ** 0.6;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {number[][]} 蛇尾中心線：座艙後方沿背脊往後，車尾往右側（+z）甩出、微微上翹（貼身擴散器唇） */
const TAIL_PATH = [
  [-24, 29.6, 0],
  [-34, 30.2, 0.6],
  [-44, 30.8, -1.8],
  [-53, 30.6, -4.2],
  [-58, 29.8, 0.5],
  [-62, 28.8, 9],
  [-65.2, 28.6, 19],
  [-66.6, 29.4, 28],
];

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
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
  theme: '三吻擋泥板肌肉車：中央鼻錐與左右前擋泥板各伸出一個犬吻（中間最長）、四輪擋泥板鼓成肩與臀、中段收腰、中央直脊；收腰上方壓低的暗紅煙燻座艙罩；從背脊往車尾右側甩出的貼身蛇尾擴散器唇；赭紅陶土車身＋黑釉量體＋回紋',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 0.8,
  // 肩稜（5）是銳利稜線
  hard: [5],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  canopy: CANOPY,
  sideZMin: 28,
  zones: () => [
    // 黑釉：輪拱外 1.6 mm 一圈
    { mat: 'black', keep: (x, y, z) => (onSide(x, z) ? 1.6 - archRingDist(x, y) : -1) },
    // 赭紅陶土：側壁
    { mat: 'clay', keep: (x, y, z) => (onSide(x, z) ? 1 : -1) },
    // 黑釉：四個擋泥板量體與中央犬吻（黑繪陶的「黑像」）
    { mat: 'black', keep: (x, y, z) => (onFender(x, z) ? 1 : -1) },
    { mat: 'black', keep: (x) => x - 54 },
    // 赭紅陶土：收腰與中央脊兩側
    { mat: 'clay', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 左右犬吻（實體件）：從前擋泥板前緣往前伸的錐形吻部，根部埋進擋泥板，往前下收尖 ──
    /** @type {THREE.BufferGeometry[]} */
    const snouts = [];
    /** @type {THREE.BufferGeometry[]} */
    const noses = [];
    /** @type {THREE.BufferGeometry[]} */
    const eyes = [];
    for (const sg of [-1, 1]) {
      const pts = [
        [46.5, 28.8, sg * 37.2],
        [53, 26, sg * 38.4],
        [59, 23, sg * 39.2],
        [64.5, 20.2, sg * 39.4],
      ];
      snouts.push(sweepEllipse(pts, 14, (t) => [lerp(6, 2.4, t ** 0.9), lerp(3.8, 1.9, t ** 0.9)], 12));
      const nose = new THREE.SphereGeometry(1.5, 12, 8);
      nose.scale(1.2, 1, 1.3);
      nose.translate(64.9, 20.5, sg * 39.4);
      noses.push(nose);
      const eye = new THREE.SphereGeometry(0.7, 10, 6);
      eye.scale(2.4, 0.7, 0.8);
      eye.translate(52, 28.4, sg * 34.6);
      eyes.push(eye);
    }
    // 中央犬吻的鼻墊（殼鼻端）與一對眼縫
    {
      const nose = new THREE.SphereGeometry(1.7, 12, 8);
      nose.scale(1.2, 1, 1.5);
      nose.translate(71.6, 18.4, 0);
      noses.push(nose);
      for (const sg of [-1, 1]) {
        const eye = new THREE.SphereGeometry(0.7, 10, 6);
        eye.scale(2.4, 0.7, 0.8);
        eye.translate(61.6, P.yC(61.6) - 0.6, sg * 5.6);
        eyes.push(eye);
      }
    }
    parts.push({ geometry: smoothNormals(mergeGeos(snouts)), mat: 'black2', solid: true, outline: true, name: 'side-snouts' });
    parts.push({ geometry: mergeGeos(noses), mat: 'nose', solid: true, outline: true, name: 'snout-nose-pads' });
    parts.push({ geometry: mergeGeos(eyes), mat: 'eyeGlow', solid: true, name: 'snout-eye-slits' });

    // ── 蛇尾（大件）：扁平斷面（寬 4.4 → 2.4、高 1.8 → 1.2），沿背脊往後、在車尾往右甩，尾端楔形蛇頭 ──
    parts.push({
      geometry: smoothNormals(sweepEllipse(TAIL_PATH, 40, (t) => [lerp(2.2, 1.3, t), lerp(1.0, 0.7, t)], 10)),
      mat: 'black2',
      solid: true,
      outline: true,
      name: 'serpent-tail',
    });
    {
      const head = new THREE.ConeGeometry(2.6, 6.4, 4);
      head.scale(1, 1, 0.45);
      head.rotateZ(Math.PI / 2);
      // 錐尖朝 −x → 再轉成朝蛇尾末端方向（往後外）
      head.rotateY(-0.55);
      head.translate(-66.2, 29.7, 30.4);
      parts.push({ geometry: head, mat: 'black2', solid: true, outline: true, name: 'serpent-head' });
      const eye = new THREE.SphereGeometry(0.55, 8, 6);
      eye.translate(-65.6, 30.7, 31.6);
      parts.push({ geometry: eye, mat: 'eyeGlow', solid: true, name: 'serpent-eye' });
    }
    // 蛇尾鱗帶（陶土色細環，沿蛇尾每 6 mm 一道）：貼紙做不到 → 用薄環實體件（6 段）
    {
      /** @type {THREE.BufferGeometry[]} */
      const bands = [];
      for (const k of [1, 2, 3, 4, 5]) {
        const [x, y, z] = TAIL_PATH[k];
        const r = new THREE.TorusGeometry(1.9, 0.32, 4, 10);
        r.scale(1, 0.55, 1);
        r.rotateY(Math.PI / 2);
        r.translate(x, y, z);
        bands.push(r);
      }
      parts.push({ geometry: mergeGeos(bands), mat: 'clay2', solid: true, name: 'serpent-bands' });
    }

    // 輪拱內襯（前後，R15.2）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(a, 2.2))), mat: 'liner', shell: true, name: 'arch-liners' });

    // ── 貼紙（黑繪陶紋樣）──
    // 回紋飾帶：收腰段側壁的黑色鉤形回紋，帶上下各一條黑邊線
    /** @type {(u: number, v: number) => number} */
    const frieze = (u, v) => {
      if (archRingDist(u, v) < 2.4 || u > 22 || u < -22) {
        return 1;
      }
      const edgeLines = Math.min(Math.abs(v - FRIEZE.y0 + 0.2), Math.abs(v - FRIEZE.y1 - 0.2)) - 0.3;
      const key = v > FRIEZE.y0 + 0.4 && v < FRIEZE.y1 - 0.4 ? meanderSd(u + 64, v - (FRIEZE.y0 + 0.9), 1.05) : 1;
      return Math.min(edgeLines, key);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(frieze, { x0: 0, y0: 0, zMin: 26, side: 1 }), { offset: 0.1 }),
        kit.decal(sideDecal((u, v) => frieze(-u, v), { x0: 0, y0: 0, zMin: 26, side: -1 }), { offset: 0.1 }),
      ]),
      mat: 'dBlack',
      name: 'decal-meander-frieze',
    });
    // 刻線：黑釉量體邊緣一道陶土色細線（黑繪陶的刻線，讓四個角的量體輪廓清楚）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z) || x > 54) {
          return -1;
        }
        return 0.32 - Math.abs(Math.abs(z) - 0.34 * P.hw(x) - 0.5);
      }, { offset: 0.1 }),
      mat: 'dIncised',
      name: 'decal-incised-fender-line',
    });
    // 頸部項圈帶：三吻根部一道深紅寬帶＋白點列（陶繪加彩）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(1.3 - Math.abs(x - 53), 0.34 * P.hw(x) + 0.3 - Math.abs(z)), { offset: 0.12 }), mat: 'dRed', name: 'decal-collar-band' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const ph = ((Math.abs(z) % 3.2) + 3.2) % 3.2;
        return Math.min(0.5 - Math.hypot(x - 53, Math.min(ph, 3.2 - ph)), 0.34 * P.hw(x) - Math.abs(z));
      }, { offset: 0.16 }),
      mat: 'dWhite',
      name: 'decal-collar-dots',
    });
    // 側面兩層量體：收腰段側壁上緣的黑色進氣口（往前低、往後高）＋餘燼色內緣
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 26, side };
      /** @type {(u: number, v: number) => number} */
      const intake = (u, v) => Math.max(-23 - u, u - 22, v - P.yE(u) + 0.6, lerp(20.8, 19.6, (u + 23) / 45) - v);
      parts.push({ geometry: kit.decal(sideDecal(intake, opt), { offset: 0.14 }), mat: 'dVoid', name: `decal-side-intake-${side}` });
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(-23 - u, u - 22, Math.abs(v - lerp(20.8, 19.6, (u + 23) / 45) + 0.3) - 0.3), opt), { offset: 0.16 }),
        mat: 'dEmber',
        name: `decal-intake-ember-edge-${side}`,
      });
    }
    // 尾燈：車尾左右一對細長紅燈（貼在尾端封口上方）
    {
      /** @type {THREE.BufferGeometry[]} */
      const lamps = [];
      for (const sg of [-1, 1]) {
        const l = new THREE.BoxGeometry(0.8, 1.4, 9);
        l.translate(-64.9, 22.4, sg * 13);
        lamps.push(l);
      }
      parts.push({ geometry: mergeGeos(lamps), mat: 'tail', solid: true, name: 'lamp-tail' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，iter-128 從頭重塑）：殼長 137（−65 ~ 中央犬吻 72，鼻尖不超過第九階段 79.4）；擋泥板拱頂 33.6 / 34、中央直脊 30.8、收腰 28；寬：臀 ±45.5、肩 ±46.5、收腰 ±30',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm）',
    snouts: '左右犬吻：ABS 實心錐形件（橢圓斷面 11.2 × 8.8 → 4.4 × 3.8，推估），根部埋進前擋泥板 x 44，吻端 x 63.6；中央犬吻 = 殼鼻',
    tail: '蛇尾：ABS 扁平斷面實體件（4.4 × 2 → 2.6 × 1.4，推估），貼背脊 y 29.6–30.8，車尾往右甩到 z 28；楔形蛇頭 4 段錐',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

export const cerberusTriheadBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
