// 三頭犬（body-cerberus-trihead，神話組・希臘）：照四視圖 07 的「前段尖刃、刻面擋泥板艙、低座艙、高車尾、鋸齒端板尾翼」重新建模，不做犬頭。
// 「三」：低鼻上三道等長、平行、同高的青銅鼻刃（中央與左右各一道）刃尖齊平在同一條線上、左右兩道的前段懸出鼻端，從車頭、俯視都數得出三根並排的尖叉；
// 刃與刃之間兩條餘燼色橫縫燈。尾翼的後緣是三個等長的尖齒（三道鼻刃在車尾的回應），兩端是往上折兩段的青銅端板（四視圖 07 的鋸齒翼端）。
// 冥府之門 → 側面進氣口：收腰段側壁一道斜平行四邊形的黑色門洞，青銅門框、門內三條餘燼色橫柵。
// 四輪擋泥板是刻面的暗紅艙（四視圖的亮色刻面板塊），中央是黑釉機身與壓低的暗紅煙燻座艙罩；青銅細線沿著色塊邊界走（四視圖的描邊線）。
// 設計：shared/design/body-cerberus-trihead/DESIGN.md（MYTH_RESEARCH G3–G5、G12：黑繪陶的黑釉、赭紅與青銅器）。
// 塗裝：黑釉（緞面）為主色、背脊頂面霧面黑，暗紅（霧面赭紅）做刻面艙與尾翼，青銅（真金屬）做三道鼻刃、端板、門框與細線，餘燼色自發光點綴；全為自創，不含任何文字或商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { buildProfileLiner } from './khepriScarab.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-64, -58, -52, -44, -36, -26, -14, -2, 10, 22, 32, 40, 46, 50, 54, 58];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬：車尾收到 ±26、後擋泥板 ±42.4、收腰 ±30.6、前擋泥板 ±38.8（比輪胎外緣窄，俯視看得到輪胎外側，四視圖 07 的窄艙露輪）；尾翼比車身寬（±46）；殼面在 x 58 收成 ±24 的短鼻，三道鼻刃的前 14 mm 懸出鼻端，俯視是三根並排的尖叉
  hw: monoCurve(XS, [26, 34, 41, 42.4, 41.8, 35.8, 31.4, 30.6, 32, 36.4, 38.4, 38.8, 37.4, 34.4, 29.6, 24]),
  // 中央背脊頂：車尾高、往前一路降到鼻端
  yC: monoCurve(XS, [32.2, 33.8, 34.4, 34, 33.2, 32.2, 30.8, 30, 28.8, 27, 25.4, 24, 22.6, 21.6, 20.4, 19.2]),
  // 刻面艙頂（0.62 半寬）：後艙最高（前低後高），前艙比背脊高
  yF: monoCurve(XS, [33, 35.2, 36, 35.6, 34.4, 31.4, 27, 26, 27.4, 29.8, 30.4, 29.6, 27.6, 25.6, 23.6, 21.6]),
  // 肩稜（最寬處）
  yE: monoCurve(XS, [29.4, 31.4, 32, 31.6, 30.4, 27, 22.4, 21.4, 22.6, 26.2, 27.8, 27.6, 25.8, 23.6, 21.6, 20]),
  // 側壁下緣
  yLow: monoCurve(XS, [17.8, 15.2, 13.6, 13, 12.9, 12.7, 12.5, 12.5, 12.5, 12.5, 12.6, 13, 13.4, 13.8, 14.2, 14.6]),
};

/**
 * 半剖面 7 點：中央背脊（2 點）→ 谷 → 刻面艙頂內稜 → 艙頂外稜 → 肩稜 → 側壁下緣（內收）；內稜、外稜、肩稜都是銳利刻面稜線
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yF = P.yF(x);
  const yE = P.yE(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const yValley = Math.min(yC - 0.6, yF - 1.2);
  return [
    [0, yC],
    [0.1 * hw, yC - 0.2],
    [0.3 * hw, yValley],
    [0.5 * hw, yF],
    [0.8 * hw, lerp(yF, yE, 0.35)],
    [hw, yE],
    [hw - 0.8, yLow],
  ];
};

const STATIONS = buildStations(-64, 58, 1.5, profile);

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 側壁（肩稜以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 0.3;

/**
 * 前刻面艙（暗紅）：x 16 → 鼻端，頂面在艙頂內稜（0.5 半寬）外側，側壁在一條往前降的分界線上方（正值 = 在區內）
 * @type {(x: number, y: number, z: number) => number}
 */
const frontPodInset = (x, y, z) => {
  const lim = Math.min(x - 16, 57.4 - x);
  if (onSide(x, z)) {
    return Math.min(lim, y - lerp(19, 16.6, (x - 16) / 42));
  }
  return Math.min(lim, Math.abs(z) - 0.5 * P.hw(x));
};

/**
 * 後刻面艙（暗紅）：x −12 → 車尾，頂面在 0.5 半寬外側，側壁在一條往後降的斜分界線上方（四視圖 07 從收腰斜升到車尾的亮色板塊）
 * @type {(x: number, y: number, z: number) => number}
 */
const rearPodInset = (x, y, z) => {
  const lim = -12 - x;
  if (onSide(x, z)) {
    return Math.min(lim, y - lerp(21.5, 17.4, (-12 - x) / 52));
  }
  return Math.min(lim, Math.abs(z) - 0.5 * P.hw(x));
};

/** @type {{ x0: number, x1: number, y0: number, y1: number, slant: number }} 側面冥府之門（斜平行四邊形進氣口，上緣往後錯 slant mm） */
const GATE = { x0: -15, x1: 15, y0: 14.6, y1: 20.6, slant: 4 };
/**
 * 門洞內距（u 沿車長、v 高度；正值 = 在門內）
 * @type {(u: number, v: number) => number}
 */
const gateInset = (u, v) => {
  const shift = ((v - GATE.y0) / (GATE.y1 - GATE.y0)) * GATE.slant;
  return Math.min(u + shift - GATE.x0, GATE.x1 + shift - u, v - GATE.y0, GATE.y1 - v);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 黑釉（緞面）：側壁與機身
  black: namedMaterial('paint-figure-black', { color: 0x121010, roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.4 }),
  // 背脊頂面霧面黑：掠射角不反成亮面
  deck: namedMaterial('shell-deck-dark-matte', { color: 0x121010, roughness: 0.85 }),
  // 刻面艙與尾翼：赭紅（霧面）
  oxblood: namedMaterial('paint-oxblood-red', { color: 0x6e1414, roughness: 0.62, clearcoat: 0.05 }),
  oxblood2: namedMaterial('paint-oxblood-red', { color: 0x6e1414, roughness: 0.62, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 青銅（真金屬）：三道鼻刃、端板
  bronze: namedMaterial('trim-bronze-brass', { color: 0xa8743a, metalness: 0.8, roughness: 0.32, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1412, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x121010, roughness: 0.7, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x1a1412, roughness: 0.85, side: THREE.DoubleSide }),
  // 暗紅煙燻座艙罩（有色透明 PC）
  glass: namedMaterial('pc-tint-garnet-smoke', { color: 0x4a1012, roughness: 0.06, specularIntensity: 0.6, transparent: true, opacity: 0.66, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-dark', { color: 0x1a1412, roughness: 0.8, side: THREE.DoubleSide }),
  pylon: namedMaterial('paint-figure-black', { color: 0x121010, roughness: 0.56, clearcoat: 0.12, side: THREE.DoubleSide }),
  // 青銅細線與門框（貼紙）
  dBronze: decalMaterial('decal-bronze-line', { color: 0xb07a3c, metalness: 0.7, roughness: 0.35 }),
  // 門洞底色：比黑釉更深的霧黑
  dVoid: decalMaterial('decal-gate-void', { color: 0x050404, roughness: 0.9 }),
  // 門柵與鼻端橫縫燈：冥府餘燼色自發光（強度低，Blender 不過曝）
  dEmber: decalMaterial('decal-ember-glow', { color: 0xff7a2a, emissive: 0xd8501a, emissiveIntensity: 0.8, roughness: 0.4 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 刻面尖刃（實體件）：五邊形斷面（平底、兩側直壁、屋脊頂）沿 x 從刃根漸縮到刃尖；平面法線（刻面反光）
 * @type {(z: number, x0: number, x1: number, top: (x: number) => number, bottom: (x: number) => number, w0: number, n?: number) => THREE.BufferGeometry}
 */
const spikeBlade = (z, x0, x1, top, bottom, w0, n = 8) => {
  /** @type {number[][][]} 各斷面的 5 個頂點 */
  const secs = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const x = lerp(x0, x1, s);
    const w = Math.max(0.04, w0 * (1 - s ** 1.6));
    const yt = top(x);
    const yb = i === n ? yt - 0.1 : Math.min(bottom(x), yt - 0.3);
    const ys = yt - Math.min(0.6 * w, (yt - yb) * 0.5);
    secs.push([
      [x, yb, z - w],
      [x, ys, z - w],
      [x, yt, z],
      [x, ys, z + w],
      [x, yb, z + w],
    ]);
  }
  /** @type {number[]} */
  const pos = [];
  /** @type {(a: number[], b: number[], c: number[]) => void} */
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  for (let i = 0; i < n; i++) {
    const A = secs[i];
    const B = secs[i + 1];
    for (let k = 0; k < 5; k++) {
      const k2 = (k + 1) % 5;
      tri(A[k], B[k], B[k2]);
      tri(A[k], B[k2], A[k2]);
    }
  }
  // 刃根封口
  const R = secs[0];
  tri(R[0], R[2], R[1]);
  tri(R[0], R[4], R[2]);
  tri(R[4], R[3], R[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** 座艙罩（暗紅煙燻，收腰段正上方）：x 12 → −24 */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(12, -24, u);
      const halfW = i === 0 || i === n ? 2.2 : 10 * Math.sin(Math.PI * u ** 0.8) ** 0.5;
      const rise = 5.6 * Math.sin(Math.PI * u ** 0.75) ** 0.6;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {number[]} 三道鼻刃的 z 位置（中央與左右，間距 22 mm（左右刃在輪胎內側）） */
const BLADE_ZS = [0, 22, -22];
/** @type {number} 三道鼻刃共用的刃根 x */
const BLADE_X0 = 36;
/** @type {number} 三道鼻刃共用的刃尖 x（齊平在鼻端） */
const BLADE_X1 = 72;
/** @type {(x: number) => number} 三道鼻刃共用的刃頂線（同高、平行） */
const bladeTop = (x) => lerp(32, 19, (x - BLADE_X0) / (BLADE_X1 - BLADE_X0));

/** @type {number} 尾翼板底面高度 */
const WING_Y = 40.2;
/** @type {number[][]} 尾翼平面（俯視 x, z）：前緣微後掠，後緣三個等長尖齒（z 0、±31），翼端 ±46（比車身寬，四視圖 07 的尾翼是全車最寬處） */
const WING_PLAN = [
  [-51, -46],
  [-49.6, -22],
  [-49, 0],
  [-49.6, 22],
  [-51, 46],
  [-59.6, 46],
  [-66, 31],
  [-58, 15.5],
  [-66, 0],
  [-58, -15.5],
  [-66, -31],
  [-59.6, -46],
];
/** @type {number[][]} 端板側視：從翼下往上折兩段的鋸齒形（四視圖 07 的翼端） */
const ENDPLATE = [
  [-50.4, 38],
  [-60.4, 38],
  [-63.4, 41.8],
  [-58.8, 41.8],
  [-61.2, 45.6],
  [-54, 42.6],
  [-57, 42.6],
];

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-cerberus-trihead',
  name: '冥府三頭犬',
  style: 'myth',
  phase: 13,
  mythSeries: 'greek',
  mythTheme: 'cerberus',
  form: 'trispike-shovel',
  roof: 'canopy',
  wing: 'trifang-zigzag-plate',
  theme: '黑釉刻面四驅車：低鼻上三道等長、平行、同高、刃尖齊平的青銅鼻刃，刃間兩條餘燼色橫縫燈；四輪是暗紅刻面艙、中央黑釉機身與壓低的暗紅煙燻座艙罩，青銅細線沿色塊邊界；收腰側壁的冥府之門進氣口（青銅門框、三條餘燼色橫柵）；車尾高起，單柱撐起後緣三尖齒的暗紅尾翼，兩端是往上折兩段的青銅鋸齒端板',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 0.8,
  step: 0.8,
  // 艙頂內稜（3）、外稜（4）、肩稜（5）是銳利刻面稜線
  hard: [3, 4, 5],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  canopy: CANOPY,
  sideZMin: 28,
  zones: () => [
    { mat: 'oxblood', keep: (x, y, z) => frontPodInset(x, y, z) },
    { mat: 'oxblood', keep: (x, y, z) => rearPodInset(x, y, z) },
    // 左右艙之間的頂面（背脊）霧面黑
    { mat: 'deck', keep: (x, y, z) => (onSide(x, z) ? -1 : 0.5 * P.hw(x) - Math.abs(z)) },
    { mat: 'black', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 三道鼻刃（青銅實體件）：同一條刃頂線、同一個刃根 x 與刃尖 x，根部埋進殼面 1 mm；懸出鼻端的部分刃高 3.2 mm ──
    {
      /** @type {(z: number) => (x: number) => number} 刃底：殼面下 1 mm（殼面外則取刃頂下 3.2 mm） */
      const bottomAt = (z) => (x) => {
        const s = x <= 57.8 && Math.abs(z) < P.hw(x) - 0.5 ? kit.surf.topY(x, z) : NaN;
        return Number.isFinite(s) ? Math.min(s - 1, bladeTop(x) - 3.2) : bladeTop(x) - 3.2;
      };
      const blades = BLADE_ZS.map((z) => spikeBlade(z, BLADE_X0, BLADE_X1, bladeTop, bottomAt(z), 1.7));
      parts.push({ geometry: mergeGeos(blades), mat: 'bronze', solid: true, outline: true, name: 'tri-nose-blades' });
    }

    // ── 尾翼：後緣三尖齒的暗紅平板、中央單柱、兩端青銅鋸齒端板 ──
    parts.push({ geometry: flatPlate(WING_PLAN, WING_Y, 1), mat: 'oxblood2', solid: true, outline: true, name: 'trifang-wing' });
    {
      /** @type {(x: number) => number} 中線殼面高度 */
      const deckY = (x) => kit.surf.topY(x, 0);
      const pylon = finPlate(
        [
          [-51.6, deckY(-51.6) - 1],
          [-50.6, WING_Y + 0.6],
          [-57.4, WING_Y + 0.6],
          [-61.6, deckY(-61.6) - 1],
        ],
        0,
        2.4,
      );
      parts.push({ geometry: pylon, mat: 'pylon', solid: true, name: 'wing-pylon' });
    }
    parts.push({
      geometry: mergeGeos([finPlate(ENDPLATE, 46.6, 1.2), finPlate(ENDPLATE, -46.6, 1.2)]),
      mat: 'bronze',
      solid: true,
      outline: true,
      name: 'zigzag-endplates',
    });

    // 輪拱內襯（前後，R15.2）：每個角度的外緣取該高度的殼內面，不會從擋泥板頂冒出來
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.4, profile))), mat: 'liner', shell: true, name: 'arch-liners' });

    // ── 貼紙 ──
    // 青銅細線：沿刻面艙的分界（頂面離艙內緣 0.5 mm、側壁沿斜分界線），寬 0.6 mm
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const f = frontPodInset(x, y, z);
        const r = rearPodInset(x, y, z);
        return Math.max(0.3 - Math.abs(f + 0.8), 0.3 - Math.abs(r + 0.8));
      }, { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-bronze-pod-lines',
    });
    // 冥府之門：門洞（深黑）、青銅門框（寬 0.9）、門內三條餘燼色橫柵
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 26, side };
      parts.push({ geometry: kit.decal(sideDecal((u, v) => -gateInset(side * u, v), opt), { offset: 0.1 }), mat: 'dVoid', name: `decal-gate-void-${side}` });
      parts.push({ geometry: kit.decal(sideDecal((u, v) => Math.abs(gateInset(side * u, v) + 0.45) - 0.45, opt), { offset: 0.12 }), mat: 'dBronze', name: `decal-gate-frame-${side}` });
      /** @type {(u: number, v: number) => number} 三條橫柵 */
      const bars = (u, v) => {
        const g = gateInset(side * u, v);
        const dv = Math.min(...[16.1, 17.6, 19.1].map((y) => Math.abs(v - y)));
        return Math.max(dv - 0.4, 1.2 - g);
      };
      parts.push({ geometry: kit.decal(sideDecal(bars, opt), { offset: 0.14 }), mat: 'dEmber', name: `decal-gate-bars-${side}` });
    }
    // 鼻端兩條餘燼色橫縫燈：在三道鼻刃之間（z ±11），x 53.9–55.3
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z)) {
          return -1;
        }
        return Math.min(0.7 - Math.abs(x - 54.6), 5.2 - Math.abs(Math.abs(z) - 11));
      }, { offset: 0.14 }),
      mat: 'dEmber',
      name: 'decal-ember-nose-slits',
    });
    // 尾燈：車尾左右一對細長紅燈
    {
      /** @type {THREE.BufferGeometry[]} */
      const lamps = [];
      for (const sg of [-1, 1]) {
        const l = new THREE.BoxGeometry(0.8, 1.4, 10);
        l.translate(-64.2, 25.6, sg * 14);
        lamps.push(l);
      }
      parts.push({ geometry: mergeGeos(lamps), mat: 'tail', solid: true, name: 'lamp-tail' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，造型比例取自 shared/design/body-cerberus-trihead/fourview.png 與 fourview_trace.txt，縮到底盤尺寸）：殼長 122（−64 ~ 鼻端 58），三道鼻刃刃尖 x 72、尾翼後緣 x −66；後刻面艙頂 36、中央背脊 34.4、座艙罩頂約 36、尾翼頂約 41.6、端板頂 45.6；寬：車尾 ±26、後擋泥板 ±42.4、前擋泥板 ±38.8、收腰 ±30.6、鼻端 ±24',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm）',
    blades: '三道鼻刃：ABS 實心刻面刃（五邊形斷面，刃根寬 3.4 mm，推估），z 0 / ±22、刃根 x 36、刃尖 x 72（前 14 mm 懸出鼻端，刃高 3.2），共用刃頂線 y 32 → 19',
    wing: '尾翼：ABS 平板厚 1 mm（推估），y 40.2，翼展 92、後緣三尖齒 x −66、弦長 8–16；中央單柱厚 2.4；端板厚 1.2，往上折兩段到 y 45.6',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

export const cerberusTriheadBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
