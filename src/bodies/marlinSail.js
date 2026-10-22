// 旗魚背帆衝刺型（body-marlin-sail，第四階段致敬《爆走兄弟》風格新款）：長而低的箭形車身、針尖鼻、前輪外露、後輪被裙板罩住，
// 細長的有色窄座艙往後直接長出低長的弧形背帆，車尾是兩尖端後掠的新月形一體平尾（無支柱）。
// 設計：shared/design/body-marlin-sail/DESIGN.md（角色、致敬語彙、和劇中車 / 市售車殼的差異）。
// 剖面由本檔的站位函式產生（推估，依 HOMAGE_RESEARCH 第 4 節與外框 / 輪胎間隙掃描）。
// 塗裝全為自創：石油藍綠＋銀白＋珊瑚橘、側面由密到疏的縱向細斑條、號碼「7」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate, sweepEllipse, airfoilFin } from './polyBody.js';
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
const X_TAIL = -77;
/** @type {number} 針尖鼻 x */
const X_NOSE = 80;

/**
 * 縱向控制表（推估）：
 * - hw：半寬。前輪範圍（x 24–56）收在 22.5（26 mm 輪胎內側面 25.25，留 ≥ 2 mm → 前輪外露）；
 *   後段鼓成 38 的後輪裙板（輪胎外側面 34.25，裙板內面仍有 ≥ 2.9 mm），把後輪上半罩住；
 *   iter-55：後輪之後往車尾收成船尾（x −77 半寬 8、封口只剩約 2 mm 高），不再平切；裙板下緣抬到 12.5–13（露出輪胎下半，側視不再像厚立板）
 * - yTop：中線高度，鼻尖 15 → 座艙段 25–28 → 後輪上方 31（26 mm 輪胎頂 26，殼內面仍留 ≥ 1 mm）
 * - drop：頂面到肩稜的落差；yLow：側壁下緣
 */
const T = monoTable([-77, -72, -66, -60, -53, -40, -27, -20, -10, 0, 10, 16, 24, 30, 40, 50, 56, 62, 68, 74, 80], {
  hw: [8, 17, 26, 32.5, 37.5, 38, 37.5, 36.5, 34.5, 32, 29, 26, 22.5, 22.5, 22.5, 22.5, 20, 16, 12, 8, 4],
  yTop: [28.6, 29.4, 30.2, 30.8, 31.2, 31.6, 31, 30.2, 29, 28, 27.4, 27, 26, 25, 23.4, 21.6, 20.4, 19, 17.6, 16.3, 15],
  drop: [0.8, 1.6, 2.4, 2.8, 3.2, 3.4, 3.2, 3, 3.4, 3.6, 3.6, 3.6, 3.4, 3.2, 3, 2.8, 2.6, 2.2, 1.6, 1, 0.6],
  yLow: [26.6, 24.5, 20.5, 16, 12.5, 13, 12.5, 10, 9.5, 9.5, 9.5, 9.5, 10, 11, 12, 12.5, 13.5, 13.5, 13.5, 13.5, 13.5],
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
  // iter-55：銀白去灰 → 珍珠白（金屬度 0.35 → 0.05，底色更亮；Blender 以 pearl 類別算珠光）
  silver: namedMaterial('paint-pearl-white', { color: 0xf5f6f7, roughness: 0.18, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.04 }),
  silver2: namedMaterial('paint-pearl-white', { color: 0xf5f6f7, roughness: 0.18, metalness: 0.05, clearcoat: 1.0, side: THREE.DoubleSide }),
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
 * 有厚度的升力面（新月尾鰭）：展向 u ∈ [u0, u1]（z = u · span）、弦向 v ∈ [0, 1]（前緣 → 後緣），
 * 上下兩面以 √v(1 − v) 厚度分布在前緣、後緣閉合；u 截斷處補端面 → 封閉網格（實心件以封閉體積算質量）
 * @type {(o: { u0: number, u1: number, nU: number, nV: number, span: number, le: (u: number) => number, te: (u: number) => number, y: (u: number, v: number) => number, thick: (u: number) => number }) => THREE.BufferGeometry}
 */
const liftSurface = (o) => {
  /** @type {(v: number) => number} 正規化厚度分布（最大 1，v = 1/3） */
  const tv = (v) => (Math.sqrt(v) * (1 - v)) / 0.3849;
  /** @type {(i: number, j: number, sg: number) => number[]} */
  const P = (i, j, sg) => {
    const u = lerp(o.u0, o.u1, i / o.nU);
    const v = j / o.nV;
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
  for (const [i, flip] of [
    [0, false],
    [o.nU, true],
  ]) {
    for (let j = 0; j < o.nV; j++) {
      const t0 = P(i, j, 1);
      const t1 = P(i, j + 1, 1);
      const b0 = P(i, j, -1);
      const b1 = P(i, j + 1, -1);
      if (flip) {
        pos.push(...t0, ...b1, ...b0, ...t0, ...t1, ...b1);
      } else {
        pos.push(...t0, ...b0, ...b1, ...t0, ...b1, ...t1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 前輪擋泥唇（側視圓環扇形，沿 z 擠出）：半徑 r0–r1、角度 a0–a1（度，0 = 車頭方向水平），z 範圍 z0–z1
 * @type {(r0: number, r1: number, a0: number, a1: number, z0: number, z1: number) => THREE.BufferGeometry}
 */
const arcStrip = (r0, r1, a0, a1, z0, z1) => {
  /** @type {THREE.Vector2[]} */
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push(new THREE.Vector2(40 + r1 * Math.cos(a), 13 + r1 * Math.sin(a)));
  }
  for (let i = n; i >= 0; i--) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push(new THREE.Vector2(40 + r0 * Math.cos(a), 13 + r0 * Math.sin(a)));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, z0);
  return g;
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
  // iter-55：後輪裙板上的圓弧分件槽（真實高低差 0.7 mm，取代只有貼紙的弧線）
  recesses: [
    {
      id: '後輪分件弧',
      view: 'side',
      shape: 'fn',
      sd: (x, y, z) => (Math.abs(z) < 30 ? 10 : Math.abs(Math.hypot(x + 40, y - 13) - 15.4) - 0.5),
      depth: 0.7,
    },
  ],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [
    // 石油藍綠：分色線以上（鼻尖到座艙、背脊）
    { mat: 'teal', keep: (x, y) => y - splitY(x) },
    // 石油藍綠：背脊中央帶（後段頂面中央 |z| < 9）
    { mat: 'teal', keep: (x, y, z) => (x < 10 ? 9 - Math.abs(z) - 0.08 * Math.max(0, -40 - x) : -1) },
    { mat: 'silver', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'silver2', recess: 'teal2', recessWall: 'teal2', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    const top = (x) => kit.surf.topY(x, 0);
    // 背帆（V8 鰭的變形，iter-55 改成刀形帆）：從座艙後緣沿背脊升起、前緣長斜線往後上掠到 x −57、y 45.5 的尖端，
    // 後緣往後傾；翼型斷面（根部厚 2.6 mm、尖端收到 40%），根部埋進殼內；藍綠帆面＋珊瑚橘帆尖帶（共用同一外傾支點，接縫對齊）
    const sailRoot = [-3, -60, 27.4];
    const sailTip = [-57, -67.5, 45.5];
    /** @type {(f: number) => number[]} 弦線在展向比例 f 的 [前緣 x, 後緣 x, y] */
    const sailAt = (f) => [lerp(sailRoot[0], sailTip[0], f), lerp(sailRoot[1], sailTip[1], f), lerp(sailRoot[2], sailTip[2], f)];
    /** @type {(f0: number, f1: number) => THREE.BufferGeometry} */
    const sailPiece = (f0, f1) => airfoilFin(sailAt(f0), sailAt(f1), 2.6, 0, 0, 16, 8, { pivotY: sailRoot[2], taper: [lerp(1, 0.4, f0), lerp(1, 0.4, f1)] });
    parts.push({ geometry: sailPiece(0, 0.8), mat: 'teal2', outline: true, solid: true, name: 'dorsal-sail' });
    parts.push({ geometry: sailPiece(0.8, 1), mat: 'coral2', outline: true, solid: true, name: 'dorsal-sail-tip' });
    // 背脊整流條：帆根兩側的橢圓斷面肋，讓帆從殼面長出來（不是直接插上去）
    const ridgePts = [];
    for (let i = 0; i <= 10; i++) {
      const x = lerp(0, -66, i / 10);
      ridgePts.push([x, top(x) - 0.2, 0]);
    }
    parts.push({ geometry: sweepEllipse(ridgePts, 48, (t) => [lerp(1.6, 3.4, Math.min(1, t * 2.5)) * (t > 0.9 ? lerp(1, 0.5, (t - 0.9) / 0.1) : 1), 1.4], 16), mat: 'teal2', solid: true, outline: true, name: 'sail-root-fairing' });
    // 新月形一體尾鰭（V6 衝刺型＝貼身尾翼、V7 貼近車身高度；iter-55 改成有厚度的翼型曲面）：
    // 前緣弧往後掠、兩尖端後掠收尖；中央厚 2.8 mm 並埋進船尾殼面（和車尾接成一體），往翼尖上反 3.4 mm（不是平板）
    const span = 31;
    const yTail = top(-66) - 0.9;
    const cres = {
      nV: 10,
      span,
      le: (u) => -58.5 - 18.5 * u * u,
      te: (u) => -66 - 11 * Math.abs(u) ** 1.6,
      y: (u, v) => yTail + 3.4 * u * u + 0.5 * Math.sin(Math.PI * v),
      thick: (u) => 0.4 + 2.4 * (1 - u * u),
    };
    parts.push({ geometry: liftSurface({ ...cres, u0: -0.8, u1: 0.8, nU: 48 }), mat: 'silver2', outline: true, solid: true, name: 'crescent-tail' });
    // 新月尾尖（珊瑚橘，展向外側 20%）
    parts.push({
      geometry: mergeGeos([liftSurface({ ...cres, u0: -1, u1: -0.8, nU: 12 }), liftSurface({ ...cres, u0: 0.8, u1: 1, nU: 12 })]),
      mat: 'coral2',
      outline: true,
      solid: true,
      name: 'crescent-tips',
    });
    // 前輪擋泥唇（iter-55，鼻側小翼的後續）：罩住前輪內側上半的圓弧唇（內半徑 15、離 26 mm 輪胎 2 mm），
    // 下方用一片腹板接回車身側壁（翼根埋入殼面），讓前段不再只有一根細鼻
    const lips = [];
    const webs = [];
    for (const sg of [-1, 1]) {
      const z0 = sg > 0 ? 21.4 : -30.4;
      lips.push(arcStrip(15, 16.1, 28, 158, z0, z0 + 9));
      /** @type {number[][]} 腹板側視輪廓：上緣沿擋泥唇內緣、下緣沿車身頂面往下 1 mm */
      const web = [];
      for (let i = 0; i <= 12; i++) {
        const a = ((28 + (130 * i) / 12) * Math.PI) / 180;
        web.push([40 + 15.4 * Math.cos(a), 13 + 15.4 * Math.sin(a)]);
      }
      for (let i = 12; i >= 0; i--) {
        const x = 40 + 15.4 * Math.cos(((28 + (130 * i) / 12) * Math.PI) / 180);
        web.push([x, kit.surf.topY(x, 21.5) - 1.2]);
      }
      webs.push(finPlate(web, sg * 22.1, 1.3));
    }
    parts.push({ geometry: mergeGeos(lips), mat: 'teal2', outline: true, solid: true, name: 'front-fender-lips' });
    parts.push({ geometry: mergeGeos(webs), mat: 'teal2', outline: true, solid: true, name: 'front-fender-webs' });
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
        return Math.abs(z) < 30 || y < 13.5 ? -1 : Math.min(r - 16.3, 17.3 - r);
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
      if (Math.abs(z) < 26 || y > splitY(x) - 1.6) {
        return -1;
      }
      return -Math.min(...fs.map((f) => f(x, y)));
    };
    parts.push({ geometry: kit.decal(barKeep(bars)), mat: 'tealDecal', name: 'decal-bars-teal' });
    // 分色線下方的珊瑚橘細線（從鼻尖往後上掃）＋珊瑚橘斑條
    parts.push({
      geometry: mergeGeos([
        kit.decal((x, y, z) => (Math.abs(z) < T('hw', x) - 3.5 || x < -24 ? -1 : Math.min(splitY(x) - 0.5 - y, y - splitY(x) + 1.8))),
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
