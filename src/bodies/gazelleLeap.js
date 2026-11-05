// 瞪羚角拉力型（body-gazelle-leap，致敬《爆走兄弟》風格）：短車頭短車尾、四輪高聳輪拱、開放座艙＋低擋風片、
// 車尾兩支往後上彎、尖端內收的豎琴形角鰭。
// 設計：shared/design/body-gazelle-leap/DESIGN.md（致敬語彙、和劇中車 / 市售車殼的差異）。剖面為本檔站位產生器（推估，依外框限制與底盤高度）。
// 塗裝全為自創：番紅花橘＋白＋黑、側面水平黑腰帶、號碼「27」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makePolyBody, sweepEllipse, buildDriver } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sdConvexPolygon, sideDecal, topDecal, mergeGeos, lerp, smoothstep, buildRegion, buildRim, featureSd } from './loft.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/**
 * 單調三次內插（Fritsch–Carlson，不過衝）：多款車殼共用的站位表工具
 * @type {(xs: number[], vs: number[]) => (x: number) => number}
 */
export function monoCurve(xs, vs) {
  const n = xs.length;
  /** @type {number[]} */
  const d = [];
  for (let k = 0; k < n - 1; k++) {
    d.push((vs[k + 1] - vs[k]) / (xs[k + 1] - xs[k]));
  }
  /** @type {number[]} */
  const m = [d[0]];
  for (let k = 1; k < n - 1; k++) {
    m.push(d[k - 1] * d[k] <= 0 ? 0 : (2 * d[k - 1] * d[k]) / (d[k - 1] + d[k]));
  }
  m.push(d[n - 2]);
  return (x) => {
    if (x <= xs[0]) {
      return vs[0];
    }
    if (x >= xs[n - 1]) {
      return vs[n - 1];
    }
    let k = 0;
    while (k < n - 2 && x > xs[k + 1]) {
      k++;
    }
    const h = xs[k + 1] - xs[k];
    const t = (x - xs[k]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
  };
}

/**
 * 依剖面函式產生站位表（每 step mm 一站，含兩端）
 * @type {(x0: number, x1: number, step: number, profile: (x: number) => number[][]) => { x: number, pts: number[][] }[]}
 */
export function buildStations(x0, x1, step, profile) {
  /** @type {{ x: number, pts: number[][] }[]} */
  const out = [];
  for (let x = x0; x < x1 - 1e-6; x += step) {
    out.push({ x, pts: profile(x) });
  }
  out.push({ x: x1, pts: profile(x1) });
  return out;
}

/**
 * 鼻端下捲係數：x ≤ x0 為 1，往鼻尖 x1 以四分之一橢圓降到 minFrac。
 * 剖面各點高度以側壁下緣為基準乘上此係數 → 鼻端是圓滑往下捲的曲面，而不是垂直平切面 ＋ 大塊斜折面
 * @type {(x: number, x0: number, x1: number, minFrac: number) => number}
 */
export const noseRoll = (x, x0, x1, minFrac) => {
  if (x <= x0) {
    return 1;
  }
  const u = Math.min(1, (x - x0) / (x1 - x0));
  return minFrac + (1 - minFrac) * Math.sqrt(1 - u * u);
};

/**
 * 小圓（2D 距離）
 * @type {(cx: number, cy: number, r: number) => (u: number, v: number) => number}
 */
export const sdCircle = (cx, cy, r) => (u, v) => Math.hypot(u - cx, v - cy) - r;

/**
 * 平滑法線：把非索引的掃掠 / 環面幾何依位置合併頂點後重算法線，消除平直著色的多邊形面
 * @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry}
 */
export const smoothNormals = (g) => {
  g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
};

/**
 * 平滑最大值（log-sum-exp，k 越小越接近 max；兩值相等處最多抬高 k·ln2）：避免 Math.max 在曲面上留下折痕
 * @type {(a: number, b: number, k?: number) => number}
 */
export const smoothMax = (a, b, k = 1.2) => {
  const m = Math.max(a, b);
  return m + k * Math.log(Math.exp((a - m) / k) + Math.exp((b - m) / k));
};

/**
 * 擋泥板內坡的最低高度：以輪軸為中心的平滑拋物線（輪心正上方 31.8，離輪心 15 mm 處 29.1），
 * 永遠在 R17.5 輪拱圓柱之上，且沒有圓弧端點的無限斜率（圓弧會在站位間留下折痕）
 * @type {(x: number, axles?: number[]) => number}
 */
export const fenderFloor = (x, axles = [40, -40]) => Math.max(...axles.map((ax) => 31.8 - 0.012 * (x - ax) ** 2));

/**
 * 輪拱內襯：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3），只取上半圈（角度 a0–a1，0 = 車頭方向），
 * z 從 zFrom 到 zTo；擋住從側面看進去的殼內空腔。開放面，標 shell（面積 × 壁厚算質量）
 * @type {(arch: { x: number, y: number, radius: number }, zFrom: number, zTo: number, a0?: number, a1?: number) => THREE.BufferGeometry}
 */
export function buildArchLiner(arch, zFrom, zTo, a0 = 0.15, a1 = Math.PI - 0.15) {
  const r = arch.radius + 0.3;
  const n = 40;
  const pos = [];
  for (const sg of [-1, 1]) {
    const z0 = sg * zFrom;
    const z1 = sg * zTo;
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), z];
      const A = p(t0, z0);
      const B = p(t1, z0);
      const C = p(t1, z1);
      const D = p(t0, z1);
      // 法線朝輪心（內襯面向輪胎）
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
}

/** 站位參數表（x 由後到前，前後軸 x = ∓40） */
const XS = [-58, -56, -50, -40, -30, -20, -8, 4, 16, 28, 40, 50, 58, 64];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：短車頭從 15.5 抬到引擎蓋 25，座艙段壓低到 24.5（壓低腰線），後艙蓋 29、車尾收圓到 22
  yC: monoCurve(XS, [22, 24, 27.5, 29, 28, 26, 24.5, 24.5, 25, 25.5, 25, 22, 18.5, 15.5]),
  // 擋泥板稜線頂：四輪上方高聳（38，「長腿」），兩輪之間降成腰線（27）
  yF: monoCurve(XS, [24, 28, 34, 38, 34.5, 29, 27, 27, 29, 34, 38, 35, 28, 19]),
  // 側壁半寬：前擋泥板最寬（45.5），往後收窄成箭頭形平面，車尾收到 20（尾端收圓，不是平切立面）
  hw: monoCurve(XS, [20, 25, 32, 33.5, 34, 35, 36.5, 38.5, 41, 44, 45.5, 45.5, 44, 40]),
  // 側壁下緣：腰部壓低（9.6）、後段抬到 17.5 讓開底盤
  yLow: monoCurve(XS, [22, 21, 18, 17.5, 17.5, 17.5, 17.2, 13, 10, 10, 12, 14, 15.5, 15.6]),
};

/**
 * 半剖面 8 點：中線頂 → 中央脊邊 → 脊外溝 → 擋泥板內坡 → 擋泥板稜線 → 外側圓肩 → 側壁肩 → 側壁下緣
 * - 中央脊（V4 變形：平頂窄脊，不是 V 形也不是風箱）寬 ±7，脊外 2 mm 落差
 * - 擋泥板稜線在 |z| ≈ 31（輪胎中心 29.75 外側），是「長腿」比例的主角
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yF = Math.max(P.yF(x), yC - 1.5);
  const hw = P.hw(x);
  // 窄鼻處剖面點等比例內縮（z 不遞減）
  const k = Math.min(1, (hw - 2.4) / 34);
  const zF = Math.min(31 * k, hw - 3);
  // 擋泥板內坡：輪胎上方以平滑拋物線抬到輪拱圓柱之上，內坡不被輪拱切開（擋泥板成為獨立的高聳量體，V1）
  const yValley0 = Math.min(yC - 2.2, yF - 1.5);
  const yValley = smoothMax(yValley0, fenderFloor(x));
  // 鼻段（x > 56）的肩至少比下緣高 1.2 mm，下緣維持平順的 15.5–15.6：鼻尖兩站（x 63–64）的側壁肩低於下緣 + 1，
  // 若只以 yShoulder − 1 夾住下緣，下緣會在最後 1 mm 從 15.6 掉到 13.5，鼻部白色擋泥板下緣兩角出現往下的尖齒與看得到殼內的黑色小缺口
  const yShoulder = Math.max(Math.min(yF - 4.5, yF - 0.12 * (hw - zF) * 3), x > 56 ? P.yLow(x) + 1.2 : -Infinity);
  const yLow = Math.min(P.yLow(x), yShoulder - 1);
  // 鼻端下捲（x 50 → 64），各點高度以側壁下緣為基準壓低，避免白色前臉變成平切立面＋大折面
  const roll = noseRoll(x, NOSE_ROLL.x0, NOSE_ROLL.x1, NOSE_ROLL.minFrac);
  /** @type {(y: number) => number} */
  const r = (y) => yLow + (y - yLow) * roll;
  return [
    [0, r(yC)],
    [6.5 * k, r(yC - 0.25)],
    [8.5 * k, r(yValley0 + 0.4)],
    [17 * k, r(yValley)],
    [zF, r(Math.max(yF, yValley + 1.2))],
    [Math.max(zF + 0.4, hw - 2.4), r(yF - 1.6)],
    [hw, r(yShoulder)],
    [hw, yLow],
  ];
};

/** @type {{ x0: number, x1: number, minFrac: number }} 鼻端下捲範圍 */
const NOSE_ROLL = { x0: 50, x1: 64, minFrac: 0.3 };

// 鼻端下捲段每 1 mm 一站（曲率大，2 mm 站距會留下折痕）
const STATIONS = [...buildStations(-58, 48, 2, profile).slice(0, -1), ...buildStations(48, 64, 1, profile)];

/** @type {any} 開放座艙（俯視凸多邊形，深 7 mm 的座艙槽） */
const COCKPIT = {
  id: '開放座艙',
  view: 'top',
  shape: 'poly',
  pts: [
    [12, 0],
    [9, 9],
    [-2, 11],
    [-22, 10.5],
    [-27, 6],
    [-27, 0],
  ],
  depth: 5,
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  saffron: namedMaterial('paint-saffron-orange', { color: 0xf28a12, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  saffron2: namedMaterial('paint-saffron-orange', { color: 0xf28a12, roughness: 0.22, clearcoat: 1.0, side: THREE.DoubleSide }),
  white: namedMaterial('paint-gloss-white', { color: 0xf3f1ea, roughness: 0.25, clearcoat: 0.9 }),
  black: namedMaterial('paint-gloss-black', { color: 0x141518, roughness: 0.3, clearcoat: 0.8 }),
  black2: namedMaterial('paint-gloss-black', { color: 0x141518, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1d1a17, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-orange', { color: 0xb8650c, roughness: 0.5, side: THREE.DoubleSide }),
  tub: namedMaterial('cockpit-tub', { color: 0x16171a, roughness: 0.8, side: THREE.DoubleSide }),
  tubWall: namedMaterial('cockpit-dark', { color: 0x26282c, roughness: 0.6, side: THREE.DoubleSide }),
  recess: namedMaterial('plastic-gill-black', { color: 0x050505, roughness: 0.9, side: THREE.DoubleSide }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x2a3440, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-white', { color: 0xf3f1ea, roughness: 0.3, clearcoat: 0.8 }),
  // 角鰭：象牙白漸層到黑色尖端（名稱含 horn 方便 Blender 分類）
  horn: namedMaterial('paint-horn-ivory', { color: 0xe9e2cf, roughness: 0.3, clearcoat: 0.8 }),
  hornTip: namedMaterial('paint-gloss-black', { color: 0x141518, roughness: 0.3, clearcoat: 0.8 }),
  lamp: namedMaterial('lamp-amber', { color: 0xffc23a, emissive: 0xff9a00, emissiveIntensity: 0.7, roughness: 0.1, clearcoat: 1.0 }),
  dBlack: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  dWhite: decalMaterial('decal-white', { color: 0xf6f4ee, roughness: 0.4 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-inner-dark', { color: 0x1d1a17, roughness: 0.85, side: THREE.DoubleSide }),
});

/**
 * 角鰭中心線（右側，左側 z 取負）：根部埋在後擋泥板稜線裡，先幾乎垂直往上升、再往後上彎，尖端往內收（頂高 57）
 * @type {number[][]}
 */
const HORN_PATH = [
  [-29, 32.2, 31],
  [-36, 38.8, 31.5],
  [-42, 45, 30.5],
  [-46.5, 51, 28],
  [-48.5, 55, 23.5],
  [-47, 57, 18.5],
];
/** @type {(t: number) => number[]} 角的斷面半徑 [z 向, y 向]：根粗尖細 */
const HORN_RAD = (t) => [lerp(3.4, 0.3, t ** 0.85), lerp(4.1, 0.35, t ** 0.95)];

/**
 * 豎琴形角鰭（單支）：從後擋泥板稜線長出，往後上彎、尖端往內收（兩尖端距離 < 根部距離），斷面根粗尖細
 * @type {(sg: number) => { base: THREE.BufferGeometry, tip: THREE.BufferGeometry }}
 */
const buildHorn = (sg) => {
  /** @type {number[][]} 角的中心線（根部埋在擋泥板稜線下 1.5 mm） */
  const path = HORN_PATH.map(([x, y, z]) => [x, y, sg * z]);
  /** @type {(t: number) => number[]} 斷面半徑 [z 向, y 向]（根部斷面 6.8 × 8.2 mm） */
  const rad = HORN_RAD;
  // 分成象牙白主體（前 82%）與黑色尖端；兩段共用同一條曲線（以參數區間取點）
  const curve = new THREE.CatmullRomCurve3(
    path.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
  /** @type {(t0: number, t1: number, n: number) => number[][]} */
  const sub = (t0, t1, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(lerp(t0, t1, i / n));
      out.push([p.x, p.y, p.z]);
    }
    return out;
  };
  const split = 0.8;
  return {
    base: sweepEllipse(sub(0, split, 14), 40, (t) => rad(t * split), 18),
    tip: sweepEllipse(sub(split, 1, 6), 14, (t) => rad(split + t * (1 - split)), 18),
  };
};

/**
 * 角鰭上的環節（瞪羚角的橫紋）：沿角的前段放 4 圈扁環
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildHornRings = (sg) => {
  const curve = new THREE.CatmullRomCurve3(
    HORN_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, sg * z)),
    false,
    'centripetal',
  );
  /** @type {THREE.BufferGeometry[]} */
  const rings = [];
  for (const t of [0.34, 0.44, 0.54, 0.64]) {
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const [rz, ry] = HORN_RAD(t);
    const g = new THREE.TorusGeometry((rz + ry) / 2 + 0.15, 0.38, 6, 24);
    // 環面法向對齊角的切線
    g.lookAt(tg);
    g.translate(p.x, p.y, p.z);
    rings.push(g);
  }
  return mergeGeos(rings);
};

/**
 * 低擋風片：座艙前緣一片後傾約 54° 的煙燻片（底寬 26、高 9），外圍 1.1 mm 黑框
 * 回傳 glass（框內的煙燻片）與 frame（框）
 * @type {(y0: number) => { glass: THREE.BufferGeometry, frame: THREE.BufferGeometry }}
 */
const buildWindscreen = (y0) => {
  /** @type {(hwB: number, hwT: number, h: number, dy: number) => THREE.Path} */
  const outline = (hwB, hwT, h, dy) => {
    const pth = new THREE.Shape();
    pth.moveTo(-hwB, dy);
    pth.lineTo(hwB, dy);
    pth.lineTo(hwT, dy + h * 0.8);
    pth.quadraticCurveTo(0, dy + h * 1.12, -hwT, dy + h * 0.8);
    pth.lineTo(-hwB, dy);
    return pth;
  };
  const outer = outline(13, 10.5, 9, 0);
  const inner = outline(11.9, 9.4, 7.6, 0.6);
  const frameShape = /** @type {THREE.Shape} */ (outer);
  frameShape.holes.push(inner);
  /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} shape 在 (z, y) 平面 → x 為厚度方向，再往後傾 */
  const place = (g) => {
    g.rotateY(Math.PI / 2);
    g.rotateZ(0.95);
    g.translate(13.2, y0, 0);
    return g;
  };
  return {
    frame: place(new THREE.ExtrudeGeometry(frameShape, { depth: 0.9, bevelEnabled: false, curveSegments: 10 })),
    glass: place(new THREE.ExtrudeGeometry(/** @type {THREE.Shape} */ (outline(11.95, 9.45, 7.65, 0.55)), { depth: 0.5, bevelEnabled: false, curveSegments: 10 })),
  };
};

export const gazelleLeapBody = makePolyBody({
  id: 'body-gazelle-leap',
  name: '瞪羚角拉力型',
  style: 'homage',
  phase: 4,
  // LG1 / LG2 分組（shared/design/HOMAGE_RESEARCH.md 第 6 節）
  homageSeries: 'lg2',
  form: 'rally',
  roof: 'open-cockpit',
  wing: 'lyre-horns',
  theme: '短車頭短車尾的拉力型：四輪高聳輪拱、開放座艙＋低擋風片、往後上彎尖端內收的豎琴形角鰭',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.6,
  // 平滑剖面，只保留中央脊邊（2）、擋泥板稜線（4）、側壁肩（6）為銳利稜線（擋泥板內坡 3 不設折線，鼻部白色量體才不會是大塊折面）
  hard: [2, 4, 6],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
  ],
  recesses: [
    COCKPIT,
    // 前輪後方的側面進氣口（V10）：往後上斜的平行四邊形
    { id: '側進氣口', view: 'side', shape: 'poly', pts: [[17, 12], [21.5, 12], [16.5, 22], [12, 22]], depth: 2.4 },
  ],
  sideZMin: 36,
  innerSkipRecess: true,
  zones: () => [
    // 白色下半車身：側壁下段一路到車尾，和白色前臉連成一片（概念圖的白色腹部）
    { mat: 'white', keep: (x, y, z) => (Math.abs(z) > 24 ? 19.6 - y : -1) },
    // 白色「臉」：前擋泥板前端（中央脊保持橘色，俯視是 W 形的白面，往後斜切）
    { mat: 'white', keep: (x, y, z) => Math.min(x - 46 - 0.35 * (Math.abs(z) - 12), Math.abs(z) - 8.5) },
    { mat: 'saffron', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'white', recess: 'tub', recessWall: 'tubWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 豎琴形角鰭
    const hl = buildHorn(-1);
    const hr = buildHorn(1);
    parts.push({ geometry: mergeGeos([hl.base, hr.base]), mat: 'saffron', solid: true, outline: true, name: 'lyre-horns' });
    parts.push({ geometry: mergeGeos([hl.tip, hr.tip]), mat: 'hornTip', solid: true, outline: true, name: 'lyre-horn-tips' });
    parts.push({ geometry: mergeGeos([buildHornRings(-1), buildHornRings(1)]), mat: 'white', name: 'horn-rings' });
    // 角鰭底座（翼根）：半埋在後擋泥板稜線上的扁橢球座，角從座裡長出來
    /** @type {THREE.BufferGeometry[]} */
    const sockets = [];
    for (const sg of [-1, 1]) {
      const g = new THREE.SphereGeometry(1, 20, 12);
      g.scale(7.5, 2.6, 4.2);
      g.rotateZ(-0.5);
      g.translate(-30.5, 33.2, sg * 31);
      sockets.push(g);
    }
    parts.push({ geometry: mergeGeos(sockets), mat: 'saffron', solid: true, outline: true, name: 'horn-sockets' });
    // 擋風片與駕駛
    const deck = kit.innerYAt(-8) - COCKPIT.depth + kit.t + 0.2;
    const ws = buildWindscreen(P.yC(12) - 1.2);
    parts.push({ geometry: ws.glass, mat: 'glass', solid: true, renderOrder: 3, name: 'windscreen' });
    parts.push({ geometry: ws.frame, mat: 'black', solid: true, name: 'windscreen-frame' });
    // 座艙邊框：座艙槽外圍 1.2 mm 寬、凸出 0.6 mm 的黑色立體框＋框的側壁
    const cockSd = featureSd(COCKPIT, 36);
    const rim = buildRegion(kit.surf, [...kit.holes, (x, y, z) => cockSd(x, y, z), (x, y, z) => 1.2 - cockSd(x, y, z)], { offset: 0.6 });
    parts.push({ geometry: rim.geometry, mat: 'black', name: 'cockpit-rim' });
    parts.push({ geometry: buildRim(rim, 0, 0.6), mat: 'black2', name: 'cockpit-rim-wall' });
    // 前輪拱內襯：側壁內側 7 mm 寬的一圈，擋住從側面看進去的殼內空腔（後輪拱上方有角鰭座，空腔不明顯，不加以省質量）
    parts.push({
      geometry: buildArchLiner({ x: 40, y: 13, radius: 17.5 }, 37.5, 44.8, 0.35, Math.PI - 0.35),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    const drv = buildDriver(-6, deck, 1.25);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 側面水平黑腰帶（瞪羚側帶）：從鼻側一路拉到車尾，前端收尖
    /** @type {(u: number, v: number) => number} u = 往前為正的 x、v = y */
    // 前端在 x 52（鼻端下捲之前）收尖——延伸到鼻尖 64 的話寬度只剩 0.3 mm，在下捲曲面上會斷成一截截黑色虛線
    const band = (u, v) => {
      const yMid = 21.4 + 0.01 * u;
      const half = 1.95 * Math.min(1, Math.max(0, (52 - u) / 14));
      return Math.max(Math.abs(v - yMid) - half, u - 52, -58 - u);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(band, { x0: 0, y0: 0, zMin: 30, side: 1 })),
        kit.decal(sideDecal((u, v) => band(-u, v), { x0: 0, y0: 0, zMin: 30, side: -1 })),
      ]),
      mat: 'dBlack',
      name: 'decal-flank-band',
    });
    // 引擎蓋：從鼻尖往後掃的白色雙箭羽（兩道後掠的斜條，構圖由鼻向後）
    const chev = [sdBar(60, 2, 40, 12, 2.2), sdBar(60, -2, 40, -12, 2.2), sdBar(52, 2, 34, 11, 1.4), sdBar(52, -2, 34, -11, 1.4)];
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) > 17 ? -1 : -Math.min(...chev.map((f) => f(x, z))))),
      mat: 'dWhite',
      name: 'decal-chevrons',
    });
    // 號碼 27：後艙蓋與側面（白底黑字的圓牌放在側面腰帶上方）
    parts.push({
      geometry: mergeGeos([
        kit.decal(topDecal(sdNumber('27', { h: 6, w: 3.2, gap: 0.8 }), { x0: -40, yMin: 24 })),
        kit.decal(sideDecal(sdNumber('27', { h: 5.4, w: 3, gap: 0.7 }), { x0: 2, y0: 16.2, zMin: 36 })),
      ]),
      mat: 'dBlack',
      name: 'decal-number',
    });
    // 細縫頭燈（V14）：前擋泥板頂面一對往外上斜的琥珀燈縫
    const lampSd = sdConvexPolygon([
      [57, 22],
      [55, 28],
      [50, 33],
      [52, 27],
    ]);
    parts.push({
      geometry: kit.decal((x, y, z) => -lampSd(x, Math.abs(z)), { offset: 0.1 }),
      mat: 'lamp',
      name: 'lamp-slits',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他致敬款）',
    geometry: '本檔站位產生器 P（推估）：長約 122（x −58 → 64；HOMAGE_RESEARCH 4-1 的短車身），擋泥板稜線輪上 38、腰部 27（「長腿」比例）；輪拱 R17.5（31 mm 輪胎半徑 15.5 + 2 mm）＋內襯',
    cockpit: '開放座艙槽深 5 mm（推估：讓 1.25 倍駕駛人剪影的頭盔露出殼面約一半）；擋風片煙燻 PC 0.5 mm＋黑框 0.9 mm',
    horns: '角鰭為實心 ABS 件（掃掠橢圓斷面，根部 6.8 × 8.2 mm），質量 = 封閉體積 × 1.05 g/cm³；頂 57、尖端內收至 |z| 18.5（根部 |z| 31），推估',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
