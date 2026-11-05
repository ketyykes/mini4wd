// 螳螂鐮刀伏擊型（body-mantis-scythe，LG1 致敬款）：俯視倒三角小頭＋兩顆大複眼燈、斷面三角形的細長「前胸」引擎蓋、
// 左右前擋泥板各自成量體，頂面各貼一片往後摺的鐮刀片（刃朝後）；座艙後置的開放座艙＋極低擋風片＋駕駛人剪影；
// 後輪由寬而圓的「腹部」包住，車尾兩片細長葉形平板翼左右錯開疊合（收起的翅膀，從腹部直接長出、無支柱）。
// 設計：shared/design/body-mantis-scythe/DESIGN.md（角色、LG1 語彙 L1-x、和劇中車 / 市售車殼的差異）。
// 剖面由本檔的站位產生器產生（推估，依 HOMAGE_RESEARCH 6-5-2 P2 與外框 / 輪胎間隙掃描）。
// 塗裝全為自創：萊姆綠＋石墨炭灰＋番茄紅（小面積）、斜切大三角分色、複眼燈外同心細環；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, buildDriver } from './polyBody.js';
import { monoCurve, buildStations, smoothNormals, smoothMax } from './gazelleLeap.js';
import { namedMaterial, decalMaterial, sdConvexPolygon, mergeGeos, lerp, smoothstep, buildRegion, buildRim } from './loft.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 車尾 x（腹部尾端） */
const X_TAIL = -70;
/** @type {number} 鼻尖 x（倒三角小頭的尖端） */
const X_NOSE = 75;

/** 縱向控制節點（x 由後到前；前後軸 x = ±40） */
const XS = [-70, -66, -60, -52, -44, -36, -26, -16, -6, 4, 14, 22, 30, 40, 50, 55, 58, 61, 65, 69, 72, 75];
/**
 * 縱向控制表（推估）：
 * - yC：中線高度。腹部 31（後輪上方）→ 座艙段 28.5 → 前胸脊線往前降到 24（底盤齒輪箱頂約 21，殼內面要高過它）→ 頸部 23.1 → 小頭 23 → 鼻尖 14
 * - yF：前擋泥板稜線（前輪上方 29.6，比前胸高 → 擋泥板成為獨立量體，L1-2）；腹部段不用
 * - hw：半寬。後輪上方 36.5（寬圓腹部）、腰部收到 21.5（俯視沙漏形：前胸 / 腹部分節；|z| < 28 的側壁下緣抬到 22.6，跨在底盤內件之上）、前擋泥板 42.5、小頭 13–14 → 鼻尖 5.6（俯視倒三角，鼻端小平面）
 *   腰部的炭灰側板俯視外擴到 28.4，會讓和 marlin-sail 的俯視 IoU 升高；所以用「寬的前肢擋泥板（42.5）＋窄的頸 / 小頭
 *   （13）＋往後收尖的腹部末端（x −60 / −66：25.5 / 12）＋略收的腹部（36.5）」把俯視平面拉開（螳螂的寬前肢、小頭、尖腹）
 * - yLow：側壁下緣
 * @type {Record<string, (x: number) => number>}
 */
const P = {
  yC: monoCurve(XS, [20.5, 25.2, 29, 30.6, 31.1, 31.1, 30.6, 29.8, 28.6, 27.6, 26.8, 26.3, 25.9, 25.3, 24.2, 23.4, 23.1, 23, 21.9, 19.6, 17, 14]),
  yF: monoCurve(XS, [20, 24, 27, 28.5, 29, 29, 28.5, 27.5, 26.2, 25, 24.6, 26, 28.4, 29.6, 28.8, 27, 23.5, 21.6, 20.6, 18.8, 16.6, 14.2]),
  hw: monoCurve(XS, [4, 12, 25.5, 36, 36.5, 36.5, 35.5, 29, 23, 21.5, 23, 34.2, 41.5, 42.5, 41.5, 38.8, 13, 14, 12.3, 9.6, 7.4, 5.6]),
  yLow: monoCurve(XS, [19, 17.5, 15.5, 13.6, 13, 13, 13.2, 14.6, 15.2, 15.2, 15, 14.2, 13.6, 13.5, 13.8, 14.2, 14.2, 13.8, 13.4, 13.2, 13.2, 13.2]),
};

/**
 * 前擋泥板內坡的最低高度：以前輪軸為中心的拋物線（輪心正上方 29，離輪心 15 mm 處 26.3），
 * 讓內坡在 R15.2 輪拱圓柱之上，不被輪拱切開（擋泥板頂不露出輪胎）
 * @type {(x: number) => number}
 */
const frontFenderFloor = (x) => 29 - 0.012 * (x - 40) ** 2;

/**
 * 半剖面 8 點（hard [1, 6]：中央脊 0–1 為直線 → 斷面三角形的前胸脊；側壁肩為銳利稜線）
 * - 前段（x ≥ 12）：中央脊 → 脊側 → 前胸谷 → 擋泥板內坡 → 擋泥板稜線 → 外側圓肩 → 側壁肩 → 側壁下緣
 * - 後段（x ≤ −6）：寬圓腹部（6 點依 (z / 半寬)² 下降的圓頂）
 * - 中間 18 mm 以 smoothstep 混合
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const hw = P.hw(x);
  // 腰部變窄處（半寬 < 28）側壁下緣抬高到 22.6：底盤內件在 |z| ≤ 26 最高約 21 mm，殼要跨在上面（推估間隙 ≥ 1.5 mm）
  const yLow = lerp(P.yLow(x), Math.max(P.yLow(x), 22.6), smoothstep(29, 27, hw) * (Math.abs(x) < 56 ? 1 : 0));
  // 前段：前胸＋擋泥板
  const k = Math.min(1, (hw - 3) / 34);
  const yF = Math.max(P.yF(x), yC - 1.2);
  const zF = Math.min(29.5 * k + 0.7 * Math.max(0, hw - 37.2), hw - 2.6);
  // 前胸谷底：x 22–54 的 |z| ≤ 26 範圍內底盤內件最高約 21 mm → 外殼至少 22.4（內面 21.6）
  // x 54–59 平滑過渡到 18.6：在 x 55 直接跳下去的話，谷底點會在擋泥板前緣斷開（鼻部 / 頸部出現皺褶）
  const vFloor = x > 22 ? lerp(22.4, 18.6, smoothstep(54, 59, x)) : 18.6;
  const yV = Math.max(Math.min(yC - 3.6, yF - 3), Math.min(vFloor, yC - 1.2));
  const yFi = smoothMax(Math.min(yF - 1.2, lerp(yV, yF, 0.7)), Math.min(frontFenderFloor(x), yF - 0.6), 0.6);
  const ySh = Math.min(yF - 3.4, yF - 0.1 * (hw - zF) * 3);
  const front = [
    [0, yC],
    [6 * k, yC - 2.4 * k],
    [13 * k, yV],
    [23 * k, yFi],
    [zF, yF],
    [Math.max(zF + 0.4, hw - 2.2), yF - 1.4],
    [hw, ySh],
    [hw, Math.min(yLow, ySh - 1)],
  ];
  // 後段：寬圓腹部
  const drop = 3.6;
  const fr = [0, 0.18, 0.36, 0.55, 0.73, 0.88];
  const rear = fr.map((q) => [q * hw, yC - drop * q * q]);
  rear.push([hw, yC - drop - 0.6], [hw, Math.min(yLow, yC - drop - 1.6)]);
  const b = smoothstep(12, -6, x);
  const body = front.map((p, i) => [lerp(p[0], rear[i][0], b), lerp(p[1], rear[i][1], b)]);
  // 小頭（x ≥ 56）：改用圓滑的倒三角頭剖面（同腹部的圓頂分布，落差 3.2），避免前胸 / 擋泥板的 8 點在窄處擠成皺褶
  const h = smoothstep(55, 60, x);
  if (h <= 0) {
    return body;
  }
  // 鼻尖附近 yC 降到 14，肩點若固定取 yC − 3.8 會低於下緣 11.6 → 剖面往回折（皺褶）。
  // 所以依可用高度 (yC − 下緣) 等比縮小圓頂落差與肩點，剖面永遠由上往下單調
  const yBot = Math.min(yLow, Math.max(yC - 4.8, 11.6));
  const sHead = Math.min(1, Math.max(0.2, (yC - yBot - 0.6) / 4.8));
  const head = fr.map((q) => [q * hw, yC - 3.2 * sHead * q * q]);
  head.push([hw, yC - 3.8 * sHead], [hw, yBot]);
  return body.map((p, i) => [lerp(p[0], head[i][0], h), lerp(p[1], head[i][1], h)]);
};

// 小頭與擋泥板前緣曲率大：x ≥ 50 每 1 mm 一站，其餘每 2 mm
const STATIONS = [...buildStations(X_TAIL, 50, 2, profile).slice(0, -1), ...buildStations(50, X_NOSE, 1, profile)];

/** @type {any} 開放座艙（俯視凸多邊形，深 5.5 mm 的座艙槽；座艙中心約 x −16） */
const COCKPIT = {
  id: '開放座艙',
  view: 'top',
  shape: 'poly',
  pts: [
    [-1, 0],
    [-3.5, 7.5],
    [-10, 9.8],
    [-25, 9.4],
    [-30.5, 5.2],
    [-30.5, 0],
  ],
  depth: 5.5,
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // paint-bright- 開頭 → Blender 以亮面實色漆算（萊姆綠要亮，不要灰）
  lime: namedMaterial('paint-bright-lime-green', { color: 0x8fd12a, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  lime2: namedMaterial('paint-bright-lime-green', { color: 0x8fd12a, roughness: 0.2, clearcoat: 1.0, side: THREE.DoubleSide }),
  graphite: namedMaterial('paint-graphite-charcoal', { color: 0x2e3236, roughness: 0.28, metalness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  graphite2: namedMaterial('paint-graphite-charcoal', { color: 0x2e3236, roughness: 0.28, metalness: 0.25, clearcoat: 0.9, side: THREE.DoubleSide }),
  red2: namedMaterial('paint-tomato-red', { color: 0xe8442c, roughness: 0.22, clearcoat: 1.0, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1d1a, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lime', { color: 0x5f8f18, roughness: 0.5, side: THREE.DoubleSide }),
  tub: namedMaterial('cockpit-tub', { color: 0x16171a, roughness: 0.8, side: THREE.DoubleSide }),
  tubWall: namedMaterial('cockpit-dark', { color: 0x26282c, roughness: 0.6, side: THREE.DoubleSide }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x24302a, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-red', { color: 0xe8442c, roughness: 0.3, clearcoat: 0.8 }),
  // 複眼燈：番茄紅發光燈罩
  eye: namedMaterial('lamp-tomato-red', { color: 0xff5a3c, emissive: 0xd9301a, emissiveIntensity: 0.65, roughness: 0.08, clearcoat: 1.0 }),
  dGraphite: decalMaterial('decal-graphite', { color: 0x2b2f33, roughness: 0.4 }),
  dRed: decalMaterial('decal-tomato-red', { color: 0xe8442c, roughness: 0.3, clearcoat: 0.6 }),
  dLime: decalMaterial('decal-lime-green', { color: 0x9ade33, roughness: 0.3, clearcoat: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 葉形薄板（收起的翅膀）：沿根部 → 尖端的中心線，葉寬 w(u) 兩端收尖，斷面厚度 th·√(1 − v²) 在兩側閉合 → 封閉網格（實心件）。
 * 板底高度 = max(殼面 + 0.3, 沿長度抬升的直線)（平滑最大值）：前段貼著腹部、後段離開殼面往上翹
 * @type {(o: { root: number[], tip: number[], width: number, thick: number, topY: (x: number, z: number) => number, yTip: number, lift?: number, nU?: number, nV?: number, wScale?: number, yOffset?: number }) => THREE.BufferGeometry}
 */
export function leafPlate(o) {
  const nU = o.nU ?? 40;
  const nV = o.nV ?? 10;
  const [xr, zr] = o.root;
  const [xt, zt] = o.tip;
  const len = Math.hypot(xt - xr, zt - zr);
  const nx = -(zt - zr) / len;
  const nz = (xt - xr) / len;
  const lift = o.lift ?? 0;
  const wScale = o.wScale ?? 1;
  const yOff = o.yOffset ?? 0;
  const y0 = o.topY(xr, zr) + 0.3;
  /** @type {(u: number) => number} 葉寬（半寬）：兩端為 0，約 1/3 處最寬 */
  const halfW = (u) => o.width * wScale * Math.sin(Math.PI * u ** 0.7) ** 0.8;
  /** @type {(i: number, j: number, sg: number) => number[]} */
  const P = (i, j, sg) => {
    const u = i / nU;
    const v = -1 + (2 * j) / nV;
    const w = halfW(u);
    const x = lerp(xr, xt, u) + v * w * nx;
    const z = lerp(zr, zt, u) + v * w * nz;
    const line = lerp(y0, o.yTip, u ** 1.6);
    const base = smoothMax(o.topY(x, z) + 0.3, line, 0.4) + lift * smoothstep(0, 0.3, u) + yOff;
    const th = o.thick * Math.sqrt(Math.max(0, 1 - v * v)) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.2)));
    return [x, base + (sg > 0 ? th : 0), z];
  };
  /** @type {number[]} */
  const pos = [];
  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nV; j++) {
      const a = P(i, j, 1);
      const b = P(i + 1, j, 1);
      const c = P(i + 1, j + 1, 1);
      const d = P(i, j + 1, 1);
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      const a2 = P(i, j, -1);
      const b2 = P(i + 1, j, -1);
      const c2 = P(i + 1, j + 1, -1);
      const d2 = P(i, j + 1, -1);
      pos.push(...a2, ...b2, ...c2, ...a2, ...c2, ...d2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return smoothNormals(g);
}

/**
 * 低擋風片：座艙前緣一片後傾的煙燻片＋黑框（底寬 22、頂到 y ≈ 35）
 * @type {(x0: number, y0: number) => { glass: THREE.BufferGeometry, frame: THREE.BufferGeometry }}
 */
const buildWindscreen = (x0, y0) => {
  /** @type {(hwB: number, hwT: number, h: number, dy: number) => THREE.Shape} */
  const outline = (hwB, hwT, h, dy) => {
    const pth = new THREE.Shape();
    pth.moveTo(-hwB, dy);
    pth.lineTo(hwB, dy);
    pth.lineTo(hwT, dy + h * 0.78);
    pth.quadraticCurveTo(0, dy + h * 1.12, -hwT, dy + h * 0.78);
    pth.lineTo(-hwB, dy);
    return pth;
  };
  const outer = outline(11, 8.5, 9.2, 0);
  outer.holes.push(outline(9.9, 7.4, 7.8, 0.6));
  /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} shape 在 (z, y) 平面 → x 為厚度方向，再往後傾 */
  const place = (g) => {
    g.rotateY(Math.PI / 2);
    g.rotateZ(0.9);
    g.translate(x0, y0, 0);
    return g;
  };
  return {
    frame: place(new THREE.ExtrudeGeometry(outer, { depth: 0.9, bevelEnabled: false, curveSegments: 10 })),
    glass: place(new THREE.ExtrudeGeometry(outline(9.95, 7.45, 7.85, 0.55), { depth: 0.5, bevelEnabled: false, curveSegments: 10 })),
  };
};

/** @type {number} 鐮刀片從擋泥板頂面隆起的高度（mm） */
const BLADE_RISE = 3.2;
/** @type {number[]} 收翅尖端高度 [左片, 右片]（讓翅膀沿長度立起一個角度） */
const WING_TIP_Y = [41, 42.5];

/** @type {number[][]} 鐮刀片中心線（俯視 (x, |z|)）：根部在擋泥板前內角，往後外彎到刃尖 */
const SCYTHE = [
  [55.5, 22.5],
  [51, 27.6],
  [44.5, 31.4],
  [37, 33.6],
  [29.5, 34.6],
  [23.5, 34.8],
];
/** @type {(u: number) => number} 鐮刀片半寬（u = 0 根部 → 1 刃尖） */
const scytheHalfW = (u) => lerp(2.2, 3.6, Math.min(1, u / 0.28)) * (u > 0.28 ? Math.cos((Math.PI / 2) * ((u - 0.28) / 0.72)) ** 0.7 : 1) + 0.15;

/**
 * 鐮刀片的距離函式（俯視 (x, |z|)，負值 = 片內）＋最近點的參數與側別（cross > 0 = 凹側＝刃側，朝後內）
 * @type {(x: number, z: number) => { d: number, u: number, side: number }}
 */
const scytheSd = (x, z) => {
  const n = SCYTHE.length - 1;
  let best = { d: Infinity, u: 0, side: 0 };
  for (let i = 0; i < n; i++) {
    const [ax, az] = SCYTHE[i];
    const [bx, bz] = SCYTHE[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const dist = Math.hypot(x - px, z - pz);
    const u = (i + t) / n;
    const d = dist - scytheHalfW(u);
    if (d < best.d) {
      best = { d, u, side: dx * (z - az) - dz * (x - ax) };
    }
  }
  return best;
};

/**
 * 腰部炭灰側板：前後輪拱之間，從殼面下緣往外伸出一道圓角肩、再往下垂到底盤側框上方，
 * 側視把電池艙整段遮住；俯視只外擴到 |z| 28.4（電池艙頂蓋外緣 26.5 ＋ 間隙 ≥ 1 mm），萊姆綠的沙漏殼面不變。
 * 斷面為封閉 L 形薄板（厚 0.9 mm）：腰部 = 肩台（y ≈ 23）＋圓角 R2.5 ＋ 垂直側板；腹部 / 擋泥板段 = 側壁內側 0.4 mm 往下延伸的垂直板。
 * 下緣 y 10.6（底盤側框禁入區 y ≤ 9.9 之上），前後端以 R4 圓角往上收。
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildWaistPanel = (sg) => {
  const XA = -23;
  const XB = 22;
  const T_PANEL = 0.9;
  const R_CORNER = 2.5;
  const R_END = 4;
  const Y_BOTTOM = 10.6;
  const N_ARC = 6;
  /** @type {(x: number) => number[][]} 封閉斷面 (z, y)：外側路徑（肩台 → 圓角 → 垂直板）＋內側路徑反向 */
  const section = (x) => {
    const edge = profile(x).at(-1);
    const hwE = edge[0];
    const yT = edge[1] + 0.35;
    const zP = Math.max(28.4, hwE - 0.4);
    const endU = Math.min(x - XA, XB - x);
    const endRise = R_END - Math.sqrt(Math.max(0, R_END ** 2 - (R_END - Math.min(R_END, endU)) ** 2));
    const yB = Math.min(Y_BOTTOM + endRise, yT - R_CORNER - 0.6);
    const z0 = Math.min(hwE - 1.6, zP - R_CORNER);
    /** @type {(off: number) => number[][]} 偏移 off（0 = 外側，T_PANEL = 內側）的路徑 */
    const path = (off) => {
      const pts = [[z0, yT - off]];
      for (let i = 0; i <= N_ARC; i++) {
        const a = (Math.PI / 2) * (1 - i / N_ARC);
        const r = R_CORNER - off;
        pts.push([zP - R_CORNER + r * Math.cos(a), yT - R_CORNER + r * Math.sin(a)]);
      }
      pts.push([zP - off, yB]);
      return pts;
    };
    return [...path(0), ...path(T_PANEL).reverse()];
  };
  /** @type {number[][][]} */
  const rings = [];
  /** @type {number[]} */
  const xs = [];
  for (let x = XA; x < XB - 1e-6; x += 0.5) {
    xs.push(x);
  }
  xs.push(XB);
  for (const x of xs) {
    rings.push(section(x).map(([z, y]) => [x, y, sg * z]));
  }
  /** @type {number[]} */
  const pos = [];
  const n = rings[0].length;
  /** @type {(a: number[], b: number[], c: number[]) => void} */
  const tri = (a, b, c) => {
    if (sg > 0) {
      pos.push(...a, ...b, ...c);
    } else {
      pos.push(...a, ...c, ...b);
    }
  };
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tri(rings[k][i], rings[k + 1][i], rings[k + 1][j]);
      tri(rings[k][i], rings[k + 1][j], rings[k][j]);
    }
  }
  // 兩端封口（斷面為凹多邊形 → 用 ShapeUtils 三角化）
  for (const [k, flip] of [
    [0, true],
    [rings.length - 1, false],
  ]) {
    const ring = rings[/** @type {number} */ (k)];
    const contour = ring.map((p) => new THREE.Vector2(p[2] * sg, p[1]));
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      if (flip) {
        tri(ring[a], ring[c], ring[b]);
      } else {
        tri(ring[a], ring[b], ring[c]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

export const mantisScytheBody = makePolyBody({
  id: 'body-mantis-scythe',
  name: '螳螂鐮刀伏擊型',
  style: 'homage',
  phase: 6,
  homageSeries: 'lg1',
  form: 'long-hood',
  roof: 'open-cockpit',
  wing: 'folded-wings',
  theme: '倒三角小頭＋大複眼燈、三角斷面長前胸、擋泥板頂往後摺的鐮刀片、後置開放座艙、寬圓腹部上兩片錯開疊合的收翅；冷靜的伏擊型對手',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.2,
  hard: [1, 6],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  recesses: [COCKPIT],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [
    // 石墨炭灰：側面斜切大三角（分色線由前低往後高斜升，腹部下半整片炭灰）
    { mat: 'graphite', keep: (x, y, z) => (Math.abs(z) > 21 ? 14.6 + 0.105 * (58 - x) - y : -1) },
    // 石墨炭灰：前胸三角（底在座艙前緣、尖端指向小頭的長三角，沿前胸脊）
    { mat: 'graphite', keep: (x, y, z) => (x > -1 && x < 56 ? 10.5 * ((56 - x) / 57) - Math.abs(z) : -1) },
    { mat: 'lime', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'graphite2', recess: 'tub', recessWall: 'tubWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    const topY = (x, z) => kit.surf.topY(x, z);
    // 鐮刀片（L1-5 的唯一刃形元素）：前擋泥板頂面隆起 3.2 mm 的炭灰片，凹側（朝後內）是番茄紅鋸齒刃
    /** @type {KeepFn} */
    const bladeKeep = (x, y, z) => (y < 22 ? -1 : -scytheSd(x, Math.abs(z)).d);
    // 隆起 3.2 mm：刃片側視也看得出一道立起的鐮刀
    const blade = buildRegion(kit.surf, [...kit.holes, bladeKeep], { offset: BLADE_RISE });
    parts.push({ geometry: blade.geometry, mat: 'graphite2', shell: true, name: 'scythe-blades' });
    parts.push({ geometry: buildRim(blade, 0, BLADE_RISE), mat: 'graphite2', name: 'scythe-blade-walls' });
    /** @type {KeepFn} 刃：凹側 1.1–2.4 mm 寬的帶，帶鋸齒（每段 u 1/9 一齒） */
    const edgeKeep = (x, y, z) => {
      if (y < 22) {
        return -1;
      }
      const s = scytheSd(x, Math.abs(z));
      if (s.side <= 0 || s.u > 0.93) {
        return -1;
      }
      // 刃帶 1.1–2.4 mm 寬：番茄紅鋸齒刃在遠景也讀得出來
      const tooth = 1.1 + 1.3 * Math.abs(((s.u * 9) % 1) - 0.5) * 2;
      return Math.min(-s.d, s.d + tooth);
    };
    parts.push({ geometry: buildRegion(kit.surf, [...kit.holes, edgeKeep], { offset: BLADE_RISE + 0.06 }).geometry, mat: 'red2', name: 'scythe-edges' });
    // 複眼燈（V14 變形）：小頭兩側上角各一顆大圓燈（半埋），外圍炭灰＋萊姆綠兩圈同心細環
    /** @type {THREE.BufferGeometry[]} */
    const eyes = [];
    /** @type {THREE.BufferGeometry[]} */
    const ringsDark = [];
    /** @type {THREE.BufferGeometry[]} */
    const ringsLime = [];
    // 燈的位置、半徑（3.3）與外環大小要讓整顆落在小頭上、離開擋泥板前面：嵌進擋泥板邊緣時旁邊會出現折痕
    const EYE = { x: 63.3, z: 10.2, r: 3.3 };
    const eyeY = topY(EYE.x, EYE.z) + 0.6;
    for (const sg of [-1, 1]) {
      const g = new THREE.SphereGeometry(EYE.r, 24, 16);
      g.scale(1.05, 0.95, 1);
      g.translate(EYE.x, eyeY, sg * EYE.z);
      eyes.push(g);
      // 同心環：繞燈的扁環，往外傾 35°（貼著小頭的斜面）
      for (const [r, tube, list] of [
        [EYE.r + 0.5, 0.4, ringsDark],
        [EYE.r + 1.25, 0.28, ringsLime],
      ]) {
        const ring = new THREE.TorusGeometry(/** @type {number} */ (r), /** @type {number} */ (tube), 8, 36);
        ring.rotateX(Math.PI / 2);
        ring.rotateX(sg * 0.6);
        ring.translate(EYE.x, eyeY - 1.4, sg * EYE.z);
        /** @type {THREE.BufferGeometry[]} */ (list).push(ring);
      }
    }
    parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, outline: true, name: 'compound-eye-lamps' });
    parts.push({ geometry: mergeGeos(ringsDark), mat: 'graphite2', solid: true, name: 'eye-rings-dark' });
    parts.push({ geometry: mergeGeos(ringsLime), mat: 'lime2', solid: true, name: 'eye-rings-lime' });
    // 收起的翅膀（folded-wings）：兩片細長葉形平板，左片在下、右片在上（往後錯開 7 mm、抬高 0.9 mm），在中線疊合；
    // 尖端翹到 y 41 / 42.5，翅膀沿長度立起約 10°（不平貼在車背上）；
    // 只抬高尖端，俯視的根部與尖端 (x, z) 不動（俯視投影不變大，維持和 marlin-sail / aero-wing 的 IoU）
    const wingL = { root: [-19, -6.8], tip: [-71.5, 2.2], width: 8.6, thick: 1.15, topY, yTip: WING_TIP_Y[0] };
    const wingR = { root: [-26, 6.8], tip: [-73.5, -2.0], width: 8.6, thick: 1.15, topY, yTip: WING_TIP_Y[1], lift: 0.9 };
    parts.push({ geometry: mergeGeos([leafPlate(wingL), leafPlate(wingR)]), mat: 'graphite2', solid: true, outline: true, name: 'folded-wings' });
    // 翅脈：每片翅膀上一條萊姆綠主脈＋兩條斜支脈（細管）
    /** @type {THREE.BufferGeometry[]} */
    const veins = [];
    for (const w of [wingL, wingR]) {
      const lift = w.lift ?? 0;
      /** @type {(u: number, v: number) => number[]} 翅面上的點（v = 半寬比例） */
      const onWing = (u, v) => {
        const [xr, zr] = w.root;
        const [xt, zt] = w.tip;
        const len = Math.hypot(xt - xr, zt - zr);
        const hwU = w.width * Math.sin(Math.PI * u ** 0.7) ** 0.8;
        const x = lerp(xr, xt, u) - v * hwU * ((zt - zr) / len);
        const z = lerp(zr, zt, u) + v * hwU * ((xt - xr) / len);
        const line = lerp(topY(xr, zr) + 0.3, w.yTip, u ** 1.6);
        const th = w.thick * Math.sqrt(Math.max(0, 1 - v * v)) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.2)));
        return [x, smoothMax(topY(x, z) + 0.3, line, 0.4) + lift * smoothstep(0, 0.3, u) + th + 0.05, z];
      };
      const main = [];
      for (let i = 0; i <= 16; i++) {
        main.push(onWing(lerp(0.06, 0.94, i / 16), 0));
      }
      veins.push(sweepEllipse(main, 48, () => [0.42, 0.28], 8));
      for (const [u0, s] of [
        [0.3, 1],
        [0.5, -1],
        [0.62, 1],
      ]) {
        const br = [];
        for (let i = 0; i <= 6; i++) {
          br.push(onWing(u0 + 0.16 * (i / 6), s * 0.75 * (i / 6)));
        }
        veins.push(sweepEllipse(br, 12, () => [0.3, 0.22], 8));
      }
    }
    parts.push({ geometry: mergeGeos(veins), mat: 'lime2', name: 'wing-veins' });
    // 腰部炭灰側板：遮住細腰下方的電池艙（outline：屬於車殼外形，計入輪廓）
    parts.push({ geometry: mergeGeos([buildWaistPanel(1), buildWaistPanel(-1)]), mat: 'graphite2', solid: true, outline: true, name: 'waist-side-panels' });
    // 擋風片與駕駛
    const ws = buildWindscreen(-0.4, P.yC(-1) - 1.4);
    parts.push({ geometry: ws.glass, mat: 'glass', solid: true, renderOrder: 3, name: 'windscreen' });
    parts.push({ geometry: ws.frame, mat: 'graphite', solid: true, name: 'windscreen-frame' });
    const deck = kit.innerYAt(-16) - COCKPIT.depth + kit.t + 0.2;
    const drv = buildDriver(-13, deck, 1.2);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 頭 / 前胸分件線：x 58.4 一圈 0.5 mm 炭灰細線，
    // 把小頭讀成一個獨立的頭殼件
    parts.push({
      geometry: kit.decal((x, y) => (y < 12 ? -1 : 0.25 - Math.abs(x - 58.4)), { offset: 0.06 }),
      mat: 'dGraphite',
      name: 'decal-head-parting-line',
    });
    // 小頭頂的自創抽象符號（L1-8 位置）：番茄紅小倒三角＋炭灰外框
    const emblem = sdConvexPolygon([
      [69, 0],
      [59.5, 4.6],
      [59.5, -4.6],
    ]);
    parts.push({
      geometry: kit.decal((x, y, z) => -emblem(x, z)),
      mat: 'dRed',
      name: 'decal-head-emblem',
    });
    // 腹部體節線：炭灰分色線以上的萊姆綠腹側，3 道往後彎的細炭灰弧（螳螂腹節）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 24 || x > -18 || x < -64) {
          return -1;
        }
        let d = Infinity;
        for (const xc of [-26, -38, -50]) {
          d = Math.min(d, Math.abs(x - xc - 0.18 * (y - 20)) - 0.5);
        }
        return Math.min(-d, y - (14.6 + 0.105 * (58 - x)) - 0.4);
      }),
      mat: 'dGraphite',
      name: 'decal-abdomen-segments',
    });
    // 分色線上方的番茄紅細線（從擋泥板前緣往後上斜，到座艙側為止）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 22 || x < -4 || x > 57) {
          return -1;
        }
        const s = 14.6 + 0.105 * (58 - x);
        return Math.min(y - s - 0.35, s + 1.15 - y);
      }),
      mat: 'dRed',
      name: 'decal-split-line',
    });
    // 前擋泥板側面的萊姆綠斜切三角（炭灰區內，指向前方）
    const flankTri = sdConvexPolygon([
      [60, 15.6],
      [30, 15.2],
      [30, 18.6],
    ]);
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < 30 ? -1 : -flankTri(x, y))),
      mat: 'dLime',
      name: 'decal-flank-triangle',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他致敬款）',
    geometry: '本檔站位產生器 P（推估，依 HOMAGE_RESEARCH 6-5-2 P2：長約 146、車身約 30、擋風片約 35）；前胸脊為斷面三角（hard 1）、腹部為圓頂剖面',
    wheelArches: '前後 R15.2：只對應 26 mm 輪（半徑 13＋2.2 mm）；31 mm 輪不支援（低車身）',
    cockpit: '開放座艙槽深 5.5 mm（推估）；擋風片煙燻 PC 0.5 mm＋炭灰框 0.9 mm；駕駛人剪影 1.2 倍',
    wings: '收翅、複眼燈、同心環、腰部炭灰側板（厚 0.9 mm）視為 ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；鐮刀片為殼面隆起 1.6 mm（以殼面面積 × 壁厚計）',
    waistPanels: 'iter-69：側板外面 |z| 28.4（底盤電池艙頂蓋外緣 |z| 26.5 由 carLayout / model.js 推算，內面留 1 mm）、下緣 y 10.6（loft.js CHASSIS_SIDE_RAIL 禁入區 y ≤ 9.9 之上）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
