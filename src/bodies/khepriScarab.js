// 聖甲蟲凱布利推日（body-khepri-scarab，第八階段神話組・埃及；第九階段 iter-120 改成推日的淚滴楔形全罩）：
// 甲殼前高後低——前胸背板（pronotum）最高、兩片鞘翅（elytra）往後壓低並收尖成淚滴形尖尾；俯視前寬後尖，前後輪全罩。
// 車頭是金色扁鏟頭盾（clypeus）做成的前保桿，兩支金色前腿從頭盾下緣往前托住鼻前的紅玉髓日輪（推日：日輪在導輪之間、車長內）；
// 鞘翅分縫＝金色寬中線條（賽車中線條，從頭盾一路到尾尖），兩側綠松石細邊；鞘翅是青金石珍珠漆（亮面清漆，炫砲手法 5）。
// 設計：shared/design/body-khepri-scarab/DESIGN.md（典故與文物對應 MYTH_RESEARCH 埃及節 E1、E2、E3、E7、E8；黑名單 E10 Blue Beetle、Victory Magnum 鍬形蟲）。
// 剖面為本檔站位產生器（推估）：超橢圓（指數 2.2）甲蟲圓頂＋鞘翅緣稜線下方往內收的黑色側裙。
// 塗裝全為自創：青金石珍珠藍鞘翅、彩陶綠松石前胸（霧面）、金色頭盾與中線條（金屬）、紅玉髓日輪（亮面）、玄武岩黑側裙；
// 不含任何廠商 / 作品名稱、商標、文字或神的人臉。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：鞘翅尾端 −70、頭盾前緣 76（日輪前緣約 79.9） */
const XS = [-70, -66, -60, -52, -43, -32, -18, -4, 10, 19, 26, 32, 40, 46, 50, 54, 60, 66, 72, 76];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（鞘翅緣稜線）：聖甲蟲的比例——鞘翅比前胸寬（42.2 vs 36.8）、x 26 前胸 / 鞘翅交界的深腰（24.5，甲蟲的招牌縮頸）、鞘翅往後收成寬圓的尾端（29）；
  // 頭盾 x 54 → 74 收成扁鏟形前保桿（31 → 10.5）
  hw: monoCurve(XS, [29, 35, 39.5, 41.8, 42.2, 42.2, 41.6, 40, 37.5, 31, 24.5, 34, 36.8, 35.6, 31, 24, 19, 15.5, 12, 9]),
  // 中線殼頂：前胸頂 42.4（x 10）最高，鞘翅往後一路壓低到尾端 25（前高後低的楔形）；前胸往前降到頭盾 18.5（鼻尖低）
  yTop: monoCurve(XS, [24, 26, 29, 32.5, 35.5, 38.5, 40.8, 42, 42.4, 41.6, 40.8, 41, 39.5, 36.6, 33.6, 29.6, 25, 21.5, 19.5, 18.5]),
  // 鞘翅緣稜線高度（圓頂下緣、側裙上緣）
  yA: monoCurve(XS, [21.5, 21, 20.5, 20, 19.8, 19.5, 19.5, 19.5, 19.5, 19.5, 19.5, 19.5, 19.5, 19.3, 19, 18.5, 17.5, 17, 16.5, 16]),
  // 側裙下緣
  yLow: monoCurve(XS, [21, 19.5, 16.5, 13.2, 11.5, 11, 11, 11, 11, 11, 11, 11.2, 11.5, 11.8, 12, 12.5, 13.5, 14.2, 14.8, 15]),
};

/** @type {number} 圓頂超橢圓指數（> 2 → 比橢圓飽滿，甲蟲背的「肩」比較方） */
const N_EXP = 2.2;
/** @type {number[]} 圓頂剖面點的角度（度；90 = 中線頂、0 = 鞘翅緣稜線） */
const DOME_ANGLES = [90, 76, 61, 46, 31, 16, 0];
/** @type {number} 側裙下緣往內收（鞘翅緣挑出側裙＝下半內收 tumblehome） */
const SKIRT_TUCK = 2.2;

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

/** @type {{ x: number, pts: number[][] }[]} 尾尖、頭盾段每 1 mm 一站（曲率大），中段每 2 mm */
const STATIONS = [...buildStations(-70, -60, 1, profile).slice(0, -1), ...buildStations(-60, 56, 2, profile).slice(0, -1), ...buildStations(56, 76, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22 },
];

/** @type {number} 分區界線：前胸 / 鞘翅交界 x */
const X_ELYTRA_FRONT = 26;
/** @type {number} 分區界線：頭盾後緣 x */
const X_HEAD = 52;

/** @type {{ x: number, y: number, r: number, thick: number, lean: number }} 日輪（實心薄盤，盤面朝前、往後仰 lean 弧度；鼻前推日） */
const DISC = { x: 77.6, y: 21, r: 6.5, thick: 2, lean: 0.35 };

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
  // iter-120：青金石珍珠漆（亮面清漆＋微金屬，評審「塑膠感偏平」）
  lapis: namedMaterial('paint-lapis-pearl', { color: 0x1f4f96, roughness: 0.26, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
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
 * 頭盾 6 枚金齒：左右頭盾弧緣各 3 枚（沿俯視外法線；鼻端正前方留給日輪）
 * @type {() => THREE.BufferGeometry}
 */
const buildClypeusTeeth = () => {
  const geos = [];
  for (const sg of [-1, 1]) {
    for (const xt of [72, 67, 62]) {
      const h = P.hw(xt);
      const dh = (P.hw(xt + 0.5) - P.hw(xt - 0.5)) / 1;
      // 外法線 ∝ (−dh, 1)（俯視：x 增加時半寬減少 → 法線朝前外）
      const len = Math.hypot(dh, 1);
      geos.push(buildTooth(xt, sg * h, -dh / len, sg / len, P.yA(xt) + 0.8, 3.4, 2.2));
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
  theme: '推日的淚滴楔形甲蟲全罩：前胸最高、鞘翅往後壓低收尖；金色扁鏟頭盾前保桿與兩支金前腿托住鼻前的紅玉髓日輪；鞘翅分縫＝金色寬中線條、青金石珍珠漆鞘翅＋金縱紋——推動太陽的晨日聖甲蟲',
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
    // 日輪（推日）：紅玉髓實心薄盤（16 段），盤面朝前、往後仰 20°，立在鼻前導輪之間；金框圓環（6 × 24 段）
    /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} 盤軸（y）轉成朝前往上仰，再移到鼻前 */
    const placeDisc = (g) => {
      g.rotateZ(-Math.PI / 2 + DISC.lean);
      g.translate(DISC.x, DISC.y, 0);
      return g;
    };
    parts.push({ geometry: placeDisc(new THREE.CylinderGeometry(DISC.r, DISC.r, DISC.thick, 16)), mat: 'carnelian', solid: true, outline: true, name: 'sun-disc' });
    {
      const rim = new THREE.TorusGeometry(DISC.r, 0.7, 6, 24);
      // 圓環在 xy 平面（軸 z）→ 先轉成軸 y，再跟盤一起擺
      rim.rotateX(Math.PI / 2);
      parts.push({ geometry: placeDisc(rim), mat: 'gold', solid: true, outline: true, name: 'sun-disc-rim' });
    }
    // 金色前腿：從頭盾下緣兩側往前伸、托住日輪下半的兩支細腿（橢圓斷面 1.1 × 0.8）
    {
      /** @type {THREE.BufferGeometry[]} */
      const legs = [];
      for (const sg of [-1, 1]) {
        const pts = [
          [64, P.yA(64) - 0.6, sg * (P.hw(64) - 2.6)],
          [71, 16.4, sg * 9.5],
          [76.2, 16.2, sg * 5.6],
          [78.6, 17.6, sg * 3.6],
        ];
        legs.push(sweepEllipse(pts, 12, (t) => [lerp(1.1, 0.7, t), lerp(0.85, 0.6, t)], 8));
      }
      parts.push({ geometry: smoothNormals(mergeGeos(legs)), mat: 'gold', solid: true, outline: true, name: 'fore-legs' });
    }
    // 頭盾前緣 6 枚金齒（clypeus 鋸齒）
    parts.push({ geometry: buildClypeusTeeth(), mat: 'gold2', solid: true, outline: true, name: 'clypeus-teeth' });
    // 複眼：頭盾兩側一對花崗岩黑半球（iter-120 移到 x 59，離開前輪）
    const eyes = [-1, 1].map((sg) => {
      const e = new THREE.SphereGeometry(2.3, 12, 8);
      e.scale(1.25, 0.9, 1);
      e.translate(59, P.yA(59) + 1.6, sg * (P.hw(59) - 1.1));
      return e;
    });
    parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, outline: true, name: 'eyes' });

    // ---- 貼紙 ----
    // 鞘翅縱紋：每片鞘翅 4 道金色細線（寬 0.66 mm），沿俯視半寬的固定比例走，往車尾收攏
    const STRIAE = [0.22, 0.42, 0.62, 0.81];
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > X_ELYTRA_FRONT - 2.2 || x < -65) {
          return -1;
        }
        const h = P.hw(x);
        const az = Math.abs(z);
        let d = Infinity;
        for (const f of STRIAE) {
          d = Math.min(d, Math.abs(az - f * h));
        }
        return Math.min(0.33 - d, y - P.yA(x) - 1.2, X_ELYTRA_FRONT - 2.2 - x, x + 65, Math.abs(z) - 4.6);
      }),
      mat: 'dGold',
      name: 'decal-elytra-striae',
    });
    // 鞘翅緣金線（沿稜線上方）＋前胸前後緣金線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const margin = Math.min(0.4 - Math.abs(y - (P.yA(x) + 0.45)), X_HEAD - 0.3 - x, x + 67.5);
        const top = y - P.yA(x) - 0.6;
        const rear = Math.min(0.75 - Math.abs(x - (X_ELYTRA_FRONT - 0.75)), top, Math.abs(z) - 4.6);
        const front = Math.min(0.7 - Math.abs(x - (X_HEAD - 0.9)), top, Math.abs(z) - 4.6);
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
      return Math.min(dz - 0.4, 0.95 - Math.abs(x - 29), y - P.yA(x) - 2.4, Math.abs(z) - 4.6);
    };
    parts.push({ geometry: kit.decal((x, y) => Math.min(1.75 - Math.abs(x - 29), y - P.yA(x) - 1.8)), mat: 'dGold', name: 'decal-inlay-band' });
    parts.push({ geometry: kit.decal(cellSd, { offset: 0.12 }), mat: 'dCarnelian', name: 'decal-inlay-cells' });
    // 前胸中央一道青金石細縱線（前胸背板的中線溝）
    // 鞘翅分縫＝金色寬中線條（賽車中線條，寬 6 mm，從頭盾後緣一路到尾尖）＋兩側綠松石細邊（0.7 mm）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(3 - Math.abs(z), X_HEAD - x, y - P.yA(x) - 0.6), { offset: 0.1 }), mat: 'dGold', name: 'decal-center-stripe' });
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - 3.75), X_HEAD - x, y - P.yA(x) - 0.6), { offset: 0.1 }),
      mat: 'dTurquoise',
      name: 'decal-center-pinstripes',
    });
    // 鞘翅中縫（中線條正中一道青金石細線＝左右鞘翅的接縫）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.3 - Math.abs(z), X_ELYTRA_FRONT - x, y - P.yA(x) - 0.6), { offset: 0.14 }), mat: 'dLapis', name: 'decal-elytra-suture' });
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
    geometry: '本檔站位產生器 P（推估，iter-120）：長 150.8（鞘翅尾端 −70 ~ 日輪前緣 80.8，≤ 153，SPEC 1.14a）、前胸頂 42.4（x 10，全車最高）往後壓低到尾端 25、往前降到頭盾鼻端 18.5；寬：鞘翅 ±42.2、前胸 ±36.8、x 26 深腰 ±24.5、頭盾鼻端 ±9；俯視半寬依輪廓 IoU 掃描決定',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），可裝 26 / 31 mm 輪',
    disc: 'iter-120 日輪移到鼻前（推日）：紅玉髓色實心 ABS 薄盤 R6.5 × 2 mm（16 段）、盤面朝前往後仰 20°，中心 x 77.6、y 21（在左右前導輪 |z| 35.5 以內、車長內）＋金框（圓環斷面 R0.7，6 × 24 段）；兩支金色前腿（橢圓斷面 φ2.2 → φ1.4）從頭盾下緣托住日輪；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    teeth: '頭盾 6 枚金齒：ABS 電鍍件 1.2 mm 厚三角片（推估），左右頭盾弧緣各 3 枚（iter-120：鼻端正前方讓給日輪）',
    palette: '色碼取 MYTH_RESEARCH 3-2（推估）：金 #C9A227、青金石 #26619C、紅玉髓 #B1342A、綠松石 #3FB8AF（E2 Met 16.1.3 胸飾材質）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});

