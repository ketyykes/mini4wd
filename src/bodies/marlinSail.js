// 旗魚背帆衝刺型（body-marlin-sail，致敬《爆走兄弟》風格新款）：長而低的箭形車身、針尖鼻、前輪外露、後輪被裙板罩住，
// 細長的有色窄座艙往後直接長出低長的弧形背帆，車尾是兩尖端後掠的新月形一體平尾（無支柱）。
// 設計：shared/design/body-marlin-sail/DESIGN.md（角色、致敬語彙、和劇中車 / 市售車殼的差異）。
// 剖面由本檔的站位函式產生（推估，依 HOMAGE_RESEARCH 第 4 節與外框 / 輪胎間隙掃描）。
// 塗裝全為自創：石油藍綠＋銀白＋珊瑚橘、側面由密到疏的縱向細斑條、號碼「7」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, flatPlate, sweepEllipse, airfoilFin } from './polyBody.js';
import { smoothNormals } from './gazelleLeap.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sdConvexPolygon, sideDecal, topDecal, mergeGeos, lerp, smoothstep } from './loft.js';

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
const X_TAIL = -71;
/** @type {number} 針尖鼻 x */
const X_NOSE = 76;

/**
 * 縱向控制表（推估）：
 * - hw：半寬。前輪範圍（x 24–56）收在 22.5（26 mm 輪胎內側面 25.25，留 ≥ 2 mm → 前輪外露）；
 *   後段鼓成 38 的後輪裙板（輪胎外側面 34.25，裙板內面仍有 ≥ 2.9 mm），把後輪上半罩住；
 *   後輪之後往車尾收成船尾（x −71 半寬 8、封口只剩約 2 mm 高），不平切；裙板下緣抬到 12.5–13（露出輪胎下半，側視才不會像厚立板）
 * - yTop：中線高度，鼻尖 15 → 座艙段 25–28 → 後輪上方 31（26 mm 輪胎頂 26，殼內面仍留 ≥ 1 mm）
 * - drop：頂面到肩稜的落差；yLow：側壁下緣
 */
// 歸 LG1 的長度（HOMAGE_RESEARCH 第 6 節 P5）：站位全長 147 mm（x −71 → 76）——後懸（後輪之後）與針尖鼻（前輪之前）都收短
const T = monoTable([-71, -67.5, -63, -59, -53, -40, -27, -20, -10, 0, 10, 16, 24, 30, 40, 50, 56, 61, 66, 71, 76], {
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

/**
 * 石油藍綠（上）／銀白（下）分色線：鼻尖低、往後斜升（V13）
 * 升到 y 21.5 後封頂 → 後輪裙板上半與車尾側面都是石油藍綠，銀白只剩下緣一道往後收窄的腹帶（旗魚的銀腹）；
 * 分色線若升過車頂，後輪上方之後整段銀白，側面大片白色會像泡泡
 * @type {(x: number) => number}
 */
const splitY = (x) => Math.min(15.5 + 0.17 * (60 - x), 21.5 - 0.06 * Math.max(0, -20 - x));

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  teal: namedMaterial('paint-petrol-teal', { color: 0x0f7480, roughness: 0.18, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  teal2: namedMaterial('paint-petrol-teal', { color: 0x0f7480, roughness: 0.18, metalness: 0.35, clearcoat: 1.0, side: THREE.DoubleSide }),
  // 銀白：低金屬度（0.05）、高明度底色，避免發灰
  // 名稱用 paint-bright- 開頭 → Blender 以 paint_bright（較高明度上限的亮面實色漆）算，銀白更白更亮；
  // Blender 的 pearl 類別會把底色壓到 0.85 倍、掠射角再往灰紫收，展示圖像粉筆灰
  silver: namedMaterial('paint-bright-silver-white-body', { color: 0xf5f6f7, roughness: 0.18, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.04 }),
  silver2: namedMaterial('paint-bright-silver-white-body', { color: 0xf5f6f7, roughness: 0.18, metalness: 0.05, clearcoat: 1.0, side: THREE.DoubleSide }),
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
  // 鏟形前唇（亮黑）
  lip2: namedMaterial('paint-gloss-black-lip', { color: 0x101214, roughness: 0.25, clearcoat: 1.0, side: THREE.DoubleSide }),
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

export const marlinSailBody = makePolyBody({
  id: 'body-marlin-sail',
  name: '旗魚背帆衝刺型',
  style: 'homage',
  phase: 4,
  // 分組依據（HOMAGE_RESEARCH 第 6 節 P5）：長箭形和 LG1 / LG2 都不太像（最接近 MAX 篇），後懸與鼻尖收短到站位全長 147 mm 後歸 LG1
  homageSeries: 'lg1',
  form: 'arrow',
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
  // 後輪裙板上的圓弧分件槽（真實高低差 0.7 mm，不是只有貼紙的弧線）
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
    // 背帆（V8 鰭的變形，刀形帆）：從座艙後緣沿背脊升起、前緣長斜線往後上掠到 x −59.6、y 44.5 的尖端，
    // 後緣往後傾約 34°（根 x −58、尖 x −69.2）；翼型斷面（根部厚 2.6 mm、尖端收到 40%），根部埋進殼內；藍綠帆面＋珊瑚橘帆尖帶（共用同一外傾支點，接縫對齊）
    // 整片帆往後傾，像高速時往後壓平的旗魚背鰭（直立的帆鰭沒有速度感）
    const sailRoot = [-3, -58, 27.4];
    const sailTip = [-59.6, -69.2, 44.5];
    /** @type {(f: number) => number[]} 弦線在展向比例 f 的 [前緣 x, 後緣 x, y] */
    const sailAt = (f) => [lerp(sailRoot[0], sailTip[0], f), lerp(sailRoot[1], sailTip[1], f), lerp(sailRoot[2], sailTip[2], f)];
    /** @type {(f0: number, f1: number) => THREE.BufferGeometry} */
    const sailPiece = (f0, f1) => airfoilFin(sailAt(f0), sailAt(f1), 2.6, 0, 0, 16, 8, { pivotY: sailRoot[2], taper: [lerp(1, 0.4, f0), lerp(1, 0.4, f1)] });
    parts.push({ geometry: sailPiece(0, 0.8), mat: 'teal2', outline: true, solid: true, name: 'dorsal-sail' });
    parts.push({ geometry: sailPiece(0.8, 1), mat: 'coral2', outline: true, solid: true, name: 'dorsal-sail-tip' });
    // 背脊整流條：帆根兩側的橢圓斷面肋，讓帆從殼面長出來（不是直接插上去）
    const ridgePts = [];
    for (let i = 0; i <= 10; i++) {
      const x = lerp(0, -62, i / 10);
      ridgePts.push([x, top(x) - 0.2, 0]);
    }
    parts.push({ geometry: sweepEllipse(ridgePts, 48, (t) => [lerp(1.6, 3.4, Math.min(1, t * 2.5)) * (t > 0.9 ? lerp(1, 0.5, (t - 0.9) / 0.1) : 1), 1.4], 16), mat: 'teal2', solid: true, outline: true, name: 'sail-root-fairing' });
    // 新月形一體尾鰭（V6 衝刺型＝貼身尾翼、V7 貼近車身高度；有厚度的翼型曲面）：
    // 前緣弧往後掠、兩尖端後掠收尖；中央厚 2.8 mm 並埋進船尾殼面（和車尾接成一體），往翼尖上反 3.4 mm（不是平板）
    const span = 31;
    const yTail = top(-61) - 0.9;
    const cres = {
      nV: 10,
      span,
      // 尖端後掠到 x −71（和車尾齊）
      le: (u) => -54 - 16.5 * u * u,
      te: (u) => -61 - 10 * Math.abs(u) ** 1.6,
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
    // 前輪擋泥板：
    // - 淚滴形小罩：沿輪胎上緣的弧（中心半徑 15.9 mm），斷面為拱起的扁橢圓（平頂圓弧帶＋直立腹板會像蓋在輪上的厚圓餅）
    // - 導流圓角：從車身肩部升到小罩內緣的曲面（車身同色），往前一直接到鼻側，把小罩前端與鼻側之間的黑縫（看得到輪胎）補起來
    const blades = [];
    const fairings = [];
    // 淚滴形小罩（HOMAGE_RESEARCH 第 6 節 P5）：只蓋住前輪上前方（角度 6°–118°），
    // 前端圓、往後上方收尖；罩寬幾乎蓋滿胎面（z 中心 28.4、半寬最大 5.2），徑向半厚 1.3（內面離 26 mm 輪胎約 1.6 mm）
    const FENDER = { a0: 6, a1: 118, r: 15.9, zc: 28.4 };
    /** @type {(t: number) => number} 淚滴罩 z 向半寬（t = 沿弧 0–1，0 = 前端）：前 18% 圓頭漲到 5.2，之後往尾端收到 25% */
    const bladeHalfW = (t) => {
      const u = Math.min(1, Math.max(0, t));
      const head = Math.sin((Math.PI / 2) * Math.min(1, u / 0.18)) ** 0.5;
      const tail = 1 - 0.75 * Math.max(0, (u - 0.18) / 0.82) ** 1.4;
      return 5.2 * Math.max(0.3, head) * tail;
    };
    for (const sg of [-1, 1]) {
      /** @type {number[][]} */
      const arc = [];
      for (let i = 0; i <= 24; i++) {
        const a = ((FENDER.a0 + ((FENDER.a1 - FENDER.a0) * i) / 24) * Math.PI) / 180;
        arc.push([40 + FENDER.r * Math.cos(a), 13 + FENDER.r * Math.sin(a), sg * FENDER.zc]);
      }
      // 斷面 [z 向半寬, 徑向半厚]：前端圓頭 5.2 × 1.3，往尾端一起收（淚滴）
      blades.push(smoothNormals(sweepEllipse(arc, 72, (t) => [bladeHalfW(t), 1.3 * Math.max(0.35, bladeHalfW(t) / 5.2)], 20)));
      /** @type {number[]} */
      const pos = [];
      const n = 40;
      const m = 12;
      /** @type {(i: number) => number[][]} 第 i 個取樣角的導流圓角斷面（m + 1 點，車身肩部 → 小罩內緣） */
      // 角度範圍兩端各內縮 0.6°
      // 二次曲線圓角：從車身頂面（|z| 16）以二次曲線升起、在小罩中心線高度轉成水平接進小罩（控制點 = (車身與罩之間 30% 處, 小罩高度)），
      // 俯視看到的是從車身連續長出小罩的受光圓角面，而不是暗色斜縫（直紋斜面在俯視時仍看得到小罩和車身之間的縫）
      const section = (i) => {
        const deg = FENDER.a0 + 0.6 + ((FENDER.a1 - FENDER.a0 - 1.2) * i) / n;
        const a = (deg * Math.PI) / 180;
        const x = 40 + FENDER.r * Math.cos(a);
        // 起點在車身頂面（肩稜內側 |z| ≤ 16，埋入 0.3 mm），終點在小罩中心線（埋在罩內）→ 小罩內半邊被圓角面接住
        // 圓角寬度沿弧漸變：中段從 |z| 16 起、後端收回肩稜（|z| ≈ 21）→ 俯視圓角面往後收尖，不是方塊；前端保留 70% 寬度，蓋住鼻側與小罩前端之間的縫
        const sArc = i / n;
        const wFillet = lerp(0.7, 1, smoothstep(0, 0.3, sArc)) * smoothstep(1, 0.62, sArc);
        const zb = lerp(Math.min(T('hw', x) - 1.2, 21), Math.min(T('hw', x) - 5, 16), wFillet);
        const zEnd = FENDER.zc;
        // 終點取小罩頂面（中心線往外 0.9 倍徑向半厚）→ 圓角面切線接上罩頂，罩內側不留一道背光的側面
        const hPod = 0.9 * 1.3 * Math.max(0.35, bladeHalfW((deg - FENDER.a0) / (FENDER.a1 - FENDER.a0)) / 5.2);
        const yA = 13 + (FENDER.r + hPod) * Math.sin(a);
        const dxA = hPod * Math.cos(a);
        const yB = kit.surf.topY(x, zb) - 0.3;
        const zCtl = lerp(zb, zEnd, 0.3);
        /** @type {number[][]} */
        const pts = [];
        for (let j = 0; j <= m; j++) {
          const t = j / m;
          const u = 1 - t;
          const z = u * u * zb + 2 * u * t * zCtl + t * t * zEnd;
          const y = u * u * yB + 2 * u * t * yA + t * t * yA;
          pts.push([x + t * t * dxA, y, sg * z]);
        }
        return pts;
      };
      for (let i = 0; i < n; i++) {
        const p0 = section(i);
        const p1 = section(i + 1);
        for (let j = 0; j < m; j++) {
          const a = p0[j + 1];
          const b = p0[j];
          const c = p1[j + 1];
          const d = p1[j];
          // 左右側繞序相反，法線都朝外（法線朝殼內側時，app 俯視的圓角面會比車身頂面暗一階）
          if (sg > 0) {
            pos.push(...a, ...b, ...c, ...b, ...d, ...c);
          } else {
            pos.push(...a, ...c, ...b, ...b, ...c, ...d);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      fairings.push(smoothNormals(g));
    }
    parts.push({ geometry: mergeGeos(blades), mat: 'teal2', outline: true, solid: true, name: 'front-fender-blades' });
    parts.push({ geometry: mergeGeos(fairings), mat: 'teal2', shell: true, name: 'front-fender-fairings' });
    // 鼻側前翼（鼻部的刃）：前輪前方左右各一片往後掠的薄翼，銀白翼面＋珊瑚橘翼尖，翼根埋入鼻側
    const canards = [];
    const canardTips = [];
    for (const sg of [-1, 1]) {
      canards.push(
        flatPlate(
          [
            // 翼尖伸到 |z| 32，和鏟形前唇一起讓車頭俯視是「劍吻＋兩側前翼」的箭頭
            [66.5, sg * 8],
            [60.6, sg * 31.5],
            [56.6, sg * 32],
            [55.3, sg * 12],
          ].map(([x, z]) => [x, z]),
          14.6,
          0.9,
        ),
      );
      canardTips.push(
        flatPlate(
          [
            [62.1, sg * 27],
            [60.6, sg * 31.5],
            [56.6, sg * 32],
            [56.2, sg * 27],
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
    // 針尖鼻下方一片亮黑鏟形前唇（實心 1.2 mm 板，y 11.4–12.6）：
    // 從前輪前方（x 58、半寬 11）沿鼻底往前，鼻尖之前收成圓頭鏟（x 75 半寬 6 → 尖端 x 79），像劍吻往前下伸出的下顎；
    // 俯視寬度都在鼻部半寬以內或鼻尖之前（俯視平面不往兩側變寬）
    /** @type {number[][]} 鏟形前唇俯視多邊形 (x, z)：先右側由後往前、再繞圓頭、再左側由前往後 */
    const spade = [];
    /** @type {(x: number) => number} 鏟形前唇半寬：x 58 → 11、x 73 → 6，x 75 之後圓頭收到 x 79 */
    const spadeHw = (x) => {
      if (x <= 75) {
        return lerp(11, 6, smoothstep(58, 73, x));
      }
      return 6 * Math.sqrt(Math.max(0, 1 - ((x - 75) / 4) ** 2));
    };
    for (let i = 0; i <= 14; i++) {
      const x = lerp(58, 79, i / 14);
      spade.push([x, spadeHw(x)]);
    }
    for (let i = 14; i >= 0; i--) {
      const x = lerp(58, 79, i / 14);
      spade.push([x, -spadeHw(x)]);
    }
    parts.push({ geometry: flatPlate(spade, 11.4, 1.2), mat: 'lip2', solid: true, outline: true, name: 'spade-lip' });
    // 頭燈（V14）：鼻側一對往後掠的細長菱形燈
    const lampSd = sdConvexPolygon([[68, 5.2], [61.5, 11.6], [58.5, 12.6], [63.5, 6.2]]);
    parts.push({ geometry: kit.decal((x, y, z) => -lampSd(x, Math.abs(z)), { offset: 0.1 }), mat: 'lamp', name: 'lamp-head' });
    // 號碼 7：後輪裙板（銀白底）與鼻頂
    parts.push({
      geometry: mergeGeos([
        // 側面號碼放在銀白腹帶上（後輪裙板上半是石油藍綠）：後輪分件弧內、珊瑚橘尾紋之上、分色線之下（x −36、y 15.6–20.1），
        // 不能被裙板下緣（約 12.7）或珊瑚橘尾紋（y 14.2–16）切到：
        // 下緣離尾紋上緣 ≥ 0.6 mm、上緣離石油藍綠分色線（y 20.5）≥ 0.4 mm、前緣離最後一道藍綠斑條（x ≈ −29）≥ 4 mm、離分件弧與珊瑚橘弧線 ≥ 6 mm
        kit.decal(sideDecal(sdNumber('7', { h: 4.4, w: 2.8, gap: 0 }), { x0: -36, y0: 17.85, zMin: 30 })),
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
    geometry: '本檔 T 表與 STATIONS（推估，依 HOMAGE_RESEARCH 4-1：長約 152、背帆頂約 34–38；iter-67 依第 6 節 P5 縮短到 147 mm；外框與輪胎間隙用 body-check 掃描）',
    wheels: '只對應 26 mm 輪：前輪外露（車身半寬 22.5）、後輪裙板內面距 26 mm 輪胎外側面 ≥ 2.9 mm；31 mm 輪會頂到後輪上方殼面（設計上不支援）',
    sail: '背帆、背脊整流條、新月平尾、鏟形前唇（1.2 mm 板）視為 ABS 實心件（推估），質量 = 封閉體積 × ABS 1.05 g/cm³；iter-123 車殼長約 150（≤ 153）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
