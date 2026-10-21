// 旗魚背帆衝刺型（body-marlin-sail，第四階段致敬《爆走兄弟》風格新款）：長而低的箭形車身、針尖鼻、前輪外露、後輪被裙板罩住，
// 細長的有色窄座艙往後直接長出低長的弧形背帆，車尾是兩尖端後掠的新月形一體平尾（無支柱）。
// 設計：shared/design/body-marlin-sail/DESIGN.md（角色、致敬語彙、和劇中車 / 市售車殼的差異）。
// 剖面由本檔的站位函式產生（推估，依 HOMAGE_RESEARCH 第 4 節與外框 / 輪胎間隙掃描）。
// 塗裝全為自創：石油藍綠＋銀白＋珊瑚橘、側面由密到疏的縱向細斑條、號碼「7」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sdConvexPolygon, sideDecal, topDecal, mergeGeos, lerp } from './loft.js';

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
const X_TAIL = -72;
/** @type {number} 針尖鼻 x */
const X_NOSE = 80;

/**
 * 縱向控制表（推估）：
 * - hw：半寬。前輪範圍（x 24–56）收在 22.5（26 mm 輪胎內側面 25.25，留 ≥ 2 mm → 前輪外露）；
 *   後段鼓成 38 的後輪裙板（輪胎外側面 34.25，裙板內面仍有 ≥ 2.9 mm），把後輪側面整個罩住
 * - yTop：中線高度，鼻尖 15 → 座艙段 25–28 → 後輪上方 31（26 mm 輪胎頂 26，殼內面仍留 ≥ 1 mm）
 * - drop：頂面到肩稜的落差；yLow：側壁下緣
 */
const T = monoTable([-72, -66, -60, -53, -40, -27, -20, -10, 0, 10, 16, 24, 30, 40, 50, 56, 62, 68, 74, 80], {
  hw: [24, 29, 34, 37.5, 38, 37.5, 36.5, 34.5, 32, 29, 26, 22.5, 22.5, 22.5, 22.5, 20, 16, 12, 8, 4],
  yTop: [29.4, 30, 30.6, 31, 31.2, 31, 30.2, 29, 28, 27.4, 27, 26, 25, 23.4, 21.6, 20.4, 19, 17.6, 16.3, 15],
  drop: [2.2, 2.4, 2.6, 2.6, 2.6, 2.6, 3, 3.4, 3.6, 3.6, 3.6, 3.4, 3.2, 3, 2.8, 2.6, 2.2, 1.6, 1, 0.6],
  yLow: [21, 17, 13, 11, 10.5, 10.5, 10, 9.5, 9.5, 9.5, 9.5, 10, 11, 12, 12.5, 13.5, 13.5, 13.5, 13.5, 13.5],
});

/**
 * 半剖面站位（每 2 mm 一站，8 點）：頂面 6 點（半寬的 0 / 0.2 / 0.4 / 0.6 / 0.78 / 0.92，高度依 (z / 半寬)² 下降）、肩稜、側壁下緣
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = (() => {
  const xs = [];
  for (let x = X_TAIL; x < X_NOSE; x += 2) {
    xs.push(x);
  }
  xs.push(X_NOSE);
  const fr = [0, 0.2, 0.4, 0.6, 0.78, 0.92];
  return xs.map((x) => {
    const hw = T('hw', x);
    const yTop = T('yTop', x);
    const drop = T('drop', x);
    const yLow = Math.min(T('yLow', x), yTop - drop - 0.6);
    const pts = fr.map((q) => [q * hw, yTop - drop * 0.85 * q * q]);
    pts.push([hw, yTop - drop], [hw, yLow]);
    return { x, pts };
  });
})();

/** @type {(x: number) => number} 石油藍綠（上）／銀白（下）分色線：鼻尖低、往後斜升（V13），後輪上方之後整段銀白 */
const splitY = (x) => 15.5 + 0.17 * (62 - x);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  teal: namedMaterial('paint-petrol-teal', { color: 0x0f7480, roughness: 0.18, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  teal2: namedMaterial('paint-petrol-teal', { color: 0x0f7480, roughness: 0.18, metalness: 0.35, clearcoat: 1.0, side: THREE.DoubleSide }),
  silver: namedMaterial('paint-pearl-silver', { color: 0xdfe3e6, roughness: 0.22, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  silver2: namedMaterial('paint-pearl-silver', { color: 0xdfe3e6, roughness: 0.22, metalness: 0.35, clearcoat: 1.0, side: THREE.DoubleSide }),
  coral2: namedMaterial('paint-coral-orange', { color: 0xff6a3d, roughness: 0.25, clearcoat: 0.8, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1f22, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-silver', { color: 0xaab0b6, roughness: 0.45, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x14181b, roughness: 0.6 }),
  // 深煙燻窄座艙（V5：小而有色）
  glass: namedMaterial('pc-smoke-tint', { color: 0x0b2630, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.82, envMapIntensity: 0.5, depthWrite: false }),
  coral: decalMaterial('decal-coral-orange', { color: 0xff6a3d, roughness: 0.3, clearcoat: 0.6 }),
  tealDecal: decalMaterial('decal-petrol-teal', { color: 0x0b5f69, roughness: 0.3, clearcoat: 0.6 }),
  dark: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  lamp: namedMaterial('lamp-amber', { color: 0xffb347, emissive: 0xff7a1a, emissiveIntensity: 0.8, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 背帆側視輪廓（x, y）：從座艙後緣（x −2）貼著背脊往後，弧形上緣在 x ≈ −50 到最高 37.5，後端掠到新月平尾中央
 * 帆根 y 取殼面高度往下 1.2 mm（埋入殼面與背脊整流條）
 * @type {(top: (x: number) => number) => number[][]}
 */
const sailOutline = (top) => {
  /** @type {number[][]} */
  const upper = [];
  for (let i = 0; i <= 14; i++) {
    const x = lerp(-2, -64, i / 14);
    const u = i / 14;
    // 上緣：前段貼近座艙後緣、往後平緩拱起，最高點在 u ≈ 0.78
    const y = top(x) + 0.6 + 8.0 * Math.sin((Math.PI / 2) * Math.min(1, u / 0.78)) ** 1.6;
    upper.push([x, y]);
  }
  // 後端：上緣往後尖出到 x −70，再沿新月尾面回到帆根
  upper.push([-71, top(-64) + 8.5], [-68, top(-68) + 1.4]);
  /** @type {number[][]} */
  const lower = [];
  for (let i = 12; i >= 0; i--) {
    const x = lerp(-2, -68, i / 12);
    lower.push([x, top(x) - 1.2]);
  }
  return [...upper, ...lower];
};

export const marlinSailBody = makePolyBody({
  id: 'body-marlin-sail',
  name: '旗魚背帆衝刺型',
  style: 'homage',
  phase: 4,
  roof: 'canopy',
  wing: 'dorsal-sail',
  theme: '長低箭形車身＋針尖鼻、前輪外露、窄座艙接低長背帆與新月平尾；只為直線而生的驕傲衝刺手',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.2,
  // 平滑剖面，只保留肩稜（第 6 點）為銳利稜線
  hard: [6],
  // 前輪外露（車身避開輪胎）、後輪由裙板罩住（裙板在輪胎外側），都不需要輪拱
  wheelArches: [],
  canopy: {
    section: 'ellipse',
    // 細長窄座艙：x 36 → −4，每 1.5 mm 一站（站位密 → 線性內插也不會出現折面）；最寬 7.2、最高 5（座艙頂約 31）
    stations: (() => {
      const out = [];
      const n = 27;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(36, -4, u);
        const halfW = i === 0 || i === n ? 2.2 : 7.2 * Math.sin(Math.PI * u ** 0.8) ** 0.6;
        const rise = 5.0 * Math.sin(Math.PI * u ** 0.75) ** 0.7;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [
    // 石油藍綠：分色線以上（鼻尖到座艙、背脊）
    { mat: 'teal', keep: (x, y) => y - splitY(x) },
    // 石油藍綠：背脊中央帶（後段頂面中央 |z| < 9）
    { mat: 'teal', keep: (x, y, z) => (x < 10 ? 9 - Math.abs(z) - 0.08 * Math.max(0, -40 - x) : -1) },
    { mat: 'silver', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'silver2', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    const top = (x) => kit.surf.topY(x, 0);
    // 背帆（V8 鰭的變形：座艙後方背脊上的低長弧形帆，不是座艙頂直立刀鰭）：藍綠帆面＋珊瑚橘上緣
    const outline = sailOutline(top);
    parts.push({ geometry: finPlate(outline, 0, 1.6), mat: 'teal2', outline: true, solid: true, name: 'dorsal-sail' });
    // 帆的珊瑚橘上緣（帆面上緣 1.2 mm 帶，略厚，包住帆緣）
    const rim = [];
    for (let i = 0; i <= 14; i++) {
      const x = lerp(-2, -64, i / 14);
      rim.push([x, outline[i][1] + 0.05]);
    }
    rim.push([-71, top(-64) + 8.55]);
    const rimLow = rim.map(([x, y], i) => [x + (i === rim.length - 1 ? 2 : 0), y - (i === rim.length - 1 ? 1.2 : 1.3)]).reverse();
    parts.push({ geometry: finPlate([...rim, ...rimLow], 0, 1.9), mat: 'coral2', outline: true, solid: true, name: 'dorsal-sail-edge' });
    // 背脊整流條：帆根兩側的橢圓斷面肋，讓帆從殼面長出來（不是直接插上去）
    const ridgePts = [];
    for (let i = 0; i <= 10; i++) {
      const x = lerp(0, -68, i / 10);
      ridgePts.push([x, top(x) - 0.2, 0]);
    }
    parts.push({ geometry: sweepEllipse(ridgePts, 48, (t) => [lerp(1.6, 3.2, Math.min(1, t * 2.5)) * (t > 0.92 ? lerp(1, 0.5, (t - 0.92) / 0.08) : 1), 1.3], 16), mat: 'teal2', solid: true, outline: true, name: 'sail-root-fairing' });
    // 新月形一體平尾（V6 衝刺型＝貼身尾翼、V7 貼近車身高度）：前緣弧往後掠、兩尖端後掠，中央與背帆、車尾殼面相接
    /** @type {number[][]} */
    const cres = [];
    const span = 31;
    for (let i = 0; i <= 20; i++) {
      const z = lerp(-span, span, i / 20);
      const q = (z / span) ** 2;
      cres.push([-58.5 - 18.5 * q, z]);
    }
    for (let i = 19; i >= 1; i--) {
      const z = lerp(-span, span, i / 20);
      const q = (z / span) ** 2;
      cres.push([-66 - 11 * q ** 0.8, z]);
    }
    const yTail = top(-64) - 0.4;
    const shape = new THREE.Shape(cres.map(([x, z]) => new THREE.Vector2(x, -z)));
    const cresGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.3, bevelSegments: 1 });
    cresGeo.rotateX(-Math.PI / 2);
    cresGeo.translate(0, yTail, 0);
    parts.push({ geometry: cresGeo, mat: 'silver2', outline: true, solid: true, name: 'crescent-tail' });
    // 新月尾尖的珊瑚橘尖端（尾翼尖 6 mm）
    const tipGeos = [];
    for (const sg of [-1, 1]) {
      const tp = [];
      for (let i = 0; i <= 6; i++) {
        const z = sg * lerp(25, span, i / 6);
        const q = (z / span) ** 2;
        tp.push([-58.5 - 18.5 * q, z]);
      }
      for (let i = 5; i >= 0; i--) {
        const z = sg * lerp(25, span, i / 6);
        const q = (z / span) ** 2;
        tp.push([-66 - 11 * q ** 0.8, z]);
      }
      const sh = new THREE.Shape(tp.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.9, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, yTail - 0.3, 0);
      tipGeos.push(g);
    }
    parts.push({ geometry: mergeGeos(tipGeos), mat: 'coral2', outline: true, solid: true, name: 'crescent-tips' });
    // 鼻側前翼（鼻部的刃）：前輪前方左右各一片往後掠的薄翼，銀白翼面＋珊瑚橘翼尖，翼根埋入鼻側
    const canards = [];
    const canardTips = [];
    for (const sg of [-1, 1]) {
      canards.push(
        flatPlate(
          [
            [69, sg * 8],
            [61.5, sg * 27.5],
            [57.5, sg * 28],
            [57, sg * 12],
          ].map(([x, z]) => [x, z]),
          14.6,
          0.9,
        ),
      );
      canardTips.push(
        flatPlate(
          [
            [63.2, sg * 23],
            [61.5, sg * 27.5],
            [57.5, sg * 28],
            [57.4, sg * 23],
          ],
          14.55,
          1.0,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(canards), mat: 'silver2', outline: true, solid: true, name: 'nose-canards' });
    parts.push({ geometry: mergeGeos(canardTips), mat: 'coral2', outline: true, solid: true, name: 'nose-canard-tips' });
    // 後輪裙板的珊瑚橘弧線（沿後輪外緣的半圓弧，暗示被罩住的後輪）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const r = Math.hypot(x + 40, y - 13);
        return Math.abs(z) < 30 || y < 12 ? -1 : Math.min(r - 14.6, 15.8 - r);
      }),
      mat: 'coral',
      name: 'decal-rear-arc',
    });
    // 側面縱向細斑條（旗魚體側的斑條）：銀白車身上由前往後漸疏、漸細的藍綠 / 珊瑚橘斜條
    const bars = [];
    const coralBars = [];
    let xb = 12;
    for (let i = 0; i < 8; i++) {
      const w = lerp(1.7, 0.9, i / 7);
      const bar = sdBar(xb, 11.5, xb - 4.2, 25.5, w);
      if (i % 3 === 1) {
        coralBars.push(bar);
      } else {
        bars.push(bar);
      }
      xb -= lerp(4.2, 7.4, i / 7);
    }
    /** @type {(fs: ((u: number, v: number) => number)[]) => import('./loft.js').KeepFn} */
    const barKeep = (fs) => (x, y, z) => {
      if (Math.abs(z) < 26 || y > splitY(x) - 0.8) {
        return -1;
      }
      return -Math.min(...fs.map((f) => f(x, y)));
    };
    parts.push({ geometry: kit.decal(barKeep(bars)), mat: 'tealDecal', name: 'decal-bars-teal' });
    // 分色線下方的珊瑚橘細線（從鼻尖往後上掃）＋珊瑚橘斑條
    parts.push({
      geometry: mergeGeos([
        kit.decal((x, y, z) => (Math.abs(z) < T('hw', x) - 3.5 ? -1 : Math.min(splitY(x) - 0.5 - y, y - splitY(x) + 1.8))),
        // 後輪裙板下緣往車尾上掃的珊瑚橘尾紋
        kit.decal((x, y, z) => (Math.abs(z) < 30 || x > -22 ? -1 : Math.min(12.6 + 0.16 * (-22 - x) - y, y - 10.8 - 0.16 * (-22 - x)))),
        kit.decal(barKeep(coralBars)),
      ]),
      mat: 'coral',
      name: 'decal-coral',
    });
    // 頭燈（V14）：鼻側一對往後掠的細長菱形燈
    const lampSd = sdConvexPolygon([[71, 5.2], [64, 11.6], [60.5, 12.6], [66, 6.2]]);
    parts.push({ geometry: kit.decal((x, y, z) => -lampSd(x, Math.abs(z)), { offset: 0.1 }), mat: 'lamp', name: 'lamp-head' });
    // 號碼 7：後輪裙板（銀白底）與鼻頂
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('7', { h: 7.5, w: 4.2, gap: 0 }), { x0: -40, y0: 18.5, zMin: 30 })),
        kit.decal(topDecal(sdNumber('7', { h: 5.5, w: 3.2, gap: 0 }), { x0: 50, yMin: 18 })),
      ]),
      mat: 'dark',
      name: 'decal-number',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同第三階段各款）',
    geometry: '本檔 T 表與 STATIONS（推估，依 HOMAGE_RESEARCH 4-1：長約 152、背帆頂約 34–38；外框與輪胎間隙用 body-check 掃描）',
    wheels: '只對應 26 mm 輪：前輪外露（車身半寬 22.5）、後輪裙板內面距 26 mm 輪胎外側面 ≥ 2.9 mm；31 mm 輪會頂到後輪上方殼面（設計上不支援）',
    sail: '背帆、背脊整流條、新月平尾視為 ABS 實心件（推估），質量 = 封閉體積 × ABS 1.05 g/cm³',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
