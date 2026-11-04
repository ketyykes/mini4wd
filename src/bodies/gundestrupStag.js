// Gundestrup 雄鹿（body-gundestrup-stag，第八階段神話組・凱爾特）：丹麥 Gundestrup 銀釜（銀為主、局部鍍金、repoussé 錘起）上的雄鹿。
// 修長的鹿身：前輪上方是隆起的寬肩（鬐甲最高點），背線往後緩降到臀部，車頭收窄成長鹿吻；中段一個煙燻座艙罩；
// 車尾從後段車頂長出一對多叉、左右不對稱、自然彎曲的鹿角（實體件，鍍金角尖），兩支角根分開、不形成 Y 字剖面（MYTH_RESEARCH H7）；
// 鹿吻外圍一圈扭絞金 torc（兩端圓球頭，C8）；側面一道 La Tène 單向 S 形卷鬚紋（金，C7）與紅琺瑯圓點（C4 的紅琺瑯，只取顏色）。
// 設計：shared/design/body-gundestrup-stag/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 5 節 C1、C2、C7、C8；黑名單 5-3、第 10 節）。剖面為本檔站位產生器（推估）。
// 不畫神的人臉、不做盤腿坐像、不用三臂 triskele、不做圓內十字、不重現 Battersea 盾的琺瑯格；不做彩色發光鹿角；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, sdCircle } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 臀部（車尾）x */
const X_TAIL = -68;
/** @type {number} 鹿吻鼻尖 x */
const X_NOSE = 80;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-68, -62, -57, -52, -40, -28, -22, -14, 0, 8, 16, 22, 30, 40, 50, 56, 60, 64, 68, 72, 76, 80];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬（俯視）：細尖的臀部 → 寬厚的後腿（47–48，罩住後輪）→ 細腰 30（座艙段；坐在底盤側壁 z 35 內側上方）→ 隆起的前胸 / 肩 48（x 22）→ 前輪 40 → 頸部收窄 19 → 鹿頭兩頰 22 → 鹿吻
  hw: monoCurve(XS, [4, 10, 36, 48, 48, 47, 43, 30, 30, 32, 38, 48, 46, 40, 40, 40, 32, 24, 19, 22, 18, 12]),
  // 中線頂（背線）：臀部 29 → 臀頂 37 → 背部低處 35（座艙罩）→ 鬐甲（肩峰）42 → 頸、額往前下到鼻尖 21.5
  yTop: monoCurve(XS, [29, 33.5, 35.5, 36.5, 37, 36.5, 36, 35, 35.5, 36.5, 38.5, 40, 42, 41.5, 39, 36.5, 34, 30.5, 27.5, 25.5, 23.5, 21.5]),
  // 剖面最寬處的高度
  ySh: monoCurve(XS, [24, 24, 23, 22.5, 22, 22, 22, 21.5, 21.5, 21.5, 21.5, 22, 22.5, 22.5, 22.5, 22, 21.5, 21, 20.5, 20, 19.5, 19]),
  // 側裙下緣：中段 11（底盤側框段由 loft.js 自動讓到 9.9），臀部抬高離開後導輪，鹿吻下緣往上收
  yLow: monoCurve(XS, [22, 19, 15, 13, 12, 12, 11.5, 11, 11, 11, 11, 11.5, 12, 12, 12, 12.5, 13, 14, 15, 16, 17, 18]),
};

/** @type {number} 上半斷面超橢圓指數（< 1 = 比橢圓飽滿的鹿背） */
const SE = 0.8;
/** @type {number[]} 上半斷面 6 點的角度（度） */
const ANGLES = [90, 70, 50, 32, 16, 0];

/**
 * 半剖面 8 點：上半超橢圓（中線頂 → 最寬處）＋側裙兩點（往下微收）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = P.hw(x);
  const ySh = P.ySh(x);
  const ry = Math.max(0.8, P.yTop(x) - ySh);
  const yLow = P.yLow(x);
  const pts = ANGLES.map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [hw * Math.cos(a) ** SE, ySh + ry * Math.sin(a) ** SE];
  });
  pts.push([hw * 0.985, ySh - 0.5 * (ySh - yLow)], [hw - Math.min(1.4, 0.1 * hw), yLow]);
  return pts;
};

/** @type {{ x: number, pts: number[][] }[]} 站位表（鼻尖與臀部曲率大的段落加密） */
const STATIONS = [...buildStations(X_TAIL, -56, 1, profile).slice(0, -1), ...buildStations(-56, 64, 1.5, profile).slice(0, -1), ...buildStations(64, X_NOSE, 1, profile)];

/**
 * 某高度的殼外面 |z|（超橢圓反解；最寬處以下視為最寬處）
 * @type {(x: number, y: number) => number}
 */
const shellZ = (x, y) => {
  const hw = P.hw(x);
  const ySh = P.ySh(x);
  const ry = Math.max(0.8, P.yTop(x) - ySh);
  const q = (y - ySh) / ry;
  if (q <= 0) {
    return hw;
  }
  if (q >= 1) {
    return 0;
  }
  const s = q ** (1 / SE);
  return hw * Math.sqrt(1 - s * s) ** SE;
};

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 輪拱（R17.5 = 31 mm 輪半徑 15.5 + 2；只切側面） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 32 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 32 },
];

/**
 * 輪拱內襯：輪拱切口後面的一段圓柱面（只取上半圈），z 從殼內面往內 depth（不小於 minZ）
 * @type {(arch: { x: number, y: number, radius: number }, depth: number, minZ: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth, minZ) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.15;
  const a1 = Math.PI - 0.15;
  const pos = [];
  /** @type {(t: number) => number} */
  const zIn = (t) => shellZ(arch.x + r * Math.cos(t), arch.y + r * Math.sin(t)) - 1.0;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      /** @type {(t: number, z: number) => number[]} */
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, Math.max(minZ, zIn(t0) - depth));
      const B = p(t1, Math.max(minZ, zIn(t1) - depth));
      const C = p(t1, zIn(t1));
      const D = p(t0, zIn(t0));
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
 * La Tène 單向卷鬚（running scroll）：沿 x 的波浪主線，每個波峰 / 波谷各接一個往同一方向捲的小卷圈（全部同向，不做三臂旋轉）
 * 回傳 { line: 線條距離, boss: 卷圈中心紅琺瑯圓點距離 }；u 往車頭、v 往上（以帶中線為 0）
 * @type {(u: number, v: number) => { line: number, boss: number }}
 */
const scrollSd = (u, v) => {
  const period = 11;
  const amp = 2.2;
  const k = (2 * Math.PI) / period;
  // 波浪主線（用斜率修正近似成等寬線）
  const yw = amp * Math.sin(k * u);
  const slope = amp * k * Math.cos(k * u);
  const wave = Math.abs(v - yw) / Math.sqrt(1 + slope * slope) - 0.33;
  // 卷圈：每半週期一個，圓心在波峰 / 波谷內側往前 1.6 mm，半徑 1.5；只畫 300° 的開口圓（開口朝波線，像卷鬚收尾）
  let curl = Infinity;
  let boss = Infinity;
  const j0 = Math.floor(u / (period / 2));
  for (let j = j0 - 1; j <= j0 + 1; j++) {
    const up = j % 2 === 0 ? 1 : -1;
    const cu = j * (period / 2) + period / 4 + 1.6;
    const cv = up * (amp - 1.5);
    const du = u - cu;
    const dv = v - cv;
    const ang = Math.atan2(dv * up, -du);
    const ring = Math.abs(Math.hypot(du, dv) - 1.5) - 0.33;
    // 開口：朝波線那一側（ang 接近 0）留 60° 不畫
    curl = Math.min(curl, Math.abs(ang) < Math.PI / 6 ? Infinity : ring);
    boss = Math.min(boss, Math.hypot(du, dv) - 0.55);
  }
  return { line: Math.min(wave, curl), boss };
};

/** @type {{ x0: number, x1: number, y: number }} 卷鬚紋帶：前後輪拱之間、腰側（側視） */
const SCROLL = { x0: -13.5, x1: 15.5, y: 18.6 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 銀（真金屬：名稱含 -alu，Blender 換金屬）＝ Gundestrup 銀釜的錘起銀板
  silver: namedMaterial('trim-silver-alu', { color: 0xc0c3c7, roughness: 0.3, metalness: 0.85, clearcoat: 0.2 }),
  silver2: namedMaterial('trim-silver-alu', { color: 0xc0c3c7, roughness: 0.3, metalness: 0.85, clearcoat: 0.2, side: THREE.DoubleSide }),
  // 腹側暗銀（氧化的舊銀，霧面）
  patina: namedMaterial('paint-oxidized-silver-matte', { color: 0x4a4d52, roughness: 0.62, clearcoat: 0.05 }),
  patina2: namedMaterial('paint-oxidized-silver-matte', { color: 0x4a4d52, roughness: 0.62, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 鍍金（真金屬：-brass 結尾）
  gilt: namedMaterial('trim-gilt-brass', { color: 0xc9a43b, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 紅琺瑯（亮面，全車少數的高光澤非金屬部位）
  enamel: namedMaterial('paint-enamel-red', { color: 0xb0302b, roughness: 0.22, clearcoat: 1.0 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1b1c1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-patina', { color: 0x3a3c40, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x16171a, roughness: 0.85, side: THREE.DoubleSide }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x2e3238, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  // 鹿眼：Gundestrup 人物眼睛嵌玻璃（C1）→ 深藍玻璃眼
  eye: namedMaterial('lamp-eye-glass', { color: 0x1d2a44, emissive: 0x0a1222, emissiveIntensity: 0.3, roughness: 0.06, clearcoat: 1.0 }),
  dGold: decalMaterial('decal-gilt', { color: 0xc9a43b, roughness: 0.32, metalness: 0.7 }),
  dRed: decalMaterial('decal-enamel-red', { color: 0xb0302b, roughness: 0.25 }),
  dDark: decalMaterial('decal-niello-dark', { color: 0x2a2c30, roughness: 0.5 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-patina', { color: 0x34373b, roughness: 0.7, side: THREE.DoubleSide }),
});

/**
 * 鹿角（右支，z > 0；左支另給一組參數）：主幹沿 4 個控制點的曲線從車頂往後上方張開，
 * tines 為從主幹某參數位置長出的分叉：[t, dx, dy, dz]（分叉尖相對分叉點的位移）
 * @typedef {{ beam: number[][], tines: number[][] }} AntlerDef
 */

/** @type {AntlerDef} 右角：4 個分叉（眉叉往前上、第二叉、第三叉、頂端分叉） */
const ANTLER_R = {
  beam: [
    [-29, 0, 9],
    [-35, 46, 14.5],
    [-46, 54.5, 21],
    [-56.5, 59, 26],
    [-63, 61, 28.5],
  ],
  tines: [
    [0.16, 6.5, 5.5, 2.5],
    [0.36, 3.5, 7.5, 4],
    [0.6, 0.5, 6.5, 5.5],
    [0.84, -1.5, 3.8, 6.5],
  ],
};
/** @type {AntlerDef} 左角：3 個分叉，角度與長度都和右角不同（自然鹿角的不對稱） */
const ANTLER_L = {
  beam: [
    [-29, 0, 9],
    [-36, 47, 15.5],
    [-47.5, 55.5, 22.5],
    [-57.5, 59.5, 27.5],
    [-64, 60.5, 31],
  ],
  tines: [
    [0.2, 7.5, 4.5, 1.5],
    [0.46, 2.5, 8, 5],
    [0.74, -0.5, 5.5, 7],
  ],
};

export const gundestrupStagBody = makePolyBody({
  id: 'body-gundestrup-stag',
  name: 'Gundestrup 雄鹿',
  style: 'myth',
  phase: 8,
  mythSeries: 'celtic',
  mythTheme: 'gundestrup-stag',
  form: 'stag-arch',
  roof: 'canopy',
  wing: 'antler-crown',
  theme: 'Gundestrup 銀釜上的雄鹿：寬肩隆起、背線後降的修長銀色鹿身，長鹿吻套一圈扭絞金 torc，車尾一對多叉不對稱的鍍金尖鹿角，側面 La Tène 單向卷鬚紋',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面，沒有銳利稜線（錘起的銀板）
  hard: [],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 中段座艙罩：x 12 → −22，最寬 12、最高 7（罩頂約 42）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(12, -22, u);
        const halfW = i === 0 || i === n ? 2.5 : 12 * Math.sin(Math.PI * u ** 0.9) ** 0.5;
        const rise = 7 * Math.sin(Math.PI * u ** 0.85) ** 0.6;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 24,
  zones: () => [
    // 腹側暗銀（最寬處往下 2 mm 起）
    { mat: 'patina', keep: (x, y) => P.ySh(x) - 2 - y },
    { mat: 'silver', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'patina2', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number) => number} 中線頂面高度 */
    const top = (x) => kit.surf.topY(x, 0);

    // 輪拱內襯：後輪在寬後腿下方（殼面離輪胎較遠，內襯較深），前輪較淺
    parts.push({
      geometry: mergeGeos([buildLiner(ARCHES[0], 3, 35.6), buildLiner(ARCHES[1], 7, 35.6)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });

    // 鹿角（實體件、外形件）：主幹銀、分叉的末段鍍金；角根埋進車頂 0.8 mm
    /** @type {(def: AntlerDef, sg: number) => { silver: THREE.BufferGeometry[], gold: THREE.BufferGeometry[] }} */
    const buildAntler = (def, sg) => {
      const beamPts = def.beam.map(([x, y, z], i) => [x, i === 0 ? top(x) - 0.8 : y, sg * z]);
      const curve = new THREE.CatmullRomCurve3(
        beamPts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        false,
        'centripetal',
      );
      /** @type {(t: number) => number} 主幹半徑（根粗 2.0 → 末端 1.0；直徑 4 → 2 mm，射出件可成形） */
      const beamR = (t) => lerp(2.0, 1.0, t);
      const silver = [];
      const gold = [];
      // 主幹：t 0 → 0.86 銀、0.86 → 1 鍍金
      const split = 0.86;
      /** @type {(t0: number, t1: number, n: number) => number[][]} */
      const sample = (t0, t1, n) => {
        const out = [];
        for (let i = 0; i <= n; i++) {
          const p = curve.getPointAt(lerp(t0, t1, i / n));
          out.push([p.x, p.y, p.z]);
        }
        return out;
      };
      silver.push(sweepEllipse(sample(0, split, 16), 40, (t) => [beamR(t * split), beamR(t * split)], 12));
      gold.push(sweepEllipse(sample(split, 1, 4), 10, (t) => {
        const r = lerp(beamR(split), 0.45, t);
        return [r, r];
      }, 12));
      // 分叉：從主幹點往外彎（二次曲線，控制點在中段往外側偏 1.5 mm），末 40% 鍍金
      for (const [t, dx, dy, dz] of def.tines) {
        const p0 = curve.getPointAt(t);
        const r0 = beamR(t) * 0.82;
        const tip = [p0.x + dx, p0.y + dy, p0.z + sg * dz];
        const ctrl = [p0.x + dx * 0.45, p0.y + dy * 0.6, p0.z + sg * (dz * 0.45 + 1.5)];
        /** @type {(s: number) => number[]} 二次 Bezier */
        const bez = (s) => [0, 1, 2].map((c) => (1 - s) ** 2 * [p0.x, p0.y, p0.z][c] + 2 * (1 - s) * s * ctrl[c] + s * s * tip[c]);
        const cut = 0.6;
        const a = [];
        for (let i = 0; i <= 6; i++) {
          a.push(bez((cut * i) / 6));
        }
        const b = [];
        for (let i = 0; i <= 4; i++) {
          b.push(bez(cut + ((1 - cut) * i) / 4));
        }
        silver.push(sweepEllipse(a, 12, (s) => {
          const r = lerp(r0, r0 * 0.62, s);
          return [r, r];
        }, 10));
        gold.push(sweepEllipse(b, 8, (s) => {
          const r = lerp(r0 * 0.62, 0.4, s);
          return [r, r];
        }, 10));
      }
      return { silver, gold };
    };
    const right = buildAntler(ANTLER_R, 1);
    const left = buildAntler(ANTLER_L, -1);
    parts.push({ geometry: mergeGeos([...right.silver, ...left.silver]), mat: 'silver2', solid: true, outline: true, name: 'antlers' });
    parts.push({ geometry: mergeGeos([...right.gold, ...left.gold]), mat: 'gilt', solid: true, outline: true, name: 'antler-tips' });

    // 鹿吻外圍的扭絞 torc（C8）：沿 x 62 → 65 的殼面外 0.9 mm 繞過鹿吻上方，兩端在側裙下緣上方收成圓球頭；
    // 斷面半徑沿弧長週期起伏（14 個扭節），像扭絞金條
    /** @type {number[][]} */
    const torcPts = [];
    const o = [0, 0];
    const nT = 40;
    for (let i = 0; i <= nT; i++) {
      const s = lerp(-0.8, 0.8, i / nT);
      // 頂部往前傾：中線處 x 65、兩側末端 x 62
      const x = lerp(65, 62, Math.abs(s) / 0.8);
      kit.surf.eval(x, s, o);
      const y = o[0];
      const z = o[1];
      // 沿斷面外法線（近似：從斷面中心 (0, ySh) 往外）偏移
      const cy = P.ySh(x);
      const len = Math.hypot(z, y - cy) || 1;
      torcPts.push([x, y + ((y - cy) / len) * 0.9, z + (z / len) * 0.9]);
    }
    const torc = sweepEllipse(torcPts, 120, (t) => {
      const r = 0.95 + 0.22 * Math.cos(t * 28 * Math.PI);
      return [r, r];
    }, 12);
    const balls = [torcPts[0], torcPts[torcPts.length - 1]].map(([x, y, z]) => {
      const b = new THREE.SphereGeometry(1.75, 20, 14);
      b.translate(x, y, z);
      return b;
    });
    parts.push({ geometry: mergeGeos([torc, ...balls]), mat: 'gilt', solid: true, outline: true, name: 'torc' });

    // 鹿眼：金色眼圈＋深藍玻璃眼（鹿吻側面）
    /** @type {{ x: number, y: number }} 鹿眼中心（側視） */
    const EYE = { x: 69.5, y: 23.6 };
    /** @type {(x: number, y: number, z: number) => number} 到鹿眼中心的側視距離（只在側面） */
    const eyeD = (x, y, z) => (Math.abs(z) < 8 ? 10 : Math.hypot(x - EYE.x, y - EYE.y));
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(eyeD(x, y, z) - 1.7, 2.45 - eyeD(x, y, z))), mat: 'dGold', name: 'decal-eye-ring' });
    parts.push({ geometry: kit.decal((x, y, z) => 1.7 - eyeD(x, y, z), { offset: 0.1 }), mat: 'eye', name: 'lamp-eye' });
    // 鼻鏡：鼻尖一小片暗色
    parts.push({ geometry: kit.decal((x) => x - 77.6), mat: 'dDark', name: 'decal-muzzle' });

    // 背線：鬐甲到臀部的一道鍍金細線（repoussé 銀板的鍍金脊）
    parts.push({
      geometry: kit.decal((x, y, z) => (x > 30 || x < -64 || (x > -24 && x < 14) ? -1 : 0.45 - Math.abs(z))),
      mat: 'dGold',
      name: 'decal-dorsal-line',
    });

    // 側面 La Tène 單向卷鬚紋帶（金）＋卷圈中心紅琺瑯圓點：前後輪拱之間的腰側，車兩側都朝同一方向（往車頭）
    /** @type {(x: number, y: number, z: number) => { line: number, boss: number } | null} */
    const scrollAt = (x, y, z) => (Math.abs(z) < 26 || x < SCROLL.x0 || x > SCROLL.x1 ? null : scrollSd(x, y - SCROLL.y));
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const r = scrollAt(x, y, z);
        return r ? -r.line : -1;
      }),
      mat: 'dGold',
      name: 'decal-la-tene-scroll',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const r = scrollAt(x, y, z);
        return r ? -r.boss : -1;
      }),
      mat: 'dRed',
      name: 'decal-enamel-bosses',
    });
    // 卷鬚紋帶上下兩道鍍金細邊
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < 26 || x < SCROLL.x0 - 1 || x > SCROLL.x1 + 1 ? -1 : 0.32 - Math.abs(Math.abs(y - SCROLL.y) - 4.6))),
      mat: 'dGold',
      name: 'decal-scroll-borders',
    });
    // 肩部（前輪拱上方）一道沿拱弧的鍍金細線＋三個紅琺瑯圓點（錘起的肩肌輪廓）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 36 || x < 18 || x > 62) {
          return -1;
        }
        return 0.33 - Math.abs(Math.hypot(x - 40, y - 13) - 20.6);
      }),
      mat: 'dGold',
      name: 'decal-shoulder-line',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 36) {
          return -1;
        }
        let d = Infinity;
        for (const a of [0.55, 1.57, 2.59]) {
          d = Math.min(d, sdCircle(40 + 23 * Math.cos(a), 13 + 23 * Math.sin(a), 0.9)(x, y));
        }
        return -d;
      }),
      mat: 'dRed',
      name: 'decal-shoulder-enamel',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）；座艙罩同厚度，以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：殼長 148（臀部 x −68 → 鼻尖 80，≤ 153 不刮立體橋）、鬐甲高 42、鹿角尖約 63.7；後腿半寬 47–48、前胸 48（x 22）、前輪 40、細腰 30（x −14 → 8，側裙下緣 y 11 在底盤側框上緣 9.4 之上）、頸 19、鹿頭兩頰 22；俯視平面依輪廓 IoU 掃描決定（和既有款拉開到 0.83 以下）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），切口從 |z| 32 起；前輪內襯深 3、後輪 7 mm',
    antlers: '鹿角主幹半徑 2.0 → 1.0、分叉 1.6 → 0.4，ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；兩支角根分開（z ±9），各 3–4 個分叉、角度與長度左右不同，不形成 Y 字剖面（MYTH_RESEARCH H7）',
    torc: '扭絞 torc 斷面半徑 0.95 ± 0.22（14 個扭節）、兩端圓球 R1.75，ABS 實心件（推估）',
    myth: 'Gundestrup 銀釜：銀為主、鍍金、repoussé、人物眼睛嵌玻璃（MYTH_RESEARCH C1）；分叉鹿角與 torc（C2、C8）；La Tène 捲曲曲線（C7，只用單向 S 形卷鬚，不用三臂 triskele）；紅琺瑯色取自 C4（不重現其琺瑯格）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
