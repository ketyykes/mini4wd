// 伊什塔爾城門的穆修胡修（body-mushussu-gate，第八階段神話組・美索不達米亞）：iter-114 改成全罩車殼的城門——
// 前後輪上方各一個塔樓式翼子板包（前輪半圓拱、後輪尖拱：M1 前足獅掌、後足鷹爪），中間夾著四邊城垛的門樓座艙，
// 俯視兩翼子板之間是深凹的門道，牆上一隻黃釉穆修胡修浮雕（實體件，凸出 0.9 mm）；鼻端、尾甲板往下斜，車尾封口封住後齒輪箱；
// 全車青金石藍釉磚（橫向錯縫磚縫）、翼子板頂一列白瓣金心玫瑰花飾、座艙前斜面黃釉拱門、車頂中線黃黑磚遊行大道、尾甲板階梯城垛尾翼（crenel-tail）。
// 設計：shared/design/body-mushussu-gate/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 4 節 M1–M5；黑名單 4-3、第 9 節 Dragon Jr. / Beat-Magnum）。剖面為本檔站位產生器（推估）。
// 配色取自 M2 / 4-2（青金石釉藍、黃釉、黑白金邊框與玫瑰花飾）；圖形全部自繪；不做龍頭車身、不放龍形駕駛、不做紅龍徽章、玫瑰花飾只用圓瓣（不做放射閃電）；不含任何文字。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾（尾端斜面下緣的封口）x */
const X_REAR = -61.5;
/** @type {number} 車頭（鼻端封口）x */
const X_FRONT = 66.5;
/** @type {number} 翼子板包（原塔樓）牆腳半寬：iter-113 收到 47.8，iter-114 再收到 47.4（含浮雕、拱框，外框半寬 ≤ 48.0） */
const POD_HW = 47.4;
/** @type {number} 牆頂倒角 */
const CH = 1.5;

/**
 * iter-114：「兩塊方磚＋中間低槽」改成有車頭、車尾的全罩車殼——
 * 前後輪上方是兩個翼子板包（城門的兩座塔樓），中間是門樓座艙（車頂四邊城垛、正面黃釉拱門），
 * 前段是夾在兩個翼子板包之間的低引擎蓋＋往下斜的鼻端，後段是往下斜的尾甲板＋收窄的車尾封口（封住後齒輪箱）。
 * 半剖面 6 點：中線 → 中央平台外緣（cw）→ 翼子板 / 肩線內緣（zf）→ 牆頂倒角起點 → 牆頂外緣 → 牆腳（收分）
 * @type {Record<string, (x: number) => number>}
 */
const P = {
  // 牆腳半寬：車尾 30（< 後導輪內緣 |z| 35.5）→ 後翼子板 47.4 → 腰（門道側牆）40.5 → 前翼子板 47.4 → 鼻端 22（< 前導輪內緣）
  hw: monoCurve([-61.5, -61, -60.2, -58, -22, -16, 16, 22, 60, 62.8, 63.6, 64.2, 66.5], [36, 44, 46.8, POD_HW, POD_HW, 24.5, 24.5, POD_HW, POD_HW, 46.8, 40, 29, 25]),
  // 牆面收分（牆頂比牆腳內收）
  batter: monoCurve([-61.5, -58, -22, -16, 16, 22, 60, 66.5], [0.8, 1.2, 1.2, 0.4, 0.4, 1.2, 1.2, 0.8]),
  // 中線高度：車尾 25.5 → 尾甲板 29.5 → 門樓座艙頂 39（後面斜上、前面是陡的拱門面）→ 引擎蓋 30 → 鼻端 21
  yC: monoCurve([-61.5, -58, -46, -30, -17, 20, 22, 27, 36, 48, 58, 62, 66.5], [26, 27, 28.5, 29.6, 39.5, 39.5, 39.1, 30.4, 30, 29, 26.5, 24.5, 21.5]),
  // 翼子板頂 / 腰線肩高：後翼子板 36、腰 30、前翼子板 35.5；前後往鼻端 / 車尾斜下
  yF: monoCurve([-61.5, -59, -55, -22, -16, 16, 22, 52, 59, 63, 66.5], [28, 31.5, 36, 36, 36.5, 36.5, 36, 35.5, 31, 25, 22]),
  // 中央平台半寬：座艙 21、引擎蓋 / 尾甲板 18、鼻端 9
  cw: monoCurve([-61.5, -58, -24, -17, 20, 26, 58, 62, 66.5], [15, 17, 17, 13.5, 13.5, 17, 16, 13, 12]),
  // 翼子板頂內緣（腰段是座艙側面斜下來的肩線）
  zf: monoCurve([-61.5, -60, -58, -22, -16, 16, 22, 58, 61, 63.5, 66.5], [24, 30, 33, 33, 21.2, 21.2, 33, 33, 30, 22, 18]),
  // 牆腳：翼子板 13.5（輪拱切開）、腰 11（底盤側框段由 loft.js 自動讓到 9.9）、鼻端 / 車尾 15.5（封住齒輪箱、離開導輪）
  yLow: monoCurve([-61.5, -60, -55, -20.5, -19, 19, 20.5, 55, 60, 63, 66.5], [15.5, 14.5, 13.5, 13.5, 17.5, 17.5, 13.5, 13.5, 14, 15, 15.5]),
};

/** @type {(x: number) => number} 牆頂外緣（倒角下緣）的 z */
const hwTopAt = (x) => P.hw(x) - P.batter(x);

/** @type {(x: number) => number[][]} 半剖面 */
const profile = (x) => {
  const hwTop = hwTopAt(x);
  const yF = P.yF(x);
  return [
    [0, P.yC(x)],
    [P.cw(x), P.yC(x)],
    [P.zf(x), yF],
    [hwTop - CH, yF],
    [hwTop, yF - CH],
    [P.hw(x), P.yLow(x)],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 站位表（每 0.5 mm 一站） */
const STATIONS = buildStations(X_REAR, X_FRONT, 0.5, profile);

/** @type {(x: number) => number} 牆頂外緣高度（倒角下緣） */
const wallTop = (x) => P.yF(x) - CH;

/**
 * 側牆外表面在 (x, y) 的 |z|（牆腳 → 牆頂外緣線性收分）
 * @type {(x: number, y: number) => number}
 */
const wallZ = (x, y) => {
  const t = Math.min(1, Math.max(0, (y - P.yLow(x)) / (wallTop(x) - P.yLow(x))));
  return lerp(P.hw(x), hwTopAt(x), t);
};

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }} 前輪半圓拱（獅掌，R17.5 = 31 mm 輪半徑 15.5 + 2） */
const FRONT_ARCH = { x: 40, y: 13, radius: 17.5, cutZFrom: 42 };

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

/** @type {number} 翼子板外牆判定：|z| 大於此值才是翼子板（塔樓）外牆（腰段側牆 ≤ 40.5） */
const POD_Z = 42.5;

/** @type {(x: number, y: number) => number} 到輪拱邊緣的距離（正值 = 拱外） */
const archDist = (x, y) => (x > 0 ? roundArchSd(x, y) : pointedArchSd(x, y));

/** @type {{ x0: number, y0: number, s: number }} 穆修胡修浮雕的位置與縮放（腰段側牆中段，側視；腳底 y0） */
const BEAST = { x0: 0.3, y0: 19.2, s: 0.88 };

/** @type {(u: number, v: number, ax: number, ay: number, bx: number, by: number, r: number) => number} 圓頭線段（膠囊）距離 */
const capsule = (u, v, ax, ay, bx, by, r) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - ax - t * dx, v - ay - t * dy) - r;
};

/**
 * 穆修胡修側身（iter-114 照伊什塔爾城門釉磚浮雕重畫，M1 / M2）：水平細長鱗身、往前上斜的 S 形長頸、
 * 水平蛇頭＋往後的直角＋頭後捲起的冠、分岔蛇信；前足獅腿（一前一後的步態、圓掌）、後足鷹腿（粗腿、細脛、三爪）；
 * 長尾先水平往後、尾端才往上捲成蝎尾鉤刺。u 往車頭、v 往上，腳底 v = 0；未縮放時長約 34、高約 17 mm
 * @type {number[][]} [ax, ay, bx, by, r]
 */
const BEAST_SEGS = [
  // 軀幹（細長、後粗前細）
  [-8.4, 8.6, -1.0, 8.8, 2.0],
  [-1.0, 8.8, 4.6, 9.4, 1.8],
  // 長頸（往前上斜的 S 形）
  [4.6, 9.8, 7.4, 12.0, 1.45],
  [7.4, 12.0, 8.8, 13.8, 1.25],
  // 蛇頭（水平、比頸粗）＋吻
  [8.6, 14.2, 12.6, 14.0, 1.3],
  [12.6, 14.0, 14.6, 13.5, 0.8],
  // 頭上往後的直角、頭後捲起的冠
  [10.0, 15.3, 6.6, 16.6, 0.5],
  [9.0, 15.0, 7.9, 16.0, 0.42],
  [7.9, 16.0, 7.3, 15.3, 0.34],
  // 分岔蛇信
  [14.6, 13.5, 16.2, 14.0, 0.3],
  [14.6, 13.5, 16.1, 12.8, 0.3],
  // 前足（獅）：前腳往前邁、後腳垂直；圓掌
  [3.8, 8.0, 5.6, 3.6, 1.15],
  [5.6, 3.6, 6.0, 1.0, 0.75],
  [5.2, 0.75, 7.6, 0.75, 0.75],
  [2.0, 8.0, 1.4, 3.6, 1.05],
  [1.4, 3.6, 1.6, 1.0, 0.7],
  [0.8, 0.7, 3.0, 0.7, 0.7],
  // 後足（鷹）：粗腿、細脛、三爪（兩前一後）
  [-6.0, 8.2, -4.9, 4.0, 1.35],
  [-4.9, 4.0, -5.6, 1.4, 0.55],
  [-5.6, 1.2, -3.2, 0.35, 0.45],
  [-5.6, 1.2, -4.7, 0.1, 0.45],
  [-5.6, 1.2, -7.6, 0.45, 0.45],
  [-8.4, 8.0, -9.0, 4.0, 1.3],
  [-9.0, 4.0, -9.6, 1.4, 0.5],
  [-9.6, 1.2, -7.4, 0.35, 0.42],
  [-9.6, 1.2, -8.8, 0.1, 0.42],
  [-9.6, 1.2, -11.5, 0.45, 0.42],
  // 長尾：水平往後 → 尾端往上捲 → 鉤狀蝎刺
  [-10.2, 8.6, -14.0, 9.0, 1.15],
  [-14.0, 9.0, -16.6, 10.6, 0.9],
  [-16.6, 10.6, -17.4, 13.0, 0.68],
  [-17.4, 13.0, -16.6, 14.6, 0.48],
  [-16.6, 14.6, -15.4, 14.6, 0.34],
];

/** @type {(u: number, v: number) => number} 穆修胡修輪廓距離（未縮放座標） */
const beastSdRaw = (u, v) => {
  let d = Infinity;
  for (const s of BEAST_SEGS) {
    d = Math.min(d, capsule(u, v, s[0], s[1], s[2], s[3], s[4]));
  }
  return d;
};

/** @type {(x: number, y: number, z: number) => number} 穆修胡修在車殼側牆上的距離（只在腰段側牆） */
const beastAt = (x, y, z) => {
  if (Math.abs(z) < 21 || Math.abs(x) > 20) {
    return 10;
  }
  return beastSdRaw((x - BEAST.x0) / BEAST.s, (y - BEAST.y0) / BEAST.s) * BEAST.s;
};

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

/** @type {number} 翼子板頂面玫瑰花飾帶的中線 |z| */
const ROS_Z = 38.9;

/**
 * 側牆（牆頂外緣以下的直立牆面）
 * @type {(x: number, y: number, z: number) => boolean}
 */
const onSideWall = (x, y, z) => y < wallTop(x) + 0.05 && Math.abs(z) > wallZ(x, y) - 0.35 && x > X_REAR + 2 && x < X_FRONT - 2;

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

/**
 * 半圓拱門的 2D 距離（(z, y)，負值 = 門內）：起拱線以下是直立門框
 * @type {(z: number, y: number, hw: number, ySpring: number) => number}
 */
const roundDoorSd = (z, y, hw, ySpring) => (y < ySpring ? Math.abs(z) - hw : Math.hypot(z, y - ySpring) - hw);

/** @type {{ hw: number, ySpring: number, x0: number, x1: number, band: number }} 門樓正面（座艙前斜面）的拱門：半寬 4.6、起拱線 32.2、黃釉拱框 1.6、金邊 0.6 */
const GATE = { hw: 4.6, ySpring: 32.2, x0: 20.6, x1: 28.5, band: 1.6 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 青金石藍釉磚（亮面釉：roughness ≤ 0.4）
  lapis: namedMaterial('paint-lapis-glaze', { color: 0x1f4e9c, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
  lapis2: namedMaterial('paint-lapis-glaze', { color: 0x1f4e9c, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.15, side: THREE.DoubleSide }),
  // 牆腳瀝青黑（霧面；新巴比倫以瀝青作砌磚灰漿，推估）
  bitumen: namedMaterial('paint-bitumen-black-matte', { color: 0x1a1a1a, roughness: 0.72, clearcoat: 0.05 }),
  // 黃釉（穆修胡修浮雕）
  yellow: namedMaterial('paint-yellow-glaze', { color: 0xd9a441, roughness: 0.36, clearcoat: 0.6 }),
  // 未上釉的日曬泥磚（城垛，霧面）
  mud2: namedMaterial('paint-mud-brick-matte', { color: 0xa07f5b, roughness: 0.78, clearcoat: 0.0, side: THREE.DoubleSide }),
  // 金邊（真金屬：-brass 結尾）
  gold2: namedMaterial('trim-gold-brass', { color: 0xc8a24a, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 浮雕眼睛（黑釉）
  eye: namedMaterial('paint-black-glaze', { color: 0x161616, roughness: 0.3, clearcoat: 0.6 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x131a26, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x173b78, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x14284a, roughness: 0.75, side: THREE.DoubleSide }),
  dJoint: decalMaterial('decal-brick-joint-navy', { color: 0x12306a, roughness: 0.5 }),
  dYellow: decalMaterial('decal-yellow-glaze', { color: 0xd9a441, roughness: 0.36 }),
  dBlack: decalMaterial('decal-black-glaze', { color: 0x1a1a1a, roughness: 0.4 }),
  dWhite: decalMaterial('decal-white-glaze', { color: 0xf2efe6, roughness: 0.38 }),
  dGold: decalMaterial('decal-gold', { color: 0xc8a24a, roughness: 0.32, metalness: 0.7 }),
  dNavy: decalMaterial('decal-gate-shadow-navy', { color: 0x0f2347, roughness: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 在 (z, y) 平面畫的形狀沿 +x 擠出 depth（城垛等直立板，邊緣 0.2 mm 倒角）
 * @type {(outer: number[][], x0: number, depth: number) => THREE.BufferGeometry}
 */
const extrudeFront = (outer, x0, depth) => {
  const bev = 0.2;
  const shape = new THREE.Shape(outer.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 12 });
  g.translate(0, 0, bev);
  // 擠出方向（局部 z）轉成車頭方向 +x；局部 x → 世界 −z（形狀左右對稱，不影響）
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
};

/**
 * 在 (x, y) 平面畫的形狀沿 z 擠出（座艙兩側的城垛），中心在 zc
 * @type {(outer: number[][], zc: number, depth: number) => THREE.BufferGeometry}
 */
const extrudeSide = (outer, zc, depth) => {
  const bev = 0.2;
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 });
  g.translate(0, 0, zc - depth / 2 + bev);
  return g;
};

/**
 * 階梯形城垛（單一垛口）：(a, y) 兩階或三階，底寬 w、每階高 h、每階兩側各內收 s
 * @type {(ac: number, y0: number, w: number, h: number, steps: number, s: number) => number[][]}
 */
const merlonOutline = (ac, y0, w, h, steps, s) => {
  const half = w / 2;
  /** @type {number[][]} */
  const right = [];
  for (let i = 0; i < steps; i++) {
    right.push([ac + half - i * s, y0 + i * h], [ac + half - i * s, y0 + (i + 1) * h]);
  }
  const left = right.map(([a, y]) => [2 * ac - a, y]).reverse();
  return [[ac - half, y0], ...right.slice(0, 1).map(([a]) => [a, y0]), ...right, ...left].filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);
};

/**
 * 輪拱內襯：沿側視輪拱曲線（半徑 + 0.3）掃出拱頂面；每點的外側界限 = 該處側牆外表面往內 0.9 mm，往內深 depth
 * @type {(curve: number[][], depth: number) => THREE.BufferGeometry}
 */
const buildLinerAlong = (curve, depth) => {
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < curve.length - 1; i++) {
      const [x0, y0] = curve[i];
      const [x1, y1] = curve[i + 1];
      const o0 = wallZ(x0, y0) - 0.9;
      const o1 = wallZ(x1, y1) - 0.9;
      const A = [x0, y0, sg * (o0 - depth)];
      const B = [x1, y1, sg * (o1 - depth)];
      const C = [x1, y1, sg * o1];
      const D = [x0, y0, sg * o0];
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

/** @type {() => number[][]} 前輪半圓拱內襯曲線（由車頭側拱腳 → 拱頂 → 車尾側拱腳） */
const frontLinerCurve = () => {
  const r = FRONT_ARCH.radius + 0.3;
  /** @type {number[][]} */
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = lerp(0.1, Math.PI - 0.1, i / 40);
    pts.push([FRONT_ARCH.x + r * Math.cos(a), FRONT_ARCH.y + r * Math.sin(a)]);
  }
  return pts;
};

/** @type {() => number[][]} 後輪尖拱內襯曲線（兩段 R19.3 圓弧） */
const rearLinerCurve = () => {
  const r = REAR_ARCH.r + 0.3;
  const d = REAR_ARCH_D;
  const aTop = Math.acos(d / r);
  /** @type {number[][]} */
  const pts = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = lerp(0.08, aTop, i / n);
    pts.push([REAR_ARCH.x - d + r * Math.cos(a), REAR_ARCH.y + r * Math.sin(a)]);
  }
  for (let i = n; i >= 0; i--) {
    const a = lerp(0.08, aTop, i / n);
    pts.push([REAR_ARCH.x + d - r * Math.cos(a), REAR_ARCH.y + r * Math.sin(a)]);
  }
  return pts;
};

/**
 * 穆修胡修浮雕（實體件）：每段膠囊沿 z 壓扁成凸起 RELIEF_H 的半膠囊，中心貼在側牆外表面（內半埋進殼裡）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildBeastRelief = (sg) => {
  /** @type {number} 浮雕凸起高度（評審建議 0.6–1 mm） */
  const RELIEF_H = 0.9;
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const [ax, ay, bx, by, r0] of BEAST_SEGS) {
    const r = r0 * BEAST.s;
    const x0 = BEAST.x0 + ax * BEAST.s;
    const y0 = BEAST.y0 + ay * BEAST.s;
    const x1 = BEAST.x0 + bx * BEAST.s;
    const y1 = BEAST.y0 + by * BEAST.s;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const g = new THREE.CapsuleGeometry(r, len, 4, 14);
    // 膠囊預設沿 y 軸 → 轉到線段方向
    g.rotateZ(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2);
    g.scale(1, 1, Math.min(1, RELIEF_H / r));
    const xm = (x0 + x1) / 2;
    const ym = (y0 + y1) / 2;
    g.translate(xm, ym, sg * (wallZ(xm, ym) - 0.05));
    geos.push(g);
  }
  return mergeGeos(geos);
};

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
  theme: '新巴比倫伊什塔爾城門：前後輪上方兩個塔樓式翼子板包夾著四邊城垛的門樓座艙（正面黃釉拱門），青金石藍釉磚、白金玫瑰花飾帶、腰牆上的黃釉穆修胡修浮雕，斜鼻端、斜尾甲板與階梯城垛尾翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  wheelArches: [FRONT_ARCH],
  openings: [{ id: '後輪尖拱', shape: 'fn', sd: (x, y, z) => (Math.abs(z) < 42 ? 10 : pointedArchSd(x, y)) }],
  sideZMin: 30,
  zones: () => [
    // 牆腳一道瀝青黑（側牆最下 2.4 mm）
    { mat: 'bitumen', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.3 ? P.yLow(x) + (Math.abs(z) > POD_Z ? 2.4 : 1.6) - y : -1) },
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'lapis2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（擋住從翼子板外牆看進去的殼內空腔）：前半圓、後尖拱，各沿外牆往內 4 mm
    parts.push({ geometry: mergeGeos([buildLinerAlong(frontLinerCurve(), 4), buildLinerAlong(rearLinerCurve(), 4)]), mat: 'liner', shell: true, name: 'arch-liners' });

    // 輪拱拱框：黃釉寬帶＋外側黑細線（城門拱的釉磚邊框）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || Math.abs(z) < 41) {
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
        if (!onSideWall(x, y, z) || Math.abs(z) < 41) {
          return -1;
        }
        const d = archDist(x, y);
        return Math.min(d - 1.5, 2.15 - d);
      }),
      mat: 'dBlack',
      name: 'decal-arch-line',
    });

    // 牆頂外緣下一道黑邊線（翼子板與腰牆）
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) && archDist(x, y) > 2.4 ? 0.35 - Math.abs(y - (wallTop(x) - 0.55)) : -1)),
      mat: 'dBlack',
      name: 'decal-frieze-lines',
    });

    // 翼子板頂面的玫瑰花飾帶（M2：黑邊框裡一列白瓣金心圓瓣花）：每個翼子板頂 4 朵，沿 x 排列
    /** @type {(x: number, y: number, z: number) => boolean} 翼子板頂面（平台） */
    const onCrest = (x, y, z) => y > P.yF(x) - 0.05 && Math.abs(z) > P.zf(x) + 0.3 && Math.abs(z) < hwTopAt(x) - CH - 0.2 && P.yF(x) > 34.6;
    /** @type {number[]} 花飾中心 x（前、後翼子板各 4 朵） */
    const ROS_X = [29.6, 36, 42.4, 48.8, -31.6, -38, -44.4, -50.8];
    /** @type {(x: number, z: number) => { petal: number, core: number }} 最近的一朵玫瑰花飾 */
    const nearestRosette = (x, z) => {
      let xc = ROS_X[0];
      for (const c of ROS_X) {
        if (Math.abs(x - c) < Math.abs(x - xc)) {
          xc = c;
        }
      }
      return rosetteSd(x - xc, Math.abs(z) - ROS_Z);
    };
    /** @type {(x: number) => boolean} 在花飾帶的 x 範圍內 */
    const inBandX = (x) => (x > 25.8 && x < 52.6) || (x < -27.8 && x > -54.6);
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onCrest(x, y, z) || !inBandX(x)) {
          return -1;
        }
        const dz = Math.abs(Math.abs(z) - ROS_Z);
        const ends = Math.min(Math.abs(x - 26.2), Math.abs(x - 52.2), Math.abs(x + 28.2), Math.abs(x + 54.2));
        return Math.max(0.35 - Math.abs(dz - 2.75), dz < 3.1 ? 0.35 - ends : -1);
      }),
      mat: 'dBlack',
      name: 'decal-rosette-band-lines',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onCrest(x, y, z) && inBandX(x) ? -nearestRosette(x, z).petal : -1)),
      mat: 'dWhite',
      name: 'decal-rosette-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onCrest(x, y, z) && inBandX(x) ? -nearestRosette(x, z).core : -1)),
      mat: 'dGold',
      name: 'decal-rosette-cores',
    });

    // 磚縫：側牆（避開牆頂飾邊、拱框、穆修胡修、牆腳黑帶）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || y < P.yLow(x) + (Math.abs(z) > POD_Z ? 2.6 : 1.8)) {
          return -1;
        }
        if (y > wallTop(x) - 1.2) {
          return -1;
        }
        if (archDist(x, y) < 2.6 || beastAt(x, y, z) < 1.2) {
          return -1;
        }
        return brickJoint(x, y);
      }),
      mat: 'dJoint',
      name: 'decal-brick-joints',
    });
    // 翼子板頂面磚縫（花飾帶以外；沿 x 的長縫每 4 mm、橫縫每 8 mm 錯縫）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onCrest(x, y, z) || (inBandX(x) && Math.abs(Math.abs(z) - ROS_Z) < 3.4)) {
          return -1;
        }
        return brickJoint(x, Math.abs(z) + 1);
      }),
      mat: 'dJoint',
      name: 'decal-roof-joints',
    });
    // 穆修胡修：牆上黑色描邊（浮雕外擴 0.55）＋黃釉浮雕實體件＋黑眼
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = beastAt(x, y, z);
        return Math.min(0.55 - d, d + 0.1);
      }),
      mat: 'dBlack',
      name: 'decal-mushussu-outline',
    });
    parts.push({ geometry: mergeGeos([buildBeastRelief(1), buildBeastRelief(-1)]), mat: 'yellow', solid: true, outline: true, name: 'mushussu-relief' });
    {
      const ex = BEAST.x0 + 11.4 * BEAST.s;
      const ey = BEAST.y0 + 14.5 * BEAST.s;
      /** @type {THREE.BufferGeometry[]} */
      const eyes = [];
      for (const sg of [-1, 1]) {
        const e = new THREE.SphereGeometry(0.42, 12, 8);
        e.scale(1, 1, 0.8);
        e.translate(ex, ey, sg * (wallZ(ex, ey) + 0.85));
        eyes.push(e);
      }
      parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, name: 'mushussu-eyes' });
    }

    // 車頂中線：遊行大道（M2：黃黑釉磚）——引擎蓋、門樓頂、尾甲板；避開門樓正面的拱門
    /** @type {(x: number, y: number, z: number) => boolean} 中央平台 */
    const onRoof = (x, y, z) => y > P.yC(x) - 0.05 && Math.abs(z) < P.cw(x) - 0.3 && x > X_REAR + 2 && x < X_FRONT - 4 && (x < GATE.x0 - 1.5 || x > GATE.x1 + 0.5);
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) ? 4.6 - Math.abs(z) : -1)),
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
          if (az > 4.6) {
            return Math.min(az - 4.6, 5.5 - az);
          }
          // 磚縫：沿 x 每 5 mm 一道、中線一道（兩列錯縫）
          const row = z > 0 ? 1 : 0;
          const ph = (((x + row * 2.5) % 5) + 5) % 5;
          return Math.max(0.3 - Math.min(ph, 5 - ph), 0.3 - az);
        },
        { offset: 0.12 },
      ),
      mat: 'dBlack',
      name: 'decal-procession-joints',
    });

    // 門樓正面（座艙前斜面）：深藍拱門＋黃釉拱框＋金邊（M2 城門拱）
    /** @type {(x: number, y: number, z: number) => number} 拱門距離（只在座艙前斜面） */
    const gateAt = (x, y, z) => (x < GATE.x0 || x > GATE.x1 || Math.abs(z) > P.cw(x) + 2 ? 10 : roundDoorSd(z, y, GATE.hw, GATE.ySpring));
    parts.push({ geometry: kit.decal((x, y, z) => -gateAt(x, y, z)), mat: 'dNavy', name: 'decal-gate-door' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = gateAt(x, y, z);
        return Math.min(d, GATE.band - d);
      }),
      mat: 'dYellow',
      name: 'decal-gate-band',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = gateAt(x, y, z);
        return Math.min(d - GATE.band, GATE.band + 0.6 - d);
      }),
      mat: 'dGold',
      name: 'decal-gate-gilt',
    });

    // 門樓頂四邊城垛（M2 crenelated buttresses）：沿座艙頂四邊一圈矮胸牆（高 0.9、厚 1.3），上面兩階階梯形垛口——前後各 5 個、左右各 4 個
    {
      const yRoof = P.yC(0) - 0.3;
      const xF = 18.4;
      const xR = -15.4;
      const zS = P.cw(0) - 1.6;
      const yP = yRoof + 1.2;
      /** @type {THREE.BufferGeometry[]} */
      const crown = [
        extrudeFront([[-zS - 0.65, yRoof], [zS + 0.65, yRoof], [zS + 0.65, yP], [-zS - 0.65, yP]], xF, 1.3),
        extrudeFront([[-zS - 0.65, yRoof], [zS + 0.65, yRoof], [zS + 0.65, yP], [-zS - 0.65, yP]], xR, 1.3),
      ];
      for (let i = 0; i < 5; i++) {
        const zc = lerp(-zS + 1.6, zS - 1.6, i / 4);
        crown.push(extrudeFront(merlonOutline(zc, yP - 0.1, 3.6, 1.0, 2, 0.8), xF, 1.3));
        crown.push(extrudeFront(merlonOutline(zc, yP - 0.1, 3.6, 1.0, 2, 0.8), xR, 1.3));
      }
      for (const sg of [-1, 1]) {
        crown.push(extrudeSide([[xR + 1.2, yRoof], [xF, yRoof], [xF, yP], [xR + 1.2, yP]], sg * zS, 1.3));
        for (let i = 0; i < 4; i++) {
          const xc = lerp(xR + 6.2, xF - 5, i / 3);
          crown.push(extrudeSide(merlonOutline(xc, yP - 0.1, 3.6, 1.0, 2, 0.8), sg * zS, 1.3));
        }
      }
      parts.push({ geometry: mergeGeos(crown), mat: 'mud2', solid: true, outline: true, name: 'gate-crown-crenels' });
    }

    // 鼻端封口：一朵金色玫瑰花飾（8 片圓瓣，凸出 0.5）
    {
      const yRos = (P.yLow(X_FRONT) + P.yC(X_FRONT)) / 2;
      /** @type {THREE.BufferGeometry[]} */
      const petals = [];
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const c = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 14);
        c.rotateZ(Math.PI / 2);
        c.translate(X_FRONT + 0.2, yRos + 1.42 * Math.sin(a), 1.42 * Math.cos(a));
        petals.push(c);
      }
      parts.push({ geometry: mergeGeos(petals), mat: 'gold2', solid: true, name: 'nose-rosette' });
    }

    // 車尾城垛尾翼（crenel-tail）：尾甲板末端兩個翼子板之間一道直立板（厚 1.4、倒角 0.2），上緣 5 個三階階梯形垛口；前緣一道金線
    {
      const xT = X_REAR + 3.2;
      const yDeck = P.yC(xT) - 0.4;
      const half = 20;
      const yWall = yDeck + 3.2;
      /** @type {THREE.BufferGeometry[]} */
      const tail = [extrudeFront([[-half, yDeck], [half, yDeck], [half, yWall], [-half, yWall]], xT, 1.4)];
      for (let i = 0; i < 5; i++) {
        const zc = lerp(-16.6, 16.6, i / 4);
        tail.push(extrudeFront(merlonOutline(zc, yWall - 0.1, 5.4, 1.2, 3, 0.8), xT, 1.4));
      }
      parts.push({ geometry: mergeGeos(tail), mat: 'mud2', solid: true, outline: true, name: 'crenel-tail' });
      const gilt = extrudeFront([[-half, yWall - 0.9], [half, yWall - 0.9], [half, yWall - 0.2], [-half, yWall - 0.2]], xT + 1.3, 0.5);
      parts.push({ geometry: gilt, mat: 'gold2', solid: true, name: 'crenel-gilt' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry:
      '本檔站位產生器 P（推估，iter-114 改成全罩車殼）：殼 x −64 → 70；翼子板包牆腳半寬 47.4（外框半寬 ≤ 48.0，iter-113 擦牆教訓）、腰牆 40.5、鼻端 22、車尾 30（< 導輪內緣 35.5）；翼子板頂 35.5–36、門樓座艙頂 39、引擎蓋 30、鼻端 21、車尾 25.5；牆腳 11–15.5（車尾封口下緣 15.5，封住後齒輪箱）',
    wheelArches: '前輪半圓拱 R17.5、後輪尖拱（兩段 R19 圓弧、半跨 17.5、拱頂約 y 31.9）：31 mm 輪胎半徑 15.5 + 2 mm，不切輪拱可裝；拱只切翼子板外牆（|z| ≥ 42），拱內 4 mm 深內襯（沿外牆內面）',
    crenels: '門樓頂四邊城垛 24 個（兩階，底寬 3.4、每階 1.15、厚 1.3）；尾翼城垛板 40 × 3.2 × 1.4 mm＋5 個三階垛口（底寬 5.4、每階 1.2）；ABS 實心件、邊緣 0.2 倒角（推估），質量 = 封閉體積 × 1.05 g/cm³',
    relief: '穆修胡修浮雕：32 段膠囊沿牆面法向壓扁成凸起 0.9 mm 的半膠囊（實體件），長約 32、高約 16 mm',
    myth: '穆修胡修的鱗身、長頸、蛇信、頭角與頭冠、前獅足後鷹爪、蝎尾（MYTH_RESEARCH M1）；伊什塔爾城門青金石藍釉磚、黑白金邊框與玫瑰花飾、遊行大道黃黑磚、城垛（M2、M3）；前半圓拱 / 後尖拱 = 獅掌 / 鷹爪的對應（MYTH_RESEARCH 4-1 M-a 的建議）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
