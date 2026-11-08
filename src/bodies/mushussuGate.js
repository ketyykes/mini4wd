// 伊什塔爾城門（body-mushussu-gate，神話組・美索不達米亞）：把巴比倫的伊什塔爾城門做成一台蓄勢待發的低趴四驅車（LG1 暗器生物型的姿態）——
// 前低後高的楔形車身、前後翼子板外鼓而腰身內收、細長的低尖鼻；城門的語彙全部做成車的零件與塗裝，車上沒有任何動物的頭、臉、腳：
// 車尾＝城門本身：兩片從後翼子板長出來的「城垛鰭刀」（翼端板，上緣是往後上挑的刀背、後緣是三階城垛缺口）當門塔，
// 中間一片後緣帶城垛齒的黃釉主翼當門楣；座艙是車頂上一個往前的拱門形（城門拱道）的煙燻琥珀透明罩；輪拱是黃釉拱框。
// 塗裝：青金石藍釉磚（錯縫磚縫）、車頂中線從鼻尖貫穿到車尾的白瓣金心玫瑰花飾帶、側牆的大玫瑰圓徽拖著一條往後上掃的金色鱗紋色帶
// （穆修胡修只留抽象的鱗紋）、上下黃釉磚邊框、鼻端兩側沿肩線的琥珀色細長頭燈。
// 設計：shared/design/body-mushussu-gate/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 4 節 M1–M5）。剖面為本檔站位產生器（推估）。
// 配色取自 M2 / 4-2（青金石釉藍、黃釉、黑白金邊框與玫瑰花飾）；圖形全部自繪；玫瑰花飾只用圓瓣（不做放射閃電）；不含任何文字。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾封口 x */
const X_REAR = -72;
/** @type {number} 車頭（鼻端封口）x（細長的低尖鼻） */
const X_FRONT = 74;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-72, -68, -60, -50, -40, -28, -14, 0, 14, 28, 40, 48, 55, 60, 66, 70, 74];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：前後輪上方外鼓的翼子板 44、腰身內收到 35（可樂瓶腰）；車尾收到 24（城垛鰭刀立在兩側）；
  // 前輪拱之後收成細長的低尖鼻（x 60 → 74 半寬 17.5 → 4.4）
  hw: monoCurve(XS, [24, 29, 34.5, 40.5, 44, 41, 36.8, 35, 36.8, 41, 44, 40.5, 31, 17.5, 11.4, 7.4, 4.4]),
  // 中線甲板高度（座艙罩是另外的透明件）：前低後高的楔形——最高點在後翼子板之間（x −28，33.9），往後只緩降到車尾 28.5，往前一路斜下到鼻尖 15.3（LG1 低尖鼻 V3）
  yTop: monoCurve(XS, [28.5, 29.6, 31, 32.4, 33.4, 33.9, 33.6, 33, 32, 30.9, 30, 27.4, 24.6, 22.3, 19.5, 17.5, 15.3]),
  // 肩稜線（頂面與側牆交界，銳利）：輪上 29.6–30.4、腰 27.2（翼子板比腰身高，R17.5 輪拱頂 30.5 切進肩線，俯視在四個輪位留下缺口）
  yS: monoCurve(XS, [25.5, 26.6, 28, 29.6, 30.4, 29.4, 27.8, 27.2, 27.6, 29, 29.6, 26.6, 23.2, 20.6, 17.8, 16.2, 14.2]),
  // 側裙下緣（腰段 10.5，loft 自動讓開底盤側框）
  yLow: monoCurve(XS, [16, 15.5, 14.5, 12.5, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11.5, 13, 13.4, 13, 12.8, 12.8]),
};

/** @type {number} 側牆往下的外張量（牆腳比肩線外 0.6 mm） */
const FLARE = 0.6;
/** @type {{ x0: number, x1: number, hw: number, rise: number }} 拱門形座艙（俯視）：後緣 x0、拱心 x1、半寬（拱頂半徑）、座艙罩高度 */
const CABIN = { x0: -24, x1: 0, hw: 7.5, rise: 4.2 };

/**
 * 半剖面 7 點：中線 → 微圓的頂面 → 肩稜線（銳利）→ 幾乎直立的側牆（鱗紋色帶、邊框的牆面）→ 側裙下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  const d = t - s;
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [h + FLARE / 2, lerp(s, lo, 0.5)],
    [h + FLARE, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與鼻端每 0.75 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -62, 0.75, profile).slice(0, -1), ...buildStations(-62, 52, 2, profile).slice(0, -1), ...buildStations(52, X_FRONT, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/**
 * 側牆外表面在 (x, y) 的 |z|（肩線 → 牆腳線性外張）
 * @type {(x: number, y: number) => number}
 */
const wallZ = (x, y) => {
  const s = P.yS(x);
  const t = Math.min(1, Math.max(0, (s - y) / (s - P.yLow(x))));
  return P.hw(x) + FLARE * t;
};

/** @type {(x: number, y: number, z: number) => boolean} 側牆（肩線以下、靠近側牆外表面） */
const onSideWall = (x, y, z) => y < P.yS(x) + 0.05 && Math.abs(z) > wallZ(x, y) - 0.35 && x > X_REAR + 1.5 && x < X_FRONT - 1.5;
/** @type {(x: number, y: number) => boolean} 頂面（肩線以上） */
const onTop = (x, y) => y > P.yS(x) + 0.05;

/** @type {(x: number) => number} 上緣黃釉磚邊框的上 / 下緣（肩線下 0.5 → 2.1） */
const topBandHi = (x) => P.yS(x) - 0.5;
/** @type {(x: number) => number} */
const topBandLo = (x) => P.yS(x) - 2.1;
/** @type {number} 牆腳瀝青黑裙帶的高度（側牆最下一段，讀成和上方釉磚牆分開的裙板） */
const SKIRT_H = 2.6;
/** @type {(x: number) => number} 下緣黃釉磚邊框（裙帶之上，高 1.4） */
const lowBandLo = (x) => P.yLow(x) + SKIRT_H;
/** @type {(x: number) => number} */
const lowBandHi = (x) => P.yLow(x) + SKIRT_H + 1.4;

/**
 * 玫瑰花飾（M2：白瓣金心的圓瓣花，不做放射線）：中心圓 r 0.7、8 片圓瓣 r 0.62 繞半徑 1.42（直徑約 4.1）
 * @type {(u: number, v: number) => { petal: number, core: number }}
 */
const rosetteSd = (u, v) => {
  const core = Math.hypot(u, v) - 0.7;
  let petal = Infinity;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    petal = Math.min(petal, Math.hypot(u - 1.42 * Math.cos(a), v - 1.42 * Math.sin(a)) - 0.62);
  }
  return { petal: Math.max(petal, -core - 0.22), core };
};

/**
 * 磚縫（橫向錯縫）：每層高 4、磚長 8，上下層錯半塊；線寬 0.6（正值 = 磚縫上）
 * @type {(a: number, y: number) => number} a = 沿牆面的水平座標
 */
const brickJoint = (a, y) => {
  const course = 4;
  const len = 8;
  const j = Math.floor((y - 1) / course);
  const ph = (((y - 1) % course) + course) % course;
  const dh = Math.min(ph, course - ph);
  const shift = (((j % 2) + 2) % 2) * (len / 2);
  const pa = (((a - shift) % len) + len) % len;
  const dv = Math.min(pa, len - pa);
  return 0.3 - Math.min(dh, dv);
};

/** @type {{ x: number, y: number, r: number, k: number }} 側牆的大玫瑰圓徽（號碼牌位置的抽象徽記）：圓心、底盤半徑、花飾放大倍率 */
const ROUNDEL = { x: 12, y: 19.9, r: 4.9, k: 1.95 };
/** @type {number} 鱗紋色帶的前端 x（接在圓徽後面） */
const SCALE_X1 = 10;
/** @type {number} 鱗紋色帶的後端 x */
const SCALE_X0 = -22;
/**
 * 鱗紋色帶（側視）：從圓徽往後上方掃、往後漸細的斜帶（負值 = 帶內）
 * @type {(x: number, y: number) => number}
 */
const scaleBandSd = (x, y) => {
  const q = Math.max(0, Math.min(1, (SCALE_X1 - x) / (SCALE_X1 - SCALE_X0)));
  const yc = ROUNDEL.y - 0.3 + 0.13 * (SCALE_X1 - x);
  return Math.max(Math.abs(y - yc) - lerp(3.3, 1.6, q), x - SCALE_X1, SCALE_X0 - x);
};
/**
 * 鱗紋：一列列朝車尾的半圓弧（半徑 1.5），相鄰兩列上下錯開半片，像釉磚浮雕上刻的鱗；線寬 0.56（正值 = 線上）
 * @type {(x: number, y: number) => number}
 */
const scaleLine = (x, y) => {
  const dx = 2.0;
  const dy = 3.0;
  const i = Math.floor(x / dx) + 1;
  const off = (((i % 2) + 2) % 2) * (dy / 2);
  const cy = Math.round((y - off) / dy) * dy + off;
  return 0.28 - Math.abs(Math.hypot(x - i * dx, y - cy) - dy / 2);
};
/** @type {(x: number, y: number) => number} 側牆主圖形（圓徽＋鱗紋色帶）的距離（負值 = 圖形內） */
const sideGraphicSd = (x, y) => Math.min(Math.hypot(x - ROUNDEL.x, y - ROUNDEL.y) - ROUNDEL.r, scaleBandSd(x, y));

/**
 * 拱門形座艙的距離（俯視，拱頂朝車頭；負值 = 座艙內）
 * @type {(x: number, z: number) => number}
 */
const cabinSd = (x, z) => (x > CABIN.x1 ? Math.hypot(x - CABIN.x1, z) - CABIN.hw : Math.max(Math.abs(z) - CABIN.hw, CABIN.x0 - x));

/**
 * 拱門形座艙罩：透明薄殼，俯視和 cabinSd 的拱門同形，橫斷面是半橢圓弧，高度從後緣升到中段 CABIN.rise 再往拱頂收回 0；
 * 底緣沉到甲板下 0.4 mm。14 × 8 段
 * @type {() => THREE.BufferGeometry}
 */
const buildCabinDome = () => {
  const nx = 14;
  const nt = 8;
  const xEnd = CABIN.x1 + CABIN.hw;
  /** @type {number[]} */
  const pos = [];
  /** @type {number[]} */
  const idx = [];
  for (let i = 0; i <= nx; i++) {
    const q = i / nx;
    const x = lerp(CABIN.x0, xEnd, q);
    const w = x > CABIN.x1 ? Math.sqrt(Math.max(0, CABIN.hw ** 2 - (x - CABIN.x1) ** 2)) : CABIN.hw;
    const h = CABIN.rise * Math.sin(Math.PI * q) ** 0.6;
    for (let j = 0; j <= nt; j++) {
      const a = (Math.PI * j) / nt;
      pos.push(x, P.yTop(x) - 0.4 + h * Math.sin(a), w * Math.cos(a));
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nt; j++) {
      const a = i * (nt + 1) + j;
      const b = a + nt + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 青金石藍釉磚（亮面釉：roughness ≤ 0.4）
  lapis: namedMaterial('paint-lapis-glaze', { color: 0x1b469a, roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.12 }),
  lapis2: namedMaterial('paint-lapis-glaze', { color: 0x1b469a, roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
  // 牆腳瀝青黑（霧面；新巴比倫以瀝青作砌磚灰漿，推估）
  bitumen: namedMaterial('paint-bitumen-black-matte', { color: 0x1a1a1a, roughness: 0.72, clearcoat: 0.05 }),
  // 黃釉（主翼）
  yellow2: namedMaterial('paint-yellow-glaze', { color: 0xd9a441, roughness: 0.36, clearcoat: 0.6, side: THREE.DoubleSide }),
  // 白釉（鰭刀上的玫瑰花瓣）
  white: namedMaterial('paint-white-glaze', { color: 0xf2efe6, roughness: 0.38, clearcoat: 0.5 }),
  // 金邊（真金屬：-brass 結尾）
  gold2: namedMaterial('trim-gold-brass', { color: 0xc8a24a, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x131a26, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x173b78, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x14284a, roughness: 0.75, side: THREE.DoubleSide }),
  dJoint: decalMaterial('decal-brick-joint-navy', { color: 0x102a60, roughness: 0.5 }),
  dYellow: decalMaterial('decal-yellow-glaze', { color: 0xd9a441, roughness: 0.36 }),
  dBlack: decalMaterial('decal-black-glaze', { color: 0x1a1a1a, roughness: 0.4 }),
  dWhite: decalMaterial('decal-white-glaze', { color: 0xf2efe6, roughness: 0.38 }),
  dGold: decalMaterial('decal-gold', { color: 0xc8a24a, roughness: 0.32, metalness: 0.7 }),
  dNavy: decalMaterial('decal-gate-shadow-navy', { color: 0x0f2347, roughness: 0.6 }),
  // 拱門形座艙罩：煙燻琥珀色的透明 PC（名稱用座艙罩的 pc-smoke-tint，Blender 依名稱當玻璃）
  glass: namedMaterial('pc-smoke-tint', { color: 0xc9861f, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  // 頭燈：琥珀色細長燈條（低強度自發光，不過曝）
  lamp: decalMaterial('lamp-head-amber', { color: 0xffb440, emissive: 0xff8a10, emissiveIntensity: 0.35, roughness: 0.3 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {number} 城垛鰭刀（翼端板）的中心 |z| */
const FIN_Z = 24;
/** @type {number} 鰭刀板厚 */
const FIN_T = 1.4;
/** @type {number[][]} 鰭刀上緣（刀背，側視 (x, y)）：從後翼子板頂面往後上挑到刀尖 */
const FIN_TOP = [[-40, 32.2], [-46, 34.6], [-52, 37], [-58, 39.3], [-64, 41.5], [-70, 43.5], [-76, 45.4]];
/**
 * 鰭刀其餘輪廓（接在刀尖之後）：後緣三階城垛缺口（每階深 2.4、高 4.8）→ 埋進車尾殼面的根部 →
 * 沿後輪拱上方斜回前端（離 31 mm 輪胎 ≥ 1 mm）
 * @type {number[][]}
 */
const FIN_REST = [[-76, 40.6], [-73.6, 40.6], [-73.6, 35.8], [-71.2, 35.8], [-71.2, 31], [-68.8, 31], [-68.8, 25.5], [-60, 25.5], [-56, 27.5], [-52, 29.6], [-46, 31.5]];
/** @type {{ y: number, thick: number, half: number }} 主翼（門楣）：底面 y、板厚、半翼展（伸進兩片鰭刀） */
const WING = { y: 39.4, thick: 1.4, half: FIN_Z + FIN_T / 2 };

/**
 * 主翼俯視輪廓 (x, z)：後掠的彎刃形，前緣中線 x −60 → 翼端 −65.5；後緣中線 −70.5 → 翼端 −74.5，
 * 後緣切成一排城垛齒（每齒寬約 3.1、深 1.5）
 * @type {() => number[][]}
 */
const wingOutline = () => {
  const { half } = WING;
  /** @type {number[][]} */
  const pts = [[-60, 0], [-65.5, half]];
  /** @type {number} 城垛齒數（奇數：兩端與中線都是凸齒） */
  const n = 15;
  for (let k = 0; k < n; k++) {
    const z0 = lerp(half, -half, k / n);
    const z1 = lerp(half, -half, (k + 1) / n);
    const x = -70.5 - (4 * Math.abs(z0 + z1)) / 2 / half + (k % 2 === 1 ? 1.5 : 0);
    pts.push([x, z0], [x, z1]);
  }
  pts.push([-65.5, -half]);
  return pts;
};

/**
 * 車尾的城門：兩片城垛鰭刀（門塔）＋刀背金邊＋鰭刀外側的玫瑰花飾＋後緣帶城垛齒的主翼（門楣）
 * @type {() => { fins: THREE.BufferGeometry, gilt: THREE.BufferGeometry, wing: THREE.BufferGeometry, petals: THREE.BufferGeometry, cores: THREE.BufferGeometry }}
 */
const buildGateWing = () => {
  /** @type {(pts: number[][], thick: number, zc: number) => THREE.BufferGeometry} 側視多邊形沿 z 擠出 thick，中心在 zc */
  const sidePlate = (pts, thick, zc) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: thick, bevelEnabled: false });
    g.translate(0, 0, zc - thick / 2);
    return g;
  };
  /** @type {(x: number, y: number, r: number, thick: number, zc: number) => THREE.BufferGeometry} 軸向沿 z 的圓片 */
  const disc = (x, y, r, thick, zc) => {
    const g = new THREE.CylinderGeometry(r, r, thick, 10);
    g.rotateX(Math.PI / 2);
    g.translate(x, y, zc);
    return g;
  };
  /** @type {THREE.BufferGeometry[]} */
  const fins = [];
  /** @type {THREE.BufferGeometry[]} */
  const gilt = [];
  /** @type {THREE.BufferGeometry[]} */
  const petals = [];
  /** @type {THREE.BufferGeometry[]} */
  const cores = [];
  // 刀背金邊：上緣（鰭刀前緣）往下 2 mm 的一條帶，比鰭刀厚 0.5 mm
  const giltPts = [...FIN_TOP.slice(1), ...FIN_TOP.slice(1).reverse().map(([x, y]) => [x, y - 2])];
  for (const sg of [-1, 1]) {
    fins.push(sidePlate([...FIN_TOP, ...FIN_REST], FIN_T, sg * FIN_Z));
    gilt.push(sidePlate(giltPts, FIN_T + 0.5, sg * FIN_Z));
    // 玫瑰花飾（外側面）：8 片白釉圓瓣繞金心
    const zc = sg * (FIN_Z + FIN_T / 2);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      petals.push(disc(-63 + 2.3 * Math.cos(a), 34.2 + 2.3 * Math.sin(a), 1.05, 0.6, zc));
    }
    cores.push(disc(-63, 34.2, 1.15, 0.8, zc));
  }
  const wing = new THREE.ExtrudeGeometry(new THREE.Shape(wingOutline().map(([x, z]) => new THREE.Vector2(x, z))), { depth: WING.thick, bevelEnabled: false });
  // 局部 (x, y, z) → 世界 (x, z, −y)：形狀平面躺平、擠出方向朝上
  wing.rotateX(-Math.PI / 2);
  wing.translate(0, WING.y, 0);
  return { fins: mergeGeos(fins), gilt: mergeGeos(gilt), wing, petals: mergeGeos(petals), cores: mergeGeos(cores) };
};

export const mushussuGateBody = makePolyBody({
  id: 'body-mushussu-gate',
  name: '伊什塔爾城門・穆修胡修',
  style: 'myth',
  phase: 8,
  mythSeries: 'mesopotamian',
  mythTheme: 'mushussu',
  form: 'brick-gate',
  roof: 'closed',
  wing: 'crenel-tail',
  theme: '前低後高、翼子板外鼓而腰身內收的楔形車披上伊什塔爾城門的釉磚：青金石藍釉磚車身、車頂中線從鼻尖貫穿到車尾的白瓣金心玫瑰花飾帶、拱門形的煙燻琥珀透明座艙罩（亮金框，罩下深藍底與一朵玫瑰花飾）、側牆的大玫瑰圓徽拖著往後上掃的金色鱗紋色帶、上下黃釉磚邊框與瀝青黑裙帶、輪拱黃釉拱框、鼻端兩側的琥珀色細長頭燈；車尾是城門本身——兩片從後翼子板長出的城垛鰭刀（刀背金邊、後緣三階城垛缺口）夾著後緣帶城垛齒的黃釉主翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: [4],
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    // 牆腳瀝青黑裙帶（側牆最下 2.6 mm）
    { mat: 'bitumen', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.4 ? P.yLow(x) + SKIRT_H - y : -1) },
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'lapis2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）＋輪胎內側環形擋板（kitsune-ninetail 的 buildArchWell）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 輪拱拱框：黃釉寬帶＋外側黑細線（城門拱的釉磚邊框）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = archDist(x, y);
        return Math.min(d, 1.5 - d);
      }),
      mat: 'dYellow',
      name: 'decal-arch-band',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = archDist(x, y);
        return Math.min(d - 1.5, 2.15 - d);
      }),
      mat: 'dBlack',
      name: 'decal-arch-line',
    });

    // 側牆上下兩道黃釉磚邊框（M2：城門釉磚飾帶的黃框）＋內側黑細線；避開輪拱拱框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || archDist(x, y) < 2.15) {
          return -1;
        }
        return Math.max(Math.min(y - topBandLo(x), topBandHi(x) - y), Math.min(y - lowBandLo(x), lowBandHi(x) - y));
      }),
      mat: 'dYellow',
      name: 'decal-wall-bands',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || archDist(x, y) < 2.15) {
          return -1;
        }
        return Math.max(0.3 - Math.abs(y - (topBandLo(x) - 0.3)), 0.3 - Math.abs(y - (lowBandHi(x) + 0.3)));
      }),
      mat: 'dBlack',
      name: 'decal-wall-band-lines',
    });

    // 肩線黃釉細邊（沿肩稜線內側 0.3 → 1.5 mm），從車尾一路到鼻端
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y) || x < X_REAR + 2 || x > 70 || archDist(x, y) < 0.8) {
          return -1;
        }
        const dz = P.hw(x) - Math.abs(z);
        return Math.min(dz - 0.3, 1.5 - dz);
      }),
      mat: 'dYellow',
      name: 'decal-crest-pinstripe',
    });
    // 頭燈（V14，自創形狀）：鼻端兩側貼著肩線細邊內側的琥珀色細長燈條（x 50 → 68）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y)) {
          return -1;
        }
        const dz = P.hw(x) - Math.abs(z);
        return Math.min(dz - 2.0, 3.5 - dz, x - 50, 68 - x, Math.abs(z) - 5.6);
      }, { offset: 0.12 }),
      mat: 'lamp',
      name: 'lamp-head',
    });

    // 側牆主圖形：大玫瑰圓徽（深藍底、金圈、白瓣金心）拖著往後上掃的鱗紋色帶（深藍底、金邊、金色鱗紋）
    /** @type {(x: number, y: number, z: number) => boolean} 兩輪之間的側牆 */
    const onWaistWall = (x, y, z) => onSideWall(x, y, z) && Math.abs(x) < 24;
    parts.push({
      geometry: kit.decal((x, y, z) => (onWaistWall(x, y, z) ? -sideGraphicSd(x, y) : -1)),
      mat: 'dNavy',
      name: 'decal-side-graphic-base',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onWaistWall(x, y, z)) {
          return -1;
        }
        const ring = Math.hypot(x - ROUNDEL.x, y - ROUNDEL.y) - ROUNDEL.r;
        const band = scaleBandSd(x, y);
        // 圓徽金圈（寬 0.6）＋色帶金邊（寬 0.5，圓徽內不畫）＋色帶內的鱗紋
        const border = Math.min(-band, band + 0.5, ring);
        const scales = Math.min(-band - 0.9, ring - 0.4, scaleLine(x, y));
        return Math.max(Math.min(-ring, ring + 0.6), border, scales);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-side-graphic-gold',
    });
    /** @type {(x: number, y: number) => { petal: number, core: number }} 圓徽裡放大的玫瑰花飾 */
    const roundelRosette = (x, y) => {
      const r = rosetteSd((x - ROUNDEL.x) / ROUNDEL.k, (y - ROUNDEL.y) / ROUNDEL.k);
      return { petal: r.petal * ROUNDEL.k, core: r.core * ROUNDEL.k };
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (onWaistWall(x, y, z) ? -roundelRosette(x, y).petal : -1), { offset: 0.12 }),
      mat: 'dWhite',
      name: 'decal-roundel-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onWaistWall(x, y, z) ? -roundelRosette(x, y).core : -1), { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-roundel-core',
    });

    // 磚縫：側牆（兩道黃框之間，避開拱框與主圖形）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || y < lowBandHi(x) + 0.8 || y > topBandLo(x) - 0.8) {
          return -1;
        }
        if (archDist(x, y) < 2.6 || sideGraphicSd(x, y) < 0.8) {
          return -1;
        }
        return brickJoint(x, y);
      }),
      mat: 'dJoint',
      name: 'decal-brick-joints',
    });
    // 車頂磚縫（肩線細邊與中線花飾帶之間，避開座艙）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (!onTop(x, y) || az > P.hw(x) - 2.2 || az < 6 || x < X_REAR + 2 || x > 57 || cabinSd(x, z) < 2.6) {
          return -1;
        }
        return brickJoint(x, az + 1);
      }),
      mat: 'dJoint',
      name: 'decal-roof-joints',
    });

    // 拱門形座艙（城門拱道，拱頂朝車頭）：煙燻琥珀透明罩；罩下的殼面是深藍底＋一朵放大的白瓣金心玫瑰花飾（透過罩看得到），外圍亮金框（寬 1.4）＋黑細線
    parts.push({ geometry: buildCabinDome(), mat: 'glass', shell: true, renderOrder: 3, name: 'canopy-dome' });
    parts.push({ geometry: kit.decal((x, y, z) => (onTop(x, y) ? -cabinSd(x, z) : -1), { offset: 0.12 }), mat: 'dNavy', name: 'decal-cockpit-floor' });
    /** @type {(x: number, z: number) => { petal: number, core: number }} 座艙底的玫瑰花飾（車頂花飾的 2.6 倍，中心 x −10） */
    const floorRosette = (x, z) => {
      const r = rosetteSd((x + 10) / 2.6, z / 2.6);
      return { petal: r.petal * 2.6, core: r.core * 2.6 };
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (onTop(x, y) ? Math.min(-cabinSd(x, z) - 0.6, -floorRosette(x, z).petal) : -1), { offset: 0.14 }),
      mat: 'dWhite',
      name: 'decal-cockpit-rosette-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onTop(x, y) ? -floorRosette(x, z).core : -1), { offset: 0.16 }),
      mat: 'dGold',
      name: 'decal-cockpit-rosette-core',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y)) {
          return -1;
        }
        const d = cabinSd(x, z);
        return Math.min(d, 1.4 - d);
      }, { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-cockpit-arch-frame',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y)) {
          return -1;
        }
        const d = cabinSd(x, z);
        return Math.min(d - 1.4, 2.0 - d);
      }, { offset: 0.14 }),
      mat: 'dBlack',
      name: 'decal-cockpit-arch-line',
    });

    // 車頂中線的玫瑰花飾帶（M2 花飾帶採 V12 / V13 配置：從鼻尖一路往後貫穿到車尾，中間讓開座艙）——
    // 深藍底（|z| < 3.3）＋一列白瓣金心玫瑰花飾（每 6.2 mm 一朵）＋兩側黃釉邊（3.3 → 4.5）＋黑細線（4.5 → 5.1）
    /** @type {(x: number, y: number, z: number) => boolean} 車頂中線帶（鼻端半寬不夠處停止） */
    const onStripe = (x, y, z) => onTop(x, y) && x > X_REAR + 1.5 && P.hw(x) > 7.4 && cabinSd(x, z) > 2.0;
    parts.push({ geometry: kit.decal((x, y, z) => (onStripe(x, y, z) ? 3.3 - Math.abs(z) : -1)), mat: 'dNavy', name: 'decal-rosette-stripe-base' });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y, z) ? Math.min(Math.abs(z) - 3.3, 4.5 - Math.abs(z)) : -1)),
      mat: 'dYellow',
      name: 'decal-rosette-stripe-borders',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y, z) ? Math.min(Math.abs(z) - 4.5, 5.1 - Math.abs(z)) : -1)),
      mat: 'dBlack',
      name: 'decal-rosette-stripe-lines',
    });
    /** @type {number} 花飾間距 */
    const ROS_STEP = 6.2;
    /** @type {(x: number, z: number) => { petal: number, core: number }} 最近的一朵玫瑰花飾（條紋中線上；離座艙太近的不畫） */
    const nearestRosette = (x, z) => {
      const xc = Math.min(62, Math.max(-68, Math.round(x / ROS_STEP) * ROS_STEP));
      if (cabinSd(xc, 0) < 4.6) {
        return { petal: 1, core: 1 };
      }
      return rosetteSd(x - xc, z);
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y, z) ? -nearestRosette(x, z).petal : -1), { offset: 0.12 }),
      mat: 'dWhite',
      name: 'decal-rosette-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y, z) ? -nearestRosette(x, z).core : -1), { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-rosette-cores',
    });

    // 車尾的城門（crenel-tail）：城垛鰭刀（藍釉、刀背金邊、外側玫瑰花飾）＋後緣帶城垛齒的黃釉主翼
    const gate = buildGateWing();
    parts.push({ geometry: gate.fins, mat: 'lapis2', solid: true, outline: true, name: 'crenel-fin-blades' });
    parts.push({ geometry: gate.gilt, mat: 'gold2', solid: true, outline: true, name: 'crenel-fin-gilt' });
    parts.push({ geometry: gate.petals, mat: 'white', solid: true, name: 'crenel-fin-rosette-petals' });
    parts.push({ geometry: gate.cores, mat: 'gold2', solid: true, name: 'crenel-fin-rosette-cores' });
    parts.push({ geometry: gate.wing, mat: 'yellow2', solid: true, outline: true, name: 'wing-main' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry:
      '本檔站位產生器 P（推估，前低後高的楔形車殼）：殼 x −72 → 74（細長低尖鼻），鰭刀後緣 −76；肩線半寬 翼子板 44、腰 35（＋牆腳外張 0.6，外框半寬 ≤ 48.0）、鼻 17.5（x 60）→ 鼻端 4.4、車尾 24；甲板最高 33.9（x −28）、座艙罩頂約 37.5、鼻端 15.3、車尾 28.5，鰭刀刀尖 45.4（全車最高）；肩線 27.2–30.4；側裙下緣 10.5（包住電池管）、鼻端 12.8、車尾 16',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    crenels: '車尾城門：兩片城垛鰭刀（|z| 24、厚 1.4；上緣 x −40 → −76 從後翼子板頂面上挑到 y 45.4，後緣三階城垛缺口每階深 2.4、高 4.8；刀背金邊寬 2；外側 8 瓣玫瑰花飾直徑約 6.7）＋主翼（底面 y 39.4、厚 1.4、翼展 49.4、弦 9–10.5，後掠 4–5.5 mm，後緣 15 段城垛齒深 1.5）；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    livery: '側牆圓徽：半徑 4.9，花飾為車頂花飾的 1.95 倍；鱗紋色帶 x −22 → 10、半高 3.3 → 1.6、往後每 mm 上升 0.13；鱗紋為半徑 1.5 的半圓弧、列距 2.0；座艙拱門 x −24 → 7.5、半寬 7.5（透明罩高 4.2 mm，14 × 8 段，以殼面積 × 0.8 mm 計入質量；罩下花飾為車頂花飾的 2.6 倍）；頭燈條 x 50 → 68、寬 1.5（皆為貼紙，推估）',
    myth: '伊什塔爾城門的青金石藍釉磚、黃框、黑白金邊框與玫瑰花飾、拱門、城垛（MYTH_RESEARCH M2、M3）；穆修胡修只取鱗身的鱗紋（M1），不做頭、角、腳、尾',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
