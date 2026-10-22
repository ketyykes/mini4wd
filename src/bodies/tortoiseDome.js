// 陸龜圓頂重甲型（body-tortoise-dome，第四階段致敬《爆走兄弟》風格新款）：高聳的龜甲圓頂、四個獨立鼓出的大輪拱擋泥板、
// 圓頂前緣一道裝甲觀察縫（無座艙泡）、車尾一體成形的上翹鴨尾唇（無獨立尾翼）。
// 設計：shared/design/body-tortoise-dome/DESIGN.md（角色、致敬語彙、和劇中車 / 市售車殼的差異）。
// 剖面由本檔的站位函式產生（推估，依 HOMAGE_RESEARCH 第 4 節與外框 / 輪胎間隙掃描）。
// 塗裝全為自創：翡翠綠＋象牙白＋古銅、六角甲片分格線、號碼「61」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdConvexPolygon, sideDecal, topDecal, mergeGeos, lerp, smoothstep, buildRegion, featureSd, buildCap } from './loft.js';

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
const X_TAIL = -66;
/** @type {number} 鼻尖 x */
const X_NOSE = 68;

/**
 * 縱向控制表（推估）：
 * - yTop：圓頂中線高度，頂點 52 在 x ≈ −10，前後圓滑下降；車尾 −57 處最低、再往後翹起成鴨尾唇（iter-55：尾端延長到 x −66，
 *   唇緣中央 40.4、兩角 42.2（U 形上翹），唇下緣抬到 37.4 → 車尾是一道往上翹的薄唇，不再是平切立面）
 * - dw：龜甲圓頂的半寬（甲緣位置）；yRim：甲緣高度（圓頂底）
 * - hw：最寬處半寬。iter-55：四個輪拱做成往外鼓的「四肢」——輪心上方 46.5、兩輪之間與輪拱前後收到 40–42，
 *   俯視看得到四個凸包；鼻尖收到 8（龜頭）
 * - ySh：擋泥板肩高，輪心上方 35.6（31 mm 輪的拱頂 30.6 之上還有 5 mm 擋泥板帶），兩輪之間降到 22.5 → 四肢明顯高出腰線
 * - yLow：側壁下緣
 */
const T = monoTable([-66, -62, -57, -52, -44, -40, -34, -22, -10, 0, 10, 22, 34, 40, 46, 52, 58, 64, 68], {
  yTop: [40.4, 37.6, 34.8, 36.6, 43, 45.4, 48.2, 51.2, 52, 51.6, 50.2, 46.4, 39.4, 36, 32.4, 28.6, 24.6, 20, 18.2],
  dw: [12, 15.5, 19, 22, 26.5, 27.5, 29, 30.5, 31, 31, 31, 30.5, 28.5, 26.5, 22.5, 18, 12.5, 7.5, 5.5],
  yRim: [41.6, 38.4, 34.6, 33.2, 33.2, 33.2, 32.8, 31.6, 31, 30.8, 31, 31.6, 32.4, 31.6, 30, 27.4, 24, 20.5, 18.2],
  hw: [16, 21, 28, 35, 44.5, 46.5, 43.5, 37, 38.5, 39, 38.5, 37, 43.5, 46.5, 44.5, 37, 24, 12.5, 8],
  ySh: [42.2, 38.6, 33.5, 33.5, 35.2, 35.6, 33.5, 25.5, 23, 22.5, 23, 25.5, 33.5, 35.6, 35, 32, 25, 19.5, 17],
  yLow: [37.4, 30.5, 22, 15.5, 12, 11, 10.5, 9.5, 9.5, 9.5, 9.5, 9.5, 10.5, 11, 12, 13, 14.5, 15, 15],
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
    // iter-62：甲緣台階在鴨尾唇段（x −56 → −66）漸漸收平——唇緣處甲緣 41.6、肩 42.2，中間 1.2 mm 的台階在唇端面兩端
    // 形成 V 形小缺角（評審：尾唇兩端小缺角）；收平後台階點落在甲緣與肩的連線上
    const stepFlat = yRim + ((ySh - yRim) * 1.2) / Math.max(1.2, hw - dw);
    const stepY = lerp(stepFlat, yRim - 1.2, smoothstep(X_TAIL, -56, x));
    pts.push([dw, yRim], [dw + 1.2, stepY], [hw, ySh], [hw, yLow]);
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

/** 六角甲片格線距離函式（對邊 16 mm） */
const HEX = hexLines(16);

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
  jade2: namedMaterial('paint-jade-green', { color: 0x14684a, roughness: 0.2, metalness: 0.25, clearcoat: 1.0, side: THREE.DoubleSide }),
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
  bronzeGroove: namedMaterial('brass-groove-bronze', { color: 0xa87a3e, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide }),
  visorBlack: namedMaterial('plastic-visor-black', { color: 0x060707, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('plastic-liner-matte', { color: 0x161a17, roughness: 0.85, side: THREE.DoubleSide }),
  ivoryDecal: decalMaterial('decal-ivory', { color: 0xefe6cc, roughness: 0.35 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {(x: number) => number} 圓頂中線象牙白背脊紋的半寬（越往後越窄） */
const spineHalfW = (x) => lerp(1.1, 2.6, smoothstep(-56, 30, x));

/** @type {any} 後輪前方的橫向進氣口（側視往後收窄的楔形） */
const INTAKE = { view: 'side', shape: 'poly', pts: [[-6, 12.2], [-21.5, 12.2], [-21.5, 14.6], [-6, 15.6]], depth: 1.6 };

/** @type {any} 觀察縫（俯視：圓頂前斜面上一道兩端往後掠的細縫） */
const VISOR = { view: 'top', shape: 'poly', pts: [[39.2, 0], [37.8, 13.5], [35.2, 17.8], [36.3, 0]], depth: 1.4 };

/**
 * 輪拱內襯（iter-55）：輪拱切口內側的半圓環擋板（側視半徑 r0–r1、輪心上方 0°–180°），沿 z 厚 thick
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

/**
 * 俯視彎曲的直立面板（封閉實心件）：z ∈ [−W, W]、y ∈ [yB, yT]，前表面 x = xc(z)、往前厚 t
 * @type {(W: number, yB: number, yT: number, xc: (z: number) => number, t: number) => THREE.BufferGeometry}
 */
const curvedPanel = (W, yB, yT, xc, t) => {
  const n = 24;
  /** @type {number[]} */
  const pos = [];
  /** @type {(i: number, k: number, back: number) => number[]} */
  const P = (i, k, back) => {
    const z = lerp(-W, W, i / n);
    return [xc(z) + back * t, k === 0 ? yB : yT, z];
  };
  for (let i = 0; i < n; i++) {
    // 後表面（朝 −x）、前表面（朝 +x）
    pos.push(...P(i, 0, 0), ...P(i, 1, 0), ...P(i + 1, 1, 0), ...P(i, 0, 0), ...P(i + 1, 1, 0), ...P(i + 1, 0, 0));
    pos.push(...P(i, 0, 1), ...P(i + 1, 1, 1), ...P(i, 1, 1), ...P(i, 0, 1), ...P(i + 1, 0, 1), ...P(i + 1, 1, 1));
    // 上下緣
    pos.push(...P(i, 1, 0), ...P(i, 1, 1), ...P(i + 1, 1, 1), ...P(i, 1, 0), ...P(i + 1, 1, 1), ...P(i + 1, 1, 0));
    pos.push(...P(i, 0, 0), ...P(i + 1, 0, 1), ...P(i, 0, 1), ...P(i, 0, 0), ...P(i + 1, 0, 0), ...P(i + 1, 0, 1));
  }
  for (const [i, sg] of [
    [0, 1],
    [n, -1],
  ]) {
    const a = P(i, 0, 0);
    const b = P(i, 1, 0);
    const c = P(i, 1, 1);
    const d = P(i, 0, 1);
    if (sg > 0) {
      pos.push(...a, ...d, ...c, ...a, ...c, ...b);
    } else {
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

export const tortoiseDomeBody = makePolyBody({
  id: 'body-tortoise-dome',
  name: '陸龜圓頂重甲型',
  style: 'homage',
  phase: 4,
  // 第六階段分組（shared/design/HOMAGE_RESEARCH.md 第 6 節）
  homageSeries: 'lg1',
  form: 'dome',
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
    // iter-55：六角甲片分格改成真的凹槽（寬 0.9、深 0.45 mm，槽底古銅），不只是貼線；中線背脊紋兩側不刻
    {
      id: '六角甲片分格槽',
      view: 'top',
      shape: 'fn',
      sd: (x, y, z) => {
        const az = Math.abs(z);
        if (x > 34 || x < -60 || az > domeHalfW(x) - 0.9 || az < spineHalfW(x) + 0.5) {
          return 10;
        }
        return Math.abs(HEX(x, y, az)) - 0.45;
      },
      depth: 0.45,
    },
    // 後輪前方的橫向進氣口（側視往後收窄的楔形，象牙白底上的黑槽）
    { id: '側進氣口', ...INTAKE },
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
  mats: { inner: 'inner', edge: 'edge', cap: 'ivory2', recess: 'bronzeGroove', recessWall: 'recessWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    // 觀察縫、側進氣口的槽底塗黑（凹槽共用古銅槽底材質，這兩處另外鋪一層黑色）
    const visorSd = featureSd(VISOR, 30);
    const intakeSd = featureSd(INTAKE, 30);
    parts.push({
      geometry: mergeGeos([
        buildRegion(kit.surf, [...kit.holes, (x, y, z) => -visorSd(x, y, z)], { offset: -VISOR.depth + 0.05 }).geometry,
        buildRegion(kit.surf, [...kit.holes, (x, y, z) => -intakeSd(x, y, z)], { offset: -INTAKE.depth + 0.05 }).geometry,
      ]),
      mat: 'visorBlack',
      name: 'visor-black',
    });
    // 甲緣古銅飾線（圓頂邊緣一圈）＋輪拱古銅甲緣環（拱緣外 0.6–2.0 mm）
    const archTrim = (x, y, z) => {
      const d = Math.min(Math.hypot(x - 40, y - 13), Math.hypot(x + 40, y - 13)) - 17.6;
      return Math.abs(z) < 32 ? -1 : Math.min(d - 0.6, 2.0 - d);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal((x, y, z) => (x > 60 || x < -64 ? -1 : 0.7 - Math.abs(Math.abs(z) - domeHalfW(x) - 0.4))),
        kit.decal(archTrim),
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
      geometry: kit.decal((x, y, z) => (x > 33 || x < -62 ? -1 : spineHalfW(x) - Math.abs(z))),
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
    // 前輪拱內襯（iter-55）：拱緣內側的半圓環擋板（z 22.5–23.1，距 31 mm 輪胎內側面 1.65 mm），擋住從側面看進殼內的空腔
    parts.push({
      geometry: mergeGeos([archRing(40, 12.5, 18, 22.5, 0.6), archRing(40, 12.5, 18, -23.1, 0.6)]),
      mat: 'liner',
      solid: true,
      name: 'arch-liners',
    });
    // 鴨尾唇下方往內縮的車尾面板（iter-55）：中央在 x −60.5、兩側往前彎（俯視弧形），深翡翠綠＋一對琥珀尾燈，
    // 讓鴨尾唇下面是有設計的凹入尾面，不是平切立面
    parts.push({ geometry: curvedPanel(22, 17.6, 31.5, (z) => -60.5 + 3.2 * (z / 22) ** 2, 0.6), mat: 'recessWall', solid: true, outline: true, name: 'tail-panel' });
    // 鴨尾唇端面（iter-59）：後封口是象牙白（與鼻端共用封口材質），而且內殼在 x −66 被壓扁成貼著封口的面 → 唇頂一條鋸齒白邊。
    // 在封口後方 0.15 mm 疊一片同輪廓、外擴約 0.35 mm 的翡翠綠端面，唇緣看起來是車身同色的厚邊，蓋掉白邊與鋸齒
    const tailFace = buildCap(kit.surf, kit.surf.xMin, -1);
    tailFace.computeBoundingBox();
    const fb = /** @type {THREE.Box3} */ (tailFace.boundingBox);
    const fyc = (fb.min.y + fb.max.y) / 2;
    const fhy = (fb.max.y - fb.min.y) / 2;
    const fhz = fb.max.z;
    tailFace.translate(0, -fyc, 0);
    tailFace.scale(1, (fhy + 0.35) / fhy, (fhz + 0.35) / fhz);
    tailFace.translate(-0.15, fyc, 0);
    parts.push({ geometry: tailFace, mat: 'jade2', name: 'tail-lip-face' });
    const tailLamps = [];
    for (const sg of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.8, 2.0, 7.5);
      g.translate(-60.5 + 3.2 * (13.5 / 22) ** 2 - 0.3, 26.2, sg * 13.5);
      tailLamps.push(g);
    }
    parts.push({ geometry: mergeGeos(tailLamps), mat: 'lamp', solid: true, name: 'tail-lamps' });
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
    tips: '古銅喙刃視為 ABS 電鍍件、車尾面板與輪拱內襯為 ABS 實心件（推估），質量 = 封閉體積 × ABS 1.05 g/cm³',
  },
});
