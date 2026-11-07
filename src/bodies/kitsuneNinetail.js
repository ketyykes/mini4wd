// 九尾狐（body-kitsune-ninetail，神話組・日本）：照四視圖 08 重新建模，九尾狐只用元素表現，車上沒有狐的頭、臉、眼、耳。
// 四視圖 08 留下的造型：低而長的扁平鏟鼻、從鼻尖一路斜升到座艙的楔形背線、壓低拉長的多面切削座艙罩、
// 座艙後細腰配外擴的後輪臀、車尾往後撇的尖刃尾翼。
// 九尾 → 九條往後撇的尖尾刃：中央 1 片＋左右各 4 片，扇根沿後甲板兩側斜排（不從同一點放射），白刃身、朱紅尾尖；
// 稻荷的朱與白 → 珍珠白車身＋朱紅下半部（往後斜升的分色線描金）＋黑漆底緣；
// 金蒔繪 → 前後輪之間青綠直立側牆上的金色青海波；狐火 → 引擎蓋中線三道並排往後拖的朱紅火焰（不放圓點）。
// 設計：shared/design/body-kitsune-ninetail/DESIGN.md（典故與文物對應 MYTH_RESEARCH 日本節 J1、J3、J12；
// 黑名單：《火影忍者》九喇嘛、寶可夢九尾〔J14〕、The Fox Jr.、WGP 銀狐隊、旭日放射紋〔J15〕）。剖面為本檔站位產生器（推估）。
// 不放鳥居與神社建築；塗裝全為自創，不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep, surfaceTopY } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、鼻尖 76.5 */
const XS = [-70, -66, -60, -50, -40, -25, -10, 5, 20, 30, 40, 50, 58, 64, 69, 73, 76.5];
/** @type {number[]} 俯視半寬的站位（比其他參數多腰身與前擋泥板前緣的控制點） */
const XS_HW = [-70, -66, -60, -50, -40, -30, -18, -5, 8, 20, 30, 40, 50, 52, 54.2, 55.6, 58, 61, 64, 69, 73, 76.5];

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

/** @type {(x: number) => number} 肩稜線的基本高度：後輪臀拱起（31.5），座艙兩側 28，往前斜降成又長又低的扁平鏟鼻側緣（鼻尖 11.6） */
const ySBase = monoCurve(XS, [29.4, 30.4, 31.2, 31.5, 31, 29.2, 28, 28, 28.4, 28.2, 27.6, 24.2, 17.6, 14.4, 12.8, 12, 11.6]);
/** @type {(x: number) => number} 中線殼頂的基本高度：後甲板 33.6；引擎蓋墊到和前擋泥板齊平（不鼓包），前軸之前一路斜降成又長又低的扁平鏟鼻（鼻尖 11.9） */
const yTopBase = monoCurve(XS, [31.4, 32.4, 33.2, 33.6, 33.6, 33.2, 32.6, 32.4, 32.2, 32, 31.6, 26.4, 19, 15, 13.2, 12.4, 11.9]);

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

/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：四視圖 08 的俯視——車身窄、四輪的胎面露在車身外側；後輪臀 ±31.5（車尾收到 ±11，尾刃從上方往後撇出）、
  // 座艙後段收成細腰 ±24.6、座艙前的胸 ±29.6、前輪上方 ±27.6；前擋泥板在 x 54.2–55.6 收進輪拱切口邊界（|z| = 22.5）以內，
  // 之後是四視圖 08 的扁平鏟形鼻（x 58 ±20.6、x 64 ±18.2，鼻尖圓收到 ±3.6）
  hw: monoCurve(XS_HW, [11, 16.5, 24, 30, 31.5, 27.5, 24.6, 25.2, 28.6, 29.6, 28.2, 27.6, 26.4, 25.2, 23.5, 21.6, 20.6, 19.6, 18.2, 14.8, 9.8, 3.6]),
  // 肩稜線高度（頂面與側面交界）：前輪上方沿眉線圓弧拱起，整個前輪拱都在肩稜線下方的側壁上
  yS: (x) => smoothMax(ySBase(x), browY(x), 1.2),
  // 中線殼頂：中線始終比肩稜線高 ≥ 0.5（鼻面不會出現橫越兩側的折稜），引擎蓋會被輪拱擦到的地方再墊高（yTopMin）
  yTop: (x) => smoothMax(yTopBase(x), Math.max(yTopMin(x), smoothMax(ySBase(x), browY(x), 1.2) + 0.5), 0.8),
  // 側裙下緣
  yLow: monoCurve(XS, [14, 12.5, 11, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.8, 11, 11, 10.9, 10.8]),
};

/** @type {number} 前後輪之間側裙下緣的半寬 */
const SILL_W = 39;

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
  // 側裙外張量隨半寬縮小：鼻尖很窄時不外張
  const flare = smoothstep(1, 8, h);
  // 前後輪之間的側裙往外張到 ±39、下半段是直立側牆（金青海波畫在這面上），從上面和側面都看不到底盤側框
  const sill = Math.max(h + 1.1 * flare, SILL_W * smoothstep(-24, -16, x) * smoothstep(24, 16, x));
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [Math.max(h + 0.7 * flare, sill - 0.4), lerp(s, lo, 0.42)],
    [sill, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與車鼻（含前擋泥板前緣）每約 1.3–1.4 mm 一站，中段每 2.4 mm */
const STATIONS = [...buildStations(-70, -60, 1.4, profile).slice(0, -1), ...buildStations(-60, 54, 2.4, profile).slice(0, -1), ...buildStations(54, 76.5, 1.3, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/**
 * 多面切削座艙罩（四視圖 08 的長座艙：前窗從前軸後方起、頂點在 x −6、後窗收到 x −26）：
 * 梯形斷面（平頂＋兩側斜窗），俯視是前尖後圓的長菱形
 * @type {{ x0: number, x1: number, peakX: number, rise: number, halfW: number }}
 */
const CANOPY = { x0: 34, x1: -26, peakX: -4, rise: 7.6, halfW: 13 };

/**
 * 朱紅下半部的上緣（側面的折線切面）：前輪前方從裙邊上 5 mm 起，往後斜升到後輪臀肩稜線下 2.5 mm，
 * 珍珠白車身在側視是一道從鼻尖往後收窄的楔形，分色線上描一道金線
 * @type {(x: number) => number}
 */
const ySplit = (x) => lerp(P.yLow(x) + 5, ySBase(x) - 2.5, smoothstep(40, -50, x));

/**
 * 黑漆底緣的高度（側裙最下面一圈黑漆）：前軸之後 2.2 mm，往鼻尖收到 0
 * @type {(x: number) => number}
 */
const baseBand = (x) => 2.2 * smoothstep(72, 56, x);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 朱紅：下半部與尾尖（亮面漆）
  vermilion: namedMaterial('paint-vermilion-shu', { color: 0xd43a1c, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 青綠：前後輪之間的側牆（四視圖 08 的青綠）
  teal: namedMaterial('paint-teal-seiji', { color: 0x1f8a7e, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  // 珍珠白：車身主色與尾刃
  white: namedMaterial('paint-pearl-white', { color: 0xf4f2ec, metalness: 0.2, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  // 黑漆：緞面（漆器感），底緣、座艙框
  urushi: namedMaterial('paint-urushi-black', { color: 0x141416, roughness: 0.55, clearcoat: 0.2 }),
  // 真金屬金（尾刃焰尖；名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a54a, metalness: 0.8, roughness: 0.3, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x262c38, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x18181b, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x1a1a1e, roughness: 0.7, side: THREE.DoubleSide }),
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
 * 九條尾刃（九尾 → 四視圖 08 車尾往後撇的雙尖翼擴成九片）：左右各 4 片從後輪臀肩上長出、往後撇、層層往上疊
 * （扇根前後錯開 7 mm、外張角 5 / 10 / 15 / 20°、上揚 4 / 9 / 14 / 19°，越外側越短越陡），中央 1 片貼著後甲板往後伸。
 * 不從同一點放射：扇根沿後甲板兩側斜排成一列，像箭羽一樣層層往後疊。rx / rz = 扇根位置；len = 刃長；yaw = 外張角；pitch = 上揚角（度）
 * @type {{ rx: number, rz: number, yaw: number, len: number, pitch: number }[]}
 */
const TAIL_BLADES = (() => {
  /** @type {{ rx: number, rz: number, yaw: number, len: number, pitch: number }[]} */
  const out = [{ rx: -30, rz: 0, yaw: 0, len: 44, pitch: 8 }];
  /** @type {number[][]} [扇根 x, 扇根 |z|, 外張角, 刃長, 上揚角] */
  const side = [
    [-20, 12, 5, 50, 4],
    [-27, 17, 10, 44, 9],
    [-34, 22, 15, 37, 14],
    [-41, 26, 20, 30, 19],
  ];
  for (const [rx, az, yaw, len, pitch] of side) {
    for (const sg of [-1, 1]) {
      out.push({ rx, rz: sg * az, yaw: sg * yaw, len, pitch });
    }
  }
  return out;
})();

/** @type {number} 尾刃根部半寬 */
const BLADE_HALF_W = 3.4;

/**
 * 尾刃沿長的斷面表：[沿長比例, 半寬比例, 中脊上高, 中脊下高]。斷面是菱形，根部最寬、直線收成尖端（俯視是細長三角刀刃）
 * @type {number[][]}
 */
const BLADE_SECTIONS = [
  [0, 1, 1, 0.6],
  [0.3, 0.78, 0.9, 0.5],
  [0.55, 0.55, 0.75, 0.42],
  [0.8, 0.28, 0.5, 0.3],
  [1, 0.02, 0.1, 0.08],
];
/** @type {number} 朱紅尾尖從第幾個斷面開始 */
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
 * 單片尾刃（局部座標：根在原點、往 −x 伸出、y 往上）：白色刃身＋朱紅尾尖兩個封閉網格
 * @type {(len: number) => { body: THREE.BufferGeometry, tip: THREE.BufferGeometry }}
 */
const tailBlade = (len) => {
  /** @type {number[][][]} */
  const rings = BLADE_SECTIONS.map(([q, wq, up, down]) => {
    const x = -q * len;
    const h = wq * BLADE_HALF_W;
    return [
      [x, 0, -h],
      [x, up, 0],
      [x, 0, h],
      [x, -down, 0],
    ];
  });
  return { body: closedLoft(rings.slice(0, BLADE_TIP_FROM + 1)), tip: closedLoft(rings.slice(BLADE_TIP_FROM)) };
};

/**
 * 九條尾刃，依顏色合併；扇根埋進後甲板殼面 0.6 mm（根部和殼面一體）
 * @type {(surf: any) => { body: THREE.BufferGeometry, tip: THREE.BufferGeometry }}
 */
const buildTail = (surf) => {
  /** @type {THREE.BufferGeometry[]} */
  const bodies = [];
  /** @type {THREE.BufferGeometry[]} */
  const tips = [];
  for (const b of TAIL_BLADES) {
    const ry = surfaceTopY(surf, b.rx, Math.abs(b.rz)) - 0.6;
    const parts = tailBlade(b.len);
    for (const g of [parts.body, parts.tip]) {
      g.rotateZ((-b.pitch * Math.PI) / 180);
      g.rotateY((b.yaw * Math.PI) / 180);
      g.translate(b.rx, ry, b.rz);
    }
    bodies.push(parts.body);
    tips.push(parts.tip);
  }
  return { body: mergeGeos(bodies), tip: mergeGeos(tips) };
};

/**
 * 青海波（J13：半圓三重相疊、像波浪一樣反覆）：圓半徑 R、水平間距 2R、垂直間距 R/2、隔列錯開 R；
 * 每點取「最下面一列」蓋住它的圓（下排疊在上排之上），畫三道同心圓弧線
 * @type {(R: number, v0: number) => (u: number, v: number) => number} 負值 = 在金線上
 */
const seigaiha = (R, v0) => (u, v) => {
  // 線寬與弧距隨 R 等比放大（R 4.5 時線寬 0.6），殼面網格 1 mm 也畫得出完整的三道弧
  const k = R / 4.5;
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
      for (const r of [R - 0.35 * k, R - 1.75 * k, R - 3.15 * k]) {
        d = Math.min(d, Math.abs(best - r));
      }
      return d - 0.3 * k;
    }
  }
  return 1;
};

/**
 * 狐火紋（俯視，畫在引擎蓋中線兩側）：三道並排、平行往後拖的火焰（中央最長），頭端圓、尾端收尖，
 * 每道火焰的外緣有兩個往後的小火舌；三道都左右對稱、互相平行，不從同一點放射。
 * 每道：[頭端 x, |z| 中心（中央 0）, 尾端 x, 頭端半徑]
 * @type {number[][]}
 */
const FOXFIRE = [
  [56, 0, 36, 3],
  [53, 9, 40, 2.5],
];

/**
 * 狐火紋的範圍
 * @type {(x: number, z: number) => number} 正值 = 在火焰內
 */
const foxfire = (x, z) => {
  let best = -Infinity;
  for (const [x0, zc, x1, r0] of FOXFIRE) {
    for (const sg of zc === 0 ? [0] : [-1, 1]) {
      const t = (x0 - x) / (x0 - x1);
      if (t < -0.5 || t > 1) {
        continue;
      }
      // 半寬沿長度收尖，外緣加兩個往後的小火舌（沿長度起伏）
      const w = t < 0 ? Math.sqrt(Math.max(0, r0 * r0 - (x - x0) ** 2)) : r0 * (1 - t) ** 0.6 * (1 + 0.3 * Math.sin(Math.PI * 3 * t) ** 2);
      best = Math.max(best, w - Math.abs(z - sg * zc));
    }
  }
  return best;
};

export const kitsuneNinetailBody = makePolyBody({
  id: 'body-kitsune-ninetail',
  name: '九尾狐',
  style: 'myth',
  phase: 8,
  mythSeries: 'japanese',
  mythTheme: 'kitsune',
  form: 'shu-fan-spade',
  roof: 'canopy',
  wing: 'nine-fan-blades',
  theme: '照四視圖 08 重新建模：扁平鏟形長鼻、一路斜升的楔形背線、壓低拉長的多面切削座艙罩、細腰配外擴後輪臀與封住底盤的側裙；九尾化成車尾九條往後撇的尖尾刃（白刃朱紅尖），珍珠白車身、朱紅下半部、兩輪之間青綠側牆上的金色青海波，引擎蓋三道並排朱紅狐火',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格邊長 1.0 mm（壓低殼面面數與碰撞格耗時）
  step: 1.0,
  // 肩稜線是銳利稜線
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'trapezoid',
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 36;
      for (let i = 0; i <= n; i++) {
        const x = lerp(CANOPY.x0, CANOPY.x1, i / n);
        // 前窗長而斜、後窗短而陡
        const t = x >= CANOPY.peakX ? (CANOPY.x0 - x) / (CANOPY.x0 - CANOPY.peakX) : (x - CANOPY.x1) / (CANOPY.peakX - CANOPY.x1);
        const rise = CANOPY.rise * Math.sin((Math.PI / 2) * t) ** (x >= CANOPY.peakX ? 0.9 : 0.6);
        // 俯視前尖後圓：前端 3 → x 4 最寬 14 → 後端 6
        const halfW = x >= 4 ? lerp(CANOPY.halfW, 3, smoothstep(4, CANOPY.x0, x) ** 1.3) : lerp(CANOPY.halfW, 6, smoothstep(-10, CANOPY.x1, x));
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 22,
  zones: () => [
    // 黑漆底緣
    { mat: 'urushi', keep: (x, y) => P.yLow(x) + baseBand(x) - y },
    // 青綠側牆：前後輪之間直立側牆上的分色線以下（金青海波畫在這面上）
    { mat: 'teal', keep: (x, y, z) => Math.min(Math.abs(z) - 33.5, 18 - Math.abs(x), ySplit(x) - y) },
    // 朱紅下半部（往後斜升的分色線以下）
    { mat: 'vermilion', keep: (x, y, z) => Math.min(ySplit(x) - y, Math.abs(z) - 12) },
    // 珍珠白車身
    { mat: 'white', keep: () => 1 },
  ],
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
    // 輪胎內側的環形擋板（|z| 22.9 = 內襯內緣，接成一個輪室）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 九條尾刃（實體件）：白色刃身、朱紅尾尖
    const tail = buildTail(kit.surf);
    parts.push({ geometry: tail.body, mat: 'white', solid: true, outline: true, name: 'tail-blades' });
    parts.push({ geometry: tail.tip, mat: 'vermilion', solid: true, outline: true, name: 'tail-blade-tips' });

    // ---- 貼紙 ----
    // 座艙框（黑漆，座艙罩外圍 1.2 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > CANOPY.x1 - 1.2 && x < CANOPY.x0 + 1.2 ? Math.min(u + 1.2, 0.05 - u) : -1;
      }),
      mat: 'dUrushi',
      name: 'decal-canopy-frame',
    });
    // 狐火紋（朱紅，引擎蓋中線三道並排火焰）
    parts.push({
      geometry: kit.decal((x, y, z) => (y < 18 ? -1 : Math.min(foxfire(x, z), -kit.underCanopy(x, z) - 0.6))),
      mat: 'dShu',
      name: 'decal-foxfire',
    });

    // 分色線上的金蒔繪線（線寬 1.2，從前輪後方往後斜升到車尾）
    parts.push({
      geometry: kit.decal((x, y) => Math.min(0.6 - Math.abs(y - (ySplit(x) + 0.6)), 30 - x, x + 69, y - P.yLow(x) - baseBand(x) - 0.4)),
      mat: 'dGold',
      name: 'decal-makie-beltline',
    });
    // 兩輪之間直立側牆上的金蒔繪青海波（朱紅下半部上，下緣停在黑漆底緣上方）；sideDecal 的 u 在左側是鏡射的，分色線要用車身 x = side·u
    const wave = seigaiha(8, 11);
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(wave(u, v), Math.abs(u) - 16, v - Math.min(ySplit(side * u) - 1.4, 21), 12.8 - v), { x0: 0, y0: 0, zMin: 34, side })),
        mat: 'dGold',
        name: `decal-seigaiha-${side}`,
      });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估，造型照 shared/design/body-kitsune-ninetail/fourview.png 四視圖 08 與 fourview_trace.txt 的比例，尺寸照底盤）：殼長約 147（車尾 −70 ~ 鼻尖約 77）、外框長 149.9（尾刃尖到 −73.6）；後甲板 33.6、鼻尖頂 11.9、座艙頂約 40、尾刃尖 41.3（全車最高）；後輪臀 ±31.5、細腰 ±24.6、胸 ±29.6、前後輪之間側裙下緣 ±39、前輪上方 ±27.6、鏟鼻 ±20.6 → ±3.6；前擋泥板眉線為前輪拱同心圓 R18.5',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    fan: '九條尾刃為 ABS 實心薄刃片（斷面菱形，根部寬 6.8、中脊厚 1.6，沿長 5 段、平面著色，推估）：中央 1 片（根 x −27、長 46、上揚 7°）＋左右各 4 片（根 x −24 / −26 / −28 / −30、|z| 13 / 17 / 21 / 24.5、外張 8 / 16 / 24 / 32°、上揚 5 / 10 / 15 / 20°、長 46 / 42 / 37 / 31）；每片後 45 % 為朱紅尾尖；根部埋進殼面 0.6；質量 = 封閉體積 × 1.05 g/cm³',
    palette: '珍珠白主色與尾刃＋朱紅下半部與尾尖＋黑漆底緣與座艙框＋金（青海波、分色線上的腰線）；朱、白、漆黑、金的色碼參考 MYTH_RESEARCH 6-2（朱 #C8372D、白 #F7F5F0、漆黑 #1B1B1B、金 #C9A54A，推估），實際用 #D43A1C、#F4F2EC、#141416',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
