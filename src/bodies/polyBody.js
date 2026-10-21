// 多點折線剖面車殼的共用組裝流程（iter-46 起的新車殼用）：站位表 → 外殼塗裝分區、內面、厚度面、封口、凹陷、座艙、卡座吊耳
// 每款車殼只要提供站位表、輪拱、塗裝分區、材質與額外零件（鰭片、尾翼、貼紙），其餘交給這裡。
import * as THREE from 'three';
import { getPart } from '../parts/index.js';
import { makeLoftKit, createPolySurface, cachedBuild, buildRegion, buildMountTabs, mergeGeos } from './loft.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/**
 * @typedef {object} PolyBodyConfig
 * @property {string} id
 * @property {string} name
 * @property {'homage' | 'race'} style 致敬《爆走兄弟》風格 / 常見比賽車殼型式
 * @property {string} theme 一句話主題
 * @property {'ABS' | 'PC'} material
 * @property {number} density_g_cm3
 * @property {number} wallThickness_mm
 * @property {{ x: number, pts: number[][] }[]} stations 半剖面站位表（見 createPolySurface）
 * @property {number} [tuck] 側裙下緣內收量
 * @property {{ x: number, y: number, radius: number, cutZFrom: number }[]} wheelArches
 * @property {any[]} [openings]
 * @property {any[]} [recesses]
 * @property {any} [canopy] 座艙泡站位（同 sections.json 的 canopy 格式），null = 無
 * @property {number} [sideZMin] 側視開口 / 凹陷只作用在 |z| ≥ sideZMin
 * @property {(kit: any) => { mat: string, keep: KeepFn }[]} zones 外表面塗裝分區（依序取第一個符合的區）
 * @property {{ outer?: string, inner: string, edge: string, cap: string, recess?: string, recessWall?: string, glass?: string, cockpit?: string, mount: string }} mats 結構件用的材質鍵
 * @property {() => Record<string, THREE.Material>} materials
 * @property {(kit: any) => BodyPart[]} [extras] 鰭片、尾翼、貼紙、燈具等
 * @property {(kit: any) => (x: number) => number} [mountInnerY] 卡座吊耳頂端高度（預設 = 殼內面中線）
 * @property {Record<string, string>} src
 */

/** @type {{ id: string, x: number, y: number, z: number }[]} 底盤車殼安裝點（SPEC 1.14） */
const MOUNTS = getPart('chassis-midship').bodyMounts.map((m) => ({ ...m }));

/**
 * 建立車殼模組
 * @type {(cfg: PolyBodyConfig) => BodyDef & { style: 'homage' | 'race', theme: string }}
 */
export function makePolyBody(cfg) {
  const data = {
    wallThickness_mm: cfg.wallThickness_mm,
    wheelArches: cfg.wheelArches,
    openings: cfg.openings ?? [],
    recesses: cfg.recesses ?? [],
    canopy: cfg.canopy ?? null,
  };
  /** @type {() => BodyPart[]} */
  const compose = () => {
    const surf = createPolySurface(cfg.stations, { step: 0.5, tuck: cfg.tuck ?? 0 });
    const kit = makeLoftKit(data, { mode: 'linear', sideZMin: cfg.sideZMin ?? 26, surface: surf });
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {KeepFn} 座艙底 */
    const cab = (x, y, z) => kit.underCanopy(x, z);
    const zones = cfg.zones(kit);
    // 塗裝分區：第 i 區 = 自己的條件成立且前面各區都不成立（座艙底另外分出）
    zones.forEach((zone, i) => {
      /** @type {KeepFn[]} */
      const fns = [(x, y, z, s) => -cab(x, y, z, s), zone.keep];
      for (let k = 0; k < i; k++) {
        const prev = zones[k].keep;
        fns.push((x, y, z, s) => -prev(x, y, z, s));
      }
      // 最後一區包含其餘所有面，不需要自己的條件
      if (i === zones.length - 1) {
        fns.splice(1, 1);
      }
      parts.push({ geometry: kit.outer(fns), mat: zone.mat, shell: true, name: `shell-${zone.mat}-${i}` });
    });
    if (kit.canopy) {
      parts.push({ geometry: kit.outer([cab]), mat: cfg.mats.cockpit ?? cfg.mats.inner, shell: true, name: 'shell-cockpit' });
    }
    const st = kit.structure();
    parts.push({ geometry: st.inner, mat: cfg.mats.inner, name: 'shell-inner' });
    parts.push({ geometry: st.rim, mat: cfg.mats.edge, name: 'shell-edge' });
    parts.push({ geometry: mergeGeos([st.capFront, st.capRear]), mat: cfg.mats.cap, shell: true, name: 'caps' });
    parts.push({ geometry: mergeGeos([st.capFrontIn, st.capRearIn]), mat: cfg.mats.inner, name: 'cap-inner' });
    st.recessFloor.forEach((g, i) => parts.push({ geometry: g, mat: cfg.mats.recess ?? cfg.mats.inner, shell: true, name: `recess-floor-${i}` }));
    st.recessWall.forEach((g, i) => parts.push({ geometry: g, mat: cfg.mats.recessWall ?? cfg.mats.recess ?? cfg.mats.inner, shell: true, name: `recess-wall-${i}` }));
    if (kit.canopy && cfg.mats.glass) {
      parts.push({ geometry: buildRegion(kit.canopy, []).geometry, mat: cfg.mats.glass, shell: true, renderOrder: 3, name: 'canopy' });
    }
    if (cfg.extras) {
      parts.push(...cfg.extras(kit));
    }
    const innerY = cfg.mountInnerY ? cfg.mountInnerY(kit) : (x) => kit.innerYAt(x);
    parts.push({ geometry: buildMountTabs(MOUNTS, innerY), mat: cfg.mats.mount, name: 'mount-tabs' });
    return parts;
  };
  return {
    id: cfg.id,
    category: 'body',
    style: cfg.style,
    theme: cfg.theme,
    name: cfg.name,
    material: cfg.material,
    density_g_cm3: cfg.density_g_cm3,
    wallThickness_mm: cfg.wallThickness_mm,
    mounts: MOUNTS.map((m) => ({ ...m })),
    build: cachedBuild(compose, cfg.materials),
    src: cfg.src,
  };
}

/**
 * 立板（側視多邊形 (x, y)，沿 z 給厚度，帶小倒角）：鰭片、角、尾鰭
 * @type {(pts: number[][], zc: number, thick: number, tiltDeg?: number) => THREE.BufferGeometry}
 */
export function finPlate(pts, zc, thick, tiltDeg = 0) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const bev = Math.min(0.2, thick / 4);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 });
  g.translate(0, 0, -thick / 2 + bev);
  if (tiltDeg !== 0) {
    // 繞 x 軸外傾（以板底高度為支點）
    const yBase = Math.min(...pts.map((p) => p[1]));
    g.translate(0, -yBase, 0);
    g.rotateX((-tiltDeg * Math.PI) / 180);
    g.translate(0, yBase, 0);
  }
  g.translate(0, 0, zc);
  return g;
}

/**
 * 水平薄板（俯視多邊形 (x, z)，厚度往上）：分流板、尾部橋板
 * @type {(pts: number[][], y: number, thick: number) => THREE.BufferGeometry}
 */
export function flatPlate(pts, y, thick) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/**
 * 座艙內裝：後傾椅背＋駕駛人剪影（頭盔、肩、軀幹），x0 為頭盔位置、deckY 為座艙地板高度
 * @type {(x0: number, deckY: number, scale?: number) => { body: THREE.BufferGeometry, helmet: THREE.BufferGeometry }}
 */
export function buildDriver(x0, deckY, scale = 1) {
  const seat = new THREE.CapsuleGeometry(2.2 * scale, 2 * scale, 4, 12);
  seat.scale(0.35, 1, 1.1);
  seat.rotateZ(0.55);
  seat.translate(x0 - 4 * scale, deckY + 1.4 * scale, 0);
  const shoulders = new THREE.CapsuleGeometry(0.9 * scale, 3.6 * scale, 4, 12);
  shoulders.rotateX(Math.PI / 2);
  shoulders.translate(x0 - 1.6 * scale, deckY + 1.2 * scale, 0);
  const torso = new THREE.CapsuleGeometry(1.2 * scale, 4 * scale, 4, 12);
  torso.rotateZ(Math.PI / 2 - 0.35);
  torso.scale(1, 0.7, 1.4);
  torso.translate(x0 + 1.4 * scale, deckY + 0.5 * scale, 0);
  const helmet = new THREE.SphereGeometry(1.55 * scale, 20, 14);
  helmet.scale(1.12, 1, 0.95);
  helmet.translate(x0, deckY + 2.9 * scale, 0);
  return { body: mergeGeos([seat, shoulders, torso]), helmet };
}
