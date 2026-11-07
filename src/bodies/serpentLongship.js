// 疊板長船（body-serpent-longship，神話組・北歐）：維京長船只用元素表現，車上沒有龍頭、蛇頭、臉。
// 造型照四視圖 20：方正的寬鈍鼻（整條琥珀色燈帶）、短引擎罩、座艙置中的封閉罩、後輪拱上斜切的三道百葉，
// 招牌是車尾的三層疊片尾翼——這裡就是疊板（clinker）：三片木板一片比一片高、一片比一片後，像船殼的板一片壓一片，最上一片是紅白直條帆。
// 船殼 → 側面：外肩以下三道往外疊的疊板（每道下緣外凸成唇、接縫往內一階），接縫線沿船舷曲線在前後端微微上揚，接縫上一排鐵鉚釘點。
// 設計：shared/design/body-serpent-longship/DESIGN.md（文物：Oseberg / Gokstad 船的疊板船殼，MYTH_RESEARCH 北歐節 N1、N2、N5、N6）。
// 塗裝全為自創；不用盧恩字母、不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 鈍鼻前緣 x */
const X_FRONT = 73;
/** @type {number} 殼後端 x */
const X_REAR = -64;

/** @type {number[]} 中線參數的站位 */
const XS = [-64, -58, -50, -40, -30, -20, -10, 0, 10, 20, 28, 36, 44, 52, 60, 66, 70, 73];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 甲板中線：鈍鼻頂 25 → 短引擎罩升到座艙前 30.5 → 座艙段 31 → 後甲板緩降到車尾 31
  yc: monoCurve(XS, [31, 31.6, 32.2, 32.4, 32.2, 31.8, 31.4, 31, 30.8, 30.4, 29.6, 28.6, 27.8, 27, 26.2, 25.6, 25.2, 25]),
};

/** @type {number[]} 俯視與下緣的站位 */
const XS_HW = [-64, -60, -52, -40, -28, -21, -9, 2, 13, 23, 32, 42, 52, 58, 64, 69, 73];
/** @type {Record<string, (x: number) => number>} */
const Q = {
  // 俯視半寬：一艘窄長的船殼坐在底盤上，四輪都在船殼外側——前後輪之間船身鼓成梭形（最寬 37），輪子旁收到 21.2（疊板唇外凸 0.6 後離 31 mm 輪胎內側還有 1 mm 以上），前輪前方張開成 30 的寬鈍鼻、後輪後方張開成 26.5 的方尾
  hw: monoCurve(XS_HW, [26.5, 25.5, 21.2, 21.2, 21.2, 21.2, 32, 37, 32, 21.2, 21.2, 21.2, 21.2, 23.5, 29, 30, 29]),
  // 下緣
  lo: monoCurve(XS_HW, [17.5, 16.8, 15.6, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15.2, 15.6, 15.8, 16, 16]),
};

/** @type {(x: number) => number} 船舷頂高：四輪在船殼外側、不需要輪拱；船舷照長船的 sheer 往船首、船尾上揚（兩端比甲板高約 3.6） */
const yFender = (x) => P.yc(x) - 0.6 + 4.2 * Math.abs((x - 4) / 69) ** 2.4;

/** @type {number} 疊板接縫的內外階差（mm） */
const LAP = 1.2;

/**
 * 兩道疊板接縫的高度（由上往下）：跟著船舷（sheer）走，放在外肩下方看得到的那一段（底盤側框以上）
 * @type {(x: number) => number[]}
 */
const lapLines = (x) => {
  const lo = Q.lo(x);
  const top = yFender(x) - 3.2;
  const y0 = Math.max(lo + 3.4, top - 2.2);
  const y1 = Math.max(lo + 1.2, Math.min(y0 - 1.8, top - 5.2));
  return [y0, y1];
};

/**
 * 半剖面 11 點：甲板中線 → 甲板邊 → 輪拱內稜 → 輪拱頂 → 外肩 → 第 1 道疊板（上緣內收）→ 唇 → 內階 → 第 2 道唇 → 內階 → 第 3 道下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yc = P.yc(x);
  const hw = Q.hw(x);
  const lo = Q.lo(x);
  const yf = Math.max(yFender(x), yc - 0.6);
  const zd = Math.min(15, hw - 14);
  const [y0, y1] = lapLines(x);
  const h = LAP / 2;
  return [
    [0, yc],
    [zd, yc - 0.5],
    [zd + 3, yf - 0.3],
    [hw - 3, yf],
    [hw - h, yf - 2.6],
    [hw + h, y0],
    [hw - h, y0],
    [hw + h, y1],
    [hw - h, y1],
    [hw + h, lo + 0.4],
    [hw + h, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = buildStations(X_REAR, X_FRONT, 2, profile);

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm）；輪子旁船殼半寬 21.2、在輪胎內側，輪拱實際上不切殼 */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 30 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 30 },
];

/**
 * 三層疊片尾翼：每片 [前緣 x, 後緣 x, 板底 y]，一片比一片高、一片比一片往後（像疊板一片壓一片），半寬 24，厚 1.0
 * @type {number[][]}
 */
const PLANKS = [
  [-50.5, -61.5, 35.2],
  [-54.5, -65.5, 37.7],
  [-58.5, -69.5, 40.2],
];
/** @type {number} 疊片半寬 */
const PLANK_HW = 24;
/** @type {number} 疊片厚 */
const PLANK_T = 1.0;
/** @type {number} 紅白直條寬（mm） */
const STRIPE_W = 4;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 主色：橡木（緞面：paint- 且 roughness > 0.5 → Blender 緞面）
  oak: namedMaterial('paint-oak-plank', { color: 0xa8743f, roughness: 0.6, clearcoat: 0.15 }),
  oakSolid: namedMaterial('paint-oak-plank', { color: 0xa8743f, roughness: 0.6, clearcoat: 0.15 }),
  oakLight: namedMaterial('paint-oak-deck-light', { color: 0xc99a62, roughness: 0.58, clearcoat: 0.15 }),
  // 焦油黑（最下一道疊板、鼻面）
  tar: namedMaterial('paint-tar-black', { color: 0x231a14, roughness: 0.62, clearcoat: 0.1 }),
  tarSolid: namedMaterial('paint-tar-black', { color: 0x231a14, roughness: 0.62, clearcoat: 0.1 }),
  // 帆：紅、奶油白（亮面漆）
  red: namedMaterial('paint-sail-red', { color: 0xb3262a, roughness: 0.38, clearcoat: 0.6 }),
  cream: namedMaterial('paint-sail-cream', { color: 0xf0e6cf, roughness: 0.4, clearcoat: 0.6 }),
  lamp: decalMaterial('lamp-amber', { color: 0xffb640, emissive: 0xd88a1a, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1e1c1a, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16120f, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1b1511, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-oak', { color: 0x8a5c30, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-tar', { color: 0x1e1712, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  // 鐵鉚釘、百葉暗槽、紅白甲板條紋
  dIron: decalMaterial('decal-iron-rivet', { color: 0x3a3a3c, metalness: 0.7, roughness: 0.4 }),
  dSlot: decalMaterial('decal-louver-slot', { color: 0x120d0a, roughness: 0.8 }),
  dRed: decalMaterial('decal-sail-red', { color: 0xb3262a, roughness: 0.4 }),
  dCream: decalMaterial('decal-sail-cream', { color: 0xf0e6cf, roughness: 0.4 }),
});

/**
 * 一片疊片（俯視四角倒角的長方形）
 * @type {(p: number[], hw: number, y: number, t: number) => THREE.BufferGeometry}
 */
const plankGeo = ([x0, x1, y], hw, t) => {
  const c = 1.6;
  return flatPlate(
    [
      [x0, hw - c],
      [x0 - c, hw],
      [x1, hw],
      [x1, -hw],
      [x0 - c, -hw],
      [x0, -hw + c],
    ],
    y,
    t,
  );
};

export const serpentLongshipBody = makePolyBody({
  id: 'body-serpent-longship',
  name: '疊板長船',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'serpent-longship',
  form: 'clinker-hull',
  roof: 'canopy',
  wing: 'strake-stack',
  theme: '維京長船用元素表現：窄長船殼坐在底盤上、四輪在外側，船舷往船首船尾上揚（紅色船舷欄），方正鈍鼻與整條琥珀燈帶、側面三道往外疊的疊板（深、淺木色與焦油黑）（接縫沿船舷曲線前後上揚、接縫上一排鐵鉚釘）、後輪拱上斜切三道百葉，車尾三層疊片尾翼一片比一片高、一片比一片後（像疊板），最上一片是紅白直條帆；橡木色配焦油黑，紅白條紋',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格 0.7 mm：車身表面積大，放寬網格讓面數留在效能預算內
  step: 0.7,
  hard: [1, 2, 4, 5, 6, 7, 8, 9],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 置中的座艙罩 x 22 → −18
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const x = lerp(22, -18, u);
        out.push({ x, yBase: 0, yTop: 8.4 * Math.sin(Math.PI * u ** 0.85) ** 0.55, halfW: Math.max(1.5, 10.5 * Math.sin(Math.PI * u ** 0.9) ** 0.45) });
      }
      return out;
    })(),
  },
  sideZMin: 26,
  zones: () => {
    /** @type {(x: number, y: number, z: number) => number} 最下一道疊板（第二道接縫以下的外側面） */
    const lowStrake = (x, y, z) => Math.min(lapLines(x)[1] + 0.05 - y, Math.abs(z) - (Q.hw(x) - 1.2));
    /** @type {(x: number, y: number, z: number) => number} 中間一道疊板（兩道接縫之間，淺木色） */
    const midStrake = (x, y, z) => Math.min(lapLines(x)[0] + 0.05 - y, Math.abs(z) - (Q.hw(x) - 1.2));
    /** @type {(x: number, y: number, z: number) => number} 船舷欄（外肩斜面）：沿 sheer 的紅色細欄 */
    const gunwale = (x, y, z) => Math.min(Math.abs(z) - (Q.hw(x) - 3.2), y - (yFender(x) - 1.4), 71.5 - x);
    return [
      { mat: 'tar', keep: (x, y, z) => Math.max(lowStrake(x, y, z), Math.min(x - 71.5, y - 15)) },
      { mat: 'oakLight', keep: midStrake },
      { mat: 'red', keep: gunwale },
      { mat: 'oak', keep: () => 1 },
    ];
  },
  mats: { inner: 'inner', edge: 'edge', cap: 'tar', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 三層疊片尾翼：下兩片橡木、最上一片紅白直條帆；兩支焦油黑立柱＋兩側薄端板把三片串起來 ──
    {
      parts.push({ geometry: mergeGeos([plankGeo(PLANKS[0], PLANK_HW, PLANK_T), plankGeo(PLANKS[1], PLANK_HW, PLANK_T)]), mat: 'oakSolid', solid: true, outline: true, name: 'strake-wing-lower' });
      // 最上一片：沿翼展切成紅白直條（奇數條紅、偶數條白）
      /** @type {THREE.BufferGeometry[][]} */
      const bands = [[], []];
      const [x0, x1, y] = PLANKS[2];
      const n = Math.round((2 * PLANK_HW) / STRIPE_W);
      for (let i = 0; i < n; i++) {
        const za = -PLANK_HW + i * STRIPE_W;
        const zb = za + STRIPE_W;
        // 兩端條紋帶倒角（前緣外角）
        const cut = (z) => (Math.abs(z) > PLANK_HW - 1.6 ? 1.6 - (PLANK_HW - Math.abs(z)) : 0);
        const pts = [
          [x0 - cut(za), za],
          [x0 - cut(zb), zb],
          [x1, zb],
          [x1, za],
        ];
        bands[i % 2].push(flatPlate(pts, y, PLANK_T));
      }
      parts.push({ geometry: mergeGeos(bands[0]), mat: 'red', solid: true, outline: true, name: 'striped-sail-red' });
      parts.push({ geometry: mergeGeos(bands[1]), mat: 'cream', solid: true, outline: true, name: 'striped-sail-cream' });
      // 立柱（|z| 9，厚 1.2）：從後甲板斜升穿過三片
      /** @type {(zc: number) => THREE.BufferGeometry} */
      const strut = (zc) =>
        finPlate(
          [
            [-49, P.yc(-49) - 1.2],
            [-56, P.yc(-56) - 1.2],
            [-67, PLANKS[2][2] + 0.3],
            [-60, PLANKS[2][2] + 0.3],
          ],
          zc,
          1.2,
        );
      // 端板（|z| 24，厚 1.0）：沿三片的外緣串成一道階梯
      /** @type {(zc: number) => THREE.BufferGeometry} */
      const endPlate = (zc) =>
        finPlate(
          [
            [-51, PLANKS[0][2] - 0.6],
            [-61.5, PLANKS[0][2] - 0.6],
            [-69.5, PLANKS[2][2] + 1.6],
            [-59, PLANKS[2][2] + 1.6],
          ],
          zc,
          1.0,
        );
      parts.push({ geometry: mergeGeos([strut(9), strut(-9), endPlate(PLANK_HW + 0.5), endPlate(-PLANK_HW - 0.5)]), mat: 'tarSolid', solid: true, outline: true, name: 'strake-wing-struts' });
    }
    // ── 疊板接縫上的鐵鉚釘點（每 4 mm 一顆，半徑 0.4） ──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < Q.hw(x) - 1) {
          return -1;
        }
        const [y0, y1] = lapLines(x);
        const xr = x - Math.round(x / 4) * 4;
        let best = -1;
        for (const yl of [y0, y1]) {
          best = Math.max(best, 0.42 - Math.hypot(xr, y - (yl + 1.1)));
        }
        return Math.min(best, 69 - x, x + 62);
      }, { offset: 0.1 }),
      mat: 'dIron',
      name: 'decal-clinker-rivets',
    });
    // ── 後輪拱上斜切三道百葉（暗槽） ──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        let best = -1;
        for (let i = 0; i < 3; i++) {
          const xc = -32 - i * 4.2;
          // 斜槽：往外後方斜，寬 1.5、長 8
          const u = (x - xc) + 0.45 * (az - 30);
          const v = az - 30 - 0.45 * (x - xc);
          best = Math.max(best, Math.min(0.75 - Math.abs(u), 4 - Math.abs(v)));
        }
        return Math.min(best, y - (yFender(x) - 1.8));
      }, { offset: 0.1 }),
      mat: 'dSlot',
      name: 'decal-haunch-louvers',
    });
    // ── 甲板中央紅白條紋：鼻頂 → 座艙前、座艙後 → 車尾（紅 2 道夾白 1 道） ──
    for (const [mat, z0, z1] of [['dRed', 1.6, 3.2], ['dCream', 0, 1.6]]) {
      parts.push({
        geometry: kit.decal((x, y, z) => {
          const az = Math.abs(z);
          const inX = Math.max(Math.min(71 - x, x - 23.5), Math.min(-19.5 - x, x + 62));
          return Math.min(inX, z1 - az, az - z0 + (z0 === 0 ? 1 : 0), y - P.yc(x) + 1.2);
        }, { offset: 0.1 }),
        mat,
        name: `decal-deck-stripe-${mat}`,
      });
    }
    // ── 鈍鼻琥珀燈帶：鼻面上一整條（鼻面外 0.05 mm 的薄片） ──
    {
      const g = new THREE.PlaneGeometry(2 * (Q.hw(X_FRONT) - 3.5), 2.6);
      g.rotateY(Math.PI / 2);
      g.translate(X_FRONT + 0.05, 21.6, 0);
      parts.push({ geometry: g, mat: 'lamp', name: 'lamp-amber-bar' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器（推估，比例取自四視圖 20）：殼 x −64 ~ 73、鈍鼻頂 25、座艙段甲板 31、座艙罩頂約 39；俯視是窄長船殼：四輪在外側，前後輪之間鼓成梭形最寬 37，輪子旁 21.2、寬鈍鼻 30、方尾 26.5；側面三道疊板，接縫階差 1.2 mm；船舷往船首、船尾上揚約 3.6 mm',
    wing: '三層疊片尾翼：三片 ABS 平板厚 1.0、弦 11、半寬 24，板底 35.2 / 37.7 / 40.2、每片往後退 4 mm；立柱厚 1.2（|z| 9）、端板厚 1.0（|z| 24.5）（推估）；條紋帆的紅白直條是後世重建船與圖像常見的樣式（推估，未對應特定出土文物）',
    rivets: '疊板接縫的鐵鉚釘：Gokstad 等疊板船以鐵鉚釘固定上下板（MYTH_RESEARCH N6：板與板重疊約 30 mm）；車上以半徑 0.4、間距 4 mm 的點列表現（推估）',
    wheelArches: '四輪在船殼外側（輪子旁船殼半寬 21.2＋疊板唇 0.6，在 26 / 31 mm 輪胎內側），R17.5 輪拱只是保留間隙定義，不切殼；可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
