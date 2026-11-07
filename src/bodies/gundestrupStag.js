// Gundestrup 銀釜（body-gundestrup-stag，神話組・凱爾特）：丹麥 Gundestrup 銀釜——銀為主、局部鍍金、repoussé 錘起的銀板、嵌玻璃。
// 車上不做鹿：主題用「銀釜」「torc 頸環」「鹿角的分叉線」三種元素表現。
// 造型（F3 半罩露輪）：鼻端一路下壓的銀色楔形尖鼻，前輪罩切開一個圓弧開口（釜口的弧）露出前輪，開口外圍一圈鍍金邊與鉚釘；
// 中段深藍玻璃座艙罩外面套一圈扭絞金 torc（開口朝前、兩端圓球頭，C8）；
// 車尾一片拋光銀大翼，兩端是鍍金的四叉翼端板（鹿角的分叉抽象成端板後緣的四道叉，C2）。
// 塗裝：錘起銀板＋腹側氧化暗銀；鼻尖往後掃、接到 torc 圓球頭的兩道鍍金條紋、頂面兩道鉚接板縫；側面一條氧化暗底的浮雕帶，
// 上面是 La Tène 單向波卷紋與圓泡釘（C7）。
// 設計：shared/design/body-gundestrup-stag/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 5 節 C1、C2、C7、C8；黑名單 5-3、第 10 節）。剖面為本檔站位產生器（推估）。
// 不畫神的人臉、不做盤腿坐像、不畫動物、不用三臂 triskele、不做圓內十字、不重現 Battersea 盾的琺瑯格；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -68;
/** @type {number} 鼻尖 x */
const X_NOSE = 80;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-68, -62, -57, -52, -40, -28, -22, -14, 0, 8, 16, 22, 30, 40, 50, 56, 60, 64, 68, 72, 76, 80];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬（俯視）：收尖的車尾 → 罩住後輪的寬後擋泥板（45.5）→ 細腰 27.5（座艙段；坐在底盤側壁 z 35 內側上方）→ 前輪上方的肩 45（x 30）
  // → 往前直線收成楔形尖鼻（鼻尖 3.5）。最寬 45.5（車殼外框半寬 ≤ 48.0）
  hw: monoCurve(XS, [4, 10, 34, 45, 45.5, 44.5, 41, 30.5, 27.5, 29, 35.5, 44, 45, 42, 36, 30, 25.5, 21, 16.6, 12.4, 8, 3.5]),
  // 中線頂：車尾 27 → 後段 34.5 → 座艙段 34 → 前輪後上方的肩 35.2 → x 40 之後以固定斜率一路下壓到鼻尖 14.6（V3 楔形尖鼻、重心前壓）
  yTop: monoCurve(XS, [27, 31, 33, 34, 34.5, 34.5, 34.3, 34, 34, 34.3, 34.8, 35.2, 35.2, 33.6, 30.2, 27.6, 25.6, 23.4, 21.2, 19, 16.8, 14.6]),
  // 剖面最寬處的高度：鼻段跟著鼻尖往下收（22 → 14），鼻端是低而扁的楔形
  ySh: monoCurve(XS, [24, 24, 23, 22.5, 22, 22, 22, 21.5, 21.5, 21.5, 21.5, 22, 22.5, 22.5, 21.6, 20.4, 19.4, 18.2, 17.2, 16.2, 15.2, 14]),
  // 側裙下緣：中段 11（底盤側框段由 loft.js 自動讓到 9.9），車尾抬高離開後導輪，鼻段下緣 13（在底盤前保險桿之上，以 body-check 間隙驗證）
  yLow: monoCurve(XS, [22, 19, 15, 13, 12, 12, 11.5, 11, 11, 11, 11, 11.5, 12, 12, 12, 12.2, 12.4, 12.6, 12.8, 13, 13, 13]),
};

/** @type {number} 上半斷面超橢圓指數（< 1 = 比橢圓飽滿，像錘起的銀板） */
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

/** @type {{ x: number, pts: number[][] }[]} 站位表（鼻尖與車尾曲率大的段落加密） */
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

/**
 * 輪拱（R17.5 = 31 mm 輪半徑 15.5 + 2）：後輪只切側面（|z| ≥ 32，上方是完整的後擋泥板）；
 * 前輪從 |z| 23.5 起切（楔形鼻在前輪前方比輪胎外側面窄，鼻側的殼面要整圈讓開輪胎）
 * @type {{ x: number, y: number, radius: number, cutZFrom: number }[]}
 */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 32 },
];

/** @type {{ cx: number, cy: number, a: number, b: number, tilt: number }} 前輪半罩開口（側視斜橢圓：長軸由後下往前上傾 50°） */
const FRONT_CUT = { cx: 39, cy: 22, a: 17, b: 14, tilt: (50 * Math.PI) / 180 };
/** @type {number} 前輪半罩開口只切 |z| ≥ 這個值（輪胎內側面 22.75 之外） */
const FRONT_CUT_Z = 26;

/**
 * 側視座標轉到斜橢圓的主軸座標 [u, v]
 * @type {(x: number, y: number) => number[]}
 */
const frontCutUV = (x, y) => {
  const { cx, cy, tilt } = FRONT_CUT;
  const dx = x - cx;
  const dy = y - cy;
  return [dx * Math.cos(tilt) + dy * Math.sin(tilt), -dx * Math.sin(tilt) + dy * Math.cos(tilt)];
};

/**
 * 前輪半罩開口的側視距離近似（負值 = 開口內）
 * @type {(x: number, y: number) => number}
 */
const frontCutSide = (x, y) => {
  const [u, v] = frontCutUV(x, y);
  return (Math.hypot(u / FRONT_CUT.a, v / FRONT_CUT.b) - 1) * FRONT_CUT.b;
};

/**
 * F3 半罩露輪：前輪罩切開一個斜橢圓開口——上緣是一條從前輪拱前上方往後下方掠的圓弧（釜口的弧），和輪拱圓周接成往後掠的半罩開口，
 * 從側面與上方都看得到前輪胎面。負值 = 開口內
 * @type {(x: number, y: number, z: number) => number}
 */
const frontCutSd = (x, y, z) => {
  if (Math.abs(z) < FRONT_CUT_Z) {
    return 10;
  }
  return Math.max(12 - y, frontCutSide(x, y));
};

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
  // 外緣離殼外面 1.6 mm（解析式 shellZ 和平滑殼面在車頭 / 車尾收窄處差到 0.5 mm，離太近內襯會穿出殼面）
  const zIn = (t) => shellZ(arch.x + r * Math.cos(t), arch.y + r * Math.sin(t)) - 1.6;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      /** @type {(t: number, z: number) => number[]} */
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      // 內緣不得超過外緣（zIn < minZ 的角度若直接取 minZ，內襯會被撐到殼外面之外：前輪拱前緣、後輪拱後緣穿出殼面最多 3.5 mm、
      // 而且四邊形反折、法線朝外——Blender 展示圖輪拱邊上會出現黑白條紋）；至少留 0.6 mm 寬、一律在殼內面以內
      const A = p(t0, Math.min(zIn(t0) - 0.6, Math.max(minZ, zIn(t0) - depth)));
      const B = p(t1, Math.min(zIn(t1) - 0.6, Math.max(minZ, zIn(t1) - depth)));
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

/** @type {number} 浮雕帶波卷紋的週期（mm） */
const SCROLL_PERIOD = 13;
/**
 * 浮雕帶的 La Tène 單向波卷紋（全部是貼紙）：一條連續的波浪莖，每個波谷與波峰裡各抱一顆實心圓泡釘（仿錘起的凸泡；
 * 不做「圓環＋圓心」，那會像眼睛）。u 往車頭、v 往上（帶中線 0）；回傳 [到波浪莖的距離, 到泡釘的距離]
 * @type {(u: number, v: number) => number[]}
 */
const scrollSd = (u, v) => {
  const stem = Math.abs(v - 2.3 * Math.sin((2 * Math.PI * u) / SCROLL_PERIOD)) - 0.6;
  const half = SCROLL_PERIOD / 2;
  const k = Math.round((u - half / 2) / half);
  // 波峰（v > 0）下方、波谷（v < 0）上方各一顆
  const side = k % 2 === 0 ? -1 : 1;
  const r = Math.hypot(u - (half / 2 + k * half), v - side * 1.1);
  return [stem, r - 1.3];
};

/** @type {{ x0: number, x1: number, y: number, h: number }} 浮雕帶：前輪開口後緣到後輪拱之間的腰側（側視），半高 h（不含珠點邊框） */
const FRIEZE = { x0: -20, x1: 19.5, y: 18.6, h: 4.3 };

/**
 * 側面兩道深色凹槽速度線（把銀面分割出速度線）：從前輪拱後上方起、往車尾微微上揚、
 * 尾端漸細收尖；回傳到線中心的距離減半寬（正值 = 線外）。k 為第幾道（0 上、1 下）
 * @type {(x: number, y: number, k: number) => number}
 */
const grooveSd = (x, y, k) => {
  /** @type {number} 線頭（車頭端）x */
  const xa = k === 0 ? 30 : 22;
  /** @type {number} 線尾（車尾端）x；上線從後輪拱頂上方越過，下線停在後輪拱前 */
  const xb = k === 0 ? -62 : -22;
  if (x > xa || x < xb) {
    return 1;
  }
  const u = (xa - x) / (xa - xb);
  const yc = k === 0 ? 29 + 4 * u : 25 + 1.5 * u;
  // 線頭寬 1.5、往後收到 0.35（像被風拉長的刻線）
  const half = lerp(0.75, 0.18, u ** 0.8);
  return Math.abs(y - yc) - half;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 銀（真金屬：名稱含 -alu，Blender 換金屬）＝ Gundestrup 銀釜的錘起銀板
  silver: namedMaterial('trim-silver-alu', { color: 0xc0c3c7, roughness: 0.3, metalness: 0.85, clearcoat: 0.2 }),
  // 腹側暗銀（氧化的舊銀，霧面）
  patina: namedMaterial('paint-oxidized-silver-matte', { color: 0x4a4d52, roughness: 0.62, clearcoat: 0.05 }),
  patina2: namedMaterial('paint-oxidized-silver-matte', { color: 0x4a4d52, roughness: 0.62, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 鍍金（真金屬：-brass 結尾）：torc、四叉翼端板、翼面前後緣
  gilt: namedMaterial('trim-gilt-brass', { color: 0xc9a43b, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 尾翼翼面：不透明拋光銀
  wingSilver: namedMaterial('trim-silver-wing-alu', { color: 0xbcc0c5, roughness: 0.28, metalness: 0.85, clearcoat: 0.2, side: THREE.DoubleSide }),
  // 殼內面：銀釜內側的暗銀灰（前輪開口裡看到的是銀色殼的內側，不是黑塊）
  inner: namedMaterial('shell-inner-silver', { color: 0x7d8086, roughness: 0.55, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-patina', { color: 0x3a3c40, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x16171a, roughness: 0.85, side: THREE.DoubleSide }),
  // 座艙罩：深藍玻璃（銀釜人物眼睛嵌的玻璃，C1；只取材質與顏色）
  glass: namedMaterial('pc-smoke-tint', { color: 0x1d2a44, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.6, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-gilt', { color: 0xc9a43b, roughness: 0.32, metalness: 0.7 }),
  // 浮雕帶凹處的氧化暗部（霧面，近黑）、凸起泡釘的亮銀、烏銀板縫與速度線（藍黑，不用棕黑）
  dRecess: decalMaterial('decal-oxidized-recess', { color: 0x14161a, roughness: 0.75 }),
  dSilver: decalMaterial('decal-relief-silver', { color: 0xd2d3d2, roughness: 0.3, metalness: 0.85 }),
  dGroove: decalMaterial('decal-niello-groove', { color: 0x1a1f29, roughness: 0.55 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-patina', { color: 0x34373b, roughness: 0.7, side: THREE.DoubleSide }),
});

/** @type {{ le: number[], te: number[], thick: number, span: number }} 尾翼翼面（單片大翼，前緣低後緣高；兩端插進翼端板） */
const WING = { le: [-48, 41.6], te: [-64, 43.2], thick: 1.0, span: 38.6 };
/** @type {{ z: number, thick: number, tilt: number }} 翼端板：板底中心 |z|、板厚、往外傾的角度（度） */
const ENDPLATE = { z: 37, thick: 1.4, tilt: 8 };
/**
 * 四叉翼端板的側視多邊形：板根埋進後擋泥板肩部，前緣往後上方掠，後緣分成四道往後指的叉（鹿角的分叉線；
 * 是一片翼端板，不是立著的角）。叉尖最高 47.6（車殼頂高 ≤ 49）
 * @type {number[][]}
 */
const ENDPLATE_PTS = [
  [-33, 29.6],
  [-38.5, 36.5],
  [-45.5, 42.6],
  [-55, 46.6],
  [-67.5, 47.6],
  [-58, 45.3],
  [-69.2, 44.3],
  [-58.6, 42],
  [-68.6, 40.9],
  [-58.2, 38.7],
  [-66.5, 37.4],
  [-56, 35.2],
  [-52, 29.6],
];
/** @type {{ xc: number, a: number, b: number, open: number }} 座艙外圍的 torc：俯視橢圓中心 x、前後半長、半寬、開口半角（度，開口朝前） */
const TORC = { xc: -5, a: 19, b: 13, open: 28 };
/** @type {number[]} 頂面兩道鉚接板縫的 x */
const SEAM_XS = [20, -29];

/** @type {number} torc 兩端圓球頭的位置（x、|z|）：鼻紋的終點 */
const TORC_END = [TORC.xc + TORC.a * Math.cos((TORC.open * Math.PI) / 180), TORC.b * Math.sin((TORC.open * Math.PI) / 180)];
/** @type {number} 鼻紋起點 x（鼻尖後 2 mm） */
const STRIPE_X0 = X_NOSE - 2;
/**
 * 鼻尖往後掃的兩道鍍金條紋：從鼻尖分開、直線接到 torc 兩端的圓球頭（俯視是 V 形走向的貼紙，殼面量體不變）；
 * 回傳某 x 的 [中心 |z|, 半寬]（離鼻尖越遠越寬）
 * @type {(x: number) => number[]}
 */
const noseStripe = (x) => {
  const t = (STRIPE_X0 - x) / (STRIPE_X0 - TORC_END[0]);
  return [TORC_END[1] * t, lerp(0.45, 1.3, t)];
};

export const gundestrupStagBody = makePolyBody({
  id: 'body-gundestrup-stag',
  name: 'Gundestrup 銀釜',
  style: 'myth',
  phase: 8,
  mythSeries: 'celtic',
  mythTheme: 'gundestrup-stag',
  form: 'stag-arch',
  roof: 'canopy',
  wing: 'fork-endplate',
  theme: 'Gundestrup 銀釜的元素（不做鹿）：錘起銀板的楔形尖鼻車身、前輪罩圓弧開口露出前輪（鍍金邊＋鉚釘圈）、深藍玻璃座艙罩外套一圈扭絞金 torc、車尾拋光銀大翼配鍍金四叉翼端板（鹿角的分叉線）；鼻尖接到 torc 的兩道鍍金條紋、鉚接板縫、側面 La Tène 波卷紋與圓泡釘浮雕帶',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面，沒有銳利稜線（錘起的銀板）
  hard: [],
  wheelArches: ARCHES,
  openings: [{ id: '前輪露出圓弧開口', shape: 'fn', sd: frontCutSd }],
  canopy: {
    section: 'ellipse',
    // 中段座艙罩：x 12 → −22，最寬 11、最高 5.2（罩頂約 39.2，小而低的有色座艙 V5）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(12, -22, u);
        const halfW = i === 0 || i === n ? 2.5 : 11 * Math.sin(Math.PI * u ** 0.9) ** 0.5;
        const rise = 5.2 * Math.sin(Math.PI * u ** 0.85) ** 0.6;
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

    // 輪拱內襯：前輪罩已切開露輪，只做後輪（後輪在寬擋泥板下方，殼面離輪胎較遠，內襯深 7 mm）
    parts.push({
      geometry: buildLiner(ARCHES[1], 7, 35.6),
      mat: 'liner',
      shell: true,
      name: 'arch-liner-rear',
    });
    // 輪胎內側的環形擋板（|z| 22.9；離 26 mm 輪內側面 2.4、31 mm 輪 1.9 mm）——擋住從輪拱與前輪開口橫越車身看到另一側地板的視線
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });

    // 尾翼翼面（實體件）：翼斷面沿 z 拉出整個翼展；中段拋光銀，前後緣各 8% 弦長鍍金
    {
      /** @type {(q0: number, q1: number) => number[][]} 弦長 q0 → q1 段的翼斷面多邊形 */
      const section = (q0, q1) => {
        /** @type {number[][]} */
        const up = [];
        /** @type {number[][]} */
        const lo = [];
        for (let i = 0; i <= 6; i++) {
          const q = lerp(q0, q1, i / 6);
          const th = WING.thick * (q < 0.3 ? 0.6 + (0.4 * q) / 0.3 : 1 - (0.7 * (q - 0.3)) / 0.7);
          const x = lerp(WING.le[0], WING.te[0], q);
          const y = lerp(WING.le[1], WING.te[1], q);
          up.push([x, y + 0.6 * th]);
          lo.push([x, y - 0.4 * th]);
        }
        return [...up, ...lo.reverse()];
      };
      parts.push({ geometry: finPlate(section(0.08, 0.92), 0, 2 * WING.span), mat: 'wingSilver', solid: true, outline: true, name: 'rear-wing' });
      parts.push({
        geometry: mergeGeos([finPlate(section(0, 0.08), 0, 2 * WING.span), finPlate(section(0.92, 1), 0, 2 * WING.span)]),
        mat: 'gilt',
        solid: true,
        outline: true,
        name: 'rear-wing-gilt-edges',
      });
    }
    // 四叉翼端板（實體件，鍍金）：左右各一片，上緣往外傾
    parts.push({
      geometry: mergeGeos([-1, 1].map((sg) => finPlate(ENDPLATE_PTS, sg * ENDPLATE.z, ENDPLATE.thick, -sg * ENDPLATE.tilt))),
      mat: 'gilt',
      solid: true,
      outline: true,
      name: 'fork-endplates',
    });

    // 座艙外圍的扭絞 torc（C8）：貼著殼面繞座艙罩一圈，開口朝前、兩端收成圓球頭；斷面半徑沿弧長週期起伏（18 個扭節），像扭絞金條
    {
      /** @type {number[][]} */
      const torcPts = [];
      const nT = 48;
      for (let i = 0; i <= nT; i++) {
        const th = (lerp(TORC.open, 360 - TORC.open, i / nT) * Math.PI) / 180;
        const x = TORC.xc + TORC.a * Math.cos(th);
        const z = TORC.b * Math.sin(th);
        torcPts.push([x, kit.surf.topY(x, z) + 0.6, z]);
      }
      const torc = sweepEllipse(torcPts, 64, (t) => {
        const r = 1.0 + 0.22 * Math.cos(t * 36 * Math.PI);
        return [r, r];
      }, 8);
      const balls = [torcPts[0], torcPts[nT]].map(([x, y, z]) => {
        const ball = new THREE.SphereGeometry(1.9, 12, 8);
        ball.translate(x, y + 0.3, z);
        return ball;
      });
      parts.push({ geometry: mergeGeos([torc, ...balls]), mat: 'gilt', solid: true, outline: true, name: 'torc' });
    }

    // ---- 貼紙 ----
    /** @type {(x: number, y: number) => boolean} 頂面（最寬處往上 2.5 mm 以上） */
    const onTop = (x, y) => y > P.ySh(x) + 2.5;
    // 後背的鍍金中線（torc 圈後方到車尾）
    parts.push({
      geometry: kit.decal((x, y, z) => (x < -64 || x > -27 ? -1 : 0.45 - Math.abs(z))),
      mat: 'dGold',
      name: 'decal-dorsal-line',
    });
    // 鼻尖往後掃、接到 torc 圓球頭的兩道鍍金條紋
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < TORC_END[0] || x > STRIPE_X0) {
          return -1;
        }
        const [zc, half] = noseStripe(x);
        return half - Math.abs(Math.abs(z) - zc);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-nose-stripes',
    });
    // 頂面兩道鉚接板縫（烏銀細縫）＋縫兩側的鍍金鉚釘（每 4 mm 一顆）
    parts.push({
      geometry: kit.decal((x, y) => (onTop(x, y) ? 0.3 - Math.min(...SEAM_XS.map((xs) => Math.abs(x - xs))) : -1)),
      mat: 'dGroove',
      name: 'decal-panel-seams',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y)) {
          return -1;
        }
        const zc = 4 * Math.round((Math.abs(z) - 2) / 4) + 2;
        let d = Infinity;
        for (const xs of SEAM_XS) {
          for (const off of [-1.7, 1.7]) {
            d = Math.min(d, Math.hypot(x - xs - off, Math.abs(z) - zc));
          }
        }
        return 0.62 - d;
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-seam-rivets',
    });

    // 側面浮雕帶（全貼紙）——近黑的氧化暗底＋鍍金波卷紋＋亮銀泡釘＋上下鍍金珠點與細邊（深底配金銀，對比要夠）
    /** @type {(x: number, y: number, z: number) => boolean} */
    const inFrieze = (x, y, z) => Math.abs(z) >= 24 && x >= FRIEZE.x0 && x <= FRIEZE.x1;
    /** @type {(x: number, y: number, z: number) => boolean} */
    const inFriezeBand = (x, y, z) => inFrieze(x, y, z) && Math.abs(y - FRIEZE.y) < FRIEZE.h - 0.4;
    parts.push({
      geometry: kit.decal((x, y, z) => (inFrieze(x, y, z) ? FRIEZE.h - Math.abs(y - FRIEZE.y) : -1)),
      mat: 'dRecess',
      name: 'decal-frieze-recess',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (inFriezeBand(x, y, z) ? -scrollSd(x, y - FRIEZE.y)[0] : -1), { offset: 0.4 }),
      mat: 'dGold',
      name: 'decal-frieze-scroll',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (inFriezeBand(x, y, z) ? -scrollSd(x, y - FRIEZE.y)[1] : -1), { offset: 0.45 }),
      mat: 'dSilver',
      name: 'decal-frieze-bosses',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 24 || x < FRIEZE.x0 - 0.5 || x > FRIEZE.x1 + 0.5) {
          return -1;
        }
        const dv = Math.abs(y - FRIEZE.y);
        const bead = 0.42 - Math.hypot(x - FRIEZE.x0 - 1.6 * Math.round((x - FRIEZE.x0) / 1.6), dv - (FRIEZE.h + 0.65));
        const rim = 0.32 - Math.abs(dv - (FRIEZE.h + 1.5));
        return Math.max(bead, rim);
      }, { offset: 0.25 }),
      mat: 'dGold',
      name: 'decal-frieze-beads',
    });
    // 上側面兩道深色凹槽速度線（避開前後輪拱）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 14) {
          return -1;
        }
        return -Math.min(grooveSd(x, y, 0), grooveSd(x, y, 1));
      }),
      mat: 'dGroove',
      name: 'decal-speed-grooves',
    });
    // 前輪開口外緣的鍍金細邊（寬約 0.75 mm）＋外圍一圈鉚釘（離開口 2.4 mm，沿橢圓每 11° 一顆）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < FRONT_CUT_Z || y < 12.5) {
          return -1;
        }
        const d = frontCutSide(x, y);
        const rim = Math.min(d - 0.05, 0.8 - d);
        const [u, v] = frontCutUV(x, y);
        const step = (11 * Math.PI) / 180;
        const phi = step * Math.round(Math.atan2(v / FRONT_CUT.b, u / FRONT_CUT.a) / step);
        const rivet = 0.6 - Math.hypot(u - (FRONT_CUT.a + 2.4) * Math.cos(phi), v - (FRONT_CUT.b + 2.4) * Math.sin(phi));
        return Math.max(rim, rivet);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-front-cut-rim-rivets',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）；座艙罩同厚度，以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：殼長 148（車尾 x −68 → 鼻尖 80），翼端板叉尖到 x −69（外框長 149，≤ 153 不刮立體橋）；殼頂 34–35.2、座艙罩頂約 39.2、翼面頂約 43.8、翼端板叉尖 47.6；後擋泥板半寬 45.5、前肩 45（x 30）、細腰 27.5（側裙下緣 y 11 在底盤側框上緣 9.4 之上）、鼻尖 3.5；x 40 → 80 殼頂以約 0.5 的斜率下壓成楔形',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），切口從 |z| 32 起；前輪罩另開側視斜橢圓開口（中心 x 39、y 22，半軸 17 × 14，長軸前上傾 50°，|z| ≥ 26）露出輪胎；後輪內襯深 7 mm，前後都有胎內側環形擋板',
    wing: '尾翼：弦 16、翼展 ±38.6、厚 1.0 mm 的單片翼（前緣 y 41.6、後緣 43.2）；翼端板厚 1.4 mm、板底 |z| 37、外傾 8°，後緣分四叉；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    torc: '扭絞 torc：俯視橢圓 38 × 26 mm 繞座艙罩，開口朝前 56°，斷面半徑 1.0 ± 0.22（18 個扭節）、兩端圓球 R1.9，ABS 實心件（推估）',
    myth: 'Gundestrup 銀釜：銀為主、鍍金、repoussé、嵌玻璃（MYTH_RESEARCH C1）；分叉鹿角與 torc（C2、C8）；La Tène 捲曲曲線（C7，只用單向波卷，不用三臂 triskele）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
