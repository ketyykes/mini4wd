// 維納斯扇貝（body-venus-scallop，神話組・羅馬）——照四視圖 31 建模的低趴楔形車：扇形放射面的寬鼻 → 長斜引擎蓋 → 圓潤的珍珠座艙 → 寬平的後甲板 → 兩階高尾翼。
// 只用維納斯的象徵物，不做人像：
// 扇貝殼 → 尾翼頂層是一片扇貝形翼板（鉸點朝前、放射肋條、波浪後緣），後甲板是從車尾放射的肋紋百葉；鼻部也是一片放射肋的扇面（鉸點在鼻尖）。
// 珍珠 → 一對圓形珍珠頭燈（金框）、渾圓的玫瑰煙燻座艙罩。
// 玫瑰 → 前後輪之間的側面三片花瓣切割（深玫瑰色、金邊）。
// 配色：珍珠白為主、玫瑰粉為圖形色、金為點綴（肋條、框線）。造型柔和，和同為羅馬的 mars-spear（尖銳、紅黑銅）明顯不同。
// 四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-venus-scallop/DESIGN.md。剖面為本檔站位產生器（推估）。塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, buildArchLiner } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）；車尾 −70、鼻尖 77 */
const XS = [-70, -64, -56, -48, -40, -30, -20, -10, 0, 10, 20, 30, 40, 48, 56, 64, 70, 74, 77];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線甲板（不含座艙罩）：低平後甲板 31.8 → 引擎蓋長斜面一路降到鼻尖 17.8（扇面鼻較厚）
  yHood: monoCurve(XS, [30, 31.2, 31.8, 31.8, 31.4, 30.4, 29.6, 29.2, 28.8, 28.6, 28.4, 28.2, 28, 26.8, 24.6, 22, 20, 18.8, 17.8]),
  // 擋泥板頂：壓低貼著輪拱（前輪 32.6、後輪 33），兩輪之間降成 27.6 的腰線
  yD: monoCurve(XS, [28, 31, 32.6, 33, 33, 31, 28.8, 27.8, 27.6, 27.8, 28.8, 31.4, 32.6, 32.2, 29.6, 25.4, 22.4, 20.4, 18.8]),
  // 半寬：車尾 33.6（避開後上導輪）、後輪 40、腰 30.4、前輪 37.2，過了前輪才外擴成比前輪還寬的扇面鼻（x 64–74 半寬 46–47，鼻尖 42）
  hw: monoCurve(XS, [33.6, 38.6, 40, 40, 39.6, 36.8, 32.8, 30.8, 30.4, 30.8, 32.4, 35.4, 37.2, 39.2, 43.4, 46.4, 47, 46, 42]),
  // 側裙下緣
  yLow: monoCurve(XS, [22, 19, 14.8, 13, 13, 13.4, 14.4, 14.6, 14.6, 14.6, 14.2, 13, 13, 13.5, 14, 14.4, 14.6, 14.8, 15]),
};

/** @type {number[]} 座艙罩前後端 x */
const CAN_X = [-26, 32];
/** @type {(x: number) => number} 座艙罩高出甲板的量（渾圓的珍珠形，頂點在 x −2） */
const canRaw = monoCurve([-26, -20, -10, -2, 8, 18, 26, 32], [0, 5.4, 10.8, 12.2, 11, 7, 2.8, 0]);
/** @type {(x: number) => number} */
const canH = (x) => (x <= CAN_X[0] || x >= CAN_X[1] ? 0 : Math.max(0, canRaw(x)));
/** @type {(x: number) => number} 座艙罩半寬 */
const canW = monoCurve([-26, -18, -4, 10, 22, 32], [6, 10, 12, 11.6, 9, 5]);

/** @type {(x: number) => number} 腰線稜高度（側面唯一的銳利稜線） */
const beltY = (x) => P.yD(x) - Math.min(4.2, 0.4 * (P.yD(x) - P.yLow(x)));

/**
 * 半剖面 8 點：中線頂 → 座艙罩肩 → 座艙罩底緣（銳利）→ 甲板 → 擋泥板頂 → 腰線稜（銳利）→ 側面 → 下緣內收
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yc = P.yHood(x);
  const h = canH(x);
  const hw = P.hw(x);
  const cw = Math.min(canW(x), hw - 8);
  const yD = P.yD(x);
  const yLow = P.yLow(x);
  const yBelt = beltY(x);
  const sh = Math.min(3.6, 0.28 * (hw - cw));
  return [
    [0, yc + h],
    [0.62 * cw, yc + 0.74 * h],
    [cw, yc + 0.06 * h],
    [cw + 0.5 * (hw - sh - cw), lerp(yc, yD, 0.55)],
    [hw - sh, yD],
    [hw, yBelt],
    [hw - 0.7, lerp(yBelt, yLow, 0.55)],
    [hw - 1.8, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 每 2 mm 一站 */
const STATIONS = buildStations(-70, 77, 2, profile);

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 在座艙罩上 */
const onCanopy = (x, z) => canH(x) > 0.5 && Math.abs(z) < Math.min(canW(x), P.hw(x) - 8) - 0.3;
/** @type {(x: number, y: number) => boolean} 在腰線稜以下的側面 */
const belowBelt = (x, y) => y < beltY(x) - 0.3;

/** @type {number[]} 珍珠頭燈中心 [x, |z|] */
const LAMP = [64.5, 24];
/** @type {number} 珍珠頭燈半徑 */
const LAMP_R = 2.5;

/** @type {{ cx: number, r0: number, halfAngle: number, ribs: number, y: number, t: number, kz: number }} 扇貝翼板：鉸點 (cx, 0)，外緣半徑 r0，放射角 ±halfAngle，橫向放大 kz 倍（窄角扇橫向放大，往車尾外張：兩角在 x −67.7、翼展 ±45，後緣伸到 x −75.5） */
const SHELL = { cx: -42, r0: 33.5, halfAngle: (40 * Math.PI) / 180, ribs: 9, y: 42.4, t: 0.7, kz: 2.1 };
/** @type {number} 尾翼端板 |z| */
const PLATE_Z = 27;
/** @type {number} 下層翼板高度 */
const TIER1_Y = 37.2;

/** @type {(phi: number) => number} 扇貝外緣半徑：肋條末端是波峰，兩肋之間凹 1.6 mm（波浪後緣） */
const shellEdge = (phi) => {
  const step = (2 * SHELL.halfAngle) / (SHELL.ribs - 1);
  const s = Math.sin((Math.PI * (phi + SHELL.halfAngle)) / step);
  return SHELL.r0 - 1.6 * s * s;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 珍珠白：亮面＋高清漆
  pearl: namedMaterial('paint-pearl-white', { color: 0xf4eee8, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08 }),
  pearl2: namedMaterial('paint-pearl-white', { color: 0xf4eee8, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  rose: namedMaterial('paint-rose-pink', { color: 0xd8577f, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  rose2: namedMaterial('paint-rose-pink', { color: 0xd8577f, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
  // 金（真金屬：名稱以 -brass 結尾）
  gold: namedMaterial('trim-gold-brass', { color: 0xd8b25a, metalness: 0.85, roughness: 0.26, clearcoat: 0.4, side: THREE.DoubleSide }),
  // 座艙罩：玫瑰煙燻透明殼
  canopy: namedMaterial('pc-smoke-rose', { color: 0x4a2532, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x2a2226, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-pearl', { color: 0xe8e0d8, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-dark', { color: 0x2a2024, roughness: 0.8, side: THREE.DoubleSide }),
  // 珍珠頭燈：帶淡淡自發光的珍珠色
  lamp: namedMaterial('lamp-pearl', { color: 0xfff6ee, emissive: 0xfff0e6, emissiveIntensity: 0.35, roughness: 0.12, clearcoat: 1 }),
  dRose: decalMaterial('decal-rose-pink', { color: 0xd8577f, roughness: 0.3 }),
  dDeep: decalMaterial('decal-rose-deep', { color: 0x8e2546, roughness: 0.34 }),
  dGold: decalMaterial('decal-gold', { color: 0xd8b25a, roughness: 0.28, metalness: 0.8 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {import('./polyBody.js').PolyBodyConfig} */
const CONFIG = {
  id: 'body-venus-scallop',
  name: '維納斯扇貝',
  style: 'myth',
  phase: 13,
  mythSeries: 'roman',
  mythTheme: 'venus',
  form: 'scallop-wedge',
  roof: 'canopy',
  wing: 'scallop-step',
  theme: '照四視圖 31 的低趴楔形車：鼻部是鉸點在鼻尖的放射肋扇面、長斜引擎蓋、渾圓的玫瑰煙燻珍珠座艙、寬平後甲板上從車尾放射的肋紋百葉，車尾兩階高尾翼的頂層是一片扇貝形翼板（放射金肋、波浪後緣）；一對圓形珍珠頭燈；前後輪之間三片玫瑰花瓣切割；珍珠白＋玫瑰粉＋金',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格放寬到 0.6 mm（車身面積大，維持面數與碰撞格耗時）
  step: 0.6,
  hard: [2, 5],
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    { mat: 'canopy', keep: (x, y, z) => (onCanopy(x, z) ? 1 : -1) },
    // 玫瑰粉下半車身：腰線稜以下，往鼻尖跟著腰線收低
    { mat: 'rose', keep: (x, y) => (belowBelt(x, y) ? 1 : -1) },
    { mat: 'pearl', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'rose', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 兩階尾翼：左右階梯側影端板（下層 37.2、上層 42.4）＋下層玫瑰翼板＋頂層扇貝翼板 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const plates = [];
      for (const sg of [-1, 1]) {
        const z = sg * PLATE_Z;
        plates.push(
          finPlate(
            [
              [-44, top(-44, z) - 1],
              [-47.5, TIER1_Y + 1.1],
              [-55.5, TIER1_Y + 1.6],
              [-58, SHELL.y + SHELL.t + 0.4],
              [-71.6, SHELL.y + SHELL.t + 0.6],
              [-71.6, top(-69, z) - 1],
            ],
            z,
            1.0,
          ),
        );
      }
      parts.push({ geometry: mergeGeos(plates), mat: 'rose2', solid: true, outline: true, name: 'step-endplates' });
      parts.push({
        geometry: flatPlate([[-48, -PLATE_Z], [-48, PLATE_Z], [-56, PLATE_Z], [-56, -PLATE_Z]], TIER1_Y, 0.7),
        mat: 'rose2',
        solid: true,
        outline: true,
        name: 'tier-wing',
      });
      // 扇貝翼板外形：鉸點前端窄口 → 波浪外緣（每 2° 一點）
      /** @type {number[][]} */
      const outline = [[SHELL.cx - 4, -3.2]];
      for (let i = 0; i <= 60; i++) {
        const phi = lerp(-SHELL.halfAngle, SHELL.halfAngle, i / 60);
        const r = shellEdge(phi);
        outline.push([SHELL.cx - r * Math.cos(phi), r * Math.sin(phi)]);
      }
      outline.push([SHELL.cx - 4, 3.2]);
      const fan = flatPlate(outline, SHELL.y, SHELL.t);
      fan.scale(1, 1, SHELL.kz);
      parts.push({ geometry: fan, mat: 'pearl2', solid: true, outline: true, name: 'scallop-wing' });
      // 鉸點座：扇貝翼板鉸點下方接到下層翼板的小梯形塊（|z| < 4）
      parts.push({
        geometry: finPlate([[-47.4, TIER1_Y + 0.6], [-46.2, SHELL.y + 0.3], [-52, SHELL.y + 0.3], [-55, TIER1_Y + 0.6]], 0, 4),
        mat: 'rose2',
        solid: true,
        name: 'scallop-hinge',
      });
      // 放射金肋：從鉸點到外緣的 9 條凸肋（寬 0.8、高 0.5）
      /** @type {THREE.BufferGeometry[]} */
      const ribs = [];
      for (let i = 0; i < SHELL.ribs; i++) {
        const phi = lerp(-SHELL.halfAngle, SHELL.halfAngle, i / (SHELL.ribs - 1));
        const r0 = 6;
        const r1 = SHELL.r0 - 0.6;
        const g = new THREE.BoxGeometry(r1 - r0, 0.5, 0.8);
        g.translate((r0 + r1) / 2, SHELL.y + SHELL.t + 0.25, 0);
        g.rotateY(Math.PI + phi);
        g.translate(SHELL.cx, 0, 0);
        ribs.push(g);
      }
      const ribGeo = mergeGeos(ribs);
      ribGeo.scale(1, 1, SHELL.kz);
      parts.push({ geometry: ribGeo, mat: 'gold', solid: true, name: 'scallop-ribs' });
    }

    // ── 珍珠頭燈：半埋在鼻部扇面兩側的圓球（16×10 分段） ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const lamps = [];
      for (const sg of [-1, 1]) {
        const g = new THREE.SphereGeometry(LAMP_R, 16, 10);
        g.scale(1, 0.75, 1);
        g.translate(LAMP[0], top(LAMP[0], sg * LAMP[1]) - 0.5, sg * LAMP[1]);
        lamps.push(g);
      }
      parts.push({ geometry: mergeGeos(lamps), mat: 'lamp', solid: true, name: 'pearl-lamps' });
    }

    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos([buildArchLiner(ARCHES[0], 21, 33.4, 0.35, Math.PI - 0.35), buildArchLiner(ARCHES[1], 21, 34, 0.35, Math.PI - 0.35)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });

    // ── 貼紙 ──
    // 鼻部扇面：鉸點在鼻尖前方 (81, 0) 的放射扇形，玫瑰粉與珍珠白交錯（每格 13°），格線是金色細線
    /** @type {(x: number, z: number) => number} 從鼻部鉸點量的角度（度） */
    const noseAng = (x, z) => (Math.atan2(Math.abs(z), 81 - x) * 180) / Math.PI;
    /** @type {(x: number, y: number, z: number) => boolean} 在鼻部扇面範圍（腰線以上、座艙罩前方、頭燈以外） */
    const onNoseFan = (x, y, z) => x > 54 && !belowBelt(x, y) && Math.hypot(x - LAMP[0], Math.abs(z) - LAMP[1]) > LAMP_R + 1.2;
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onNoseFan(x, y, z)) {
          return -1;
        }
        // 中央格（±6.5°）與每隔一格是玫瑰粉
        const a = (noseAng(x, z) + 6.5) / 13;
        const k = Math.floor(a);
        if (k % 2 !== 0) {
          return -1;
        }
        return Math.min((Math.min(a - k, k + 1 - a) * 13 * (81 - x)) / 57 - 0.35, x - 55);
      }),
      mat: 'dRose',
      name: 'decal-nose-fan',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onNoseFan(x, y, z) || x < 55.5) {
          return -1;
        }
        const a = (noseAng(x, z) + 6.5) / 13;
        const d = (Math.abs(a - Math.round(a)) * 13 * (81 - x)) / 57;
        return 0.32 - d;
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-nose-fan-lines',
    });
    // 珍珠頭燈金框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = Math.hypot(x - LAMP[0], Math.abs(z) - LAMP[1]);
        return Math.min(d - LAMP_R + 0.2, LAMP_R + 0.9 - d);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-lamp-bezels',
    });
    // 後甲板肋紋百葉：從車尾外 (−84, 0) 放射的 5 道玫瑰粉肋（每道 5°，間隔 12°），座艙罩後方到尾翼前
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > -27 || x < -66 || belowBelt(x, y) || Math.abs(z) > P.hw(x) - 4.5) {
          return -1;
        }
        const a = (Math.atan2(z, x + 84) * 180) / Math.PI / 12;
        const d = Math.abs(a - Math.round(a)) * 12;
        return Math.min(2.5 - d, Math.abs(Math.round(a)) <= 2 ? 1 : -1, -27 - x, Math.hypot(x + 84, z) - 20) * 1.5;
      }),
      mat: 'dRose',
      name: 'decal-deck-ribs',
    });
    // 側面玫瑰花瓣切割：前後輪之間三片從前下方往後上展開的花瓣（深玫瑰、金邊）
    /** @type {number[][]} 每片花瓣 [起點 x, 起點 y, 角度（度，0 = 往後）, 長, 半寬] */
    const PETALS = [
      [17, 17.2, 4, 27, 3.6],
      [15, 19.4, 24, 21, 2.9],
      [19, 15.4, -12, 21, 2.6],
    ];
    /** @type {(petal: number[], x: number, y: number) => number} 到單片花瓣的近似距離（正值 = 在花瓣內） */
    const petalOne = ([px, py, deg, len, w], x, y) => {
      const a = (deg * Math.PI) / 180;
      const dx = px - x;
      const dy = y - py;
      const u = dx * Math.cos(a) + dy * Math.sin(a);
      const v = -dx * Math.sin(a) + dy * Math.cos(a);
      if (u < 0 || u > len) {
        return -Math.min(Math.abs(u), Math.abs(u - len)) - Math.abs(v);
      }
      return w * Math.sin((Math.PI * u) / len) - Math.abs(v);
    };
    /** @type {(x: number, y: number) => number} 到花瓣聯集的近似距離 */
    const petalSd = (x, y) => Math.max(...PETALS.map((pt) => petalOne(pt, x, y)));
    /** @type {(x: number, y: number) => number} 到最近一片花瓣邊線的距離（每片各自描金邊） */
    const petalEdge = (x, y) => Math.min(...PETALS.map((pt) => Math.abs(petalOne(pt, x, y))));
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < P.hw(x) - 4 ? -1 : Math.min(petalSd(x, y) - 0.4, archRingDist(x, y) - 0.8, y - 11.2))),
      mat: 'dDeep',
      name: 'decal-rose-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < P.hw(x) - 4 ? -1 : Math.min(0.4 - petalEdge(x, y), archRingDist(x, y) - 0.8, y - 11.2)), { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-petal-rims',
    });
    // 腰線稜上的金色細線與座艙罩金框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onCanopy(x, z) || x < -69 || x > 74) {
          return -1;
        }
        const belt = Math.abs(z) > P.hw(x) - 4 ? 0.32 - Math.abs(y - beltY(x)) : -1;
        const cw = Math.min(canW(x), P.hw(x) - 8);
        const rim = canH(x) > 0.5 ? 0.45 - Math.abs(Math.abs(z) - cw - 0.4) : -1;
        return Math.max(Math.min(belt, archRingDist(x, y) - 0.5), rim);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-gold-lines',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，比例照四視圖 31）：殼 x −70 → 77；中線甲板 後甲板 32.6 → 鼻尖 16.5；座艙罩高出甲板 9.8（頂 ≈ 39.8，x −2）；擋泥板頂 前輪 33.6、後輪 34.6、腰 28.6；半寬 車尾 33.6、後輪 40、腰 30.4、前輪 37.2、鼻部 x 64–74 外擴到 46–47、鼻尖 42',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯用 gazelle 的 buildArchLiner',
    wing: '兩階尾翼：端板（厚 1.0，|z| 27）、下層翼板（厚 0.7、y 37.2）、扇貝翼板（厚 0.7、y 42.4、鉸點 x −42、外緣半徑 33.5（後緣 x −75.5）、±40°、橫向放大 2.1 倍成往車尾外張的扇形（兩角 x −67.7、翼展 ±45）、9 條放射金肋 0.8 × 0.5）、鉸點座，皆為實心 ABS 件，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    symbols: '扇貝殼：Pompeii「Casa della Venere in conchiglia」花園壁畫（Wikipedia〈Venus (mythology)〉）；玫瑰：Porta Collina 的維納斯祭儀獻玫瑰（同條目）；珍珠：凱撒在 Venus Genetrix 神廟獻上鑲不列顛珍珠的胸甲（Wikipedia〈Temple of Venus Genetrix〉）。造型皆為抽象化的車身零件與貼紙，不出人像',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

/** @type {import('./types').BodyDef} */
export const venusScallopBody = makePolyBody(CONFIG);
