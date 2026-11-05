// 夜梟靜翼策略型（body-owl-hush，致敬《爆走兄弟》風格）：俯視寬 U 形的圓「臉盤」鼻、淚滴形快背全罩車身、
// 大型圓形深煙燻泡泡座艙、座艙後方兩撮短耳羽、車尾低位寬翼（2 片後掠層疊羽片、圓頭羽尖＋羽軸稜、無端板、兩支短支柱、翼頂不高於座艙頂）。
// 設計：shared/design/body-owl-hush/DESIGN.md（角色、致敬語彙、和劇中車 / 市售車殼的差異）。
// 剖面由本檔的站位函式產生（推估，依 HOMAGE_RESEARCH 第 4 節與外框 / 輪胎間隙掃描）。
// 塗裝全為自創：可可棕＋燕麥米＋琥珀、人字羽紋、號碼「23」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, finPlate, buildDriver, airfoilFin } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sideDecal, topDecal, mergeGeos, lerp, buildRegion, buildRim } from './loft.js';

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

/** @type {number} 眼窩中心 x（俯視） */
const EYE_X = 61;
/** @type {number} 眼窩中心 |z| */
const EYE_Z = 14;
/** @type {number} 眼窩半徑 */
const EYE_R = 4.9;

/**
 * 眼窩：俯視大圓形（半徑 4.9；大圓眼才撐得起貓頭鷹臉，細長眼會讓臉變弱），回傳值 < 0 = 在眼窩內
 * @type {(x: number, y: number, z: number) => number}
 */
const eyeSd = (x, y, z) => Math.hypot(x - EYE_X, Math.abs(z) - EYE_Z) - EYE_R;

/**
 * 眼周羽框（凸出的深可可細稜）＝眼窩外圈上後半的 1.5 mm 環＋從眼窩外後緣往後外斜拉出的細長眼尾羽稜
 * （俯視：(57.2, |z| 17.6) → (47.5, |z| 22.8)、寬 1.5 → 0.6 收尖），回傳值 > 0 = 在羽框內
 * @type {(x: number, y: number, z: number) => number}
 */
const eyeFrame = (x, y, z) => {
  const d = eyeSd(x, y, z);
  // 環：眼窩外 0–1.5 mm，只取上後半（往車尾、往外側）
  const ring = Math.min(d, 1.5 - d, EYE_X + 1.5 - x + 0.6 * (Math.abs(z) - EYE_Z));
  // 眼尾細稜：線段距離 < 寬度
  const ax = 57.2;
  const az = 17.6;
  const dx = 47.5 - ax;
  const dz = 22.8 - az;
  const px = x - ax;
  const pz = Math.abs(z) - az;
  const t = Math.min(1, Math.max(0, (px * dx + pz * dz) / (dx * dx + dz * dz)));
  const tail = lerp(0.75, 0.3, t) - Math.hypot(px - t * dx, pz - t * dz);
  return Math.max(ring, Math.min(tail, d));
};

/** @type {(x: number) => number} 燕麥米（下）／可可棕（上）分色線：臉盤下緣起、往後上掃（V13） */
const splitY = (x) => 17 + 0.075 * (60 - x);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 可可棕是帶金屬珠光的亮面漆（metalness 0.45、亮面清漆），和霧面燕麥米、深棕尾段拉開材質對比
  cocoa: namedMaterial('paint-cocoa-brown', { color: 0x65412a, roughness: 0.2, metalness: 0.45, clearcoat: 1.0, clearcoatRoughness: 0.04 }),
  cocoa2: namedMaterial('paint-cocoa-brown', { color: 0x65412a, roughness: 0.2, metalness: 0.45, clearcoat: 1.0, side: THREE.DoubleSide }),
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
  eye: namedMaterial('lamp-amber', { color: 0xffb020, emissive: 0xff8a00, emissiveIntensity: 1.1, roughness: 0.1, clearcoat: 1.0 }),
  oatDecal: decalMaterial('decal-oatmeal', { color: 0xeadbb8, roughness: 0.35 }),
  amberDecal: decalMaterial('decal-amber', { color: 0xf0a020, roughness: 0.3, clearcoat: 0.6 }),
  dark: decalMaterial('decal-black', { color: 0x14100c, roughness: 0.5 }),
  brow: namedMaterial('paint-cocoa-dark', { color: 0x2c1b10, roughness: 0.25, clearcoat: 0.9 }),
  brow2: namedMaterial('paint-cocoa-dark', { color: 0x2c1b10, roughness: 0.25, clearcoat: 0.9, side: THREE.DoubleSide }),
  liner: namedMaterial('plastic-liner-matte', { color: 0x1a1512, roughness: 0.85, side: THREE.DoubleSide }),
  cocoaDecal: decalMaterial('decal-cocoa-brown', { color: 0x4e3020, roughness: 0.35, clearcoat: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 人字羽紋：概念圖那種粗、尖端朝前的 V 形羽紋，
 * 每側一列沿 x 每 P mm 一道，V 尖在 |z| = zc，兩臂往外後掠（斜率 a），臂寬由 V 尖的 w 收到臂端的 0.45 w（羽尖收尖）。
 * 回傳值 ≥ 0 = 在羽紋內
 * @type {(P: number, zc: number, span: number, a: number, w: number) => (x: number, az: number) => number}
 */
const featherChevrons = (P, zc, span, a, w) => (x, az) => {
  const dz = Math.abs(az - zc);
  if (dz > span) {
    return -1;
  }
  // 同一道 V 上 x + a·dz 為定值（V 尖的 x）→ 到最近一道的 x 向距離
  const f = x + a * dz;
  const g = f - P * Math.round(f / P);
  const wEff = w * (1 - 0.55 * (dz / span));
  return Math.min(wEff / 2 - Math.abs(g), span - dz);
};

/**
 * 有厚度的升力面（寬翼）：展向 u ∈ [−1, 1]（z = u · span）、弦向 v ∈ [v0, v1]（0 = 前緣、1 = 後緣），
 * 上下兩面以 √v(1 − v) 厚度分布在前緣、後緣閉合；v 截斷處補端面、翼尖厚度收到 0 → 每一段都是封閉網格
 * @type {(o: { v0: number, v1: number, nU: number, nV: number, span: number, le: (u: number) => number, te: (u: number) => number, y: (u: number, v: number) => number, thick: (u: number) => number }) => THREE.BufferGeometry}
 */
const liftSurface = (o) => {
  /** @type {(v: number) => number} 正規化厚度分布（最大 1，v = 1/3） */
  const tv = (v) => (Math.sqrt(v) * (1 - v)) / 0.3849;
  /** @type {(i: number, j: number, sg: number) => number[]} */
  const P = (i, j, sg) => {
    const u = lerp(-1, 1, i / o.nU);
    const v = lerp(o.v0, o.v1, j / o.nV);
    const x = lerp(o.le(u), o.te(u), v);
    return [x, o.y(u, v) + sg * 0.5 * o.thick(u) * tv(v), u * o.span];
  };
  /** @type {number[]} */
  const pos = [];
  for (let i = 0; i < o.nU; i++) {
    for (let j = 0; j < o.nV; j++) {
      for (const sg of [1, -1]) {
        const a = P(i, j, sg);
        const b = P(i + 1, j, sg);
        const c = P(i + 1, j + 1, sg);
        const d = P(i, j + 1, sg);
        if (sg > 0) {
          pos.push(...a, ...c, ...b, ...a, ...d, ...c);
        } else {
          pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        }
      }
    }
  }
  for (const [j, front] of [
    [0, true],
    [o.nV, false],
  ]) {
    for (let i = 0; i < o.nU; i++) {
      const t0 = P(i, j, 1);
      const t1 = P(i + 1, j, 1);
      const b0 = P(i, j, -1);
      const b1 = P(i + 1, j, -1);
      if (front) {
        pos.push(...t0, ...t1, ...b1, ...t0, ...b1, ...b0);
      } else {
        pos.push(...t0, ...b1, ...t1, ...t0, ...b0, ...b1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 輪拱內襯：輪拱切口內側的半圓環擋板（側視半徑 r0–r1、輪心上方 0°–180°），沿 z 厚 thick，
 * 擋住從側面經輪胎與拱緣間隙看進殼內的空腔
 * @type {(x0: number, r0: number, r1: number, z0: number, thick: number) => THREE.BufferGeometry}
 */
const archRing = (x0, r0, r1, z0, thick) => {
  /** @type {THREE.Vector2[]} */
  const pts = [];
  const n = 32;
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * i) / n;
    pts.push(new THREE.Vector2(x0 + r1 * Math.cos(a), 13 + r1 * Math.sin(a)));
  }
  for (let i = n; i >= 0; i--) {
    const a = (Math.PI * i) / n;
    pts.push(new THREE.Vector2(x0 + r0 * Math.cos(a), 13 + r0 * Math.sin(a)));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: thick, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, z0);
  return g;
};

export const owlHushBody = makePolyBody({
  id: 'body-owl-hush',
  name: '夜梟靜翼策略型',
  style: 'homage',
  phase: 4,
  // 分組（shared/design/HOMAGE_RESEARCH.md 第 6 節）
  homageSeries: 'lg1',
  form: 'teardrop',
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
  // 眼窩（俯視圓形、深 1.3 mm），槽底放琥珀燈片，上緣加凸出的眉骨
  recesses: [{ id: '眼窩 ×2', view: 'top', shape: 'fn', sd: eyeSd, depth: 1.3 }],
  innerSkipRecess: true,
  sideZMin: 28,
  zones: () => [
    // 燕麥米：下半車身（分色線由臉盤往後上掃）
    { mat: 'oat', keep: (x, y) => splitY(x) - y },
    // 燕麥米：臉盤（鼻端中央 U 形面）
    { mat: 'oat', keep: (x, y, z) => Math.min(x - 56 - 0.012 * z * z, 24 - Math.abs(z)) },
    // 三色分割塗裝：快背後段＋後輪擋泥板頂的深可可「收攏尾羽」，前緣是尖端朝前的箭形（中線 x −14、|z| 30 退到 x −32），
    // 大面積棕色切成珍珠可可（前）／深可可（後）兩段，配燕麥米下半＝三色
    { mat: 'brow', keep: (x, y, z) => -14 - x - 0.6 * Math.abs(z) },
    { mat: 'cocoa', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'oat2', recess: 'cockpit', recessWall: 'brow2', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    const top = (x) => kit.surf.topY(x, 0);
    // 人字羽紋（燕麥米，頂面 |z| 15.5–29.5；座艙底與臉盤除外）——每 11 mm 一道粗 V（尖端寬 4.4 mm），尖端朝前、兩臂往外後掠；
    // 不延伸到擋泥板外側斜面（V 的外臂翻過稜線後側視像肋骨）
    const scales = featherChevrons(11, 22.5, 7, 0.95, 4.4);
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (y < splitY(x) + 1.2 || x > 50 || az > 34 || az < 15.5 || kit.underCanopy(x, z) > -0.8) {
          return -1;
        }
        return scales(x, az);
      }),
      mat: 'oatDecal',
      name: 'decal-feather-chevrons',
    });
    // 琥珀色分色細線（分色線上方）＋臉盤外圈細線
    parts.push({
      geometry: mergeGeos([
        kit.decal((x, y, z) => (Math.abs(z) < 24 && x > 50 ? -1 : Math.min(y - splitY(x) - 0.2, splitY(x) + 1.1 - y))),
        kit.decal((x, y, z) => {
          const d = x - 56 - 0.012 * z * z;
          return Math.abs(z) > 24 || y < splitY(x) || eyeSd(x, y, z) < 0.8 ? -1 : Math.min(d + 1.2, -d - 0.1);
        }),
      ]),
      mat: 'amberDecal',
      name: 'decal-amber-lines',
    });
    // 泡泡座艙內的駕駛人剪影（深煙燻罩內隱約可見）
    const drv = buildDriver(10, kit.innerYAt(10) + kit.t, 1.25);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 一對琥珀色大圓「眼」燈（V14，凹入的燈、半徑 4.9）：眼窩槽底的琥珀燈片（自發光）
    const lamp = buildRegion(kit.surf, [...kit.holes, (x, y, z) => -eyeSd(x, y, z)], { offset: -1.3 + 0.08 });
    parts.push({ geometry: lamp.geometry, mat: 'eye', name: 'lamp-eyes' });
    // 眼周羽框＝眼窩上後半圈的深可可凸稜（高 0.6 mm）＋往後外斜拉出的細長眼尾羽稜（炫砲用，眼本身仍是大圓）
    const browReg = buildRegion(kit.surf, [...kit.holes, eyeFrame], { offset: 0.6 });
    parts.push({ geometry: browReg.geometry, mat: 'brow', name: 'eye-brow' });
    parts.push({ geometry: buildRim(browReg, 0, 0.6), mat: 'brow2', name: 'eye-brow-wall' });
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
    // 耳羽：座艙後方左右兩撮三角凸起，高出殼面約 5.6 mm、往後掠、往外傾 10°，根部埋入殼面，側視看得到
    const tufts = [];
    for (const sg of [-1, 1]) {
      const zc = sg * 11;
      const y0 = kit.surf.topY(-13, zc) - 1.2;
      tufts.push(
        finPlate(
          [
            [-6, y0],
            [-20, y0 - 0.5],
            [-20.5, y0 + 6.8],
            [-14.5, y0 + 3.4],
          ],
          zc,
          2.6,
          sg * 10,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(tufts), mat: 'cocoa2', outline: true, solid: true, name: 'ear-tufts' });
    // 前輪拱內襯：拱緣內側的半圓環擋板（z 23.0–23.6，距 26 mm 輪胎內側面 1.65 mm）
    parts.push({
      geometry: mergeGeos([archRing(40, 11, 15.6, 23.0, 0.6), archRing(40, 11, 15.6, -23.6, 0.6)]),
      mat: 'liner',
      solid: true,
      name: 'arch-liners',
    });
    // 低位寬翼（V6 過彎型＝寬翼、V7 翼頂不高於座艙頂）：
    // 2 片後掠層疊羽片（像收攏的貓頭鷹初級飛羽；疊到 3 層時側視像疊起來的木板、會讀成多段翼），不加端板：
    // - 下片長（半展 46.5，琥珀）、上片短（半展 33，燕麥米＋深可可羽尖），上片前緣疊在下片上、片間無縫；
    // - 兩片後緣都是圓頭羽尖（下片每側 3 枚、上片每側 2.5 枚，上片羽尖落在下片兩枚羽尖之間），羽尖之間有 V 形缺口；
    // - 羽尖往下彎 1.2 mm（初級飛羽的下垂羽端）、上片攻角比下片多 4°（往後微張）→ 側視是兩片張開、後緣下垂的羽片，不是平行木板；
    // - 中線各有一條深色羽軸稜（下片 / 上片），像羽毛的羽軸。
    // 翼頂約 39.5（仍低於座艙頂 43.5）；分段數每片 48 × 6
    const yWing = 35.2;
    /**
     * 羽片參數：半展 span、疊高 dy、中線前緣 x0、前緣後掠量 sweep（翼尖處）、後緣額外後掠量 sweepTe、中線弦長 chord、
     * 每側羽尖數 nTip、羽尖缺口深 notch、攻角 aoa（度）、羽尖色分界 vTip（null = 單色）
     * @type {{ span: number, dy: number, x0: number, sweep: number, sweepTe: number, chord: number, nTip: number, notch: number, aoa: number, mat: string, tipMat: string | null, vTip: number, name: string }[]}
     */
    const FEATHERS = [
      { span: 46.5, dy: 0, x0: -48.5, sweep: 12, sweepTe: 8.5, chord: 14, nTip: 3, notch: 3.6, aoa: 4, mat: 'amber2', tipMat: null, vTip: 1, name: 'feather-wing-low' },
      { span: 33, dy: 1.1, x0: -47, sweep: 8, sweepTe: 4, chord: 10.5, nTip: 2.5, notch: 3, aoa: 8, mat: 'oat2', tipMat: 'brow2', vTip: 0.62, name: 'feather-wing-top' },
    ];
    /** @type {(f: { sweep: number, x0: number }, u: number) => number} 羽片前緣 x：中線最前、往翼尖以 |u|^1.6 後掠 */
    const featherLe = (f, u) => f.x0 - f.sweep * Math.abs(u) ** 1.6;
    /** @type {(f: { nTip: number, notch: number }, u: number) => number} 圓頭羽尖：每枚羽尖中央 0、兩枚之間的 V 形缺口深 notch */
    const featherNotch = (f, u) => {
      const ph = (Math.abs(u) * f.nTip) % 1;
      return f.notch * (1 - Math.sqrt(Math.max(0, 1 - (2 * ph - 1) ** 2)));
    };
    for (const f of FEATHERS) {
      const surf = {
        nU: 48,
        span: f.span,
        le: (u) => featherLe(f, u),
        // 後緣：弦長保持到外側 80% 才收到翼尖 1 mm、往後掠，再扣掉羽尖缺口 → 圓頭羽尖排成往後外伸的羽列
        te: (u) => featherLe(f, u) - Math.max(1, (1 + (f.chord - 1) * (1 - Math.abs(u) ** 6)) - featherNotch(f, u)) - f.sweepTe * u * u,
        // 弦向：前段照攻角上揚、後 40% 羽端往下彎 1.2 mm
        y: (u, v) => yWing + f.dy + 0.9 * u * u + 0.5 * Math.sin(Math.PI * v) + v * f.chord * Math.tan((f.aoa * Math.PI) / 180) - 1.2 * Math.max(0, (v - 0.6) / 0.4) ** 2,
        thick: (u) => 1.3 * (1 - u ** 8),
      };
      if (f.tipMat) {
        parts.push({ geometry: liftSurface({ ...surf, v0: 0, v1: f.vTip, nV: 4 }), mat: f.mat, outline: true, solid: true, name: f.name });
        parts.push({ geometry: liftSurface({ ...surf, v0: f.vTip, v1: 1, nV: 3 }), mat: f.tipMat, outline: true, solid: true, name: `${f.name}-tips` });
      } else {
        parts.push({ geometry: liftSurface({ ...surf, v0: 0, v1: 1, nV: 6 }), mat: f.mat, outline: true, solid: true, name: f.name });
      }
    }
    // 羽軸稜：每片中線一條深可可細稜（寬 1.2 mm、高出羽面約 0.7 mm，從前緣後 1.5 mm 到中線缺口前 0.8 mm），貼紙做不到翼面，用低面數實心窄條
    const shafts = [];
    for (const f of FEATHERS) {
      const x0 = f.x0 - 1.5;
      // 中線剛好是羽尖缺口（弦長 = chord − notch），羽軸收在缺口前 0.8 mm
      const x1 = f.x0 - (f.chord - f.notch) + 0.8;
      const yAt = (x) => {
        const v = (f.x0 - x) / f.chord;
        return yWing + f.dy + 0.5 * Math.sin(Math.PI * v) + v * f.chord * Math.tan((f.aoa * Math.PI) / 180) - 1.2 * Math.max(0, (v - 0.6) / 0.4) ** 2 + 0.55;
      };
      const pts = [];
      for (let k = 0; k <= 4; k++) {
        pts.push([lerp(x0, x1, k / 4), yAt(lerp(x0, x1, k / 4)) + 0.7]);
      }
      for (let k = 4; k >= 0; k--) {
        pts.push([lerp(x0, x1, k / 4), yAt(lerp(x0, x1, k / 4)) - 0.4]);
      }
      shafts.push(finPlate(pts, 0, 1.2));
    }
    parts.push({ geometry: mergeGeos(shafts), mat: 'brow2', outline: true, solid: true, name: 'feather-shafts' });
    // 兩支短支柱：翼型斷面的刀形支柱（根部厚 2.6 mm，往翼面收到 70%），根部埋入殼面、頂端埋入下片羽片
    const stays = [];
    for (const sg of [-1, 1]) {
      const zc = sg * 15;
      const yb = kit.surf.topY(-53, zc) - 1.5;
      stays.push(airfoilFin([-45.5, -59, yb], [-51.5, -58.5, yWing + 0.9], 2.6, zc, 0, 12, 4, { taper: [1, 0.7] }));
    }
    parts.push({ geometry: mergeGeos(stays), mat: 'brow2', outline: true, solid: true, name: 'wing-stays' });
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
    wing: '2 片層疊羽片（厚 1.3 mm 翼型片）、羽軸稜（1.2 mm 窄條）、支柱、耳羽、鳥喙視為 ABS 實心件（推估），質量 = 封閉體積 × ABS 1.05 g/cm³；翼頂（約 39.5）低於座艙頂（約 43.5）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
