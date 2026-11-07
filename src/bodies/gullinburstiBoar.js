// 金鬃（body-gullinbursti-boar，神話組・北歐）：《散文埃達》中侏儒在鍛爐裡為 Freyr 打出的 Gullinbursti——鬃毛是金的、在黑夜裡發光、跑得比任何馬都快。
// 車上不做動物本體，只取「金鬃」與「矮人鍛造」兩個元素做成賽車零件與塗裝。
// 造型照四視圖 26（shared/design/body-gullinbursti-boar/fourview.png）：多稜角的寬殼——
// 側視是低平的鏟形鼻 → 一路斜升的引擎蓋 → 車身中段的窄座艙泡 → 平直的後甲板 → 車尾上翹的鴨尾與平板尾翼；
// 俯視是寬鼻、前輪後收腰（側進氣口）、後輪外擴的稜角平面，收腰處側壁仍蓋到底盤側框外；正視是中央低谷的引擎蓋夾在兩道尖起的擋泥板稜之間。
// 金鬃 → 拉絲金的車身主色、背脊中線從座艙後到鴨尾一排低矮的拋光金鋸齒鰭（襯在鍛鐵黑背脊帶上）。
// 鍛造 → 四組向後的鍛鐵黑大箭頭色塊（前擋泥板、後腰各一組，外圈描餘燼橘線）、引擎蓋金面板上的細鎚痕、
// 側進氣口裡一排金色鍛爐百葉、下緣稜線一道餘燼橘的發光縫、車尾一支鍛鐵黑平板尾翼。
// 設計：shared/design/body-gullinbursti-boar/DESIGN.md（典故、借用的古代語彙、和市售車殼 / 現代作品 / 既有車殼的差異）。
// 塗裝全為自創：拉絲金＋拋光金＋鍛鐵黑＋餘燼橘；不用盧恩字母、不用任何被挪用的符號、不含文字與商標。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位節點（x 由後到前；前後軸 x = ±40；車尾 −59、鼻尖 72） */
const XS = [-59, -56, -52, -40, -28, -16, -4, 8, 20, 32, 44, 56, 64, 68, 72];
/** @type {number[]} 俯視半寬的站位（前後輪拱外擴、兩輪之間收腰，多幾個控制點） */
const XS_HW = [-59, -56, -52, -40, -30, -22, -12, 0, 10, 22, 32, 40, 52, 60, 66, 72];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂（含座艙泡）：鼻尖 21.4 → 前軸 26.4 → 座艙頂 36.4（x −4）→ 低平後甲板 29.4 → 車尾鴨尾 30.4
  yC: monoCurve(XS, [30.4, 29.6, 29.4, 29.8, 31, 34.6, 36.4, 35.4, 31.4, 28.6, 26.6, 24.6, 23.2, 22.4, 21.4]),
  // 引擎蓋 / 後甲板線（座艙泡兩側的高度）：鼻尖 20.8 一路斜升到座艙前 28.6，後甲板 29–29.8
  yH: monoCurve(XS, [29.8, 29.2, 29, 29.2, 29.8, 30.4, 30.6, 30.2, 28.6, 27.4, 25.8, 24, 22.6, 21.8, 20.8]),
  // 擋泥板稜線高度：前輪 32.4、後輪 33.6 尖起（31 mm 輪拱頂 30.5 之上），收腰處降到和甲板齊平
  yF: monoCurve(XS, [30.6, 32.4, 33.4, 33.6, 32.2, 30.2, 29.8, 30, 31.2, 32.8, 33, 31.2, 27.4, 24.8, 22]),
  // 座艙泡（點 1）半寬：座艙段 11–12，前後收成窄稜
  cw: monoCurve(XS, [8, 8.5, 8.8, 9, 9.6, 11, 12, 11.6, 9.6, 8, 7.2, 6.6, 6.2, 6, 5.6]),
  // 半寬：俯視細長鏟形的鼻 13 → 前輪拱外擴 46.5 → 兩輪之間收腰到 33（側壁一路蓋到底盤側框外，兩輪之間看不到底盤）→ 後輪拱外擴 46.5 → 收角車尾 21
  hw: monoCurve(XS_HW, [21, 29, 41, 46.5, 41, 35, 33, 33, 34, 38.5, 45, 46.5, 42, 32, 22, 13]),
  // 最寬處（下稜線）高度
  yS: monoCurve(XS, [24, 23.2, 22.5, 22, 21.5, 21, 20.5, 20.5, 21, 21.5, 21.5, 20.5, 19, 18, 17]),
  // 側壁下緣：兩輪之間壓低到 10.5，把底盤側框整段蓋住
  yLow: monoCurve(XS, [15, 14.2, 13.2, 12.5, 11.5, 10.5, 10.5, 10.5, 11.5, 12.5, 12.8, 13.4, 13.8, 14, 14.2]),
};

/** @type {number} 座艙泡前端 x */
const CANOPY_X1 = 23;
/** @type {number} 座艙泡後端 x */
const CANOPY_X0 = -25;

/**
 * 半剖面 8 點：座艙頂 → 座艙泡邊 → 引擎蓋谷底外緣 → 擋泥板內稜 → 擋泥板外稜 → 最寬處 → 下稜（內收）→ 側壁下緣；
 * 點 1–6 都是稜線（多稜角的面）。引擎蓋谷底最寬到 |z| 18.5、擋泥板內稜最外到 |z| 26，輪胎上方（|z| ≥ 24.7）整片是擋泥板頂，輪拱不會在引擎蓋上切出洞
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = P.hw(x);
  const yS = P.yS(x);
  const yLow = P.yLow(x);
  // 引擎蓋谷底外緣：最寬到 |z| 18.5，收腰處至少在座艙泡邊外 1.5 mm
  const z2 = Math.max(P.cw(x) + 1.5, Math.min(0.46 * hw, 18.5));
  return [
    [0, P.yC(x)],
    [P.cw(x), P.yH(x)],
    [z2, P.yH(x) - 0.5],
    [Math.max(z2 + 2, Math.min(0.64 * hw, 26)), P.yF(x)],
    [0.86 * hw, P.yF(x) - 0.8],
    [hw, yS],
    [hw - 1.2, lerp(yS, yLow, 0.55)],
    [hw - 2.6, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 每 2 mm 一站 */
const STATIONS = buildStations(-59, 72, 2, profile);

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
  // 箭頭色塊與背脊帶：鍛鐵黑（緞面、帶一點暖色）；paint- 且 roughness > 0.5 → Blender 緞面
  iron: namedMaterial('paint-forged-iron-black', { color: 0x221f1d, roughness: 0.56, clearcoat: 0.15, clearcoatRoughness: 0.45 }),
  // 尾翼：同色鍛鐵黑（實體件）
  ironTrim: namedMaterial('paint-forged-iron-wing', { color: 0x221f1d, roughness: 0.56, clearcoat: 0.15, clearcoatRoughness: 0.45 }),
  // 箭頭與背脊帶外圈的餘燼橘描線
  ember: namedMaterial('paint-ember-orange-line', { color: 0xff6a12, roughness: 0.55, emissive: 0x7a2400, emissiveIntensity: 0.4 }),
  // 主色：拉絲金（名稱含 -brass → Blender metallic 1）
  goldPaint: namedMaterial('trim-gold-body-brass', { color: 0xc8962f, metalness: 0.85, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.2 }),
  // 背脊金鬃：更亮的拋光金
  gold: namedMaterial('trim-gold-brass', { color: 0xf0c457, metalness: 0.9, roughness: 0.22, clearcoat: 0.3 }),
  // 座艙泡：深色煙燻 PC（真的是座艙罩）
  canopy: namedMaterial('pc-smoke-tint', { color: 0x15161a, roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x18191c, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-iron', { color: 0x3a3c42, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-iron', { color: 0x2c2d31, roughness: 0.7, side: THREE.DoubleSide }),
  // 餘燼橘發光縫（低強度自發光，Blender 裡不過曝）
  dEmber: decalMaterial('decal-ember-glow', { color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.9, roughness: 0.3 }),
  // 鎚痕（貼紙）：比車身暗一階的古金小橢圓
  dHammer: decalMaterial('decal-hammer-mark', { color: 0xa87a26, roughness: 0.4, metalness: 0.8 }),
  // 側進氣口的暗底與金百葉
  dVent: decalMaterial('decal-forge-vent-dark', { color: 0x0b0b0c, roughness: 0.8 }),
  dGold: decalMaterial('decal-gold-louver', { color: 0xf0c457, metalness: 0.9, roughness: 0.22, clearcoat: 0.3 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

// ---------------------------------------------------------------------------
// 金鬃與鍛爐色塊（箭頭色塊、背脊金鬃）
// ---------------------------------------------------------------------------

/**
 * 多邊形的有號距離（2D）：回傳正值 = 在多邊形內，值是到最近邊的距離
 * @type {(px: number, py: number, poly: number[][]) => number}
 */
const polySd = (px, py, poly) => {
  let dMin = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const ex = xi - xj;
    const ey = yi - yj;
    const t = clamp01(((px - xj) * ex + (py - yj) * ey) / (ex * ex + ey * ey));
    dMin = Math.min(dMin, Math.hypot(px - xj - t * ex, py - yj - t * ey));
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside ? dMin : -dMin;
};

/**
 * 四組向後的大箭頭色塊（俯視 (x, |z|)，左右對稱所以每筆是一側一組）：箭尖朝車尾、底邊開一個 V 形缺口；
 * 前擋泥板一組、後腰一組，同一個方向
 * @type {number[][][]}
 */
const ARROWS = [
  // 前擋泥板：箭尖 (35, 31) → 底邊 x 59，|z| 19–42
  [[35, 31], [59, 42], [51, 30.5], [59, 19]],
  // 後腰：箭尖 (−40, 27) → 底邊 x −12，|z| 16–37
  [[-40, 27], [-12, 37], [-20, 26.5], [-12, 16]],
];

/** @type {(x: number, z: number) => number} 箭頭色塊的有號距離（取最近的一組） */
const arrowSd = (x, z) => Math.max(...ARROWS.map((poly) => polySd(x, Math.abs(z), poly)));

/** @type {number} 背脊黑帶的半寬 */
const SPINE_HW = 3.4;
/** @type {number} 背脊黑帶 / 金鬃起點 x（座艙泡後端） */
const SPINE_X1 = -25;
/** @type {number} 背脊黑帶終點 x（鴨尾） */
const SPINE_X0 = -57.5;

/** @type {(x: number, z: number) => number} 背脊黑帶的有號距離（俯視） */
const spineSd = (x, z) => Math.min(SPINE_HW - Math.abs(z), x - SPINE_X0, SPINE_X1 - x);

/**
 * 背脊金鬃：沿中線的一排低矮鋸齒鰭（厚 1.2 mm），從座艙泡後端到鴨尾，每齒後掠；
 * 齒高從 3.2 mm 漸升到 5 mm，齒尖最高仍低於座艙罩頂
 * @type {(topY: (x: number, z: number) => number) => THREE.BufferGeometry}
 */
const buildManeTeeth = (topY) => {
  const n = 8;
  const x1 = SPINE_X1 - 0.5;
  const x0 = SPINE_X0 + 1;
  const pitch = (x1 - x0) / n;
  /** @type {(x: number) => number} */
  const base = (x) => topY(x, 0);
  const shape = new THREE.Shape();
  shape.moveTo(x1, base(x1) - 1.2);
  shape.lineTo(x1, base(x1));
  for (let k = 0; k < n; k++) {
    const xa = x1 - k * pitch;
    const h = lerp(3.2, 5, k / (n - 1));
    // 齒前緣緩升、齒尖往後掠、後緣陡降回殼面
    shape.lineTo(xa - pitch * 0.85, base(xa - pitch * 0.85) + h);
    shape.lineTo(xa - pitch * 0.72, base(xa - pitch * 0.72) + 0.3);
  }
  shape.lineTo(x0, base(x0) + 0.3);
  for (let k = 12; k >= 0; k--) {
    const x = lerp(x1, x0, k / 12);
    shape.lineTo(x, base(x) - 1.2);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
  g.translate(0, 0, -0.6);
  return g;
};

/**
 * 側進氣口（側視平行四邊形，收腰處、後輪前方）：回傳正值 = 在進氣口內
 * @type {(x: number, y: number) => number}
 */
const intakeSd = (x, y) => {
  // 上下緣是水平線，前緣後傾（每升 1 mm 往後 0.7 mm）、後緣前傾
  const top = 20.2 - y;
  const bot = y - 14.2;
  const front = -6 - 0.7 * (y - 14.2) - x;
  const rear = x - (-21 + 0.5 * (y - 14.2));
  return Math.min(top, bot, front, rear);
};

/**
 * 鎚痕（貼紙）：交錯排列的小橢圓（最大長 1.25、寬 0.85 mm，每 4.2 × 2.8 mm 一顆、隔排錯開半格）；回傳正值 = 在鎚痕內
 * @type {(u: number, v: number) => number}
 */
const hammerSd = (u, v) => {
  const row = Math.round(v / 2.8);
  const col = Math.round(u / 4.2 - 0.5 * (row & 1));
  const cu = (col + 0.5 * (row & 1)) * 4.2;
  // 每顆的大小與位置用格子座標雜湊打散，看起來是手鎚敲的、不是規則圓點
  const h = Math.abs(Math.sin(col * 12.9898 + row * 78.233) * 43758.5453) % 1;
  const s = 0.35 + 0.35 * h;
  return 1 - Math.hypot((u - cu - 1.1 * (h - 0.5)) / (0.9 * s), (v - row * 2.8 - 0.8 * (h - 0.5)) / (0.6 * s));
};

/** @type {(x: number, z: number) => boolean} 側面（擋泥板稜以外） */
const onSide = (x, z) => Math.abs(z) > 0.88 * P.hw(x);

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
      // 殼面在輪拱切口起點（|z| 23.5）以內的地方沒有被切開，不需要內襯
      if (zo0 < 24 || zo1 < 24) {
        continue;
      }
      const A = [x0, y0, sg * Math.max(23.5, zo0 - depth)];
      const B = [x1, y1, sg * Math.max(23.5, zo1 - depth)];
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
 * 車尾平板尾翼：俯視梯形的薄板（前緣 x −53.5、後緣 −59.4，翼展 ±45，翼端往前切角），兩支 1.6 mm 立柱埋進鴨尾殼面
 * @type {(topY: (x: number, z: number) => number) => THREE.BufferGeometry}
 */
const buildTailWing = (topY) => {
  const y = topY(-57, 0) + 2.2;
  const shape = new THREE.Shape([
    new THREE.Vector2(-53.5, -40),
    new THREE.Vector2(-53.5, 40),
    new THREE.Vector2(-56.5, 45),
    new THREE.Vector2(-59.4, 45),
    new THREE.Vector2(-59.4, -45),
    new THREE.Vector2(-56.5, -45),
  ]);
  const plate = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: false });
  plate.rotateX(Math.PI / 2);
  plate.translate(0, y + 1.4, 0);
  /** @type {THREE.BufferGeometry[]} */
  const geos = [plate];
  for (const sg of [-1, 1]) {
    const yS = topY(-56.5, 16) - 1;
    const post = new THREE.BoxGeometry(3, y + 0.2 - yS, 1.6);
    post.translate(-56.5, (y + 0.2 + yS) / 2, sg * 16);
    geos.push(post);
  }
  return mergeGeos(geos);
};

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23.5 },
];

export const gullinburstiBoarBody = makePolyBody({
  id: 'body-gullinbursti-boar',
  name: '金鬃',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'gullinbursti',
  form: 'forge-facet-wide',
  roof: 'canopy',
  wing: 'radiant-ray-fins',
  theme: '金鬃（鍛爐稜殼）：多稜角的寬殼——低平鏟形鼻、一路斜升的引擎蓋、中段窄座艙泡、平直後甲板接上翹鴨尾與鍛鐵黑平板尾翼；正視是夾在兩道尖起擋泥板稜之間的低谷引擎蓋，俯視寬鼻、前輪後收腰、後輪外擴。拉絲金車身，前擋泥板與後腰四組向後的鍛鐵黑大箭頭色塊描餘燼橘線；背脊鍛鐵黑帶上一排低矮的拋光金鋸齒鬃；引擎蓋金面板細鎚痕，側進氣口裡一排金色鍛爐百葉，下稜一道餘燼橘發光縫',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格邊長 0.7 mm（寬殼表面積大，放寬網格讓碰撞格耗時壓在 1000 ms 內）
  step: 0.7,
  // 點 1–6 都是稜線（座艙泡邊、引擎蓋谷底外緣、擋泥板內外稜、最寬處、下稜）
  hard: [1, 2, 3, 4, 5, 6],
  wheelArches: ARCHES,
  sideZMin: 30,
  zones: () => [
    // 座艙泡（深色煙燻 PC）
    {
      mat: 'canopy',
      keep: (x, y, z) => Math.min(P.cw(x) - 0.4 - Math.abs(z), x - CANOPY_X0, CANOPY_X1 - x, y - P.yH(x) - 0.25),
    },
    // 箭頭色塊與背脊黑帶外圈的餘燼橘描線（寬 0.8 mm）
    { mat: 'ember', keep: (x, y, z) => 0.4 - Math.abs(arrowSd(x, z)) },
    { mat: 'ember', keep: (x, y, z) => 0.4 - Math.abs(spineSd(x, z)) },
    // 四組向後的鍛鐵黑大箭頭色塊
    { mat: 'iron', keep: (x, y, z) => arrowSd(x, z) },
    // 背脊鍛鐵黑帶（金鬃的底）
    { mat: 'iron', keep: (x, y, z) => spineSd(x, z) },
    // 鼻端前緣一道鍛鐵黑刃口
    { mat: 'iron', keep: (x) => Math.min(x - 70.4, 72.5 - x) },
    // 主色：拉絲金
    { mat: 'goldPaint', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'goldPaint', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 背脊金鬃：座艙泡後到鴨尾的一排低矮鋸齒鰭
    parts.push({ geometry: buildManeTeeth(kit.surf.topY), mat: 'gold', solid: true, outline: true, name: 'spine-mane-teeth' });
    // 車尾平板尾翼（鍛鐵黑，和箭頭色塊同色）
    parts.push({ geometry: buildTailWing(kit.surf.topY), mat: 'ironTrim', solid: true, outline: true, name: 'tail-plank-wing' });
    // 側進氣口暗底
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? intakeSd(x, y) : -1), { offset: 0.08 }),
      mat: 'dVent',
      name: 'decal-forge-intake',
    });
    // 側進氣口裡的金色鍛爐百葉（4 道斜線，寬 0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || intakeSd(x, y) < 0.5) {
          return -1;
        }
        const u = x + 0.6 * (y - 14.2);
        const k = Math.round((u + 7.5) / 3.6);
        return 0.35 - Math.abs(u + 7.5 - 3.6 * k);
      }, { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-forge-louvers',
    });
    // 下稜的餘燼發光縫（0.7 mm）：前輪後到後輪前
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 22 || x < -22) {
          return -1;
        }
        const yc = lerp(P.yS(x), P.yLow(x), 0.55) + 0.6;
        return 0.35 - Math.abs(y - yc);
      }, { offset: 0.1 }),
      mat: 'dEmber',
      name: 'decal-ember-chine',
    });
    // 金色面板的鎚痕：只在引擎蓋與後甲板（座艙泡與擋泥板稜之間），避開黑色箭頭、背脊黑帶
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (x > 64 || x < -55 || arrowSd(x, z) > -0.8 || spineSd(x, z) > -0.8) {
          return -1;
        }
        if (onSide(x, z)) {
          return -1;
        }
        if (az < P.cw(x) + 1.5 || az > 0.62 * P.hw(x)) {
          return -1;
        }
        return hammerSd(x, az);
      }, { offset: 0.06 }),
      mat: 'dHammer',
      name: 'decal-hammer-marks',
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
    geometry: '本檔站位產生器 P（推估，比例取自四視圖 26 的站位表後縮到底盤）：車殼 x −59 ~ 72（短尾）；中線鼻尖 19.8 → 座艙頂 36.4（x −4）→ 後甲板 29.4；擋泥板稜前 32.4 / 後 33.6（31 mm 輪拱頂 30.5 之上）；半寬鼻 13、前輪 46.5、收腰 33、後輪 46.5、車尾 21',
    mane: '背脊金鬃為實心 ABS 薄片（厚 1.2 mm），x −25.5 ~ −56.5 共 8 齒，齒高 3.2 → 5 mm（推估）',
    tailWing: '平板尾翼 ABS 1.4 mm、翼展 ±45、弦長 5.9，兩支 1.6 mm 立柱（推估）',
    livery: '箭頭色塊每組長 24–28 mm、寬 21–23 mm、描線 0.8 mm；背脊帶寬 6.8 mm、餘燼縫 0.7 mm、鎚痕最大 1.25 × 0.85 mm、每 4.2 × 2.8 mm 一顆；皆為自繪（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），切口從 |z| 23.5 起（前輪胎內側 |z| 24.7）＋3 mm 深內襯',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
