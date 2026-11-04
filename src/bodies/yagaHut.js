// 雅加婆婆的雞腳小屋（body-yaga-hut，第八階段神話組・斯拉夫）：俄羅斯民間故事裡「站在雞腳上、會轉身的小木屋」（izbushka）——
// Magnus 1916 英譯 Afanasyev：「a little hut standing on cocks' feet and turning round」，要對它說「背對森林站好」才會停下開門。
// 不畫雅加婆婆本人。整台車是一間小木屋：側面 4 根橫向圓木（殼面本身做出圓木的鼓起與接縫）、四角的圓木端頭交錯伸出（log cabin 角接）、
// 人字屋頂（屋脊沿車長方向，屋面木瓦紋，屋簷下白色封簷板）、車頭山牆一扇俄式雕花窗框（nalichnik：頂冠、側板、窗台與垂飾；紅色窗櫺）、
// 山牆白色博風板與屋脊垂飾、車尾屋脊上一根短煙囪（尾翼 chimney-stack）；側裙下緣在前後輪之間露出兩對抽象的三趾鳥爪（雞腳）。
// 配色：原木暖褐（霧面）＋深灰褐木瓦屋頂（霧面）＋白色窗飾（霧面）＋黃橙雞腳＋少量紅色窗櫺；暖色窗光。
// 設計：shared/design/body-yaga-hut/DESIGN.md（研究一節列出實際打開的來源）。剖面為本檔站位產生器（推估）。
// 不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { buildStations, smoothNormals } from './gazelleLeap.js';
import { profileZAtY } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 牆面（殼面）前後端 x：車頭山牆 / 車尾山牆 */
const X_FRONT = 53;
/** @type {number} */
const X_REAR = -53.8;
/** @type {number} 屋脊高度 */
const RIDGE_Y = 43.6;
/** @type {number} 屋簷外緣（頂面）高度與半寬 */
const EAVE_Y = 29.6;
/** @type {number} */
const EAVE_Z = 38.2;
/** @type {number} 封簷板下緣高度 */
const FASCIA_Y = 29.0;
/** @type {number} 圓木接縫（凹處）與圓木鼓起最外處的 |z| */
const WALL_IN = 37.0;
/** @type {number} */
const WALL_OUT = 38.0;
/** @type {number} 最上一根圓木的上緣（= 封簷板下緣）與每根圓木高度 */
const LOG_TOP = FASCIA_Y;
/** @type {number} */
const LOG_H = 3.8;
/** @type {number} 圓木根數（最下一根下緣 = 牆底 13.8） */
const LOG_COUNT = 4;
/** @type {number} 牆底（側裙下緣）高度 */
const WALL_BOTTOM = LOG_TOP - LOG_COUNT * LOG_H;

/** @type {number} 山牆（前後封口）下緣：前後輪胎正上方，山牆只封到這個高度（下面是輪拱，屋子「架高」在輪上） */
const GABLE_BOTTOM = 22.4;
/** @type {number} 剖面下緣開始往上收到 GABLE_BOTTOM 的 |x|（這一段的側牆本來就在 R15 輪拱切口內，側面看不出差別） */
const END_RAISE_X = 50.6;

/** @type {(az: number) => number} 屋面高度（|z| 處） */
const roofY = (az) => RIDGE_Y - ((RIDGE_Y - EAVE_Y) * az) / EAVE_Z;

/**
 * 半剖面：屋脊 → 屋簷外緣 → 封簷板（垂直）→ 屋簷底（水平往內）→ 4 根圓木（每根 3 點鼓起 + 接縫）→ 牆底
 * 中段每站同一個剖面（木屋是直的長方體）；剖面在屋簷底與圓木處 z 會往內收，封口用一般多邊形三角化。
 * 前後端 |x| > END_RAISE_X：低於 GABLE_BOTTOM 的點往上收（山牆不蓋到輪胎）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  /** @type {number[][]} */
  const pts = [
    [0, RIDGE_Y],
    [EAVE_Z, EAVE_Y],
    [EAVE_Z, FASCIA_Y],
    [WALL_IN, FASCIA_Y],
  ];
  for (let j = 0; j < LOG_COUNT; j++) {
    const yT = LOG_TOP - j * LOG_H;
    pts.push([WALL_IN + 0.72, yT - 0.13 * LOG_H], [WALL_OUT, yT - 0.5 * LOG_H], [WALL_IN + 0.72, yT - 0.87 * LOG_H], [WALL_IN, yT - LOG_H]);
  }
  const t = Math.min(1, Math.max(0, (Math.abs(x) - END_RAISE_X) / (Math.abs(X_FRONT) - END_RAISE_X)));
  const k = t * t * (3 - 2 * t);
  return pts.map(([z, y]) => [z, y < GABLE_BOTTOM ? lerp(y, GABLE_BOTTOM, k) : y]);
};

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = [...buildStations(X_REAR, X_REAR + 2, 0.25, profile).slice(0, -1), ...buildStations(X_REAR + 2, X_FRONT - 2, 4, profile).slice(0, -1), ...buildStations(X_FRONT - 2, X_FRONT, 0.25, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R15：26 mm 輪胎半徑 13 + 2 mm；31 mm 輪需切輪拱） */
const ARCHES = [
  { x: 40, y: 13, radius: 15, cutZFrom: 30 },
  { x: -40, y: 13, radius: 15, cutZFrom: 30 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/**
 * 輪拱內襯（參考 khepri-scarab 的 buildProfileLiner）：輪拱切口後面的一段圓柱面（半徑 + 0.3、上半圈），
 * z 範圍 = [zFrom, 圓木牆內面]；角度範圍裁在前後山牆之內（不伸出屋外）
 * @type {(arch: { x: number, y: number, radius: number }, zFrom: number) => THREE.BufferGeometry}
 */
const buildHutLiner = (arch, zFrom) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const xMax = X_FRONT - 0.4;
  const xMin = X_REAR + 0.4;
  const a0 = Math.max(0.12, Math.acos(Math.min(1, (xMax - arch.x) / r)));
  const a1 = Math.min(Math.PI - 0.12, Math.acos(Math.max(-1, (xMin - arch.x) / r)));
  const pos = [];
  /** @type {(t: number) => number} 該角度的牆內面 z */
  const zIn = (t) => Math.max(zFrom, profileZAtY(profile(arch.x + r * Math.cos(t)), arch.y + r * Math.sin(t)) - 1.2);
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zFrom);
      const B = p(t1, zFrom);
      const C = p(t1, zIn(t1));
      const D = p(t0, zIn(t0));
      // 法線朝輪心
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
 * 山牆下段的中央圓木板（|z| ≤ 21，在兩個輪胎之間）：山牆封口只到 GABLE_BOTTOM，中央補上兩根半圓木高的牆板，
 * 擋住車殼安裝柱與底盤前後端；外側（輪胎上方）留空 = 山牆的輪拱缺口
 * @type {(xFace: number, dir: number) => { log: THREE.BufferGeometry, logDark: THREE.BufferGeometry }}
 */
const buildEndApron = (xFace, dir) => {
  const hw = 21;
  /** @type {(y0: number, y1: number) => THREE.BufferGeometry} */
  const band = (y0, y1) => {
    const b = new THREE.BoxGeometry(0.8, y1 - y0, 2 * hw);
    b.translate(xFace - dir * 0.4, (y0 + y1) / 2, 0);
    return b;
  };
  const yA = LOG_TOP - 2 * LOG_H;
  const yB = LOG_TOP - 3 * LOG_H;
  return {
    logDark: mergeGeos([band(yA, GABLE_BOTTOM + 0.3), band(WALL_BOTTOM, yB - 0.1)]),
    log: band(yB - 0.1, yA),
  };
};

/** @type {(x: number, y: number, z: number) => boolean} 屋面 */
const onRoof = (x, y, z) => Math.abs(z) < EAVE_Z - 0.05 && y > EAVE_Y - 0.2;
/** @type {(x: number, y: number, z: number) => boolean} 圓木牆 */
const onWall = (x, y, z) => y < FASCIA_Y - 0.05 && Math.abs(z) > WALL_IN - 0.3;
/** @type {(y: number) => number} 圓木編號（0 = 最上一根） */
const logIndex = (y) => Math.floor((LOG_TOP - y) / LOG_H);

/** @type {number} 木瓦排距（沿屋面的水平 |z| 間距）與每片寬（沿 x） */
const SHINGLE_ROW = 3.4;
/** @type {number} */
const SHINGLE_W = 3.2;

/** @type {{ x: number, w: number, y0: number, y1: number }} 側面窗（前後輪之間，圓木牆上的貼紙） */
const SIDE_WINDOW = { x: 0, w: 7.6, y0: 16.6, y1: 22.8 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 原木：霧面（roughness 0.65–0.75）
  log: namedMaterial('paint-log-pine', { color: 0x8c5a32, roughness: 0.7, clearcoat: 0.03 }),
  logDark: namedMaterial('paint-log-pine-aged', { color: 0x74482a, roughness: 0.72, clearcoat: 0.03 }),
  gable: namedMaterial('paint-gable-plank', { color: 0x5e3b22, roughness: 0.72, clearcoat: 0.03 }),
  endgrain: namedMaterial('paint-log-endgrain', { color: 0xc49a66, roughness: 0.74, clearcoat: 0.02 }),
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
  // 雞腳：黃橙（霧面射出塑膠）＋深色爪尖
  claw: namedMaterial('paint-claw-ochre', { color: 0xe0962c, roughness: 0.6, clearcoat: 0.05 }),
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

/** @type {{ hw: number, y0: number, y1: number }} 車頭窗洞（|z| ≤ 3.6、y 26.8–33；跨在最上一根圓木與山牆之間的「明間窗」） */
const FRONT_WINDOW = { hw: 3.6, y0: 26.8, y1: 33 };

/**
 * 車頭雕花窗框（nalichnik）：頂冠（kokoshnik 尖拱，鏤空一圓兩小圓）、兩側直板、外伸的窗台、窗台下波浪垂飾（podzor）
 * @type {() => THREE.BufferGeometry}
 */
const buildNalichnik = () => {
  /** @type {number[][]} 右半外形（由下中央往右、往上到頂冠尖），再鏡射成整圈（逆時針） */
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
  ];
  const outline = [...right, ...right.slice(1, -1).reverse().map(([z, y]) => [-z, y])];
  // 逆時針：右半是由下往上（z > 0），左半由上往下 → 整圈逆時針需反轉
  outline.reverse();
  const holes = [rectPts(-FRONT_WINDOW.hw, FRONT_WINDOW.hw, FRONT_WINDOW.y0, FRONT_WINDOW.y1), circlePts(0, 36.6, 0.9), circlePts(-3.1, 35.8, 0.55), circlePts(3.1, 35.8, 0.55)];
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
  const ym = 29.9;
  const f = 0.55;
  const m = 0.35;
  const holes = [rectPts(-hw + f, -m, y0 + f, ym - m), rectPts(m, hw - f, y0 + f, ym - m), rectPts(-hw + f, -m, ym + m, y1 - f), rectPts(m, hw - f, ym + m, y1 - f)];
  return gablePlate(outline, holes, X_FRONT, 0.7, 1);
};

/**
 * 博風板（prichelina）：沿山牆兩條屋面邊緣的白色板帶，下緣是波浪雕花；屋脊下一片尖底垂飾（polotenets）
 * @type {(xFace: number, dir: number) => THREE.BufferGeometry}
 */
const buildBargeboards = (xFace, dir) => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const sg of [-1, 1]) {
    const n = 24;
    /** @type {number[][]} */
    const top = [];
    /** @type {number[][]} */
    const bottom = [];
    // 屋面方向的單位向量與往下的法線
    const len = Math.hypot(EAVE_Z, RIDGE_Y - EAVE_Y);
    const nz = (RIDGE_Y - EAVE_Y) / len;
    const ny = EAVE_Z / len;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const z = lerp(EAVE_Z - 0.2, 0.9, t);
      const y = roofY(z) + 0.15;
      top.push([sg * z, y]);
      // 下緣波浪：5 個半圓扇
      const depth = 1.3 + 0.65 * Math.abs(Math.sin(Math.PI * t * 5));
      bottom.push([sg * (z - nz * depth), y - ny * depth]);
    }
    const pts = [...top, ...bottom.reverse()];
    // 逆時針
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
  // 屋脊垂飾
  geos.push(
    gablePlate(
      [
        [-1, RIDGE_Y - 0.2],
        [-1, 39.6],
        [0, 38.2],
        [1, 39.6],
        [1, RIDGE_Y - 0.2],
      ].reverse(),
      [],
      xFace,
      0.9,
      dir,
    ),
  );
  return mergeGeos(geos);
};

/**
 * 四角的圓木端頭（log cabin 角接）：側牆圓木沿 x 伸出山牆外、山牆圓木沿 z 伸出側牆外，上下錯開半根
 * @type {() => THREE.BufferGeometry}
 */
const buildLogEnds = () => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  const r = 1.6;
  const out = 6.2;
  const outZ = 7.5;
  const embed = 0.5;
  for (const sx of [-1, 1]) {
    const xFace = sx > 0 ? X_FRONT : X_REAR;
    for (const sz of [-1, 1]) {
      // 側牆圓木端頭（軸沿 x）：每根圓木的中心高度
      for (let j = 0; j < LOG_COUNT; j++) {
        const yc = LOG_TOP - (j + 0.5) * LOG_H;
        // 山牆下緣以下的圓木（在輪拱切口內）沒有端頭
        if (yc - r < GABLE_BOTTOM) {
          continue;
        }
        const c = new THREE.CylinderGeometry(r, r, out + embed, 18);
        c.rotateZ(Math.PI / 2);
        c.translate(xFace + sx * ((out - embed) / 2), yc, sz * (WALL_OUT - r + 0.75));
        geos.push(c);
      }
      // 山牆圓木端頭（軸沿 z）：在側牆圓木的接縫高度（錯開半根）
      for (let j = 1; j < LOG_COUNT; j++) {
        const yc = LOG_TOP - j * LOG_H;
        if (yc - r < GABLE_BOTTOM) {
          continue;
        }
        const c = new THREE.CylinderGeometry(r, r, outZ + embed, 18);
        c.rotateX(Math.PI / 2);
        c.translate(xFace - sx * r, yc, sz * (WALL_OUT + (outZ - embed) / 2));
        geos.push(c);
      }
    }
  }
  return mergeGeos(geos);
};

/**
 * 煙囪（車尾屋脊上）：磚砌方柱＋白灰帽＋黑色煙口
 * @type {() => { stack: THREE.BufferGeometry, cap: THREE.BufferGeometry, hole: THREE.BufferGeometry }}
 */
const buildChimney = () => {
  const xc = -46;
  const s = 5.4;
  const yBase = roofY(s / 2) - 0.9;
  const yTop = 53.2;
  const stack = new THREE.BoxGeometry(s, yTop - yBase, s);
  stack.translate(xc, (yTop + yBase) / 2, 0);
  const cap = new THREE.BoxGeometry(7.2, 1.2, 7.2);
  cap.translate(xc, yTop + 0.6, 0);
  const hole = new THREE.BoxGeometry(3.4, 0.3, 3.4);
  hole.translate(xc, yTop + 1.2 + 0.1, 0);
  return { stack, cap, hole };
};

/** @type {number[]} 雞腳的 x 位置（前後輪之間，每側一對） */
const FEET_X = [13, -13];
/** @type {number} 雞腳趾根 |z|（圓木牆外側 3 mm：底盤側框 |z| ≤ 38.8、y ≤ 9.4 之外，腳踝從牆底往外下斜） */
const FOOT_Z = 40.6;

/**
 * 抽象鳥爪：從牆底伸出的短腳踝（往前微傾），腳踝下三根往前張開的短趾（中趾 6.4、外趾 5.6、內趾 4.4）＋一根往後的短後趾，
 * 每趾末端深色爪尖；趾面離地 ≥ 5 mm（規則離地 2.2 mm 以上，物理碰撞方塊底面不變低）
 * @type {() => { leg: THREE.BufferGeometry, tips: THREE.BufferGeometry }}
 */
const buildFeet = () => {
  /** @type {THREE.BufferGeometry[]} */
  const legs = [];
  /** @type {THREE.BufferGeometry[]} */
  const tips = [];
  for (const sg of [-1, 1]) {
    for (const fx of FEET_X) {
      const z0 = sg * FOOT_Z;
      const ankle = [fx - 0.9, 7.2, z0];
      // 腳踝：牆底內 1 mm 起，往前下到趾根
      legs.push(smoothNormals(sweepEllipse([[fx - 1.8, WALL_BOTTOM + 1.2, sg * (WALL_IN + 0.6)], [fx - 1.4, 9.8, sg * (FOOT_Z - 1.2)], ankle], 8, (t) => [lerp(1.55, 1.2, t), lerp(1.55, 1.2, t)], 12)));
      // 趾根關節球
      const knot = new THREE.SphereGeometry(1.35, 14, 10);
      knot.translate(...ankle);
      legs.push(knot);
      // [水平角（往外為正，度）, 長, 末端高]
      for (const [deg, len, yEnd] of [
        [0, 6.4, 5.4],
        [12, 5.6, 5.6],
        [-8, 4.4, 5.6],
        [180, 3, 6],
      ]) {
        const a = (deg * Math.PI) / 180;
        const dx = Math.cos(a);
        const dz = sg * Math.sin(a);
        const p0 = ankle;
        const p1 = [ankle[0] + dx * len * 0.5, 6.4, ankle[2] + dz * len * 0.5];
        const p2 = [ankle[0] + dx * len, yEnd, ankle[2] + dz * len];
        legs.push(smoothNormals(sweepEllipse([p0, p1, p2], 8, (t) => [lerp(0.95, 0.55, t), lerp(0.85, 0.5, t)], 10)));
        // 爪尖：沿趾方向的小圓錐
        const tip = new THREE.ConeGeometry(0.5, 1.4, 10);
        tip.rotateZ(-Math.PI / 2);
        tip.rotateY(-Math.atan2(dz, dx));
        tip.translate(p2[0] + dx * 0.55, yEnd - 0.1, p2[2] + dz * 0.55);
        tips.push(tip);
      }
    }
  }
  return { leg: mergeGeos(legs), tips: mergeGeos(tips) };
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
  theme: '整台車是一間小木屋：4 根橫向圓木牆＋四角交錯伸出的圓木端頭、人字木瓦屋頂與白色封簷板、車頭山牆白色雕花窗框（紅窗櫺、暖色窗光）與博風板、車尾短煙囪；前後輪之間露出兩對抽象三趾鳥爪——站在雞腳上的小屋',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  wheelArches: ARCHES,
  sideZMin: 30,
  zones: () => [
    // 白色封簷板（屋簷外緣的垂直板）
    { mat: 'white', keep: (x, y, z) => Math.abs(z) - (EAVE_Z - 0.05) },
    // 屋簷底（深色）
    { mat: 'soffit', keep: (x, y, z) => (y > FASCIA_Y - 0.15 && y < EAVE_Y - 0.1 ? 1 : -1) },
    // 木瓦：每排錯開半片，深淺交錯
    {
      mat: 'shingleDark',
      keep: (x, y, z) => {
        if (!onRoof(x, y, z)) {
          return -1;
        }
        const row = Math.floor((EAVE_Z - Math.abs(z)) / SHINGLE_ROW);
        const col = Math.floor((x + (row % 2) * SHINGLE_W * 0.5) / SHINGLE_W);
        return (row + col) % 3 === 0 ? 1 : -1;
      },
    },
    { mat: 'shingle', keep: (x, y, z) => (onRoof(x, y, z) ? 1 : -1) },
    // 圓木牆：深淺交錯（同一批木料的色差）
    { mat: 'logDark', keep: (x, y) => (logIndex(y) % 2 === 1 ? 1 : -1) },
    { mat: 'log', keep: () => 1 },
  ],
  // 車頭山牆：三角山牆板（深色）＋圓木分段（和側牆同一套圓木高度；山牆下緣 GABLE_BOTTOM）
  capFrontBands: [
    { yMin: FASCIA_Y, mat: 'gable' },
    { yMin: LOG_TOP - LOG_H, mat: 'log' },
    { mat: 'logDark' },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'log', mount: 'mount' },
  // 卡座吊耳：前後安裝柱靠近山牆，吊耳頂端接到山牆下段（不從屋脊內面一路垂下，避免從窗洞後面露出）
  mountInnerY: (kit) => (x) => Math.min(kit.innerYAt(x), GABLE_BOTTOM + 3),
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildHutLiner(a, 33.4))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 前後山牆下段中央的圓木板（擋住安裝柱與底盤端部）
    {
      const f = buildEndApron(X_FRONT, 1);
      const r = buildEndApron(X_REAR, -1);
      parts.push({ geometry: mergeGeos([f.log, r.log]), mat: 'log', solid: true, outline: true, name: 'end-apron-log' });
      parts.push({ geometry: mergeGeos([f.logDark, r.logDark]), mat: 'logDark', solid: true, outline: true, name: 'end-apron-log-dark' });
    }
    // 四角圓木端頭
    parts.push({ geometry: buildLogEnds(), mat: 'endgrain', solid: true, outline: true, name: 'log-corner-ends' });
    // 車頭雕花窗框＋紅窗櫺＋窗內暖光
    parts.push({ geometry: buildNalichnik(), mat: 'white', solid: true, outline: true, name: 'front-nalichnik' });
    parts.push({ geometry: buildSash(), mat: 'red', solid: true, name: 'front-window-sash' });
    {
      const pane = new THREE.BoxGeometry(0.3, FRONT_WINDOW.y1 - FRONT_WINDOW.y0, FRONT_WINDOW.hw * 2);
      pane.translate(X_FRONT + 0.3, (FRONT_WINDOW.y0 + FRONT_WINDOW.y1) / 2, 0);
      parts.push({ geometry: pane, mat: 'window', solid: true, name: 'front-window-glow' });
    }
    // 前後山牆博風板＋屋脊垂飾
    parts.push({ geometry: mergeGeos([buildBargeboards(X_FRONT, 1), buildBargeboards(X_REAR, -1)]), mat: 'white2', solid: true, outline: true, name: 'gable-bargeboards' });
    // 煙囪（尾翼 chimney-stack）
    const ch = buildChimney();
    parts.push({ geometry: ch.stack, mat: 'brick', solid: true, outline: true, name: 'chimney-stack' });
    parts.push({ geometry: ch.cap, mat: 'white', solid: true, outline: true, name: 'chimney-cap' });
    parts.push({ geometry: ch.hole, mat: 'hole', solid: true, name: 'chimney-flue' });
    // 雞腳（抽象三趾鳥爪）
    const feet = buildFeet();
    parts.push({ geometry: feet.leg, mat: 'claw', solid: true, outline: true, name: 'hen-feet' });
    parts.push({ geometry: feet.tips, mat: 'clawTip', solid: true, outline: true, name: 'hen-claw-tips' });

    // ---- 貼紙 ----
    // 圓木接縫（苔蘚填縫，深色 0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onWall(x, y, z)) {
          return -1;
        }
        const q = (LOG_TOP - y) / LOG_H;
        return 0.35 - Math.abs(q - Math.round(q)) * LOG_H;
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
        const u = (EAVE_Z - Math.abs(z)) / SHINGLE_ROW;
        const row = Math.floor(u);
        const rowLine = (0.5 - Math.abs(u - Math.round(u))) * SHINGLE_ROW;
        const v = (x + (row % 2) * SHINGLE_W * 0.5) / SHINGLE_W;
        const colLine = Math.abs(v - Math.round(v)) * SHINGLE_W;
        // 屋脊兩側 1.2 mm 不畫（屋脊壓條）
        return Math.min(0.3 - Math.min(SHINGLE_ROW / 2 - rowLine, colLine), RIDGE_Y - 0.8 - y);
      }, { offset: 0.1 }),
      mat: 'dShingleGap',
      name: 'decal-shingle-gaps',
    });
    // 屋脊壓條（深色 2.4 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => 1.2 - Math.abs(z), { offset: 0.12 }),
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
      // 側板
      const boards = Math.max(ax - (W.w / 2 + 1.5), W.y0 - 1 - y, y - (W.y1 + 0.8));
      // 窗台（外伸）
      const sill = Math.max(ax - (W.w / 2 + 2.4), Math.abs(y - (W.y0 - 1.2)) - 0.6);
      // 垂飾（窗台下的半圓扇）
      const apron = Math.max(ax - (W.w / 2 + 1.2), W.y0 - 3.1 + 0.5 * Math.abs(Math.sin((Math.PI * (x - W.x)) / 2.2)) - y, y - (W.y0 - 1.6));
      // 頂冠：尖拱（kokoshnik）
      const crownH = 4.4 * (1 - (ax / (W.w / 2 + 2.3)) ** 1.6);
      const crown = Math.max(ax - (W.w / 2 + 2.3), W.y1 + 0.6 - y, y - (W.y1 + 0.6 + crownH));
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
        const ax = Math.abs(x - W.x);
        // 頂冠的鏤空小圓
        const fret = 0.7 - Math.hypot(ax, y - (W.y1 + 2.4));
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
    geometry: `本檔剖面（推估）：牆面 x ${X_REAR} ~ ${X_FRONT}＋四角圓木端頭沿 x 伸出 6.2 mm，總長約 119（batch5「長約 125–135」；為了俯視 IoU ≤ 0.82 縮短，見 DESIGN.md 第 8 節）；屋脊 ${RIDGE_Y}、屋簷半寬 ${EAVE_Z}、圓木牆 |z| ${WALL_IN}–${WALL_OUT}（輪胎外緣 34.75 之外）、牆底 ${WALL_BOTTOM.toFixed(1)}；煙囪頂約 54.7（batch5「高約 50–58（煙囪頂）」）；車殼外框半寬 ≤ 48（碰撞體不寬過導輪外緣 ±48.5）`,
    wheelArches: '前後 R15（26 mm 輪胎半徑 13 + 2 mm）；31 mm 輪不切輪拱時間隙不足（需切輪拱，batch5 未要求）；輪拱內襯擋住殼內空腔',
    logs: '圓木：殼面剖面每根 3 點鼓起 1 mm（高 3.8 mm）；四角端頭為 ABS 實心圓柱（R1.6、沿 x 伸出 6.2 / 沿 z 伸出 7.5 mm ≈ 實物 35–40 cm 的角頭，推估；側牆圓木端頭外移 0.75 mm 讓開前後輪胎），質量 = 封閉體積 × 1.05 g/cm³',
    nalichnik: '車頭雕花窗框：白色 1.0 mm 立板（頂冠尖拱、側板、窗台、波浪垂飾，鏤空一大兩小圓）＋紅色 0.7 mm 十字窗櫺；側面窗為貼紙（推估）',
    feet: '雞腳：每側 2 隻、各 3 前趾＋1 後趾的 ABS 實心掃掠件（趾徑 1–1.9 mm、長 3–6.4 mm，推估），最低點約 y 4.9，全在底盤側框（|z| ≤ 38.8、y ≤ 9.4）之外',
    chimney: '煙囪：5.4 × 5.4 mm 實心方柱（屋面下 0.9 mm 起）＋7.2 × 1.2 × 7.2 mm 白灰帽（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
