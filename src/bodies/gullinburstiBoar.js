// 金鬃野豬（body-gullinbursti-boar，第八階段神話組・北歐）：《散文埃達》中侏儒為 Freyr 打造的金鬃野豬 Gullinbursti。
// 車身是前低後高的桶形拱背全罩（肩頸最高）：最前面一段短而寬的楔形青銅豬鼻（前端平面鼻盤＋兩個鼻孔）、兩側一對短獠牙；
// 背脊一整列金色梳狀鬃毛片從肩部一路排到車尾，越往後越高，最後幾片成為 bristle-crest 尾翼；側面是 Urnes 風格交織動物紋（自繪 SDF 曲線）。
// 設計：shared/design/body-gullinbursti-boar/DESIGN.md（典故、借用的古代語彙、和市售車殼 / 現代作品 / 既有車殼的差異）。
// 塗裝全為自創：炭黑鐵灰主體＋亮金鬃毛＋金色交織紋＋青銅豬鼻；不用盧恩字母、不用任何被挪用的符號、不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位節點（x 由後到前；前後軸 x = ±40；車尾 −64、鼻盤 68） */
const XS = [-64, -60, -52, -40, -28, -14, 0, 12, 24, 36, 46, 54, 60, 64, 68];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：鼻盤 19.5 → 前輪上方 36 → 肩頸隆起最高 43.6（x ≈ 0）→ 往後緩降成圓臀 29
  yC: monoCurve(XS, [29, 33.5, 37, 40, 41.8, 43.2, 43.6, 42.5, 40.5, 38, 34.5, 29.5, 25, 22, 19.5]),
  // 最寬處高度（桶形腰線）
  yS: monoCurve(XS, [22, 23, 24, 24, 24, 24, 24, 24, 24, 23.5, 22.5, 21, 19.5, 18.5, 17.5]),
  // 半寬：俯視是野豬的水滴形——前寬後窄——肩部最寬 40（x ≈ 24，前輪正後方）、往後收成窄臀（後輪處 21.5，後輪露在車殼外、車尾 11）；俯視是往後收尖的鏟形，豬鼻段收成短而寬的楔形（13）
  hw: monoCurve(XS, [11, 14, 17.5, 21.5, 25.5, 30, 34.5, 38.5, 40, 39.5, 34, 23, 17, 14.5, 13]),
  // 側壁下緣
  yLow: monoCurve(XS, [19, 17, 14, 12.8, 12.5, 12.5, 12.5, 12.5, 12.5, 12.8, 13.5, 14.5, 15.5, 15.5, 15.5]),
};

/** @type {number} 豬鼻（青銅）段起點 x */
const SNOUT_X = 55;

/**
 * 半剖面 7 點：中線頂 → 背 → 肩 → 側腹上 → 最寬處（腰線）→ 下腹 → 側壁下緣；全部平滑（桶形斷面）
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

const STATIONS = [...buildStations(-64, 60, 2, profile).slice(0, -1), ...buildStations(60, 68, 1, profile)];

/**
 * 外殼在 (x, y) 高度的 |z|（沿剖面折線內插，只取腰線以上到中線頂這段），給輪拱內襯、鬃毛根部定位用
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

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 深鐵灰：緞面（roughness 0.58，低 clearcoat），和亮金鬃毛形成材質對比；刻意不用金屬黑（避開 Bergkaiser Fenrir 限定版的金屬黑＋黃細線，MYTH_RESEARCH F7）
  iron: namedMaterial('paint-iron-charcoal', { color: 0x3d4046, roughness: 0.58, clearcoat: 0.15, clearcoatRoughness: 0.5 }),
  iron2: namedMaterial('paint-iron-charcoal', { color: 0x3d4046, roughness: 0.58, clearcoat: 0.15, side: THREE.DoubleSide }),
  // 真金屬：青銅豬鼻、金鬃毛（名稱含 -brass → Blender 換成金屬材質）
  bronze: namedMaterial('trim-bronze-brass', { color: 0x9c6b3c, metalness: 0.8, roughness: 0.34, clearcoat: 0.2 }),
  gold: namedMaterial('trim-gold-brass', { color: 0xe0b043, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  ivory: namedMaterial('paint-tusk-ivory', { color: 0xe8dcc0, roughness: 0.6, clearcoat: 0.1 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x18191c, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-iron', { color: 0x3a3c42, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-iron', { color: 0x3a3c42, roughness: 0.7, side: THREE.DoubleSide }),
  nostril: decalMaterial('decal-nostril-dark', { color: 0x1a120c, roughness: 0.8, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-gold-interlace', { color: 0xdcae48, metalness: 0.7, roughness: 0.32 }),
  eye: namedMaterial('lamp-amber', { color: 0xffc23a, emissive: 0xff9a00, emissiveIntensity: 0.7, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

// ---------------------------------------------------------------------------
// Urnes 風格交織動物紋（側面貼紙）：一隻細長「大獸」的 S 形身體＋一條細蛇以 8 字繞過大獸，交叉處一上一下交替
// ---------------------------------------------------------------------------

/**
 * 三次貝茲曲線串取樣成折線（控制點每 3 個一段，首尾相接）
 * @type {(cp: number[][], perSeg?: number) => number[][]}
 */
const bezierChain = (cp, perSeg = 24) => {
  /** @type {number[][]} */
  const out = [];
  for (let s = 0; s + 3 < cp.length; s += 3) {
    const [a, b, c, d] = [cp[s], cp[s + 1], cp[s + 2], cp[s + 3]];
    for (let i = s === 0 ? 0 : 1; i <= perSeg; i++) {
      const t = i / perSeg;
      const m = 1 - t;
      out.push([
        m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0],
        m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1],
      ]);
    }
  }
  return out;
};

/**
 * 點到折線的最短距離
 * @type {(pl: number[][], u: number, v: number) => number}
 */
const polylineDist = (pl, u, v) => {
  let best = Infinity;
  for (let i = 0; i < pl.length - 1; i++) {
    const [ax, ay] = pl[i];
    const [bx, by] = pl[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2)) : 0;
    const d = Math.hypot(u - ax - t * dx, v - ay - t * dy);
    if (d < best) {
      best = d;
    }
  }
  return best;
};

/**
 * 兩條折線的交點
 * @type {(a: number[][], b: number[][]) => number[][]}
 */
const polylineCrossings = (a, b) => {
  /** @type {number[][]} */
  const out = [];
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      const [p, q] = [a[i], a[i + 1]];
      const [r, s] = [b[j], b[j + 1]];
      const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
      if (Math.abs(d) < 1e-9) {
        continue;
      }
      const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
      const w = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
      if (t >= 0 && t < 1 && w >= 0 && w < 1) {
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
  }
  return out;
};

/**
 * 大獸身體中心線（側視 u = x、v = y；u 往車頭）：頭在前上方，身體往後下彎成大 S，尾巴在後方捲成一圈
 * 範圍限制在兩個輪拱之間（x −22 ~ 22）與輪拱上方的腰帶（y ≥ 31）
 * @type {number[][]}
 */
const BEAST = bezierChain([
  [19, 33.5],
  [12, 36],
  [6, 33],
  [4, 27],
  [2, 21],
  [-8, 17],
  [-12, 23],
  [-15, 28],
  [-10, 34],
  [-18, 34.5],
  [-25, 35],
  [-32, 33.5],
  [-37, 34.5],
]);
/** @type {number[][]} 大獸的前腳（從胸前往下伸的短弧，末端捲） */
const BEAST_LEG = bezierChain([
  [5, 25],
  [10, 22],
  [13, 19],
  [11, 16],
]);
/**
 * 細蛇中心線：從前方腰帶進來，繞大獸身體打一個 8 字，再沿腰帶往後拉長、末端捲成小渦
 * @type {number[][]}
 */
const SNAKE = bezierChain([
  [30, 32],
  [20, 30],
  [14, 18],
  [4, 17],
  [-6, 16],
  [-4, 31],
  [-8, 31],
  [-13, 31],
  [-20, 16],
  [-17, 21],
  [-14, 26],
  [-24, 30],
  [-30, 31.5],
  [-40, 33],
  [-46, 32],
  [-44, 30],
]);
/** @type {number} 大獸線寬（mm） */
const BEAST_W = 1.5;
/** @type {number} 細蛇線寬 */
const SNAKE_W = 0.8;
/** @type {number} 交叉處被壓在下面那條線的缺口（比上面那條線寬多出的間隙） */
const UNDER_GAP = 0.55;
/** @type {{ p: number[], snakeOver: boolean }[]} 大獸 × 細蛇的交叉點，沿細蛇順序一上一下交替 */
const CROSSINGS = polylineCrossings(SNAKE, [...BEAST]).map((p, i) => ({ p, snakeOver: i % 2 === 0 }));

/**
 * 交織紋距離函式（負值 = 在紋樣內）
 * @type {(u: number, v: number) => number}
 */
const interlaceSd = (u, v) => {
  if (u < -50 || u > 34 || v < 13 || v > 39) {
    return 10;
  }
  const dBeastC = Math.min(polylineDist(BEAST, u, v), polylineDist(BEAST_LEG, u, v) + (BEAST_W - 1.1) / 2);
  const dSnakeC = polylineDist(SNAKE, u, v);
  let dBeast = dBeastC - BEAST_W / 2;
  let dSnake = dSnakeC - SNAKE_W / 2;
  for (const c of CROSSINGS) {
    if (Math.hypot(u - c.p[0], v - c.p[1]) > 4) {
      continue;
    }
    if (c.snakeOver) {
      dBeast = Math.max(dBeast, SNAKE_W / 2 + UNDER_GAP - dSnakeC);
    } else {
      dSnake = Math.max(dSnake, BEAST_W / 2 + UNDER_GAP - dBeastC);
    }
  }
  // 大獸的頭：杏仁形（細長橢圓，Urnes 風格的細長獸頭），眼睛留空
  const hx = (u - 21.2) / 3.2;
  const hy = (v - 33.2) / 1.5;
  const dHead = (Math.hypot(hx, hy) - 1) * 1.5;
  const dEye = Math.hypot(u - 21.8, v - 33.4) - 0.45;
  const head = Math.max(dHead, -dEye);
  return Math.min(dBeast, dSnake, head);
};

// ---------------------------------------------------------------------------
// 實體件
// ---------------------------------------------------------------------------

/** @type {number[]} 鬃毛片的 x 位置（從肩部往後到車尾，13 片） */
const BRISTLE_X = [6, 0.5, -5, -10.5, -16, -21.5, -27, -32.5, -38, -43.5, -49, -54, -58.5];
/**
 * 鬃毛片高度（從殼面算起）：肩部 3.5，越往後越高，最後 3 片成為尾翼（最高 16）
 * @type {(i: number) => number}
 */
const bristleH = (i) => {
  const n = BRISTLE_X.length;
  const t = i / (n - 1);
  return 3.5 + 6 * t * t + (i >= n - 3 ? (i - (n - 4)) * 2.2 : 0);
};

/**
 * 梳狀鬃毛片（側視多邊形）：根部埋進殼面 1 mm，三支往後傾的梳齒，最後一齒最高
 * @type {(x: number, h: number) => number[][]}
 */
const bristleOutline = (x, h) => {
  const yb = P.yC(x) - 1.2;
  const w = 4.6;
  const lean = 0.45 * h;
  /** @type {(fx: number, fy: number) => number[]} fx：沿車身往前為正（相對根部中心）、fy：高度比例 */
  const at = (fx, fy) => [x + fx - lean * fy, yb + 1.2 + h * fy];
  return [
    [x + w / 2 + 0.6, yb],
    at(w / 2, 0.15),
    at(w / 2 - 0.4, 0.62),
    at(w / 2 - 1.0, 0.72),
    at(0.6, 0.55),
    at(0.1, 0.86),
    at(-0.5, 0.62),
    at(-1.2, 1.0),
    at(-1.6, 0.9),
    at(-w / 2, 0.35),
    [x - w / 2 - 0.4, yb],
  ];
};

/**
 * 獠牙（單支）：從豬鼻側面往外上彎的小圓錐管，根粗尖細
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildTusk = (sg) => {
  const pts = [
    [59.5, 17.2, sg * 15.2],
    [61.5, 19.2, sg * 17.4],
    [62.6, 21.6, sg * 18.6],
    [62.2, 23.6, sg * 18.9],
  ];
  return sweepEllipse(pts, 16, (t) => [lerp(1.15, 0.25, t), lerp(1.15, 0.25, t)], 10);
};

/**
 * 輪拱內襯（參考 zeppelin-xtail 的 buildHullLiner）：輪拱切口後面上半圈圓柱面，z 從殼內面（外殼 |z| − 1.2）往內 depth
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 44;
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

export const gullinburstiBoarBody = makePolyBody({
  id: 'body-gullinbursti-boar',
  name: '金鬃野豬',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'gullinbursti',
  form: 'boar-hump',
  roof: 'closed',
  wing: 'bristle-crest',
  theme: '金鬃野豬：前低後高的桶形拱背全罩（肩頸最高）、短寬楔形青銅豬鼻＋短獠牙、背脊一列越往後越高的金色梳狀鬃毛片成為尾翼、側面 Urnes 交織獸紋',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑桶形斷面，沒有銳利稜線
  hard: [],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
  ],
  sideZMin: 30,
  zones: () => [
    // 青銅豬鼻：最前面一段（後緣往後斜，側視是楔形的鼻套）
    { mat: 'bronze', keep: (x, y) => x - (SNOUT_X + 0.12 * (y - 16)) },
    { mat: 'iron', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'bronze', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 背脊金鬃毛：13 片梳狀實體片（厚 1.2 mm），根部埋進中線殼面
    const plates = BRISTLE_X.map((x, i) => finPlate(bristleOutline(x, bristleH(i)), 0, 1.2));
    parts.push({ geometry: mergeGeos(plates), mat: 'gold', solid: true, outline: true, name: 'bristle-crest' });
    // 獠牙
    parts.push({ geometry: mergeGeos([buildTusk(-1), buildTusk(1)]), mat: 'ivory', solid: true, outline: true, name: 'tusks' });
    // 耳朵：肩前兩片往後倒的小三角片（鐵灰，實體）
    /** @type {THREE.BufferGeometry[]} */
    const ears = [];
    for (const sg of [-1, 1]) {
      const zc = sg * 12.5;
      const yb = 0;
      const ear = finPlate(
        [
          [33.5, yb],
          [27.5, yb],
          [26.2, yb + 6.2],
        ],
        0,
        1.2,
        sg * 28,
      );
      ear.translate(0, kit.surf.topY(30.5, 12.5) - 1, zc);
      ears.push(ear);
    }
    parts.push({ geometry: mergeGeos(ears), mat: 'iron', solid: true, outline: true, name: 'ears' });
    // 鼻盤上的兩個鼻孔（深色橢圓薄片，貼在前封口外 0.08 mm）
    /** @type {THREE.BufferGeometry[]} */
    const nostrils = [];
    for (const sg of [-1, 1]) {
      const g = new THREE.CircleGeometry(1, 20);
      g.scale(1.5, 2.1, 1);
      g.rotateY(Math.PI / 2);
      g.translate(68.08, 19.2, sg * 4.2);
      nostrils.push(g);
    }
    parts.push({ geometry: mergeGeos(nostrils), mat: 'nostril', name: 'nostrils' });
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos([buildLiner({ x: 40, y: 13, radius: 17.5 }, 3), buildLiner({ x: -40, y: 13, radius: 17.5 }, 3)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 側面 Urnes 風格交織獸紋（金色，左右鏡射，獸頭都朝車頭）
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(interlaceSd, { x0: 0, y0: 0, zMin: 22, side: 1 })),
        kit.decal(sideDecal(interlaceSd, { x0: 0, y0: 0, zMin: 22, side: -1 })),
      ]),
      mat: 'dGold',
      name: 'decal-urnes-interlace',
    });
    // 眼睛（琥珀色小燈，杏仁形）：豬鼻後方的頭側
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 12) {
          return -1;
        }
        return 1 - Math.hypot((x - 49.5) / 2.1, (y - 28.2) / 1.1);
      }, { offset: 0.1 }),
      mat: 'eye',
      name: 'lamp-eyes',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P（推估）：車殼 x −64 ~ 68（約 132 mm＋尾端鬃毛）、肩頸殼頂 43.6、鬃毛尾翼頂約 52、最寬 ±40（肩部，桶形斷面）；前輪上方殼頂 ≥ 36（31 mm 輪拱上方不開洞）',
    bristles: '13 片梳狀鬃毛為實心 ABS 片（厚 1.2 mm），高度 3.5 → 16 mm 往後遞增，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    tusks: '獠牙為實心 ABS 掃掠件（根部直徑 2.3 mm），位於豬鼻兩側 |z| 15–19，離前導輪（|z| ≥ 35.5）遠（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），切口從 |z| 21 起＋3 mm 深內襯',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
