// 流線大尾翼款（body-aero-wing）：連續曲面水滴形車身 + 鵝頸支柱高位大尾翼 + 前下擾流板，珍珠白 / 深藏青
// 設計：shared/design/body-aero-wing/DESIGN.md；尺寸資料：data/body-aero-wing.json（複製自 shared/design/body-aero-wing/sections.json）
// 塗裝全為自創：號碼「88」、洋紅→紫漸層弧線、雙 V 形箭頭；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import data from './data/body-aero-wing.json';
import { getPart } from '../parts/index.js';
import { makeLoftKit, cachedBuild, namedMaterial, decalMaterial, buildMountTabs, buildRegion, buildWingParts, buildSplitter, sdNumber, sdConvexPolygon, sdBar, sideDecal, topDecal, mergeGeos, smoothstep } from './loft.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {(x: number) => number} 深藏青下半車身的分色線（鼻部與尾部往上收） */
const navyLine = (x) => 13 + 4.5 * smoothstep(40, 62, x) + 8 * smoothstep(-40, -56, x);

/** @type {THREE.Color} */
const MAGENTA = new THREE.Color(0xe6007e);
/** @type {THREE.Color} */
const PURPLE = new THREE.Color(0x6a2bd9);

/** @type {(x: number) => number[]} 漸層顏色（線性色彩空間）：前洋紅 → 後紫 */
const gradient = (x) => {
  const t = Math.min(1, Math.max(0, (24 - x) / 80));
  const c = MAGENTA.clone().lerp(PURPLE, t);
  return [c.r, c.g, c.b];
};

/** @type {() => Record<string, THREE.Material>} */
const makeMaterials = () => ({
  pearl: namedMaterial('paint-pearl-white', { color: 0xf2f0ec, roughness: 0.2, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05, sheen: 0.3, sheenColor: 0xd8d0ff, sheenRoughness: 0.4 }),
  navy: namedMaterial('paint-navy-metallic', { color: 0x1b2a5c, roughness: 0.3, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  navy2: namedMaterial('paint-navy-metallic', { color: 0x1b2a5c, roughness: 0.3, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  edge: namedMaterial('shell-edge-white', { color: 0xd9d6cf, roughness: 0.5, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x202227, roughness: 0.85, side: THREE.BackSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  glass: namedMaterial('pc-smoke-navy', { color: 0x101828, roughness: 0.04, clearcoat: 1.0, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
  grad: decalMaterial('decal-gradient-magenta-purple', { vertexColors: true, roughness: 0.3, clearcoat: 0.8 }),
  purple: decalMaterial('decal-purple', { color: 0x6a2bd9, roughness: 0.35, clearcoat: 0.6 }),
  magenta: decalMaterial('decal-magenta', { color: 0xe6007e, roughness: 0.35, clearcoat: 0.6 }),
  number: decalMaterial('decal-navy', { color: 0x1b2a5c, roughness: 0.5 }),
  lamp: decalMaterial('lamp-clear', { color: 0xe8f4ff, emissive: 0x9fc8ff, emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1.0 }),
  tail: decalMaterial('lamp-red', { color: 0xc4121c, emissive: 0x7a0008, emissiveIntensity: 0.4, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {() => BodyPart[]} */
const compose = () => {
  const kit = makeLoftKit(data, { mode: 'smooth', sideZMin: 28 });
  /** @type {BodyPart[]} */
  const parts = [];
  /** @type {KeepFn} */
  const cab = (x, y, z) => kit.underCanopy(x, z);
  /** @type {KeepFn} */
  const notCab = (x, y, z) => -kit.underCanopy(x, z);

  parts.push({ geometry: kit.outer([notCab, (x, y) => y - navyLine(x)]), mat: 'pearl', shell: true, name: 'shell-main' });
  parts.push({ geometry: kit.outer([notCab, (x, y) => navyLine(x) - y]), mat: 'navy', shell: true, name: 'shell-lower' });
  parts.push({ geometry: kit.outer([cab]), mat: 'cockpit', shell: true, name: 'shell-cockpit' });

  const st = kit.structure();
  parts.push({ geometry: st.inner, mat: 'inner', name: 'shell-inner' });
  parts.push({ geometry: st.rim, mat: 'edge', name: 'shell-edge' });
  parts.push({ geometry: mergeGeos([st.capFront, st.capRear]), mat: 'navy', shell: true, name: 'caps' });
  parts.push({ geometry: mergeGeos([st.capFrontIn, st.capRearIn]), mat: 'inner', name: 'cap-inner' });

  // 水滴座艙罩：深藍煙燻玻璃 + 珍珠白窗框
  parts.push({ geometry: buildRegion(kit.canopy, [(x, y, z, s) => Math.abs(s) - 0.86]).geometry, mat: 'pearl', shell: true, name: 'canopy-frame' });
  parts.push({ geometry: buildRegion(kit.canopy, [(x, y, z, s) => 0.86 - Math.abs(s)]).geometry, mat: 'glass', shell: true, renderOrder: 2, name: 'canopy-glass' });

  // 尾翼、端板、鵝頸支柱、splitter（實心件；質量以表面積 × 壁厚近似，標 shell）
  const w = buildWingParts(data.wing);
  parts.push({ geometry: w.wing, mat: 'pearl', shell: true, name: 'wing' });
  parts.push({ geometry: w.endplates, mat: 'navy2', shell: true, name: 'wing-endplates' });
  parts.push({ geometry: w.stays, mat: 'navy2', shell: true, name: 'wing-stays' });
  parts.push({ geometry: buildSplitter(data.splitter), mat: 'navy', shell: true, name: 'splitter' });

  // ---- 貼紙 ----
  // 洋紅 → 紫漸層弧線：前輪拱後方往後上掃到後葉子板，再沿後葉子板頂面往尾部
  /** @type {(x: number) => number} 弧線中心高度 */
  const yc = (x) => 16.2 + (6 - x) * 0.25;
  /** @type {(x: number) => number} 弧線寬度（往後漸寬） */
  const wd = (x) => 0.5 + (2.4 * (6 - x)) / 33;
  /** @type {KeepFn} */
  const swoosh = (x, y, z) => Math.min(Math.abs(z) - 26, wd(x) / 2 - Math.abs(y - yc(x)), x + 27, 6 - x);
  const fenderBar = sdBar(-27, 31.2, -55, 26.5, 1.8);
  parts.push({
    geometry: mergeGeos([kit.decal(swoosh, { color: gradient }), kit.decal((x, y, z) => (y < 22 ? -1 : -fenderBar(x, Math.abs(z))), { color: gradient })]),
    mat: 'grad',
    name: 'decal-swoosh',
  });

  // 雙 V 形箭頭（引擎蓋，尖端朝前）
  /** @type {(tip: number) => (u: number, v: number) => number} */
  const chevron = (tip) => {
    const a = sdBar(tip, 0, tip - 6.5, 8, 1.5);
    const b = sdBar(tip, 0, tip - 6.5, -8, 1.5);
    return (x, z) => Math.min(a(x, z), b(x, z));
  };
  const v1 = chevron(50.5);
  const v2 = chevron(46.5);
  parts.push({ geometry: kit.decal((x, y, z) => (y < 20 ? -1 : -v1(x, z))), mat: 'magenta', name: 'decal-chevron-1' });
  parts.push({ geometry: kit.decal((x, y, z) => (y < 20 ? -1 : -v2(x, z))), mat: 'purple', name: 'decal-chevron-2' });

  // 號碼 88：鼻部、兩側
  parts.push({
    geometry: mergeGeos([
      kit.decal(topDecal(sdNumber('88', { h: 5.4, w: 3.1, gap: 0.8 }), { x0: 56.8, yMin: 18 })),
      kit.decal(sideDecal(sdNumber('88', { h: 6.8, w: 3.9, gap: 1.0 }), { x0: 12.5, y0: 16.7, zMin: 30 })),
    ]),
    mat: 'number',
    name: 'decal-number',
  });

  // 頭燈（鼻部兩側斜切細燈）、尾燈（尾甲板末端）
  const head = sdConvexPolygon([
    [65.5, 15.5],
    [63, 15.5],
    [57.5, 27],
    [59.6, 27.5],
  ]);
  parts.push({ geometry: kit.decal((x, y, z) => -head(x, Math.abs(z)), { offset: 0.08 }), mat: 'lamp', name: 'lamp-head' });
  const tail = sdConvexPolygon([
    [-57.2, 11],
    [-59.6, 11],
    [-59.6, 22],
    [-57.2, 21],
  ]);
  parts.push({ geometry: kit.decal((x, y, z) => (y < 20 ? -1 : -tail(x, Math.abs(z))), { offset: 0.08 }), mat: 'tail', name: 'lamp-tail' });

  parts.push({ geometry: buildMountTabs(MOUNTS, (x) => kit.innerYAt(x)), mat: 'mount', name: 'mount-tabs' });
  return parts;
};

/** @type {{ id: string, x: number, y: number, z: number }[]} */
const MOUNTS = getPart('chassis-midship').bodyMounts.map((m) => ({ ...m }));

/** @type {BodyDef} */
export const aeroWingBody = {
  id: 'body-aero-wing',
  category: 'body',
  name: '流線大尾翼款',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: data.wallThickness_mm,
  mounts: MOUNTS.map((m) => ({ ...m })),
  build: cachedBuild(compose, makeMaterials),
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: 'shared/design/body-aero-wing/DESIGN.md §5：射出 ABS 殼常見 0.8–1.2 mm，取 0.8（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
    geometry: 'shared/design/body-aero-wing/sections.json（複製到 src/bodies/data/body-aero-wing.json）',
    wing: '尾翼 / 端板 / 支柱 / splitter 是實心件，質量以「表面積 × 殼壁厚 × 密度」近似（DESIGN.md §5 估實心體積約 2.6 g，表面積法約 2.5–3 g，量級一致）',
  },
};
