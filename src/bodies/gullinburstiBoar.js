// 金鬃野豬（body-gullinbursti-boar，神話組・北歐）：《散文埃達》中侏儒為 Freyr 打造的金鬃野豬 Gullinbursti。
// 車身是低頭衝鋒的楔形全罩（LG1 低風阻楔形＋神話元素做成車身零件；背線前低後高，肩背最高 39、吻尖 17.4）：最前面是往前下伸的青銅長吻鼻錐，
// 吻側一對新月形獠牙前擾流片；背脊一列金色梳狀鬃毛片從前輪後上方排到車尾，前低後高漸升並整排後傾（被風吹），最後幾片接成 bristle-crest 尾翼；
// 肩 / 臀分面＋背線 / 腰線稜線，背上雙細賽車條；側面是 Urnes 風格交織動物紋（自繪 SDF 曲線）；頂高 45.2、最寬 ±36.8。
// 設計：shared/design/body-gullinbursti-boar/DESIGN.md（典故、借用的古代語彙、和市售車殼 / 現代作品 / 既有車殼的差異）。
// 塗裝全為自創：真金屬拉絲金主體＋更亮的拋光金鬃毛＋深烏銅交織紋＋青銅豬鼻；不用盧恩字母、不用任何被挪用的符號、不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位節點（x 由後到前；前後軸 x = ±40；車尾 −64、長吻尖 72（往前下伸的長吻鼻錐）） */
const XS = [-64, -60, -52, -40, -28, -14, 0, 12, 24, 36, 46, 54, 60, 64, 68, 72];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂（LG1 低風阻楔形）：吻尖 17.4 → 前輪上方約 35.3（31 mm 輪拱上方不開洞）→ 肩背最高 39（x ≈ −14）→ 臀部 31.5；
  // 「低頭衝鋒、背線前低後高」的楔形（拱背桶形的側影會像擺件豬）
  yC: monoCurve(XS, [31.5, 34, 36.6, 38, 38.8, 39, 38.8, 38.2, 37.2, 36.2, 33.4, 28.2, 23.8, 21.2, 19.2, 17.4]),
  // 最寬處高度（腰線）
  yS: monoCurve(XS, [22, 23, 23.5, 23.5, 23.5, 23.5, 23.5, 23.5, 23.5, 23, 22, 20.6, 19.2, 18.2, 17.4, 16.6]),
  // 半寬：俯視是前寬後窄的水滴形，肩部最寬 36.8（壓低正面面積），往後收成窄臀（後輪露在車殼外）；
  // 豬鼻段收成細長尖吻（x 60 → 72：13 → 6.5，V3 尖鼻楔形）
  hw: monoCurve(XS, [11, 14, 17.5, 21.5, 25, 29, 32.5, 35.5, 36.8, 36.8, 32, 21, 13, 10.4, 8.4, 6.5]),
  // 側壁下緣
  yLow: monoCurve(XS, [19, 17, 14, 12.8, 12.5, 12.5, 12.5, 12.5, 12.5, 12.8, 13.5, 14.5, 15, 15.2, 15.4, 15.6]),
};

/** @type {number} 長吻（青銅）段起點 x */
const SNOUT_X = 58;

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

const STATIONS = [...buildStations(-64, 60, 2, profile).slice(0, -1), ...buildStations(60, 72, 1.5, profile)];

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
  // 主體：真金屬金（名稱含 -brass → Blender metallic 1；用金漆會像芥末色半光澤塑膠、不像金屬），
  // 顏色比鬃毛深一階、粗糙度高一點（拉絲金），鬃毛是更亮、更光滑的拋光金
  // 刻意不用金屬黑（避開 Bergkaiser Fenrir 限定版的金屬黑＋黃細線，MYTH_RESEARCH F7）
  goldPaint: namedMaterial('trim-gold-body-brass', { color: 0xc8962f, metalness: 0.85, roughness: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.2 }),
  goldPaint2: namedMaterial('trim-gold-body-brass', { color: 0xc8962f, metalness: 0.85, roughness: 0.34, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 真金屬：青銅豬鼻、金鬃毛（名稱含 -brass → Blender 換成金屬材質）
  bronze: namedMaterial('trim-bronze-brass', { color: 0x9c6b3c, metalness: 0.8, roughness: 0.34, clearcoat: 0.2 }),
  gold: namedMaterial('trim-gold-brass', { color: 0xf0c457, metalness: 0.9, roughness: 0.22, clearcoat: 0.3 }),
  // 肩 / 臀分面：深一階的拉絲金
  goldShade: namedMaterial('trim-gold-shade-brass', { color: 0x9a6f22, metalness: 0.85, roughness: 0.42, clearcoat: 0.2 }),
  ivory: namedMaterial('paint-tusk-ivory', { color: 0xe8dcc0, roughness: 0.6, clearcoat: 0.1 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x18191c, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-iron', { color: 0x3a3c42, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-iron', { color: 0x3a3c42, roughness: 0.7, side: THREE.DoubleSide }),
  nostril: decalMaterial('decal-nostril-dark', { color: 0x1a120c, roughness: 0.8, side: THREE.DoubleSide }),
  // 交織紋：深烏銅（金底上的黑金象嵌感，像 Urnes 木刻的陰影線）
  dDark: decalMaterial('decal-niello-interlace', { color: 0x2e2118, roughness: 0.55 }),
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

/** @type {number[]} 鬃毛束的 x 位置（10 束，從前輪後上方 x 34 排到車尾 −60） */
const BRISTLE_X = Array.from({ length: 10 }, (_, i) => lerp(34, -60, i / 9));
/**
 * 鬃毛片高度（從殼面算起）：前低後高漸升——頸部 2.2 → 車尾 8.4（一樣高、等距排列會像鋸齒），
 * 最後幾片接成 bristle-crest 尾翼（翼頂比背線高約 7 mm，V7 貼近車身）
 * @type {(i: number) => number}
 */
const bristleH = (i) => lerp(2.2, 8.4, (i / (BRISTLE_X.length - 1)) ** 1.15);
/** @type {(i: number) => number} 鬃毛片底寬（頸部 5.6 → 車尾 8.2） */
const bristleW = (i) => lerp(5.6, 8.2, i / (BRISTLE_X.length - 1));

/**
 * 梳狀鬃毛片（側視多邊形）：根部埋進殼面 1 mm，三支往後傾的梳齒，最後一齒最高；
 * 整排往後傾（梳齒頂往後偏 1.05 × 高度，約 45°，被風吹的動勢）
 * @type {(x: number, h: number, w: number) => number[][]}
 */
const bristleOutline = (x, h, w) => {
  const yb = P.yC(x) - 1.2;
  const lean = 1.05 * h;
  /** @type {(fx: number, fy: number) => number[]} fx：沿車身往前為正（相對根部中心）、fy：高度比例 */
  const at = (fx, fy) => [x + fx - lean * fy, yb + 1.2 + h * fy];
  return [
    [x + w / 2 + 0.6, yb],
    at(w / 2, 0.2),
    at(w / 2 - 0.6, 0.66),
    at(w / 2 - 1.8, 0.74),
    at(0.9, 0.55),
    at(0.2, 0.88),
    at(-0.9, 0.6),
    at(-1.8, 1.0),
    at(-2.6, 0.9),
    at(-w / 2, 0.38),
    [x - w / 2 - 0.4, yb],
  ];
};

/**
 * 獠牙擾流片：長吻兩側腰線高度往外、往前彎的新月形水平薄片（厚 1.4 mm），
 * 根部埋進吻側，尖端往前勾——俯視是一對往前張開的獠牙，同時是車頭下緣的分流片（V3 尖鼻＋炫砲手法 2 空力件）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildTuskSplitter = (sg) => {
  /** @type {number[][]} 俯視輪廓 (x, |z|)：外緣往前、內緣往後 */
  const outline = [
    [58.5, 9],
    [63, 13.4],
    [67.5, 15.6],
    [72, 16.2],
    [75.6, 14.6],
    [72.4, 14.2],
    [68, 12.6],
    [64, 10],
    [60.5, 6.5],
  ];
  // finPlate 在 x–y 平面給輪廓、沿 z 給厚度；轉成水平：rotateX(−90°) 把 (x, y) 變成 (x, −z)
  const g = finPlate(outline.map(([x, z]) => [x, -sg * z]), 0, 1.4);
  g.rotateX(-Math.PI / 2);
  // 尖端微微上翹 6°（以根部為支點）
  g.translate(-58.5, 0, 0);
  g.rotateZ((6 * Math.PI) / 180);
  g.translate(58.5, 17.2, 0);
  return g;
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

/**
 * 肩部 / 臀部分面板（只做塗裝分區）：側面腰線以上、背線以下的兩塊斜切面板；回傳正值 = 在面板內
 * @type {(x: number, y: number, z: number) => number}
 */
const facetPanel = (x, y, z) => {
  if (Math.abs(z) < 0.5 * P.hw(x)) {
    return -1;
  }
  const top = P.yC(x) - 0.28 * (P.yC(x) - P.yS(x)) - 1.2;
  const bot = P.yS(x) - 3.5;
  const inBand = Math.min(top - y, y - bot);
  // 肩板：x 14 → 44，後緣往後下斜切（像肩胛骨）
  const shoulder = Math.min(44 - x, x - (14 + 0.9 * (top - y)));
  // 臀板：x −58 → −20，前緣往前下斜切（像後腿肌肉）
  const haunch = Math.min(-20 - 0.9 * (top - y) - x, x + 58);
  return Math.min(inBand, Math.max(shoulder, haunch));
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
  theme: '金鬃野豬（iter-120 衝鋒楔形）：低頭衝鋒的低趴金屬金全罩、往前下伸的青銅長吻鼻錐＋新月獠牙前擾流片、肩臀分面、背脊一列前低後高並整排後傾的真金屬金鬃（尾端接成 bristle-crest 尾翼）、側面深烏銅 Urnes 交織獸紋與往後上掃的速度線',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 背線（點 2）與腰線（點 4）是稜線（肩線＋腰線貫穿車身，炫砲手法 3）
  hard: [2, 4],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
  ],
  sideZMin: 30,
  zones: () => [
    // 青銅豬鼻：最前面一段（後緣往後斜，側視是楔形的鼻套）
    { mat: 'bronze', keep: (x, y) => x - (SNOUT_X + 0.12 * (y - 16)) },
    // 肩部分面（前腿上方的肩胛板）與臀部分面（後腿上方的腿肉板）：深一階的拉絲金（只是塗裝分區、不加幾何）
    { mat: 'goldShade', keep: (x, y, z) => facetPanel(x, y, z) },
    { mat: 'goldPaint', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'bronze', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 背脊金鬃毛：10 束梳狀實體片（厚 2.0 mm），前低後高漸升、整排後傾，根部埋進中線殼面
    const plates = BRISTLE_X.map((x, i) => finPlate(bristleOutline(x, bristleH(i), bristleW(i)), 0, 2.0));
    parts.push({ geometry: mergeGeos(plates), mat: 'gold', solid: true, outline: true, name: 'bristle-crest' });
    // 獠牙擾流片
    parts.push({ geometry: mergeGeos([buildTuskSplitter(-1), buildTuskSplitter(1)]), mat: 'ivory', solid: true, outline: true, name: 'tusk-splitters' });
    // 耳朵：眼睛後上方一對大的野豬耳（側視尖葉形，高 6.5、底寬 7，厚 1.6 mm，外傾 32°、耳尖往後），耳根埋進殼面 1 mm
    /** @type {THREE.BufferGeometry[]} */
    const ears = [];
    for (const sg of [-1, 1]) {
      const ex = 42;
      const ez = 13.5;
      const ear = finPlate(
        // 衝鋒時耳朵往後貼（耳尖往後、高 6.5）
        [
          [ex + 3.6, 0],
          [ex + 2.4, 2.8],
          [ex - 3.8, 6.5],
          [ex - 2.6, 3.2],
          [ex - 3.4, 0],
        ],
        0,
        1.6,
        sg * 32,
      );
      ear.translate(0, kit.surf.topY(ex, ez) - 1, sg * ez);
      ears.push(ear);
    }
    parts.push({ geometry: mergeGeos(ears), mat: 'goldPaint2', solid: true, outline: true, name: 'ears' });
    // 長吻前端的深色斜切鼻孔縫（貼紙）：不做圓形鼻盤與鼻孔（圓豬鼻會讀成卡通臉，圓柱的面數也高）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 66 || y < P.yS(x) - 0.4) {
          return -1;
        }
        const zc = 2.4 + 0.25 * (x - 66);
        return Math.min(0.55 - Math.abs(Math.abs(z) - zc), x - 67, 71.4 - x);
      }, { offset: 0.1 }),
      mat: 'nostril',
      name: 'nostril-slits',
    });
    // 背上雙細賽車條（炫砲手法 4）：深烏銅細線從吻尖沿鬃毛兩側往後掃到臀部，間距往後漸寬（V12 / V13 的配置：從鼻部往後掃）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > 70 || x < -62 || y < P.yS(x) + 3) {
          return -1;
        }
        const zc = lerp(2.2, 6.4, (70 - x) / 132);
        const w = lerp(0.35, 0.6, (70 - x) / 132);
        return w - Math.abs(Math.abs(z) - zc);
      }, { offset: 0.08 }),
      mat: 'dDark',
      name: 'decal-spine-stripes',
    });
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos([buildLiner({ x: 40, y: 13, radius: 17.5 }, 3), buildLiner({ x: -40, y: 13, radius: 17.5 }, 3)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 側面 Urnes 風格交織獸紋（深烏銅，左右鏡射，獸頭都朝車頭）
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(interlaceSd, { x0: 0, y0: 0, zMin: 22, side: 1 })),
        kit.decal(sideDecal(interlaceSd, { x0: 0, y0: 0, zMin: 22, side: -1 })),
      ]),
      mat: 'dDark',
      name: 'decal-urnes-interlace',
    });
    // 眼睛（琥珀色小燈，杏仁形）：豬鼻後方的頭側
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 8) {
          return -1;
        }
        // 眼睛前低後高斜放（衝鋒的怒目，自發光琥珀，炫砲手法 5）；落在長吻後段、前輪拱切口之前
        const ey = P.yS(56.5) + 0.55 * (P.yC(56.5) - P.yS(56.5));
        const u = x - 56.5;
        const v = y - ey - 0.28 * u;
        return 1 - Math.hypot(u / 2.2, v / 0.95);
      }, { offset: 0.1 }),
      mat: 'eye',
      name: 'lamp-eyes',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P（iter-120，推估）：車殼 x −64 ~ 72（長吻）、背線最高 39（x ≈ −14）、鬃毛尾翼頂約 45.2、最寬 ±36.8（肩部）；前輪上方殼頂約 35.3（31 mm 輪拱上方不開洞，輪拱上方殼面最低點和改前相同）；外框 x −70.8 ~ 75.8',
    bristles: 'iter-120：10 束梳狀鬃毛為實心 ABS 片（厚 2.0 mm），從 x 34 到車尾 x −60、高度 2.2 → 8.4 mm 前低後高、梳齒頂往後偏 1.05 × 高度（約 45° 後傾），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    tusks: 'iter-120：獠牙擾流片為實心 ABS 水平薄片（厚 1.4 mm，≥ 1.2 mm 射出薄件），吻側腰線高度 y ≈ 17.2、x 58.5 ~ 75.6、|z| 6.5 ~ 16.2，尖端上翹 6°；離前導輪（|z| ≥ 35.5）遠（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），切口從 |z| 21 起＋3 mm 深內襯',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
