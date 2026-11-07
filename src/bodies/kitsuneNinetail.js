// 九尾狐（body-kitsune-ninetail，神話組・日本）：九尾狐主題只用元素表現，車上沒有狐的頭、臉、眼、耳。
// 九尾 → 車尾九片扇形尾翼（上下兩層：下層 5 片、上層 4 片，從金色扇軸往後展開；每片是有中脊的薄刃片，白身、朱紅焰尖）；
// 稻荷的朱與白 → 珍珠白車身＋從鼻側往後斜升的朱紅色塊＋黑漆底緣；寶珠 → 前罩上的火焰寶珠徽記（金珠微微發光、朱紅火舌往後拖）；
// 兩輪之間留一塊金蒔繪青海波。
// 造型：壓低的尖楔車頭（F1 刀鋒型）、俯視深胸細腰窄臀、中段煙燻座艙罩、車尾扇翼。
// 設計：shared/design/body-kitsune-ninetail/DESIGN.md（典故與文物對應 MYTH_RESEARCH 日本節 J1、J3、J12、J13；
// 黑名單：《火影忍者》九喇嘛、寶可夢九尾〔J14〕、The Fox Jr.、WGP 銀狐隊、旭日放射紋〔J15〕）。剖面為本檔站位產生器（推估）。
// 不放鳥居與神社建築；不做從單點放射的紅白條紋（扇片整片白，只有焰尖朱紅，九個焰尖連成一道弧）；
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、鼻尖 75.5 */
const XS = [-70, -66, -60, -50, -40, -25, -10, 5, 20, 30, 40, 50, 58, 64, 69, 73, 75.5];
/** @type {number[]} 俯視半寬的站位（比其他參數多腰身與前擋泥板前緣的控制點） */
const XS_HW = [-70, -66, -60, -50, -40, -30, -18, -5, 8, 20, 30, 40, 50, 52, 54.2, 55.6, 58, 61, 64, 69, 73, 75.5];

/** @type {{ x: number, y: number, r: number }} 前擋泥板眉線：以前輪拱圓心為圓心、半徑 18.5（輪拱 R17.5 外 1 mm）的圓弧 */
const FRONT_BROW = { x: 40, y: 13, r: 18.5 };

/**
 * 平滑取大值（交接處用半徑 k 的圓角接起來，沒有折角）
 * @type {(a: number, b: number, k: number) => number}
 */
const smoothMax = (a, b, k) => (a + b + Math.sqrt((a - b) ** 2 + k * k)) / 2;

/** @type {(x: number) => number} 前擋泥板眉線高度（圓弧外回傳很低的值，不影響取大值） */
const browY = (x) => {
  const dx = x - FRONT_BROW.x;
  return Math.abs(dx) < FRONT_BROW.r ? FRONT_BROW.y + Math.sqrt(FRONT_BROW.r ** 2 - dx * dx) : 0;
};

/** @type {(x: number) => number} 肩稜線的基本高度（不含前擋泥板眉線），斜向分色線以它為準 */
const ySBase = monoCurve(XS, [26.4, 27.4, 28, 28.4, 28.6, 28.8, 28.8, 28.8, 28.8, 28.4, 27.6, 25.4, 20.4, 17.4, 15.4, 14, 13.2]);
/** @type {(x: number) => number} 中線殼頂的基本高度：前軸之後是 33.0 的低平背，前軸之前往前下斜成刀尖鼻（鼻尖 14.2） */
const yTopBase = monoCurve(XS, [29.6, 31, 31.8, 32.3, 32.6, 32.8, 33, 33, 32.9, 32.4, 31.6, 27.0, 21.5, 18.6, 16.6, 15.2, 14.2]);

/** @type {(x: number) => number} 前輪拱圓柱（R17.5）在 x 處的頂高；圓柱外回傳 0 */
const archTopY = (x) => {
  const dx = x - FRONT_BROW.x;
  return Math.abs(dx) < 17.5 ? FRONT_BROW.y + Math.sqrt(17.5 ** 2 - dx * dx) : 0;
};

/**
 * 中線殼頂的下限：輪拱切口的內側邊界是 |z| = 22.5 的平面，引擎蓋在這個平面上的高度要比輪拱圓柱高 1.1 mm 以上，
 * 輪拱才不會在引擎蓋上擦出一道細長的裂縫。半剖面在 |z| = 22.5 處的高度 = (1 − f)·殼頂 + f·肩稜線（f 依剖面點位內插），
 * 由此反推殼頂的最小值。前擋泥板以外回傳 0
 * @type {(x: number) => number}
 */
const yTopMin = (x) => {
  const c = archTopY(x);
  const h = P.hw(x);
  if (c === 0 || h <= 22.5) {
    return 0;
  }
  const q = 22.5 / h;
  /** @type {number[][]} 剖面點位：[z / 半寬, 往肩稜線的比例 f] */
  const knots = [[0, 0], [0.34, 0.1], [0.64, 0.36], [0.87, 0.72], [1, 1]];
  let f = 1;
  for (let i = 0; i < knots.length - 1; i++) {
    const [q0, f0] = knots[i];
    const [q1, f1] = knots[i + 1];
    if (q >= q0 && q <= q1) {
      f = f0 + ((f1 - f0) * (q - q0)) / (q1 - q0);
    }
  }
  return f >= 0.98 ? 0 : (c + 1.1 - f * P.yS(x)) / (1 - f);
};

/** @type {(x: number) => number} 俯視半寬的控制曲線（車鼻段再經 smoothNose 平滑） */
const hwRaw = monoCurve(XS_HW, [15, 18.5, 25, 31.5, 36, 33, 26.5, 29, 36, 38.5, 33, 33, 29.8, 27.3, 23.5, 20.2, 13.8, 8.8, 5.8, 3.1, 1.8, 1.2]);

/** @type {number} 車鼻段平滑的高斯標準差（mm） */
const NOSE_SIGMA = 1.6;
/** @type {number[]} 高斯核取樣位移（±3σ，13 點） */
const NOSE_OFFSETS = Array.from({ length: 13 }, (_, i) => (i - 6) * NOSE_SIGMA * 0.5);
/** @type {number[]} 高斯核權重（已正規化） */
const NOSE_WEIGHTS = (() => {
  const w = NOSE_OFFSETS.map((o) => Math.exp(-0.5 * (o / NOSE_SIGMA) ** 2));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / sum);
})();

/**
 * 車鼻段（x 44–72）的高斯平滑，兩端用 smoothstep 和原曲線接回；取樣不超過鼻尖
 * @type {(f: (x: number) => number, x: number) => number}
 */
const smoothNose = (f, x) => {
  const w = smoothstep(42, 46, x) * (1 - smoothstep(70, 73, x));
  if (w === 0) {
    return f(x);
  }
  let v = 0;
  NOSE_OFFSETS.forEach((o, i) => {
    v += NOSE_WEIGHTS[i] * f(Math.min(75.5, x + o));
  });
  return (1 - w) * f(x) + w * v;
};

/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：「深胸—細腰—窄臀」——座艙前的胸最寬 38.5（x 20）、座艙後段收成細腰 26.5（x −18）、
  // 後軸上方的臀 36（後軸後方 x −50 仍有 31.5）、往後收成窄尾（車尾半寬 15，扇翼從上方往外展開）。
  // 前擋泥板：前輪上方 31–33，從 x 48 開始漸收，在 x 54–55.5 從約 23.5 收到 20.5，側壁只在這一小段跨過輪拱切口的
  // 邊界（|z| = 22.5），切口前緣是一道短而直的立邊；之後是夾在兩個擋泥板之間的細長刀尖鼻（x 61 半寬 8.8、鼻尖 1.2）
  // 車鼻段（x 44–72）再做一次高斯平滑：單調三次曲線在控制點只有一階連續，曲率在控制點跳一下，
  // 反光會在鼻面上畫出一條橫越兩側擋泥板的細亮線；平滑後曲率連續
  hw: (x) => smoothNose(hwRaw, x),
  // 肩稜線高度（頂面與側面交界）：前輪上方沿眉線圓弧拱起，整個前輪拱都在肩稜線下方的側壁上，
  // 輪拱不會擦過引擎蓋頂面（擦過時頂面會被切出一道細長的裂縫）
  yS: (x) => smoothMax(ySBase(x), browY(x), 1.2),
  // 中線殼頂：座艙到鼻尖是一整片連續的楔形面——中線始終比肩稜線高 ≥ 0.5（前輪上方不凹成谷，鼻面不會出現橫越兩側的折稜），
  // 引擎蓋會被輪拱擦到的地方再墊高（yTopMin）
  yTop: (x) => smoothMax(yTopBase(x), Math.max(yTopMin(x), smoothMax(ySBase(x), browY(x), 1.2) + 0.5), 0.8),
  // 側裙下緣
  yLow: monoCurve(XS, [14, 12.5, 11, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11, 12, 12.6, 12.8, 12.9]),
};

/**
 * 半剖面 7 點：中線 → 微圓的頂面 → 肩稜線（銳利）→ 微外張的側裙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  const d = t - s;
  // 側裙外張量隨半寬縮小：鼻尖很窄時不外張，下緣不會比頂面寬而捏出一個收束點
  const flare = smoothstep(1, 8, h);
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [h + 0.7 * flare, lerp(s, lo, 0.5)],
    [h + 1.1 * flare, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾每 1 mm、車鼻（含前擋泥板前緣）每約 0.9 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-70, -60, 1, profile).slice(0, -1), ...buildStations(-60, 54, 2, profile).slice(0, -1), ...buildStations(54, 75.5, 0.9, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 3、前後半長 19、半寬 12.5） */
const CANOPY = { xc: 3, a: 19, b: 12.5, n: 2.6 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/**
 * 斜向分色線（V12 從鼻尖往後掃）：朱紅色塊在車頭只到肩稜線下 7 mm（鼻尖整個留白），往後一路斜升，
 * 到車尾越過肩稜線 2 mm（後甲板兩側也是朱紅，只留中央一道白背脊接到扇軸）——側視是一道往後上揚的楔形分割
 * @type {(x: number) => number}
 */
const ySplit = (x) => ySBase(x) - 7 + 9 * smoothstep(55, -62, x);

/**
 * 黑漆底緣的高度（側裙最下面一圈黑漆，像朱漆柱腳的黑色根部）：前軸之後 2.4 mm，往鼻尖收到 0
 * @type {(x: number) => number}
 */
const baseBand = (x) => 2.4 * smoothstep(72, 56, x);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 珍珠白：車身主色與扇片（亮面）
  white: namedMaterial('paint-pearl-white', { color: 0xf4f2ec, metalness: 0.2, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  // 黑漆：緞面（漆器感），底緣、扇軸座、座艙框
  urushi: namedMaterial('paint-urushi-black', { color: 0x141416, roughness: 0.55, clearcoat: 0.2 }),
  // 朱紅（斜向色塊、扇片焰尖），亮面漆
  vermilion: namedMaterial('paint-vermilion-shu', { color: 0xd8401f, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  // 真金屬金（扇軸；名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a54a, metalness: 0.8, roughness: 0.3, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x262c38, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x18181b, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x1a1a1e, roughness: 0.7, side: THREE.DoubleSide }),
  // 寶珠：琥珀金，微弱自發光（強度壓低，Blender 不過曝）
  jewel: namedMaterial('lamp-jewel-amber', { color: 0xffc860, emissive: 0xffa030, emissiveIntensity: 0.35, roughness: 0.15, clearcoat: 1.0 }),
  dGold: decalMaterial('decal-gold-makie', { color: 0xd4b052, metalness: 0.75, roughness: 0.32 }),
  dUrushi: decalMaterial('decal-urushi-black', { color: 0x141416, roughness: 0.5, clearcoat: 0.2 }),
  dShu: decalMaterial('decal-vermilion-shu', { color: 0xd8401f, roughness: 0.35, clearcoat: 0.6 }),
});

/**
 * 輪拱內側擋板（避免 Blender 展示圖前輪拱內出現黑白條紋）：
 * 輪拱內襯只是靠外側的一段圓柱面，從側面 / 前 3/4 看進輪拱，視線會穿過輪胎上方與前方的空隙、橫越車身、
 * 從另一側輪拱與側裙下方看到地板（Blender 攝影棚地板在車旁最亮）→ 和車殼安裝柱、對側內面的深色交錯成直條紋。
 * 這裡在輪胎內側（|z| = zw）補一片環形擋板（輪拱圓心為圓心，半徑 rIn → rOut、只取上半圈），把輪室從車身內部隔開。
 * blocked(x, y) 回傳 true 的位置（底盤側框、安裝柱等，已含 1 mm 間隙）不放擋板。
 * @type {(arch: { x: number, y: number }, zw: number, rIn: number, rOut: number, blocked: (x: number, y: number) => boolean) => THREE.BufferGeometry}
 */
export function buildArchWell(arch, zw, rIn, rOut, blocked) {
  const nt = 56;
  const nr = 6;
  const a0 = 0.1;
  const a1 = Math.PI - 0.1;
  /** @type {number[]} */
  const pos = [];
  /** @type {(t: number, r: number) => number[]} */
  const xy = (t, r) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t)];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < nt; i++) {
      const t0 = lerp(a0, a1, i / nt);
      const t1 = lerp(a0, a1, (i + 1) / nt);
      for (let j = 0; j < nr; j++) {
        const r0 = lerp(rIn, rOut, j / nr);
        const r1 = lerp(rIn, rOut, (j + 1) / nr);
        const q = [xy(t0, r0), xy(t1, r0), xy(t1, r1), xy(t0, r1)];
        if (q.some(([x, y]) => blocked(x, y))) {
          continue;
        }
        const [A, B, C, D] = q.map(([x, y]) => [x, y, sg * zw]);
        // 法線朝輪胎（z 往外）
        if (sg > 0) {
          pos.push(...A, ...B, ...C, ...A, ...C, ...D);
        } else {
          pos.push(...A, ...C, ...B, ...A, ...D, ...C);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * chassis-midship 在輪拱內側（|z| 19–26）的障礙物（量測值，已加 1 mm 間隙）：
 * 前後軸之間的底盤側框（前輪拱 x ≤ 25.5、後輪拱 x ≥ −27.5，頂 y 20.4–21.0；後輪拱 x ≥ −20.5 處頂 23.2）、
 * 安裝柱（x ±33.5、±50，寬 < 1 mm、頂 y 19.6，|z| 21.4–24.6）；軸承座（軸心半徑 4.1）在擋板內徑以內
 * @type {(x: number, y: number) => boolean}
 */
export const chassisBlockedNearArch = (x, y) => {
  if (x > 0 && x < 26.5 && y < 22) {
    return true;
  }
  if (x < 0 && x > -28.5 && y < (x > -21.5 ? 24.2 : 22)) {
    return true;
  }
  if (y < 20.6 && [33.5, 50].some((px) => Math.abs(Math.abs(x) - px) < 1.8)) {
    return true;
  }
  return false;
};

/**
 * 九片扇翼的兩層設定（九尾 → 九片扇形尾翼）。俯視是一把打開的扇：每片從扇軸往後放射，上層 4 片錯開半格蓋住下層 5 片的間隙；
 * 側視是上下兩層往後上揚的薄翼（下層貼著後甲板，上層翹得高）。
 * xr / y = 扇軸位置；pitch = 往後上揚角（度）；curl = 片尖再往上翹的高度；wMax = 最寬處半寬；
 * blades = 每片的張角（度，正值往 +z）與長度
 * @type {{ xr: number, y: number, pitch: number, curl: number, wMax: number, blades: { yaw: number, len: number }[] }[]}
 */
const FAN_TIERS = [
  {
    xr: -29,
    y: 33.9,
    pitch: 6.5,
    curl: 2.6,
    wMax: 6.2,
    blades: [
      { yaw: 0, len: 43 },
      { yaw: 33, len: 42 },
      { yaw: -33, len: 42 },
      { yaw: 66, len: 36 },
      { yaw: -66, len: 36 },
    ],
  },
  {
    xr: -27,
    y: 35.2,
    pitch: 12.5,
    curl: 3,
    wMax: 5.6,
    blades: [
      { yaw: 16, len: 41 },
      { yaw: -16, len: 41 },
      { yaw: 49, len: 37 },
      { yaw: -49, len: 37 },
    ],
  },
];

/** @type {number} 扇片根部離扇軸中心的距離（根部埋在扇軸座裡，九片不會在軸心互相穿插） */
const FAN_ROOT_R = 3;

/**
 * 扇片沿長的斷面表：[沿長比例, 半寬比例, 中脊上高, 中脊下高]。斷面是菱形（左緣、上中脊、右緣、下中脊），
 * 根窄、六成處最寬、尖端收成一點；中脊讓薄片有一道受光的稜線，看起來是刃片而不是紙片
 * @type {number[][]}
 */
const BLADE_SECTIONS = [
  [0, 0.3, 0.9, 0.5],
  [0.3, 0.7, 1.2, 0.6],
  [0.58, 1, 1.2, 0.6],
  [0.7, 0.9, 1, 0.55],
  [0.87, 0.5, 0.6, 0.35],
  [1, 0.03, 0.12, 0.1],
];
/** @type {number} 朱紅焰尖從第幾個斷面開始 */
const BLADE_TIP_FROM = 2;

/**
 * 由一串斷面環（每環點數相同）建封閉網格：相鄰環之間補四邊形、頭尾各補一個扇形封口，
 * 再依帶號體積統一繞向（法線朝外，質量用封閉體積計算）。頂點不共用 → 平面著色，稜線清楚
 * @type {(rings: number[][][]) => THREE.BufferGeometry}
 */
const closedLoft = (rings) => {
  const m = rings[0].length;
  /** @type {number[]} */
  const pos = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < m; k++) {
      const a = rings[i][k];
      const b = rings[i][(k + 1) % m];
      const c = rings[i + 1][(k + 1) % m];
      const d = rings[i + 1][k];
      pos.push(...a, ...d, ...c, ...a, ...c, ...b);
    }
  }
  for (const [ring, flip] of /** @type {[number[][], boolean][]} */ ([
    [rings[0], false],
    [rings[rings.length - 1], true],
  ])) {
    const cx = [0, 1, 2].map((j) => ring.reduce((acc, p) => acc + p[j], 0) / m);
    for (let k = 0; k < m; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % m];
      if (flip) {
        pos.push(...cx, ...b, ...a);
      } else {
        pos.push(...cx, ...a, ...b);
      }
    }
  }
  let vol = 0;
  for (let i = 0; i < pos.length; i += 9) {
    vol +=
      pos[i] * (pos[i + 4] * pos[i + 8] - pos[i + 5] * pos[i + 7]) -
      pos[i + 1] * (pos[i + 3] * pos[i + 8] - pos[i + 5] * pos[i + 6]) +
      pos[i + 2] * (pos[i + 3] * pos[i + 7] - pos[i + 4] * pos[i + 6]);
  }
  if (vol < 0) {
    for (let i = 0; i < pos.length; i += 9) {
      for (let j = 0; j < 3; j++) {
        const tmp = pos[i + 3 + j];
        pos[i + 3 + j] = pos[i + 6 + j];
        pos[i + 6 + j] = tmp;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 單片扇片（局部座標：根在原點、往 −x 伸出、y 往上）：白色片身＋朱紅焰尖兩個封閉網格。
 * 片身沿長微微往上彎（curl·比例²），像被風往後上吹起
 * @type {(len: number, wMax: number, curl: number) => { body: THREE.BufferGeometry, tip: THREE.BufferGeometry }}
 */
const fanBlade = (len, wMax, curl) => {
  /** @type {number[][][]} */
  const rings = BLADE_SECTIONS.map(([q, wq, up, down]) => {
    const x = -(FAN_ROOT_R + q * len);
    const yc = curl * q * q;
    const h = wq * wMax;
    return [
      [x, yc, -h],
      [x, yc + up, 0],
      [x, yc, h],
      [x, yc - down, 0],
    ];
  });
  return { body: closedLoft(rings.slice(0, BLADE_TIP_FROM + 1)), tip: closedLoft(rings.slice(BLADE_TIP_FROM)) };
};

/**
 * 兩層九片扇翼，依顏色合併（每片先繞扇軸往後上揚 pitch，再往外張 yaw）
 * @type {() => { body: THREE.BufferGeometry, tip: THREE.BufferGeometry }}
 */
const buildFan = () => {
  /** @type {THREE.BufferGeometry[]} */
  const bodies = [];
  /** @type {THREE.BufferGeometry[]} */
  const tips = [];
  for (const tier of FAN_TIERS) {
    for (const blade of tier.blades) {
      const parts = fanBlade(blade.len, tier.wMax, tier.curl);
      for (const g of [parts.body, parts.tip]) {
        // rotateZ 負角：x 越往後 y 越高
        g.rotateZ((-tier.pitch * Math.PI) / 180);
        g.rotateY((blade.yaw * Math.PI) / 180);
        g.translate(tier.xr, tier.y, 0);
      }
      bodies.push(parts.body);
      tips.push(parts.tip);
    }
  }
  return { body: mergeGeos(bodies), tip: mergeGeos(tips) };
};

/**
 * 青海波（J13：半圓三重相疊、像波浪一樣反覆）：圓半徑 R、水平間距 2R、垂直間距 R/2、隔列錯開 R；
 * 每點取「最下面一列」蓋住它的圓（下排疊在上排之上），畫三道同心圓弧線（線寬 0.6）
 * @type {(R: number, v0: number) => (u: number, v: number) => number} 負值 = 在金線上
 */
const seigaiha = (R, v0) => (u, v) => {
  const rowH = R / 2;
  const jTop = Math.floor((v - v0) / rowH) + 2;
  for (let j = jTop - 5; j <= jTop; j++) {
    const vc = v0 + j * rowH;
    const off = ((j % 2) + 2) % 2 === 1 ? R : 0;
    const ic = Math.round((u - off) / (2 * R));
    let best = Infinity;
    for (const i of [ic - 1, ic, ic + 1]) {
      best = Math.min(best, Math.hypot(u - (off + 2 * R * i), v - vc));
    }
    if (best < R) {
      let d = Infinity;
      for (const r of [R - 0.35, R - 1.75, R - 3.15]) {
        d = Math.min(d, Math.abs(best - r));
      }
      return d - 0.3;
    }
  }
  return 1;
};

/**
 * 火焰寶珠徽記（俯視，畫在前罩中線上）：金色寶珠包在朱紅火團裡，三道火舌往後拖（中央最長），像被迎面風往後吹。
 * 火舌是由粗到尖的錐形線段，中央那道的起點就是包住寶珠的火團
 * @type {{ jewel: (x: number, z: number) => number, flame: (x: number, z: number) => number }} 正值 = 在圖形內
 */
const JEWEL_EMBLEM = (() => {
  /** @type {number[][]} 火舌：[起點 x, 起點 |z|, 終點 x, 終點 |z|, 起點半徑] */
  const tongues = [
    [46, 0, 23.5, 0, 5.4],
    [45, 3, 28, 9.5, 3.2],
  ];
  /** @type {(x: number, z: number) => number} */
  const flame = (x, z) => {
    const az = Math.abs(z);
    let best = -Infinity;
    for (const [x0, z0, x1, z1, r0] of tongues) {
      const dx = x1 - x0;
      const dz = z1 - z0;
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (az - z0) * dz) / (dx * dx + dz * dz)));
      best = Math.max(best, r0 * (1 - t) - Math.hypot(x - (x0 + t * dx), az - (z0 + t * dz)));
    }
    return best;
  };
  return { jewel: (x, z) => 3.3 - Math.hypot(x - 46, z), flame };
})();

export const kitsuneNinetailBody = makePolyBody({
  id: 'body-kitsune-ninetail',
  name: '九尾狐',
  style: 'myth',
  phase: 8,
  mythSeries: 'japanese',
  mythTheme: 'kitsune',
  form: 'fox-wedge',
  roof: 'canopy',
  wing: 'nine-tails',
  theme: '九尾用元素表現：壓低的尖楔車頭、中段煙燻座艙罩、車尾上下兩層從金色扇軸往後展開的九片扇形尾翼（白色刃片、朱紅焰尖）；珍珠白＋往後斜升的朱紅色塊＋黑漆底緣，前罩一枚拖著火舌的火焰寶珠，兩輪之間金蒔繪青海波',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 肩稜線是銳利稜線
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 超橢圓座艙：x 21.6 → −15.6（每 1.24 mm 一站）；最寬 12.5、最高 8.6（壓低；座艙頂約 41.6）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = lerp(21.6, -15.6, u);
        const halfW = Math.max(2.6, canopyHalfW(x));
        const rise = 8.6 * Math.sin(Math.PI * u ** 0.8) ** 0.6;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 黑漆底緣
    { mat: 'urushi', keep: (x, y) => P.yLow(x) + baseBand(x) - y },
    // 朱紅色塊（斜向往後上揚的分色線以下）
    { mat: 'vermilion', keep: (x, y) => ySplit(x) - y },
    // 珍珠白
    { mat: 'white', keep: () => 1 },
  ],
  // 鼻尖封口留白（鼻尖不另外上色）；車尾封口在朱紅色塊裡
  capFrontBands: [{ mat: 'white' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'vermilion', glass: 'glass', cockpit: 'urushi', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 輪胎內側的環形擋板（|z| 22.9 = 內襯內緣，接成一個輪室；離 26 mm 輪內側面 2.4、31 mm 輪 1.9 mm）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 九片扇翼（實體件）：白色片身＋朱紅焰尖
    const fan = buildFan();
    parts.push({ geometry: fan.body, mat: 'white', solid: true, outline: true, name: 'fan-blades' });
    parts.push({ geometry: fan.tip, mat: 'vermilion', solid: true, outline: true, name: 'fan-blade-tips' });
    // 扇軸座：黑漆扁橢球，把九片扇根和後甲板接成一體（分段 16×10）
    const boss = new THREE.SphereGeometry(1, 16, 10);
    boss.scale(9, 2.4, 10);
    boss.translate(-30, P.yTop(-30) + 0.2, 0);
    parts.push({ geometry: boss, mat: 'urushi', solid: true, outline: true, name: 'fan-pivot-boss' });
    // 扇軸：金色扁圓釘（摺扇的「要」），壓在上層扇根上
    const pivot = new THREE.SphereGeometry(1, 12, 8);
    pivot.scale(3.2, 1.6, 3.2);
    pivot.translate(-27.5, 36, 0);
    parts.push({ geometry: pivot, mat: 'gold', solid: true, outline: true, name: 'fan-pivot' });

    // ---- 貼紙 ----
    // 座艙框（黑漆，座艙罩外圍 1.4 mm）＋座艙到扇軸座的黑漆背脊線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        const ring = x > -16.8 && x < 22.8 ? Math.min(u + 1.4, 0.05 - u) : -1;
        const spine = Math.min(1.2 - Math.abs(z), -14.5 - x, x + 23);
        return Math.max(ring, spine);
      }),
      mat: 'dUrushi',
      name: 'decal-canopy-frame',
    });
    // 火焰寶珠徽記（前罩中線）：朱紅火舌（挖掉寶珠的位置，兩片貼紙不重疊）＋琥珀金寶珠
    parts.push({
      geometry: kit.decal((x, y, z) => (y < 24 ? -1 : Math.min(JEWEL_EMBLEM.flame(x, z), -JEWEL_EMBLEM.jewel(x, z)))),
      mat: 'dShu',
      name: 'decal-jewel-flames',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (y < 24 ? -1 : JEWEL_EMBLEM.jewel(x, z)), { offset: 0.1 }),
      mat: 'jewel',
      name: 'lamp-flame-jewel',
    });
    // 鼻面兩道朱紅條紋：從鼻尖沿前擋泥板內緣往後外掃到座艙兩側，前細後寬（0.9 → 3.4 mm），把火焰寶珠夾在中間
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const q = (72 - x) / 62;
        return Math.min(lerp(0.45, 1.7, q) - Math.abs(Math.abs(z) - (2.5 + 0.3 * (72 - x))), 72 - x, x - 10, P.hw(x) - 0.5 - Math.abs(z));
      }),
      mat: 'dShu',
      name: 'decal-hood-stripes',
    });
    // 分色線上的金蒔繪細線（線寬 0.7，從鼻側往後斜升到車尾，把視線帶向扇翼）
    parts.push({
      geometry: kit.decal((x, y) => Math.min(0.35 - Math.abs(y - (ySplit(x) + 0.35)), 63 - x, x + 68.5, y - P.yLow(x) - baseBand(x))),
      mat: 'dGold',
      name: 'decal-makie-beltline',
    });
    // 側面青海波（前後輪之間的朱紅色塊上，金蒔繪細線；下緣停在黑漆底緣上方）；sideDecal 的 u 在左側是鏡射的，分色線要用車身 x = side·u
    const wave = seigaiha(4.5, 9.8);
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(wave(u, v), Math.abs(u) - 20.5, v - (ySplit(side * u) - 1.2), 13.6 - v), { x0: 0, y0: 0, zMin: 30, side })),
        mat: 'dGold',
        name: `decal-seigaiha-${side}`,
      });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：殼長 145.5（車尾 −70 ~ 鼻尖 75.5）、外框長 149.9（扇尖 −74.4）；殼頂 33.0、鼻尖頂 14.2、座艙頂 41.5、上層扇片尖 47.8（全車最高）、胸寬 ±38.5（座艙後細腰 ±26.5、後軸臀 ±36、前輪上方 ±31–33、鼻尖 ±1.2）；前擋泥板眉線為前輪拱同心圓 R18.5（頂 31.5，比 R17.5 輪拱高 1 mm）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    fan: '九片扇翼為上下兩層 ABS 實心薄刃片（斷面菱形：最寬處寬 12.4 / 11.2 mm、中脊處厚 1.8 mm，沿長 5 段、平面著色，推估）：下層 5 片（扇軸 x −29、往後升 6.5°、張角 0 / ±33 / ±66°、長 43 / 42 / 36 mm）、上層 4 片（扇軸 x −27、往後升 12.5°、張角 ±16 / ±49°、長 41 / 37 mm）；每片從最寬處往後是朱紅焰尖；根部埋進黑漆扇軸座（16×10 段），上面壓一顆金色扇軸（12×8 段）；不碰後導輪（後導輪頂 y 20.5）；質量 = 封閉體積 × 1.05 g/cm³',
    palette: '珍珠白主色＋朱紅斜向色塊 / 焰尖＋黑漆底緣與扇軸座＋少量金蒔繪（不用靛藍：白＋藍接近 WGP 隊伍配色；不用金毛 / 橘色主體）；朱、白、漆黑、金的色碼參考 MYTH_RESEARCH 6-2（朱 #C8372D、白 #F7F5F0、漆黑 #1B1B1B、金 #C9A54A，推估），實際用 #D8401F、#F4F2EC、#141416，其餘色碼自訂',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
