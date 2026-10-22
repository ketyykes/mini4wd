// 水上賽艇浮筒暴走型（body-hydroplane-sponson，第六階段 LG2 致敬款）：取材三點式水上賽艇——
// 前輪分別包在左右兩個往前伸、尖頭流線的浮筒裡（浮筒尖比中央艇身多伸出 8 mm，兩浮筒之間不橋接任何翼）；
// 中央艇身低而窄、頂面一條 V 形龍骨脊；小型封閉膠囊式煙燻座艙罩在艇身前段；後輪由寬平的後甲板蓋住，車尾平切艉板；
// 車尾雙層水平翼（下層坐在後甲板上、上層往後錯開 4 mm，兩片細短撐板相連）。
// 設計：shared/design/body-hydroplane-sponson/DESIGN.md（角色、LG2 語彙 L2-x、和劇中車 / 市售車殼的差異）。
// 剖面由本檔的站位產生器產生（推估，依 HOMAGE_RESEARCH 6-5-2 P4 與外框 / 輪胎 / 導輪間隙掃描）。
// 塗裝全為自創：鉻黃＋午夜藍＋白、浮筒上的號碼圓牌「14」、從浮筒尖往後的白色水花鋸齒分色、龍骨白中線；
// 不含任何廠商 / 作品名稱、商標、隊名、國旗配色或角色圖像。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { monoCurve, buildStations, smoothNormals, smoothMax } from './gazelleLeap.js';
import { namedMaterial, decalMaterial, sdNumber, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 艉板 x */
const X_TAIL = -75;
/** @type {number} 放樣車身前端 x（再往前是浮筒尖與艇首兩個實體件） */
const X_FRONT = 60;
/** @type {number} 浮筒中心線 |z|（= 前輪中心） */
const Z_SPONSON = 29.75;

/** 縱向控制節點（x 由後到前；前後軸 x = ±40） */
const XS = [-75, -70, -62, -52, -40, -28, -16, -6, 4, 14, 22, 30, 40, 50, 56, 60];
/**
 * 縱向控制表（推估）：
 * - yC：中央艇身龍骨脊。後段引擎罩 30（比後甲板高 1.4）→ 座艙段 26 → 龍骨往前降到 23.8（底盤齒輪箱頂約 21）→ 艇首 21
 * - yS：浮筒稜線（前段）／後甲板高度（後段）。浮筒在前輪上方 29.4、往前降到 27（iter-69：25.5 → 27，前端斷面包住浮筒尖根部，消除 x 57 段差）；後甲板 28.6 平直、艉板 26.4
 * - hw：半寬。浮筒外側 38.5 → 浮筒後方腰部收到 31 → 後甲板 36.5（剛好蓋住 26 mm 輪胎外側 34.25）→ 艉板 32（平切；避開後導輪 x −71.5、|z| 42、R6.5）
 * - yLow：側壁下緣
 * @type {Record<string, (x: number) => number>}
 */
const P = {
  yC: monoCurve(XS, [27.4, 29, 30, 30.2, 30, 29.6, 28.6, 27, 26, 25.2, 24.6, 24.2, 23.9, 23.5, 22.4, 21]),
  yS: monoCurve(XS, [26.4, 27.6, 28.4, 28.6, 28.6, 28.6, 28.4, 28, 28, 28.4, 28.9, 29.3, 29.4, 28.8, 27.9, 27.0]),
  hw: monoCurve(XS, [32, 33, 35.6, 36.5, 36.5, 36.2, 33.5, 31, 32.5, 37, 38.5, 38.5, 38.5, 38.3, 37.6, 36.4]),
  yLow: monoCurve(XS, [21, 18.5, 15.5, 13.5, 13, 13.2, 14, 14.4, 14.4, 14, 13.6, 13.5, 13.5, 13.8, 14.2, 14.6]),
};

/**
 * 浮筒內坡的最低高度：以前輪軸為中心的拋物線（輪心正上方 29，離輪心 15 mm 處 26.3）→ 內坡在 R15.2 輪拱之上
 * @type {(x: number) => number}
 */
const sponsonFloor = (x) => 29 - 0.012 * (x - 40) ** 2;

/**
 * 半剖面 8 點（hard [1, 6]：龍骨脊 0–1 為直線 → V 形龍骨；側壁肩為銳利稜線）
 * - 前段（x ≥ 14）：龍骨 → 龍骨側 → 浮筒間的通道底 → 浮筒內壁 → 浮筒稜線 → 外側圓肩 → 側壁肩 → 側壁下緣
 * - 後段（x ≤ −8）：龍骨（引擎罩）→ 罩側 → 平直後甲板 4 點 → 側壁肩 → 側壁下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yS = P.yS(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  // 前段：通道底在 x 22–55、|z| ≤ 26 的範圍要高過底盤內件（約 21）→ 外殼 ≥ 22.4
  const vFloor = x > 22 && x < 55 ? 22.4 : 17;
  const yV = Math.max(Math.min(yC - 1.6, yS - 4), Math.min(vFloor, yC - 0.8));
  const yIn = smoothMax(yS - 1.6, sponsonFloor(x), 0.5);
  const zS = Math.min(Z_SPONSON, hw - 3);
  const front = [
    [0, yC],
    [4.5, yC - 1.5],
    [11.5, yV],
    [20.5, Math.min(yIn, yS - 0.4)],
    [zS, yS],
    [hw - 2.4, yS - 1.1],
    [hw, yS - 4.2],
    [hw, Math.min(yLow, yS - 5.2)],
  ];
  const yD = yS;
  const rear = [
    [0, Math.max(yC, yD + 0.2)],
    [5, Math.max(yC - 0.9, yD + 0.15)],
    [10.5, yD + 0.1],
    [18, yD + 0.05],
    [26, yD],
    [hw - 2.2, yD - 0.35],
    [hw, yD - 2.6],
    [hw, Math.min(yLow, yD - 3.6)],
  ];
  const b = smoothstep(14, -8, x);
  return front.map((p, i) => [lerp(p[0], rear[i][0], b), lerp(p[1], rear[i][1], b)]);
};

const STATIONS = buildStations(X_TAIL, X_FRONT, 1.5, profile);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  yellow: namedMaterial('paint-bright-chrome-yellow', { color: 0xffc414, roughness: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  yellow2: namedMaterial('paint-bright-chrome-yellow', { color: 0xffc414, roughness: 0.18, clearcoat: 1.0, side: THREE.DoubleSide }),
  navy: namedMaterial('paint-midnight-blue', { color: 0x16224a, roughness: 0.24, metalness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  navy2: namedMaterial('paint-midnight-blue', { color: 0x16224a, roughness: 0.24, metalness: 0.2, clearcoat: 1.0, side: THREE.DoubleSide }),
  white: namedMaterial('paint-bright-white', { color: 0xf5f6f4, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  white2: namedMaterial('paint-bright-white', { color: 0xf5f6f4, roughness: 0.2, clearcoat: 1.0, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x15181f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-navy', { color: 0x2a3560, roughness: 0.5, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x14181b, roughness: 0.6 }),
  // 小膠囊煙燻座艙罩
  glass: namedMaterial('pc-smoke-tint', { color: 0x10202e, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.8, envMapIntensity: 0.5, depthWrite: false }),
  dWhite: decalMaterial('decal-white', { color: 0xf6f6f2, roughness: 0.35 }),
  dNavy: decalMaterial('decal-midnight-blue', { color: 0x16224a, roughness: 0.35 }),
  lamp: namedMaterial('lamp-amber', { color: 0xffd36a, emissive: 0xffa21a, emissiveIntensity: 0.7, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {(x: number) => number} 白色水花分色線（側面 y）：從浮筒尖附近高、往後斜降，上緣是鋸齒（週期 6 mm、齒高 1.8） */
const splashY = (x) => {
  const base = 13.5 + 0.21 * (x + 12);
  const saw = Math.abs((((x + 100) / 6) % 1) - 0.5) * 2;
  return base + 1.8 * saw;
};

/**
 * 浮筒尖（實體件）：沿 x 往前收尖的橢圓斷面掃掠；根部斷面接上放樣車身前端的浮筒剖面，尖端略往內收、往下勾
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildSponsonTip = (sg) => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = lerp(57, 82, t);
    pts.push([x, lerp(21.2, 17.2, t ** 1.4), sg * lerp(Z_SPONSON, 26.2, t ** 0.8)]);
  }
  return smoothNormals(
    sweepEllipse(pts, 48, (t) => {
      const k = Math.max(0.03, (1 - t ** 1.7) ** 0.62);
      return [7.2 * k, 6.2 * k];
    }, 24),
  );
};

/**
 * 艇首（實體件）：中央艇身往前的窄 V 形尖首，比浮筒尖短 8 mm
 * @type {() => THREE.BufferGeometry}
 */
const buildBow = () => {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push([lerp(57, 74, t), lerp(19.8, 16.6, t ** 1.3), 0]);
  }
  return smoothNormals(
    sweepEllipse(pts, 36, (t) => {
      const k = Math.max(0.04, (1 - t ** 1.8) ** 0.6);
      return [5.6 * k, 2.6 * k];
    }, 20),
  );
};

/**
 * 水平薄翼（有厚度、前緣圓後緣尖）：弦 [xLE, xTE]、半展 span、中心高 y、厚 thick；兩端以端面封閉
 * @type {(xLE: number, xTE: number, span: number, y: number, thick: number) => THREE.BufferGeometry}
 */
const flatWing = (xLE, xTE, span, y, thick) => {
  const shape = new THREE.Shape();
  const n = 16;
  /** @type {(u: number) => number} NACA 對稱厚度（半厚比例） */
  const td = (u) => (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4) / 0.1;
  for (let i = 0; i <= n; i++) {
    const u = (1 - Math.cos((Math.PI * i) / n)) / 2;
    const px = lerp(xLE, xTE, u);
    const py = y + (thick / 2) * td(u);
    if (i === 0) {
      shape.moveTo(px, py);
    } else {
      shape.lineTo(px, py);
    }
  }
  for (let i = n - 1; i > 0; i--) {
    const u = (1 - Math.cos((Math.PI * i) / n)) / 2;
    shape.lineTo(lerp(xLE, xTE, u), y - (thick / 2) * td(u));
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 2 * span, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -span);
  return g;
};

export const hydroplaneSponsonBody = makePolyBody({
  id: 'body-hydroplane-sponson',
  name: '水上賽艇浮筒暴走型',
  style: 'homage',
  phase: 6,
  homageSeries: 'lg2',
  form: 'sponson',
  roof: 'canopy',
  wing: 'biplane',
  theme: '三點式水上賽艇：前輪包在兩個前伸尖頭浮筒裡、低窄 V 龍骨艇身＋小膠囊座艙罩、寬平後甲板與平切艉板、雙層錯開水平翼；直線全開的水上暴走族',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.0,
  hard: [1, 6],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  canopy: {
    section: 'ellipse',
    // 小膠囊：x 24 → −4，最寬 7、最高 9.6（罩頂約 35.5）
    stations: (() => {
      const out = [];
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(24, -4, u);
        const halfW = i === 0 || i === n ? 2 : 7 * Math.sin(Math.PI * u ** 0.85) ** 0.55;
        const rise = 9.6 * Math.sin(Math.PI * u ** 0.8) ** 0.62;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 白色水花：浮筒側面與前段，鋸齒上緣（|z| > 17 的側面）
    { mat: 'white', keep: (x, y, z) => (Math.abs(z) > 17 && x > -30 ? splashY(x) - y : -1) },
    // 午夜藍：中央艇身（龍骨與浮筒之間的通道），座艙後方收成往後的尖角（x −26 收尖）
    { mat: 'navy', keep: (x, y, z) => 13.2 * smoothstep(-26, -4, x) - Math.abs(z) },
    // 午夜藍：側面吃水線帶（白色水花之後，往艉板略升）
    { mat: 'navy', keep: (x, y, z) => (Math.abs(z) > 30 && x < 20 ? 19.2 - 0.03 * x - y : -1) },
    { mat: 'yellow', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'navy2', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    const topY = (x, z) => kit.surf.topY(x, z);
    // 浮筒尖（白，L2-1 的外露機能件「前輪防撞浮筒」）＋艇首（午夜藍）
    // 浮筒尖與艇首是射出殼的一部分（中空）→ 標 shell：質量 = 面積 × 壁厚 × 密度
    parts.push({ geometry: mergeGeos([buildSponsonTip(-1), buildSponsonTip(1)]), mat: 'white2', shell: true, name: 'sponson-tips' });
    parts.push({ geometry: buildBow(), mat: 'navy2', shell: true, name: 'bow' });
    // 浮筒側面的防浪條（spray rail）：只沿浮筒尖外側、往後略降的細長條（午夜藍）；
    // 後端截在 x 57.5（埋進放樣車身側壁、在前輪拱前緣 x ≈ 54 之前），不穿過前輪
    /** @type {THREE.BufferGeometry[]} */
    const rails = [];
    for (const sg of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const x = lerp(76, 57.5, i / 10);
        const t = (x - 57) / 25;
        const z = lerp(Z_SPONSON, 26.2, t ** 0.8) + 6.4 * Math.max(0.05, (1 - t ** 1.7) ** 0.62);
        pts.push([x, lerp(21.2, 17.2, t ** 1.4) - 1.2, sg * z]);
      }
      rails.push(sweepEllipse(pts, 40, (t) => [0.55, 0.45 * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.15)))], 8));
    }
    parts.push({ geometry: mergeGeos(rails), mat: 'navy2', solid: true, name: 'spray-rails' });
    // 雙層水平翼（biplane，L2-5 尾翼大型化的自創形式）：下層坐在後甲板上、上層往後錯開 4 mm，兩片細短撐板相連
    const deckY = topY(-64, 20);
    const lowerY = deckY + 1.0;
    const upperY = 33.3;
    const lower = flatWing(-56, -67, 33.5, lowerY, 1.3);
    const upper = flatWing(-60, -72.5, 35.5, upperY, 1.3);
    parts.push({ geometry: mergeGeos([lower, upper]), mat: 'navy2', solid: true, outline: true, name: 'biplane-wings' });
    // 翼面白色前緣帶與鉻黃翼端：上層翼上面的白帶（小面積對比）
    parts.push({ geometry: flatWing(-60.3, -63.6, 35.2, upperY + 0.2, 1.2), mat: 'white2', solid: true, name: 'wing-upper-band' });
    parts.push({ geometry: mergeGeos([-1, 1].map((sg) => {
      const g = flatWing(-60.2, -72.3, 2.2, upperY, 1.42);
      g.translate(0, 0, sg * 33.4);
      return g;
    })), mat: 'yellow2', solid: true, name: 'wing-tips' });
    // 撐板：兩片細短的流線撐板（z ±19），從下層翼頂到上層翼底，往後傾
    /** @type {THREE.BufferGeometry[]} */
    const struts = [];
    for (const sg of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(-58.5, lowerY);
      shape.lineTo(-63.5, lowerY);
      shape.lineTo(-67.8, upperY + 0.1);
      shape.lineTo(-62.8, upperY + 0.1);
      shape.lineTo(-58.5, lowerY);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
      g.translate(0, 0, sg * 19 - 0.6);
      struts.push(g);
    }
    parts.push({ geometry: mergeGeos(struts), mat: 'yellow2', solid: true, outline: true, name: 'biplane-struts' });
    // 龍骨白中線（艇首到座艙前、座艙後到艉板）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > -4 && x < 25) {
          return -1;
        }
        return 0.55 - Math.abs(z);
      }),
      mat: 'dWhite',
      name: 'decal-keel-line',
    });
    // 浮筒號碼圓牌（L2-6 自創號碼）：浮筒頂、前輪上方的白色圓＋午夜藍「14」
    /** @type {KeepFn} */
    const disc = (x, y, z) => (y < 26 ? -1 : 6.2 - Math.hypot(x - 40, Math.abs(z) - Z_SPONSON));
    parts.push({ geometry: kit.decal(disc), mat: 'dWhite', name: 'decal-number-disc' });
    const num = sdNumber('14', { h: 6.4, w: 3.2, gap: 0.8 });
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          if (y < 26 || Math.abs(Math.abs(z) - Z_SPONSON) > 6) {
            return -1;
          }
          // 從該側車外往內看可讀（字頭朝車身中線）
          if (z > 0) {
            return -num(x - 40, Z_SPONSON - z);
          }
          return -num(40 - x, z + Z_SPONSON);
        },
        { offset: 0.12 },
      ),
      mat: 'dNavy',
      name: 'decal-number',
    });
    // 後甲板側面的號碼（側視可讀）
    parts.push({
      geometry: kit.decal(sideDecal(sdNumber('14', { h: 5.6, w: 2.9, gap: 0.7 }), { x0: -40, y0: 23.8, zMin: 33 })),
      mat: 'dNavy',
      name: 'decal-number-side',
    });
    // 後甲板的兩道午夜藍細條（從座艙後方往艉板，水上賽艇甲板的分隔線）
    parts.push({
      geometry: kit.decal((x, y, z) => (x > -8 || x < -74 ? -1 : 0.5 - Math.abs(Math.abs(z) - 12))),
      mat: 'dNavy',
      name: 'decal-deck-lines',
    });
    // 艉板上方的兩顆琥珀尾燈（小圓）
    parts.push({
      geometry: kit.decal((x, y, z) => (x > -71 ? -1 : 1.6 - Math.hypot(x + 72.5, Math.abs(z) - 26)), { offset: 0.1 }),
      mat: 'lamp',
      name: 'lamp-tail',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他致敬款）',
    geometry: '本檔站位產生器 P（推估，依 HOMAGE_RESEARCH 6-5-2 P4：長約 157、座艙罩頂約 35.5、浮筒頂約 29）；龍骨為斷面 V（hard 1）',
    wheelArches: '前後 R15.2：只對應 26 mm 輪（半徑 13＋2.2 mm）；浮筒內徑只容 26 mm 輪，31 mm 輪不支援',
    sponsons: '浮筒尖與艇首為中空殼（面積 × 壁厚 0.8 × 密度）；防浪條、雙層翼與撐板視為 ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
