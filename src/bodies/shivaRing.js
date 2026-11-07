// 舞王火環（body-shiva-ring，神話組・印度）：只用舞王（Nataraja）銅像上的「物」——火焰光環（prabhamandala）、髮間新月、手中的沙漏形達瑪如鼓。
// 不做神像、人形、臉、手、第三隻眼，也不做三叉戟。照四視圖 24 建模：
// (1) 火焰環 → 車尾一圈平放的環形尾翼：金色環帶，外緣一圈往外竄的橘焰舌；兩支從後翼子板順勢長出、往後上方彎起的紫色弧形支柱把環托在車尾上方；
// (2) 新月 → 鼻部弧線：前擋泥板是左右兩團隆起、中間夾一道低谷，正視是一道往上彎的新月；鼻段中央低谷再立一枚角尖往上翹的金色新月鰭；
// (3) 達瑪如鼓 → 側艙收腰：俯視是前後兩端寬、中段收細的沙漏形，側面進氣口畫成兩個尖對尖的三角形（鼓身的剪影）；
// (4) 配色：鼻段橘焰，往車尾經洋紅漸層到紫金屬漆（主色），一排往後竄的番紅火舌細線；金（環帶、新月、肩線）。
// 姿態：鼻尖低而尖，前擋泥板兩團肩部量體罩住前輪，座艙後背線緩升到車尾，火焰環是全車最高點——前低後高的楔形。
// 設計：shared/design/body-shiva-ring/DESIGN.md（文物來源與四視圖對照）。剖面為本檔站位產生器（推估）。不含任何文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -70;
/** @type {number} 鼻尖 x */
const X_NOSE = 77.5;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-70, -66, -58, -48, -40, -30, -20, -8, 4, 16, 26, 34, 42, 50, 56, 62, 68, 72, 77.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬：沙漏形——前輪上方 40 外擴的鼓面（下緣抬到 18，只是一圈外擴的擋泥板）、兩輪之間收到 22.5（鼓腰，下緣抬高到 17，側裙在底盤側面零件上方）、後輪段 28.5（胎面外露，車尾的寬度交給火焰環），鼻段收成長尖鼻
  hw: monoCurve(XS, [15, 20, 24, 26, 25, 24.5, 23.5, 23, 22.5, 23, 27, 35, 43, 39.5, 28, 18.5, 11.5, 8, 4.5]),
  // 中線頂：前段是兩團擋泥板之間的低谷，座艙段 34，車尾 30
  yC: monoCurve(XS, [30, 31.5, 32.5, 33, 33, 33.5, 34, 34, 33.5, 32.5, 31, 29.5, 28.5, 27, 25.5, 23, 19.5, 17, 13]),
  // 擋泥板峰線（z ≈ 0.8 半寬）：前輪上方 34 高過中線 5.5（新月的兩角），車身段略低於中線
  yP: monoCurve(XS, [29.5, 31, 32, 32.5, 32.5, 32.5, 32.5, 32, 31.5, 31.5, 32.5, 33.5, 34, 33.5, 32, 28.5, 24, 20.5, 14.5]),
  // 肩線（銳利）：前後輪上方 ≥ 32，高過 R17.5 輪拱頂 30.5
  yS: monoCurve(XS, [28, 30, 31, 31.8, 32, 31.5, 30.5, 29.5, 29, 29, 30.5, 32, 32.3, 31.5, 29.5, 26, 22, 18.5, 14]),
  // 側裙下緣：後輪前方 11（底盤側框 ≥ 9.9），鼓腰段抬高到 17，車尾抬高
  yLow: monoCurve(XS, [18, 16, 13, 12, 11.5, 11, 11, 11, 11, 11.5, 12.5, 14, 16, 16, 14, 13, 13, 13, 13]),
};

/**
 * 側面腰線（銳利）：肩線與下緣之間 42% 處，以下內收 1.2 mm
 * @type {(x: number) => number}
 */
const yWaist = (x) => lerp(P.yLow(x), P.yS(x), 0.42);

/** @type {number} 兩輪之間側箱的半寬：蓋過底盤中段側壁（半寬 27） */
const POD_W = 27.3;
/** @type {(x: number) => number} 腰線以下側箱的半寬：兩輪之間 POD_W，x ±30 → ±36 退回殼面半寬（兩端藏進輪拱） */
const podW = (x) => Math.max(P.hw(x), lerp(P.hw(x), POD_W, 1 - smoothstep(30, 36, Math.abs(x))));

/**
 * 半剖面 8 點：中線 → 擋泥板峰 → 肩線（銳利）→ 側壁 → 腰線（銳利）→ 往外伸的側箱頂緣（銳利）→ 側箱下緣
 * 兩輪之間腰線以下外伸成側箱，把底盤側壁整段蓋住；俯視上半車身仍是沙漏形收腰
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const h = P.hw(x);
  const yC = P.yC(x);
  const yP = P.yP(x);
  const yS = P.yS(x);
  const pod = podW(x);
  return [
    [0, yC],
    [0.45 * h, lerp(yC, yP, 0.62)],
    [0.8 * h, yP],
    [h - 0.8, yS],
    [h, lerp(yS, yWaist(x), 0.4)],
    [h - 0.2, yWaist(x)],
    [Math.max(h - 0.6, pod), lerp(yWaist(x), P.yLow(x), 0.12)],
    [Math.max(h - 1.4, pod - 0.6), P.yLow(x)],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 站位表：車尾與鼻段每 1.5 mm、中段每 2.5 mm */
const STATIONS = [...buildStations(X_TAIL, -62, 1.5, profile).slice(0, -1), ...buildStations(-62, 62, 2.5, profile).slice(0, -1), ...buildStations(62, X_NOSE, 1.5, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23 },
];

/** @type {{ xc: number, y: number, a: number, b: number, ai: number, bi: number }} 火焰環：中心 x −48、環帶底 44.5；外橢圓半軸 24 × 28、內孔 15 × 18.5（全車的主角，俯視是車尾一個大圓） */
const RING = { xc: -48, y: 44.5, a: 24, b: 28, ai: 15, bi: 18.5 };
/** @type {number} 焰舌數（奇數：車尾正中是一支焰舌） */
const FLAME_N = 17;
/** @type {number} 焰舌伸出環帶外緣的長度 */
const FLAME_H = 3.6;

/**
 * 環上一點：參數角 t、徑向倍率 k（1 = 外橢圓）、徑向外加 d mm
 * @type {(t: number, a: number, b: number, d: number) => number[]}
 */
const ellPt = (t, a, b, d) => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const nx = b * c;
  const nz = a * s;
  const nl = Math.hypot(nx, nz);
  return [RING.xc + a * c + (d * nx) / nl, b * s + (d * nz) / nl];
};

/**
 * 焰舌外形：每支焰舌在一個週期內由兩側內凹的弧線收成尖端，尖端往車尾偏（火往後竄）
 * @type {(t: number) => number}
 */
const flameOffset = (t) => {
  const u = (((t / (2 * Math.PI)) * FLAME_N) % 1 + 1) % 1;
  // 尖端偏在週期 0.62 處：前緣較長、後緣較陡
  const tip = 0.62;
  const q = u < tip ? u / tip : (1 - u) / (1 - tip);
  return FLAME_H * q ** 2.2;
};

/**
 * 水平厚板（含內孔）：外形與孔 (x, z) 沿 y 擠出，四周倒角
 * @type {(outer: number[][], hole: number[][] | null, yBottom: number, thick: number, bev: number) => THREE.BufferGeometry}
 */
const slabWithHole = (outer, hole, yBottom, thick, bev) => {
  const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
  if (hole) {
    shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1, curveSegments: 1 });
  // (X, Y, Z) → (X, Z, −Y)：形狀平面轉成水平，厚度朝上
  g.rotateX(-Math.PI / 2);
  g.translate(0, yBottom + bev, 0);
  return g;
};

/** @type {number} 環上取樣數 */
const RING_SEG = FLAME_N * 6;

/** @type {(a: number, b: number, d: (t: number) => number, reverse?: boolean) => number[][]} 一圈橢圓（可加徑向外偏） */
const loop = (a, b, d, reverse = false) => {
  const out = [];
  for (let i = 0; i < RING_SEG; i++) {
    const t = (2 * Math.PI * i) / RING_SEG;
    out.push(ellPt(t, a, b, d(t)));
  }
  return reverse ? out.reverse() : out;
};

/** @type {() => THREE.BufferGeometry} 金色環帶（厚 1.3） */
const buildRingBand = () => slabWithHole(loop(RING.a, RING.b, () => 0), loop(RING.ai, RING.bi, () => 0, true), RING.y, 1.3, 0.35);
/** @type {() => THREE.BufferGeometry} 橘焰圈：環帶正下方一片外緣帶焰舌的薄環（厚 0.9），內緣藏在環帶底下 */
const buildFlameRing = () => slabWithHole(loop(RING.a, RING.b, flameOffset), loop(RING.a - 3, RING.b - 3, () => 0, true), RING.y - 0.75, 0.9, 0.25);

/**
 * 弧形支柱中心線：三次貝茲曲線 (x, y, |z|)，從後輪前方的肩部（埋進殼面）往後貼著翼子板低低拉出，再往上彎進環帶底面
 * @type {number[][]}
 */
const STRUT_CTRL = [
  [-19, 30.2, 22.5],
  [-33, 31.2, 23.5],
  [-38, 42.5, 24.5],
  [-49, 44.4, 25.5],
];

/**
 * 一支弧形支柱：沿 STRUT_CTRL 掃掠扁橢圓斷面（z 向半寬 1.4、弧面內半高 3.8 → 2），左右對稱
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildStrut = (sg) => {
  const [p0, p1, p2, p3] = STRUT_CTRL;
  /** @type {number[][]} */
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const u = 1 - t;
    const w = [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3];
    const q = [0, 1, 2].map((k) => w[0] * p0[k] + w[1] * p1[k] + w[2] * p2[k] + w[3] * p3[k]);
    pts.push([q[0], q[1], sg * q[2]]);
  }
  return sweepEllipse(pts, 32, (t) => [1.4, lerp(3.8, 2, t)], 12);
};

/**
 * 新月外形 (x, y)：大圓（圓心 c1、半徑 r1）扣掉偏向一側的小圓（c2、r2），兩角朝小圓那一側
 * @type {(c1: number[], r1: number, c2: number[], r2: number, n: number) => number[][]}
 */
const crescentOutline = (c1, r1, c2, r2, n) => {
  /** @type {(p: number[], c: number[], r: number) => boolean} */
  const inside = (p, c, r) => Math.hypot(p[0] - c[0], p[1] - c[1]) < r;
  /** @type {(c: number[], r: number, t: number) => number[]} */
  const at = (c, r, t) => [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
  // 大圓上落在小圓外的弧：從小圓圓心方向的反面往兩側找邊界角
  const dir = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
  const step = Math.PI / 720;
  let span = 0;
  while (span < Math.PI && !inside(at(c1, r1, dir + Math.PI + span + step), c2, r2)) {
    span += step;
  }
  /** @type {number[][]} */
  const out = [];
  for (let i = 0; i <= n; i++) {
    out.push(at(c1, r1, dir + Math.PI - span + (2 * span * i) / n));
  }
  // 小圓上落在大圓內的弧（由大圓弧終點接回起點）
  const e0 = out[n];
  const e1 = out[0];
  const a0 = Math.atan2(e0[1] - c2[1], e0[0] - c2[0]);
  let a1 = Math.atan2(e1[1] - c2[1], e1[0] - c2[0]);
  while (a1 > a0) {
    a1 -= 2 * Math.PI;
  }
  for (let i = 1; i < n; i++) {
    out.push(at(c2, r2, a0 + ((a1 - a0) * i) / n));
  }
  return out;
};

/** @type {number} 新月鰭跟著鼻段往前下斜的角度（rad） */
const CRESCENT_TILT = -0.22;
/**
 * 鼻段新月鰭的側視外形 (x, y)：立在鼻段中央低谷、兩角朝上的新月（碗底埋進殼面 1 mm），整片跟著鼻段往前下斜
 * @type {number[][]}
 */
const CRESCENT = crescentOutline([58, 29.5], 6, [58, 32.1], 5.4, 18).map(([x, y]) => {
  const dx = x - 58;
  const dy = y - 24.8;
  return [58 + dx * Math.cos(CRESCENT_TILT) - dy * Math.sin(CRESCENT_TILT), 24.8 + dx * Math.sin(CRESCENT_TILT) + dy * Math.cos(CRESCENT_TILT)];
});

/** @type {() => THREE.BufferGeometry} 新月鰭（中線上，厚 1.2） */
const buildCrescent = () => finPlate(CRESCENT, 0, 1.2);

/**
 * 輪拱內襯：輪拱切口後面的一段圓柱面（只取上半圈），z 從側壁內面往內 depth
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 32;
  const a0 = 0.3;
  const a1 = Math.PI - 0.3;
  const pos = [];
  /** @type {(t: number) => number} */
  const zIn = (t) => P.hw(arch.x + r * Math.cos(t)) - 1.8;
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
 * 橘焰與靛藍的分界：中線在 x 30，往兩側每 1 mm 後退 0.55 mm，再加一排往車尾竄的火舌（每 8 mm 一支、深 7 mm）
 * @type {(z: number) => number}
 */
const flameEdgeX = (z) => {
  const az = Math.abs(z);
  const u = ((az / 8) % 1 + 1) % 1;
  const q = 1 - Math.abs(2 * u - 1);
  return 30 - 0.55 * az - 7 * q ** 2.5;
};

/**
 * 達瑪如鼓剪影（側面進氣口）：x −23 → −1 兩個尖對尖的三角形，鼓腰在 x −12；回傳正值 = 剪影內
 * @type {(x: number, y: number) => number}
 */
const damaruSd = (x, y) => {
  const yc = lerp(yWaist(x), P.yS(x), 0.45);
  const half = 5.2 * Math.min(1, Math.abs(x + 12) / 11) + 0.6;
  return Math.min(half - Math.abs(y - yc), 11 - Math.abs(x + 12));
};

/** @type {number} 車身主色：紫金屬漆 */
const VIOLET_HEX = 0x4a2390;
/** @type {THREE.Color[]} 漸層色標：橘焰 → 洋紅 → 紫 */
const GRAD_STOPS = [new THREE.Color(0xe8611c), new THREE.Color(0xc42a6a), new THREE.Color(VIOLET_HEX)];
/** @type {number} 漸層長度（沿 x，mm） */
const GRAD_LEN = 46;
/** @type {(z: number) => number} 漸層起點（平滑的橘焰分界，不含火舌）：中線 x 30，往兩側每 1 mm 後退 0.55 mm */
const gradStartX = (z) => 30 - 0.55 * Math.abs(z);

/**
 * 漸層顏色（線性色彩空間）：從橘焰分界往車尾 GRAD_LEN 內，橘 → 洋紅 → 紫
 * @type {(x: number, y: number, z: number) => number[]}
 */
const gradientColor = (x, y, z) => {
  const t = Math.min(1, Math.max(0, (gradStartX(z) - x) / GRAD_LEN));
  const c = t < 0.5 ? GRAD_STOPS[0].clone().lerp(GRAD_STOPS[1], t * 2) : GRAD_STOPS[1].clone().lerp(GRAD_STOPS[2], t * 2 - 1);
  return [c.r, c.g, c.b];
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  indigo: namedMaterial('paint-shiva-violet-metallic', { color: VIOLET_HEX, roughness: 0.3, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  strut: namedMaterial('paint-shiva-violet-metallic', { color: VIOLET_HEX, roughness: 0.3, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 漸層貼紙：橘 → 洋紅 → 紫（頂點色）
  dGrad: decalMaterial('decal-gradient-orange-violet', { vertexColors: true, roughness: 0.3, metalness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  orange: namedMaterial('paint-flame-orange', { color: 0xe8611c, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  sill: namedMaterial('paint-violet-deep', { color: 0x34176a, roughness: 0.45, metalness: 0.25, clearcoat: 0.4 }),
  // 真金屬：火焰環帶、新月片（Blender 依 -brass 結尾換成金屬）
  gold: namedMaterial('trim-gold-brass', { color: 0xd9a93a, roughness: 0.3, metalness: 0.85, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 焰舌：橘焰亮漆，低強度自發光
  flame: namedMaterial('lamp-flame-tongue', { color: 0xff7a1f, emissive: 0xff5a10, emissiveIntensity: 0.35, roughness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide }),
  lamp: namedMaterial('lamp-slit-white', { color: 0xfff1d6, emissive: 0xffe2b0, emissiveIntensity: 0.5, roughness: 0.2, clearcoat: 0.8 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1228, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-violet', { color: 0x2c1858, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x111114, roughness: 0.6 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x15151c, roughness: 0.05, specularIntensity: 0.7, transparent: true, opacity: 0.82, envMapIntensity: 0.6, depthWrite: false }),
  dGold: decalMaterial('decal-gold-leaf', { color: 0xe3b84e, roughness: 0.3, metalness: 0.7 }),
  dVent: decalMaterial('decal-vent-black', { color: 0x0d0c1a, roughness: 0.7 }),
  dSaffron: decalMaterial('decal-saffron', { color: 0xffa630, roughness: 0.4 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-indigo', { color: 0x16143f, roughness: 0.7, side: THREE.DoubleSide }),
});

export const shivaRingBody = makePolyBody({
  id: 'body-shiva-ring',
  name: '舞王火環',
  style: 'myth',
  phase: 13,
  mythSeries: 'hindu',
  mythTheme: 'shiva',
  form: 'damaru-waist',
  roof: 'canopy',
  wing: 'flame-ring',
  theme: '舞王銅像的火焰光環、新月與達瑪如鼓，不做神像：車尾一圈平放的金色火焰環（外緣 17 支橘焰舌）由兩片焰形支柱架起，是全車最高點；前擋泥板兩團隆起夾一道低谷，正視是往上彎的新月，鼻段中央低谷立一枚金色新月鰭；俯視是沙漏形的鼓腰，側面進氣口是兩個尖對尖的三角形；靛藍金屬漆配橘焰鼻段（往後竄的火舌分界）與金',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面：肩線（3）與腰線（5）是銳利稜線
  hard: [3, 5, 6],
  step: 0.68,
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 座艙罩：x 31 → −20，最寬 12、最高 6.5（罩頂約 40.5），前端收尖
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(31, -20, u);
        const halfW = i === 0 || i === n ? 2 : 12 * Math.sin(Math.PI * u ** 1.25) ** 0.6;
        const rise = 6.5 * Math.sin(Math.PI * u ** 1.15) ** 0.7;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 20,
  zones: () => [
    // 下裙（腰線以下）：深紫半霧面
    { mat: 'sill', keep: (x, y) => yWaist(x) - 0.05 - y },
    // 橘焰：鼻段（往車尾接漸層貼紙）
    { mat: 'orange', keep: (x, y, z) => x - gradStartX(z) },
    { mat: 'indigo', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'orange' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'sill', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({
      geometry: mergeGeos([buildLiner(ARCHES[0], 3.5), buildLiner(ARCHES[1], 3.5)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 火焰環：金色環帶＋下方一圈焰舌
    parts.push({ geometry: buildRingBand(), mat: 'gold', solid: true, outline: true, name: 'flame-ring-band' });
    parts.push({ geometry: buildFlameRing(), mat: 'flame', solid: true, outline: true, name: 'flame-ring-tongues' });
    // 弧形支柱（車身紫，左右各一）：從後翼子板順勢長出，托住環帶
    parts.push({ geometry: mergeGeos([buildStrut(1), buildStrut(-1)]), mat: 'strut', solid: true, outline: true, name: 'ring-struts' });
    // 鼻段新月鰭
    parts.push({ geometry: buildCrescent(), mat: 'gold', solid: true, outline: true, name: 'nose-crescent' });

    /** @type {(x: number, z: number) => boolean} 在側壁上（肩線以外） */
    const onSide = (x, z) => Math.abs(z) > P.hw(x) - 1.2;
    // 橘到紫的漸層：腰線以上、橘焰分界往後 GRAD_LEN（含座艙罩以外的頂面與側壁）
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          if (y < yWaist(x) + 0.05) {
            return -1;
          }
          const d = gradStartX(z) - x;
          return Math.min(d + 0.5, GRAD_LEN + 1 - d);
        },
        { offset: 0.03, color: gradientColor },
      ),
      mat: 'dGrad',
      name: 'decal-gradient-orange-violet',
    });
    // 肩線下方的金色細線（從鼻段一路到車尾）
    parts.push({
      geometry: kit.decal((x, y, z) => (!onSide(x, z) || x < X_TAIL + 1.5 || x > X_NOSE - 3 ? -1 : 0.32 - Math.abs(y - (P.yS(x) - 1.3)))),
      mat: 'dGold',
      name: 'decal-shoulder-gold',
    });
    // 橘焰分界的番紅細邊（火舌外緣一道亮邊）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < yWaist(x) + 0.3 || kit.underCanopy(x, z) > -0.6) {
          return -1;
        }
        const d = x - flameEdgeX(z);
        return d < 0 ? -1 : 0.9 - d;
      }),
      mat: 'dSaffron',
      name: 'decal-flame-edge',
    });
    // 達瑪如鼓進氣口：番紅色剪影上幾道黑色橫縫＋金邊
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x < -24 || x > 0) {
          return -1;
        }
        return damaruSd(x, y) - 0.5;
      }),
      mat: 'dSaffron',
      name: 'decal-damaru-fill',
    });
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          if (!onSide(x, z) || x < -24 || x > 0) {
            return -1;
          }
          const yc = lerp(yWaist(x), P.yS(x), 0.45);
          const slat = 0.45 - Math.abs((((y - yc + 1) % 2) + 2) % 2 - 1);
          return Math.min(damaruSd(x, y) - 1.1, slat);
        },
        { offset: 0.12 },
      ),
      mat: 'dVent',
      name: 'decal-damaru-slats',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x < -24 || x > 0) {
          return -1;
        }
        const s = damaruSd(x, y);
        return Math.min(s, 0.5 - s);
      }),
      mat: 'dGold',
      name: 'decal-damaru-rim',
    });
    // 細縫頭燈：前擋泥板前緣、峰線外側的一對斜長光條
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          if (x < 60 || x > 68 || onSide(x, z)) {
            return -1;
          }
          const zc = P.hw(x) * 0.78 - (x - 60) * 0.25;
          return 0.75 - Math.abs(Math.abs(z) - zc);
        },
        { offset: 0.14 },
      ),
      mat: 'lamp',
      name: 'lamp-nose-slits',
    });
    // 車身頂面：環下車尾甲板的一圈金色細環（火焰環投影，呼應頂上的環）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z) || x < X_TAIL + 2) {
          return -1;
        }
        const r = Math.hypot((x - RING.xc) / 10, z / 13.5);
        return 0.07 - Math.abs(r - 1);
      }),
      mat: 'dGold',
      name: 'decal-deck-ring',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P（推估），比例取自四視圖 24（shared/design/body-shiva-ring/fourview_trace.txt）縮到底盤：鼻尖 x 77.5（離地 13）、車尾 −70；沙漏平面半寬 後輪 28.5 / 鼓腰 22.5 / 前輪 40（鼓面）；肩線 32 高過 R17.5 輪拱；座艙罩頂約 40.5；火焰環頂 45.8（全車最高）',
    wing: '火焰環帶（外 24 × 30、內孔 15 × 20 的橢圓環，厚 1.3）、焰舌圈（17 支、伸出 3.6，厚 0.9）、焰形支柱（|z| 23、厚 1.4）、鼻段新月鰭（厚 1.2）：ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；支柱與新月鰭下緣埋進殼面',
    myth: '舞王銅像的火焰光環（prabhamandala）、髮間新月、達瑪如鼓：見 shared/design/body-shiva-ring/DESIGN.md 列出的博物館頁面；只用持物與象徵，不做神像',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
