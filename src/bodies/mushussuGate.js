// 伊什塔爾城門的穆修胡修（body-mushussu-gate，第八階段神話組・美索不達米亞）：整台車是一段新巴比倫城門——
// 前後輪上方各一座方正寬厚的塔樓（俯視兩塔外凸、中段是較窄的城牆＝門道），前輪在半圓拱、後輪在尖拱裡（M1：前足獅掌、後足鷹爪）；
// 側面青金石藍釉磚（橫向錯縫磚縫）、上緣一圈白／金圓瓣玫瑰花飾帶、城牆中段一隻黃釉穆修胡修側身剪影（貼紙，不做整車龍頭）；
// 車頭是城門門樓：正面一個黃釉拱框＋金邊的半圓拱門；車尾上緣一排階梯形城垛（crenel-tail，實體件）；車頂中線一條黃黑磚的遊行大道。
// 設計：shared/design/body-mushussu-gate/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 4 節 M1–M5；黑名單 4-3、第 9 節 Dragon Jr. / Beat-Magnum）。剖面為本檔站位產生器（推估）。
// 配色取自 M2 / 4-2（青金石釉藍、黃釉、黑白金邊框與玫瑰花飾）；圖形全部自繪；不做龍頭車身、不放龍形駕駛、不做紅龍徽章、玫瑰花飾只用圓瓣（不做放射閃電）；不含任何文字。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, buildArchLiner } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾（後塔樓背面）x */
const X_REAR = -60;
/** @type {number} 門樓正面 x */
const X_FRONT = 68.5;
/** @type {number} 塔樓牆腳半寬（俯視兩塔外凸到車寬 101，和既有車殼的方形平面拉開輪廓 IoU） */
const TOWER_HW = 50.5;
/** @type {number} 塔樓 / 城牆頂的倒角 */
const CH = 1.5;

/**
 * 站位參數表（x 由後到前，前後軸 x = ±40）：後塔樓 x −62 → −18、城牆（門道）−18 → 18、前塔樓 18 → 62、門樓 62 → 70；
 * 相鄰兩站相距 1–1.5 mm 的地方是塔樓的轉角（單調內插，不會過衝）
 * @type {number[]}
 */
const XS = [-60, -58, -56.5, -19.7, -18.3, 18.3, 19.7, 59.8, 61, 68.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 牆腳半寬：塔樓 TOWER_HW，城牆 33.5（坐在底盤側框上、罩住底盤側面），門樓 19
  hw: monoCurve(XS, [TOWER_HW, TOWER_HW, TOWER_HW, TOWER_HW, 33.5, 33.5, TOWER_HW, TOWER_HW, 19, 19]),
  // 牆面收分（牆頂比牆腳內收，城牆的 batter）
  batter: monoCurve(XS, [1.5, 1.5, 1.5, 1.5, 0.6, 0.6, 1.5, 1.5, 0.8, 0.8]),
  // 牆頂（中線）高度：後塔樓 41.5、城牆 37.5、前塔樓 40、門樓 34
  yTop: monoCurve(XS, [38.5, 38.5, 38.5, 38.5, 34, 34, 38.5, 38.5, 30.5, 30.5]),
  // 牆腳：塔樓外牆 14（輪拱切開），城牆 11（底盤側框段由 loft.js 自動讓到 9.9），車尾收高到 24（離開後導輪）
  yLow: monoCurve(XS, [30, 15, 15, 15, 11, 11, 15, 15, 13, 13]),
};

/**
 * 半剖面 4 點：中線頂 → 牆頂倒角起點 → 倒角終點（牆頂外緣）→ 牆腳（收分）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = P.hw(x);
  const hwTop = hw - P.batter(x);
  const yTop = P.yTop(x);
  return [
    [0, yTop],
    [hwTop - CH, yTop],
    [hwTop, yTop - CH],
    [hw, P.yLow(x)],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 站位表（每 0.5 mm 一站，塔樓轉角才清楚） */
const STATIONS = buildStations(X_REAR, X_FRONT, 0.5, profile);

/** @type {(x: number) => number} 牆頂外緣高度（倒角下緣） */
const wallTop = (x) => P.yTop(x) - CH;

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }} 前輪半圓拱（獅掌，R17.5 = 31 mm 輪半徑 15.5 + 2） */
const FRONT_ARCH = { x: 40, y: 13, radius: 17.5, cutZFrom: 44 };
/**
 * 塔樓橫向立面（內側兩面、前塔樓正面）y 24 以下的開口距離（負值 = 開口內）
 * @type {(x: number, y: number, z: number) => number}
 */
const towerSkirtSd = (x, y, z) => {
  const az = Math.abs(z);
  const ax = Math.abs(x);
  const inner = Math.max(36.5 - az, Math.abs(ax - 18.85) - 1.05);
  const front = Math.max(21.5 - az, Math.abs(x - 60.4) - 0.8);
  return Math.max(Math.min(inner, front), y - 24);
};

/** @type {{ x: number, y: number, span: number, r: number }} 後輪尖拱（鷹爪）：兩段 R19 圓弧交於拱頂，起拱線在輪軸高度、半跨 17.5 */
const REAR_ARCH = { x: -40, y: 13, span: 17.5, r: 19 };
/** @type {number} 尖拱兩圓心離中線的距離 */
const REAR_ARCH_D = REAR_ARCH.r - REAR_ARCH.span;

/**
 * 後輪尖拱的 2D 距離（側視 (x, y)，負值 = 拱內）：起拱線以下是直立的拱腳
 * @type {(x: number, y: number) => number}
 */
const pointedArchSd = (x, y) => {
  const u = x - REAR_ARCH.x;
  const v = y - REAR_ARCH.y;
  if (v <= 0) {
    return Math.abs(u) - REAR_ARCH.span;
  }
  return Math.max(Math.hypot(u - REAR_ARCH_D, v), Math.hypot(u + REAR_ARCH_D, v)) - REAR_ARCH.r;
};

/**
 * 前輪半圓拱的 2D 距離（側視）
 * @type {(x: number, y: number) => number}
 */
const roundArchSd = (x, y) => Math.hypot(x - FRONT_ARCH.x, y - FRONT_ARCH.y) - FRONT_ARCH.radius;

/** @type {number} 塔樓外牆判定：|z| 大於此值才是塔樓外牆（城牆 36、門樓 26 都在內側） */
const TOWER_Z = 44;

/** @type {number[][]} 塔樓轉角（側牆轉成橫向立面）的 x 區間：這幾段不畫磚縫 / 花飾 */
const CORNERS = [
  [-58.3, -56.2],
  [-20, -18],
  [18, 20],
  [59.5, 61.3],
];

/** @type {(x: number) => boolean} 在塔樓轉角區 */
const inCorner = (x) => CORNERS.some(([a, b]) => x > a && x < b);

/** @type {{ x0: number, y0: number }} 穆修胡修剪影的位置（城牆中段，側視） */
const BEAST = { x0: -1.5, y0: 13.3 };

/** @type {(u: number, v: number, ax: number, ay: number, bx: number, by: number, r: number) => number} 圓頭線段（膠囊）距離 */
const capsule = (u, v, ax, ay, bx, by, r) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - ax - t * dx, v - ay - t * dy) - r;
};

/**
 * 穆修胡修側身剪影（M1：鱗身、長頸、蛇頭與蛇信、頭上直角、前足獅掌、後足鷹爪、上翹的蠍尾）；u 往車頭、v 往上，腳底 v = 0
 * 全部用膠囊組成（自繪），長約 31、高約 17.5 mm
 * @type {(u: number, v: number) => number}
 */
const beastSd = (u, v) => {
  /** @type {number[][]} [ax, ay, bx, by, r] */
  const segs = [
    // 軀幹（細長）
    [-7, 7.2, 5, 7.8, 2.3],
    // 長頸（直立，M1：long neck）
    [4.5, 8.5, 7.6, 12.2, 1.45],
    [7.6, 12.2, 8.8, 14.2, 1.2],
    // 蛇頭＋吻
    [8.6, 14.4, 12.8, 14.0, 1.05],
    [12.8, 13.9, 14.2, 13.5, 0.6],
    // 頭上長直角（往後上）與頭冠
    [9.6, 15.3, 6.8, 17.7, 0.5],
    [10.7, 15.1, 10.1, 16.5, 0.38],
    // 分岔蛇信
    [14.2, 13.5, 15.9, 13.9, 0.28],
    [14.2, 13.5, 15.7, 12.7, 0.28],
    // 前足（獅）：前後兩腳、圓掌
    [4.0, 6.2, 4.8, 1.6, 1.2],
    [4.8, 1.6, 5.0, 0.8, 0.85],
    [4.6, 0.6, 6.4, 0.6, 0.6],
    [1.8, 6.0, 2.3, 1.6, 1.0],
    [2.3, 1.6, 2.4, 0.7, 0.7],
    [2.0, 0.55, 3.6, 0.55, 0.55],
    // 後足（鷹）：粗腿、細脛、三爪
    [-5.6, 6.6, -6.4, 3.2, 1.35],
    [-6.4, 3.2, -6.2, 1.0, 0.55],
    [-6.2, 1.0, -4.5, 0.25, 0.3],
    [-6.2, 1.0, -5.8, 0.05, 0.3],
    [-6.2, 1.0, -7.9, 0.25, 0.3],
    [-3.2, 6.6, -3.9, 3.2, 1.2],
    [-3.9, 3.2, -3.7, 1.0, 0.5],
    [-3.7, 1.0, -2.1, 0.25, 0.3],
    [-3.7, 1.0, -5.2, 0.25, 0.3],
    // 蠍尾：往後再高高往上捲，尾端鉤狀尖刺
    [-8.2, 7.6, -11.5, 9.0, 1.3],
    [-11.5, 9.0, -13.2, 11.8, 1.0],
    [-13.2, 11.8, -13.2, 14.8, 0.8],
    [-13.2, 14.8, -12.0, 16.6, 0.6],
    [-12.0, 16.6, -10.6, 16.6, 0.42],
    [-10.6, 16.6, -10.1, 15.7, 0.32],
  ];

  let d = Infinity;
  for (const s of segs) {
    d = Math.min(d, capsule(u, v, s[0], s[1], s[2], s[3], s[4]));
  }
  return d;
};

/** @type {(u: number, v: number) => number} 穆修胡修的眼睛（黑點，直徑 0.9） */
const beastEyeSd = (u, v) => Math.hypot(u - 10.6, v - 14.5) - 0.45;

/**
 * 穆修胡修鱗紋：軀幹上兩排交錯小弧（線寬 0.6）
 * @type {(u: number, v: number) => number}
 */
const beastScaleSd = (u, v) => {
  let d = Infinity;
  for (let row = 0; row < 2; row++) {
    const vc = 6.6 + row * 1.9;
    const shift = row * 1.4;
    for (let k = -2; k <= 1; k++) {
      const uc = k * 2.8 + shift;
      // 朝車尾開口的半圓弧（鱗片下緣）
      if (u > uc) {
        continue;
      }
      d = Math.min(d, Math.abs(Math.hypot(u - uc, v - vc) - 1.0) - 0.3);
    }
  }
  return d;
};

/**
 * 玫瑰花飾（M2：白瓣金心的圓瓣花，不做放射線）：中心圓 r 0.8、8 片圓瓣 r 0.72 繞半徑 1.62（直徑約 4.7）
 * @type {(u: number, v: number) => { petal: number, core: number }}
 */
const rosetteSd = (u, v) => {
  const core = Math.hypot(u, v) - 0.8;
  let petal = Infinity;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    petal = Math.min(petal, Math.hypot(u - 1.62 * Math.cos(a), v - 1.62 * Math.sin(a)) - 0.72);
  }
  return { petal: Math.max(petal, -core - 0.25), core };
};

/** @type {number} 玫瑰花飾帶高度（牆頂外緣往下） */
const FRIEZE_H = 5.6;
/** @type {number} 玫瑰花飾間距 */
const ROSETTE_PITCH = 7.4;

/**
 * 側牆上的位置分類：側牆（|z| 夠大、在牆頂外緣以下、不在轉角區）
 * @type {(x: number, y: number, z: number) => boolean}
 */
const onSideWall = (x, y, z) => {
  if (inCorner(x) || x > 59.6 || x < -58.3) {
    return false;
  }
  return Math.abs(z) > P.hw(x) - P.batter(x) - 0.4 && y < wallTop(x) + 0.05;
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

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 青金石藍釉磚（亮面釉：roughness ≤ 0.4）
  lapis: namedMaterial('paint-lapis-glaze', { color: 0x1f4e9c, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
  lapis2: namedMaterial('paint-lapis-glaze', { color: 0x1f4e9c, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.15, side: THREE.DoubleSide }),
  // 牆腳瀝青黑（霧面；新巴比倫以瀝青作砌磚灰漿，推估）
  bitumen: namedMaterial('paint-bitumen-black-matte', { color: 0x1a1a1a, roughness: 0.72, clearcoat: 0.05 }),
  // 黃釉（門拱框）
  yellow2: namedMaterial('paint-yellow-glaze', { color: 0xd9a441, roughness: 0.36, clearcoat: 0.6, side: THREE.DoubleSide }),
  // 未上釉的日曬泥磚（城垛，霧面）
  mud2: namedMaterial('paint-mud-brick-matte', { color: 0xa07f5b, roughness: 0.78, clearcoat: 0.0, side: THREE.DoubleSide }),
  // 金邊（真金屬：-brass 結尾）
  gold2: namedMaterial('trim-gold-brass', { color: 0xc8a24a, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 拱門內深藍（門道的陰影，霧面）
  navy2: namedMaterial('paint-gate-shadow-navy', { color: 0x0f2347, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x131a26, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x173b78, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x14284a, roughness: 0.75, side: THREE.DoubleSide }),
  dJoint: decalMaterial('decal-brick-joint-navy', { color: 0x12306a, roughness: 0.5 }),
  dYellow: decalMaterial('decal-yellow-glaze', { color: 0xd9a441, roughness: 0.36 }),
  dBlack: decalMaterial('decal-black-glaze', { color: 0x1a1a1a, roughness: 0.4 }),
  dWhite: decalMaterial('decal-white-glaze', { color: 0xf2efe6, roughness: 0.38 }),
  dGold: decalMaterial('decal-gold', { color: 0xc8a24a, roughness: 0.32, metalness: 0.7 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 在 (z, y) 平面畫的形狀沿 +x 擠出 depth（門樓正面的拱框、拱門板）；形狀左右對稱
 * @type {(outer: number[][], holes: number[][][], x0: number, depth: number) => THREE.BufferGeometry}
 */
const extrudeFront = (outer, holes, x0, depth) => {
  const shape = new THREE.Shape(outer.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  // 擠出方向（局部 z）轉成車頭方向 +x；局部 x → 世界 −z（形狀左右對稱，不影響）
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
};

/**
 * 半圓拱門的外形點列（(z, y)，由左下逆時針）：拱腳 yBase → 起拱線 ySpring → 半圓 → 右拱腳
 * @type {(hw: number, ySpring: number, yBase: number, n?: number) => number[][]}
 */
const archOutline = (hw, ySpring, yBase, n = 28) => {
  const pts = [[hw, yBase]];
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * i) / n;
    pts.push([hw * Math.cos(a), ySpring + hw * Math.sin(a)]);
  }
  pts.push([-hw, yBase]);
  return pts;
};

/**
 * 階梯形城垛（單一垛口）：(z, y) 三階，底寬 w、每階高 h、每階兩側各內收 (w − 2.2) / 4
 * @type {(zc: number, y0: number, w: number, h: number) => number[][]}
 */
const merlonOutline = (zc, y0, w, h) => {
  const s = (w - 2.2) / 4;
  const half = w / 2;
  return [
    [zc - half, y0],
    [zc + half, y0],
    [zc + half, y0 + h],
    [zc + half - s, y0 + h],
    [zc + half - s, y0 + 2 * h],
    [zc + half - 2 * s, y0 + 2 * h],
    [zc + half - 2 * s, y0 + 3 * h],
    [zc - half + 2 * s, y0 + 3 * h],
    [zc - half + 2 * s, y0 + 2 * h],
    [zc - half + s, y0 + 2 * h],
    [zc - half + s, y0 + h],
    [zc - half, y0 + h],
  ];
};

/**
 * 後輪尖拱內襯：沿尖拱曲線（兩段 R19.3 圓弧）掃出 z 從 zFrom 到 zTo 的拱頂面（開放面，標 shell）
 * @type {(zFrom: number, zTo: number) => THREE.BufferGeometry}
 */
const buildPointedLiner = (zFrom, zTo) => {
  const r = REAR_ARCH.r + 0.3;
  const d = REAR_ARCH_D;
  // 右半弧：圓心 (x − d)，從起拱線（角度 0）到拱頂
  const aTop = Math.acos(d / r);
  /** @type {number[][]} 側視曲線點（由車頭側拱腳 → 拱頂 → 車尾側拱腳） */
  const curve = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const a = lerp(0.08, aTop, i / n);
    curve.push([REAR_ARCH.x - d + r * Math.cos(a), REAR_ARCH.y + r * Math.sin(a)]);
  }
  for (let i = n; i >= 0; i--) {
    const a = lerp(0.08, aTop, i / n);
    curve.push([REAR_ARCH.x + d - r * Math.cos(a), REAR_ARCH.y + r * Math.sin(a)]);
  }
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < curve.length - 1; i++) {
      const A = [curve[i][0], curve[i][1], sg * zFrom];
      const B = [curve[i + 1][0], curve[i + 1][1], sg * zFrom];
      const C = [curve[i + 1][0], curve[i + 1][1], sg * zTo];
      const D = [curve[i][0], curve[i][1], sg * zTo];
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

/** @type {{ hw: number, ySpring: number, yBase: number, band: number }} 門樓正面拱門（半寬 9、起拱線 22、拱頂 31；黃釉拱框寬 2.2） */
const GATE = { hw: 7.5, ySpring: 18.5, yBase: 13, band: 2.0 };

export const mushussuGateBody = makePolyBody({
  id: 'body-mushussu-gate',
  name: '伊什塔爾城門的穆修胡修',
  style: 'myth',
  phase: 8,
  mythSeries: 'mesopotamian',
  mythTheme: 'mushussu',
  form: 'brick-gate',
  roof: 'closed',
  wing: 'crenel-tail',
  theme: '新巴比倫伊什塔爾城門：前後兩座寬厚塔樓夾一段城牆，青金石藍釉磚、白金玫瑰花飾帶、城牆上的黃釉穆修胡修，車頭半圓拱門、車尾階梯城垛',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  wheelArches: [FRONT_ARCH],
  openings: [
    { id: '後輪尖拱', shape: 'fn', sd: (x, y, z) => (Math.abs(z) < TOWER_Z ? 10 : pointedArchSd(x, y)) },
    // 塔樓內側立面與前塔樓正面的下半部開口（塔樓外凸段底下本來就是空的，像擋泥板的開口；減輕車殼質量）
    { id: '塔樓立面下緣', shape: 'fn', sd: towerSkirtSd },
  ],
  sideZMin: 30,
  zones: () => [
    // 牆腳一道瀝青黑（側牆最下 2.6 mm）
    { mat: 'bitumen', keep: (x, y, z) => (Math.abs(z) > P.hw(x) - P.batter(x) * 0.5 ? P.yLow(x) + 2.6 - y : -1) },
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'lapis2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（拱頂厚度感，擋住從塔樓外牆看進去的殼內空腔）：前半圓、後尖拱，各沿外牆往內 3.5 mm
    parts.push({
      geometry: mergeGeos([buildArchLiner(FRONT_ARCH, TOWER_HW - 4.7, TOWER_HW - 1.2, 0.12, Math.PI - 0.12), buildPointedLiner(TOWER_HW - 4.7, TOWER_HW - 1.2)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });

    /** @type {(x: number, y: number) => number} 到輪拱邊緣的距離（正值 = 拱外） */
    const archDist = (x, y) => (x > 0 ? roundArchSd(x, y) : pointedArchSd(x, y));
    // 輪拱拱框：黃釉寬帶＋外側黑細線（城門拱的釉磚邊框）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < TOWER_Z || inCorner(x)) {
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
        if (Math.abs(z) < TOWER_Z || inCorner(x)) {
          return -1;
        }
        const d = archDist(x, y);
        return Math.min(d - 1.5, 2.15 - d);
      }),
      mat: 'dBlack',
      name: 'decal-arch-line',
    });

    /** @type {(x: number, y: number, z: number) => boolean} 花飾帶範圍：只在塔樓外牆，牆頂外緣往下 FRIEZE_H */
    const inFrieze = (x, y, z) => Math.abs(z) > TOWER_Z && y > wallTop(x) - FRIEZE_H - 0.2;
    /** @type {(x: number, y: number, z: number) => boolean} 城牆（門道）側面的上緣飾邊範圍 */
    const inWallBorder = (x, y, z) => Math.abs(z) < TOWER_Z && y > wallTop(x) - 2.4;
    // 玫瑰花飾帶（塔樓外牆）：上下兩道黑邊線、白瓣金心的圓瓣花；城牆側面上緣只做黑白兩道飾邊
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const t = wallTop(x);
        if (Math.abs(z) < TOWER_Z) {
          return 0.35 - Math.abs(y - (t - 0.55));
        }
        return Math.max(0.35 - Math.abs(y - (t - 0.55)), 0.35 - Math.abs(y - (t - FRIEZE_H + 0.35)));
      }),
      mat: 'dBlack',
      name: 'decal-frieze-lines',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) && Math.abs(z) < TOWER_Z ? 0.4 - Math.abs(y - (wallTop(x) - 1.65)) : -1)),
      mat: 'dWhite',
      name: 'decal-wall-border',
    });
    /** @type {(x: number, y: number) => { petal: number, core: number }} 最近的一朵玫瑰花飾 */
    const nearestRosette = (x, y) => {
      const k = Math.round((x - 2) / ROSETTE_PITCH);
      return rosetteSd(x - 2 - k * ROSETTE_PITCH, y - (wallTop(x) - FRIEZE_H / 2));
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) && inFrieze(x, y, z) ? -nearestRosette(x, y).petal : -1)),
      mat: 'dWhite',
      name: 'decal-rosette-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) && inFrieze(x, y, z) ? -nearestRosette(x, y).core : -1)),
      mat: 'dGold',
      name: 'decal-rosette-cores',
    });

    /** @type {(x: number, y: number, z: number) => number} 穆修胡修局部距離（只在城牆側面） */
    const beastAt = (x, y, z) => (Math.abs(z) < 33 || Math.abs(x) > 17 ? 10 : beastSd(x - BEAST.x0, y - BEAST.y0));
    // 磚縫：塔樓外牆與城牆側面（避開花飾帶、拱框、穆修胡修、牆腳黑帶）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || inFrieze(x, y, z) || inWallBorder(x, y, z) || y < P.yLow(x) + 2.8) {
          return -1;
        }
        if (Math.abs(z) > TOWER_Z && archDist(x, y) < 2.6) {
          return -1;
        }
        if (beastAt(x, y, z) < 1.2) {
          return -1;
        }
        return brickJoint(x, y);
      }),
      mat: 'dJoint',
      name: 'decal-brick-joints',
    });
    // 塔樓頂面磚縫（沿 x 的長縫每 4 mm、橫縫每 8 mm 錯縫）：避開遊行大道與牆頂倒角
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (y < P.yTop(x) - 0.05 || az < 7.6 || az > P.hw(x) - P.batter(x) - CH - 0.8 || inCorner(x) || Math.abs(x) < 20.5 || x > 59 || x < X_REAR + 3.5) {
          return -1;
        }
        return brickJoint(x, az + 1);
      }),
      mat: 'dJoint',
      name: 'decal-roof-joints',
    });
    // 穆修胡修：黑色描邊（外擴 0.6）→ 黃釉身 → 黑鱗紋與眼睛（車兩側都朝車頭）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = beastAt(x, y, z);
        return Math.min(0.6 - d, d);
      }),
      mat: 'dBlack',
      name: 'decal-mushussu-outline',
    });
    parts.push({ geometry: kit.decal((x, y, z) => -beastAt(x, y, z)), mat: 'dYellow', name: 'decal-mushussu' });
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          if (Math.abs(z) < 33 || Math.abs(x) > 17) {
            return -1;
          }
          const u = x - BEAST.x0;
          const v = y - BEAST.y0;
          return Math.max(-beastScaleSd(u, v), -beastEyeSd(u, v));
        },
        { offset: 0.12 },
      ),
      mat: 'dBlack',
      name: 'decal-mushussu-scales',
    });

    // 車頂中線：遊行大道（M2：黃黑釉磚）——黃釉磚帶＋黑色磚縫與黑邊
    /** @type {(x: number, y: number, z: number) => boolean} 車頂平面（牆頂倒角以內） */
    const onRoof = (x, y, z) => y > P.yTop(x) - 0.05 && !inCorner(x) && x > X_REAR + 3 && x < 59;
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) ? 5.4 - Math.abs(z) : -1)),
      mat: 'dYellow',
      name: 'decal-procession-way',
    });
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          if (!onRoof(x, y, z)) {
            return -1;
          }
          const az = Math.abs(z);
          const edge = Math.min(az - 5.4, 6.4 - az);
          if (az > 5.4) {
            return edge;
          }
          // 磚縫：沿 x 每 5 mm 一道、中線一道（兩列錯縫）
          const row = z > 0 ? 1 : 0;
          const ph = ((((x + row * 2.5) % 5) + 5) % 5);
          return Math.max(0.3 - Math.min(ph, 5 - ph), 0.3 - az);
        },
        { offset: 0.12 },
      ),
      mat: 'dBlack',
      name: 'decal-procession-joints',
    });

    // 門樓正面：黃釉拱框（凸出 0.8）＋金邊細框＋拱門內深藍門板＋拱頂一朵玫瑰花飾
    const outerArch = archOutline(GATE.hw + GATE.band, GATE.ySpring, GATE.yBase);
    const innerArch = archOutline(GATE.hw, GATE.ySpring, GATE.yBase);
    parts.push({ geometry: extrudeFront(outerArch, [innerArch.slice().reverse()], X_FRONT - 0.2, 1.0), mat: 'yellow2', solid: true, outline: true, name: 'gate-arch-frame' });
    const goldOuter = archOutline(GATE.hw + GATE.band + 0.7, GATE.ySpring, GATE.yBase);
    parts.push({ geometry: extrudeFront(goldOuter, [outerArch.slice().reverse()], X_FRONT - 0.2, 0.7), mat: 'gold2', solid: true, outline: true, name: 'gate-arch-gilt' });
    parts.push({ geometry: extrudeFront(innerArch, [], X_FRONT - 0.2, 0.35), mat: 'navy2', solid: true, outline: true, name: 'gate-door' });
    // 拱頂玫瑰花飾（白瓣、金心，凸出門樓正面）
    const petals = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const c = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16);
      c.rotateZ(Math.PI / 2);
      c.translate(X_FRONT + 0.05, GATE.ySpring + GATE.hw + GATE.band + 0.7 + 2.3 + 1.7 * Math.sin(a), 1.7 * Math.cos(a));
      petals.push(c);
    }
    const yRos = GATE.ySpring + GATE.hw + GATE.band + 0.7 + 2.3;
    if (yRos + 2.6 < P.yTop(X_FRONT)) {
      parts.push({ geometry: mergeGeos(petals), mat: 'gold2', solid: true, name: 'gate-rosette-petals' });
    }

    // 車尾城垛（crenel-tail）：後塔樓頂後緣一道矮胸牆，上面一排 9 個三階階梯形垛口（日曬泥磚色，霧面）；左右各收在牆頂倒角以內
    const yRoof = P.yTop(X_REAR + 1);
    const parapet = extrudeFront(
      [
        [-48.5, yRoof - 0.3],
        [48.5, yRoof - 0.3],
        [48.5, yRoof + 1.4],
        [-48.5, yRoof + 1.4],
      ],
      [],
      X_REAR,
      1.5,
    );
    const merlons = [];
    const nM = 7;
    for (let i = 0; i < nM; i++) {
      const zc = lerp(-44.2, 44.2, i / (nM - 1));
      merlons.push(extrudeFront(merlonOutline(zc, yRoof + 1.4, 7.4, 2.1), [], X_REAR, 1.5));
    }
    parts.push({ geometry: mergeGeos([parapet, ...merlons]), mat: 'mud2', solid: true, outline: true, name: 'crenel-tail' });
    // 胸牆前緣一道金邊細條（城垛和釉磚牆之間的金線）
    const gilt = extrudeFront(
      [
        [-48.5, yRoof - 0.3],
        [48.5, yRoof - 0.3],
        [48.5, yRoof + 0.5],
        [-48.5, yRoof + 0.5],
      ],
      [],
      X_REAR + 1.5,
      0.6,
    );
    parts.push({ geometry: gilt, mat: 'gold2', solid: true, outline: true, name: 'crenel-gilt' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry:
      '本檔站位產生器 P（推估）：殼長約 130（後塔樓 x −60 → 門樓正面 68.5，含拱框與城垛 −60.7 → 69.3；≤ 153 不刮立體橋）、塔樓牆頂 38.5、城牆 34、門樓 30.5；塔樓牆腳半寬 50.5（車寬 101 < 105，俯視和既有方形平面車殼拉開 IoU）、城牆 33.5（在底盤側框 z 35 內側上方，側裙下緣 y 11）、門樓 19；塔樓橫向立面 y 24 以下開口（減輕質量）',
    wheelArches: '前輪半圓拱 R17.5、後輪尖拱（兩段 R19 圓弧、半跨 17.5、拱頂約 y 31.9）：31 mm 輪胎半徑 15.5 + 2 mm，不切輪拱可裝；拱只切塔樓外牆（|z| ≥ 44），拱內 3.5 mm 深內襯',
    crenels: '城垛胸牆 97 × 1.7 × 1.5 mm＋7 個三階垛口（底寬 7.4、每階 2.1、厚 1.5），ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    myth: '穆修胡修的鱗身、長頸、蛇信、頭角與頭冠、前獅足後鷹爪（MYTH_RESEARCH M1）；伊什塔爾城門青金石藍釉磚、黑白金邊框與玫瑰花飾、遊行大道黃黑磚（M2、M3）；前半圓拱 / 後尖拱 = 獅掌 / 鷹爪的對應（MYTH_RESEARCH 4-1 M-a 的建議）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
