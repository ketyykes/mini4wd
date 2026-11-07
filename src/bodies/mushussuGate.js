// 伊什塔爾城門（body-mushussu-gate，神話組・美索不達米亞）：照四視圖 09 建模——寬平的方鼻頭、前移的六角座艙、從座艙一路緩降到車尾的快背，
// 前翼子板頂比引擎蓋中線高（引擎蓋是兩道翼子板稜線之間的低谷）；車上沒有任何動物的頭、臉、腳。
// 四視圖的蜂巢格柵鼻 → 鼻端斜面上的「釉磚格」：金框裡一格格錯縫的黃釉磚；四個角上的小翼片 → 階梯形城垛（美索不達米亞城牆的三階雉堞）；
// 車尾 → 城門：兩座門塔（後翼子板上的階梯形尾鰭）夾著一道頂緣排滿三階雉堞的城牆尾翼；六角座艙是深色的城門拱道（金框）。
// 塗裝：青金石藍釉磚車身（錯縫磚縫）、側牆上緣一列白瓣金心玫瑰花飾帶、兩輪之間的土黃釉磚階梯側板、金色細線、瀝青黑裙帶。
// 穆修胡修只留抽象的鱗紋（土黃側板上的金色鱗線）。設計：shared/design/body-mushussu-gate/DESIGN.md（文物對應 MYTH_RESEARCH 第 4 節 M1–M5）。
// 配色取自 M2 / 4-2（青金石釉藍、黃釉、黑白金邊框與玫瑰花飾）；圖形全部自繪；不含任何文字。剖面為本檔站位產生器（推估）。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾封口 x */
const X_REAR = -73;
/** @type {number} 車頭（方鼻頭封口）x */
const X_FRONT = 74;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-73, -70, -62, -52, -40, -28, -14, 0, 14, 28, 40, 50, 58, 64, 68, 71, 74];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：寬平的方鼻頭 37–39（四視圖俯視的寬鼻）、前後翼子板 44.5、腰身 23（四視圖俯視的深收腰）、窄方尾 24–27.5（讓開 ±42.5 的後導輪）
  hw: monoCurve(XS, [24, 25, 27.5, 36, 44.5, 35, 25, 23, 25, 35, 44.5, 43.5, 40.5, 39, 38.5, 38, 37]),
  // 中線高度：鼻端斜面 16 → 引擎蓋 29.5 → 座艙頂 37.8（x 0，四視圖側視的最高點）→ 快背一路緩降到車尾 31
  yTop: monoCurve(XS, [31, 32.2, 33.5, 34.6, 35.4, 36.4, 37.5, 37.8, 36.2, 33.4, 31, 29.5, 28.6, 27.6, 25.5, 21, 16]),
  // 車頂（座艙 / 快背）平台的半寬：座艙段 13，往鼻端收到 8、往車尾收到 10.5
  cw: monoCurve(XS, [10.5, 11, 12, 12.5, 13, 13, 13, 13, 13, 12, 10.5, 9.5, 8.8, 8.4, 8.2, 8, 8]),
  // 翼子板稜線高度：前輪上方 32.8（比引擎蓋中線高 → 正視的低谷引擎蓋），後段 32.5 托住快背
  yF: monoCurve(XS, [28.6, 30.2, 31.8, 32.3, 32.5, 32, 31.2, 30.6, 31, 32, 32.6, 32.2, 31.2, 29.6, 27, 22.5, 17]),
  // 肩稜線（頂面與側牆交界，銳利）：輪上 31.2、腰 27.5；鼻端跟著斜面降到 15.5
  yS: monoCurve(XS, [26, 27.6, 29.6, 30.8, 31.2, 29.6, 27.2, 26.6, 27.2, 29.2, 31.2, 30.2, 28.5, 26.5, 24, 20, 15.5]),
  // 側裙下緣（腰段 12.5，loft 自動讓開底盤側框）；車尾抬高讓開後導輪
  yLow: monoCurve(XS, [20, 18, 15.5, 13.5, 12.6, 12.5, 12.5, 12.5, 12.5, 12.5, 12.6, 13, 13.6, 14, 14.3, 14.5, 14.8]),
};

/** @type {number} 側牆往下的外張量 */
const FLARE = 0.6;
/** @type {(x: number) => number} 翼子板稜線的 |z|（車頂平台與肩線之間 60%） */
const zF = (x) => lerp(P.cw(x), P.hw(x), 0.6);

/**
 * 半剖面 7 點：中線 → 車頂平台邊（銳利）→ 斜面 → 翼子板稜線（銳利）→ 肩稜線（銳利）→ 幾乎直立的側牆 → 側裙下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const c = P.cw(x);
  const f = P.yF(x);
  const z3 = zF(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  return [
    [0, t],
    [c, t - 0.5],
    [lerp(c, z3, 0.5), lerp(t - 0.5, f, 0.5) + 0.35],
    [z3, f],
    [h, s],
    [h + FLARE / 2, lerp(s, lo, 0.5)],
    [h + FLARE, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與鼻端每 0.75 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -64, 0.75, profile).slice(0, -1), ...buildStations(-64, 60, 2, profile).slice(0, -1), ...buildStations(60, X_FRONT, 0.75, profile)];

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
/** @type {{ x: number, hw: number }} 車尾中央的城門口（俯視缺口：x < x、|z| < hw），城牆尾翼像門楣一樣跨在門口上 */
const GATE_GAP = { x: -63, hw: 13 };
/** @type {(x: number, y: number, z: number) => number} 城門口開口距離（負值 = 開口內） */
const gateGapSd = (x, y, z) => Math.max(x - GATE_GAP.x, Math.abs(z) - GATE_GAP.hw);
/** @type {number} 鼻端斜面（釉磚格所在）的起點 x */
const NOSE_FACE_X = 67.5;

/** @type {number} 牆腳瀝青黑裙帶高度 */
const SKIRT_H = 2.6;
/** @type {(x: number) => number} 玫瑰花飾帶的中心高度（肩線下 3.4） */
const rosetteBandY = (x) => P.yS(x) - 3.4;
/** @type {number} 玫瑰花飾帶半高 */
const ROS_BAND_H = 2.3;

/**
 * 土黃釉磚側板的上緣（側視階梯線）：兩輪之間由前往後一階一階升高（像階梯形雉堞的側影），每階寬 7、高 1.6
 * @type {(x: number) => number}
 */
const ochreTopY = (x) => {
  const k = Math.max(0, Math.min(4, Math.floor((18 - x) / 7)));
  return 17.2 + 1.6 * k;
};
/** @type {(x: number, y: number) => number} 土黃側板（兩輪之間、裙帶之上、階梯線之下；負值 = 板內） */
const ochreSd = (x, y) => Math.max(y - ochreTopY(x), P.yLow(x) + SKIRT_H - y, x - 21, -21 - x, 2.2 - archDist(x, y));

/**
 * 玫瑰花飾（M2：白瓣金心的圓瓣花，不做放射線）：中心圓 r 0.6、8 片圓瓣 r 0.55 繞半徑 1.25（直徑約 3.6）
 * @type {(u: number, v: number) => { petal: number, core: number }}
 */
const rosetteSd = (u, v) => {
  const core = Math.hypot(u, v) - 0.6;
  let petal = Infinity;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    petal = Math.min(petal, Math.hypot(u - 1.25 * Math.cos(a), v - 1.25 * Math.sin(a)) - 0.55);
  }
  return { petal: Math.max(petal, -core - 0.2), core };
};

/**
 * 磚縫（橫向錯縫）：每層高 course、磚長 len，上下層錯半塊；線寬 0.6（正值 = 磚縫上）
 * @type {(a: number, y: number, course?: number, len?: number) => number} a = 沿牆面的水平座標
 */
const brickJoint = (a, y, course = 4, len = 8) => {
  const j = Math.floor((y - 1) / course);
  const ph = (((y - 1) % course) + course) % course;
  const dh = Math.min(ph, course - ph);
  const shift = (((j % 2) + 2) % 2) * (len / 2);
  const pa = (((a - shift) % len) + len) % len;
  const dv = Math.min(pa, len - pa);
  return 0.3 - Math.min(dh, dv);
};

/**
 * 鱗紋：一列列朝車尾的半圓弧（半徑 1.3），相鄰兩列錯開半片；線寬 0.5（正值 = 線上）
 * @type {(x: number, y: number) => number}
 */
const scaleLine = (x, y) => {
  const dx = 1.8;
  const dy = 2.6;
  const i = Math.floor(x / dx) + 1;
  const off = (((i % 2) + 2) % 2) * (dy / 2);
  const cy = Math.round((y - off) / dy) * dy + off;
  return 0.25 - Math.abs(Math.hypot(x - i * dx, y - cy) - dy / 2);
};

/** @type {{ x0: number, x1: number, x2: number, x3: number, w0: number, w1: number, w2: number }} 六角座艙（俯視）：鼻端尖點 x3、前肩 x2、後肩 x1、後緣 x0；各處半寬 */
const CAB = { x0: -18, x1: -6, x2: 18, x3: 40, w0: 8.5, w1: 12.4, w2: 6 };
/**
 * 六角座艙（城門拱道）的距離（俯視；負值 = 座艙內）：前窄後寬的長六角形
 * @type {(x: number, z: number) => number}
 */
const cabinSd = (x, z) => {
  const az = Math.abs(z);
  /** @type {number} 該 x 的座艙半寬 */
  let w;
  if (x < CAB.x0 || x > CAB.x3) {
    return Math.max(CAB.x0 - x, x - CAB.x3, az - 1);
  }
  if (x < CAB.x1) {
    w = lerp(CAB.w0, CAB.w1, (x - CAB.x0) / (CAB.x1 - CAB.x0));
  } else if (x < CAB.x2) {
    w = CAB.w1;
  } else {
    w = lerp(CAB.w1, CAB.w2, (x - CAB.x2) / (CAB.x3 - CAB.x2));
  }
  return Math.max(az - w, CAB.x0 - x, x - CAB.x3);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 青金石藍釉磚（亮面釉）
  lapis: namedMaterial('paint-lapis-glaze', { color: 0x1b469a, roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.12 }),
  lapis2: namedMaterial('paint-lapis-glaze', { color: 0x1b469a, roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
  // 土黃釉磚（霧面）
  ochre: namedMaterial('paint-ochre-glaze-matte', { color: 0xc08a3e, roughness: 0.62, clearcoat: 0.1 }),
  ochre2: namedMaterial('paint-ochre-glaze-matte', { color: 0xc08a3e, roughness: 0.62, clearcoat: 0.1, side: THREE.DoubleSide }),
  // 城門拱道：深藍黑亮釉
  arch: namedMaterial('paint-gate-arch-navy', { color: 0x0e1f42, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
  // 牆腳瀝青黑（霧面；新巴比倫以瀝青作砌磚灰漿，推估）
  bitumen: namedMaterial('paint-bitumen-black-matte', { color: 0x1a1a1a, roughness: 0.72, clearcoat: 0.05 }),
  bitumen2: namedMaterial('paint-bitumen-black-matte', { color: 0x1a1a1a, roughness: 0.72, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 金邊（真金屬：-brass 結尾）
  gold2: namedMaterial('trim-gold-brass', { color: 0xc8a24a, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x131a26, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x173b78, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x14284a, roughness: 0.75, side: THREE.DoubleSide }),
  dJoint: decalMaterial('decal-brick-joint-navy', { color: 0x14377e, roughness: 0.5 }),
  dJointOchre: decalMaterial('decal-brick-joint-umber', { color: 0x7a5424, roughness: 0.6 }),
  dYellow: decalMaterial('decal-yellow-glaze', { color: 0xe0ac46, roughness: 0.36 }),
  dTurq: decalMaterial('decal-turquoise-glaze', { color: 0x2f8fb0, roughness: 0.36 }),
  dWhite: decalMaterial('decal-white-glaze', { color: 0xf2efe6, roughness: 0.38 }),
  dGold: decalMaterial('decal-gold', { color: 0xc8a24a, roughness: 0.32, metalness: 0.7 }),
  dNavy: decalMaterial('decal-gate-shadow-navy', { color: 0x0f2347, roughness: 0.6 }),
  // 頭燈：琥珀色細長燈條（低強度自發光，不過曝）
  lamp: decalMaterial('lamp-head-amber', { color: 0xffb440, emissive: 0xff8a10, emissiveIntensity: 0.35, roughness: 0.3 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 一排三階雉堞（美索不達米亞城牆的階梯形雉堞）的上緣折線：(u, v) 平面，u 從 u0 到 u1，牆頂 v0，每座雉堞 3 階
 * @type {(u0: number, u1: number, v0: number, n: number, stepH: number) => number[][]}
 */
const crenelEdge = (u0, u1, v0, n, stepH) => {
  /** @type {number[][]} */
  const pts = [];
  const pitch = (u1 - u0) / n;
  for (let k = 0; k < n; k++) {
    const a = u0 + k * pitch;
    // 雉堞底寬占 pitch 的 72%，左右各留 14% 的牆垛缺口
    const m0 = a + pitch * 0.14;
    const m1 = a + pitch * 0.86;
    const w = m1 - m0;
    pts.push([a, v0], [m0, v0]);
    for (let s = 0; s < 3; s++) {
      const inset = (w * s) / 6;
      pts.push([m0 + inset, v0 + stepH * s], [m0 + inset, v0 + stepH * (s + 1)]);
    }
    for (let s = 2; s >= 0; s--) {
      const inset = (w * s) / 6;
      pts.push([m1 - inset, v0 + stepH * (s + 1)], [m1 - inset, v0 + stepH * s]);
    }
    pts.push([m1, v0]);
  }
  pts.push([u1, v0]);
  return pts;
};

/** @type {number} 城牆尾翼的 x（板中心）與厚度 */
const WALL_X = -69.5;
/** @type {number} */
const WALL_T = 1.2;
/** @type {number} 城牆尾翼半寬（兩端接門塔） */
const WALL_HALF = 21.8;
/** @type {number} 城牆頂（雉堞底）高度 */
const WALL_TOP = 35.4;
/** @type {number} 門塔（後翼子板上的階梯形尾鰭）中心 |z| 與板厚 */
const TOWER_Z = 22.6;
/** @type {number} */
const TOWER_T = 1.4;
/**
 * 門塔側視輪廓（x, y）：前緣從後翼子板稜線斜升，頂緣往後三階升高（階梯形雉堞的側影），後緣直落並埋進車尾殼面
 * @type {number[][]}
 */
const TOWER_PTS = [[-50, 30.4], [-56, 35.6], [-59, 35.6], [-59, 37.2], [-62.5, 37.2], [-62.5, 38.8], [-66, 38.8], [-66, 40.4], [-71.5, 40.4], [-72.5, 38.8], [-72.5, 27.5], [-62, 29.5], [-56, 29.6]];
/** @type {number} 前翼子板小城垛片的中心 |z|（貼在翼子板稜線上） */
const FRONT_TAB_Z = 28;

/**
 * 車尾城門與前翼子板的城垛片
 * @type {() => { wall: THREE.BufferGeometry, wallGilt: THREE.BufferGeometry, towers: THREE.BufferGeometry, towerGilt: THREE.BufferGeometry, tabs: THREE.BufferGeometry }}
 */
const buildGate = () => {
  /** @type {(pts: number[][], thick: number, zc: number) => THREE.BufferGeometry} 側視多邊形沿 z 擠出 thick，中心在 zc */
  const sidePlate = (pts, thick, zc) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: thick, bevelEnabled: false });
    g.translate(0, 0, zc - thick / 2);
    return g;
  };
  /** @type {(pts: number[][], thick: number, xc: number) => THREE.BufferGeometry} 正視多邊形 (z, y) 沿 x 擠出 thick，中心在 xc */
  const frontPlate = (pts, thick, xc) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), { depth: thick, bevelEnabled: false });
    // 局部 (z, y, d) 繞 y 轉 90° → 世界 (d, y, −z)：擠出方向變成 +x（形狀左右對稱，z 反號不影響），再平移到中心
    g.rotateY(Math.PI / 2);
    g.translate(xc - thick / 2, 0, 0);
    return g;
  };
  // 城牆尾翼：底緣埋進車尾殼面（y 30.5），頂緣 4 座三階雉堞（每階高 1.0）
  const wallPts = [[-WALL_HALF, 30.5], ...crenelEdge(-WALL_HALF, WALL_HALF, WALL_TOP, 4, 1.0), [WALL_HALF, 30.5]];
  const wall = frontPlate(wallPts, WALL_T, WALL_X);
  // 牆頂下的金色飾帶（寬 1.1，比牆厚 0.4）
  const giltPts = [[-WALL_HALF, WALL_TOP - 1.6], [WALL_HALF, WALL_TOP - 1.6], [WALL_HALF, WALL_TOP - 0.5], [-WALL_HALF, WALL_TOP - 0.5]];
  const wallGilt = frontPlate(giltPts, WALL_T + 0.4, WALL_X);
  /** @type {THREE.BufferGeometry[]} */
  const towers = [];
  /** @type {THREE.BufferGeometry[]} */
  const towerGilt = [];
  /** @type {THREE.BufferGeometry[]} */
  const tabs = [];
  // 門塔頂緣的金邊：沿三階頂緣往下 1 mm 的帶
  const stepTop = TOWER_PTS.slice(1, 10);
  const giltBand = [...stepTop, ...stepTop.slice().reverse().map(([x, y]) => [x, y - 1])];
  // 前翼子板小城垛片：側視是一座三階雉堞（底寬 11、每階高 1.8），底緣埋進翼子板稜線
  const tabPts = [[54, 31], [54, 33.6], [52.4, 33.6], [52.4, 35.4], [50.8, 35.4], [50.8, 37.2], [46.2, 37.2], [46.2, 35.4], [44.6, 35.4], [44.6, 33.6], [43, 33.6], [43, 31], [48.5, 30]];
  for (const sg of [-1, 1]) {
    towers.push(sidePlate(TOWER_PTS, TOWER_T, sg * TOWER_Z));
    towerGilt.push(sidePlate(giltBand, TOWER_T + 0.4, sg * TOWER_Z));
    tabs.push(sidePlate(tabPts, 1.4, sg * FRONT_TAB_Z));
  }
  return { wall, wallGilt, towers: mergeGeos(towers), towerGilt: mergeGeos(towerGilt), tabs: mergeGeos(tabs) };
};

export const mushussuGateBody = makePolyBody({
  id: 'body-mushussu-gate',
  name: '伊什塔爾城門・穆修胡修',
  style: 'myth',
  phase: 13,
  mythSeries: 'mesopotamian',
  mythTheme: 'mushussu',
  form: 'glazed-grille-fastback',
  roof: 'closed',
  wing: 'gate-tower-crenel',
  theme: '寬平方鼻頭、前移六角座艙、緩降快背的四驅車披上伊什塔爾城門的釉磚：鼻端斜面金框裡的錯縫黃釉磚格、青金石藍釉磚車身、深藍黑亮釉的六角城門拱道座艙（金框）、前翼子板上的小階梯雉堞片、側牆上緣的白瓣金心玫瑰花飾帶、兩輪之間的土黃釉磚階梯側板（金色鱗紋）；車尾是城門——兩座階梯形門塔尾鰭夾著頂緣排滿三階雉堞的城牆尾翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: [1, 3, 4],
  step: 0.65,
  wheelArches: ARCHES,
  openings: [{ id: '車尾城門口', shape: 'fn', sd: gateGapSd }],
  sideZMin: 22,
  zones: () => [
    // 牆腳瀝青黑裙帶
    { mat: 'bitumen', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.4 ? P.yLow(x) + SKIRT_H - y : -1) },
    // 兩輪之間的土黃釉磚階梯側板
    { mat: 'ochre', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.4 ? -ochreSd(x, y) : -1) },
    // 六角城門拱道座艙
    { mat: 'arch', keep: (x, y, z) => (onTop(x, y) ? -cabinSd(x, z) : -1) },
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'bitumen2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 輪拱拱框：金色細框（城門拱的邊框）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = archDist(x, y);
        return Math.min(d, 1.1 - d);
      }),
      mat: 'dGold',
      name: 'decal-arch-band',
    });

    // 肩線金色細邊（肩稜線內側 0.2 → 0.9 mm）與翼子板稜線金線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y) || x < X_REAR + 1.5 || x > NOSE_FACE_X || archDist(x, y) < 0.6) {
          return -1;
        }
        const dz = P.hw(x) - Math.abs(z);
        const dc = Math.abs(Math.abs(z) - zF(x));
        return Math.max(Math.min(dz - 0.2, 0.9 - dz), 0.32 - dc);
      }),
      mat: 'dGold',
      name: 'decal-crest-pinstripe',
    });

    // 鼻端斜面的釉磚格（四視圖蜂巢格柵鼻）：深藍底 → 錯縫黃釉磚（磚 4.6 × 2.2、縫 0.55）→ 外圍金框（寬 1.1）
    /** @type {number} 釉磚格半寬 */
    const GRILLE_HW = 19;
    /** @type {(x: number, y: number, z: number) => number} 釉磚格框內（正值 = 框內） */
    const inGrille = (x, y, z) => Math.min(x - NOSE_FACE_X - 0.6, GRILLE_HW - Math.abs(z), y - P.yLow(x) - 1.6);
    parts.push({ geometry: kit.decal((x, y, z) => (onTop(x, y) || x > X_FRONT - 1.6 ? inGrille(x, y, z) : -1)), mat: 'dNavy', name: 'decal-grille-base' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!(onTop(x, y) || x > X_FRONT - 1.6)) {
          return -1;
        }
        const inside = inGrille(x, y, z);
        // 沿斜面往上的座標：用 y 當磚層方向
        return Math.min(inside - 0.9, -brickJoint(z + 40, y, 2.2, 4.6) - 0.02);
      }, { offset: 0.12 }),
      mat: 'dYellow',
      name: 'decal-grille-bricks',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!(onTop(x, y) || x > X_FRONT - 1.6)) {
          return -1;
        }
        const inside = inGrille(x, y, z);
        return Math.min(inside + 1.1, -inside);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-grille-frame',
    });
    // 頭燈：釉磚格外側的琥珀色斜細燈條
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y) || x < NOSE_FACE_X + 0.5) {
          return -1;
        }
        const az = Math.abs(z);
        const yc = lerp(P.yLow(x) + 3.2, P.yLow(x) + 5.2, (az - 21.5) / 11.5);
        return Math.min(az - 21.5, 33 - az, 0.8 - Math.abs(y - yc));
      }, { offset: 0.12 }),
      mat: 'lamp',
      name: 'lamp-head',
    });

    // 六角城門拱道的金框（寬 1.0）與拱道裡的磚縫（深色上的細金縫，讀成拱道內壁）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y)) {
          return -1;
        }
        const d = cabinSd(x, z);
        return Math.min(d, 1.3 - d);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-gate-arch-frame',
    });

    // 後甲板磚縫（座艙後方到城牆，避開金線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (!onTop(x, y) || az > P.hw(x) - 1.4 || x < X_REAR + 2 || x > CAB.x0 - 2.5 || Math.abs(az - zF(x)) < 0.9) {
          return -1;
        }
        return brickJoint(x, az + 1);
      }),
      mat: 'dJoint',
      name: 'decal-roof-joints',
    });

    // 側牆上緣的玫瑰花飾帶（M2）：深藍底＋金邊＋白瓣金心玫瑰花飾（每 5.4 mm 一朵），避開輪拱
    /** @type {(x: number, y: number, z: number) => number} 花飾帶內（正值 = 帶內） */
    const inRosBand = (x, y, z) => (onSideWall(x, y, z) && archDist(x, y) > 1.8 && x < NOSE_FACE_X - 1 ? ROS_BAND_H - Math.abs(y - rosetteBandY(x)) : -1);
    parts.push({ geometry: kit.decal(inRosBand), mat: 'dNavy', name: 'decal-rosette-band-base' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const b = inRosBand(x, y, z);
        return Math.min(b, 0.5 - b);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-rosette-band-borders',
    });
    /** @type {number} 花飾間距 */
    const ROS_STEP = 5.4;
    /** @type {(x: number, y: number) => { petal: number, core: number }} 最近的一朵玫瑰花飾 */
    const nearestRosette = (x, y) => {
      const xc = Math.round(x / ROS_STEP) * ROS_STEP;
      return rosetteSd(x - xc, y - rosetteBandY(xc));
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (inRosBand(x, y, z) > 0.5 ? -nearestRosette(x, y).petal : -1), { offset: 0.14 }),
      mat: 'dWhite',
      name: 'decal-rosette-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (inRosBand(x, y, z) > 0.5 ? -nearestRosette(x, y).core : -1), { offset: 0.16 }),
      mat: 'dGold',
      name: 'decal-rosette-cores',
    });

    // 側牆磚縫（花飾帶與土黃側板之間）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || y < P.yLow(x) + SKIRT_H + 0.6 || y > rosetteBandY(x) - ROS_BAND_H - 0.6) {
          return -1;
        }
        if (archDist(x, y) < 2.4 || ochreSd(x, y) < 0.6) {
          return -1;
        }
        return brickJoint(x, y);
      }),
      mat: 'dJoint',
      name: 'decal-brick-joints',
    });
    // 土黃側板的金色階梯邊與鱗紋
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = ochreSd(x, y);
        const edge = Math.min(-d, d + 0.6);
        const scales = Math.min(-d - 1.4, scaleLine(x, y));
        return Math.max(edge, scales);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-ochre-panel-gold',
    });

    // 車尾城門（gate-tower-crenel）＋前翼子板小城垛片
    const gate = buildGate();
    parts.push({ geometry: gate.wall, mat: 'ochre2', solid: true, outline: true, name: 'wing-crenel-wall' });
    parts.push({ geometry: gate.wallGilt, mat: 'gold2', solid: true, name: 'wing-crenel-gilt' });
    parts.push({ geometry: gate.towers, mat: 'lapis2', solid: true, outline: true, name: 'gate-tower-fins' });
    parts.push({ geometry: gate.towerGilt, mat: 'gold2', solid: true, outline: true, name: 'gate-tower-gilt' });
    parts.push({ geometry: gate.tabs, mat: 'gold2', solid: true, outline: true, name: 'fender-crenel-tabs' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    fourview: 'shared/design/body-mushussu-gate/fourview.png（四視圖 09）與 fourview_trace.txt：側視頂線、俯視半寬、正視低谷引擎蓋的比例照圖，高度整體縮到合法範圍（推估）',
    geometry:
      '本檔站位產生器 P（推估）：殼 x −73 → 74；肩線半寬 方鼻 37–39、翼子板 44.5、腰 23、車尾 24–27.5；車尾中央 |z| < 13 切出城門口（x < −63）（＋牆腳外張 0.6，外框半寬 ≤ 48.0）；中線 鼻端 16、引擎蓋 29.5、座艙頂 37.8（x 0）、車尾 31；翼子板稜線 32.5–32.6；門塔頂 40.4（全車最高）；側裙下緣 12.5，車尾 20 讓開後導輪',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    gate: '城牆尾翼：x −69.5、厚 1.2、半寬 21.8，牆頂 35.4，4 座三階雉堞每階高 1.0；門塔尾鰭 |z| 22.6、厚 1.4，頂緣三階 35.6 → 40.4；前翼子板城垛片 |z| 28、厚 1.4、底寬 11、高約 6；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    livery: '鼻端釉磚格 半寬 19、磚 4.6 × 2.2；六角座艙 x −18 → 40、最寬半寬 12.2；玫瑰花飾帶在肩線下 3.4、半高 2.3、間距 5.4；土黃側板 x −21 → 21、上緣每 7 mm 升 1.6（皆為貼紙 / 塗裝分區，推估）',
    myth: '伊什塔爾城門的青金石藍釉磚、黃釉、金邊框、玫瑰花飾、拱門與階梯形雉堞（MYTH_RESEARCH M2、M3）；穆修胡修只取鱗紋（M1），不做頭、角、腳、尾',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
