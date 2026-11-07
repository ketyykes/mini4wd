// 雅加婆婆的小屋（body-yaga-hut，神話組・斯拉夫）：俄羅斯民間故事裡「站在雞腳上、會轉身的小木屋」（izbushka）——
// Magnus 1916 英譯 Afanasyev：「a little hut standing on cocks' feet and turning round」，要對它說「背對森林站好」才會停下開門。
// 照四視圖 23 建模：低楔形車身；車頭是兩支往前伸的尖叉（前翼子板艙），中間真的鏤空；
// 拉長的六角座艙罩（深琥珀、深苔綠框）露出來，座艙後方的木瓦屋頂壓低縮成中線上一道
// 苔綠屋脊鰭（上緣一階一階升高，骨白屋脊條），旁邊一根紅磚煙囪；
// 四視圖車尾兩角往後伸的尖刺 → 柵欄：每個後角兩根骨白尖頭木樁，中間一根橫木把兩邊的樁連成一道柵欄。
// 不做雞腳、不畫雅加婆婆、不做骷髏。塗裝：骨白主色（四視圖的米白多面）＋苔綠（前後翼子板艙外側斜面、屋脊鰭、側裙）；
// 原木褐只留在兩輪之間的側牆（圓木橫紋），牆上兩扇琥珀暖光小窗配骨白窗框與人字小山牆（izba 的 nalichnik）。
// 設計：shared/design/body-yaga-hut/DESIGN.md（研究一節列出實際打開的來源）。剖面為本檔站位產生器（推估）。
// 不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_REAR = -71;
/** @type {number} 屋脊樑鼻尖 x */
const X_FRONT = 75;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-71, -67, -60, -50, -40, -28, -14, 0, 14, 28, 40, 48, 56, 63, 68, 72, 75];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：車尾 27 → 後翼子板 41.5 → 收腰 29.5 → 前翼子板艙 40.5 → 鼻端 24（讓開前導輪）
  hw: monoCurve(XS, [27, 30, 35.5, 40.5, 41.5, 38, 32, 29.5, 31, 37, 40.5, 40.5, 37, 31, 29.5, 27.5, 24]),
  // 中線高度（低楔形）：車尾 27 → 座艙頂 35.5（x −6）→ 引擎蓋 28.5 → 鼻叉往下斜到鼻尖 16.5
  yTop: monoCurve(XS, [27, 28.5, 30, 31.5, 32.5, 33.8, 35.2, 35.4, 33, 30.5, 28.5, 27.5, 26.5, 25, 22.5, 19.5, 16.5]),
  // 車頂平台半寬：座艙段 11，引擎蓋與鼻端 9–12
  cw: monoCurve(XS, [9, 10, 10.5, 11, 11, 11, 11, 10.5, 9, 9, 9.5, 10, 11, 12, 12.5, 12.5, 12.5]),
  // 車頂平台邊的落差（多面切削的第一道折線）
  eave: monoCurve(XS, [1, 1.2, 1.4, 1.5, 1.5, 1.5, 1.5, 1.4, 1.2, 1, 1, 1, 1, 1, 1, 1, 1]),
  // 平台與翼子板艙之間的低谷深度（鼻端兩側往下凹）
  valley: monoCurve(XS, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 2.5, 3.5, 3, 2.5, 2]),
  // 翼子板艙稜線高度
  yF: monoCurve(XS, [25, 27.5, 30, 31.5, 31.5, 30.5, 29, 28.5, 29, 30.5, 32, 31.5, 29.5, 27, 24.5, 21.5, 18]),
  // 肩稜線
  yS: monoCurve(XS, [22.5, 25, 27.5, 29.5, 30, 29, 27, 26.5, 27, 28.5, 30.5, 30, 27.5, 23.5, 21, 18.5, 16]),
  // 側裙下緣；車尾抬高讓開後導輪
  yLow: monoCurve(XS, [20, 18, 15.5, 13.5, 12.6, 12.5, 12.5, 12.5, 12.5, 12.5, 12.6, 13, 13.5, 14, 14.3, 14.5, 14.8]),
};

/** @type {number} 側牆往下的外張量 */
const FLARE = 0.7;
/** @type {(x: number) => number} 翼子板艙稜線的 |z| */
const zF = (x) => lerp(P.cw(x), P.hw(x), 0.62);

/**
 * 半剖面 7 點：屋脊 → 簷口（銳利）→ 低谷 / 甲板 → 翼子板艙稜線（銳利）→ 肩稜線（銳利）→ 側牆 → 側裙下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const c = P.cw(x);
  const e = t - P.eave(x);
  const f = P.yF(x);
  const z3 = zF(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  return [
    [0, t],
    [c, e],
    [lerp(c, z3, 0.5), Math.max(lo + 2, lerp(e, f, 0.5) - P.valley(x))],
    [z3, f],
    [h, s],
    [h + FLARE / 2, lerp(s, lo, 0.5)],
    [h + FLARE, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與鼻端每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -60, 1, profile).slice(0, -1), ...buildStations(-60, 54, 2, profile).slice(0, -1), ...buildStations(54, X_FRONT, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離 */
const archDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {{ x: number, hw0: number, flare: number }} 兩支前伸尖叉之間的鏤空：從 x 起，半寬 hw0 往前每 mm 加寬 flare */
const NOSE_GAP = { x: 50, hw0: 8.5, flare: 0.3 };
/** @type {(x: number, y: number, z: number) => number} 鼻叉鏤空距離（負值 = 鏤空內） */
const noseGapSd = (x, y, z) => Math.max(NOSE_GAP.x - x, Math.abs(z) - (NOSE_GAP.hw0 + NOSE_GAP.flare * (x - NOSE_GAP.x)));
/** @type {(x: number) => boolean} 兩輪之間的原木牆段（木色只留在這裡） */
const inLogSpan = (x) => x > -21.5 && x < 21.5;
/** @type {{ xr: number, xm: number, xf: number, wr: number, wm: number }} 拉長的六角座艙罩（俯視）：後緣 xr、最寬段 xm、前尖 xf */
const CAB = { xr: -16, xm: 2, xf: 30, wr: 6, wm: 9.5 };
/** @type {(x: number, z: number) => number} 座艙罩距離（負值 = 罩內） */
const cabinSd = (x, z) => {
  if (x < CAB.xr || x > CAB.xf) {
    return Math.max(CAB.xr - x, x - CAB.xf);
  }
  const w = x < CAB.xm ? lerp(CAB.wr, CAB.wm, (x - CAB.xr) / (CAB.xm - CAB.xr)) : lerp(CAB.wm, 2.5, (x - CAB.xm) / (CAB.xf - CAB.xm));
  return Math.abs(z) - w;
};

/** @type {(x: number, y: number) => number} 側牆外表面 |z| */
const wallZ = (x, y) => {
  const s = P.yS(x);
  const t = Math.min(1, Math.max(0, (s - y) / (s - P.yLow(x))));
  return P.hw(x) + FLARE * t;
};
/** @type {(x: number, y: number, z: number) => boolean} 側牆 */
const onSideWall = (x, y, z) => y < P.yS(x) + 0.05 && Math.abs(z) > wallZ(x, y) - 0.45 && x > X_REAR + 1 && x < X_FRONT - 1;
/** @type {(x: number, y: number) => boolean} 頂面 */
const onTop = (x, y) => y > P.yS(x) + 0.05;

/** @type {(x: number) => number} 苔綠下半的上緣（側牆）：前後翼子板艙下半是苔綠，兩輪之間只留側裙 */
const mossTopY = (x) => {
  const nearArch = Math.min(Math.abs(x - 40), Math.abs(x + 40));
  return nearArch < 22 ? lerp(P.yLow(x) + 7.5, P.yLow(x) + 2.8, Math.max(0, (nearArch - 14) / 8)) : P.yLow(x) + 2.8;
};

/** @type {{ x: number, w: number, y0: number, y1: number }[]} 側牆兩扇小窗：中心 x、半寬、下緣、上緣 */
const WINDOWS = [
  { x: 9, w: 3.2, y0: 17.2, y1: 23.2 },
  { x: -7, w: 3.2, y0: 17.2, y1: 23.2 },
];
/** @type {(x: number, y: number) => number} 到最近一扇窗的距離（負值 = 窗內） */
const windowSd = (x, y) => Math.min(...WINDOWS.map((w) => Math.max(Math.abs(x - w.x) - w.w, w.y0 - y, y - w.y1)));

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  log: namedMaterial('paint-log-pine', { color: 0x6e4424, roughness: 0.7, clearcoat: 0.03 }),
  moss: namedMaterial('paint-moss-green-matte', { color: 0x5b6b2e, roughness: 0.72, clearcoat: 0.03 }),
  moss2: namedMaterial('paint-moss-green-matte', { color: 0x5b6b2e, roughness: 0.72, clearcoat: 0.03, side: THREE.DoubleSide }),
  bone: namedMaterial('paint-bone-white', { color: 0xe4d9bd, roughness: 0.6, clearcoat: 0.05 }),
  bone2: namedMaterial('paint-bone-white', { color: 0xe9e2cf, roughness: 0.6, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 煙囪管口：黑
  ink2: namedMaterial('paint-chimney-mouth-black', { color: 0x121010, roughness: 0.8, side: THREE.DoubleSide }),
  // 座艙罩：深琥珀亮漆（不透明，殼面分區）
  canopy: namedMaterial('paint-canopy-dark-amber', { color: 0x3a2412, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  // 煙囪：紅磚（霧面）
  brick2: namedMaterial('paint-chimney-brick', { color: 0x8a3b26, roughness: 0.75, clearcoat: 0.03, side: THREE.DoubleSide }),
  logDark2: namedMaterial('paint-log-pine-aged', { color: 0x6a4126, roughness: 0.72, clearcoat: 0.03, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-wood', { color: 0x4a2f1b, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-wood', { color: 0x2e1f14, roughness: 0.8, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dChink: decalMaterial('decal-log-chinks', { color: 0x2e1a0c, roughness: 0.8 }),
  dHighlight: decalMaterial('decal-log-highlight', { color: 0x8e5e34, roughness: 0.7 }),
  dMoss: decalMaterial('decal-moss-dark', { color: 0x3b4a1e, roughness: 0.7 }),
  dBone: decalMaterial('decal-bone-white', { color: 0xe9e2cf, roughness: 0.6 }),
  dWindow: decalMaterial('lamp-window-amber-warm', { color: 0xe0a048, emissive: 0xb86410, emissiveIntensity: 0.35, roughness: 0.3 }),
});

/** @type {{ x0: number, x1: number, y0: number, y1: number, z: number, r: number }[]} 柵欄木樁：根 (x0, y0) → 尖 (x1, y1)、|z|、方截面半寬 */
const STAKES = [
  { x0: -52, x1: -77, y0: 32.6, y1: 35.4, z: 33.4, r: 1.1 },
  { x0: -54, x1: -74.5, y0: 30.2, y1: 32, z: 37.6, r: 1.0 },
];
/** @type {{ x: number, y: number, half: number, r: number }} 柵欄橫木：x、y、半長、方截面半寬 */
const RAIL = { x: -66.5, y: 33.2, half: 38.6, r: 0.8 };

/**
 * 柵欄：每個後角兩根骨白尖頭方木樁（4 段方截面＋金字塔尖）＋一根把兩側連起來的橫木
 * @type {() => { stakes: THREE.BufferGeometry, rail: THREE.BufferGeometry }}
 */
const buildFence = () => {
  /** @type {THREE.BufferGeometry[]} */
  const stakes = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const sg of [-1, 1]) {
    for (const s of STAKES) {
      const a = new THREE.Vector3(s.x0, s.y0, sg * s.z);
      const b = new THREE.Vector3(s.x1, s.y1, sg * s.z);
      const dir = b.clone().sub(a);
      const len = dir.length();
      const tipLen = 4.2;
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
      // 樁身：4 段（方截面，轉 45° 讓平面朝上）
      const body = new THREE.CylinderGeometry(s.r * Math.SQRT2, s.r * Math.SQRT2, len - tipLen, 4, 1);
      body.rotateY(Math.PI / 4);
      body.translate(0, (len - tipLen) / 2, 0);
      const tip = new THREE.ConeGeometry(s.r * Math.SQRT2, tipLen, 4, 1);
      tip.rotateY(Math.PI / 4);
      tip.translate(0, len - tipLen / 2, 0);
      for (const g of [body, tip]) {
        g.applyQuaternion(q);
        g.translate(a.x, a.y, a.z);
        stakes.push(g.index ? g.toNonIndexed() : g);
      }
    }
  }
  const rail = new THREE.BoxGeometry(2 * RAIL.r, 2 * RAIL.r, 2 * RAIL.half);
  rail.translate(RAIL.x, RAIL.y, 0);
  return { stakes: mergeGeos(stakes), rail: rail.index ? rail.toNonIndexed() : rail };
};

/**
 * 屋脊鰭的側視上緣（x, y）：座艙後方從甲板升起，往後一階一階升高（每階是一排木瓦），最高 44.4，車尾前收回甲板
 * @type {number[][]}
 */
const FIN_TOP = [[-19, 34.6], [-23, 38.4], [-31, 39.6], [-31, 40.8], [-40, 41.8], [-40, 43], [-49, 43.6], [-49, 44.4], [-56, 44.4], [-60.5, 40.2]];
/** @type {number} 屋脊鰭板厚（中線兩側各一半） */
const FIN_T = 2.4;
/** @type {{ x: number, z: number, half: number, y0: number, y1: number }} 煙囪：中心 x、z、方截面半寬、底 / 頂 y */
const CHIMNEY = { x: -35, z: -2.6, half: 1.5, y0: 32, y1: 46.2 };

/**
 * 屋脊鰭（壓低縮小的木瓦屋頂，只剩座艙後方中線上一道鰭）：苔綠板、上緣一條骨白屋脊條；左坡旁一根紅磚煙囪（黑色管口）
 * @type {() => { fin: THREE.BufferGeometry, trim: THREE.BufferGeometry, chimney: THREE.BufferGeometry, chimneyCap: THREE.BufferGeometry }}
 */
const buildRidgeFin = () => {
  /** @type {(pts: number[][], thick: number) => THREE.BufferGeometry} 側視多邊形沿 z 擠出 thick（中心在 z 0） */
  const sidePlate = (pts, thick) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: thick, bevelEnabled: false });
    g.translate(0, 0, -thick / 2);
    return g.index ? g.toNonIndexed() : g;
  };
  // 鰭底埋進甲板（比甲板低 1.5）
  const bottom = [[-61, P.yTop(-61) - 1.5], [-40, P.yTop(-40) - 1.5], [-19, P.yTop(-19) - 1.5]];
  const fin = sidePlate([...FIN_TOP, ...bottom], FIN_T);
  // 屋脊條：沿上緣往下 0.8 的帶，比鰭厚 0.5
  const band = [...FIN_TOP.slice(1, -1), ...FIN_TOP.slice(1, -1).reverse().map(([x, y]) => [x, y - 0.8])];
  const trim = sidePlate(band, FIN_T + 0.5);
  const chimney = new THREE.BoxGeometry(2 * CHIMNEY.half, CHIMNEY.y1 - CHIMNEY.y0, 2 * CHIMNEY.half);
  chimney.translate(CHIMNEY.x, (CHIMNEY.y0 + CHIMNEY.y1) / 2, CHIMNEY.z);
  const cap = new THREE.BoxGeometry(2 * CHIMNEY.half + 0.8, 0.8, 2 * CHIMNEY.half + 0.8);
  cap.translate(CHIMNEY.x, CHIMNEY.y1 + 0.2, CHIMNEY.z);
  return {
    fin,
    trim,
    chimney: chimney.index ? chimney.toNonIndexed() : chimney,
    chimneyCap: cap.index ? cap.toNonIndexed() : cap,
  };
};

export const yagaHutBody = makePolyBody({
  id: 'body-yaga-hut',
  name: '雅加婆婆的小屋',
  style: 'myth',
  phase: 13,
  mythSeries: 'slavic',
  mythTheme: 'baba-yaga-hut',
  form: 'twin-pod-gable',
  roof: 'closed',
  wing: 'stake-fence',
  theme: '雅加婆婆小屋的元素（不做雞腳、不畫人）：骨白低楔形車身、兩支往前伸的尖叉鼻（中間鏤空）、苔綠翼子板艙外側斜面；拉長的六角深琥珀座艙罩，座艙後方壓低的苔綠屋脊鰭（一階一階的木瓦、骨白屋脊條）與紅磚煙囪；兩輪之間原木褐側牆的圓木橫紋、兩扇琥珀暖光小窗配骨白窗框與人字小山牆；苔綠翼子板艙下半與側裙；車尾兩角各兩根骨白尖頭木樁，一根橫木連成柵欄',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: [0, 1, 3, 4],
  step: 0.6,
  wheelArches: ARCHES,
  openings: [{ id: '兩支鼻叉之間的鏤空', shape: 'fn', sd: noseGapSd }],
  sideZMin: 22,
  zones: () => [
    { mat: 'moss', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.5 ? mossTopY(x) - y : -1) },
    { mat: 'canopy', keep: (x, y, z) => (onTop(x, y) ? -cabinSd(x, z) : -1) },
    // 前後翼子板艙外側斜面（稜線以外）苔綠，和骨白頂面分成兩色切面（四視圖的橄欖綠面）
    { mat: 'moss', keep: (x, y, z) => (onTop(x, y) && (x > 24 || x < -26) ? Math.abs(z) - zF(x) : -1) },
    { mat: 'log', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.5 && inLogSpan(x) ? 1 : -1) },
    { mat: 'bone', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'moss2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 側牆圓木橫紋：每 3.2 mm 一道深色接縫＋接縫上方的亮面（圓木的圓背），避開窗、輪拱與苔綠下半
    /** @type {(x: number, y: number, z: number) => boolean} 原木牆面 */
    const onLogWall = (x, y, z) => onSideWall(x, y, z) && inLogSpan(x) && y > mossTopY(x) + 0.5 && archDist(x, y) > 0.8 && windowSd(x, y) > 1.6;
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onLogWall(x, y, z)) {
          return -1;
        }
        const ph = (((y - P.yLow(x)) % 3.2) + 3.2) % 3.2;
        return 0.3 - Math.min(ph, 3.2 - ph);
      }),
      mat: 'dChink',
      name: 'decal-log-chinks',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onLogWall(x, y, z)) {
          return -1;
        }
        const ph = (((y - P.yLow(x)) % 3.2) + 3.2) % 3.2;
        return 0.35 - Math.abs(ph - 1.9);
      }),
      mat: 'dHighlight',
      name: 'decal-log-highlight',
    });
    // 座艙罩深苔綠框（寬 0.8）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y)) {
          return -1;
        }
        const d = cabinSd(x, z);
        return Math.min(d, 0.8 - d);
      }, { offset: 0.12 }),
      mat: 'dMoss',
      name: 'decal-canopy-frame',
    });
    // 小窗：琥珀暖光＋骨白窗框（寬 0.9）＋窗上的骨白人字小山牆（nalichnik 的三角楣）
    parts.push({ geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) ? -windowSd(x, y) : -1), { offset: 0.12 }), mat: 'dWindow', name: 'lamp-windows' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = windowSd(x, y);
        const frame = Math.min(d, 0.9 - d);
        let gable = -1;
        for (const w of WINDOWS) {
          const half = w.w + 1.4;
          const peak = w.y1 + 0.9 + 2.2 * (1 - Math.abs(x - w.x) / half);
          gable = Math.max(gable, Math.min(half - Math.abs(x - w.x), y - (w.y1 + 0.9), peak - y));
        }
        return Math.max(frame, gable);
      }, { offset: 0.14 }),
      mat: 'dBone',
      name: 'decal-window-nalichnik',
    });

    // 座艙後方的屋脊鰭（壓低縮小的木瓦屋頂）＋骨白屋脊條＋紅磚煙囪
    const hut = buildRidgeFin();
    parts.push({ geometry: hut.fin, mat: 'moss2', solid: true, outline: true, name: 'ridge-fin-roof' });
    parts.push({ geometry: hut.trim, mat: 'bone2', solid: true, outline: true, name: 'ridge-fin-ridge-cap' });
    parts.push({ geometry: hut.chimney, mat: 'brick2', solid: true, outline: true, name: 'chimney-stack' });
    parts.push({ geometry: hut.chimneyCap, mat: 'ink2', solid: true, outline: true, name: 'chimney-cap' });

    // 柵欄（stake-fence）
    const fence = buildFence();
    parts.push({ geometry: fence.stakes, mat: 'bone2', solid: true, outline: true, name: 'fence-stakes' });
    parts.push({ geometry: fence.rail, mat: 'logDark2', solid: true, outline: true, name: 'fence-rail' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    fourview: 'shared/design/body-yaga-hut/fourview.png（四視圖 23）與 fourview_trace.txt：低楔形、兩支前伸中間鏤空的尖叉鼻、六角座艙罩、收腰、車尾兩角往後伸的尖刺照圖（俯視站位被面板干擾，以看圖為準），高度縮到合法範圍（推估）',
    geometry:
      '本檔站位產生器 P（推估）：殼 x −71 → 75；肩線半寬 鼻端 24、前翼子板艙 40.5、腰 29.5、後翼子板 41.5、車尾 27（＋牆腳外張 0.7）；座艙頂 35.4（x 0）、鼻尖 16.5；鼻叉鏤空 x > 50、半寬 8.5 → 16；屋脊鰭 x −60.5 → −19、最高 44.4、厚 2.4；煙囪 x −35、頂 46.2',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    fence: '柵欄：每個後角兩根方木樁（|z| 33.4 / 37.6、半寬 1.1 / 1.0、根 x −52 / −54 → 尖 x −77 / −74.5、尖長 4.2）＋橫木（x −66.5、y 33.2、半長 38.6、截面 1.6 × 1.6）；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    livery: '圓木橫紋間距 3.2；兩扇小窗 x 9 / −7、6.4 × 6；座艙罩 x −16 → 30、最寬半寬 9.5（皆為塗裝分區 / 貼紙，推估）',
    myth: '雅加婆婆的小屋（Afanasyev 故事，DESIGN.md 研究一節）：izba 圓木牆、木瓦屋頂（屋脊鰭）、煙囪、nalichnik 雕花窗框、柵欄；不做雞腳、不畫人、不做骷髏',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
