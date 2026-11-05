// 聖甲蟲凱布利推日（body-khepri-scarab，神話組・埃及；LG1 F2 擋泥板肌肉型）：
// 甲蟲本身變成車身——兩片鞘翅（elytra）＝左右分開的後擋泥板大量體，中間留一道鞘翅縫，縫底立一條金色脊線（中央隆起脊）；
// 前胸背板（pronotum）＝左右前擋泥板量體；兩者之間是明顯收腰（俯視 ±45 → ±30.5，側視肩線下凹），量體集中在四個角。
// 頭盾（clypeus）＝金色扁鏟鼻（鼻尖 x 76）；前腳＝前擋泥板兩側的鋸齒金色分流片（甲蟲前脛節的齒）。
// 大件 1 個：推動的太陽圓盤——往後躺、貼近後甲板的圓形鴨尾翼（金框＋紅玉髓盤心，後緣上翹），盤下金色龍骨埋進鞘翅縫。
// 收腰段頂面填平（不留凹槽），兩片鞘翅在中央以金色縫線相合；收腰上方是金色不透明小座艙；前胸是綠松石彩陶色。
// 設計：shared/design/body-khepri-scarab/DESIGN.md（「第十階段重塑（iter-128）」節；典故與文物對應 MYTH_RESEARCH 埃及節 E1、E2、E3、E7、E8；
// 黑名單 E10 Blue Beetle、Victory Magnum 鍬形蟲：不用 V 形引擎蓋、沒有大顎）。
// 剖面為本檔站位產生器（推估）；塗裝全為自創：青金石珍珠藍鞘翅、綠松石彩陶前胸、金色頭盾與脊、紅玉髓盤心、玄武岩黑下車身；
// 不含任何廠商 / 作品名稱、商標、文字或神的人臉。
import * as THREE from 'three';
import { makePolyBody, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：鞘翅尾端 −65、頭盾前緣 76 */
const XS = [-65, -60, -53, -46, -40, -32, -22, -12, -2, 8, 18, 28, 36, 42, 50, 56, 62, 68, 72, 76];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬：後擋泥板（鞘翅）±45、收腰 ±30.5（x −2 ~ 8）、前擋泥板（前胸）±44；頭盾往前收成扁鏟（±9）
  hw: monoCurve(XS, [18, 30, 40.5, 44, 44.4, 44.2, 41.5, 33.5, 24.5, 20.5, 21, 33.5, 41.4, 41.6, 35, 26.5, 19.5, 14, 11, 8]),
  // 中央脊線頂（鞘翅縫裡的金脊）：後段 34.5、收腰 30.6、前胸 32.8，往前降到頭盾 18
  ySpine: monoCurve(XS, [27, 30.2, 32.8, 33.6, 33.8, 33.6, 33.2, 32.8, 32.6, 32.6, 32.8, 33, 33, 32.4, 30.2, 27.4, 24, 21, 19.4, 18]),
  // 擋泥板量體頂（每片鞘翅 / 前胸的拱頂）：後 40.4、收腰 30.2、前 35.6；頭盾 18
  yF: monoCurve(XS, [27.2, 33.2, 37.2, 38.8, 39, 38.8, 37.6, 36, 34.2, 33.4, 33.6, 35, 36.2, 36, 34, 30.2, 25.4, 21.4, 19.6, 18.2]),
  // 肩線（拱頂外側的銳利稜線、側壁上緣）：擋泥板處高、收腰處低 → 側視看得到四個角的量體
  yA: monoCurve(XS, [24.5, 25.8, 26.6, 27, 27, 26.8, 26, 24.6, 22.6, 21.4, 22.4, 28.4, 31.2, 31.4, 29.4, 25, 20.6, 17.6, 16.6, 16]),
  // 側裙下緣
  yLow: monoCurve(XS, [21.5, 18, 14, 12.6, 12.4, 12.4, 12.6, 13.2, 13.8, 14, 14, 13.2, 12.4, 12.4, 12.8, 13.8, 14.8, 15.4, 15.8, 16]),
};

/** @type {number} 鞘翅縫半寬（脊線外側縫底的 z） */
const SEAM_Z = 3.4;
/** @type {number} 縫底比脊頂低多少（後段最深，往前變淺） */
const seamDepth = (x) => lerp(0.5, 0.9, Math.min(1, Math.max(0, (40 - x) / 70)));
/** @type {number} 側裙下緣往內收（肩線挑出側裙＝下半內收 tumblehome） */
const SKIRT_TUCK = 2.6;

/**
 * 半剖面 9 點：脊頂 → 脊肩 → 縫底（銳利）→ 擋泥板拱頂兩點 → 拱外側 → 肩線（銳利）→ 側壁中段 → 側裙下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = P.hw(x);
  const ys = P.ySpine(x);
  const yg = ys - seamDepth(x);
  const yF = Math.max(P.yF(x), yg + 0.4);
  const yA = P.yA(x);
  const zc = 0.6 * hw;
  return [
    [0, ys],
    [1.5, ys - 0.25],
    [SEAM_Z, yg],
    [lerp(SEAM_Z, zc, 0.45), lerp(yg, yF, 0.8)],
    [zc, yF],
    [lerp(zc, hw, 0.6), lerp(yF, yA, 0.4)],
    [hw, yA],
    [hw - SKIRT_TUCK * 0.35, lerp(yA, P.yLow(x), 0.5)],
    [hw - SKIRT_TUCK, P.yLow(x) + 0.8],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 尾端、頭盾段每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-65, -57, 2, profile).slice(0, -1), ...buildStations(-57, 62, 2.5, profile).slice(0, -1), ...buildStations(62, 76, 2, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22 },
];

/** @type {number} 分區界線：前胸（綠松石）後緣 x */
const X_PRONOTUM = 23;
/** @type {{ x: number, rx: number, ry: number, rz: number }} 座艙罩（收腰上方的金色不透明小罩） */
const COCKPIT = { x: 6, rx: 10.5, ry: 5.2, rz: 6.8 };
/** @type {number} 分區界線：頭盾後緣 x */
const X_HEAD = 58;

/** @type {{ x: number, y: number, r: number, thick: number, lean: number }} 太陽圓盤（往後躺的圓形鴨尾翼，盤面朝上、後緣上翹 lean 弧度） */
const DISC = { x: -55, y: 37.6, r: 10.8, thick: 2, lean: 0.28 };
/**
 * 由半剖面折線反查某高度的殼外表面 z（剖面點 z 由中線往外遞增、y 由上往下遞減）
 * @type {(pts: number[][], y: number) => number} 高於殼頂回傳 0，低於下緣回傳下緣 z
 */
export const profileZAtY = (pts, y) => {
  if (y >= pts[0][1]) {
    return 0;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) {
      const t = Math.abs(y1 - y0) < 1e-6 ? 0 : (y - y0) / (y1 - y0);
      return lerp(z0, z1, t);
    }
  }
  return pts[pts.length - 1][0];
};

/**
 * 輪拱內襯（參考 zeppelin-xtail 的 buildHullLiner）：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3，只取上半圈），
 * 每個角度的 z 範圍 = [zFrom, 殼內面]；殼內面 z 由該站剖面反查（外表面 − inset）。擋住從輪拱看進去的殼內空腔與底盤空隙
 * @type {(arch: { x: number, y: number, radius: number }, zFrom: number, profileFn: (x: number) => number[][], inset?: number) => THREE.BufferGeometry}
 */
export function buildProfileLiner(arch, zFrom, profileFn, inset = 1.2) {
  const r = arch.radius + 0.3;
  const n = 48;
  const a0 = 0.12;
  const a1 = Math.PI - 0.12;
  const pos = [];
  /** @type {(t: number) => number} 該角度的殼內面 z */
  const zIn = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    return Math.max(zFrom, profileZAtY(profileFn(x), y) - inset);
  };
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zFrom);
      const B = p(t1, zFrom);
      const C = p(t1, zIn(t1));
      const D = p(t0, zIn(t0));
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

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 青金石珍珠漆（亮面清漆＋微金屬）：鞘翅量體
  lapis: namedMaterial('paint-lapis-pearl', { color: 0x1f4f96, roughness: 0.26, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  // 玄武岩黑：收腰與側裙（霧面）
  basalt: namedMaterial('paint-basalt-black', { color: 0x1c1e23, roughness: 0.66 }),
  // 彩陶綠松石前胸（亮面釉）
  faience: namedMaterial('paint-faience-turquoise', { color: 0x2f9e98, roughness: 0.34, clearcoat: 0.6 }),
  // 真金屬金（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a227, metalness: 0.82, roughness: 0.32, clearcoat: 0.3 }),
  // 座艙罩：金色不透明（名稱含 -brass → Blender 金屬）
  cockpitGold: namedMaterial('trim-gold-canopy-brass', { color: 0xd4ad3a, metalness: 0.8, roughness: 0.22, clearcoat: 0.6 }),
  gold2: namedMaterial('trim-gold-brass', { color: 0xc9a227, metalness: 0.82, roughness: 0.32, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 紅玉髓：拋光寶石（亮面，只用在盤心）
  carnelian: namedMaterial('paint-carnelian-red', { color: 0xb1342a, roughness: 0.28, clearcoat: 0.8, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x1d4a78, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-basalt', { color: 0x2a2c31, roughness: 0.7, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-gold-leaf', { color: 0xd1aa35, metalness: 0.75, roughness: 0.34 }),
  dCarnelian: decalMaterial('decal-carnelian', { color: 0xb1342a, roughness: 0.32, clearcoat: 0.7 }),
  dTurquoise: decalMaterial('decal-turquoise', { color: 0x3fb8af, roughness: 0.55 }),
  dVoid: decalMaterial('decal-intake-void', { color: 0x07080a, roughness: 0.95 }),
});

/**
 * 前腳分流片（單側）：甲蟲前脛節——貼在前擋泥板側壁、往前外斜的金色平板，外緣 3 枚往外的齒（鋸齒＝挖土的前腳）
 * 俯視輪廓：根部埋進側壁 1.4 mm，外緣最多凸出 2.4 mm（半寬 ≤ 48）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildForeleg = (sg) => {
  /** @type {number[][]} 俯視折線（x, 往外凸出量），由後往前 */
  const outline = [
    [58, 0.6],
    [59.4, 2.2],
    [60.2, 1.0],
    [61.8, 2.3],
    [62, 0.9],
    [64.2, 2.0],
    [65.2, 0.6],
    [67, 0.2],
  ];
  const pts = [];
  for (const [x, d] of outline) {
    pts.push([x, sg * (P.hw(x) + d)]);
  }
  for (let i = outline.length - 1; i >= 0; i--) {
    const x = outline[i][0];
    pts.push([x, sg * (P.hw(x) - 1.4)]);
  }
  // flatPlate 需要逆時針（俯視 x, z）
  if (sg < 0) {
    pts.reverse();
  }
  return flatPlate(pts, 17.2, 1.4);
};

export const khepriScarabBody = makePolyBody({
  id: 'body-khepri-scarab',
  name: '聖甲蟲凱布利',
  style: 'myth',
  phase: 8,
  mythSeries: 'egyptian',
  mythTheme: 'khepri-scarab',
  form: 'scarab-dome',
  roof: 'closed',
  wing: 'sun-disc',
  theme: '推日的聖甲蟲擋泥板肌肉車：兩片青金石鞘翅＝分開的後擋泥板大量體、中央金縫線相合，綠松石前胸＝前擋泥板量體，中段深收腰上一個金色小座艙；金色扁鏟頭盾鼻、鋸齒前腳分流片，車尾往後躺的金框紅日盤鴨尾翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 縫底與肩線是銳利稜線
  hard: [2, 6],
  wheelArches: ARCHES,
  sideZMin: 26,
  zones: () => [
    // 頭盾：金（真金屬）
    { mat: 'gold', keep: (x, y) => Math.min(x - X_HEAD, y - (P.yA(x) + 0.25)) },
    // 中央脊（鞘翅縫裡的脊頂）：金
    { mat: 'gold', keep: (x, y, z) => Math.min(0.9 - Math.abs(z), x + 63) },
    // 肩線以下的側裙：玄武岩黑
    { mat: 'basalt', keep: (x, y) => P.yA(x) - 0.12 - y },
    // 前胸（X_PRONOTUM 以前）：綠松石彩陶
    { mat: 'faience', keep: (x) => x - X_PRONOTUM },
    // 鞘翅與收腰段頂面：青金石藍
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'basalt', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.4, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 太陽圓盤（大件，往後躺的圓形鴨尾翼）：金盤（20 段）貼在後甲板上方、後緣往上翹 lean 弧度；
    // 上下兩面紅玉髓盤心、金色圓環盤緣；盤下一片金色根部龍骨埋進鞘翅縫，讓盤從殼面長出來
    /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} 盤軸（y）往前傾 lean（盤面後緣上翹），再移到後甲板 */
    const placeDisc = (g) => {
      g.rotateZ(-DISC.lean);
      g.translate(DISC.x, DISC.y, 0);
      return g;
    };
    parts.push({ geometry: placeDisc(new THREE.CylinderGeometry(DISC.r, DISC.r, DISC.thick, 20)), mat: 'gold', solid: true, outline: true, name: 'sun-disc' });
    for (const s of [-1, 1]) {
      const core = new THREE.CylinderGeometry(6.6, 6.6, 0.4, 20);
      core.translate(0, s * (DISC.thick / 2 + 0.1), 0);
      parts.push({ geometry: placeDisc(core), mat: 'carnelian', solid: true, name: `sun-disc-core-${s > 0 ? 'top' : 'under'}` });
    }
    {
      const rim = new THREE.TorusGeometry(DISC.r, 0.85, 6, 24);
      rim.rotateX(Math.PI / 2);
      parts.push({ geometry: placeDisc(rim), mat: 'gold', solid: true, outline: true, name: 'sun-disc-rim' });
      // 根部龍骨：盤下中央一片 2.4 mm 厚的金色鰭，下緣埋進鞘翅縫的殼面
      const keel = new THREE.BoxGeometry(15, 6.4, 2.4);
      keel.translate(0.8, -DISC.thick / 2 - 3.1, 0);
      parts.push({ geometry: placeDisc(keel), mat: 'gold', solid: true, outline: true, name: 'sun-disc-keel' });
    }
    // 座艙：收腰正上方一個小的金色不透明座艙罩（橢球，下半埋進殼內）
    {
      const dome = new THREE.SphereGeometry(1, 16, 10);
      dome.scale(COCKPIT.rx, COCKPIT.ry, COCKPIT.rz);
      dome.translate(COCKPIT.x, P.ySpine(COCKPIT.x) - 0.8, 0);
      parts.push({ geometry: dome, mat: 'cockpitGold', solid: true, outline: true, name: 'cockpit-dome' });
    }
    // 前腳分流片（左右）
    parts.push({ geometry: mergeGeos([-1, 1].map(buildForeleg)), mat: 'gold2', solid: true, outline: true, name: 'foreleg-splitters' });

    // ---- 貼紙 ----
    // 鞘翅縱紋：每片鞘翅 3 道金色細線（寬 0.7 mm），沿擋泥板拱頂往車尾收攏
    const STRIAE = [0.36, 0.6, 0.8];
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > -4 || x < -62) {
          return -1;
        }
        const h = P.hw(x);
        const az = Math.abs(z);
        let d = Infinity;
        for (const f of STRIAE) {
          d = Math.min(d, Math.abs(az - f * h));
        }
        return Math.min(0.35 - d, y - P.yA(x) - 1.2, -4 - x, x + 62);
      }),
      mat: 'dGold',
      name: 'decal-elytra-striae',
    });
    // 肩線金邊（擋泥板量體外緣，收腰段斷開）＋ 縫邊綠松石細線
    parts.push({
      geometry: kit.decal((x, y) => Math.min(0.42 - Math.abs(y - (P.yA(x) + 0.5)), X_HEAD - 0.3 - x, x + 63, Math.max(-1 - x, x - 23))),
      mat: 'dGold',
      name: 'decal-fender-borders',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.36 - Math.abs(Math.abs(z) - (SEAM_Z + 0.9)), X_HEAD - 1 - x, x + 62, Math.max(-1 - x, x - 23)), { offset: 0.1 }),
      mat: 'dTurquoise',
      name: 'decal-seam-pinstripes',
    });
    // 前胸前緣的鑲嵌格帶（E2 胸飾的金框鑲嵌語彙）：金底帶＋紅玉髓小格（頭盾後緣）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(1.6 - Math.abs(x - (X_HEAD - 1.8)), y - P.yA(x) - 0.8, Math.abs(z) - SEAM_Z)), mat: 'dGold', name: 'decal-inlay-band' });
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          const ph = ((Math.abs(z) % 3.4) + 3.4) % 3.4;
          return Math.min(Math.min(ph, 3.4 - ph) - 0.4, 0.9 - Math.abs(x - (X_HEAD - 1.8)), y - P.yA(x) - 1.4, Math.abs(z) - SEAM_Z - 0.6);
        },
        { offset: 0.12 },
      ),
      mat: 'dCarnelian',
      name: 'decal-inlay-cells',
    });
    // 側面兩層量體：收腰段側壁下緣的黑色進氣口（往後上掃的平行四邊形）＋金色上緣線
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 26, side };
      /** @type {(u: number, v: number) => number} 進氣口（u = x、v = y）：下緣 13.4、上緣隨 x 往後升高 */
      const intake = (u, v) => Math.max(-6 - u, u - 21, 13.6 - v, v - lerp(19.2, 17.4, (u + 6) / 27));
      parts.push({ geometry: kit.decal(sideDecal(intake, opt)), mat: 'dVoid', name: `decal-side-intake-${side}` });
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(-6 - u, u - 21, Math.abs(v - lerp(19.2, 17.4, (u + 6) / 27) - 0.55) - 0.35), opt), { offset: 0.1 }),
        mat: 'dGold',
        name: `decal-intake-lip-${side}`,
      });
    }
    // 日盤光芒（車尾鞘翅尾端上的金色放射線 5 道，從日盤往前散開＝推日的動勢）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > -44 || x < -66) {
          return -1;
        }
        const a = Math.atan2(Math.abs(z), x - DISC.x);
        let d = Infinity;
        for (const k of [0.55, 0.85, 1.15]) {
          d = Math.min(d, Math.abs(a - k) * Math.hypot(Math.abs(z), x - DISC.x));
        }
        return Math.min(0.4 - d, y - P.yA(x) - 2, Math.abs(z) - SEAM_Z - 1.6, Math.hypot(Math.abs(z), x - DISC.x) - 12);
      }),
      mat: 'dGold',
      name: 'decal-sun-rays',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：殼長 141（鞘翅尾端 −65 ~ 頭盾鼻 76），含日盤外框長約 142.4；鞘翅量體頂 39、前胸量體頂 36.2、收腰頂 33.4（頂面填平）、日盤後緣頂約 41.6（全車最高）；寬：鞘翅 ±44.4、前胸 ±41.6、收腰 ±20.5、頭盾 ±8',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），可裝 26 / 31 mm 輪',
    disc: '日盤是往後躺的圓形鴨尾翼：金色實心 ABS 電鍍盤 R10.8 × 2 mm（20 段）、後緣上翹 16°，中心 x −55、y 37.6；上下紅玉髓盤心 R6.6；盤緣金色圓環（管半徑 0.85）；盤下金色龍骨 15 × 6.4 × 2.4 mm 埋進鞘翅縫；座艙罩：金色實心橢球 21 × 10.4 × 13.6 mm（下半埋進殼內，推估）；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    forelegs: '前腳分流片：ABS 電鍍件 1.4 mm 厚平板（推估），貼在前擋泥板側壁 x 58–67、y 17.2，外緣 3 枚齒，最多凸出側壁 2.3 mm',
    palette: '色碼取 MYTH_RESEARCH 3-2（推估，E2 Met 16.1.3 胸飾材質）：金 #C9A227、青金石 #26619C（鞘翅珍珠漆用較深的 #1F4F96）、紅玉髓 #B1342A、綠松石 #3FB8AF（前胸彩陶釉用 #2F9E98）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
