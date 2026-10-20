// 楔形競速款（body-wedge）：iter-38 重做成「多件式」立體造型——左右前翼艙包住前輪、中央尖鼻，兩者之間是往後延伸的深溝；
// 鼻下黑色多層分流尖牙、多面折角的低平座艙、側面層疊黑色進氣口與側箱隆起、尾部兩片翹起的尾鰭＋鴨尾翼片。
// 設計意圖：shared/design/body-wedge/DESIGN.md 與 concept_*.png（AI 概念圖只當造型意圖）；尺寸限制沿用 DESIGN.md §3.7
// （x ∈ [−66, 72]、半寬 ≤ 40、高 ≤ 50、與輪胎 / 導輪 / 底盤間隙 ≥ 1 mm）。剖面改用本檔的多點折線站位表（不再用 sections.json 的 4 點剖面）。
// 塗裝全為自創：號碼「07」、青藍細線、石墨黑下半車身與溝槽；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import data from './data/body-wedge.json';
import { getPart } from '../parts/index.js';
import {
  makeLoftKit,
  createPolySurface,
  cachedBuild,
  namedMaterial,
  decalMaterial,
  buildMountTabs,
  buildRegion,
  buildRim,
  featureSd,
  sdNumber,
  sdConvexPolygon,
  sideDecal,
  topDecal,
  mergeGeos,
  smoothstep,
} from './loft.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/**
 * 半剖面站位表（z ≥ 0，8 點：中央尖鼻頂 → 尖鼻邊 → 溝底內 → 溝底外 → 翼艙內稜 → 翼艙外稜 → 最寬處 → 下緣）
 * - x ≥ 30：翼艙（z 21–33）高過尖鼻與溝底，三個量體分開；x 44 以後溝底抬高避開前齒輪箱（底盤 y ≈ 20.4）
 * - x ≤ 22：溝槽淡出成平順的甲板；−20 附近最寬處 39.5 是後輪前的側箱隆起
 * - 數值為本專案自訂（推估），依據：DESIGN.md 外框限制、iter-38 底盤高度掃描（前段 x ≥ 52 底盤 ≤ 9.6、x 36–44 中央 ≤ 21）
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = [
  // 鼻尖收窄成尖楔（半寬 12），翼艙前端在 x ≈ 66 後退，露出鼻下黑色分流尖牙
  [72, [[0, 16.2], [1.5, 16.0], [3, 15.6], [4.5, 15.4], [6, 15.4], [7.5, 15.3], [9, 15.1], [9, 14.8]]],
  [66, [[0, 18.2], [3.5, 17.8], [5.5, 16.6], [9, 16.3], [11.5, 16.9], [14, 17.0], [16.5, 16.2], [16.5, 15.0]]],
  [60, [[0, 20.2], [4.5, 19.8], [7.5, 17.6], [13, 17.5], [17.5, 22.6], [25, 22.6], [29, 19.0], [29, 15.0]]],
  [56, [[0, 21.4], [5, 21.0], [8, 18.4], [15, 18.4], [20.5, 26.6], [31, 26.6], [35, 22.0], [35, 15.0]]],
  [50, [[0, 23.4], [5.5, 23.0], [9, 20.8], [16, 20.8], [21.5, 29.8], [32, 30.0], [37, 26.0], [37, 13.0]]],
  [44, [[0, 25.0], [6, 24.6], [9.5, 23.4], [16.5, 23.6], [22, 31.6], [33, 32.0], [39, 29.5], [39, 10.5]]],
  [40, [[0, 25.6], [6, 25.3], [10, 24.8], [17, 25.0], [22.5, 32.0], [33, 32.4], [39, 29.4], [39, 10.0]]],
  [32, [[0, 26.8], [6, 26.6], [10, 26.5], [17, 26.9], [22.5, 31.2], [32, 31.4], [39, 28.2], [39, 8.0]]],
  [22, [[0, 28.0], [6, 27.9], [10, 28.3], [17, 28.8], [22.5, 30.4], [31, 30.6], [38, 27.8], [38, 7.0]]],
  [10, [[0, 29.0], [6, 29.0], [10, 29.3], [17, 29.8], [22.5, 30.6], [31, 30.9], [38, 27.6], [38, 7.0]]],
  [-4, [[0, 29.6], [6, 29.6], [10, 29.9], [17, 30.3], [22.5, 30.8], [31, 31.1], [38.5, 28.0], [38.5, 7.0]]],
  // x ≤ −20：座艙後方的中央脊（z 0–3）與兩側後翼艙（z 22–30）隆起，中間是兩道淺溝 → 後段也是三條量體
  [-20, [[0, 31.4], [3, 31.0], [10, 30.0], [17, 30.4], [22.5, 31.4], [31, 31.8], [39.5, 28.8], [39.5, 7.0]]],
  [-30, [[0, 32.6], [3, 32.2], [10, 30.3], [17, 30.6], [22.5, 32.0], [30, 32.6], [39, 28.8], [39, 8.0]]],
  [-40, [[0, 33.2], [3, 32.8], [10, 30.6], [17, 30.9], [22.5, 32.6], [30, 33.2], [39.5, 29.9], [39.5, 10.0]]],
  [-50, [[0, 33.6], [3, 33.2], [10, 31.0], [17, 31.2], [22.5, 33.0], [29, 33.6], [38, 29.6], [38, 17.0]]],
  [-58, [[0, 33.8], [3, 33.4], [10, 31.4], [17, 31.6], [22, 33.2], [27, 33.8], [35, 29.4], [35, 18.0]]],
  [-64, [[0, 34.2], [3, 33.8], [10, 32.6], [17, 32.8], [21, 33.6], [25, 34.2], [32, 30.5], [32, 24.0]]],
].map(([x, pts]) => ({ x, pts }));

/**
 * 側面層疊進氣口（側視凸多邊形，往後上方斜拉）＋鼻部、後甲板凹陷（沿用設計資料的後甲板散熱槽）
 * @type {any[]}
 */
const RECESSES = [
  { id: '側面進氣口（下層）', view: 'side', shape: 'poly', pts: [[22, 11], [10, 20], [-8, 20], [4, 11]], depth: 3.0 },
  { id: '側面進氣口（上層）', view: 'side', shape: 'poly', pts: [[13, 21.5], [7, 24.6], [-9, 24.6], [-3, 21.5]], depth: 2.0 },
  // iter-40：鼻部溝槽內的梯形進氣口（真的內凹 2.5 mm）
  { id: '鼻部進氣口 ×2', view: 'top', shape: 'poly', pts: [[66, 5.2], [66, 9.4], [57, 15.2], [57, 6.8]], depth: 2.5 },
  ...data.recesses.filter((r) => r.shape === 'slots'),
];

/** @type {any} 本款放樣資料：剖面由 STATIONS 決定；輪拱、卡座、壁厚沿用設計資料；座艙改成本檔的多面折角罩 */
const WEDGE_DATA = { ...data, canopy: null, openings: [], recesses: RECESSES };

/**
 * 石墨黑下半車身的分色線：前輪拱後方 y 10，往後上方斜拉到後輪拱前約 y 18；鼻部側面與尾段往上收
 * @type {(x: number) => number}
 */
const lowerLine = (x) => 10 + 8 * smoothstep(0, -36, x) + 4.5 * smoothstep(28, 60, x) + 7 * smoothstep(-42, -62, x);

/**
 * 座艙站位（多面折角罩）：底半寬 b、中段折線半寬 m、平頂半寬 r、平頂高出中線甲板 rise
 * @type {{ x: number, b: number, m: number, r: number, rise: number, mid: number }[]}
 */
const CANOPY = [
  { x: 25, b: 2.4, m: 1.6, r: 0.6, rise: 0.6, mid: 0.4 },
  { x: 16, b: 11.5, m: 9.8, r: 4.8, rise: 3.8, mid: 0.55 },
  { x: 4, b: 13, m: 11.2, r: 6.4, rise: 6.2, mid: 0.6 },
  { x: -8, b: 12, m: 10.2, r: 5.8, rise: 5.2, mid: 0.6 },
  { x: -17, b: 4.6, m: 3.6, r: 1.6, rise: 1.0, mid: 0.5 },
];

/**
 * 細長方條（窗框條）：從 p 到 q，斷面 w × h
 * @type {(p: number[], q: number[], w: number, h: number) => THREE.BufferGeometry}
 */
const barBetween = (p, q, w, h) => {
  const a = new THREE.Vector3(...p);
  const b = new THREE.Vector3(...q);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.BoxGeometry(w, h, len + w * 0.6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
};

/**
 * 多面折角座艙罩（iter-40）：煙燻茶色透明 PC 切面＋沿每條稜線的黑色窗框條。
 * 每個四邊形折面用同一個法線（兩個三角形共平面著色），面內反光平整。
 * @type {(surf: any) => { glass: THREE.BufferGeometry, frame: THREE.BufferGeometry, halfWAt: (x: number) => number }}
 */
const buildGemCanopy = (surf) => {
  /** @type {number[][][]} 每站 6 點（左 b、左 m、左 r、右 r、右 m、右 b） */
  const rings = CANOPY.map((c) => {
    const roof = surf.topY(c.x, 0) - 0.1 + c.rise;
    const yb = (z) => surf.topY(c.x, z) - 0.15;
    const ym = (z) => lerp(yb(z), roof, c.mid);
    return [
      [c.x, yb(c.b), -c.b],
      [c.x, ym(c.m), -c.m],
      [c.x, roof, -c.r],
      [c.x, roof, c.r],
      [c.x, ym(c.m), c.m],
      [c.x, yb(c.b), c.b],
    ];
  });
  /** @type {number[]} */
  const pos = [];
  /** @type {number[]} */
  const nrm = [];
  const v = (p) => new THREE.Vector3(...p);
  /** @type {(quad: number[][]) => void} 四邊形折面（兩三角形共用面法線，朝外） */
  const pushQuad = (quad) => {
    const [p0, p1, p2, p3] = quad.map(v);
    const n = p2.clone().sub(p0).cross(p3.clone().sub(p1)).normalize();
    const c = p0.clone().add(p1).add(p2).add(p3).multiplyScalar(0.25);
    const hint = new THREE.Vector3(0, 1, Math.sign(c.z) * 0.6);
    let order = [p0, p1, p2, p0, p2, p3];
    if (n.dot(hint) < 0) {
      n.negate();
    }
    const tn = p1.clone().sub(p0).cross(p2.clone().sub(p0));
    if (tn.dot(n) < 0) {
      order = [p0, p2, p1, p0, p3, p2];
    }
    for (const q of order) {
      pos.push(q.x, q.y, q.z);
      nrm.push(n.x, n.y, n.z);
    }
  };
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    for (let k = 0; k < 5; k++) {
      pushQuad([a[k], a[k + 1], b[k + 1], b[k]]);
    }
  }
  // 前後端的小封面（同一平面，共用面法線）
  for (const [ring, sign] of [
    [rings[0], 1],
    [rings[rings.length - 1], -1],
  ]) {
    for (let k = 1; k < 5; k++) {
      const tri = sign > 0 ? [ring[0], ring[k + 1], ring[k]] : [ring[0], ring[k], ring[k + 1]];
      for (const q of tri) {
        pos.push(...q);
        nrm.push(sign, 0, 0);
      }
    }
  }
  const glass = new THREE.BufferGeometry();
  glass.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  glass.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  // 窗框條（iter-42）：只保留貼殼面的外圍一圈＋前後各一對柱（A 柱 / C 柱），線寬約 0.28 mm；其餘折面交界不畫線，稜線靠反光表現
  const bars = [];
  const last = rings.length - 1;
  for (let i = 0; i < last; i++) {
    bars.push(barBetween(rings[i][0], rings[i + 1][0], 0.3, 0.2));
    bars.push(barBetween(rings[i][5], rings[i + 1][5], 0.3, 0.2));
  }
  // 前後端：沿罩子端緣把外圍框接起來
  for (const i of [0, last]) {
    for (let k = 0; k < 5; k++) {
      bars.push(barBetween(rings[i][k], rings[i][k + 1], 0.28, 0.18));
    }
  }
  // A 柱（x ≈ 16）與 C 柱（x ≈ −8）：左右各一根，從殼面沿斜窗折線爬到平頂邊
  for (const i of [1, 3]) {
    for (const [a, b, c] of [
      [0, 1, 2],
      [5, 4, 3],
    ]) {
      bars.push(barBetween(rings[i][a], rings[i][b], 0.28, 0.18));
      bars.push(barBetween(rings[i][b], rings[i][c], 0.28, 0.18));
    }
  }
  const xs = CANOPY.map((c) => c.x);
  return {
    glass,
    frame: mergeGeos(bars),
    halfWAt: (x) => {
      if (x > xs[0] || x < xs[xs.length - 1]) {
        return 0;
      }
      let i = 0;
      while (x < xs[i + 1]) {
        i++;
      }
      return lerp(CANOPY[i].b, CANOPY[i + 1].b, (xs[i] - x) / (xs[i] - xs[i + 1]));
    },
  };
};

/**
 * 座艙內裝（iter-41）：深色內襯桶＋後傾椅背、簡化的駕駛人剪影（頭盔、肩部、軀幹），透過煙燻罩看得到
 * @type {(surf: any) => { tub: THREE.BufferGeometry, driver: THREE.BufferGeometry }}
 */
const buildCockpit = (surf) => {
  const deck = (x) => surf.topY(x, 0) - 0.1;
  /** @type {THREE.BufferGeometry[]} 深色內襯桶與座椅 */
  const tub = [];
  /** @type {THREE.BufferGeometry[]} 駕駛人剪影 */
  const driver = [];
  // 內襯桶：沿座艙底的低矮圓角槽（用壓扁的膠囊，避免方塊感）
  const liner = new THREE.CapsuleGeometry(4.2, 22, 6, 16);
  liner.rotateZ(Math.PI / 2);
  liner.scale(1, 0.32, 1.6);
  liner.translate(4, deck(4) - 0.6, 0);
  tub.push(liner);
  // 座椅：往後傾的椅背（扁膠囊）＋椅面
  const back = new THREE.CapsuleGeometry(2.6, 2.2, 4, 12);
  back.scale(0.35, 1, 1.1);
  back.rotateZ(0.55);
  back.translate(-8.2, deck(-8) + 1.6, 0);
  tub.push(back);
  // 駕駛人：頭盔（球＋深色護目鏡帶由材質區分不了，改用略扁的球）、肩部（橫向膠囊）、軀幹
  const d = deck(-4);
  const helmet = new THREE.SphereGeometry(1.75, 20, 14);
  helmet.scale(1.12, 1, 0.95);
  helmet.translate(-4.6, d + 3.0, 0);
  driver.push(helmet);
  const shoulders = new THREE.CapsuleGeometry(1.0, 4.2, 4, 12);
  shoulders.rotateX(Math.PI / 2);
  shoulders.translate(-6.2, d + 1.3, 0);
  driver.push(shoulders);
  const torso = new THREE.CapsuleGeometry(1.4, 4.5, 4, 12);
  torso.rotateZ(Math.PI / 2 - 0.35);
  torso.scale(1, 0.7, 1.4);
  torso.translate(-2.5, d + 0.6, 0);
  driver.push(torso);
  return { tub: mergeGeos(tub), driver: mergeGeos(driver) };
};

/** @type {(a: number, b: number, t: number) => number} */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 水平薄板（俯視多邊形 (x, z)，厚度往上）：鼻下多層分流尖牙
 * @type {(pts: number[][], y: number, thick: number) => THREE.BufferGeometry}
 */
const flatPlate = (pts, y, thick) => {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  // (x, −z, e) → 繞 x 軸轉 −90° → (x, e, z)
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
};

/**
 * 立板（側視多邊形 (x, y)，沿 z 給厚度）：尾鰭、擴散器鰭片
 * @type {(pts: number[][], zc: number, thick: number) => THREE.BufferGeometry}
 */
const buildFin = (pts, zc, thick) => {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 1 });
  g.translate(0, 0, zc - thick / 2);
  return g;
};

/**
 * 盒子（尾燈燈殼、號碼牌槽）
 * @type {(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => THREE.BufferGeometry}
 */
const buildBox = (x0, x1, y0, y1, z0, z1) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
};

/** @type {() => Record<string, THREE.Material>} */
const makeMaterials = () => ({
  paint: namedMaterial('paint-signal-orange', { color: 0xff6a13, roughness: 0.22, metalness: 0.0, clearcoat: 0.9, clearcoatRoughness: 0.06 }),
  paint2: namedMaterial('paint-signal-orange', { color: 0xff6a13, roughness: 0.22, metalness: 0.0, clearcoat: 0.9, clearcoatRoughness: 0.06, side: THREE.DoubleSide }),
  lower: namedMaterial('paint-graphite-black', { color: 0x2b2d30, roughness: 0.6, metalness: 0.0 }),
  lower2: namedMaterial('paint-graphite-black', { color: 0x2b2d30, roughness: 0.55, side: THREE.DoubleSide }),
  edge: namedMaterial('shell-edge-orange', { color: 0xd9530a, roughness: 0.5, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x2a201c, roughness: 0.85, side: THREE.BackSide }),
  recess: namedMaterial('trim-intake-black', { color: 0x0b0b0c, roughness: 0.9, side: THREE.DoubleSide }),
  frame: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.5, side: THREE.DoubleSide }),
  // iter-40：茶色煙燻透明 PC（看得到座艙內裝），窗框條黑色
  glass: namedMaterial('pc-smoke-tint', { color: 0x5a4230, roughness: 0.04, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.02, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
  canopyFrame: namedMaterial('trim-smoke-gray', { color: 0x2e3238, roughness: 0.35, clearcoat: 0.5 }),
  seat: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  tub: namedMaterial('cockpit-tub', { color: 0x141518, roughness: 0.8 }),
  recessWall: namedMaterial('trim-intake-wall', { color: 0x46494f, roughness: 0.7, side: THREE.DoubleSide }),
  cyan: decalMaterial('decal-cyan', { color: 0x22c3e6, roughness: 0.3, clearcoat: 0.6 }),
  black: decalMaterial('decal-black', { color: 0x111214, roughness: 0.55 }),
  lamp: decalMaterial('lamp-clear', { color: 0xe8f4ff, emissive: 0x9fc8ff, emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1.0 }),
  tail: decalMaterial('lamp-red', { color: 0xc4121c, emissive: 0x7a0008, emissiveIntensity: 0.4, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {() => BodyPart[]} */
const compose = () => {
  const surf = createPolySurface(STATIONS, { step: 0.5, tuck: 2.2 });
  const kit = makeLoftKit(WEDGE_DATA, { mode: 'linear', sideZMin: 30, surface: surf });
  /** @type {BodyPart[]} */
  const parts = [];
  const canopy = buildGemCanopy(surf);

  /** @type {KeepFn} 座艙底下（黑色座艙底） */
  const cab = (x, y, z) => canopy.halfWAt(x) - Math.abs(z) - 0.2;
  /** @type {KeepFn} 前段溝槽（溝底＋兩側內壁下半）塗石墨黑 */
  const chan = (x, y, z) => {
    if (x < 27) {
      return -1;
    }
    const p = surf.profileAt(x);
    const az = Math.abs(z);
    return Math.min(az - (p[1][0] + 0.4), p[4][0] - 1.2 - az, x - 27);
  };
  /** @type {KeepFn} 下半車身 */
  const low = (x, y) => lowerLine(x) - y;
  /** @type {KeepFn} 橘色區 = 非座艙、非溝槽、非下半車身 */
  const orange = (x, y, z, s) => Math.min(-cab(x, y, z, s), -chan(x, y, z, s), -low(x, y, z, s));
  /** @type {KeepFn} 黑色區 = 非座艙且（溝槽或下半車身） */
  const dark = (x, y, z, s) => Math.min(-cab(x, y, z, s), Math.max(chan(x, y, z, s), low(x, y, z, s)));

  // 外表面塗裝分區（互補，合起來就是整片外表面 → 都標 shell）
  parts.push({ geometry: kit.outer([orange]), mat: 'paint', shell: true, name: 'shell-main' });
  parts.push({ geometry: kit.outer([dark]), mat: 'lower', shell: true, name: 'shell-lower' });
  parts.push({ geometry: kit.outer([cab]), mat: 'frame', shell: true, name: 'shell-cockpit' });

  // 內面、厚度面、封口、凹陷
  const st = kit.structure();
  parts.push({ geometry: st.inner, mat: 'inner', name: 'shell-inner' });
  parts.push({ geometry: st.rim, mat: 'edge', name: 'shell-edge' });
  parts.push({ geometry: st.capFront, mat: 'lower', shell: true, name: 'cap-front' });
  parts.push({ geometry: st.capRear, mat: 'lower', shell: true, name: 'cap-rear' });
  parts.push({ geometry: mergeGeos([st.capFrontIn, st.capRearIn]), mat: 'inner', name: 'cap-inner' });
  st.recessFloor.forEach((g, i) => parts.push({ geometry: g, mat: 'recess', shell: true, name: `recess-floor-${i}` }));
  // 凹腔側壁用較亮的深灰，腔底近黑 → 看得出深度與陰影（iter-40）
  st.recessWall.forEach((g, i) => parts.push({ geometry: g, mat: 'recessWall', shell: true, name: `recess-wall-${i}` }));

  // 側面進氣口的石墨黑唇邊（0.9 mm 寬、凸出 0.3 mm）
  const lips = [];
  const lipWalls = [];
  for (const r of RECESSES.filter((q) => q.shape === 'poly')) {
    const sd = featureSd(r, 30);
    const lip = buildRegion(surf, [...kit.holes, (x, y, z) => sd(x, y, z), (x, y, z) => 0.9 - sd(x, y, z)], { offset: 0.3, smoothOffset: true });
    lips.push(lip.geometry);
    lipWalls.push(buildRim(lip, 0, 0.3));
  }
  parts.push({ geometry: mergeGeos(lips), mat: 'lower', name: 'intake-lip' });
  parts.push({ geometry: mergeGeos(lipWalls), mat: 'lower2', name: 'intake-lip-wall' });

  // 多面折角座艙罩
  parts.push({ geometry: canopy.frame, mat: 'canopyFrame', name: 'canopy-frame' });
  parts.push({ geometry: canopy.glass, mat: 'glass', shell: true, renderOrder: 2, name: 'canopy-glass' });
  const cockpit = buildCockpit(surf);
  parts.push({ geometry: cockpit.tub, mat: 'tub', name: 'cockpit-tub' });
  parts.push({ geometry: cockpit.driver, mat: 'seat', name: 'cockpit-driver' });

  // 鼻部進氣口內的直立導流片（分層感）
  const noseSlats = [];
  for (const sg of [-1, 1]) {
    for (const zc of [8.8, 11.6]) {
      const x0 = 57.8;
      const x1 = 65.2;
      const top = (x) => surf.topY(x, zc) - 0.2;
      noseSlats.push(
        buildFin(
          [
            [x0, top(x0) - 2.3],
            [x1, top(x1) - 2.3],
            [x1, top(x1)],
            [x0, top(x0)],
          ],
          sg * zc,
          0.45,
        ),
      );
    }
  }
  parts.push({ geometry: mergeGeos(noseSlats), mat: 'lower2', name: 'nose-intake-slats' });

  // ---- 貼紙（不標 shell） ----
  // 青藍細線：翼艙內稜（溝槽外緣）＋側面分色線上方
  const podEdge = (x, y, z) => {
    if (x < 28 || x > 64) {
      return -1;
    }
    const p = surf.profileAt(x);
    const az = Math.abs(z);
    return Math.min(az - (p[4][0] + 0.3), p[4][0] + 1.3 - az);
  };
  const sill = (x, y, z) => Math.min(Math.abs(z) - 30, y - (lowerLine(x) + 0.5), lowerLine(x) + 1.5 - y, x + 26, 25 - x);
  parts.push({ geometry: mergeGeos([kit.decal(podEdge), kit.decal(sill)]), mat: 'cyan', name: 'decal-cyan' });

  // 號碼 07：中央尖鼻頂面、兩側側箱
  parts.push({
    geometry: mergeGeos([
      kit.decal(topDecal(sdNumber('07', { h: 4.8, w: 2.7, gap: 0.7 }), { x0: 55, yMin: 18 })),
      kit.decal(sideDecal(sdNumber('07', { h: 6.2, w: 3.6, gap: 0.9 }), { x0: -16.5, y0: 21.4, zMin: 30 })),
    ]),
    mat: 'black',
    name: 'decal-number',
  });

  // 頭燈：翼艙前端斜面上的細長燈
  const head = sdConvexPolygon([
    [65, 18.5],
    [62.6, 18.5],
    [57.5, 27.5],
    [59.6, 27.5],
  ]);
  parts.push({ geometry: kit.decal((x, y, z) => -head(x, Math.abs(z)), { offset: 0.08 }), mat: 'lamp', name: 'lamp-head' });

  // 鼻下黑色多層分流尖牙（兩層薄板，往前尖出；薄板兩面面積會讓質量灌水，不標 shell，實際約 0.4 g）
  const fangs = [];
  for (const sg of [-1, 1]) {
    // 上層：翼艙前端下方往前尖出的三角刀片
    fangs.push(
      flatPlate(
        [
          [56, sg * 16],
          [72, sg * 21],
          [71.2, sg * 24],
          [56, sg * 32],
        ],
        13.4,
        0.8,
      ),
    );
    // 下層：更寬、往前下方的第二片
    fangs.push(
      flatPlate(
        [
          [58, sg * 12],
          [70.8, sg * 26],
          [69.6, sg * 29.5],
          [58, sg * 31.5],
        ],
        11.9,
        0.7,
      ),
    );
  }
  // 中央尖鼻下的尖牙
  fangs.push(
    flatPlate(
      [
        [60, -7],
        [72, -1],
        [72, 1],
        [60, 7],
      ],
      13.0,
      0.8,
    ),
  );
  // 連接兩層的直立導流片
  for (const zc of [-27, -20, -13, 13, 20, 27]) {
    fangs.push(
      buildFin(
        [
          [59, 11.9],
          [69.6, 11.9],
          [69.6, 12.6],
          [59, 14.2],
        ],
        zc,
        0.6,
      ),
    );
  }
  parts.push({ geometry: mergeGeos(fangs), mat: 'lower2', name: 'nose-splitters' });

  // 尾部：兩片翹起的尾鰭＋鴨尾翼片（橘色薄板，標 shell）
  const tailFins = [];
  for (const sg of [-1, 1]) {
    tailFins.push(
      buildFin(
        [
          [-42, 31.0],
          [-64.5, 32.4],
          [-65.8, 39.2],
          [-61, 39.2],
          [-52, 34.6],
        ],
        sg * 26.5,
        1.1,
      ),
    );
  }
  parts.push({ geometry: mergeGeos(tailFins), mat: 'paint2', shell: true, name: 'tail-fins' });
  const spoiler = buildFin(
    [
      [-57.5, 37.0],
      [-65.8, 38.1],
      [-65.8, 39.0],
      [-57.5, 37.9],
    ],
    0,
    52,
  );
  parts.push({ geometry: spoiler, mat: 'lower2', name: 'tail-spoiler' });

  // 尾板：黑色燈殼＋紅色細長燈條、中央號碼牌槽、擴散器鰭片
  const xr = surf.xMin;
  const housings = [];
  const lamps = [];
  for (const sgn of [-1, 1]) {
    housings.push(buildBox(xr - 0.6, xr + 0.2, 28.4, 31.0, sgn > 0 ? 13.5 : -27.5, sgn > 0 ? 27.5 : -13.5));
    lamps.push(buildBox(xr - 0.75, xr - 0.5, 29.0, 30.4, sgn > 0 ? 14.3 : -26.7, sgn > 0 ? 26.7 : -14.3));
  }
  housings.push(buildBox(xr - 0.3, xr + 0.2, 25.0, 28.4, -6.5, 6.5));
  parts.push({ geometry: mergeGeos(housings), mat: 'lower2', name: 'tail-housing' });
  parts.push({ geometry: mergeGeos(lamps), mat: 'tail', name: 'lamp-tail' });
  const diff = [-19, -12, -5, 5, 12, 19].map((zc) =>
    buildFin(
      [
        [xr - 0.4, 18.6],
        [xr + 6.5, 18.6],
        [xr + 6.5, 23],
        [xr - 0.4, 24.4],
      ],
      zc,
      0.8,
    ),
  );
  diff.push(buildBox(xr - 0.4, xr + 6.5, 18.2, 18.8, -21, 21));
  parts.push({ geometry: mergeGeos(diff), mat: 'lower2', name: 'rear-diffuser' });

  // 卡座吊耳
  parts.push({ geometry: buildMountTabs(MOUNTS, (x) => kit.innerYAt(x)), mat: 'mount', name: 'mount-tabs' });
  return parts;
};

/** @type {{ id: string, x: number, y: number, z: number }[]} */
const MOUNTS = getPart('chassis-midship').bodyMounts.map((m) => ({ ...m }));

/** @type {BodyDef} */
export const wedgeBody = {
  id: 'body-wedge',
  category: 'body',
  name: '楔形競速款',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: WEDGE_DATA.wallThickness_mm,
  mounts: MOUNTS.map((m) => ({ ...m })),
  build: cachedBuild(compose, makeMaterials),
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: 'shared/design/body-wedge/DESIGN.md §5：射出 ABS 殼常見 0.8–1.2 mm，取 0.9（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
    geometry: 'iter-38：本檔 STATIONS 多點折線剖面（推估，依 DESIGN.md 外框限制與底盤高度掃描）；輪拱、卡座、壁厚沿用 data/body-wedge.json',
    fragments: '黑色分流尖牙、擴散器、鴨尾翼片為薄板，不計入殼面積質量（合計約 0.6 g，推估）',
  },
};
