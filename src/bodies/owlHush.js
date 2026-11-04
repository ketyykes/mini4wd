// 夜梟靜翼策略型（body-owl-hush，第四階段致敬《爆走兄弟》風格新款）：俯視寬 U 形的圓「臉盤」鼻、淚滴形快背全罩車身、
// 大型圓形深煙燻泡泡座艙、座艙後方兩撮短耳羽、車尾低位寬翼（iter-123：3 片後掠層疊羽片＋深色下彎羽尖端板、兩支短支柱、翼頂不高於座艙頂）。
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

/**
 * iter-123（第九階段，評審：「鼻端眼燈拉成往後的細長形」）：眼窩由圓形（半徑 4.4）改成往後外斜拉長的細長膠囊
 * （俯視：前端 (63, |z| 12.2) → 後端 (51.5, |z| 17.6)、半寬 2.3），像瞇起的鷹眼；回傳值 < 0 = 在眼窩內
 * @type {(x: number, y: number, z: number) => number}
 */
const eyeSd = (x, y, z) => {
  const ax = 63;
  const az = 12.2;
  const bx = 51.5;
  const bz = 17.6;
  const px = x - ax;
  const pz = Math.abs(z) - az;
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.min(1, Math.max(0, (px * dx + pz * dz) / (dx * dx + dz * dz)));
  // 前端圓頭 2.5、往後收到 1.5（細長收尖）
  const r = lerp(2.5, 1.5, t);
  return Math.hypot(px - t * dx, pz - t * dz) - r;
};

/** @type {(x: number, y: number, z: number) => number} 眼窩外側（遠離中線、往車尾）半邊：眉骨只做在這半邊（> 0） */
const eyeOuterSide = (x, y, z) => {
  const dx = 51.5 - 63;
  const dz = 17.6 - 12.2;
  // 眼軸的法線（朝外前方）：(dz, -dx) 正規化後取負 → 朝外側
  return -((x - 63) * dz - (Math.abs(z) - 12.2) * dx) / Math.hypot(dx, dz) + 0.6;
};

/** @type {(x: number) => number} 燕麥米（下）／可可棕（上）分色線：臉盤下緣起、往後上掃（V13） */
const splitY = (x) => 17 + 0.075 * (60 - x);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // iter-123（第九階段）：可可棕改成帶金屬珠光的亮面漆（metalness 0.2 → 0.45、亮面清漆），和霧面燕麥米、深棕尾段拉開材質對比
  cocoa: namedMaterial('paint-cocoa-brown', { color: 0x65412a, roughness: 0.2, metalness: 0.45, clearcoat: 1.0, clearcoatRoughness: 0.04 }),
  cocoa2: namedMaterial('paint-cocoa-brown', { color: 0x65412a, roughness: 0.2, metalness: 0.45, clearcoat: 1.0, side: THREE.DoubleSide }),
  oat: namedMaterial('paint-oatmeal', { color: 0xe2d2b0, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
  oat2: namedMaterial('paint-oatmeal', { color: 0xe2d2b0, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
  // iter-123：深色羽尖端板（近黑的深可可，亮面）
  plate2: namedMaterial('paint-espresso-endplate', { color: 0x1c120b, roughness: 0.22, clearcoat: 1.0, side: THREE.DoubleSide }),
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
 * 人字羽紋（iter-62，取代 iter-55 的疊羽紋——評審：Y 形分枝弧像魚鱗 / 樹枝）：概念圖那種粗、尖端朝前的 V 形羽紋，
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
 * 輪拱內襯（iter-55）：輪拱切口內側的半圓環擋板（側視半徑 r0–r1、輪心上方 0°–180°），沿 z 厚 thick，
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
  // 第六階段分組（shared/design/HOMAGE_RESEARCH.md 第 6 節）
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
  // iter-55：眼窩（俯視圓形、深 1.3 mm），槽底放琥珀燈片，上緣加凸出的眉骨
  recesses: [{ id: '眼窩 ×2', view: 'top', shape: 'fn', sd: eyeSd, depth: 1.3 }],
  innerSkipRecess: true,
  sideZMin: 28,
  zones: () => [
    // 燕麥米：下半車身（分色線由臉盤往後上掃）
    { mat: 'oat', keep: (x, y) => splitY(x) - y },
    // 燕麥米：臉盤（鼻端中央 U 形面）
    { mat: 'oat', keep: (x, y, z) => Math.min(x - 56 - 0.012 * z * z, 24 - Math.abs(z)) },
    // iter-123（第九階段塗裝：三色分割）：快背後段＋後輪擋泥板頂的深可可「收攏尾羽」，前緣是尖端朝前的箭形（中線 x −14、|z| 30 退到 x −32），
    // 大面積棕色切成珍珠可可（前）／深可可（後）兩段，配燕麥米下半＝三色
    { mat: 'brow', keep: (x, y, z) => -14 - x - 0.6 * Math.abs(z) },
    { mat: 'cocoa', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'oat2', recess: 'cockpit', recessWall: 'brow2', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    const top = (x) => kit.surf.topY(x, 0);
    // 人字羽紋（iter-62，燕麥米，頂面 |z| 15.5–29.5；座艙底與臉盤除外）——每 11 mm 一道粗 V（尖端寬 4.4 mm），尖端朝前、兩臂往外後掠；
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
    // 一對琥珀色「眼」燈（V14，iter-55 改成凹入的燈；iter-123 拉成往後外斜的細長眼）：眼窩槽底的琥珀燈片＋眼窩外側凸出 0.6 mm 的深棕眉稜
    const lamp = buildRegion(kit.surf, [...kit.holes, (x, y, z) => -eyeSd(x, y, z)], { offset: -1.3 + 0.08 });
    parts.push({ geometry: lamp.geometry, mat: 'eye', name: 'lamp-eyes' });
    // iter-123：眉骨改成沿細長眼窩外側的一道細稜（寬 1.4 mm），跟著眼角往後拉
    const browReg = buildRegion(kit.surf, [...kit.holes, eyeSd, (x, y, z) => 1.4 - eyeSd(x, y, z), eyeOuterSide], { offset: 0.6 });
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
    // 耳羽（iter-55 放大）：座艙後方左右兩撮三角凸起，高出殼面約 5.6 mm、往後掠、往外傾 10°，根部埋入殼面，側視看得到
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
    // 低位寬翼（V6 過彎型＝寬翼、V7 翼頂不高於座艙頂）——iter-123（第九階段，評審：「尾翼羽片排成一列像梳子」）：
    // 原本一片寬翼＋後緣 12 齒梳齒，改成 3 片後掠層疊羽片（像收攏的貓頭鷹初級飛羽）：
    // - 每片都是全展向的後掠箭形翼型片（中線最前、往翼尖後掠收尖），由下到上越來越短、越來越前，像瓦片一樣疊壓（片間無縫，不是分段 flap）；
    // - 下片最長（半展 46.5、後緣外角後掠到 x −67，琥珀）、中片（半展 38.5，燕麥米）、上片最短（半展 30，珍珠可可）；
    // - 最長羽片翼尖接一對深色下彎羽尖端板（往下垂的羽尖形，不是直立方板）。
    // 翼頂約 39.5（仍低於座艙頂 43.5）；分段數降到每片 40 × 6（舊梳齒翼 288 × 14，實體面數大減）
    const yWing = 35.2;
    /**
     * 羽片參數：半展 span、疊高 dy、中線前緣 x0、前緣後掠量 sweep（翼尖處）、後緣額外後掠量 sweepTe、中線弦長 chord
     * @type {{ span: number, dy: number, x0: number, sweep: number, sweepTe: number, chord: number, mat: string, name: string }[]}
     */
    const FEATHERS = [
      { span: 46.5, dy: 0, x0: -48.5, sweep: 11, sweepTe: 6, chord: 13.5, mat: 'amber2', name: 'feather-wing-low' },
      { span: 38.5, dy: 1.05, x0: -47.5, sweep: 9, sweepTe: 5, chord: 12, mat: 'oat2', name: 'feather-wing-mid' },
      { span: 30, dy: 2.1, x0: -46.5, sweep: 7, sweepTe: 3, chord: 9.5, mat: 'cocoa2', name: 'feather-wing-top' },
    ];
    /** @type {(f: { sweep: number, x0: number }, u: number) => number} 羽片前緣 x：中線最前、往翼尖以 |u|^1.6 後掠 */
    const featherLe = (f, u) => f.x0 - f.sweep * Math.abs(u) ** 1.6;
    for (const f of FEATHERS) {
      parts.push({
        geometry: liftSurface({
          v0: 0,
          v1: 1,
          nU: 40,
          nV: 6,
          span: f.span,
          le: (u) => featherLe(f, u),
          // 後緣：弦長保持到外側 80% 才收到翼尖 1 mm，後緣再額外往後掠 → 每片都是往後外伸的寬羽、羽尖圓收
          te: (u) => featherLe(f, u) - (1 + (f.chord - 1) * (1 - Math.abs(u) ** 6)) - f.sweepTe * u * u,
          y: (u, v) => yWing + f.dy + 0.9 * u * u + 0.5 * Math.sin(Math.PI * v) + v * f.chord * Math.tan((4 * Math.PI) / 180),
          thick: (u) => 1.3 * (1 - u ** 8),
        }),
        mat: f.mat,
        outline: true,
        solid: true,
        name: f.name,
      });
    }
    // 深色下彎羽尖端板：最長羽片翼尖內側 |z| 43.5，羽尖形（前緣圓、後下方收尖），上緣埋進羽片、往下垂 5.5 mm、往外傾 6°
    const plates = [];
    for (const sg of [-1, 1]) {
      const zc = sg * 43.5;
      const u = 43.5 / 46.5;
      const xLe = featherLe(FEATHERS[0], u);
      const yT = yWing + 0.9 * u * u + 0.7;
      plates.push(
        finPlate(
          [
            [xLe + 1.2, yT],
            [xLe - 2.6, yT + 0.6],
            [xLe - 4.4, yT - 2.2],
            [xLe - 5.8, yT - 6.2],
            [xLe - 2.2, yT - 4.2],
            [xLe + 0.6, yT - 2.4],
          ],
          zc,
          1.3,
          sg * 6,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(plates), mat: 'plate2', outline: true, solid: true, name: 'feather-endplates' });
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
    wing: '3 片層疊羽片（厚 1.3 mm 翼型片）、羽尖端板（1.3 mm 板）、支柱、耳羽、鳥喙視為 ABS 實心件（推估），質量 = 封閉體積 × ABS 1.05 g/cm³；翼頂（約 39.5）低於座艙頂（約 43.5）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
