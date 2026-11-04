// 八足神駒斯雷普尼爾（body-sleipnir-stride，第八階段神話組・北歐）：修長、前高後低的奔馬身——
// 後段低伏（車尾 27）、背脊一道細脊線往前升起成抽象的短馬頸（頸頂 52，和車身是同一張殼面），頸前收成往前下低垂的馬頭；
// 座艙罩在中段；頸背一列銀色短鬃片，座艙後方的背脊再接一道往後升高的銀鬃冠（mane-crest，尾翼，三片束成一束，尾端不超出車尾）。
// 兩側車身下緣在前後輪之間各有 4 片往後斜的細長「腿」浮雕鰭（前後各一對，共 8 條腿；實體件，蹄尖略低於側裙，離地約 10 mm，不碰輪胎）。
// 配色：上半身斑點灰（亮面）＋淺色小圓斑貼紙、下半身深藍灰（霧面）、腿是石灰岩米白（霧面，像圖像石上的浮雕）、鬃是銀（金屬）；
// 肩線下一道兩股絞繩紋（深色刻線，0.6 mm；不用 Tjängvide 那種像 Valknut 的編織帶、不用任何盧恩）。沒有翅膀（避開天馬意象）、不放騎士。
// 四個 R17.5 輪拱＋輪拱內襯：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-sleipnir-stride/DESIGN.md（MYTH_RESEARCH N9、N10、N11、N12：《散文埃達》灰色八足馬、哥特蘭圖像石）。
// 剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-74, -68, -62, -56, -48, -40, -28, -14, 0, 14, 28, 40, 48, 56, 62, 68, 72, 76];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 背 / 引擎蓋兩側（頸根外）高度：後輪上方的臀部隆起 37.6、腰背凹 33.6、前輪上方的肩部隆起 38，車尾低伏 27、鼻端 26
  yD: monoCurve(XS, [27, 29, 31, 34, 36.2, 36.4, 34, 32.6, 32.8, 33, 34.2, 36.4, 36.8, 36, 34, 31, 29, 26]),
  // 中線頂：x < 28 是背上細脊（背 + 1.2）；x 28 起脊線升起成馬頸，x 62 頸頂（51.6），再往前下垂成馬頭到鼻端（31）
  yN: monoCurve(XS, [28.2, 30.2, 32.2, 35.2, 37.4, 37.6, 35.2, 33.8, 34, 34.2, 35.6, 40.4, 45.6, 50.2, 51.6, 47.5, 41, 31]),
  // 背脊 / 馬頸半寬
  nw: monoCurve(XS, [2.4, 2.6, 2.8, 3, 3, 3, 3, 3, 3, 3.2, 4.2, 7, 7.4, 7, 6.3, 5.4, 4.6, 3.6]),
  // 半寬（俯視馬形）：後輪上方的臀部（50）→ 收細的腰腹（36.8，剛好蓋住底盤側面）→ 前輪上方的肩部（50）→ 收成細長馬頭（鼻端 9）；車尾收窄（後導輪處 < 35.5）
  hw: monoCurve(XS, [19, 20, 24, 42, 48.5, 48.5, 36.8, 36.8, 36.8, 36.8, 36.8, 44.8, 48.5, 48.5, 40.3, 21, 17, 10.8]),
  // 側裙下緣：中段 13.6（蓋住底盤側面上半，底盤側框 9.4 以上）；車尾抬高到後上導輪頂（20.5）之上；車頭逐步抬高
  yLow: monoCurve(XS, [22.6, 22, 20.4, 15.5, 13.4, 13.2, 13.6, 13.6, 13.6, 13.6, 13.6, 13.2, 13.4, 14, 14.8, 17, 18.2, 19.2]),
};

/** @type {(x: number) => number} 臀 / 肩隆起係數（半寬 37 → 48.5 對應 0 → 1） */
const podAt = (x) => Math.min(1, Math.max(0, (P.hw(x) - 37) / 11.5));
/** @type {(x: number) => number} 側面腰線（上半身斑點灰與下半身深藍灰的分界、側壁頂）：臀 / 肩隆起處往下多 2.5 mm（圓鼓的葉子板） */
const ySideAt = (x) => P.yD(x) - 6.5 - 2.5 * podAt(x);

/**
 * 半剖面 9 點：中線頂 → 脊 / 頸頂 → 脊 / 頸側稜 → 頸根（融進背）→ 背肩 → 肩外圓 → 腰線（銳利）→ 側壁 → 側裙下緣（內收）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yN = P.yN(x);
  const yD = P.yD(x);
  const hw = P.hw(x);
  const yS = ySideAt(x);
  const yLow = Math.min(P.yLow(x), yS - 2);
  const nw = Math.min(P.nw(x), 0.3 * hw);
  const drop = Math.min(1.4, Math.max(0.1, (yN - yD) * 0.3));
  return [
    [0, yN],
    [0.6 * nw, yN - 0.25 * drop],
    [nw, yN - drop],
    [nw + 1.2, yD],
    [Math.max(nw + 1.6, 0.72 * hw), yD - 2.2],
    [hw - 1.2, yS + 1.5],
    [hw, yS],
    [hw, lerp(yS, yLow, 0.45)],
    [hw - 1.4, yLow],
  ];
};

// 馬頸與馬頭段每 0.5 mm 一站（曲率大），其餘每 2 mm
const STATIONS = [...buildStations(-74, 24, 2, profile).slice(0, -1), ...buildStations(24, 76, 0.5, profile)];

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（側視，31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5 },
  { x: -40, y: 13, radius: 17.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number) => number} 座艙罩半寬（x −32 → 8；罩外為 −1） */
const canopyHalfW = (x) => {
  if (x <= -32 || x >= 8) {
    return -1;
  }
  const u = (8 - x) / 40;
  return 12.5 * Math.sin(Math.PI * u ** 0.85) ** 0.55;
};

/** 座艙罩（中段，橢圓斷面） */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(8, -32, u);
      const halfW = i === 0 || i === n ? 2.5 : canopyHalfW(x);
      const rise = 9.4 * Math.sin(Math.PI * u ** 0.8) ** 0.6;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** 八條腿（每側 4 條，前後各一對）：腿根 x（腿往後下斜） */
const LEG_XS = [20, 13.6, -9, -15.4];
/** @type {number} 腿根高度（腰線下方） */
const LEG_Y0 = 27.4;
/** @type {number} 蹄尖高度（略低於側裙下緣 13.6） */
const LEG_Y1 = 11;

/** @type {(x: number, z: number) => boolean} 側壁（腰線以下的垂直面與內收下緣） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 1.45;
/** @type {(x: number, y: number) => boolean} 下半身（腰線以下） */
const isLower = (x, y) => y < ySideAt(x) + 0.05;

/** 斑點灰的圓斑格距（偽隨機分布） */
const DAPPLE_CELL = 5.6;

/**
 * 雜湊（0–1）
 * @type {(i: number, j: number, k: number) => number}
 */
const hash = (i, j, k) => {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * 斑點灰（dapple）：淺色小圓環（外徑 1.1–1.8、環寬 0.6），越往車頭越稀（x > 30 起機率遞減、頸與頭不畫），
 * 用 (x, |z| + 0.6 y) 平面分布，頂面與側肩都有
 * @type {(x: number, y: number, z: number) => number} 正值 = 環內
 */
const dappleRing = (x, y, z) => {
  const v = Math.abs(z) + 0.6 * y;
  const i0 = Math.floor(x / DAPPLE_CELL);
  const j0 = Math.floor(v / DAPPLE_CELL);
  let best = -Infinity;
  for (let i = i0 - 1; i <= i0 + 1; i++) {
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const cx = (i + 0.2 + 0.6 * hash(i, j, 1)) * DAPPLE_CELL;
      const keep = Math.min(1, Math.max(0, (36 - cx) / 30));
      if (hash(i, j, 4) > 0.25 + 0.75 * keep) {
        continue;
      }
      const cv = (j + 0.2 + 0.6 * hash(i, j, 2)) * DAPPLE_CELL;
      const r = 1.1 + 0.7 * hash(i, j, 3);
      best = Math.max(best, 0.3 - Math.abs(Math.hypot(x - cx, v - cv) - r));
    }
  }
  return best;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 斑點灰（上半身，亮面：少數亮面部位）
  grey: namedMaterial('paint-dapple-grey', { color: 0x9aa0a6, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
  // 深藍灰（下半身、鼻端，霧面）
  slate: namedMaterial('paint-slate-bluegrey', { color: 0x37455a, roughness: 0.62, clearcoat: 0.05 }),
  slate2: namedMaterial('paint-slate-bluegrey', { color: 0x37455a, roughness: 0.62, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 石灰岩米白（腿的浮雕，霧面）
  stone: namedMaterial('paint-limestone-relief', { color: 0xd8d1c1, roughness: 0.74, clearcoat: 0.0, side: THREE.DoubleSide }),
  // 銀鬃（真金屬：名稱含 -steel）
  silver: namedMaterial('trim-silver-steel', { color: 0xc4c8cc, roughness: 0.3, metalness: 0.78, clearcoat: 0.2, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1d22, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-slate', { color: 0x2b3442, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x1a1d22, roughness: 0.85, side: THREE.DoubleSide }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x26303c, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-slate', { color: 0x2e3744, roughness: 0.75, side: THREE.DoubleSide }),
  dSpot: decalMaterial('decal-dapple-light', { color: 0xd3d6d9, roughness: 0.45 }),
  dIncise: decalMaterial('decal-incised-dark', { color: 0x2a313b, roughness: 0.6 }),
  dStone: decalMaterial('decal-limestone', { color: 0xd8d1c1, roughness: 0.7 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯：輪拱切口後面的上半圈圓柱面（半徑 = 輪拱半徑 + 0.3），z 從殼內面往內 3.5 mm（最深到 |z| 25.5）；
 * 外側界限 = 側壁內面與「殼面高度 ≥ 內襯高度 + 0.9」兩者較小者（不穿出肩部曲面）
 * @type {(kit: any, arch: { x: number, y: number, radius: number }) => THREE.BufferGeometry}
 */
const buildLiner = (kit, arch) => {
  /** @type {number} 內襯從外側往內的深度（只遮住從輪拱斜看進去的殼內空腔，不做整圈輪室，省質量） */
  const LINER_DEPTH = 3.5;
  const r = arch.radius + 0.3;
  const n = 44;
  const a0 = 0.1;
  const a1 = Math.PI - 0.1;
  const zInner = 25.5;
  /** @type {(t: number) => number} 該角度內襯的外側 z */
  const zOuter = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    const zSide = P.hw(x) - 1.0;
    if (kit.surf.topY(x, zSide) >= y + 0.9) {
      return zSide;
    }
    let lo = zInner;
    let hi = zSide;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (kit.surf.topY(x, m) >= y + 0.9) {
        lo = m;
      } else {
        hi = m;
      }
    }
    return Math.max(zInner + 0.5, lo);
  };
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const o0 = zOuter(t0);
      const o1 = zOuter(t1);
      const A = p(t0, Math.max(zInner, o0 - LINER_DEPTH));
      const B = p(t1, Math.max(zInner, o1 - LINER_DEPTH));
      const C = p(t1, o1);
      const D = p(t0, o0);
      // 法線朝輪心
      if (sg > 0) {
        pos.push(...A, ...C, ...B, ...A, ...D, ...C);
      } else {
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 一束鬃（側視多邊形）：鬃根在中線頂 x = a（根部往下埋 1 mm），往後順梳成細長刀形，鬃尖在 (a − len, 中線頂 + h)，上緣微拱
 * @type {(a: number, len: number, h: number) => number[][]}
 */
const maneStrand = (a, len, h) => [
  [a, P.yN(a) - 1],
  [a - 0.2, P.yN(a) + 0.7],
  [a - 0.45 * len, P.yN(a - 0.45 * len) + 0.92 * h],
  [a - len, P.yN(a - len) + h],
  [a - 0.55 * len, P.yN(a - 0.55 * len) + 0.42 * h],
  [a - 2.6, P.yN(a - 2.6) - 1],
];

/**
 * 一列鬃束（沿中線頂從 x1 往後到 x0，每 step 一束，彼此交疊）
 * @type {(x1: number, x0: number, step: number, len: number, h: (x: number) => number, zc: number, thick: number, tiltDeg: number) => THREE.BufferGeometry}
 */
const maneRow = (x1, x0, step, len, h, zc, thick, tiltDeg) => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (let a = x1; a >= x0 - 1e-6; a -= step) {
    geos.push(finPlate(maneStrand(a, len, h(a)), zc, thick, tiltDeg));
  }
  return mergeGeos(geos);
};

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-sleipnir-stride',
  name: '八足神駒',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'sleipnir',
  form: 'strider',
  roof: 'canopy',
  wing: 'mane-crest',
  theme: '修長前高後低的奔馬身：背脊升起成抽象短馬頸與低垂馬頭、中段座艙罩、銀色頸鬃與往後升高的鬃冠尾翼；兩側前後輪之間各 4 條往後斜的石灰岩色腿浮雕（共 8 條腿）、斑點灰上身＋深藍灰下身',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面：脊 / 頸側稜（2）與腰線（6）為銳利稜線
  hard: [2, 6],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 30 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 30 },
  ],
  canopy: CANOPY,
  // 座艙罩底下的殼面開口（罩緣內 0.8 mm）：透過煙燻罩看得到底盤，也不讓罩底多一層殼面
  openings: [{ id: '座艙罩底開口', shape: 'fn', sd: (x, y, z) => (y < 30 ? 10 : Math.abs(z) - (canopyHalfW(x) - 0.8)) }],
  sideZMin: 30,
  zones: () => [
    // 鼻端深藍灰
    { mat: 'slate', keep: (x) => x - 73.2 },
    // 下半身（腰線以下）深藍灰
    { mat: 'slate', keep: (x, y) => (isLower(x, y) ? 1 : -1) },
    // 上半身斑點灰
    { mat: 'grey', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'slate', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];

    // ── 頸鬃：沿馬頸頂（x 61 → 39）每 3.2 mm 一束、彼此交疊的細長刀形鬃，往後順梳 7 mm，鬃高 2.2–3.0 mm（厚 1.3，根部埋進頸頂 1 mm）──
    parts.push({
      geometry: maneRow(61, 39, 3.2, 7, (x) => lerp(2.2, 3.0, (x - 39) / 22), 0, 1.3, 0),
      mat: 'silver',
      solid: true,
      outline: true,
      name: 'neck-mane',
    });
    // ── 鬃冠尾翼（mane-crest）：座艙後方背脊（x −34 → −72）三列交疊的長鬃束（中列 + 兩側外傾 16° 的短列），往後越來越高（中列最高約 8.6 mm），鬃尖往後順梳、不超出車尾 ──
    {
      /** @type {(x: number) => number} 鬃冠高度：前端 1.6 → x −62 起 8.6 */
      const crestH = (x) => lerp(1.6, 8.6, Math.pow(Math.min(1, (-34 - x) / 28), 1.2));
      parts.push({
        geometry: mergeGeos([
          maneRow(-34, -62, 4, 10, crestH, 0, 1.3, 0),
          maneRow(-44, -58, 7, 9, (x) => 0.68 * crestH(x), -1.9, 1.1, 16),
          maneRow(-44, -58, 7, 9, (x) => 0.68 * crestH(x), 1.9, 1.1, -16),
        ]),
        mat: 'silver',
        solid: true,
        outline: true,
        name: 'mane-crest-wing',
      });
    }

    // ── 八條腿（每側 4 條）：側壁下半的斜向浮雕條（厚 1.2，外凸約 0.8 mm），從腰線下往後下斜到蹄尖（略低於側裙）；
    //    每條腿有膝彎（上段較直、下段往後斜）與略寬的蹄 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const legs = [];
      for (const x0 of LEG_XS) {
        const knee = [x0 - 1.6, 19.5];
        const hoof = [x0 - 5.4, LEG_Y1];
        /** @type {number[][]} 側視多邊形（順時針）：前緣往下、蹄、後緣往上 */
        const pts = [
          [x0 + 1.4, LEG_Y0],
          [knee[0] + 1.0, knee[1]],
          [hoof[0] + 1.2, hoof[1] + 1.1],
          [hoof[0] + 1.0, hoof[1]],
          [hoof[0] - 1.3, hoof[1]],
          [hoof[0] - 0.9, hoof[1] + 1.4],
          [knee[0] - 0.9, knee[1] + 0.4],
          [x0 - 1.4, LEG_Y0],
        ];
        for (const sg of [-1, 1]) {
          const zc = sg * (P.hw(x0 - 2.5) - 0.5);
          legs.push(finPlate(pts, zc, 1.2));
        }
      }
      parts.push({ geometry: mergeGeos(legs), mat: 'stone', solid: true, outline: true, name: 'eight-legs' });
    }

    // 輪拱內襯（前後，31 mm 大輪拱）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(kit, a))), mat: 'liner', shell: true, name: 'arch-liners' });
    // 輪拱擋泥唇（深藍灰細唇 R0.55，沿側壁上的輪拱切口）
    {
      /** @type {THREE.BufferGeometry[]} */
      const lips = [];
      for (const arch of ARCHES) {
        for (const sg of [-1, 1]) {
          /** @type {number[][]} */
          const pts = [];
          const r = arch.radius + 0.5;
          for (let i = 0; i <= 64; i++) {
            const t = 0.02 + ((Math.PI - 0.04) * i) / 64;
            const x = arch.x + r * Math.cos(t);
            const y = arch.y + r * Math.sin(t);
            if (y < P.yLow(x) + 2.5 || y > ySideAt(x) - 0.4) {
              continue;
            }
            pts.push([x, y, sg * (P.hw(x) - 0.3)]);
          }
          if (pts.length > 3) {
            lips.push(sweepEllipse(pts, 60, () => [0.55, 0.55], 10));
          }
        }
      }
      parts.push({ geometry: mergeGeos(lips), mat: 'slate2', solid: true, outline: true, name: 'arch-lips' });
    }

    // ── 貼紙 ──
    // 斑點灰：上半身淺色小圓環（後半身密、往前漸稀；避開馬頸、馬頭、背脊與座艙）
    parts.push({
      geometry: kit.decal((x, y, z) => (!isLower(x, y) && x < 44 && Math.abs(z) > P.nw(x) + 1.4 && kit.underCanopy(x, z) < 0 ? dappleRing(x, y, z) : -1)),
      mat: 'dSpot',
      name: 'decal-dapple-spots',
    });
    // 兩股絞繩紋（深色刻線 0.6 mm）：腰線上方 1.8 mm 沿肩走，兩條相位差半週期的正弦
    /** @type {(u: number, v: number) => number} u = 往車頭為正的 x */
    const cable = (u, v) => {
      const yc = ySideAt(u) + 1.9;
      const a = 0.75;
      const k = (2 * Math.PI) / 5.2;
      const d1 = Math.abs(v - (yc + a * Math.sin(k * u)));
      const d2 = Math.abs(v - (yc - a * Math.sin(k * u)));
      return Math.max(Math.min(d1, d2) - 0.3, u - 58, -62 - u, 1.2 - archRingDist(u, v));
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(cable, { x0: 0, y0: 0, zMin: 30, side: 1 })),
        kit.decal(sideDecal((u, v) => cable(-u, v), { x0: 0, y0: 0, zMin: 30, side: -1 })),
      ]),
      mat: 'dIncise',
      name: 'decal-cable-band',
    });
    // 圖像石框線：側壁下緣上方一道石灰岩色細線（0.7 mm），避開輪拱與腿
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        return Math.min(0.35 - Math.abs(y - (P.yLow(x) + 3.2)), archRingDist(x, y) - 1.4, x + 64, 66 - x);
      }),
      mat: 'dStone',
      name: 'decal-frame-line',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：殼 x −74 → 76（鬃冠尖 −74.1）、背 27（車尾）→ 臀 36.4 / 腰 32.6 / 肩 36.8、頸頂 51.6、頸鬃尖約 53.8、座艙罩頂約 44；半寬：臀與肩 48.5、腰 36.8（蓋住輪胎與底盤側面）；SPEC 1.14a 車殼外框長 ≤ 153 mm',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin / trojan），cutZFrom 30；輪拱內襯從側壁內面往內 3.5 mm；深藍灰擋泥唇 R0.55',
    legs: '八條腿：《散文埃達》「he has eight feet」（MYTH_RESEARCH N12）、哥特蘭圖像石的八足馬（N9、N10、N11）；每側 4 條浮雕腿（厚 1.2 mm 實心 ABS），蹄尖 y 11（離地，高於底盤側框 9.4），位置與角度自訂',
    mane: '頸鬃與鬃冠尾翼為實心 ABS 刀形鬃束板（厚 1.1–1.3 mm，鬃束彼此交疊處體積重複計入，偏保守），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    color: '灰色：原典「grey foal with eight legs」（N12）；石灰岩米白：Tjängvide 圖像石材質（N10）；斑點、藍灰、銀為自創',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 也會傳遞 mythSeries / mythTheme；這裡再補一次，和其他神話款一致
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const sleipnirStrideBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
