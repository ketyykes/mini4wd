// 雅加婆婆的雞腳小屋（body-yaga-hut，第八階段神話組・斯拉夫）：俄羅斯民間故事裡「站在雞腳上、會轉身的小木屋」（izbushka）——
// Magnus 1916 英譯 Afanasyev：「a little hut standing on cocks' feet and turning round」，要對它說「背對森林站好」才會停下開門。
// iter-115：評審「整棟木屋，最像盒子」→ 先做成一台低矮流線的迷你四驅車殼（斜車頭、屋脊駝峰、車尾收尾、輪拱），小木屋改用表面處理暗示：
// 車頂兩片斜面＝人字屋頂（屋脊沿車長方向、木瓦紋、白色封簷板），側面是 4 根橫向圓木凸紋（殼面剖面本身鼓起），
// 車頭封口是小山牆：一扇俄式雕花窗框（nalichnik：頂冠、側板、窗台；紅窗櫺、暖色窗光）＋白色博風板；車尾屋脊上一根短煙囪當尾翼（chimney-stack）。
// iter-117：側裙下兩根圓木往內收（tumblehome）、輪拱白色翼子板唇、車頭壓低；雞腳改成 Z 形折疊收在側面（最低點 y 9.6）。
// 前後輪之間每側兩隻加長、加粗的雞腳：羽毛大腿貼在圓木牆上、膝關節球、帶鱗片環節的跗蹠、腳踝關節、三前一後的趾（趾節）與深色爪尖。
// 不畫雅加婆婆本人。配色：原木暖褐（霧面）＋深灰褐木瓦屋頂（霧面）＋白色窗飾（霧面）＋黃橙雞腳＋少量紅色窗櫺；暖色窗光。
// 設計：shared/design/body-yaga-hut/DESIGN.md（研究一節列出實際打開的來源）。剖面為本檔站位產生器（推估）。
// 不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾封口 x */
const X_REAR = -56;
/** @type {number} 車頭封口（小山牆）x */
const X_FRONT = 58;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-56, -53, -47, -40, -28, -14, 0, 14, 28, 40, 47, 52, 55.5, 58];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 圓木牆面半寬（接縫處）：前後輪上方是鼓出的翼子板 39.5（輪胎外緣 34.75 之外），前後輪之間收成 32.5 的腰身（雞腳從腰身往外伸出），
  // 往前收成窄車頭（16）、往後收成車尾（26）
  hw: monoCurve(XS, [26, 32, 37, 39.5, 36.2, 31, 30.3, 31, 36.2, 39.5, 36.5, 30, 23, 16]),
  // 屋脊（中線殼頂）：座艙段 41.5 的屋脊駝峰（人字屋面斜約 15°），往前下斜成車頭斜面（26.6）、往後下斜到車尾（28）
  // iter-117：評審「車頭壓低」→ x 52 以前不動，車頭封口頂 26.6 → 24.4（−2.2）
  yTop: monoCurve(XS, [28, 30.5, 33.5, 37, 40.2, 41.5, 41.5, 40.6, 38.6, 35.8, 33, 30.0, 26.6, 24.4]),
  // 屋簷外緣高度（頂面與側面交界）
  yS: monoCurve(XS, [25, 26.5, 28, 29.5, 30, 30.2, 30.2, 30.2, 30, 29.5, 27.5, 25.4, 23.2, 21.8]),
  // 側裙（最下一根圓木）下緣：車尾封口下緣 12.4（遮住後齒輪箱）
  yLow: monoCurve(XS, [12.4, 12.2, 11.6, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11.5, 12.4, 12.9, 13.0]),
};

/** @type {number} 屋簷外伸（屋面外緣超出圓木牆的距離） */
const EO = 1.4;
/** @type {number} 封簷板高度 */
const FASCIA_H = 1.0;
/** @type {number} 屋簷底到牆頂（最上一根圓木上緣）的內收高度 */
const TUCK_H = 0.3;
/** @type {number} 圓木根數 */
const LOG_COUNT = 4;
/** @type {number} 圓木鼓起量 */
const LOG_BULGE = 0.8;

/** @type {number} 側裙內收量（iter-117 tumblehome：上兩根圓木是肩線，往下兩根逐根往內收，最下緣比肩線窄 2.8 mm） */
const TUMBLE = 2.8;
/** @type {number[]} 各圓木下緣接縫的內收比例（j = 0 → 3，最上一根到最下一根） */
const TUMBLE_K = [0, 0, 0.36, 1];

/** @type {(x: number) => number} 牆頂（最上一根圓木上緣）高度 */
const yWallTop = (x) => P.yS(x) - FASCIA_H - TUCK_H;
/** @type {(x: number) => number} 每根圓木高度 */
const logH = (x) => (yWallTop(x) - P.yLow(x)) / LOG_COUNT;
/** @type {(x: number, az: number) => number} 屋面高度（|z| 處，直線斜面） */
const roofY = (x, az) => P.yTop(x) - ((P.yTop(x) - P.yS(x)) * az) / (P.hw(x) + EO);

/**
 * 半剖面：屋脊 → 直線屋面 → 屋簷外緣（銳利）→ 封簷板（垂直）→ 屋簷底內收 → 4 根圓木（每根鼓起 + 銳利接縫）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const h = P.hw(x);
  const yW = yWallTop(x);
  const L = logH(x);
  /** @type {number[][]} */
  const pts = [
    [0, t],
    [0.5 * (h + EO), lerp(t, s, 0.5)],
    [h + EO, s],
    [h + EO, s - FASCIA_H],
    [h, yW],
  ];
  for (let j = 0; j < LOG_COUNT; j++) {
    const yT = yW - j * L;
    const inTop = j === 0 ? 0 : TUMBLE * TUMBLE_K[j - 1];
    const inBot = TUMBLE * TUMBLE_K[j];
    pts.push([h + LOG_BULGE - 0.5 * (inTop + inBot), yT - 0.5 * L], [h - inBot, yT - L]);
  }
  return pts;
};

/**
 * 圓木牆在高度 y 的接縫 |z|（不含鼓起；iter-117 側裙內收後，牆面判斷與翼子板唇要跟著內收走）
 * @type {(x: number, y: number) => number}
 */
const wallZ = (x, y) => {
  const q = Math.max(0, Math.min(LOG_COUNT, (yWallTop(x) - y) / logH(x)));
  const j = Math.min(LOG_COUNT - 1, Math.floor(q));
  const inTop = j === 0 ? 0 : TUMBLE_K[j - 1];
  return P.hw(x) - TUMBLE * lerp(inTop, TUMBLE_K[j], q - j);
};
/** @type {number[]} 銳利稜線：屋簷外緣、封簷板下緣、牆頂、圓木接縫 */
const HARD = [2, 3, 4, 6, 8, 10];

/** @type {{ x: number, pts: number[][] }[]} 車尾與車頭每 0.75 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -47, 0.75, profile).slice(0, -1), ...buildStations(-47, 51, 2, profile).slice(0, -1), ...buildStations(51, X_FRONT, 0.75, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R15：26 mm 輪胎半徑 13 + 2 mm；31 mm 輪需切輪拱） */
const ARCHES = [
  { x: 40, y: 13, radius: 15, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 15, cutZFrom: 22.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, y: number, z: number) => boolean} 屋面 */
const onRoof = (x, y, z) => y > P.yS(x) - 0.05 && Math.abs(z) < P.hw(x) + EO - 0.05;
/** @type {(x: number, y: number, z: number) => boolean} 圓木牆 */
const onWall = (x, y, z) => y < yWallTop(x) + 0.05 && Math.abs(z) > wallZ(x, y) - 0.3;
/** @type {(x: number, y: number) => number} 圓木編號（0 = 最上一根） */
const logIndex = (x, y) => Math.floor((yWallTop(x) - y) / logH(x));

/** @type {number} 木瓦排距（沿屋面的水平 |z| 間距）與每片寬（沿 x） */
const SHINGLE_ROW = 3.4;
/** @type {number} */
const SHINGLE_W = 3.2;

/** @type {{ x: number, w: number, y0: number, y1: number }} 側面窗（前後輪之間，圓木牆上的貼紙） */
const SIDE_WINDOW = { x: 0, w: 7.2, y0: 16, y1: 21.8 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 原木：霧面（roughness 0.65–0.75）
  log: namedMaterial('paint-log-pine', { color: 0x8c5a32, roughness: 0.7, clearcoat: 0.03 }),
  logDark: namedMaterial('paint-log-pine-aged', { color: 0x74482a, roughness: 0.72, clearcoat: 0.03 }),
  gable: namedMaterial('paint-gable-plank', { color: 0x5e3b22, roughness: 0.72, clearcoat: 0.03 }),
  // 木瓦屋頂（風化的白楊木瓦：深灰褐，霧面）
  shingle: namedMaterial('paint-shingle-aspen', { color: 0x5a5249, roughness: 0.76, clearcoat: 0.02 }),
  shingleDark: namedMaterial('paint-shingle-aspen-dark', { color: 0x4a433c, roughness: 0.78, clearcoat: 0.02 }),
  soffit: namedMaterial('paint-soffit-dark', { color: 0x3a281a, roughness: 0.75, clearcoat: 0.02 }),
  // 白色窗飾 / 封簷板 / 博風板（白漆木作，霧面）
  white: namedMaterial('paint-nalichnik-white', { color: 0xf0ece2, roughness: 0.6, clearcoat: 0.05 }),
  white2: namedMaterial('paint-nalichnik-white', { color: 0xf0ece2, roughness: 0.6, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 紅色窗櫺（少量點綴）
  red: namedMaterial('paint-window-red', { color: 0xb3302a, roughness: 0.58, clearcoat: 0.08 }),
  // 煙囪：紅磚＋白灰帽（霧面）
  brick: namedMaterial('paint-brick-red', { color: 0x9b4a32, roughness: 0.78, clearcoat: 0.0 }),
  // 雞腳：羽毛大腿（褐色霧面）＋黃橙跗蹠與趾（霧面射出塑膠）＋較深的鱗片環＋深色爪尖
  feather: namedMaterial('paint-hen-feather-brown', { color: 0x6b4426, roughness: 0.72, clearcoat: 0.02 }),
  claw: namedMaterial('paint-claw-ochre', { color: 0xe0962c, roughness: 0.6, clearcoat: 0.05 }),
  scale: namedMaterial('paint-claw-scale-ochre', { color: 0xb8721c, roughness: 0.62, clearcoat: 0.05 }),
  clawTip: namedMaterial('paint-claw-horn', { color: 0x3b2a1e, roughness: 0.5, clearcoat: 0.1 }),
  // 窗內暖光
  window: namedMaterial('lamp-window-warm', { color: 0xffc46b, emissive: 0xff9a2e, emissiveIntensity: 0.45, roughness: 0.2, clearcoat: 0.6 }),
  hole: namedMaterial('plastic-chimney-black', { color: 0x120d0a, roughness: 0.9 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-wood', { color: 0x4a2f1b, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-wood', { color: 0x2e1f14, roughness: 0.8, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGroove: decalMaterial('decal-moss-caulk', { color: 0x2b2116, roughness: 0.85 }),
  dShingleGap: decalMaterial('decal-shingle-gap', { color: 0x2a2520, roughness: 0.85 }),
  dWhite: decalMaterial('decal-nalichnik-white', { color: 0xf0ece2, roughness: 0.6 }),
  dRed: decalMaterial('decal-window-red', { color: 0xb3302a, roughness: 0.58 }),
});

/**
 * 山牆上的立板（(z, y) 平面的多邊形，可含孔），沿 x 往外長 thick；dir = +1 車頭山牆、−1 車尾山牆
 * @type {(pts: number[][], holes: number[][][], xFace: number, thick: number, dir: number) => THREE.BufferGeometry}
 */
const gablePlate = (pts, holes, xFace, thick, dir) => {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 16 });
  // 局部 +Z（厚度）→ 世界 +X；局部 +X → 世界 −Z（圖形左右對稱，不影響）
  g.rotateY(Math.PI / 2);
  if (dir < 0) {
    g.scale(-1, 1, 1);
    // 鏡射後繞向反轉，翻回來（封閉網格才能用散度定理算體積）
    const idx = g.index;
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
    } else {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        for (const c of [0, 1, 2]) {
          const a = pos.getComponent(i + 1, c);
          pos.setComponent(i + 1, c, pos.getComponent(i + 2, c));
          pos.setComponent(i + 2, c, a);
        }
      }
    }
    g.computeVertexNormals();
  }
  g.translate(xFace - dir * 0.15, 0, 0);
  return g;
};

/** @type {(cz: number, cy: number, r: number, n?: number) => number[][]} 圓（孔用，順時針） */
const circlePts = (cz, cy, r, n = 14) => {
  /** @type {number[][]} */
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (-2 * Math.PI * i) / n;
    out.push([cz + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
};

/** @type {(z0: number, z1: number, y0: number, y1: number) => number[][]} 矩形（孔用，順時針） */
const rectPts = (z0, z1, y0, y1) => [
  [z0, y0],
  [z0, y1],
  [z1, y1],
  [z1, y0],
];

/** @type {number} 車頭窗框的縮放（相對 iter-114 的山牆窗框；iter-115 車頭封口變矮） */
const NK = 0.58;
/** @type {(p: number[]) => number[]} iter-114 窗框座標（窗洞下緣 y 26.8）→ 本輪車頭封口座標（iter-117 車頭壓低：窗洞下緣 16.8 → 15.6、縮放 0.62 → 0.58，頂冠尖 24.0 低於屋脊 24.4） */
const nkMap = ([z, y]) => [z * NK, 15.6 + (y - 26.8) * NK];

/** @type {{ hw: number, y0: number, y1: number }} 車頭窗洞（|z| ≤ 2.09、y 15.6–19.2） */
const FRONT_WINDOW = { hw: 3.6 * NK, y0: 15.6, y1: 15.6 + 6.2 * NK };

/**
 * 車頭雕花窗框（nalichnik）：頂冠（kokoshnik 尖拱，鏤空一圓兩小圓）、兩側直板、外伸的窗台、窗台下波浪垂飾（podzor）
 * @type {() => THREE.BufferGeometry}
 */
const buildNalichnik = () => {
  /** @type {number[][]} 右半外形（由下中央往右、往上到頂冠尖），再鏡射成整圈 */
  const right = [
    [0, 22.7],
    [1.5, 23.8],
    [3, 23.2],
    [4.6, 24.1],
    [6.2, 23.7],
    [6.2, 25.4],
    [7.1, 25.4],
    [7.1, 26.5],
    [5.6, 26.5],
    [5.6, 34.4],
    [6.9, 34.4],
    [6.9, 35.4],
    [6.1, 36.4],
    [4.9, 37.7],
    [3.2, 38.9],
    [1.5, 39.9],
    [0, 41.3],
  ].map(nkMap);
  const outline = [...right, ...right.slice(1, -1).reverse().map(([z, y]) => [-z, y])];
  outline.reverse();
  const W = FRONT_WINDOW;
  const holes = [rectPts(-W.hw, W.hw, W.y0, W.y1), circlePts(...nkMap([0, 36.6]), 0.9 * NK), circlePts(...nkMap([-3.1, 35.8]), 0.6 * NK), circlePts(...nkMap([3.1, 35.8]), 0.6 * NK)];
  return gablePlate(outline, holes, X_FRONT, 1.0, 1);
};

/**
 * 紅色窗櫺：窗洞內一圈窗框＋十字櫺（四格窗）
 * @type {() => THREE.BufferGeometry}
 */
const buildSash = () => {
  const { hw, y0, y1 } = FRONT_WINDOW;
  const outline = [
    [-hw, y0],
    [hw, y0],
    [hw, y1],
    [-hw, y1],
  ];
  const ym = (y0 + y1) / 2;
  const f = 0.4;
  const m = 0.3;
  const holes = [rectPts(-hw + f, -m, y0 + f, ym - m), rectPts(m, hw - f, y0 + f, ym - m), rectPts(-hw + f, -m, ym + m, y1 - f), rectPts(m, hw - f, ym + m, y1 - f)];
  return gablePlate(outline, holes, X_FRONT, 0.7, 1);
};

/**
 * 博風板（prichelina）：沿封口兩條屋面邊緣的白色板帶，下緣是波浪雕花；屋脊下一片尖底垂飾
 * @type {(xFace: number, dir: number) => THREE.BufferGeometry}
 */
const buildBargeboards = (xFace, dir) => {
  const t = P.yTop(xFace);
  const s = P.yS(xFace);
  const ez = P.hw(xFace) + EO;
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  const len = Math.hypot(ez, t - s);
  const nz = (t - s) / len;
  const ny = ez / len;
  for (const sg of [-1, 1]) {
    const n = 20;
    /** @type {number[][]} */
    const top = [];
    /** @type {number[][]} */
    const bottom = [];
    for (let i = 0; i <= n; i++) {
      const q = i / n;
      const z = lerp(ez - 0.2, 0.7, q);
      const y = t - ((t - s) * z) / ez + 0.15;
      top.push([sg * z, y]);
      // 下緣波浪：4 個半圓扇
      const depth = 1.0 + 0.5 * Math.abs(Math.sin(Math.PI * q * 4));
      bottom.push([sg * (z - nz * depth), y - ny * depth]);
    }
    const pts = [...top, ...bottom.reverse()];
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [z0, y0] = pts[i];
      const [z1, y1] = pts[(i + 1) % pts.length];
      area += z0 * y1 - z1 * y0;
    }
    if (area < 0) {
      pts.reverse();
    }
    geos.push(gablePlate(pts, [], xFace, 0.9, dir));
  }
  // 屋脊垂飾（只在車尾封口；車頭封口的屋脊下是窗框頂冠）
  if (dir > 0) {
    return mergeGeos(geos);
  }
  geos.push(
    gablePlate(
      [
        [-0.8, t - 0.2],
        [-0.8, t - 2.6],
        [0, t - 3.6],
        [0.8, t - 2.6],
        [0.8, t - 0.2],
      ].reverse(),
      [],
      xFace,
      0.9,
      dir,
    ),
  );
  return mergeGeos(geos);
};

/** @type {number} 煙囪中心 x（車尾屋脊上） */
const CHIMNEY_X = -44;

/**
 * 煙囪（尾翼 chimney-stack）：磚砌方柱＋白灰帽＋黑色煙口；頂端 ≤ 50
 * @type {() => { stack: THREE.BufferGeometry, cap: THREE.BufferGeometry, hole: THREE.BufferGeometry }}
 */
const buildChimney = () => {
  const xc = CHIMNEY_X;
  const s = 5.2;
  const yBase = roofY(xc - s / 2, s / 2) - 0.9;
  const yTop = 48.1;
  const stack = new THREE.BoxGeometry(s, yTop - yBase, s);
  stack.translate(xc, (yTop + yBase) / 2, 0);
  const cap = new THREE.BoxGeometry(6.8, 1.2, 6.8);
  cap.translate(xc, yTop + 0.6, 0);
  const hole = new THREE.BoxGeometry(3.2, 0.3, 3.2);
  hole.translate(xc, yTop + 1.2 + 0.1, 0);
  return { stack, cap, hole };
};

/** @type {number[]} 雞腳的 x 位置（前後輪之間，每側一對；腳掌往前） */
const FEET_X = [11, -17];

/** @type {number} 雞腳最低點的下限（iter-117：高於殼下緣 10.5 以下 1 mm、遠高於底盤最低點 y 2.2，不刮賽道） */
const FOOT_MIN_Y = 9.4;

/** @type {number} 膝關節 |z|（折疊的膝往外撐，像蹲坐的雞；俯視仍看得到四個膝，維持和其他寬殼的輪廓差異） */
const KNEE_Z = 43.8;

/**
 * 雞腳（iter-117 收起：評審「雞腳垂到底盤高度，有離地間隙風險」→ 改成像收起的起落架，Z 形折疊貼在側面）：
 * 羽毛大腿從腰身圓木牆（髖 y 22.4）往前、往外陡斜而下到膝（y 14.6、|z| 43.8）→ 膝關節球 → 跗蹠往後下折回到腳踝（y 11.6，4 圈鱗片環）→
 * 腳踝關節球 → 三根往前、貼著最下一根圓木蜷起的趾（趾節＋往上勾的爪尖）＋一根往後的後趾。
 * 最低點 ≥ FOOT_MIN_Y；外側最寬約 |z| 45.6（膝球）
 * @type {() => { thigh: THREE.BufferGeometry, leg: THREE.BufferGeometry, scales: THREE.BufferGeometry, tips: THREE.BufferGeometry }}
 */
const buildFeet = () => {
  /** @type {THREE.BufferGeometry[]} */
  const thighs = [];
  /** @type {THREE.BufferGeometry[]} */
  const legs = [];
  /** @type {THREE.BufferGeometry[]} */
  const scales = [];
  /** @type {THREE.BufferGeometry[]} */
  const tips = [];
  for (const sg of [-1, 1]) {
    for (const fx of FEET_X) {
      /** @type {(x: number, y: number) => number} 該高度圓木牆外面（含鼓起約一半） */
      const wallOut = (x, y) => wallZ(x, y) + 0.5 * LOG_BULGE;
      // 羽毛大腿：根部埋進牆面 0.6 mm（粗 4.6 → 3.6）
      const hip = [fx - 2.0, 22.4, sg * (wallOut(fx - 2.0, 22.4) - 0.6)];
      const knee = [fx + 3.4, 14.6, sg * KNEE_Z];
      const ankle = [fx - 3.4, 11.4, sg * (wallOut(fx - 3.4, 11.4) + 3.4)];
      thighs.push(smoothNormals(sweepEllipse([hip, [lerp(hip[0], knee[0], 0.5), lerp(hip[1], knee[1], 0.5) + 0.4, lerp(hip[2], knee[2], 0.5) + sg * 0.6], knee], 10, (q) => [lerp(2.7, 1.8, q), lerp(2.7, 1.8, q)], 14)));
      // 膝關節球
      const kb = new THREE.SphereGeometry(1.75, 16, 12);
      kb.translate(...knee);
      legs.push(kb);
      // 跗蹠（粗 2.7 → 2.3），往後下折回
      legs.push(smoothNormals(sweepEllipse([knee, [lerp(knee[0], ankle[0], 0.5), lerp(knee[1], ankle[1], 0.5), lerp(knee[2], ankle[2], 0.5) + sg * 0.3], ankle], 10, (q) => [lerp(1.35, 1.15, q), lerp(1.35, 1.15, q)], 12)));
      // 鱗片環：沿跗蹠 4 圈（半徑 + 0.25、厚 0.6），像雞腳的橫鱗
      const axis = new THREE.Vector3(ankle[0] - knee[0], ankle[1] - knee[1], ankle[2] - knee[2]).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
      for (const q of [0.28, 0.46, 0.64, 0.82]) {
        const ring = new THREE.CylinderGeometry(lerp(1.6, 1.4, q), lerp(1.6, 1.4, q), 0.6, 14);
        ring.applyQuaternion(quat);
        ring.translate(lerp(knee[0], ankle[0], q), lerp(knee[1], ankle[1], q), lerp(knee[2], ankle[2], q));
        scales.push(ring);
      }
      // 腳踝關節球
      const ab = new THREE.SphereGeometry(1.4, 14, 10);
      ab.translate(...ankle);
      legs.push(ab);
      // [往外偏的 z 量（mm）, 長, 末端往上勾的高度]：三前趾貼著最下一根圓木往前、末端往上勾；後趾往後
      for (const [dzOut, len, lift, dir] of [
        [0.4, 7.4, 1.6, 1],
        [1.6, 6.4, 1.4, 1],
        [-0.9, 5.6, 1.4, 1],
        [0.6, 3.2, 0.8, -1],
      ]) {
        const x2 = ankle[0] + dir * len;
        const p0 = ankle;
        const p1 = [ankle[0] + dir * len * 0.5, FOOT_MIN_Y + 1.0, sg * (wallOut(ankle[0] + dir * len * 0.5, 11) + 1.6 + 0.5 * dzOut)];
        const p2 = [x2, FOOT_MIN_Y + 1.0 + lift, sg * (wallOut(x2, 11) + 1.4 + dzOut)];
        legs.push(smoothNormals(sweepEllipse([p0, p1, p2], 8, (q) => [lerp(1.0, 0.6, q), lerp(0.9, 0.55, q)], 10)));
        // 趾節（中段的小關節）
        const kn = new THREE.SphereGeometry(0.85, 10, 8);
        kn.translate(...p1);
        scales.push(kn);
        // 爪尖：沿趾末端方向的小圓錐（往上勾）
        const d = new THREE.Vector3(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]).normalize();
        const tip = new THREE.ConeGeometry(0.5, 1.5, 10);
        tip.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
        tip.translate(p2[0] + d.x * 0.6, p2[1] + d.y * 0.6, p2[2] + d.z * 0.6);
        tips.push(tip);
      }
    }
  }
  return { thigh: mergeGeos(thighs), leg: mergeGeos(legs), scales: mergeGeos(scales), tips: mergeGeos(tips) };
};

/**
 * 翼子板唇（iter-117：評審「少了輪拱造型」）：沿輪拱切口外 0.9 mm 的白色雕花木眉，外凸圓木牆 1.2–1.8 mm；
 * 輪拱頂端高過牆頂的那段沿屋簷封簷板外側走（翼子板和屋簷接成一體）
 * @type {() => THREE.BufferGeometry}
 */
const buildFenderLips = () => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const arch of ARCHES) {
    for (const sg of [-1, 1]) {
      /** @type {number[][]} */
      const pts = [];
      const r = arch.radius + 0.9;
      for (let i = 0; i <= 64; i++) {
        const t = 0.03 + ((Math.PI - 0.06) * i) / 64;
        const x = arch.x + r * Math.cos(t);
        const y = arch.y + r * Math.sin(t);
        if (y < P.yLow(x) + 0.5) {
          continue;
        }
        const zBase = y > yWallTop(x) ? P.hw(x) + EO : wallZ(x, y) + 0.5 * LOG_BULGE;
        pts.push([x, y, sg * (zBase + 0.5)]);
      }
      if (pts.length > 3) {
        geos.push(smoothNormals(sweepEllipse(pts, 64, () => [1.0, 1.1], 12)));
      }
    }
  }
  return mergeGeos(geos);
};

export const yagaHutBody = makePolyBody({
  id: 'body-yaga-hut',
  name: '雅加婆婆的雞腳小屋',
  style: 'myth',
  phase: 8,
  mythSeries: 'slavic',
  mythTheme: 'baba-yaga-hut',
  form: 'log-hut',
  roof: 'closed',
  wing: 'chimney-stack',
  theme: '低矮流線車殼上的小木屋：車頂兩片斜面當人字木瓦屋頂（白色封簷板）、側面 4 根橫向圓木凸紋、車頭小山牆的白色雕花窗框（紅窗櫺、暖色窗光）與博風板、車尾短煙囪尾翼；前後輪之間兩對加長的雞腳（羽毛大腿、膝關節、鱗片跗蹠、三前一後的爪）',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: HARD,
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    // 白色封簷板（屋簷外緣的垂直板）
    { mat: 'white', keep: (x, y, z) => Math.abs(z) - (P.hw(x) + EO - 0.08) },
    // 屋簷底（深色內收）
    { mat: 'soffit', keep: (x, y, z) => (y > yWallTop(x) - 0.1 && y < P.yS(x) - FASCIA_H + 0.05 && Math.abs(z) > P.hw(x) + 0.05 ? 1 : -1) },
    // 木瓦：每排錯開半片，深淺交錯
    {
      mat: 'shingleDark',
      keep: (x, y, z) => {
        if (!onRoof(x, y, z)) {
          return -1;
        }
        const row = Math.floor((P.hw(x) + EO - Math.abs(z)) / SHINGLE_ROW);
        const col = Math.floor((x + (row % 2) * SHINGLE_W * 0.5) / SHINGLE_W);
        return (row + col) % 3 === 0 ? 1 : -1;
      },
    },
    { mat: 'shingle', keep: (x, y, z) => (onRoof(x, y, z) ? 1 : -1) },
    // 圓木牆：深淺交錯（同一批木料的色差）
    { mat: 'logDark', keep: (x, y) => (logIndex(x, y) % 2 === 1 ? 1 : -1) },
    { mat: 'log', keep: () => 1 },
  ],
  // 車頭小山牆：屋簷以上是深色山牆板，以下是圓木
  capFrontBands: [{ yMin: P.yS(X_FRONT) - FASCIA_H, mat: 'gable' }, { mat: 'log' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'log', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）＋輪胎內側環形擋板（kitsune-ninetail 的 buildArchWell，擋住輪室看進車身內部）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 15.6, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });
    // 車頭雕花窗框＋紅窗櫺＋窗內暖光
    parts.push({ geometry: buildNalichnik(), mat: 'white', solid: true, outline: true, name: 'front-nalichnik' });
    parts.push({ geometry: buildSash(), mat: 'red', solid: true, name: 'front-window-sash' });
    {
      const W = FRONT_WINDOW;
      const pane = new THREE.BoxGeometry(0.3, W.y1 - W.y0, W.hw * 2);
      pane.translate(X_FRONT + 0.1, (W.y0 + W.y1) / 2, 0);
      parts.push({ geometry: pane, mat: 'window', solid: true, name: 'front-window-glow' });
    }
    // 前後封口博風板＋屋脊垂飾
    parts.push({ geometry: mergeGeos([buildBargeboards(X_FRONT, 1), buildBargeboards(X_REAR, -1)]), mat: 'white2', solid: true, outline: true, name: 'gable-bargeboards' });
    // 煙囪（尾翼 chimney-stack）
    const ch = buildChimney();
    parts.push({ geometry: ch.stack, mat: 'brick', solid: true, outline: true, name: 'chimney-stack' });
    parts.push({ geometry: ch.cap, mat: 'white', solid: true, outline: true, name: 'chimney-cap' });
    parts.push({ geometry: ch.hole, mat: 'hole', solid: true, name: 'chimney-flue' });
    // 雞腳
    const feet = buildFeet();
    parts.push({ geometry: feet.thigh, mat: 'feather', solid: true, outline: true, name: 'hen-thighs' });
    parts.push({ geometry: feet.leg, mat: 'claw', solid: true, outline: true, name: 'hen-feet' });
    parts.push({ geometry: feet.scales, mat: 'scale', solid: true, outline: true, name: 'hen-scales' });
    parts.push({ geometry: feet.tips, mat: 'clawTip', solid: true, outline: true, name: 'hen-claw-tips' });
    // 翼子板唇（iter-117）
    parts.push({ geometry: buildFenderLips(), mat: 'white', solid: true, outline: true, name: 'fender-lips' });

    // ---- 貼紙 ----
    // 圓木接縫（苔蘚填縫，深色 0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onWall(x, y, z)) {
          return -1;
        }
        const L = logH(x);
        const q = (yWallTop(x) - y) / L;
        if (q < 0.5 || q > LOG_COUNT - 0.5) {
          return -1;
        }
        return 0.35 - Math.abs(q - Math.round(q)) * L;
      }, { offset: 0.1 }),
      mat: 'dGroove',
      name: 'decal-log-chinks',
    });
    // 木瓦縫：每排下緣橫縫＋片與片之間的直縫（線寬 0.6）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onRoof(x, y, z)) {
          return -1;
        }
        const u = (P.hw(x) + EO - Math.abs(z)) / SHINGLE_ROW;
        const row = Math.floor(u);
        const rowLine = (0.5 - Math.abs(u - Math.round(u))) * SHINGLE_ROW;
        const v = (x + (row % 2) * SHINGLE_W * 0.5) / SHINGLE_W;
        const colLine = Math.abs(v - Math.round(v)) * SHINGLE_W;
        // 屋脊兩側 1.2 mm 不畫（屋脊壓條）
        return Math.min(0.3 - Math.min(SHINGLE_ROW / 2 - rowLine, colLine), Math.abs(z) - 1.4);
      }, { offset: 0.1 }),
      mat: 'dShingleGap',
      name: 'decal-shingle-gaps',
    });
    // 屋脊壓條（深色 2.4 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) ? 1.2 - Math.abs(z) : -1), { offset: 0.12 }),
      mat: 'dGroove',
      name: 'decal-ridge-board',
    });
    // 側面窗：暖光窗格＋白色雕花窗框（頂冠、側板、窗台、垂飾）＋紅色十字櫺
    const W = SIDE_WINDOW;
    /** @type {(x: number, y: number) => number} 窗洞（負值 = 在窗內） */
    const sideHole = (x, y) => Math.max(Math.abs(x - W.x) - W.w / 2, Math.abs(y - (W.y0 + W.y1) / 2) - (W.y1 - W.y0) / 2);
    /** @type {(x: number, y: number) => number} 窗框外形（負值 = 在框內） */
    const sideFrame = (x, y) => {
      const ax = Math.abs(x - W.x);
      const boards = Math.max(ax - (W.w / 2 + 1.4), W.y0 - 1 - y, y - (W.y1 + 0.8));
      const sill = Math.max(ax - (W.w / 2 + 2.3), Math.abs(y - (W.y0 - 1.2)) - 0.6);
      const apron = Math.max(ax - (W.w / 2 + 1.1), W.y0 - 3.0 + 0.5 * Math.abs(Math.sin((Math.PI * (x - W.x)) / 2.2)) - y, y - (W.y0 - 1.6));
      const crownH = 4.0 * (1 - (ax / (W.w / 2 + 2.2)) ** 1.6);
      const crown = Math.max(ax - (W.w / 2 + 2.2), W.y1 + 0.6 - y, y - (W.y1 + 0.6 + crownH));
      return Math.min(boards, sill, apron, crown);
    };
    /** @type {(x: number, y: number, z: number) => boolean} 側牆、輪拱外 */
    const onSideWall = (x, y, z) => onWall(x, y, z) && archRingDist(x, y) > 1;
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) ? -sideHole(x, y) : -1), { offset: 0.12 }),
      mat: 'window',
      name: 'lamp-side-windows',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const fret = 0.7 - Math.hypot(Math.abs(x - W.x), y - (W.y1 + 2.3));
        return Math.min(-sideFrame(x, y), sideHole(x, y), -fret);
      }, { offset: 0.14 }),
      mat: 'dWhite',
      name: 'decal-side-nalichnik',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = sideHole(x, y);
        const ring = Math.min(-d, d + 0.6);
        const cross = Math.min(-d, 0.32 - Math.min(Math.abs(x - W.x), Math.abs(y - (W.y0 + W.y1) / 2)));
        return Math.max(ring, cross);
      }, { offset: 0.16 }),
      mat: 'dRed',
      name: 'decal-side-sash',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: `本檔站位產生器 P（推估，iter-115 改成低矮流線車殼）：殼 x ${X_REAR} ~ ${X_FRONT}；屋脊最高 41.5（iter-115 規格「車高 ≤ 45」）、屋簷 30.2、車頭封口頂 26.6、車尾 28；圓木牆半寬：翼子板 39.5、腰身 30.3（iter-117；＋鼓起 0.8；下兩根圓木內收 ≤ 2.8）、屋簷外伸 1.4；煙囪頂約 49.5（規格「含煙囪 ≤ 50」）；雞腳外側約 |z| 45.6（車殼外框半寬 ≤ 48，碰撞體不寬過導輪外緣 ±48.5）`,
    wheelArches: '前後 R15（26 mm 輪胎半徑 13 + 2 mm）；31 mm 輪不切輪拱時間隙不足（需切輪拱，batch5 未要求）；輪拱內襯＋輪胎內側環形擋板（buildArchWell）擋住殼內空腔',
    logs: '圓木：殼面剖面每根鼓起 0.8 mm（高約 4.5 mm，前後端隨牆高縮小）；接縫為銳利稜線＋0.7 mm 深色填縫貼紙（推估）',
    nalichnik: '車頭雕花窗框：白色 1.0 mm 立板（iter-114 山牆窗框縮成 0.62 倍：頂冠尖拱、側板、窗台、波浪垂飾）＋紅色 0.7 mm 十字窗櫺；側面窗為貼紙（推估）',
    feet: '雞腳（iter-117 折疊）：每側 2 隻；羽毛大腿粗 3.6–5.4 mm（髖在腰身牆上 y 22.4、膝在 |z| 43.8、y 14.6）、膝關節球 R1.75、跗蹠粗 2.3–2.7 mm＋4 圈鱗片環、腳踝球 R1.4、3 前趾（長 5.4–7.2）＋1 後趾（3.2）＋趾節球與爪尖（推估）；最低點 y 9.6',
    chimney: '煙囪：5.2 × 5.2 mm 實心方柱（屋面下 0.9 mm 起）＋6.8 × 1.2 × 6.8 mm 白灰帽（推估）',
    iter117: 'iter-117（評審 iter-116「方盒、側面垂直、雞腳垂到底盤高度」）：圓木牆上兩根是肩線，下兩根往內收（最下緣窄 2.8 mm，tumblehome）；前後輪拱加白色翼子板唇（外凸 1.2–1.8 mm，斷面 1.0 × 1.1 mm 橢圓）；車頭封口頂 26.6 → 24.4、窗框 0.62 → 0.58 倍；腰身半寬 32.5 → 30.3（維持俯視 IoU ≤ 0.845）；雞腳改成 Z 形折疊貼在側面（膝 |z| 43.8、y 14.6，腳趾貼最下一根圓木，最低點 y 9.6 ≥ 底盤最低點 2.2）（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
