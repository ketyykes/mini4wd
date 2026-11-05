// Gundestrup 雄鹿（body-gundestrup-stag，第八階段神話組・凱爾特）：丹麥 Gundestrup 銀釜（銀為主、局部鍍金、repoussé 錘起）上的雄鹿。
// 修長的鹿身：前輪上方是隆起的寬肩（鬐甲最高點），背線往後緩降到臀部，車頭收窄成長鹿吻；中段一個煙燻座艙罩；
// 車尾從後段車頂長出一對多叉、左右不對稱、自然彎曲的鹿角（實體件，鍍金角尖），兩支角根分開、不形成 Y 字剖面（MYTH_RESEARCH H7）；
// 鹿吻外圍一圈扭絞金 torc（兩端圓球頭，C8）；側面一道 La Tène 單向 S 形卷鬚紋（金，C7）與紅琺瑯圓點（C4 的紅琺瑯，只取顏色）。
// 設計：shared/design/body-gundestrup-stag/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 5 節 C1、C2、C7、C8；黑名單 5-3、第 10 節）。剖面為本檔站位產生器（推估）。
// 不畫神的人臉、不做盤腿坐像、不用三臂 triskele、不做圓內十字、不重現 Battersea 盾的琺瑯格；不做彩色發光鹿角；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, sdCircle } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

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
  // iter-114：最寬 48 → 47.6（車殼外框半寬 ≤ 48.0）；鹿頭段改成單調收窄（原本頸 19 → 兩頰 22 → 18 的凹凸讓銀面反光起皺）、前輪段 40 平台改成連續收斜
  // iter-121：鹿吻收得更細長（x 60 → 80 半寬 30.5 → 8；細長的鹿吻＋低鼻，也讓俯視 IoU 和 sleipnir 拉開）
  hw: monoCurve(XS, [4, 10, 36, 47.6, 47.6, 46.8, 43.5, 33, 30.5, 32, 38, 47.6, 46.5, 43.5, 39.5, 35, 30, 24.5, 19.6, 15.6, 12, 8]),
  // 中線頂（背線）：臀部 29 → 臀頂 37 → 背部低處 35（座艙罩）→ 鬐甲（肩峰）42 → 頸、額往前下到鼻尖 21.5
  // iter-114：鬐甲到鼻尖改成沿車長單純外凸（斜率一路變陡，原本 x 64 後斜率變緩 → 頸部下凹、反光像揉皺的鋁箔）；背部低處 35 → 36.2（座艙兩側的鞍形凹面變淺）
  // iter-121（第九階段）：整條背線壓低（鬐甲 41.4 → 37.5、背部 36.2 → 34），鹿吻往前一路下斜到鼻尖 16.5（LG1 低尖鼻 V3）；鬐甲到鼻尖仍是斜率一路變陡的單純外凸
  yTop: monoCurve(XS, [27, 31, 33, 34, 34.5, 34.5, 34.3, 34, 34, 34.5, 35.5, 36.5, 37.5, 37.3, 34.8, 32.6, 30.6, 28.4, 26, 23.4, 20.2, 16.5]),
  // 剖面最寬處的高度
  // iter-121：鹿吻段的最寬處跟著鼻尖往下收（19 → 14.2），鼻端變成低而扁的鏟形吻
  ySh: monoCurve(XS, [24, 24, 23, 22.5, 22, 22, 22, 21.5, 21.5, 21.5, 21.5, 22, 22.5, 22.5, 22, 21, 20, 19, 17.8, 16.6, 15.4, 14.2]),
  // 側裙下緣：中段 11（底盤側框段由 loft.js 自動讓到 9.9），臀部抬高離開後導輪，鹿吻下緣往上收
  // iter-121：鹿吻下緣 18 → 13（低鼻；仍在底盤前保險桿之上，以 body-check 間隙驗證）
  yLow: monoCurve(XS, [22, 19, 15, 13, 12, 12, 11.5, 11, 11, 11, 11, 11.5, 12, 12, 12, 12.2, 12.4, 12.6, 12.8, 13, 13, 13]),
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
 * iter-128（第十階段 F3 半罩露輪）：前輪罩後半切開，切口是階梯形（和 yaga 的斜切不同）：
 * x 24 → 32 只切到 y 22（輪胎後下緣露出），x 32 → 44 一路切到 y 40（翻過肩線，俯視看得到胎面）；只切 |z| ≥ 26（輪胎內側面 22.75 之外）。
 * 負值 = 開口內
 * @type {(x: number, y: number, z: number) => number}
 */
const frontStepCutSd = (x, y, z) => {
  if (Math.abs(z) < 26) {
    return 10;
  }
  const step = Math.min(Math.max(x - 32, y - 22), Math.max(32 - x, y - 40));
  return Math.max(24 - x, x - 44, 12 - y, step);
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
  // iter-114：外緣離殼外面 1.0 → 1.6 mm（解析式 shellZ 和平滑殼面在車頭 / 車尾收窄處差到 0.5 mm，內襯會穿出殼面）
  const zIn = (t) => shellZ(arch.x + r * Math.cos(t), arch.y + r * Math.sin(t)) - 1.6;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      /** @type {(t: number, z: number) => number[]} */
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      // iter-114：內緣不得超過外緣（原本 zIn < minZ 的角度，內襯被 minZ 撐到殼外面之外：前輪拱前緣、後輪拱後緣穿出殼面最多 3.5 mm、
      // 而且四邊形反折、法線朝外——Blender 展示圖輪拱邊上的黑白條紋來源之一）；至少留 0.6 mm 寬、一律在殼內面以內
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

/**
 * 線段（膠囊）距離
 * @type {(u: number, v: number, a: number[], b: number[], r: number) => number}
 */
const sdSeg = (u, v, [ax, ay], [bx, by], r) => {
  const dx = bx - ax;
  const dy = by - ay;
  const h = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - ax - h * dx, v - ay - h * dy) - r;
};

/**
 * 橢圓近似距離
 * @type {(u: number, v: number, cx: number, cy: number, rx: number, ry: number) => number}
 */
const sdEll = (u, v, cx, cy, rx, ry) => (Math.hypot((u - cx) / rx, (v - cy) / ry) - 1) * Math.min(rx, ry);

/**
 * iter-121（取自 iter-118 版，全部是貼紙、不加面數到碰撞）：仿 Gundestrup 銀釜的動物浮雕帶（只有動物：雄鹿、羊角蛇、狼，全部朝車頭行進；不做人物、不做盤腿坐像）。
 * u 往車頭、v 往上（帶中線 0），動物高約 ±4，回傳到動物剪影的距離（線寬 ≥ 0.8 mm）
 * @type {(u: number, v: number) => number}
 */
const animalSd = (u, v) => {
  // 雄鹿（中心 u −13）：身體、頸、頭、四腿、兩支小分叉角
  const du = u + 13;
  const stag = Math.min(
    sdEll(du, v, -0.4, 0.2, 3.2, 1.45),
    sdSeg(du, v, [2.2, 0.8], [3.4, 2.6], 0.6),
    sdEll(du, v, 4.1, 2.7, 1.05, 0.6),
    sdSeg(du, v, [-2.6, -0.2], [-3.0, -3.7], 0.42),
    sdSeg(du, v, [-1.4, -0.4], [-1.1, -3.7], 0.42),
    sdSeg(du, v, [1.3, -0.4], [1.8, -3.7], 0.42),
    sdSeg(du, v, [2.3, -0.2], [2.7, -3.7], 0.42),
    sdSeg(du, v, [3.6, 3.1], [3.0, 4.1], 0.32),
    sdSeg(du, v, [3.3, 3.6], [2.3, 3.9], 0.32),
    sdSeg(du, v, [-3.5, 0.6], [-4.3, 1.3], 0.35),
  );
  // 羊角蛇（中心 u 0）：波浪蛇身由尾到頭漸粗，頭部一個捲曲羊角（開口圓）
  let serpent = Infinity;
  const nS = 18;
  /** @type {(t: number) => number[]} */
  const sp = (t) => [-5 + 9.6 * t, 1.6 * Math.sin(t * 2.4 * Math.PI) - 0.6];
  for (let i = 0; i < nS; i++) {
    const t0 = i / nS;
    serpent = Math.min(serpent, sdSeg(u, v, sp(t0), sp((i + 1) / nS), lerp(0.3, 0.62, t0)));
  }
  const [hx, hy] = sp(1);
  serpent = Math.min(serpent, sdEll(u, v, hx + 0.6, hy + 0.1, 1.0, 0.6));
  const horn = Math.abs(Math.hypot(u - hx - 0.1, v - hy - 1.2) - 0.8) - 0.3;
  serpent = Math.min(serpent, Math.atan2(v - hy - 1.2, u - hx - 0.1) < -1.2 ? Infinity : horn);
  // 狼（中心 u 13）：較低長的身體、長吻、尖耳、下垂的尾巴
  const dw = u - 13;
  const wolf = Math.min(
    sdEll(dw, v, -0.5, 0.0, 3.4, 1.25),
    sdSeg(dw, v, [2.4, 0.5], [3.3, 1.6], 0.65),
    sdEll(dw, v, 3.8, 1.7, 1.0, 0.7),
    sdSeg(dw, v, [4.2, 1.5], [5.4, 1.1], 0.38),
    sdSeg(dw, v, [3.5, 2.2], [3.3, 3.2], 0.3),
    sdSeg(dw, v, [-3.6, 0.3], [-5.2, -1.6], 0.38),
    sdSeg(dw, v, [-2.8, -0.4], [-3.3, -3.7], 0.42),
    sdSeg(dw, v, [-1.6, -0.6], [-1.3, -3.7], 0.42),
    sdSeg(dw, v, [1.4, -0.5], [1.9, -3.7], 0.42),
    sdSeg(dw, v, [2.4, -0.3], [2.8, -3.7], 0.42),
  );
  return Math.min(stag, serpent, wolf);
};

/** @type {{ x0: number, x1: number, y: number, h: number }} 浮雕帶：前後輪拱之間的腰側（側視），半高 h（不含珠點邊框） */
const FRIEZE = { x0: -20, x1: 20, y: 18.6, h: 4.3 };

/**
 * 側面兩道深色凹槽速度線（iter-121，評審「側面加深色凹槽線把銀面分割出速度線」）：從前輪拱後上方起、往車尾微微上揚、
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
  // iter-121：浮雕帶凹處的氧化暗部（霧面）、凸起動物的亮銀、深色凹槽速度線（藍黑烏銀，不用棕黑）
  dRecess: decalMaterial('decal-oxidized-recess', { color: 0x2f3134, roughness: 0.75 }),
  dSilver: decalMaterial('decal-relief-silver', { color: 0xd2d3d2, roughness: 0.3, metalness: 0.85 }),
  dGroove: decalMaterial('decal-niello-groove', { color: 0x1a1f29, roughness: 0.55 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-patina', { color: 0x34373b, roughness: 0.7, side: THREE.DoubleSide }),
});

/**
 * 鹿角（右支，z > 0；左支另給一組參數）：主幹沿 4 個控制點的曲線從車頂往後上方張開，
 * tines 為從主幹某參數位置長出的分叉：[t, dx, dy, dz]（分叉尖相對分叉點的位移）
 * @typedef {{ beam: number[][], tines: number[][] }} AntlerDef
 */

/**
 * iter-121（第九階段）：鹿角從車尾移到座艙正後方（角根 x −25），主幹貼著背線往後上方掃（像被風往後吹的角冠，兼當尾部導流件）；
 * 角根左右分開（z ±8.5 / ±9.5）、各 3–4 個往後上方的分叉、左右長度與角度不同，不形成 Y 字剖面（MYTH_RESEARCH H7）。
 * 分叉尖一律壓在 y 48.2 以下（車殼頂高 ≤ 49，V17）。
 * @type {AntlerDef} 右角
 */
const ANTLER_R = {
  // iter-128：鹿角根部移到後輪罩肩上（z 30），主幹貼著車身往後掃、幾乎水平（y 40 → 44.6），末端兼後翼右端板；分叉全部往後上方
  beam: [
    [-20, 0, 29],
    [-30, 39.2, 34.5],
    [-43, 41.4, 38],
    [-56, 42.2, 39.5],
    [-66, 42.6, 38.5],
  ],
  tines: [
    [0.3, -4.5, 3.4, 1],
    [0.52, -5, 2.6, 1.5],
    [0.74, -4.5, 1.8, 0.8],
    [0.9, -3.5, 1.2, -0.5],
  ],
};
/** @type {AntlerDef} 左角：3 個分叉，角度與長度都和右角不同（自然鹿角的不對稱） */
const ANTLER_L = {
  beam: [
    [-21, 0, 29.5],
    [-31.5, 39.4, 35],
    [-44.5, 41.6, 38.6],
    [-57, 42.4, 39.8],
    [-66.5, 42.8, 39],
  ],
  tines: [
    [0.34, -4, 3.6, 1.2],
    [0.6, -5.5, 2.4, 1.6],
    [0.84, -4, 1.5, 0.4],
  ],
};
/** @type {{ le: number[], te: number[], thick: number, span: number }} iter-128：兩支鹿角之間的銀色後翼（單片大翼，鹿角是端板） */
const STAG_WING = { le: [-47, 41.0], te: [-62, 41.8], thick: 1.0, span: 38.5 };
/** @type {number} 分叉尖的高度上限（車殼頂高 ≤ 49） */
const ANTLER_Y_MAX = 47.4;

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
  openings: [{ id: '前輪露出階梯切口', shape: 'fn', sd: frontStepCutSd }],
  canopy: {
    section: 'ellipse',
    // 中段座艙罩：x 12 → −22，最寬 11、最高 5.2（iter-121：7 → 5.2，罩頂約 39.2，小而低的有色座艙 V5）
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
    /** @type {(x: number) => number} 中線頂面高度 */
    const top = (x) => kit.surf.topY(x, 0);

    // 輪拱內襯：後輪在寬後腿下方（殼面離輪胎較遠，內襯較深），前輪較淺
    parts.push({
      // iter-128：前輪罩已切開露輪，內襯只做後輪
      geometry: buildLiner(ARCHES[1], 7, 35.6),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // iter-114：輪胎內側的環形擋板（|z| 22.9；離 26 mm 輪內側面 2.4、31 mm 輪 1.9 mm）——擋住從輪拱橫越車身看到另一側地板的視線
    // （Blender 展示圖前輪拱內的黑白直條紋；原因與量測見 DESIGN.md「iter-114 修改」）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });

    // 鹿角（實體件、外形件）：主幹銀、分叉的末段鍍金；角根埋進車頂 0.8 mm
    /** @type {(def: AntlerDef, sg: number) => { silver: THREE.BufferGeometry[], gold: THREE.BufferGeometry[] }} */
    const buildAntler = (def, sg) => {
      const beamPts = def.beam.map(([x, y, z], i) => [x, i === 0 ? kit.surf.topY(x, z) - 0.8 : y, sg * z]);
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
      // iter-121：低分段（主幹 16 × 8、角尖 4 × 8；原本 40 × 12）
      silver.push(sweepEllipse(sample(0, split, 16), 16, (t) => [beamR(t * split), beamR(t * split)], 8));
      gold.push(sweepEllipse(sample(split, 1, 4), 4, (t) => {
        const r = lerp(beamR(split), 0.45, t);
        return [r, r];
      }, 8));
      // 分叉：從主幹點往外彎（二次曲線，控制點在中段往外側偏 1.5 mm），末 40% 鍍金
      for (const [t, dx, dy, dz] of def.tines) {
        const p0 = curve.getPointAt(t);
        const r0 = beamR(t) * 0.82;
        const tip = [p0.x + dx, Math.min(ANTLER_Y_MAX, p0.y + dy), p0.z + sg * dz];
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
        silver.push(sweepEllipse(a, 6, (s) => {
          const r = lerp(r0, r0 * 0.62, s);
          return [r, r];
        }, 6));
        gold.push(sweepEllipse(b, 4, (s) => {
          const r = lerp(r0 * 0.62, 0.4, s);
          return [r, r];
        }, 6));
      }
      return { silver, gold };
    };
    const right = buildAntler(ANTLER_R, 1);
    const left = buildAntler(ANTLER_L, -1);
    parts.push({ geometry: mergeGeos([...right.silver, ...left.silver]), mat: 'silver2', solid: true, outline: true, name: 'antlers' });
    parts.push({ geometry: mergeGeos([...right.gold, ...left.gold]), mat: 'gilt', solid: true, outline: true, name: 'antler-tips' });
    // iter-128：鹿角之間的銀色後翼（弦 15、翼展 ±39，前緣低後緣高；兩端插進鹿角主幹）
    {
      const w = STAG_WING;
      /** @type {number[][]} */
      const up = [];
      /** @type {number[][]} */
      const lo = [];
      for (let i = 0; i <= 10; i++) {
        const q = i / 10;
        const th = w.thick * (q < 0.3 ? 0.6 + (0.4 * q) / 0.3 : 1 - (0.7 * (q - 0.3)) / 0.7);
        const x = lerp(w.le[0], w.te[0], q);
        const y = lerp(w.le[1], w.te[1], q);
        up.push([x, y + 0.6 * th]);
        lo.push([x, y - 0.4 * th]);
      }
      parts.push({ geometry: finPlate([...up, ...lo.reverse()], 0, 2 * w.span), mat: 'silver2', solid: true, outline: true, name: 'stag-wing' });
    }

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
    // iter-121：低分段（56 × 8；原本 120 × 12），扭節數不變
    const torc = sweepEllipse(torcPts, 56, (t) => {
      const r = 0.95 + 0.22 * Math.cos(t * 28 * Math.PI);
      return [r, r];
    }, 8);
    const balls = [torcPts[0], torcPts[torcPts.length - 1]].map(([x, y, z]) => {
      const b = new THREE.SphereGeometry(1.75, 12, 8);
      b.translate(x, y, z);
      return b;
    });
    parts.push({ geometry: mergeGeos([torc, ...balls]), mat: 'gilt', solid: true, outline: true, name: 'torc' });

    // 鹿眼：金色眼圈＋深藍玻璃眼（鹿吻側面）
    /** @type {{ x: number, y: number }} 鹿眼中心（側視） */
    const EYE = { x: 69.5, y: 20.6 }; // iter-121：鹿吻壓低，眼睛 23.6 → 20.6
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

    // iter-121：側面仿銀釜的動物浮雕帶（取代原本的卷鬚紋帶；iter-118 未合併的改動，改成全貼紙）——氧化暗底＋亮銀動物＋上下鍍金珠點與細邊；兩側動物都朝車頭
    /** @type {(x: number, y: number, z: number) => boolean} */
    const inFrieze = (x, y, z) => Math.abs(z) >= 26 && x >= FRIEZE.x0 && x <= FRIEZE.x1;
    parts.push({
      geometry: kit.decal((x, y, z) => (inFrieze(x, y, z) ? FRIEZE.h - Math.abs(y - FRIEZE.y) : -1)),
      mat: 'dRecess',
      name: 'decal-frieze-recess',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (inFrieze(x, y, z) && Math.abs(y - FRIEZE.y) < FRIEZE.h ? -animalSd(x, y - FRIEZE.y) : -1), { offset: 0.4 }),
      mat: 'dSilver',
      name: 'decal-frieze-animals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 26 || x < FRIEZE.x0 - 0.5 || x > FRIEZE.x1 + 0.5) {
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
    // iter-121：上側面兩道深色凹槽速度線（避開前後輪拱）
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
