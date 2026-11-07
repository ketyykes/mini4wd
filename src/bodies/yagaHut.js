// 雅加婆婆的小屋（body-yaga-hut，神話組・斯拉夫）：俄羅斯民間故事裡「站在雞腳上、會轉身的小木屋」（izbushka）——
// Magnus 1916 英譯 Afanasyev：「a little hut standing on cocks' feet and turning round」，要對它說「背對森林站好」才會停下開門。
// 照四視圖 23 建模：雙艙鼻——中間一根往前伸的屋脊樑，兩側兩個前翼子板艙，樑與艙之間是兩道露出底盤的縫；座艙後移，
// 座艙就是「屋頂斷面」：橫剖面是陡斜的人字屋頂（屋脊銳利、兩坡往下到簷口），苔綠木瓦、骨白屋脊板；
// 四視圖車尾兩角往後伸的尖刺 → 柵欄：每個後角兩根骨白尖頭木樁，中間一根橫木把兩邊的樁連成一道柵欄。
// 不做雞腳、不畫雅加婆婆、不做骷髏。塗裝：原木褐（霧面，側牆圓木橫紋）＋苔綠（木瓦屋頂、翼子板艙下半、側裙）＋骨白（樁、屋脊板、窗框）；
// 側牆兩輪之間兩扇琥珀暖光小窗配骨白窗框與人字小山牆（izba 的 nalichnik）；屋脊樑上一條骨白飾板。
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
  // 俯視半寬（肩稜線）：車尾 27 → 寬大的屋身 42.5 → 收腰 30.5 → 前翼子板艙 40.5 → 鼻端 24（讓開前導輪）
  hw: monoCurve(XS, [27, 30, 36, 41.5, 42.5, 39, 33, 30.5, 32, 37, 40.5, 40.5, 37, 31, 29.5, 27.5, 24]),
  // 中線（屋脊 / 屋脊樑）高度：車尾 30 → 後移的屋脊最高 43（x −28）→ 往前降成幾乎水平的屋脊樑，鼻尖仍有 22.5（四視圖正視高高的中樑）
  yTop: monoCurve(XS, [30, 33.5, 37.5, 40.5, 42.2, 43, 42.5, 40, 34.5, 30.5, 28.5, 27.5, 26.5, 25.5, 24.5, 23.5, 22.5]),
  // 屋頂 / 屋脊樑半寬
  cw: monoCurve(XS, [9, 10, 11.5, 13, 13.5, 13.5, 13, 11.5, 8.5, 6.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5]),
  // 屋脊到簷口的落差：座艙段 7.5（陡斜的人字屋頂），引擎蓋與屋脊樑只有 0.5
  eave: monoCurve(XS, [1.5, 2.5, 4.5, 6.5, 7.5, 7.5, 7, 5, 2, 0.8, 0.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
  // 屋脊樑兩側的低谷深度（雙艙鼻：樑與翼子板艙之間往下凹）
  valley: monoCurve(XS, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.5, 6, 7.5, 7, 6, 4.5]),
  // 翼子板艙稜線高度
  yF: monoCurve(XS, [26, 29, 32, 34, 34, 32, 30, 29.5, 30, 31.5, 33, 32.5, 30.5, 27.5, 25, 22, 18.5]),
  // 肩稜線
  yS: monoCurve(XS, [23, 26, 29, 31, 31.5, 29.5, 27, 26.5, 27, 29, 31.2, 30.5, 27.5, 23.5, 21, 18.5, 16]),
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

/** @type {{ x: number, z0: number, z1: number }} 屋脊樑與翼子板艙之間的兩道縫（x > x、z0 < |z| < z1） */
const NOSE_SLOT = { x: 45, z0: 6.5, z1: 19.5 };
/** @type {(x: number, y: number, z: number) => number} 雙艙鼻縫距離（負值 = 縫內） */
const noseSlotSd = (x, y, z) => {
  const az = Math.abs(z);
  return Math.max(NOSE_SLOT.x - x, NOSE_SLOT.z0 - az, az - NOSE_SLOT.z1);
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
/** @type {(x: number, y: number, z: number) => boolean} 人字屋頂坡面（簷口以內、座艙段） */
const onRoof = (x, y, z) => onTop(x, y) && Math.abs(z) < P.cw(x) - 0.2 && P.eave(x) > 2.2;

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
  bone: namedMaterial('paint-bone-white', { color: 0xe9e2cf, roughness: 0.6, clearcoat: 0.05 }),
  bone2: namedMaterial('paint-bone-white', { color: 0xe9e2cf, roughness: 0.6, clearcoat: 0.05, side: THREE.DoubleSide }),
  logDark2: namedMaterial('paint-log-pine-aged', { color: 0x6a4126, roughness: 0.72, clearcoat: 0.03, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-wood', { color: 0x4a2f1b, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-wood', { color: 0x2e1f14, roughness: 0.8, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dChink: decalMaterial('decal-log-chinks', { color: 0x2e1a0c, roughness: 0.8 }),
  dHighlight: decalMaterial('decal-log-highlight', { color: 0x8e5e34, roughness: 0.7 }),
  dShingle: decalMaterial('decal-shingle-moss-dark', { color: 0x3b4a1e, roughness: 0.8 }),
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
  theme: '雅加婆婆小屋的元素（不做雞腳、不畫人）：雙艙鼻——中間往前伸的屋脊樑（骨白飾板）、兩側翼子板艙、中間兩道露出底盤的縫；後移的座艙是陡斜人字屋頂的斷面（苔綠木瓦、骨白屋脊板）；原木褐側牆的圓木橫紋、兩扇琥珀暖光小窗配骨白窗框與人字小山牆；苔綠翼子板艙下半與側裙；車尾兩角各兩根骨白尖頭木樁，一根橫木連成柵欄',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: [0, 1, 3, 4],
  step: 0.6,
  wheelArches: ARCHES,
  openings: [{ id: '雙艙鼻的縫', shape: 'fn', sd: noseSlotSd }],
  sideZMin: 22,
  zones: () => [
    { mat: 'moss', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.5 ? mossTopY(x) - y : -1) },
    { mat: 'moss', keep: (x, y, z) => (onRoof(x, y, z) ? 1 : -1) },
    { mat: 'log', keep: () => 1 },
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
    const onLogWall = (x, y, z) => onSideWall(x, y, z) && y > mossTopY(x) + 0.5 && archDist(x, y) > 0.8 && windowSd(x, y) > 1.6;
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
    // 人字屋頂木瓦：沿車身方向一排排平行的木瓦行（行距 2.4，從屋脊往簷口數），每行內每 3.6 mm 一道錯半片的接縫
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onRoof(x, y, z) || Math.abs(z) < 1.3) {
          return -1;
        }
        const az = Math.abs(z);
        const ph = ((az % 2.4) + 2.4) % 2.4;
        const course = 0.24 - Math.min(ph, 2.4 - ph);
        const row = Math.floor(az / 2.4);
        const q = ((((x + (row % 2) * 1.8) % 3.6) + 3.6) % 3.6);
        const joint = 0.2 - Math.min(q, 3.6 - q);
        return Math.max(course, joint);
      }),
      mat: 'dShingle',
      name: 'decal-shingles',
    });
    // 骨白屋脊板（|z| < 1.1，屋頂段）＋屋脊樑上一條骨白飾板（|z| < 1.6，x 30 → 73）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y)) {
          return -1;
        }
        const az = Math.abs(z);
        const ridge = P.eave(x) > 2.2 ? 1.1 - az : -1;
        const beam = x > 30 && x < X_FRONT - 1.5 ? Math.min(1.6 - az, x - 30) : -1;
        return Math.max(ridge, beam);
      }, { offset: 0.12 }),
      mat: 'dBone',
      name: 'decal-ridge-board',
    });
    // 簷口骨白細線（人字屋頂兩坡的下緣）
    parts.push({
      geometry: kit.decal((x, y, z) => (onTop(x, y) && P.eave(x) > 2.2 ? 0.45 - Math.abs(Math.abs(z) - P.cw(x)) : -1), { offset: 0.12 }),
      mat: 'dBone',
      name: 'decal-eave-trim',
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

    // 柵欄（stake-fence）
    const fence = buildFence();
    parts.push({ geometry: fence.stakes, mat: 'bone2', solid: true, outline: true, name: 'fence-stakes' });
    parts.push({ geometry: fence.rail, mat: 'logDark2', solid: true, outline: true, name: 'fence-rail' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    fourview: 'shared/design/body-yaga-hut/fourview.png（四視圖 23）與 fourview_trace.txt：雙艙鼻（中樑＋兩側艙）、後移座艙、收腰、車尾兩角往後伸的尖刺照圖（俯視站位被面板干擾，以看圖為準），高度縮到合法範圍（推估）',
    geometry:
      '本檔站位產生器 P（推估）：殼 x −71 → 75；肩線半寬 鼻端 24、前翼子板艙 40.5、腰 30.5、後翼子板 42.5、車尾 27（＋牆腳外張 0.7）；屋脊最高 43（x −28）、屋脊樑鼻尖 22.5；人字屋頂簷口落差 7.5；雙艙鼻縫 x > 45、6.5 < |z| < 19.5',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    fence: '柵欄：每個後角兩根方木樁（|z| 33.4 / 37.6、半寬 1.1 / 1.0、根 x −52 / −54 → 尖 x −77 / −74.5、尖長 4.2）＋橫木（x −66.5、y 33.2、半長 38.6、截面 1.6 × 1.6）；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    livery: '圓木橫紋間距 3.2；木瓦行距 2.4、接縫間距 3.6；兩扇小窗 x 9 / −7、6.4 × 6；屋脊樑飾板寬 3.2（皆為塗裝分區 / 貼紙，推估）',
    myth: '雅加婆婆的小屋（Afanasyev 故事，DESIGN.md 研究一節）：izba 圓木牆、木瓦人字屋頂、nalichnik 雕花窗框、柵欄；不做雞腳、不畫人、不做骷髏',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
