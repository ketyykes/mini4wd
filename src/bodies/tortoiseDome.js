// 陸龜圓頂重甲型（body-tortoise-dome，第四階段致敬《爆走兄弟》風格新款）：高聳的龜甲圓頂、四個獨立鼓出的大輪拱擋泥板、
// 圓頂前緣一道裝甲觀察縫（無座艙泡）、車尾一體成形的上翹鴨尾唇（無獨立尾翼）。
// 設計：shared/design/body-tortoise-dome/DESIGN.md（角色、致敬語彙、和劇中車 / 市售車殼的差異）。
// 剖面由本檔的站位函式產生（推估，依 HOMAGE_RESEARCH 第 4 節與外框 / 輪胎間隙掃描）。
// 塗裝全為自創：翡翠綠＋象牙白＋古銅、六角甲片分格線、號碼「61」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdConvexPolygon, sideDecal, topDecal, mergeGeos, lerp, smoothstep } from './loft.js';

/** @typedef {import('./loft.js').KeepFn} KeepFn */

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

/** @type {number} 車尾（鴨尾唇後緣）x */
const X_TAIL = -61;
/** @type {number} 鼻尖 x */
const X_NOSE = 68;

/**
 * 縱向控制表（推估）：
 * - yTop：圓頂中線高度，頂點 52 在 x ≈ 0（軸距中點），前後圓滑下降；車尾 −56 處最低、再往後翹起成鴨尾唇
 * - dw：龜甲圓頂的半寬（甲緣位置）；yRim：甲緣高度（圓頂底）
 * - hw：最寬處半寬（輪拱擋泥板外側），前後輪上方 42.5、兩輪之間收到 29.5、鼻尖收到 10（俯視像龜甲伸出四肢與頭）
 * - ySh：擋泥板肩高，輪心上方 35（31 mm 輪的拱頂 30.6 之上還有 4 mm 擋泥板帶）
 * - yLow：側壁下緣
 */
const T = monoTable([-61, -57, -52, -44, -40, -30, -20, -10, 0, 10, 20, 30, 40, 48, 54, 60, 64, 68], {
  yTop: [37.2, 34.8, 36.6, 43, 45.4, 49.6, 51.6, 52, 51.6, 50, 47, 42.4, 36, 30.5, 26, 22.2, 20, 18.2],
  dw: [17, 19, 22, 26.5, 27.5, 31, 32.5, 33, 33, 33, 32.5, 31, 26.5, 20, 15, 10, 7.5, 5.5],
  yRim: [39.5, 34.6, 33.2, 33.2, 33.2, 32.5, 31.5, 31, 30.8, 31, 31.5, 32.5, 31.6, 29, 26, 22.5, 20.5, 18.2],
  hw: [20, 24, 30, 35.5, 37, 42, 46, 47, 47, 47, 46, 42, 37.5, 35.5, 29, 19, 12.5, 8],
  ySh: [39.2, 33.5, 33, 34.8, 35, 30, 24.5, 22.5, 22, 22.5, 24.5, 30, 35, 33.8, 29.5, 23, 19.5, 17],
  yLow: [24, 19, 15.5, 12, 11, 10, 9.5, 9.5, 9.5, 9.5, 9.5, 10, 11, 12, 13.5, 14.5, 15, 15],
});

/** @type {(x: number) => number} 圓頂半寬（塗裝分區、六角紋用） */
const domeHalfW = (x) => T('dw', x);

/**
 * 半剖面站位（每 2 mm 一站，8 點）：中線頂 → 圓頂 3 點 → 甲緣 → 甲緣外 1.2 mm 的落差台階 → 擋泥板肩 → 側壁下緣
 * 圓頂剖面 y = yRim + (yTop − yRim)·√(1 − f²)（橢圓弧），甲緣、台階、肩為銳利稜線（hard 4、5、6）
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
    const dw = T('dw', x);
    const yRim = T('yRim', x);
    const hw = Math.max(T('hw', x), dw + 2.2);
    const ySh = T('ySh', x);
    const yLow = Math.min(T('yLow', x), ySh - 1.5);
    const rise = Math.max(0.4, yTop - yRim);
    const pts = [0, 0.38, 0.68, 0.88].map((f) => [f * dw, yRim + rise * Math.sqrt(1 - f * f * 0.97)]);
    pts.push([dw, yRim], [dw + 1.2, yRim - 1.2], [hw, ySh], [hw, yLow]);
    return { x, pts };
  });
})();

/**
 * 六角甲片格線的距離函式：把殼面以 x 軸為中心攤平（u = x、v = 繞 y = 6 軸的弧長），
 * 六角格對邊寬 S，回傳到最近格線的距離（mm，近似）
 * @type {(S: number) => (x: number, y: number, z: number) => number}
 */
const hexLines = (S) => {
  const r3 = Math.sqrt(3);
  // 格子基底：a1 = (S, 0)、a2 = (S/2, S·√3/2)；格心對齊中線（v = 0）、x = −4
  const normals = [
    [1, 0],
    [0.5, r3 / 2],
    [-0.5, r3 / 2],
  ];
  return (x, y, z) => {
    const u = x + 4;
    const v = Math.atan2(z, y - 6) * 34;
    // 斜座標
    const b = v / ((S * r3) / 2);
    const a = (u - b * (S / 2)) / S;
    const a0 = Math.floor(a);
    const b0 = Math.floor(b);
    let best = Infinity;
    for (let i = 0; i <= 1; i++) {
      for (let j = 0; j <= 1; j++) {
        const cu = (a0 + i) * S + (b0 + j) * (S / 2);
        const cv = (b0 + j) * ((S * r3) / 2);
        const qu = u - cu;
        const qv = v - cv;
        const d = Math.max(...normals.map(([nu, nv]) => Math.abs(qu * nu + qv * nv)));
        best = Math.min(best, d);
      }
    }
    return S / 2 - best;
  };
};

/** @type {(x: number) => number} 象牙白下半車身的分色線：鼻尖低、往後斜升（V13 由鼻尖往後上掃） */
const sweepBase = (x) => 18.5 - 0.075 * x;

/** @type {(x: number) => number} 分色線加上往後倒的鋸齒（龜甲緣甲片的意象；齒距 9 mm、齒高 3.2 mm，齒尖朝後上方） */
const sweepLine = (x) => {
  const ph = (((x + 200) % 9) + 9) % 9;
  return sweepBase(x) + 3.2 * (ph / 9);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  jade: namedMaterial('paint-jade-green', { color: 0x14684a, roughness: 0.2, metalness: 0.25, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  ivory: namedMaterial('paint-ivory', { color: 0xe9dfc4, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
  ivory2: namedMaterial('paint-ivory', { color: 0xe9dfc4, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
  // 金屬古銅（名稱含 brass → Blender 匯出分類為 metal）
  bronze: namedMaterial('brass-shell-bronze', { color: 0xa87a3e, roughness: 0.3, metalness: 0.85, clearcoat: 0.3 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c211e, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-ivory', { color: 0xcfc4a6, roughness: 0.5, side: THREE.DoubleSide }),
  recess: namedMaterial('plastic-visor-black', { color: 0x060707, roughness: 0.5, side: THREE.DoubleSide }),
  recessWall: namedMaterial('paint-jade-green', { color: 0x0f4f38, roughness: 0.3, side: THREE.DoubleSide }),
  lamp: namedMaterial('lamp-amber', { color: 0xffc040, emissive: 0xff9a10, emissiveIntensity: 0.8, roughness: 0.1, clearcoat: 1.0 }),
  bronzeDecal: decalMaterial('decal-bronze', { color: 0xb88a48, roughness: 0.35, metalness: 0.6 }),
  dark: decalMaterial('decal-black', { color: 0x10120f, roughness: 0.5 }),
  ivoryDecal: decalMaterial('decal-ivory', { color: 0xefe6cc, roughness: 0.35 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {any} 觀察縫（俯視：圓頂前斜面上一道兩端往後掠的細縫） */
const VISOR = { view: 'top', shape: 'poly', pts: [[39.2, 0], [37.8, 13.5], [35.2, 17.8], [36.3, 0]], depth: 1.4 };

export const tortoiseDomeBody = makePolyBody({
  id: 'body-tortoise-dome',
  name: '陸龜圓頂重甲型',
  style: 'homage',
  phase: 4,
  roof: 'closed',
  wing: 'duck-tail',
  theme: '高聳龜甲圓頂＋四個獨立大輪拱、圓頂前緣裝甲觀察縫、無尾翼的一體鴨尾唇；慢熱但打不倒的守門員',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.2,
  hard: [4, 5, 6],
  // 四輪 R17.6：31 mm 大徑輪（半徑 15.5）＋2.1 mm（殼內面沿法線內縮 0.8 mm 後仍 ≥ 1 mm）；cutZFrom 23.3 < 31 mm 輪胎內側面 24.75
  wheelArches: [
    { x: 40, y: 13, radius: 17.6, cutZFrom: 23.3 },
    { x: -40, y: 13, radius: 17.6, cutZFrom: 23.3 },
  ],
  recesses: [
    { id: '觀察縫', ...VISOR },
    // 後輪前方的橫向進氣口（側視往後收窄的楔形，象牙白底上的黑槽）
    { id: '側進氣口', view: 'side', shape: 'poly', pts: [[-6, 12.2], [-21.5, 12.2], [-21.5, 14.6], [-6, 15.6]], depth: 1.6 },
  ],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [
    // 象牙白：下半車身（分色線由鼻尖往後斜升）
    { mat: 'ivory', keep: (x, y) => sweepLine(x) - y },
    // 象牙白：鼻部「龜頭」面罩（圓頂前端、觀察縫之前）
    { mat: 'ivory', keep: (x, y, z) => Math.min(x - 41.5 - 0.06 * Math.abs(z) ** 1.5 / 4, domeHalfW(x) + 1.4 - Math.abs(z)) },
    // 象牙白：前擋泥板鼻端（和鼻部面罩之間留一道翡翠綠的甲緣溝）
    { mat: 'ivory', keep: (x, y, z) => Math.min(x - 50 + 0.08 * (Math.abs(z) - 20), Math.abs(z) - domeHalfW(x) - 4) },
    // 其餘（龜甲圓頂、甲緣外翻的裙邊、四個擋泥板）：翡翠綠
    { mat: 'jade', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'ivory2', recess: 'recess', recessWall: 'recessWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    const hex = hexLines(16);
    // 六角甲片分格線（古銅）：只在圓頂上（甲緣內 1 mm、觀察縫之後）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (x > 34 || az > domeHalfW(x) - 0.9 || (x > -57 && az < lerp(1.1, 2.6, smoothstep(-56, 30, x)) + 0.4)) {
          return -1;
        }
        return 0.55 - Math.abs(hex(x, y, az));
      }),
      mat: 'bronzeDecal',
      name: 'decal-hex-plates',
    });
    // 甲緣古銅飾線（圓頂邊緣一圈）＋輪拱古銅甲緣環（拱緣外 0.6–2.0 mm）
    const archRing = (x, y, z) => {
      const d = Math.min(Math.hypot(x - 40, y - 13), Math.hypot(x + 40, y - 13)) - 17.6;
      return Math.abs(z) < 30 ? -1 : Math.min(d - 0.6, 2.0 - d);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal((x, y, z) => (x > 60 || x < -59 ? -1 : 0.7 - Math.abs(Math.abs(z) - domeHalfW(x) - 0.4))),
        kit.decal(archRing),
        // 分色線上方的古銅細線（側面，從鼻尖往後上掃）
        kit.decal((x, y, z) => (Math.abs(z) < 28 ? -1 : Math.min(y - sweepLine(x) - 0.3, sweepLine(x) + 1.1 - y))),
      ]),
      mat: 'bronzeDecal',
      name: 'decal-bronze-trim',
    });
    // 鼻部頭燈（V14）：鼻側一對往後掠的細三角燈
    const lampSd = sdConvexPolygon([[65, 3.2], [60.5, 12.5], [56.6, 14.4], [59.4, 5.4]]);
    parts.push({
      geometry: kit.decal((x, y, z) => -lampSd(x, Math.abs(z)), { offset: 0.1 }),
      mat: 'lamp',
      name: 'lamp-head',
    });
    // 鼻前自創六角符號（V15 位置）：鼻頭中央的古銅小六角
    const r3 = Math.sqrt(3);
    const hexBadge = (u, v) => Math.max(Math.abs(v), Math.abs(v) * 0.5 + Math.abs(u) * (r3 / 2)) - 3.0;
    parts.push({
      geometry: kit.decal(topDecal((u, v) => Math.max(hexBadge(u, v), -(hexBadge(u, v) + 1.0)), { x0: 52, yMin: 20 })),
      mat: 'bronzeDecal',
      name: 'decal-badge',
    });
    // 圓頂中線的象牙白甲背脊紋（從觀察縫後一路到鴨尾唇，越往後越窄）
    parts.push({
      geometry: kit.decal((x, y, z) => (x > 33 || x < -56 ? -1 : lerp(1.1, 2.6, smoothstep(-56, 30, x)) - Math.abs(z))),
      mat: 'ivoryDecal',
      name: 'decal-spine',
    });
    // 號碼 61：側面兩輪之間（象牙白底上的黑字）、圓頂後段
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('61', { h: 6.4, w: 3.6, gap: 1.0 }), { x0: 4, y0: 14.6, zMin: 30 })),
      ]),
      mat: 'dark',
      name: 'decal-number',
    });
    // 鴨尾唇兩角的古銅翹尖（一體成形的唇角，不是獨立尾翼）
    const tips = [];
    for (const sg of [-1, 1]) {
      tips.push(
        finPlate(
          [
            [-53, 36.2],
            [-61.6, 38.6],
            [-63.2, 42.6],
            [-58, 39.6],
          ],
          sg * 19.5,
          1.4,
          sg * 18,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(tips), mat: 'bronze', outline: true, solid: true, name: 'duck-tail-tips' });
    // 側裙下緣的短棘列（前後輪之間，往下的三角齒，像龜甲緣的鋸齒）
    const spikes = [];
    for (const sg of [-1, 1]) {
      for (const x0 of [12, 4, -4]) {
        spikes.push(
          finPlate(
            [
              [x0 + 3, 10.2],
              [x0 - 3, 10.2],
              [x0 - 2.2, 7.6],
            ],
            sg * (T('hw', x0) - 0.9),
            1.0,
          ),
        );
      }
    }
    parts.push({ geometry: mergeGeos(spikes), mat: 'bronze', outline: true, solid: true, name: 'skirt-teeth' });
    // 鼻下古銅喙刃（V3 尖鼻的變形）：往前尖出的薄板，埋入鼻端下緣
    parts.push({
      geometry: flatPlate(
        [
          [58, -11],
          [66, -8.5],
          [73, -1.2],
          [73, 1.2],
          [66, 8.5],
          [58, 11],
        ],
        14.4,
        1.0,
      ),
      mat: 'bronze',
      outline: true,
      solid: true,
      name: 'beak-blade',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同第三階段各款）',
    geometry: '本檔 T 表與 STATIONS（推估，依 HOMAGE_RESEARCH 4-1：長約 128、最高點約 52，外框與輪胎間隙用 body-check 掃描）',
    wheelArches: '四輪 R17.6：31 mm 大徑輪半徑 15.5＋2.1 mm 間隙（殼內面內縮後仍 ≥ 1 mm）（GOAL：至少 2 款新致敬款可裝 31 mm）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
    tips: '古銅唇角、側裙短棘視為 ABS 電鍍件（推估），質量 = 封閉體積 × ABS 1.05 g/cm³',
  },
});
