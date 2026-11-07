// Gundestrup 銀釜（body-gundestrup-stag，神話組・凱爾特）：丹麥 Gundestrup 銀釜——銀為主、局部鍍金、repoussé 錘起的銀板、嵌玻璃。
// 車上不做鹿、不畫神臉：主題用「鹿角的分叉」「銀釜的銀板與鍍金」「紅琺瑯」「torc 頸環」表現。
// 照四視圖 19 建模：鼻頭從中間分開成兩支往前伸的尖叉（中間露出底盤），長而低的引擎蓋、後移的尖頭座艙、高聳的後翼子板腰臀、
// 尾端往下收；四視圖招牌的「兩側鴨翼」→ 鹿角分叉的前翼：每側一片青銅水平翼，主枝往後外掃，前緣分出三支往前外指的叉（不成 Y 字）。
// 塗裝：拋光銀主色、四視圖的米色面板 → 青銅面板（鼻叉外側、後翼子板側面）、四視圖的紅色細線 → 紅琺瑯細線；
// 後甲板一條扭絞 torc 金帶（兩端圓球頭）；側裙氧化暗銀；座艙是嵌深藍玻璃感的 niello 深色面（鍍金框）。
// 設計：shared/design/body-gundestrup-stag/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 5 節 C1、C2、C7、C8；黑名單 5-3、第 10 節）。剖面為本檔站位產生器（推估）。
// 不畫神的人臉、不做盤腿坐像、不畫動物、不用三臂 triskele、不做圓內十字、不重現 Battersea 盾的琺瑯格；不含任何文字。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_REAR = -70;
/** @type {number} 鼻叉尖 x */
const X_FRONT = 75;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-70, -66, -58, -48, -40, -28, -14, 0, 14, 26, 36, 44, 52, 60, 66, 71, 75];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：車尾 21 → 高聳的後翼子板 40.5 → 腰 27 → 前翼子板 39.5 → 往前收成兩支鼻叉（外緣 17.5，讓開前導輪）
  hw: monoCurve(XS, [21, 27, 34, 39.5, 40.5, 37, 30, 27, 28.5, 34, 39, 39.5, 35, 29, 24.5, 21, 17.5]),
  // 中線高度：鼻叉之間的低谷 14 → 長而低的引擎蓋 29.5（x 36）→ 後移的座艙頂 40.3（x −14）→ 後翼子板腰臀 39 → 尾端急收到 27
  yTop: monoCurve(XS, [27, 32, 36.5, 38.5, 39, 39.8, 40.3, 39, 35, 31, 29.5, 26.5, 22, 18, 16, 15, 14]),
  // 車頂平台半寬：座艙段 12.5，引擎蓋 6，鼻叉之間的低谷 8–9
  cw: monoCurve(XS, [8, 9, 10, 11, 11.5, 12, 12.5, 12, 10, 7, 6, 6.5, 7.5, 8, 8.5, 9, 9]),
  // 翼子板 / 鼻叉稜線高度：後翼子板 35.5、前翼子板 32.5，往前延伸成鼻叉的脊（比中間低谷高 8 mm）
  yF: monoCurve(XS, [25, 29, 33.5, 35.5, 35.5, 34.5, 32.5, 31.5, 31.5, 32, 32.5, 31.5, 29.5, 26.5, 23.5, 20.5, 17.5]),
  // 肩稜線
  yS: monoCurve(XS, [22, 25.5, 29, 31, 31.5, 30, 27.5, 26.5, 27, 29, 31, 30.5, 27.5, 23.5, 20.5, 18, 15.5]),
  // 側裙下緣：兩輪之間抬高到 18（側面露出底盤，和鼻叉缺口同一個語言）；車尾抬高讓開後導輪
  yLow: monoCurve(XS, [20, 18, 16, 14, 13.5, 16, 18, 18, 18, 16, 13.5, 13.5, 14, 14.5, 14.6, 14.7, 14.8]),
};

/** @type {number} 側牆往下的外張量 */
const FLARE = 0.6;
/** @type {(x: number) => number} 稜線的 |z|（車頂平台與肩線之間 50%） */
const zF = (x) => lerp(P.cw(x), P.hw(x), 0.5);

/**
 * 半剖面 7 點：中線 → 車頂平台邊（銳利）→ 斜面 → 稜線（銳利）→ 肩稜線（銳利）→ 側牆 → 側裙下緣
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
    [c, t - 0.4],
    [lerp(c, z3, 0.5), lerp(t - 0.4, f, 0.5)],
    [z3, f],
    [h, s],
    [h + FLARE / 2, lerp(s, lo, 0.5)],
    [h + FLARE, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與鼻端每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -60, 1, profile).slice(0, -1), ...buildStations(-60, 56, 2, profile).slice(0, -1), ...buildStations(56, X_FRONT, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離 */
const archDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {{ x: number, hw0: number, flare: number }} 鼻叉之間的 V 形缺口：從 x 起，半寬 hw0 往前每 mm 加寬 flare */
const NOSE_GAP = { x: 56, hw0: 7, flare: 0.3 };
/** @type {(x: number, y: number, z: number) => number} 鼻叉缺口距離（負值 = 缺口內） */
const noseGapSd = (x, y, z) => Math.max(NOSE_GAP.x - x, Math.abs(z) - (NOSE_GAP.hw0 + NOSE_GAP.flare * (x - NOSE_GAP.x)));

/** @type {(x: number, y: number) => number} 側牆外表面 |z| */
const wallZ = (x, y) => {
  const s = P.yS(x);
  const t = Math.min(1, Math.max(0, (s - y) / (s - P.yLow(x))));
  return P.hw(x) + FLARE * t;
};
/** @type {(x: number, y: number, z: number) => boolean} 側牆 */
const onSideWall = (x, y, z) => y < P.yS(x) + 0.05 && Math.abs(z) > wallZ(x, y) - 0.4 && x > X_REAR + 1 && x < X_FRONT - 1;
/** @type {(x: number, y: number) => boolean} 頂面 */
const onTop = (x, y) => y > P.yS(x) + 0.05;

/** @type {number} 氧化暗銀側裙高度 */
const SKIRT_H = 3.2;

/** @type {{ xr: number, xm: number, xf: number, w: number }} 尖頭座艙（俯視）：圓後緣 xr、最寬處 xm、前尖 xf、最寬半寬 w */
const CAB = { xr: -32, xm: -12, xf: 18, w: 10.5 };
/** @type {(x: number, z: number) => number} 尖頭座艙距離（負值 = 座艙內） */
const cabinSd = (x, z) => {
  if (x < CAB.xm) {
    return Math.hypot((x - CAB.xm) * (CAB.w / (CAB.xm - CAB.xr)), z) - CAB.w;
  }
  const w = lerp(CAB.w, 0, (x - CAB.xm) / (CAB.xf - CAB.xm));
  return Math.max(Math.abs(z) - w, x - CAB.xf);
};

/**
 * 青銅面板（四視圖米色面）：鼻叉外側斜面（x > 44、稜線外側）＋後翼子板側面的斜切面（側視三角）
 * @type {(x: number, y: number, z: number) => number} 正值 = 面板內
 */
const bronzePanel = (x, y, z) => {
  const az = Math.abs(z);
  if (onTop(x, y)) {
    return Math.min(x - 46, az - zF(x) - 0.5);
  }
  // 後翼子板側面：x −60 → −18、上緣是肩線、下緣從 x −18 的肩線斜到 x −60 的 y 16
  const yb = lerp(P.yS(-18), 16, Math.min(1, Math.max(0, (-18 - x) / 42)));
  return Math.min(y - yb, -18 - x, x + 62, archDist(x, y) - 1.4);
};

/** @type {{ x: number, w: number }} 後甲板 torc 金帶：中心 x、半寬 */
const TORC = { x: -50, w: 1.6 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 拋光銀（真金屬：-alu 結尾）
  silver: namedMaterial('trim-silver-alu', { color: 0xc0c3c7, roughness: 0.3, metalness: 0.85, clearcoat: 0.2 }),
  silver2: namedMaterial('trim-silver-alu', { color: 0xc0c3c7, roughness: 0.3, metalness: 0.85, clearcoat: 0.2, side: THREE.DoubleSide }),
  // 青銅面板（真金屬）
  bronze: namedMaterial('trim-bronze-brass', { color: 0x8c6a3b, roughness: 0.36, metalness: 0.75, clearcoat: 0.2 }),
  bronze2: namedMaterial('trim-bronze-brass', { color: 0x8c6a3b, roughness: 0.36, metalness: 0.75, clearcoat: 0.2, side: THREE.DoubleSide }),
  // 氧化暗銀（霧面）
  patina: namedMaterial('paint-oxidized-silver-matte', { color: 0x4a4d52, roughness: 0.62, clearcoat: 0.05 }),
  patina2: namedMaterial('paint-oxidized-silver-matte', { color: 0x4a4d52, roughness: 0.62, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 座艙：niello 深藍黑亮面（嵌玻璃感）
  niello: namedMaterial('paint-niello-inlay-navy', { color: 0x141c2e, roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 紅琺瑯（亮面）
  enamel2: namedMaterial('paint-red-enamel', { color: 0xb0302b, roughness: 0.25, clearcoat: 0.8, side: THREE.DoubleSide }),
  gilt2: namedMaterial('trim-gilt-brass', { color: 0xc9a43b, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-silver', { color: 0x7d8086, roughness: 0.55, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-patina', { color: 0x3a3c40, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-patina', { color: 0x34373b, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGold: decalMaterial('decal-gilt', { color: 0xc9a43b, roughness: 0.32, metalness: 0.7 }),
  dEnamel: decalMaterial('decal-red-enamel', { color: 0xb8302a, roughness: 0.3 }),
  dGroove: decalMaterial('decal-niello-groove', { color: 0x1a1f29, roughness: 0.55 }),
});

/** @type {number} 鹿角前翼的高度（板底 y）與板厚 */
const ANTLER_Y = 22.6;
/** @type {number} */
const ANTLER_T = 1.4;
/**
 * 鹿角前翼的俯視輪廓（x, |z|）：根部埋進側牆（x 22 → −16），主枝往後外掃到 (−15, 44.5)，前緣分出三支往前外指的叉，
 * 三支叉長短、角度都不同（自然鹿角，不成 Y 字）
 * @type {() => number[][]}
 */
const antlerOutline = () => {
  /** @type {number[][]} */
  const root = [];
  for (let x = -16; x <= 22; x += 4.75) {
    root.push([x, P.hw(x) - 0.8]);
  }
  return [
    ...root,
    [25.5, 37],
    [15.5, 33.5],
    [16.5, 41],
    [6, 35.5],
    [5.5, 43.5],
    [-3.5, 37.5],
    [-15, 44.5],
    [-11.5, 35],
  ];
};

/**
 * 鹿角前翼：青銅水平板＋沿主枝的紅琺瑯嵌條（0.3 mm 厚貼在上面）
 * @type {() => { antlers: THREE.BufferGeometry, inlays: THREE.BufferGeometry }}
 */
const buildAntlerCanards = () => {
  /** @type {(pts: number[][], y0: number, thick: number, sg: number) => THREE.BufferGeometry} 俯視多邊形 (x, |z|) 往上擠出 */
  const flatPlate = (pts, y0, thick, sg) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: thick, bevelEnabled: false });
    // 局部 (x, z, d) → 世界 (x, d, z)：繞 x 轉 90°（y → z、z → −y），再鏡像到兩側
    g.rotateX(Math.PI / 2);
    if (sg > 0) {
      g.scale(1, -1, 1);
      g.translate(0, y0, 0);
    } else {
      g.scale(1, -1, -1);
      g.translate(0, y0, 0);
    }
    const out = g.index ? g.toNonIndexed() : g;
    // 鏡像一次（sg > 0）要翻繞向；鏡像兩次（sg < 0）不用
    if (sg > 0) {
      const pos = out.getAttribute('position');
      for (let i = 0; i < pos.count; i += 3) {
        const ax = pos.getX(i + 1);
        const ay = pos.getY(i + 1);
        const az = pos.getZ(i + 1);
        pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
        pos.setXYZ(i + 2, ax, ay, az);
      }
    }
    out.computeVertexNormals();
    return out;
  };
  // 紅琺瑯嵌條：沿主枝（根部中段 → 主枝尖）的細長三角
  const inlay = [
    [4, P.hw(4) + 0.6],
    [-12.8, 43.2],
    [-1, P.hw(-1) + 2.4],
  ];
  /** @type {THREE.BufferGeometry[]} */
  const antlers = [];
  /** @type {THREE.BufferGeometry[]} */
  const inlays = [];
  for (const sg of [-1, 1]) {
    antlers.push(flatPlate(antlerOutline(), ANTLER_Y, ANTLER_T, sg));
    inlays.push(flatPlate(inlay, ANTLER_Y + ANTLER_T, 0.3, sg));
  }
  return { antlers: mergeGeos(antlers), inlays: mergeGeos(inlays) };
};

export const gundestrupStagBody = makePolyBody({
  id: 'body-gundestrup-stag',
  name: 'Gundestrup 銀釜',
  style: 'myth',
  phase: 13,
  mythSeries: 'celtic',
  mythTheme: 'gundestrup-stag',
  form: 'split-tine-nose',
  roof: 'closed',
  wing: 'antler-canard',
  theme: 'Gundestrup 銀釜的元素（不做鹿、不畫神臉）：鼻頭分成兩支往前伸的銀色尖叉（中間露出底盤）、長而低的引擎蓋、後移的尖頭 niello 座艙（鍍金框）、高聳的後翼子板腰臀；兩側青銅鹿角前翼（主枝往後外掃、三支長短不一的叉往前外指，紅琺瑯嵌條）；拋光銀主色、鼻叉外側與後翼子板側面的青銅面板、紅琺瑯細線、後甲板扭絞 torc 金帶、氧化暗銀側裙',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: [1, 3, 4],
  step: 0.68,
  wheelArches: ARCHES,
  openings: [{ id: '鼻叉之間的缺口', shape: 'fn', sd: noseGapSd }],
  sideZMin: 22,
  zones: () => [
    { mat: 'patina', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.4 ? P.yLow(x) + SKIRT_H - y : -1) },
    { mat: 'niello', keep: (x, y, z) => (onTop(x, y) ? -cabinSd(x, z) : -1) },
    { mat: 'bronze', keep: bronzePanel },
    { mat: 'silver', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'patina2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 紅琺瑯細線（四視圖的紅線）：青銅面板的邊、稜線（鼻叉尖 → 座艙後）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const b = bronzePanel(x, y, z);
        const edge = Math.min(b + 0.55, -b);
        const crest = onTop(x, y) && x > -30 && x < X_FRONT - 1 ? 0.3 - Math.abs(Math.abs(z) - zF(x)) : -1;
        return Math.max(edge, crest);
      }, { offset: 0.12 }),
      mat: 'dEnamel',
      name: 'decal-enamel-lines',
    });
    // 座艙鍍金框（寬 1.1）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y)) {
          return -1;
        }
        const d = cabinSd(x, z);
        return Math.min(d, 1.1 - d);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-cabin-gilt-frame',
    });
    // 後甲板扭絞 torc 金帶：橫跨後甲板的帶子，斜紋扭絞（niello 細斜縫），兩端在稜線外側收成圓球頭
    /** @type {(x: number, y: number, z: number) => number} torc 帶內（正值） */
    const torcBand = (x, y, z) => {
      if (!onTop(x, y)) {
        return -1;
      }
      const az = Math.abs(z);
      const zEnd = zF(TORC.x) + 3;
      const band = Math.min(TORC.w - Math.abs(x - TORC.x), zEnd - az);
      const ball = 2.3 - Math.hypot(x - TORC.x, az - zEnd);
      return Math.max(band, ball);
    };
    parts.push({ geometry: kit.decal(torcBand, { offset: 0.12 }), mat: 'dGold', name: 'decal-torc-band' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const t = torcBand(x, y, z);
        if (t < 0.25 || Math.abs(z) > zF(TORC.x) + 1.2) {
          return -1;
        }
        const q = ((((x - TORC.x) * 1.6 + z) % 2.2) + 2.2) % 2.2;
        return 0.3 - Math.abs(q - 1.1);
      }, { offset: 0.14 }),
      mat: 'dGroove',
      name: 'decal-torc-twist',
    });
    // 側牆圓泡釘列（C7 repoussé 泡釘）：肩線下 2.6、每 6 mm 一顆，避開輪拱
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || archDist(x, y) < 2 || x > 52 || x < -64) {
          return -1;
        }
        const xc = Math.round(x / 6) * 6;
        return 0.85 - Math.hypot(x - xc, y - (P.yS(xc) - 2.6));
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-repousse-bosses',
    });
    // 鹿角前翼（antler-canard）
    const ant = buildAntlerCanards();
    parts.push({ geometry: ant.antlers, mat: 'bronze2', solid: true, outline: true, name: 'antler-canards' });
    parts.push({ geometry: ant.inlays, mat: 'enamel2', solid: true, name: 'antler-canard-enamel' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    fourview: 'shared/design/body-gundestrup-stag/fourview.png（四視圖 19）與 fourview_trace.txt：分叉鼻、長引擎蓋、後移座艙、高後翼子板、兩側鴨翼照圖（俯視站位被米色面干擾，以看圖為準），高度縮到合法範圍（推估）',
    geometry:
      '本檔站位產生器 P（推估）：殼 x −70 → 75；肩線半寬 鼻叉外緣 17.5、前翼子板 39.5、腰 27、後翼子板 40.5、車尾 21（＋牆腳外張 0.6）；中線 鼻叉間低谷 14、引擎蓋 29.5、座艙頂 40.3（x −14）、車尾 27；稜線 31.5–35.5；鼻叉缺口 x > 56、半寬 7 → 12.7',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    antlers: '鹿角前翼：板底 y 22.6、厚 1.4、俯視 x 25.5 → −16、外緣 |z| 44.5；三支叉尖 (25.5, 37)、(16.5, 41)、(5.5, 43.5)，主枝尖 (−15, 44.5)；紅琺瑯嵌條厚 0.3；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    livery: '尖頭座艙 x −32 → 18、半寬 10.5；青銅面板 鼻叉外側 x > 46、後翼子板側面 x −62 → −18；torc 金帶 x −50、寬 3.2、圓球頭半徑 2.3；泡釘半徑 0.85、間距 6（皆為塗裝分區 / 貼紙，推估）',
    myth: 'Gundestrup 銀釜的銀、鍍金、錘起泡釘（C1）；雄鹿的分叉鹿角抽象成前翼（C2，不成 Y 字）；torc（C8）；配色銀 / 青銅 / 紅琺瑯（MYTH_RESEARCH 第 5 節色碼推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
