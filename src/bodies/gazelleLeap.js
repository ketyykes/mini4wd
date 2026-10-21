// 瞪羚角拉力型（body-gazelle-leap，第四階段致敬《爆走兄弟》風格）：短車頭短車尾、四輪高聳輪拱、開放座艙＋低擋風片、
// 車尾兩支往後上彎、尖端內收的豎琴形角鰭。
// 設計：shared/design/body-gazelle-leap/DESIGN.md（致敬語彙、和劇中車 / 市售車殼的差異）。剖面為本檔站位產生器（推估，依外框限制與底盤高度）。
// 塗裝全為自創：番紅花橘＋白＋黑、側面水平黑腰帶、號碼「27」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, buildDriver } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sdConvexPolygon, sideDecal, topDecal, mergeGeos, lerp, smoothstep, buildRegion, featureSd } from './loft.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/**
 * 單調三次內插（Fritsch–Carlson，不過衝）：B 組三款共用的站位表工具
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
 * 小圓（2D 距離）
 * @type {(cx: number, cy: number, r: number) => (u: number, v: number) => number}
 */
export const sdCircle = (cx, cy, r) => (u, v) => Math.hypot(u - cx, v - cy) - r;

/** 站位參數表（x 由後到前，前後軸 x = ∓40） */
const XS = [-56, -50, -40, -30, -20, -8, 4, 16, 28, 40, 50, 58, 64];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：短車頭從 16 抬到引擎蓋 26，座艙段 27，後艙蓋 29、短尾收到 25
  yC: monoCurve(XS, [24.5, 27.5, 29.5, 29.5, 28.5, 27.5, 27, 26.5, 25.5, 24, 21.5, 18.5, 15.5]),
  // 擋泥板稜線頂：四輪上方高聳（34），兩輪之間降成腰線（29）
  yF: monoCurve(XS, [27, 31.5, 34.2, 32, 29.5, 29, 29.5, 31, 33, 34.2, 32.5, 27, 19]),
  // 側壁半寬：輪上 44、腰部 41（略收），車頭收成 22、車尾 37
  hw: monoCurve(XS, [27, 32, 33.5, 34, 35, 36.5, 38.5, 41, 44, 45.5, 45.5, 44, 40]),
  // 側壁下緣：腰部壓低（9.6）、前後懸逐步抬高
  yLow: monoCurve(XS, [21, 18, 17.5, 17.5, 17.5, 17.2, 13, 10, 10, 12, 14, 15.5, 15.6]),
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
  // 擋泥板內坡：輪胎上方沿輪拱圓柱（R17.5）外側抬高 0.8 mm，內坡不被輪拱切開（擋泥板成為獨立的高聳量體，V1）
  const archTop = Math.max(...[40, -40].map((ax) => 13 + Math.sqrt(Math.max(0, 18.3 ** 2 - (x - ax) ** 2))));
  const yValley0 = Math.min(yC - 2.2, yF - 1.5);
  const yValley = Math.max(yValley0, archTop);
  const yShoulder = Math.min(yF - 4.5, yF - 0.12 * (hw - zF) * 3);
  const yLow = Math.min(P.yLow(x), yShoulder - 1);
  return [
    [0, yC],
    [6.5 * k, yC - 0.25],
    [8.5 * k, yValley0 + 0.4],
    [17 * k, yValley],
    [zF, Math.max(yF, yValley + 1.2)],
    [Math.max(zF + 0.4, hw - 2.4), yF - 1.6],
    [hw, yShoulder],
    [hw, yLow],
  ];
};

const STATIONS = buildStations(-56, 64, 2, profile);

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
});

/**
 * 豎琴形角鰭（單支）：從後擋泥板稜線長出，往後上彎、尖端往內收（兩尖端距離 < 根部距離），斷面根粗尖細
 * @type {(sg: number) => { base: THREE.BufferGeometry, tip: THREE.BufferGeometry }}
 */
const buildHorn = (sg) => {
  /** @type {number[][]} 角的中心線（根部埋在擋泥板稜線下 1.5 mm） */
  const path = [
    [-28, 30.5, sg * 30.5],
    [-38, 34.5, sg * 31],
    [-48, 39, sg * 30],
    [-55, 43.5, sg * 26.5],
    [-57.5, 46.4, sg * 21.5],
    [-55.5, 47.6, sg * 17.5],
  ];
  /** @type {(t: number) => number[]} 斷面半徑 [z 向, y 向] */
  const rad = (t) => [lerp(2.6, 0.25, t ** 1.1), lerp(3.2, 0.3, t ** 1.2)];
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
    [
      [-28, 30.5, sg * 30.5],
      [-38, 34.5, sg * 31],
      [-48, 39, sg * 30],
      [-55, 43.5, sg * 26.5],
      [-57.5, 46.4, sg * 21.5],
      [-55.5, 47.6, sg * 17.5],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
  /** @type {THREE.BufferGeometry[]} */
  const rings = [];
  for (const t of [0.3, 0.4, 0.5, 0.6]) {
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const r = lerp(2.6, 0.25, t ** 1.1) + 0.25;
    const g = new THREE.TorusGeometry(r, 0.32, 6, 20);
    // 環面法向對齊角的切線
    g.lookAt(tg);
    g.translate(p.x, p.y, p.z);
    rings.push(g);
  }
  return mergeGeos(rings);
};

/**
 * 低擋風片：座艙前緣一片後傾 58° 的弧形煙燻片（寬 22、高 6）
 * @type {(y0: number) => THREE.BufferGeometry}
 */
const buildWindscreen = (y0) => {
  const shape = new THREE.Shape();
  const hwB = 11;
  const hwT = 8.5;
  const h = 7;
  shape.moveTo(-hwB, 0);
  shape.lineTo(hwB, 0);
  shape.lineTo(hwT, h * 0.8);
  shape.quadraticCurveTo(0, h * 1.12, -hwT, h * 0.8);
  shape.lineTo(-hwB, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 10 });
  // shape 在 (z, y) 平面 → 轉成 x 為厚度方向，再往後傾
  g.rotateY(Math.PI / 2);
  g.rotateZ(0.95);
  g.translate(12.6, y0, 0);
  return g;
};

export const gazelleLeapBody = makePolyBody({
  id: 'body-gazelle-leap',
  name: '瞪羚角拉力型',
  style: 'homage',
  phase: 4,
  roof: 'open-cockpit',
  wing: 'lyre-horns',
  theme: '短車頭短車尾的拉力型：四輪高聳輪拱、開放座艙＋低擋風片、往後上彎尖端內收的豎琴形角鰭',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.6,
  // 平滑剖面，只保留中央脊邊（2）、擋泥板稜線（4）、側壁肩（6）為銳利稜線
  hard: [2, 3, 4, 6],
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
    // 白色腹部：側壁下段
    { mat: 'white', keep: (x, y, z) => (Math.abs(z) > 30 ? 16.2 - y : -1) },
    // 鼻部黑色刃唇（鼻尖往後 6 mm、下半）
    { mat: 'black', keep: (x, y) => Math.min(x - 57, 19 - y + 0.4 * (x - 57)) },
    // 白色「臉」：前擋泥板前端（中央脊保持橘色，俯視是 W 形的白面，往後斜切）
    { mat: 'white', keep: (x, y, z) => Math.min(x - 47 - 0.35 * (Math.abs(z) - 12), Math.abs(z) - 9.5) },
    { mat: 'saffron', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', recess: 'tub', recessWall: 'tubWall', mount: 'mount' },
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
      g.scale(7, 2.2, 3.6);
      g.rotateZ(-0.38);
      g.translate(-30, 31.2, sg * 30.6);
      sockets.push(g);
    }
    parts.push({ geometry: mergeGeos(sockets), mat: 'saffron', solid: true, outline: true, name: 'horn-sockets' });
    // 擋風片與駕駛
    const deck = kit.innerYAt(-8) - COCKPIT.depth + kit.t + 0.2;
    parts.push({ geometry: buildWindscreen(P.yC(12) - 1.2), mat: 'glass', solid: true, renderOrder: 3, name: 'windscreen' });
    const drv = buildDriver(-6, deck, 1.25);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 側面水平黑腰帶（瞪羚側帶）：從鼻側一路拉到車尾，前端收尖
    /** @type {(u: number, v: number) => number} u = 往前為正的 x、v = y */
    const band = (u, v) => {
      const yMid = 18.3 + 0.01 * u;
      const half = 2.1 * smoothstep(66, 40, u) + 0.15;
      return Math.max(Math.abs(v - yMid) - half, u - 64, -58 - u);
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
        kit.decal(sideDecal(sdNumber('27', { h: 5.4, w: 3, gap: 0.7 }), { x0: 0, y0: 24.5, zMin: 36 })),
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
    geometry: '本檔站位產生器 P（推估）：長約 120（HOMAGE_RESEARCH 4-1），擋泥板稜線輪上 34.2、腰部 29；輪拱 R17.5（31 mm 輪胎半徑 15.5 + 2 mm）',
    cockpit: '開放座艙槽深 7 mm（推估：讓 1.25 倍駕駛人剪影的頭盔露出殼面約一半）',
    horns: '角鰭為實心 ABS 件（掃掠橢圓斷面，根部 5.2 × 6.4 mm），質量 = 封閉體積 × 1.05 g/cm³；尖端內收至 |z| 17.5（根部 |z| 30.5），推估',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
