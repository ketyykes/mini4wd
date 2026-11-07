// 維納斯扇貝（body-venus-scallop，神話組・羅馬）——照四視圖 31 建模的低趴楔形車：扇貝鼻 → 長斜引擎蓋 → 圓潤的珍珠座艙 → 後甲板橫條紋 → 3 階階梯鴨尾。
// 只用維納斯的象徵物，不做人像：
// 扇貝殼 → 鼻部置中一片海水綠扇貝（兩道同心生長線、金色波浪外緣）；第 3 階頂面平貼一片金色貝殼翼板（直的鉸線＋半橢圓波浪外緣，7 條凸肋互相平行）。不做從單點放射的紋樣。
// 珍珠 → 鼻部扇貝中心置中一顆珍珠（金框）、渾圓的座艙罩。
// 玫瑰 → 前後輪之間的側面三片玫瑰粉花瓣（金邊），粉紅只當點綴。
// 配色：珍珠白為主、海水綠為圖形色（下半車身、階梯鴨尾、側裙、扇貝鼻），金與玫瑰粉點綴。造型柔和，和同為羅馬的 mars-spear（尖銳、鋼銀深紅）明顯不同。
// 四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-venus-scallop/DESIGN.md。剖面為本檔站位產生器（推估）。塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, buildArchLiner } from './gazelleLeap.js';
import { buildBellySkirt } from './trojanHorse.js';

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

/** @type {number[]} 鼻部扇貝中心的珍珠 [x, z]（置中） */
const LAMP = [68.5, 0];
/** @type {number} 珍珠半徑 */
const LAMP_R = 3;

/** @type {{ cx: number, r: number, ax: number, ribs: number, y: number, t: number, kz: number }} 貝殼翼板：鉸線在 x = cx（橫向一條直線），往車尾是半橢圓的波浪外緣（縱向半徑 r × ax、橫向 r × kz）；凸肋互相平行（沿 x），不收到同一點 */
const SHELL = { cx: -57.5, r: 12, ax: 1.4, ribs: 7, y: 41.2, t: 0.6, kz: 1.15 };
/** @type {{ x0: number, x1: number, hw: number, top: number }[]} 3 階階梯鴨尾：每階踏面的 x 範圍、半寬、頂高（第 3 階延伸到車尾） */
const STEPS = [
  { x0: -42, x1: -50, hw: 16, top: 34.6 },
  { x0: -50, x1: -57, hw: 13.5, top: 38.4 },
  { x0: -57, x1: -71, hw: 11.5, top: 41.8 },
];
/** @type {number} 階梯板厚 */
const STEP_T = 0.5;

/** @type {(phi: number) => number} 貝殼外緣半徑（phi 從 −90° 到 90°，8 個波峰，兩峰之間凹 1.5 mm） */
const shellEdge = (phi) => {
  const s = Math.sin(4 * (phi + Math.PI / 2));
  return SHELL.r - 1.5 * s * s;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 珍珠白：亮面＋高清漆
  pearl: namedMaterial('paint-pearl-white', { color: 0xf4eee8, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08 }),
  pearl2: namedMaterial('paint-pearl-white', { color: 0xf4eee8, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  sea: namedMaterial('paint-sea-green', { color: 0x3aa597, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  sea2: namedMaterial('paint-sea-green', { color: 0x3aa597, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
  // 金（真金屬：名稱以 -brass 結尾）
  gold: namedMaterial('trim-gold-brass', { color: 0xd8b25a, metalness: 0.85, roughness: 0.26, clearcoat: 0.4, side: THREE.DoubleSide }),
  // 座艙罩：海水色煙燻透明殼
  canopy: namedMaterial('pc-smoke-aqua', { color: 0x1c3a3c, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x2a2226, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-pearl', { color: 0xe8e0d8, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-dark', { color: 0x2a2024, roughness: 0.8, side: THREE.DoubleSide }),
  // 珍珠頭燈：帶淡淡自發光的珍珠色
  lamp: namedMaterial('lamp-pearl', { color: 0xfff6ee, emissive: 0xfff0e6, emissiveIntensity: 0.35, roughness: 0.12, clearcoat: 1 }),
  dSea: decalMaterial('decal-sea-green', { color: 0x3aa597, roughness: 0.3 }),
  dSeaDeep: decalMaterial('decal-sea-deep', { color: 0x1f6e64, roughness: 0.32 }),
  dDeep: decalMaterial('decal-rose-pink', { color: 0xd8577f, roughness: 0.32 }),
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
  theme: '照四視圖 31 的低趴楔形車：鼻部置中一片海水綠扇貝（同心生長線、金色波浪外緣），扇貝中心一顆金框珍珠；長斜引擎蓋、渾圓的座艙、後甲板兩道橫條紋；車尾是海水綠 / 珍珠白交錯、往上疊高到 41.8 的 3 階階梯鴨尾，頂階平貼一片金色貝殼翼板（直鉸線、波浪外緣、平行凸肋）；前後輪之間三片玫瑰粉花瓣、海水綠側裙；珍珠白＋海水綠，金與玫瑰粉點綴',
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
    // 海水綠下半車身：腰線稜以下，往鼻尖跟著腰線收低
    { mat: 'sea', keep: (x, y, z) => (belowBelt(x, y) && Math.abs(z) > P.hw(x) - 10 ? 1 : -1) },
    { mat: 'pearl', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'sea', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 3 階階梯鴨尾（海水綠 / 珍珠白 / 海水綠橫條）＋第 3 階頂面平貼一片扇貝翼板 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const sea = [];
      /** @type {THREE.BufferGeometry[]} */
      const pearl = [];
      STEPS.forEach((st, k) => {
        /** @type {THREE.BufferGeometry[]} */
        const out = k % 2 === 0 ? sea : pearl;
        const next = STEPS[k + 1];
        /** @type {number} 這一階立面的下緣（第 1 階埋進甲板） */
        const base = k === 0 ? 31 : STEPS[k - 1].top - STEP_T;
        // 踏面：只做露出來的 U 形（上一階蓋住的部分不做，省質量）
        /** @type {number[][]} */
        const tread = next
          ? [[st.x0, -st.hw], [st.x0, st.hw], [-71, st.hw], [-71, next.hw], [next.x0, next.hw], [next.x0, -next.hw], [-71, -next.hw], [-71, -st.hw]]
          : [[st.x0, -st.hw], [st.x0, st.hw], [-71, st.hw], [-71, -st.hw]];
        out.push(flatPlate(tread, st.top - STEP_T, STEP_T));
        // 前立面與車尾立面
        for (const xf of [st.x0, -71 + STEP_T]) {
          const g = new THREE.BoxGeometry(STEP_T, st.top - base, 2 * st.hw);
          g.translate(xf - STEP_T / 2, (st.top + base) / 2, 0);
          out.push(g);
        }
        // 左右側立面
        for (const sg of [-1, 1]) {
          out.push(finPlate([[st.x0, base], [st.x0, st.top], [-71, st.top], [-71, base]], sg * (st.hw - STEP_T / 2), STEP_T));
        }
      });
      parts.push({ geometry: mergeGeos(sea), mat: 'sea2', solid: true, outline: true, name: 'step-ducktail-sea' });
      parts.push({ geometry: mergeGeos(pearl), mat: 'pearl2', solid: true, outline: true, name: 'step-ducktail-pearl' });
      // 貝殼翼板外形：前緣是直的鉸線 → 往車尾的半橢圓波浪外緣（每 3° 一點）
      /** @type {number[][]} */
      const outline = [];
      for (let i = 0; i <= 60; i++) {
        const phi = lerp(-Math.PI / 2, Math.PI / 2, i / 60);
        const r = shellEdge(phi);
        outline.push([SHELL.cx - SHELL.ax * r * Math.cos(phi), r * Math.sin(phi)]);
      }
      const fan = flatPlate(outline, SHELL.y, SHELL.t);
      fan.scale(1, 1, SHELL.kz);
      // 凸肋：7 條互相平行（沿 x）的肋（寬 0.8、高 0.5），從鉸線到外緣；鉸線上一條橫向的鉸條；翼板、肋、鉸條同為金色
      /** @type {THREE.BufferGeometry[]} */
      const ribs = [];
      for (let i = 0; i < SHELL.ribs; i++) {
        const z = lerp(-0.78 * SHELL.r, 0.78 * SHELL.r, i / (SHELL.ribs - 1));
        const len = SHELL.ax * Math.sqrt(SHELL.r * SHELL.r - z * z) - 1.4;
        const g = new THREE.BoxGeometry(len, 0.5, 0.8 / SHELL.kz);
        g.translate(SHELL.cx - 0.6 - len / 2, SHELL.y + SHELL.t + 0.25, z);
        ribs.push(g);
      }
      const ribGeo = mergeGeos(ribs);
      ribGeo.scale(1, 1, SHELL.kz);
      const ear = new THREE.BoxGeometry(1.6, 0.6, 2 * SHELL.r * SHELL.kz - 2);
      ear.translate(SHELL.cx - 0.8, SHELL.y + SHELL.t + 0.3, 0);
      parts.push({ geometry: mergeGeos([fan, ribGeo, ear]), mat: 'gold', solid: true, outline: true, name: 'scallop-wing' });
    }

    // ── 側裙：兩輪之間把底盤側框與電池艙側面封起來（海水綠） ──
    parts.push({
      geometry: buildBellySkirt({ x0: -21, x1: 21, zIn: (x) => P.hw(x) - 1.2, zOut: 37.4, yTop: 14.2, t: 0.5 }),
      mat: 'sea2',
      solid: true,
      outline: true,
      name: 'side-skirts',
    });

    // ── 珍珠：半埋在鼻部扇貝中心的一顆扁球（16×10 分段，左右置中） ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const lamps = [];
      const g = new THREE.SphereGeometry(LAMP_R, 16, 10);
      g.scale(1, 0.7, 1);
      g.translate(LAMP[0], top(LAMP[0], 0) - 0.4, 0);
      lamps.push(g);
      parts.push({ geometry: mergeGeos(lamps), mat: 'lamp', solid: true, outline: true, name: 'pearl-center' });
    }

    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos([buildArchLiner(ARCHES[0], 21, 33.4, 0.35, Math.PI - 0.35), buildArchLiner(ARCHES[1], 21, 34, 0.35, Math.PI - 0.35)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });

    // ── 貼紙 ──
    // 鼻部扇貝：鉸點在鼻尖前方 (81, 0)，半徑 24.5 的波浪外緣以內整片海水綠
    /** @type {(x: number, z: number) => number} 從鼻部鉸點量的角度（度） */
    const noseAng = (x, z) => (Math.atan2(Math.abs(z), 81 - x) * 180) / Math.PI;
    /** @type {(x: number, z: number) => number} 到鼻部扇貝波浪外緣的距離（正值 = 在殼內；半徑 24.5，兩肋之間凹 1.4） */
    const noseEdge = (x, z) => {
      const w = Math.sin((Math.PI * (noseAng(x, z) + 6.5)) / 13);
      return 24.5 - 1.4 * w * w - Math.hypot(81 - x, z);
    };
    /** @type {(x: number, y: number, z: number) => boolean} 在鼻部扇面範圍（腰線以上、座艙罩前方、頭燈以外） */
    const onNoseFan = (x, y, z) => x > 54 && !belowBelt(x, y) && Math.hypot(x - LAMP[0], z - LAMP[1]) > LAMP_R + 1.2 && noseEdge(x, z) > 0;
    parts.push({
      geometry: kit.decal((x, y, z) => (onNoseFan(x, y, z) ? Math.min(noseEdge(x, z) - 0.6, x - 55) : -1)),
      mat: 'dSea',
      name: 'decal-nose-scallop',
    });
    // 扇貝的兩道生長線（深海水綠，半徑 17 / 20.5 的同心弧，在珍珠外圈）與金色波浪外緣
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onNoseFan(x, y, z) || x < 56) {
          return -1;
        }
        const r = Math.hypot(81 - x, z);
        const d = Math.min(Math.abs(r - 17), Math.abs(r - 20.5));
        return Math.min(0.3 - d, noseEdge(x, z) - 1);
      }, { offset: 0.1 }),
      mat: 'dSeaDeep',
      name: 'decal-nose-scallop-ribs',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (x > 54 && !belowBelt(x, y) ? 0.4 - Math.abs(noseEdge(x, z) - 0.3) : -1), { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-nose-scallop-rim',
    });
    // 珍珠金框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = Math.hypot(x - LAMP[0], z - LAMP[1]);
        return Math.min(d - LAMP_R + 0.2, LAMP_R + 0.9 - d);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-lamp-bezels',
    });
    // 後甲板兩道橫向海水綠條紋（接到階梯鴨尾的橫條）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (belowBelt(x, y) || Math.abs(z) > P.hw(x) - 4.5 || onCanopy(x, z)) {
          return -1;
        }
        return Math.max(Math.min(x + 33.4, -31 - x), Math.min(x + 38.4, -36 - x));
      }),
      mat: 'dSea',
      name: 'decal-deck-stripes',
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
    wing: '3 階階梯鴨尾：每階踏面 U 形板＋前立面＋車尾立面＋左右側立面（板厚 0.5；半寬 16 / 13.5 / 11.5、頂高 34.6 / 38.4 / 41.8）；貝殼翼板（厚 0.6、嵌在第 3 階頂面、直鉸線 x −57.5、縱向半徑 16.8、橫向半徑 13.8、8 個波峰的外緣、7 條平行凸肋 0.8 × 0.5、鉸條 1.6 × 0.6）；側裙（厚 0.5，|z| 37.4，x −21 → 21）。皆為實心 ABS 件，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    symbols: '扇貝殼：Pompeii「Casa della Venere in conchiglia」花園壁畫（Wikipedia〈Venus (mythology)〉）；玫瑰：Porta Collina 的維納斯祭儀獻玫瑰（同條目）；珍珠：凱撒在 Venus Genetrix 神廟獻上鑲不列顛珍珠的胸甲（Wikipedia〈Temple of Venus Genetrix〉）。造型皆為抽象化的車身零件與貼紙，不出人像',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

/** @type {import('./types').BodyDef} */
export const venusScallopBody = makePolyBody(CONFIG);
