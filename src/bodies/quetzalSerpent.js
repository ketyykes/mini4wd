// 羽蛇（body-quetzal-serpent，神話組・阿茲特克 / 馬雅）：特奧蒂瓦坎羽蛇神殿的階梯金字塔、綠咬鵑羽、黑曜石刀。
// 不做蛇頭、眼、牙與蛇信。照四視圖 02 建模：
// (1) 層疊的羽 → 迴力鏢海鷗翼：俯視是往前尖的人字形、後視是中央下凹兩端上翹、左右對稱的 M 形；三層往後、往下疊的羽翼
//     （翡翠綠 → 金 → 朱紅，越下層越短），每層後緣都是一排整齊的圓頭羽端；翼端立一片往後拉長的綠咬鵑羽片（金色羽軸）；兩片黑曜石翼柱架在車尾；
// (2) 黑曜石刀 → 鏟形鼻上的刀狀擾流：寬而薄的鏟形鼻，中線立一道金色刀脊，接鼻頭中央往前伸的金色尖刺，合成一支鼻錐；
// (3) 階梯金字塔 → 側面 talud-tablero：肩線下是一段直立的綠松石立板（上面是連續的階梯回紋）、再一階、朱紅斜坡到下緣（兩輪之間往外伸成側箱封住底盤）；
// (4) 紋樣與配色：頂面兩道往前尖的朱紅人字帶＋金邊（四視圖的 V 形分色）；翡翠綠金屬漆（主色）＋朱紅＋綠松石＋金。
// 姿態：鼻尖低而薄，前擋泥板的稜線高過中線（V 形引擎蓋低谷），座艙後背線平，迴力鏢翼是全車最高點——前低後高。
// 設計：shared/design/body-quetzal-serpent/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 8 節 A1、A2、A6、A7；黑名單 8-3）。剖面為本檔站位產生器（推估）。
// 不做鷹＋蛇＋仙人掌組合、不用國旗色排列、不做骷髏 / 人祭圖像、不畫神像人臉；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -74.5;
/** @type {number} 殼面鼻尖 x（鏟形鼻；中央尖刺再往前伸到 SPIKE_TIP） */
const X_NOSE = 66;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-74.5, -70, -64, -56, -48, -40, -30, -20, -10, 0, 12, 24, 32, 40, 48, 53, 57.5, 61.5, 64, 66];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬：後輪上方 34 全罩 → 兩輪之間 25 → 前輪段 26（前輪胎面往外露出 8 mm）→ 前輪前方再展開成比前輪段還寬的方形鏟鼻（30.5，鼻尖 28）
  hw: monoCurve(XS, [27.5, 31, 33, 35, 36, 36, 34, 29.5, 26, 25, 25, 25.5, 26, 26, 26.5, 31, 33, 33, 32, 30]),
  // 中線頂：鼻尖 20.5（鏟形鼻前端面有厚度）→ 引擎蓋 32（略低於擋泥板稜線、引擎蓋是飽滿的面）→ 座艙段 33 → 車尾平台 30.5
  yC: monoCurve(XS, [30.5, 30.5, 30.5, 31, 31.5, 32, 32.5, 33, 33, 33, 32.5, 32, 32, 32, 31.5, 29.5, 26.5, 23.5, 22, 20.5]),
  // 肩線（銳利）：前擋泥板稜線 34 略高過中線（淺 V 形引擎蓋）；前後輪上方 ≥ 32.5，高過 R17.5 輪拱頂
  yS: monoCurve(XS, [29.8, 29.8, 30.5, 32, 32.8, 32.8, 31.5, 30, 29, 28.5, 28.5, 29.8, 32.5, 34, 34, 31.5, 27.5, 24.5, 23, 21.5]),
  // 側裙下緣：兩輪之間壓到 11（外伸側箱蓋住底盤側壁），車尾 x −74.5 段 14.5–17 蓋住後段底盤，鼻段 15.5
  yLow: monoCurve(XS, [17, 15.5, 14.5, 13.5, 12, 11.5, 11, 11, 11, 11, 11, 12, 12.5, 12.5, 13, 14, 14.5, 15, 15, 15.5]),
};

/**
 * 立板（tablero）下緣：肩線下 6.5 mm；前段與鼻段側壁矮，夾在下緣上 1.2 mm 與肩線下 1.6 mm 之間
 * @type {(x: number) => number}
 */
const tableroY = (x) => Math.min(P.yS(x) - 1.6, Math.max(P.yLow(x) + 1.2, P.yS(x) - 6.5));

/** @type {number} 兩輪之間側箱的半寬：蓋過底盤中段側壁（半寬 27） */
const POD_W = 27.3;
/** @type {(x: number) => number} 立板下緣以下的半寬：兩輪之間外伸到 POD_W，x ±30 → ±36 退回殼面半寬（兩端藏進輪拱） */
const podW = (x) => Math.max(P.hw(x), lerp(P.hw(x), POD_W, 1 - smoothstep(30, 36, Math.abs(x))));

/**
 * 半剖面 8 點：中線 → 引擎蓋 → 擋泥板稜線 → 肩線（銳利）→ 立板 tablero（垂直）→ 立板下緣（銳利）→ 內收一階（銳利）→ 斜坡 talud 到下緣
 * 兩輪之間的「內收一階」改成往外伸的一階（側箱），斜坡直落到底盤側壁外側
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const h = P.hw(x);
  const yC = P.yC(x);
  const yS = P.yS(x);
  const yT = tableroY(x);
  return [
    [0, yC],
    [0.42 * h, lerp(yC, yS, 0.45)],
    [0.78 * h, Math.max(yS + 0.6, lerp(yC, yS, 0.9))],
    [h - 0.6, yS],
    [h, yS - 1],
    [h, yT],
    [Math.max(h - 1.5, podW(x)), yT - 0.5],
    [Math.max(h - 0.4, podW(x) - 0.4), P.yLow(x)],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 站位表：車尾與鼻段每 1.5 mm、中段每 2.5 mm */
const STATIONS = [...buildStations(X_TAIL, -62, 1.5, profile).slice(0, -1), ...buildStations(-62, 62, 2.5, profile).slice(0, -1), ...buildStations(62, X_NOSE, 1.5, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23 },
];

/**
 * 線段距離
 * @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number}
 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** @type {number} 階梯回紋單元寬（xicalcoliuhqui，自繪）：寬 10.4、高 4.4 的帶內，一道三階梯往上接一個往內捲的方鉤；單元往同一方向連續重複 */
const FRET_W = 10.4;
/** @type {number[][]} 折線頂點（單元座標 u, v） */
const FRET_PATH = [
  [-0.8, 0.5],
  [2, 0.5],
  [2, 1.6],
  [3.6, 1.6],
  [3.6, 2.8],
  [5.2, 2.8],
  [5.2, 3.9],
  [9.6, 3.9],
  [9.6, 1.4],
  [7.2, 1.4],
  [7.2, 2.6],
  [8.2, 2.6],
];

/**
 * 階梯回紋帶距離（u 沿帶、v 由帶下緣往上，線寬 0.62 mm）
 * @type {(u: number, v: number) => number}
 */
const fretSd = (u, v) => {
  const k = Math.floor(u / FRET_W);
  let d = Infinity;
  for (const off of [k - 1, k]) {
    const lu = u - off * FRET_W;
    for (let i = 0; i < FRET_PATH.length - 1; i++) {
      const [ax, ay] = FRET_PATH[i];
      const [bx, by] = FRET_PATH[i + 1];
      d = Math.min(d, segDist(lu, v, ax, ay, bx, by));
    }
  }
  return d - 0.31;
};

/** @type {{ x0: number, sweep: number, w: number }[]} 頂面朱紅人字帶：中線前緣 x0、往兩側每 1 mm 後退 sweep、帶寬 w（引擎蓋一道、座艙後一道） */
const CHEVRONS = [
  { x0: 57, sweep: 0.55, w: 9 },
  { x0: -22, sweep: 0.5, w: 7 },
];
/**
 * 人字帶：回傳正值 = 帶內
 * @type {(x: number, z: number) => number}
 */
const chevronSd = (x, z) => {
  let best = -Infinity;
  for (const c of CHEVRONS) {
    const u = c.x0 - c.sweep * Math.abs(z) - x;
    best = Math.max(best, Math.min(u, c.w - u));
  }
  return best;
};

/** @type {number} 迴力鏢翼的翼展半寬 */
const WING_SPAN = 46.5;
/** @type {number} 海鷗翼的峰點 |z| */
const WING_PEAK_Z = 37;
/**
 * 迴力鏢翼的上反（後視 M 形海鷗翼）：中央下凹，往外直線升高 5.5 mm 到峰點，峰點以外再往下垂 1 mm 接羽片
 * @type {(az: number) => number}
 */
const dihedral = (az) => (az <= WING_PEAK_Z ? (5.5 * az) / WING_PEAK_Z : 5.5 - 1 * smoothstep(WING_PEAK_Z, WING_SPAN, az));

/** @type {number} 羽端寬（沿 z）：後緣每格一個圓頭羽端 */
const FEATHER_W = WING_SPAN / 7;
/** @type {number} 羽端圓弧往後鼓出的長度 */
const FEATHER_TIP = 2.2;

/**
 * 翼後緣的圓弧羽端：每格往後鼓出一道圓弧、格界回到 0（後緣是一排整齊的圓頭羽片）
 * @type {(az: number) => number}
 */
const featherTip = (az) => {
  const u = az / FEATHER_W - Math.floor(az / FEATHER_W);
  return FEATHER_TIP * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
};

/**
 * 迴力鏢海鷗翼的一條：z 從 z0 到 z1、弦向比例 u0 → u1 的封閉實體（俯視往前尖的人字形，後緣帶圓頭羽端），每 0.75 mm 一站，依上反抬高；厚 thick
 * @type {(w: { xf: number, xr: number, sweep: number, span: number, y: number, thick: number }, z0: number, z1: number, u0: number, u1: number) => THREE.BufferGeometry}
 */
const buildWingStrip = ({ xf, xr, sweep, span, y, thick }, z0, z1, u0, u1) => {
  const n = Math.max(2, Math.ceil((z1 - z0) / 0.75));
  /** @type {number[][]} 每站 [z, 前 x, 後 x, 底高] */
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const z = lerp(z0, z1, i / n);
    const az = Math.abs(z);
    // 翼梢 5 mm 收成往後的圓角
    const front = xf - sweep * az - 3 * smoothstep(span - 5, span, az);
    const rear = xr - sweep * az - featherTip(az);
    rows.push([z, lerp(front, rear, u0), lerp(front, rear, u1), y + dihedral(az)]);
  }
  /** @type {number[]} */
  const pos = [];
  /** @type {(a: number[], b: number[], c: number[]) => void} */
  // 頂點順序 (a, c, b)：外法線朝外
  const tri = (a, b, c) => pos.push(...a, ...c, ...b);
  for (let i = 0; i < rows.length - 1; i++) {
    const [za, f0, r0, y0] = rows[i];
    const [zb, f1, r1, y1] = rows[i + 1];
    const A = [f0, y0 + thick, za];
    const B = [r0, y0 + thick, za];
    const C = [r1, y1 + thick, zb];
    const D = [f1, y1 + thick, zb];
    const a = [f0, y0, za];
    const b = [r0, y0, za];
    const c = [r1, y1, zb];
    const d = [f1, y1, zb];
    // 上面、下面、前緣、後緣
    tri(A, C, B);
    tri(A, D, C);
    tri(a, b, c);
    tri(a, c, d);
    tri(a, d, D);
    tri(a, D, A);
    tri(b, B, C);
    tri(b, C, c);
  }
  // 兩端封口
  for (const [k, sg] of [
    [0, 1],
    [rows.length - 1, -1],
  ]) {
    const [z, f, r, yy] = rows[k];
    const A = [f, yy + thick, z];
    const B = [r, yy + thick, z];
    const a = [f, yy, z];
    const b = [r, yy, z];
    if (sg > 0) {
      tri(a, A, B);
      tri(a, B, b);
    } else {
      tri(a, B, A);
      tri(a, b, B);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @typedef {{ xf: number, xr: number, sweep: number, span: number, y: number, thick: number }} WingLayer */
/** @type {WingLayer} 層疊羽翼的最上層（翡翠綠）：弦長 6.5，中央底 41.4，峰點頂約 48.2 */
const WING = { xf: -43, xr: -49.5, sweep: 0.3, span: WING_SPAN, y: 41.4, thick: 1.3 };
/** @type {WingLayer[]} 往後、往下疊的第二層（金）與第三層（朱紅）：每層後移 3 mm、低 1 mm、翼展收 5 mm，從後面看是三排整齊的圓頭羽端、越下層越短 */
const WING_LOWER = [
  { xf: -46, xr: -52.5, sweep: 0.3, span: WING_SPAN - 5, y: 40.9, thick: 1.3 },
  { xf: -49, xr: -55.5, sweep: 0.3, span: WING_SPAN - 10, y: 40.4, thick: 1.3 },
];
/** @type {number} 翼柱的 |z| */
const PYLON_Z = 13;
/**
 * 翼柱側視外形 (x, y)：前緣往後上方斜升的梯形板，頂邊嵌進翼底 0.6 mm，底邊埋進車尾甲板
 * @type {number[][]}
 */
const PYLON = (() => {
  const yUp = WING.y + dihedral(PYLON_Z) + 0.6;
  const xUpF = WING.xf - WING.sweep * PYLON_Z;
  const xUpR = WING.xr - WING.sweep * PYLON_Z;
  return [
    [-31, 29.5],
    [xUpF - 1, yUp],
    [xUpR + 2.5, yUp],
    [-60, 29.5],
  ];
})();

/**
 * 翼端的綠咬鵑羽片（側視，立在翼梢）：前端接翼梢前緣，往後下方拉長成尖尾的長羽
 * @type {number[][]}
 */
const TIP_FEATHER = (() => {
  const y = WING.y + dihedral(WING_SPAN);
  const xf = WING.xf - WING.sweep * WING_SPAN - 3;
  const xr = WING.xr - WING.sweep * WING_SPAN;
  return [
    [xf + 1, y + 1.4],
    [xr, y + 1.8],
    [xr - 3.5, y + 0.8],
    [xr - 6, y - 1.8],
    [xr - 6.5, y - 4.2],
    [xr - 3, y - 3.2],
    [xr + 1, y - 2.2],
    [xf + 3, y - 0.6],
    [xf + 1, y],
  ];
})();

/**
 * 羽片外側的金色羽軸（側視細長條，沿羽片中線從前端到尖尾）
 * @type {number[][]}
 */
const TIP_QUILL = (() => {
  const y = WING.y + dihedral(WING_SPAN);
  const xf = WING.xf - WING.sweep * WING_SPAN - 3;
  const xr = WING.xr - WING.sweep * WING_SPAN;
  return [
    [xf + 2, y + 1],
    [xr - 6, y - 3.5],
    [xr - 5.5, y - 2.8],
    [xf + 2, y + 0.3],
  ];
})();

/** @type {THREE.Color[]} 虹彩色標：鼻段深翠綠、車尾亮翠綠、肩部藍綠光 */
const PLUME = [new THREE.Color(0x04331f), new THREE.Color(0x0e7a45), new THREE.Color(0x12857e)];

/**
 * 綠咬鵑羽的虹彩顏色（線性色彩空間）：沿 x 由鼻段深翠綠漸亮到車尾，越靠肩部越偏藍綠
 * @type {(x: number, y: number, z: number) => number[]}
 */
const plumeColor = (x, y, z) => {
  const u = smoothstep(X_NOSE, X_TAIL, x);
  const c = PLUME[0].clone().lerp(PLUME[1], u);
  const side = smoothstep(0.45, 1, Math.abs(z) / Math.max(1, P.hw(x)));
  c.lerp(PLUME[2], 0.6 * side);
  return [c.r, c.g, c.b];
};

/** @type {number} 鼻頭中央尖刺的刺尖 x（不超過現行版鼻尖 78.6） */
const SPIKE_TIP = 78.1;
/** @type {number} 尖刺根部 x（埋進鼻段殼面） */
const SPIKE_ROOT = 61;
/** @type {number} 尖刺中心線高度（鼻端面上下緣中間） */
const SPIKE_Y = 17.6;

/**
 * 鼻頭中央往前的尖刺：菱形斷面的四角錐（根部半寬 5、半高 2.4），根部埋進鼻段，刺尖往前
 * @type {() => THREE.BufferGeometry}
 */
const buildNoseSpike = () => {
  const len = SPIKE_TIP - SPIKE_ROOT;
  const g = new THREE.ConeGeometry(1, len, 4, 1);
  // 錐尖原本朝 +y：轉成朝 +x，再壓成菱形斷面
  g.rotateZ(-Math.PI / 2);
  g.scale(1, 2.4, 5);
  g.translate(SPIKE_ROOT + len / 2, SPIKE_Y, 0);
  return g;
};

/** @type {number} 翼下金字塔立板的 x（後緣；立板厚 1.6 往車頭方向） */
const PYRAMID_X = -51.2;
/** @type {number[][]} 金字塔立板下段（朱紅斜坡階，正視 (z, y)）：底緣埋進車尾甲板，兩端接黑曜石翼柱 */
const PYRAMID_BASE = [
  [-13, 30],
  [13, 30],
  [13, 34.5],
  [-13, 34.5],
];
/** @type {number[][]} 金字塔立板上段（綠松石立板階，正視 (z, y)）：兩階往上收窄，頂階托住翼的中段 */
const PYRAMID_TOP = [
  [-10.5, 34.3],
  [10.5, 34.3],
  [10.5, 38.3],
  [7.5, 38.3],
  [7.5, 41.8],
  [-7.5, 41.8],
  [-7.5, 38.3],
  [-10.5, 38.3],
];

/**
 * 正視外形 (z, y) 沿 x 擠出成立板：後緣在 PYRAMID_X，厚 1.6 往車頭方向
 * @type {(pts: number[][]) => THREE.BufferGeometry}
 */
const buildPyramidPlate = (pts) => {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, curveSegments: 1 });
  // 形狀平面 (X, Y) = (z, y)，擠出方向 +Z → −x
  g.rotateY(-Math.PI / 2);
  g.translate(PYRAMID_X + 1.6, 0, 0);
  return g;
};

/** @type {number[][]} 金色刀脊（側視，中線上）：鼻段上的一片背鰭，刃尖在 x 65.5 往前接尖刺，刃背沿鼻面升到 x 51；下緣埋進殼面 */
const NOSE_BLADE = [
  [65.5, 24],
  [57.5, 29.3],
  [51, 34.2],
  [47.5, 34.6],
  [48.5, 31],
  [56.5, 25.6],
  [64, 21.3],
];

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
  const zIn = (t) => P.hw(arch.x + r * Math.cos(t)) - 2;
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

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  green: namedMaterial('paint-quetzal-green-metallic', { color: 0x0b5a3a, roughness: 0.26, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  green2: namedMaterial('paint-quetzal-green-metallic', { color: 0x0b5a3a, roughness: 0.26, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  vermilion: namedMaterial('paint-vermilion', { color: 0xd23b22, roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  vermilion2: namedMaterial('paint-vermilion', { color: 0xd23b22, roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  // 立板：綠松石馬賽克的霧面；斜坡：海菊蛤紅霧面
  turq: namedMaterial('paint-turquoise-mosaic', { color: 0x2bb3a3, roughness: 0.62, clearcoat: 0.1 }),
  red: namedMaterial('paint-spondylus-red', { color: 0xb8402a, roughness: 0.62, clearcoat: 0.1 }),
  // 真金屬：羽軸、鼻頭尖刺（Blender 依 -brass 結尾換成金屬）
  gold: namedMaterial('trim-gold-brass', { color: 0xd9b24a, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 黑曜石刀：黑色亮面
  obsidian: namedMaterial('paint-obsidian-blade', { color: 0x101114, roughness: 0.12, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x15201c, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-jade', { color: 0x17603c, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x121416, roughness: 0.6 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x16161c, roughness: 0.05, specularIntensity: 0.7, transparent: true, opacity: 0.8, envMapIntensity: 0.6, depthWrite: false }),
  // 綠咬鵑羽的虹彩漸層貼紙（頂點色）
  dPlume: decalMaterial('decal-gradient-quetzal-plume', { vertexColors: true, roughness: 0.24, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  dGold: decalMaterial('decal-gold-leaf', { color: 0xe0bd55, roughness: 0.3, metalness: 0.7 }),
  dShell: decalMaterial('decal-shell-white', { color: 0xf3ede0, roughness: 0.55 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-jade', { color: 0x123f2b, roughness: 0.7, side: THREE.DoubleSide }),
});

export const quetzalSerpentBody = makePolyBody({
  id: 'body-quetzal-serpent',
  name: '羽蛇',
  style: 'myth',
  phase: 13,
  mythSeries: 'mesoamerican',
  mythTheme: 'feathered-serpent',
  form: 'obsidian-spade',
  roof: 'canopy',
  wing: 'boomerang-plume',
  theme: '特奧蒂瓦坎羽蛇神殿的階梯金字塔、綠咬鵑羽與黑曜石刀，不做蛇頭：寬而薄的鏟形鼻中線立一道金色刀脊、接鼻頭中央往前伸的金色尖刺（一支鼻錐），前擋泥板稜線高過中線成 V 形引擎蓋；車尾迴力鏢海鷗翼（俯視往前尖、後視中央下凹兩端上翹的 M 形），三層往後、往下疊的羽翼（翡翠綠 → 金 → 朱紅，越下層越短，後緣都是整齊的圓頭羽端），翼端各立一片綠咬鵑長羽片（金色羽軸），兩片黑曜石翼柱架起、翼柱之間封一片朱紅＋綠松石的階梯金字塔立板；側面是綠松石立板（階梯回紋）＋朱紅斜坡（兩輪之間外伸側箱封住底盤）；頂面兩道朱紅人字帶＋金邊，翡翠綠金屬漆配朱紅、綠松石與金',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面：擋泥板稜線（2）、肩線（3）、立板下緣（5）、內收階（6）為銳利稜線
  hard: [2, 3, 5, 6],
  step: 0.68,
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 座艙罩：x 25 → −22，最寬 11.5、最高 6.5（罩頂約 39.5），前端收尖
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(25, -22, u);
        const halfW = i === 0 || i === n ? 2 : 11.5 * Math.sin(Math.PI * u ** 1.2) ** 0.55;
        const rise = 6.5 * Math.sin(Math.PI * u ** 1.1) ** 0.65;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 20,
  zones: () => [
    // 海菊蛤紅：內收階以下的斜坡
    { mat: 'red', keep: (x, y) => tableroY(x) - 0.1 - y },
    // 綠松石：立板（肩線以外的直立面）
    { mat: 'turq', keep: (x, y, z) => Math.abs(z) - (P.hw(x) - 0.62) },
    // 朱紅人字帶（頂面）
    { mat: 'vermilion', keep: (x, y, z) => chevronSd(x, z) },
    { mat: 'green', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'green' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'red', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
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
    // 鼻錐：中線金色刀脊（厚 2）接鼻頭中央往前的金色尖刺，前看是一支連續的金色鼻錐
    parts.push({ geometry: mergeGeos([finPlate(NOSE_BLADE, 0, 2), buildNoseSpike()]), mat: 'gold', solid: true, outline: true, name: 'gold-nose-spike' });
    // 層疊羽翼：翡翠綠（上）→ 金 → 朱紅（下、最後），三層後緣都是整齊的圓頭羽端
    parts.push({ geometry: buildWingStrip(WING, -WING.span, WING.span, 0, 1), mat: 'green2', solid: true, outline: true, name: 'gull-wing-green' });
    parts.push({ geometry: buildWingStrip(WING_LOWER[0], -WING_LOWER[0].span, WING_LOWER[0].span, 0, 1), mat: 'gold', solid: true, outline: true, name: 'gull-wing-gold-layer' });
    parts.push({ geometry: buildWingStrip(WING_LOWER[1], -WING_LOWER[1].span, WING_LOWER[1].span, 0, 1), mat: 'vermilion2', solid: true, outline: true, name: 'gull-wing-feathers' });
    // 翼柱（黑曜石）
    parts.push({ geometry: mergeGeos([finPlate(PYLON, PYLON_Z, 1.6), finPlate(PYLON, -PYLON_Z, 1.6)]), mat: 'obsidian', solid: true, outline: true, name: 'wing-pylons' });
    // 翼下金字塔立板：朱紅斜坡階＋兩階綠松石立板，把兩片翼柱之間封住（後視是一座階梯金字塔的剪影）
    parts.push({ geometry: buildPyramidPlate(PYRAMID_BASE), mat: 'vermilion2', solid: true, outline: true, name: 'wing-pyramid-red' });
    parts.push({ geometry: buildPyramidPlate(PYRAMID_TOP), mat: 'turq', solid: true, outline: true, name: 'wing-pyramid-turquoise' });
    // 羽片外側的羽軸（金）
    parts.push({ geometry: mergeGeos([finPlate(TIP_QUILL, WING_SPAN + 0.2, 0.5), finPlate(TIP_QUILL, -WING_SPAN - 0.2, 0.5)]), mat: 'gold', solid: true, outline: true, name: 'plume-quills' });
    // 翼端的綠咬鵑羽片（翡翠綠）
    parts.push({
      geometry: mergeGeos([finPlate(TIP_FEATHER, WING_SPAN - 0.6, 1.2), finPlate(TIP_FEATHER, -WING_SPAN + 0.6, 1.2)]),
      mat: 'green2',
      solid: true,
      outline: true,
      name: 'quetzal-plume-tips',
    });

    /** @type {(x: number, z: number) => boolean} 在頂面（肩線以內） */
    const onTop = (x, z) => Math.abs(z) < P.hw(x) - 0.8;
    // 綠咬鵑羽的虹彩：翡翠綠頂面（人字帶以外）鼻段深翠綠 → 車尾亮翠綠，兩側肩部帶藍綠光
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          if (kit.underCanopy(x, z) > -0.6) {
            return -1;
          }
          return Math.min(-chevronSd(x, z), P.hw(x) - 0.62 - Math.abs(z), y - tableroY(x));
        },
        { offset: 0.03, color: plumeColor },
      ),
      mat: 'dPlume',
      name: 'decal-plume-iridescence',
    });
    // 人字帶兩側的金邊
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, z) || kit.underCanopy(x, z) > -0.6 || x > X_NOSE - 1.5) {
          return -1;
        }
        const s = chevronSd(x, z);
        return 0.4 - Math.abs(s + 0.4);
      }),
      mat: 'dGold',
      name: 'decal-chevron-gold',
    });
    // 肩線下方的金色細線（立板上緣）
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < P.hw(x) - 0.5 || x < X_TAIL + 2 || x > X_NOSE - 2 ? -1 : 0.35 - Math.abs(y - (P.yS(x) - 1.6)))),
      mat: 'dGold',
      name: 'decal-shoulder-gold',
    });
    // 階梯回紋帶（螺貝白）：立板上，x −66 → 22，帶高 4.4（立板下緣往上 0.7 起）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < P.hw(x) - 0.5 || x < -66 || x > 22) {
          return -1;
        }
        const u = z < 0 ? -x : x;
        return -fretSd(u - 1000, y - (tableroY(x) + 0.7));
      }),
      mat: 'dShell',
      name: 'decal-step-fret',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P（推估），比例取自四視圖 02（shared/design/body-quetzal-serpent/fourview_trace.txt）縮到底盤：殼面鼻尖 x 66（鏟形鼻前端面 15.5–20.5）、尖刺到 x 78.1、車尾 −74.5（平台頂 30.5）；半寬後輪 36 / 腰 25（腰線以下側箱 27.3）/ 前輪 26（前輪露出）/ 鏟鼻 33、鼻尖 30；前擋泥板稜線 34；座艙罩頂約 39.5；海鷗翼峰點頂 48.5（全車最高）；前後輪拱 R17.5',
    wing: '層疊海鷗翼（三層各厚 1.3、弦長 6.5，每層後移 3、低 1；翼展半寬 46.5 / 41.5 / 36.5；後緣每 6.6 mm 一個圓頭羽端鼓出 2.2；後視 M 形：中央往外升 5.5 到 |z| 37 再垂 1）、黑曜石翼柱（|z| 13、厚 1.6）、翼下階梯金字塔立板（x −51.2、厚 1.6，朱紅底階 ±13＋綠松石兩階 ±10.5 / ±7.5）、翼端羽片（厚 1.2）與金色羽軸（厚 0.5）、金色刀脊（厚 2）、鼻頭尖刺（菱形斷面四角錐，根部 10 × 4.8、長 17.1）：ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；支柱與刀刃底邊埋進殼面',
    myth: '階梯金字塔（talud-tablero）：MYTH_RESEARCH A2（特奧蒂瓦坎羽蛇神殿）；綠咬鵑羽：A1；綠松石 / 海菊蛤紅 / 螺貝白：A6（大英博物館雙頭蛇）；階梯回紋：A7；黑曜石刀：A2 神殿的黑曜石嵌片與中美洲黑曜石工具',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
