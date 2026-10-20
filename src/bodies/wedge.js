// 楔形競速款（body-wedge）：低鼻、折線稜角、一路往後拉高的楔形車身，凹陷式進氣口 + 鴨尾，信號橘 ABS
// 設計：shared/design/body-wedge/DESIGN.md；尺寸資料：data/body-wedge.json（複製自 shared/design/body-wedge/sections.json）
// 塗裝全為自創：號碼「07」、青藍細線、石墨黑下緣與斜切色塊；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import data from './data/body-wedge.json';
import { getPart } from '../parts/index.js';
import { makeLoftKit, cachedBuild, namedMaterial, decalMaterial, buildMountTabs, buildRegion, buildSplitter, surfaceTopY, sdNumber, sdConvexPolygon, sideDecal, topDecal, mergeGeos, smoothstep } from './loft.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {(x: number) => number} 石墨黑下半車身的分色線（iter-34 拉高到側面約一半；往前升、鼻部側面全黑；尾段往上收） */
const lowerLine = (x) => 15.2 + 0.05 * x + 7 * smoothstep(-42, -62, x);

/**
 * iter-35 站位表（以 DESIGN.md §3.2 為底修改；reviewer：側視要是「從鼻尖一路往後拉高」的單一斜線，不要馬鞍形）
 * - 中線頂 yTop、肩稜 yF 從前到後單調上升；iter-36 中線再壓低，比肩稜低約 3 mm → 明顯的谷形引擎蓋與肩稜折線
 * - 最寬處 yShoulder 在前輪拱處 ≥ 28.6（蓋住 R15 輪拱頂 28），中段不再下凹
 * - 鼻尖、半寬、下緣與原設計相同
 * @type {{ x: number, yTop: number, zF: number, yF: number, halfW: number, yShoulder: number, yLow: number }[]}
 */
const STATIONS = [
  [72, 16, 12, 16, 20, 15.5, 15],
  [66, 17.2, 20, 18.5, 30, 16.8, 15],
  [58, 19.8, 24, 23, 34, 20.5, 15],
  [50, 22.6, 28, 27.3, 37, 25.5, 13],
  [40, 25, 30, 30, 39, 29, 10],
  [30, 27, 30, 30.3, 39, 28, 8],
  [15, 28, 30, 30.7, 38, 27.3, 7],
  [0, 28.2, 30, 31, 37.5, 27.3, 7],
  [-15, 28.6, 30, 31.3, 38, 27.6, 7],
  [-30, 29, 30, 31.6, 39, 28.3, 8],
  [-40, 29.4, 30, 31.9, 39.5, 29.6, 10],
  [-50, 29.8, 29, 32.1, 38, 29.4, 17],
  [-58, 30.4, 27, 32.3, 35, 29.2, 18],
  [-64, 32.4, 25, 32.9, 32, 29.6, 24],
].map(([x, yTop, zF, yF, halfW, yShoulder, yLow]) => ({ x, yTop, zF, yF, halfW, yShoulder, yLow }));

/** @type {any} 本款實際放樣用的資料（站位表換成 iter-35 版本，其餘沿用設計資料） */
const WEDGE_DATA = { ...data, stationParams: STATIONS };

/**
 * 前葉子板小隆起：只補輪拱前緣（x ≈ 45）肩部高度，避免上視缺口
 * @type {(x: number, az: number) => number}
 */
const bump = (x, az) => smoothstep(14, 28, az) * 0.9 * Math.exp(-(((x - 45) / 8) ** 2));

/**
 * 鼻部進氣口裡的直立導流片（沿 x，貼著殼面往下到凹陷底）：做出概念圖的分層進氣口
 * @type {(surf: any, z: number, x0: number, x1: number, depth: number) => THREE.BufferGeometry}
 */
const buildSlat = (surf, z, x0, x1, depth) => {
  const pos = [];
  const n = 12;
  const hz = 0.3;
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const yt = surfaceTopY(surf, x, Math.abs(z)) - 0.15;
    ring.push([x, yt, yt - depth + 0.2]);
  }
  for (let i = 0; i < n; i++) {
    const [xa, ta, ba] = ring[i];
    const [xb, tb, bb] = ring[i + 1];
    for (const dz of [-hz, hz]) {
      pos.push(xa, ta, z + dz, xb, tb, z + dz, xb, bb, z + dz, xa, ta, z + dz, xb, bb, z + dz, xa, ba, z + dz);
    }
    pos.push(xa, ta, z - hz, xb, tb, z - hz, xb, tb, z + hz, xa, ta, z - hz, xb, tb, z + hz, xa, ta, z + hz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 立板（x–y 平面的多邊形，沿 z 給厚度）：鼻部下唇導流片、尾部擴散器鰭片
 * @type {(pts: number[][], zc: number, thick: number) => THREE.BufferGeometry}
 */
const buildFin = (pts, zc, thick) => {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
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
  paint: namedMaterial('paint-signal-orange', { color: 0xff6a13, roughness: 0.25, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
  lower: namedMaterial('paint-graphite-black', { color: 0x2b2d30, roughness: 0.7, metalness: 0.0 }),
  edge: namedMaterial('shell-edge-orange', { color: 0xd9530a, roughness: 0.5, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x2a201c, roughness: 0.85, side: THREE.BackSide }),
  recess: namedMaterial('trim-intake-black', { color: 0x141516, roughness: 0.85, side: THREE.DoubleSide }),
  lower2: namedMaterial('paint-graphite-black', { color: 0x2b2d30, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1e2833, roughness: 0.06, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05, transparent: true, opacity: 0.8, depthWrite: false }),
  cyan: decalMaterial('decal-cyan', { color: 0x22c3e6, roughness: 0.3, clearcoat: 0.6 }),
  black: decalMaterial('decal-black', { color: 0x111214, roughness: 0.55 }),
  graphite: decalMaterial('decal-graphite', { color: 0x2b2d30, roughness: 0.6 }),
  lamp: decalMaterial('lamp-clear', { color: 0xe8f4ff, emissive: 0x9fc8ff, emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1.0 }),
  tail: decalMaterial('lamp-red', { color: 0xc4121c, emissive: 0x7a0008, emissiveIntensity: 0.4, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {() => BodyPart[]} */
const compose = () => {
  const kit = makeLoftKit(WEDGE_DATA, { mode: 'linear', sideZMin: 30, bump, tuck: 2.2, xSmooth: true });
  const { surf } = kit;
  /** @type {BodyPart[]} */
  const parts = [];
  /** @type {import('./loft.js').KeepFn} 座艙底下 */
  const cab = (x, y, z) => kit.underCanopy(x, z);
  /** @type {import('./loft.js').KeepFn} 不在座艙底下 */
  const notCab = (x, y, z) => -kit.underCanopy(x, z);
  /** @type {import('./loft.js').KeepFn} 下緣黑色區 */
  const low = (x, y) => lowerLine(x) - y;
  /** @type {import('./loft.js').KeepFn} */
  const notLow = (x, y) => y - lowerLine(x);

  // 外表面塗裝分區（三區互補，合起來就是整片外表面 → 都標 shell）
  parts.push({ geometry: kit.outer([notCab, notLow]), mat: 'paint', shell: true, name: 'shell-main' });
  parts.push({ geometry: kit.outer([notCab, low]), mat: 'lower', shell: true, name: 'shell-lower' });
  parts.push({ geometry: kit.outer([cab]), mat: 'cockpit', shell: true, name: 'shell-cockpit' });

  // 內面、厚度面、封口、凹陷
  const st = kit.structure();
  parts.push({ geometry: st.inner, mat: 'inner', name: 'shell-inner' });
  parts.push({ geometry: st.rim, mat: 'edge', name: 'shell-edge' });
  parts.push({ geometry: st.capFront, mat: 'lower', shell: true, name: 'cap-front' });
  parts.push({ geometry: st.capRear, mat: 'paint', shell: true, name: 'cap-rear' });
  parts.push({ geometry: mergeGeos([st.capFrontIn, st.capRearIn]), mat: 'inner', name: 'cap-inner' });
  st.recessFloor.forEach((g, i) => parts.push({ geometry: g, mat: 'recess', shell: true, name: `recess-floor-${i}` }));
  st.recessWall.forEach((g, i) => parts.push({ geometry: g, mat: 'recess', shell: true, name: `recess-wall-${i}` }));

  // 座艙罩：中間煙燻玻璃、周圍黑框
  const glass = buildRegion(kit.canopy, [(x, y, z, s) => 0.84 - Math.abs(s)]).geometry;
  const frame = buildRegion(kit.canopy, [(x, y, z, s) => Math.abs(s) - 0.84]).geometry;
  parts.push({ geometry: frame, mat: 'lower', shell: true, name: 'canopy-frame' });
  parts.push({ geometry: glass, mat: 'glass', shell: true, renderOrder: 2, name: 'canopy-glass' });

  // ---- 貼紙（不標 shell） ----
  // 青藍細線：沿肩稜內側，從鼻部到後輪拱前
  const crease = (x, y, z) => {
    const c = surf.ctrl(x);
    const az = Math.abs(z);
    return Math.min(az - (c.zF - 1.7), c.zF - 0.5 - az, x + 34, 64 - x);
  };
  // 青藍細線：沿黑色下緣上方（兩輪拱之間）
  const sill = (x, y, z) => Math.min(Math.abs(z) - 30, y - (lowerLine(x) + 0.5), lowerLine(x) + 1.5 - y, x + 27, 24 - x);
  parts.push({ geometry: mergeGeos([kit.decal(crease), kit.decal(sill)]), mat: 'cyan', name: 'decal-cyan' });
  // iter-36：肩稜外側 1.6 mm 的石墨黑細窄斜面，讓折線與谷形引擎蓋在平光下也讀得出來
  const bevel = (x, y, z) => {
    const c = surf.ctrl(x);
    const az = Math.abs(z);
    return Math.min(az - (c.zF + 0.15), c.zF + 1.75 - az, x + 60, 66 - x);
  };
  parts.push({ geometry: kit.decal(bevel), mat: 'graphite', name: 'decal-crease-bevel' });

  // 號碼 07：兩側車門、引擎蓋
  const num = sdNumber('07', { h: 5.8, w: 3.5, gap: 0.9 });
  const hoodNum = sdNumber('07', { h: 6.2, w: 3.4, gap: 0.9 });
  parts.push({
    geometry: mergeGeos([kit.decal(sideDecal(num, { x0: -15.5, y0: 19.6, zMin: 30 })), kit.decal(topDecal(hoodNum, { x0: 46.5, yMin: 20 }))]),
    mat: 'black',
    name: 'decal-number',
  });

  // 石墨黑斜切色塊：後葉子板前方肩部（俯視多邊形）
  const slash = sdConvexPolygon([
    [-18, 30.2],
    [-25, 30.2],
    [-33, 38.5],
    [-26, 38.5],
  ]);
  parts.push({
    geometry: kit.decal((x, y, z) => -slash(x, Math.abs(z))),
    mat: 'graphite',
    name: 'decal-graphite',
  });

  // 頭燈：鼻部肩斜面上的斜切細燈
  const head = sdConvexPolygon([
    [66.5, 22.6],
    [64.2, 22.6],
    [59.2, 31.5],
    [61.2, 31.5],
  ]);
  parts.push({ geometry: kit.decal((x, y, z) => -head(x, Math.abs(z)), { offset: 0.08 }), mat: 'lamp', name: 'lamp-head' });

  // 尾部（iter-36）：黑色燈殼＋紅色細長燈條、中央號碼牌凹槽、尾板下方擴散器鰭片
  const xr = surf.xMin;
  const housings = [];
  const lamps = [];
  for (const sgn of [-1, 1]) {
    housings.push(buildBox(xr - 0.6, xr + 0.2, 27.0, 29.6, sgn > 0 ? 13.5 : -27.5, sgn > 0 ? 27.5 : -13.5));
    lamps.push(buildBox(xr - 0.75, xr - 0.5, 27.6, 29.0, sgn > 0 ? 14.3 : -26.7, sgn > 0 ? 26.7 : -14.3));
  }
  housings.push(buildBox(xr - 0.3, xr + 0.2, 25.0, 28.6, -6.5, 6.5));
  parts.push({ geometry: mergeGeos(housings), mat: 'lower', name: 'tail-housing' });
  parts.push({ geometry: mergeGeos(lamps), mat: 'tail', name: 'lamp-tail' });
  const fins = [-19, -12, -5, 5, 12, 19].map((zc) =>
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
  fins.push(buildBox(xr - 0.4, xr + 6.5, 18.2, 18.8, -21, 21));
  parts.push({ geometry: mergeGeos(fins), mat: 'lower2', name: 'rear-diffuser' });

  // 卡座吊耳
  // 鼻部分層進氣口與尖牙（iter-35）：進氣口內 2 片導流片、鼻下 4 根尖牙、一層石墨黑下唇
  const slats = [];
  for (const sg of [-1, 1]) {
    for (const zc of [12.7, 17.3]) {
      slats.push(buildSlat(surf, sg * zc, 56.8, 63.6, 2.0));
    }
  }
  parts.push({ geometry: mergeGeos(slats), mat: 'lower2', name: 'nose-slats' });
  // iter-36：鼻下改成兩層石墨黑下唇＋直立導流片（取代 iter-35 的橘色尖牙）
  parts.push({
    geometry: mergeGeos([
      buildSplitter({ x: [60, 72.6], halfW: 23, yBottom: 13.9, thickness: 0.8 }),
      buildSplitter({ x: [62, 73.6], halfW: 19, yBottom: 12.2, thickness: 0.7 }),
    ]),
    mat: 'lower',
    shell: true,
    name: 'nose-lip',
  });
  const strakes = [-16, -8, 8, 16].map((zc) =>
    buildFin(
      [
        [63, 12.4],
        [73.2, 12.4],
        [72.4, 14.2],
        [63, 15.2],
      ],
      zc,
      0.7,
    ),
  );
  // 薄立板兩面面積 × 壁厚會把質量算成兩倍，鰭片類不標 shell（實際約 0.3 g，忽略）
  parts.push({ geometry: mergeGeos(strakes), mat: 'lower2', name: 'nose-strakes' });

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
    geometry: 'shared/design/body-wedge/sections.json（複製到 src/bodies/data/body-wedge.json）',
  },
};
