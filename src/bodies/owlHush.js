// 夜梟靜翼策略型（body-owl-hush，第四階段致敬《爆走兄弟》風格新款）：俯視寬 U 形的圓「臉盤」鼻、淚滴形快背全罩車身、
// 大型圓形深煙燻泡泡座艙、座艙後方兩撮短耳羽、車尾低位寬翼（後緣羽毛梳齒狀鋸齒、兩支短支柱、翼頂不高於座艙頂）。
// 設計：shared/design/body-owl-hush/DESIGN.md（角色、致敬語彙、和劇中車 / 市售車殼的差異）。
// 剖面由本檔的站位函式產生（推估，依 HOMAGE_RESEARCH 第 4 節與外框 / 輪胎間隙掃描）。
// 塗裝全為自創：可可棕＋燕麥米＋琥珀、人字形羽紋、號碼「23」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, finPlate, buildDriver } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sideDecal, topDecal, mergeGeos, lerp } from './loft.js';

/**
 * 單調三次內插（Fritsch–Carlson，不過衝）：給節點 tx 與各欄位的值，回傳 f(key, x)
 * @type {(tx: number[], tab: Record<string, number[]>) => (key: string, x: number) => number}
 */
const monoTable = (tx, tab) => {
  /** @type {(v: number[]) => number[]} */
  const slopes = (v) => {
    const n = v.length;
    const d = [];
    for (let k = 0; k < n - 1; k++) {
      d.push((v[k + 1] - v[k]) / (tx[k + 1] - tx[k]));
    }
    const m = [d[0]];
    for (let k = 1; k < n - 1; k++) {
      m.push(d[k - 1] * d[k] <= 0 ? 0 : (2 * d[k - 1] * d[k]) / (d[k - 1] + d[k]));
    }
    m.push(d[n - 2]);
    return m;
  };
  /** @type {Record<string, number[]>} */
  const sl = {};
  for (const key of Object.keys(tab)) {
    sl[key] = slopes(tab[key]);
  }
  return (key, x) => {
    let k = 0;
    while (k < tx.length - 2 && x > tx[k + 1]) {
      k++;
    }
    const h = tx[k + 1] - tx[k];
    const t = Math.min(1, Math.max(0, (x - tx[k]) / h));
    const t2 = t * t;
    const t3 = t2 * t;
    const v = tab[key];
    const m = sl[key];
    return (2 * t3 - 3 * t2 + 1) * v[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * v[k + 1] + (t3 - t2) * h * m[k + 1];
  };
};

/** @type {number} 車尾 x */
const X_TAIL = -64;
/** @type {number} 臉盤鼻 x */
const X_NOSE = 70;

/**
 * 縱向控制表（推估）：
 * - yTop：中線高度。臉盤鼻 21 → 座艙前 32 → 快背斜降到車尾 25（淚滴側影）
 * - cw / yC：中央隆起（引擎蓋與快背脊）的半寬與邊緣高度；
 * - hw：最寬處半寬。臉盤鼻端仍有 27–32（俯視寬 U 鼻）、前輪上方 40、腰部收到 30、後輪上方 35.5、車尾收到 15（淚滴尾）
 * - ySh：擋泥板肩高，輪心上方 31.5（26 mm 輪拱頂 28.2 之上），腰部降到 24.5 → 側視輪拱明顯高出腰線（V1）
 */
const T = monoTable([-64, -58, -50, -40, -30, -20, -8, 4, 16, 28, 40, 50, 58, 64, 68, 70], {
  yTop: [25, 26.4, 28, 29.4, 30.4, 31.2, 31.8, 32.2, 32.4, 32.2, 31.2, 29.2, 26.6, 24, 22, 20.5],
  cw: [9, 11, 13, 14, 14.5, 14.5, 14.5, 14.5, 14.5, 14.5, 15, 15.5, 16, 16, 15, 14],
  yC: [24.4, 25.6, 27, 28.2, 29, 29.6, 30, 30.2, 30.4, 30.2, 29.6, 28.2, 25.8, 23.2, 21.2, 19.8],
  hw: [15, 23, 31, 35.5, 33.5, 31.5, 31.5, 31.5, 33, 37, 40.5, 42, 42, 38.5, 34.5, 31],
  ySh: [23.5, 26.5, 30, 31.5, 28.5, 25, 24.5, 24.5, 25, 28.5, 31.5, 30.5, 27, 23.5, 21, 19.3],
  yLow: [20, 16, 13, 11, 10, 9.5, 9.5, 9.5, 9.5, 10, 11, 12.5, 14, 15, 15.5, 16],
});

/**
 * 半剖面站位（每 2 mm 一站，8 點）：中線頂 → 中央隆起 3 點（圓弧）→ 隆起邊稜 → 擋泥板內側低谷 → 擋泥板肩 → 側壁下緣
 * 隆起邊稜、擋泥板肩為銳利稜線（hard 4、6），其餘平滑
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = (() => {
  const xs = [];
  for (let x = X_TAIL; x < X_NOSE; x += 2) {
    xs.push(x);
  }
  xs.push(X_NOSE);
  return xs.map((x) => {
    const yTop = T('yTop', x);
    const cw = T('cw', x);
    const yC = T('yC', x);
    const hw = Math.max(T('hw', x), cw + 4);
    const ySh = T('ySh', x);
    const yLow = Math.min(T('yLow', x), ySh - 1.5);
    const rise = Math.max(0.3, yTop - yC);
    const pts = [0, 0.4, 0.72, 0.9].map((f) => [f * cw, yC + rise * Math.sqrt(1 - f * f * 0.95)]);
    // 擋泥板內側低谷：在隆起邊稜與擋泥板肩之間，比兩者都低 0.8 mm（分件線的溝）
    const zV = cw + 0.45 * (hw - cw);
    const yV = Math.min(yC, ySh) - 0.8 + 0.25 * Math.abs(yC - ySh);
    pts.push([cw, yC], [zV, yV], [hw, ySh], [hw, yLow]);
    return { x, pts };
  });
})();

/** @type {(x: number) => number} 燕麥米（下）／可可棕（上）分色線：臉盤下緣起、往後上掃（V13） */
const splitY = (x) => 17 + 0.075 * (60 - x);

/**
 * 人字形羽紋（V 形重複細紋，尖端朝前）的距離函式：沿 x 週期 P，V 形斜率 k，條寬 w
 * @type {(P: number, k: number, w: number) => (x: number, z: number) => number}
 */
const chevron = (P, k, w) => (x, z) => {
  const u = x + k * Math.abs(z);
  const ph = (((u % P) + P) % P) - P / 2;
  return Math.abs(ph) - w / 2;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  cocoa: namedMaterial('paint-cocoa-brown', { color: 0x5a3a26, roughness: 0.22, metalness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  cocoa2: namedMaterial('paint-cocoa-brown', { color: 0x5a3a26, roughness: 0.22, metalness: 0.2, clearcoat: 1.0, side: THREE.DoubleSide }),
  oat: namedMaterial('paint-oatmeal', { color: 0xe2d2b0, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
  oat2: namedMaterial('paint-oatmeal', { color: 0xe2d2b0, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
  amber2: namedMaterial('paint-amber', { color: 0xf0a020, roughness: 0.25, clearcoat: 0.8, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x221a14, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-cocoa', { color: 0x4a3020, roughness: 0.5, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x15110e, roughness: 0.6 }),
  // 深煙燻（帶琥珀褐色調）大泡泡座艙
  glass: namedMaterial('pc-smoke-tint', { color: 0x2a1a0c, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.78, envMapIntensity: 0.55, depthWrite: false }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3430, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-amber', { color: 0xf0a020, roughness: 0.3, clearcoat: 0.8 }),
  eye: namedMaterial('lamp-amber', { color: 0xffb020, emissive: 0xff8a00, emissiveIntensity: 0.9, roughness: 0.1, clearcoat: 1.0 }),
  oatDecal: decalMaterial('decal-oatmeal', { color: 0xeadbb8, roughness: 0.35 }),
  amberDecal: decalMaterial('decal-amber', { color: 0xf0a020, roughness: 0.3, clearcoat: 0.6 }),
  dark: decalMaterial('decal-black', { color: 0x14100c, roughness: 0.5 }),
  cocoaDecal: decalMaterial('decal-cocoa-brown', { color: 0x4e3020, roughness: 0.35, clearcoat: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 低位寬翼的俯視輪廓（x, z）：前緣微後掠的直線，後緣是羽毛梳齒狀鋸齒（每側 5 齒，齒尖朝後）
 * @type {(span: number) => number[][]}
 */
const wingOutline = (span) => {
  /** @type {number[][]} */
  const pts = [];
  // 前緣：從右翼尖到左翼尖（翼尖略往後掠）
  for (let i = 0; i <= 8; i++) {
    const z = lerp(span, -span, i / 8);
    pts.push([-47 - 3 * (Math.abs(z) / span) ** 2, z]);
  }
  // 後緣鋸齒：左翼尖 → 右翼尖（齒根 x −57、齒尖 x −62.5）
  const nTeeth = 10;
  for (let i = 0; i < nTeeth; i++) {
    const z0 = lerp(-span, span, i / nTeeth);
    const z1 = lerp(-span, span, (i + 1) / nTeeth);
    const sweep = 2.2 * (Math.abs((z0 + z1) / 2) / span) ** 2;
    pts.push([-57 - sweep, z0 + (i === 0 ? 0 : 0.01)]);
    pts.push([-62.5 - sweep, lerp(z0, z1, 0.7)]);
  }
  pts.push([-57 - 2.2, span]);
  return pts;
};

export const owlHushBody = makePolyBody({
  id: 'body-owl-hush',
  name: '夜梟靜翼策略型',
  style: 'homage',
  phase: 4,
  roof: 'canopy',
  wing: 'serrated-wing',
  theme: '寬 U 形臉盤鼻＋淚滴快背、大型深煙燻泡泡座艙、後緣鋸齒的低位寬翼；冷靜的夜間策略家',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.2,
  hard: [4, 6],
  // 26 mm 輪：R15.2（輪胎半徑 13＋2.2 mm；殼內面沿法線內縮 0.8 mm 後仍 ≥ 1 mm）
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  canopy: {
    section: 'ellipse',
    // 大型圓泡泡座艙：x 34 → −11，每 1.5 mm 一站（站位密 → 線性內插也不會出現折面）；最寬 13、最高 11.2（座艙頂約 43.5）
    stations: (() => {
      const out = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = lerp(34, -11, u);
        const halfW = i === 0 || i === 30 ? 3 : 13 * Math.sin(Math.PI * u) ** 0.55;
        const rise = 11.2 * Math.sin(Math.PI * u ** 0.85) ** 0.7;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 28,
  zones: () => [
    // 燕麥米：下半車身（分色線由臉盤往後上掃）
    { mat: 'oat', keep: (x, y) => splitY(x) - y },
    // 燕麥米：臉盤（鼻端中央 U 形面）
    { mat: 'oat', keep: (x, y, z) => Math.min(x - 56 - 0.012 * z * z, 24 - Math.abs(z)) },
    { mat: 'cocoa', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'oat2', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    const top = (x) => kit.surf.topY(x, 0);
    // 人字形羽紋（燕麥米，引擎蓋與快背；座艙底與臉盤除外）——由鼻往後掃的 V 形重複細紋
    const chev = chevron(7, 0.55, 1.5);
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (y < splitY(x) + 1.2 || x > 50 || az > 34 || az < 15.5 || kit.underCanopy(x, z) > -0.8) {
          return -1;
        }
        // 只畫在中央隆起之外的擋泥板 / 肩部（|z| 15.5–34），中央留可可棕
        return -chev(x, az);
      }),
      mat: 'oatDecal',
      name: 'decal-chevrons',
    });
    // 琥珀色分色細線（分色線上方）＋臉盤外圈細線
    parts.push({
      geometry: mergeGeos([
        kit.decal((x, y, z) => (Math.abs(z) < 24 && x > 50 ? -1 : Math.min(y - splitY(x) - 0.2, splitY(x) + 1.1 - y))),
        kit.decal((x, y, z) => {
          const d = x - 56 - 0.012 * z * z;
          return Math.abs(z) > 24 || y < splitY(x) ? -1 : Math.min(d + 1.2, -d - 0.1);
        }),
      ]),
      mat: 'amberDecal',
      name: 'decal-amber-lines',
    });
    // 泡泡座艙內的駕駛人剪影（深煙燻罩內隱約可見）
    const drv = buildDriver(10, kit.innerYAt(10) + kit.t, 1.25);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 一對琥珀色圓「眼」燈（V14）：臉盤上方左右各一，外圈可可棕眼眶
    const eyeC = [61, 14];
    /** @type {(x: number, az: number) => number} 眉線（正值 = 眉線下方）：外側高、內側低的斜線，切掉眼燈上內側 */
    const brow = (x, az) => 1.0 + 0.75 * (az - eyeC[1]) - (x - eyeC[0]);
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(4.3 - Math.hypot(x - eyeC[0], Math.abs(z) - eyeC[1]), brow(x, Math.abs(z))), { offset: 0.12 }),
      mat: 'eye',
      name: 'lamp-eyes',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const r = Math.hypot(x - eyeC[0], Math.abs(z) - eyeC[1]);
        // 眼眶：眼燈外圈 1.4 mm，眉線之上整塊塗黑（往內下斜的眉，眼神銳利）
        return Math.min(5.8 - r, Math.max(r - 4.2, -brow(x, Math.abs(z)) + 0.05));
      }),
      mat: 'dark',
      name: 'decal-eye-rings',
    });
    // 鳥喙：臉盤中央往下的琥珀色小三角刃（埋入鼻端）
    parts.push({
      geometry: finPlate(
        [
          [66, top(66) - 1.5],
          [71.2, 18.2],
          [69.4, 14.4],
          [64, 16.5],
        ],
        0,
        2.2,
      ),
      mat: 'amber2',
      outline: true,
      solid: true,
      name: 'beak',
    });
    // 耳羽：座艙後方左右兩撮短凸起（高 ≤ 4 mm，往外傾 16°），根部埋入殼面
    const tufts = [];
    for (const sg of [-1, 1]) {
      const zc = sg * 10.5;
      const y0 = kit.surf.topY(-12, zc) - 1.2;
      tufts.push(
        finPlate(
          [
            [-8, y0],
            [-17.5, y0 - 0.4],
            [-17, y0 + 4.6],
            [-13.5, y0 + 2.2],
          ],
          zc,
          2.0,
          sg * 16,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(tufts), mat: 'cocoa2', outline: true, solid: true, name: 'ear-tufts' });
    // 低位寬翼（V6 過彎型＝寬翼、V7 翼頂不高於座艙頂、V9 單段翼＋鋸齒後緣）：可可棕翼面＋琥珀鋸齒尖
    const span = 46;
    const yWing = 35.2;
    const wShape = new THREE.Shape(wingOutline(span).map(([x, z]) => new THREE.Vector2(x, -z)));
    const wingGeo = new THREE.ExtrudeGeometry(wShape, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1 });
    wingGeo.rotateX(-Math.PI / 2);
    // 攻角：後緣往上 4°（繞前緣附近）
    wingGeo.translate(48, 0, 0);
    wingGeo.rotateZ((-4 * Math.PI) / 180);
    wingGeo.translate(-48, yWing, 0);
    parts.push({ geometry: wingGeo, mat: 'cocoa2', outline: true, solid: true, name: 'serrated-wing' });
    // 鋸齒尖琥珀帶：翼面上方的鋸齒形貼片（齒尖 2.5 mm）
    const teeth = [];
    const nTeeth = 10;
    for (let i = 0; i < nTeeth; i++) {
      const z0 = lerp(-span, span, i / nTeeth);
      const z1 = lerp(-span, span, (i + 1) / nTeeth);
      const sweep = 2.2 * (Math.abs((z0 + z1) / 2) / span) ** 2;
      const zt = lerp(z0, z1, 0.7);
      const xr = -57 - sweep;
      const tri = [
        [xr - 3.0, lerp(z0, zt, 0.55)],
        [-62.5 - sweep + 0.25, zt],
        [xr - 3.0, lerp(zt, z1, 0.45)],
      ];
      const sh = new THREE.Shape(tri.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.7, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(48, -0.25, 0);
      g.rotateZ((-4 * Math.PI) / 180);
      g.translate(-48, yWing, 0);
      teeth.push(g);
    }
    parts.push({ geometry: mergeGeos(teeth), mat: 'amber2', outline: true, solid: true, name: 'wing-teeth' });
    // 兩支短支柱（後傾的刀形支柱，底部加寬並埋入殼面）
    const stays = [];
    for (const sg of [-1, 1]) {
      const zc = sg * 15;
      const yb = kit.surf.topY(-52, zc) - 1.5;
      stays.push(
        finPlate(
          [
            [-45, yb],
            [-57.5, yb],
            [-57.5, yWing - 2.2 + 0.4],
            [-53.5, yWing + 0.6],
            [-51, yWing + 0.4],
          ],
          zc,
          1.6,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(stays), mat: 'cocoa2', outline: true, solid: true, name: 'wing-stays' });
    // 側面大人字羽紋（V12 / V13）：燕麥米側裙上 3 道尖端朝前的可可棕 V 形，由前往後漸大，像收攏的翼羽
    const sideChev = [];
    for (const [xa, ya, len, w] of [
      [22, 16.2, 7, 1.9],
      [13.5, 16.6, 8.5, 2.2],
      [4, 17, 10, 2.5],
    ]) {
      sideChev.push(sdBar(xa, ya, xa - len, ya + len * 0.55, w));
      sideChev.push(sdBar(xa, ya, xa - len, ya - len * 0.5, w));
    }
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < 28 || y > splitY(x) - 0.4 ? -1 : -Math.min(...sideChev.map((f) => f(x, y))))),
      mat: 'cocoaDecal',
      name: 'decal-side-chevrons',
    });
    // 號碼 23：側面後段（燕麥米底）、快背
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('23', { h: 6.2, w: 3.4, gap: 0.9 }), { x0: -13, y0: 15.6, zMin: 28 })),
        kit.decal(topDecal(sdNumber('23', { h: 5, w: 2.8, gap: 0.7 }), { x0: -30, yMin: 25 })),
      ]),
      mat: 'dark',
      name: 'decal-number',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同第三階段各款）',
    geometry: '本檔 T 表與 STATIONS（推估，依 HOMAGE_RESEARCH 4-1：長約 136、座艙頂約 44；外框與輪胎間隙用 body-check 掃描）',
    wheelArches: '前後 R15.2：只對應 26 mm 輪（半徑 13＋2.2 mm）；31 mm 輪不支援',
    wing: '寬翼、支柱、耳羽、鳥喙視為 ABS 實心件（推估），質量 = 封閉體積 × ABS 1.05 g/cm³；翼頂（約 37）低於座艙頂（約 43）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
