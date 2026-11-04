// 聖甲蟲凱布利推日（body-khepri-scarab，第八階段神話組・埃及）：短胖的橢圓甲蟲背全罩——
// 前段是較小的前胸背板（pronotum，前緣往下一階接頭部）、後段兩片鞘翅（elytra，中線一道金色接縫、金色縱紋），
// 頭部是往前下斜的扁鏟形頭盾（clypeus），前緣一圈 6 枚金色小齒；車尾鞘翅接縫的末端立一面紅玉髓日輪（實心薄盤＋金框，不加放射紋）。
// 設計：shared/design/body-khepri-scarab/DESIGN.md（典故與文物對應 MYTH_RESEARCH 埃及節 E1、E2、E3、E7、E8；黑名單 E10 Blue Beetle、Victory Magnum 鍬形蟲）。
// 剖面為本檔站位產生器（推估）：超橢圓（指數 2.5）甲蟲圓頂＋鞘翅緣稜線下方的黑色側裙。
// 塗裝全為自創：青金石藍鞘翅（霧面）、彩陶綠松石前胸（霧面）、金色頭盾與細線（金屬）、紅玉髓日輪（亮面）、玄武岩黑側裙；
// 不含任何廠商 / 作品名稱、商標、文字或神的人臉。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −60、頭盾前緣 68.5（金齒尖到 71） */
const XS = [-60, -58, -54, -48, -40, -28, -14, 0, 12, 17, 22, 27, 34, 42, 46, 49, 51, 58, 63, 66, 68.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（鞘翅緣稜線）：鞘翅最寬 40（x −14）、x 22 前胸 / 鞘翅交界的深腰（25.5，甲蟲前胸與鞘翅之間的明顯縮頸）、前胸最寬 35.5、
  // x 46 → 49 前胸前角往內收一大階，接較窄的扁鏟頭（半寬 ≤ 20.5，留在輪拱切口 |z| 22 以內，頭側不被輪拱切開）
  hw: monoCurve(XS, [6, 14, 21.5, 29.5, 36, 39.5, 40, 39, 36.5, 30, 25.5, 30, 35, 35.5, 34, 23, 20.5, 19.5, 17, 13, 7.5]),
  // 中線殼頂：鞘翅最高 48（x −14）往後圓圓地收到車尾；x 22 腰部微凹；x 46–51 前胸前緣往下一階接扁平頭盾
  yTop: monoCurve(XS, [26, 31, 37, 42, 45.5, 47.5, 48, 47.2, 45.5, 44.3, 43, 43.6, 43, 40.4, 38.2, 33.2, 30.6, 26.4, 23.6, 21.6, 19.8]),
  // 鞘翅緣稜線高度（圓頂下緣、側裙上緣）
  yA: monoCurve(XS, [23, 22.5, 21.5, 20.5, 20, 19.5, 19.5, 19.5, 19.5, 19.5, 19.5, 19.5, 19.5, 19.5, 19.3, 19, 18.7, 17.8, 16.8, 16.2, 15.6]),
  // 側裙下緣
  yLow: monoCurve(XS, [21, 19, 15.5, 12, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11.5, 11.8, 12, 12.4, 13.4, 14, 14.5, 15]),
};

/** @type {number} 圓頂超橢圓指數（> 2 → 比橢圓飽滿，甲蟲背的「肩」比較方） */
const N_EXP = 2.5;
/** @type {number[]} 圓頂剖面點的角度（度；90 = 中線頂、0 = 鞘翅緣稜線） */
const DOME_ANGLES = [90, 76, 61, 46, 31, 16, 0];
/** @type {number} 側裙下緣往內收（鞘翅緣稍微挑出側裙） */
const SKIRT_TUCK = 1.4;

/** @type {(v: number) => number} 超橢圓座標映射 */
const se = (v) => Math.sign(v) * Math.abs(v) ** (2 / N_EXP);

/**
 * 半剖面 8 點：超橢圓圓頂 7 點（中線頂 → 鞘翅緣稜線）＋側裙下緣 1 點
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = P.hw(x);
  const yA = P.yA(x);
  const ry = P.yTop(x) - yA;
  const dome = DOME_ANGLES.map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [hw * se(Math.cos(a)), yA + ry * se(Math.sin(a))];
  });
  return [...dome, [hw - SKIRT_TUCK, P.yLow(x)]];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾、頭盾段每 0.75 mm 一站（曲率大），中段每 2 mm */
const STATIONS = [...buildStations(-60, -50, 0.75, profile).slice(0, -1), ...buildStations(-50, 56, 2, profile).slice(0, -1), ...buildStations(56, 68.5, 0.75, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22 },
];

/** @type {number} 分區界線：前胸 / 鞘翅交界 x */
const X_ELYTRA_FRONT = 22.6;
/** @type {number} 分區界線：頭盾後緣 x */
const X_HEAD = 50.4;

/** @type {{ x: number, y: number, r: number, thick: number }} 日輪（實心薄盤，盤面朝側面；立在鞘翅接縫末端） */
const DISC = { x: -48, y: 46.5, r: 9.5, thick: 2 };

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
  // 青金石：霧面石材（paint- 且 roughness > 0.5 → Blender 緞面）
  lapis: namedMaterial('paint-lapis-blue', { color: 0x26619c, roughness: 0.6, clearcoat: 0.1 }),
  // 彩陶（faience）綠松石：霧面釉
  faience: namedMaterial('paint-faience-turquoise', { color: 0x2f9e98, roughness: 0.56, clearcoat: 0.15 }),
  // 玄武岩黑側裙（霧面）
  basalt: namedMaterial('paint-basalt-black', { color: 0x1c1e23, roughness: 0.66 }),
  // 真金屬金（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a227, metalness: 0.82, roughness: 0.32, clearcoat: 0.3 }),
  gold2: namedMaterial('trim-gold-brass', { color: 0xc9a227, metalness: 0.82, roughness: 0.32, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 紅玉髓：拋光寶石（亮面，只用在日輪與鑲嵌格）
  carnelian: namedMaterial('paint-carnelian-red', { color: 0xb1342a, roughness: 0.28, clearcoat: 0.8 }),
  // 花崗岩黑眼（同 E7 聖蛇冠飾的「花崗岩黑眼」）：亮面
  eye: namedMaterial('paint-granite-black-eye', { color: 0x121316, roughness: 0.18, clearcoat: 1.0 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x1d4a78, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-basalt', { color: 0x2a2c31, roughness: 0.7, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-gold-leaf', { color: 0xd1aa35, metalness: 0.75, roughness: 0.34 }),
  dCarnelian: decalMaterial('decal-carnelian', { color: 0xb1342a, roughness: 0.32, clearcoat: 0.7 }),
  dTurquoise: decalMaterial('decal-turquoise', { color: 0x3fb8af, roughness: 0.55 }),
  dLapis: decalMaterial('decal-lapis', { color: 0x26619c, roughness: 0.55 }),
});

/**
 * 頭盾金齒（單枚）：水平三角薄片，根部埋進頭盾邊緣 1.6 mm，往外伸出 len
 * @type {(x: number, z: number, nx: number, nz: number, y: number, base: number, len: number) => THREE.BufferGeometry}
 */
const buildTooth = (x, z, nx, nz, y, base, len) => {
  // 切線方向（俯視）
  const tx = -nz;
  const tz = nx;
  const bx = x - nx * 1.6;
  const bz = z - nz * 1.6;
  const pts = [
    [bx + (tx * base) / 2, bz + (tz * base) / 2],
    [x + nx * len, z + nz * len],
    [bx - (tx * base) / 2, bz - (tz * base) / 2],
  ];
  return flatPlate(pts, y - 0.6, 1.2);
};

/**
 * 頭盾 6 枚金齒：鼻端封口前方 2 枚（朝前）＋左右頭盾弧緣各 2 枚（沿俯視外法線）
 * @type {() => THREE.BufferGeometry}
 */
const buildClypeusTeeth = () => {
  const geos = [];
  const xEnd = XS[XS.length - 1];
  for (const sg of [-1, 1]) {
    // 前緣 2 枚（z ±3.8，朝前）
    geos.push(buildTooth(xEnd, sg * 3.8, 1, 0, P.yA(xEnd) + 0.8, 3.6, 2.4));
    // 弧緣 2 枚：外法線由俯視半寬曲線的斜率求得
    for (const xt of [65.6, 61.2]) {
      const h = P.hw(xt);
      const dh = (P.hw(xt + 0.5) - P.hw(xt - 0.5)) / 1;
      // 外法線 ∝ (−dh, 1)（俯視：x 增加時半寬減少 → 法線朝前外）
      const len = Math.hypot(dh, 1);
      geos.push(buildTooth(xt, sg * h, -dh / len, sg / len, P.yA(xt) + 0.8, 3.6, 2.2));
    }
  }
  return mergeGeos(geos);
};

/** @type {number[]} 翼帶前後端（側視 u = x） */
const WING_U = [-20.5, 20.5];

/**
 * 有翼聖甲蟲的翼帶（側裙貼紙，E3 有翼聖甲蟲護身符的語彙、造型自繪）：前後輪之間的側裙上一條往後收窄的翼帶（金底）
 * @type {(u: number, v: number) => number} 負值 = 在翼帶內
 */
const wingBand = (u, v) => {
  const [u0, u1] = WING_U;
  // 翼帶下緣往後升高 → 翼尖收窄
  const bottom = lerp(17.2, 12.2, (u - u0) / (u1 - u0));
  return Math.max(u0 - u, u - u1, bottom - v, v - 19.0);
};

/** @type {(u: number) => number} 翼帶羽片分隔：正值 = 在金色分隔線上（每 2.7 mm 一道，線寬 0.7） */
const wingSep = (u) => {
  const ph = (((u - WING_U[0]) % 2.7) + 2.7) % 2.7;
  return 0.35 - Math.min(ph, 2.7 - ph);
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
  theme: '短胖橢圓甲蟲背全罩：前胸背板＋兩片鞘翅（金色中縫與縱紋）、扁鏟頭盾前緣 6 枚金齒，車尾立一面紅玉髓日輪——推動太陽的晨日聖甲蟲',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 鞘翅緣稜線（圓頂與側裙交界）是唯一的銳利稜線
  hard: [6],
  wheelArches: ARCHES,
  sideZMin: 30,
  zones: () => [
    // 頭盾：金（真金屬）
    { mat: 'gold', keep: (x, y) => Math.min(x - X_HEAD, y - (P.yA(x) + 0.25)) },
    // 鞘翅緣稜線以下的側裙：玄武岩黑
    { mat: 'basalt', keep: (x, y) => P.yA(x) - 0.12 - y },
    // 前胸背板：彩陶綠松石
    { mat: 'faience', keep: (x) => x - X_ELYTRA_FRONT },
    // 鞘翅：青金石藍
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'basalt', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）：從輪拱切口看進去是深灰輪弧，不是殼內空腔
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.4, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 鞘翅中縫：金色半圓細脊（實體），從前胸交界沿中線一路接到日輪底座
    const seamPts = [];
    for (let x = 21.6; x >= -40.5; x -= 2) {
      seamPts.push([x, P.yTop(x) - 0.15, 0]);
    }
    parts.push({ geometry: smoothNormals(sweepEllipse(seamPts, 90, () => [0.85, 0.75], 12)), mat: 'gold', solid: true, outline: true, name: 'elytra-seam' });
    // 日輪：紅玉髓實心薄盤（盤面朝側面、底部埋進鞘翅 4 mm）＋金框；不加放射紋（MYTH_RESEARCH 3-3、H3）
    const disc = new THREE.CylinderGeometry(DISC.r, DISC.r, DISC.thick, 64);
    disc.rotateX(Math.PI / 2);
    disc.translate(DISC.x, DISC.y, 0);
    parts.push({ geometry: disc, mat: 'carnelian', solid: true, outline: true, name: 'sun-disc' });
    const rim = new THREE.TorusGeometry(DISC.r, 0.85, 12, 96);
    rim.translate(DISC.x, DISC.y, 0);
    parts.push({ geometry: rim, mat: 'gold', solid: true, outline: true, name: 'sun-disc-rim' });
    // 頭盾前緣 6 枚金齒（clypeus 鋸齒）
    parts.push({ geometry: buildClypeusTeeth(), mat: 'gold2', solid: true, outline: true, name: 'clypeus-teeth' });
    // 複眼：頭側一對花崗岩黑半球（頭盾與前胸交界的兩側）
    const eyes = [-1, 1].map((sg) => {
      const e = new THREE.SphereGeometry(2.3, 20, 14);
      e.scale(1.25, 0.9, 1);
      e.translate(53, P.yA(53) + 1.6, sg * (P.hw(53) - 1.1));
      return e;
    });
    parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, outline: true, name: 'eyes' });

    // ---- 貼紙 ----
    // 鞘翅縱紋：每片鞘翅 4 道金色細線（寬 0.66 mm），沿俯視半寬的固定比例走，往車尾收攏
    const STRIAE = [0.22, 0.42, 0.62, 0.81];
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > X_ELYTRA_FRONT - 2.2 || x < -55) {
          return -1;
        }
        const h = P.hw(x);
        const az = Math.abs(z);
        let d = Infinity;
        for (const f of STRIAE) {
          d = Math.min(d, Math.abs(az - f * h));
        }
        return Math.min(0.33 - d, y - P.yA(x) - 1.2, X_ELYTRA_FRONT - 2.2 - x, x + 55);
      }),
      mat: 'dGold',
      name: 'decal-elytra-striae',
    });
    // 鞘翅緣金線（沿稜線上方）＋前胸前後緣金線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const margin = Math.min(0.4 - Math.abs(y - (P.yA(x) + 0.45)), X_HEAD - 0.3 - x, x + 57.5);
        const top = y - P.yA(x) - 0.6;
        const rear = Math.min(0.75 - Math.abs(x - (X_ELYTRA_FRONT - 0.75)), top);
        const front = Math.min(0.7 - Math.abs(x - (X_HEAD - 0.9)), top);
        return Math.max(margin, rear, front);
      }),
      mat: 'dGold',
      name: 'decal-gold-borders',
    });
    // 前胸後緣的鑲嵌格帶（E2 胸飾的金框鑲嵌語彙）：金底帶＋紅玉髓小格
    /** @type {(x: number, y: number, z: number) => number} 鑲嵌小格（沿 z 每 3.4 mm 一格、金縫 0.8） */
    const cellSd = (x, y, z) => {
      const ph = ((Math.abs(z) % 3.4) + 3.4) % 3.4;
      const dz = Math.min(ph, 3.4 - ph);
      return Math.min(dz - 0.4, 0.95 - Math.abs(x - 25.6), y - P.yA(x) - 2.4);
    };
    parts.push({ geometry: kit.decal((x, y) => Math.min(1.75 - Math.abs(x - 25.6), y - P.yA(x) - 1.8)), mat: 'dGold', name: 'decal-inlay-band' });
    parts.push({ geometry: kit.decal(cellSd, { offset: 0.12 }), mat: 'dCarnelian', name: 'decal-inlay-cells' });
    // 前胸中央一道青金石細縱線（前胸背板的中線溝）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.4 - Math.abs(z), x - 28, X_HEAD - 3 - x)), mat: 'dLapis', name: 'decal-pronotum-midline' });
    // 側裙上的有翼聖甲蟲翼帶（前後輪之間）：金底、上排紅玉髓覆羽、下排綠松石飛羽
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 30, side };
      parts.push({ geometry: kit.decal(sideDecal(wingBand, opt)), mat: 'dGold', name: `decal-wing-band-${side}` });
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(wingBand(u, v) + 0.6, 16.95 - v, -wingSep(u)), opt), { offset: 0.12 }),
        mat: 'dCarnelian',
        name: `decal-wing-coverts-${side}`,
      });
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(wingBand(u, v) + 0.6, v - 16.25, -wingSep(u)), opt), { offset: 0.12 }),
        mat: 'dTurquoise',
        name: `decal-wing-feathers-${side}`,
      });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：長 131（車尾 −60 ~ 頭盾金齒尖 71，batch2 規格「長約 125–135、短胖」）、鞘翅頂 48、日輪頂 57.4（batch2「高約 44–50」＋日輪「直立、不超高」）；寬 ±40（鞘翅最寬）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），可裝 26 / 31 mm 輪',
    disc: '日輪：紅玉髓色實心 ABS 薄盤 R9.5 × 2 mm＋金框（圓環斷面 R0.85）；盤底埋進鞘翅約 5 mm（和殼面接成一體）；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    teeth: '頭盾 6 枚金齒：ABS 電鍍件 1.2 mm 厚三角片（推估）；齒數取 batch2 規格「前緣 5–6 個小齒」',
    palette: '色碼取 MYTH_RESEARCH 3-2（推估）：金 #C9A227、青金石 #26619C、紅玉髓 #B1342A、綠松石 #3FB8AF（E2 Met 16.1.3 胸飾材質）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});

