// 九尾狐（body-kitsune-ninetail，神話組・日本）：照四視圖 08 重新建模，九尾狐只用元素表現，車上沒有狐的頭、臉、眼、耳。
// 四視圖 08 留下的造型：低而長的尖鏟鼻、從鼻尖一路斜升到座艙的楔形背線、前移的多面切削座艙罩（頂點在後軸前方）、
// 座艙後細腰配外擴的後輪臀、側面下半部的白色裙板與前後輪之間的斜進氣口、車尾往後上揚的尖刃尾翼。
// 九尾 → 尾刃擴成九片扇形尾翼：九片從座艙後方同一個（看不見的）扇軸往後放射，像打開的摺扇，
// 白色摺面、金色刃尖，扇軸上壓一顆金色扇軸釘（摺扇的「要」）；
// 稻荷的朱與白 → 朱紅車身（主色）＋白色下裙板＋黑漆底緣；寶珠 → 鼻面上拖著白色火舌的金色寶珠。
// 設計：shared/design/body-kitsune-ninetail/DESIGN.md（典故與文物對應 MYTH_RESEARCH 日本節 J1、J3、J12；
// 黑名單：《火影忍者》九喇嘛、寶可夢九尾〔J14〕、The Fox Jr.、WGP 銀狐隊、旭日放射紋〔J15〕）。剖面為本檔站位產生器（推估）。
// 不放鳥居與神社建築；塗裝全為自創，不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, smoothstep, surfaceTopY } from './loft.js';
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

/** @type {(x: number) => number} 肩稜線的基本高度：後輪臀拱起（31.5），座艙兩側 28，往前斜降成鏟鼻的側緣（鼻尖 13） */
const ySBase = monoCurve(XS, [29.4, 30.4, 31.2, 31.5, 31, 29.2, 28, 28, 28.4, 28.2, 27.6, 25.2, 20.4, 17.4, 15.4, 14, 13]);
/** @type {(x: number) => number} 中線殼頂的基本高度：後甲板 33.5，前軸之前是從座艙一路斜降到鼻尖（13.8）的長楔形面 */
const yTopBase = monoCurve(XS, [31.4, 32.4, 33.2, 33.6, 33.6, 33.2, 32.6, 32.4, 32.1, 31.4, 30.4, 26.5, 21.4, 18.7, 16.7, 15.1, 13.8]);

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
  // 俯視半寬（肩稜線）：四視圖 08 的俯視——車身窄、四輪的胎面露在車身外側；後輪臀 ±31.5（車尾收到 ±11，扇翼從上方往外展開）、
  // 座艙後段收成細腰 ±24.6、座艙前的胸 ±29.6、前輪上方 ±27.6；前擋泥板在 x 54.2–55.6 收進輪拱切口邊界（|z| = 22.5）以內，
  // 之後是夾在兩個擋泥板之間的尖鏟鼻（x 58 半寬 ±15.6、x 64 ±10.6，鼻尖 ±1.6）
  hw: monoCurve(XS_HW, [11, 16.5, 24, 30, 31.5, 27.5, 24.6, 25.2, 28.6, 29.6, 28.2, 27.6, 26.4, 25.2, 23.5, 20.2, 15.6, 12.8, 10.6, 7.6, 4.6, 1.6]),
  // 肩稜線高度（頂面與側面交界）：前輪上方沿眉線圓弧拱起，整個前輪拱都在肩稜線下方的側壁上
  yS: (x) => smoothMax(ySBase(x), browY(x), 1.2),
  // 中線殼頂：中線始終比肩稜線高 ≥ 0.5（鼻面不會出現橫越兩側的折稜），引擎蓋會被輪拱擦到的地方再墊高（yTopMin）
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
  // 側裙外張量隨半寬縮小：鼻尖很窄時不外張
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

/** @type {{ x: number, pts: number[][] }[]} 車尾與車鼻（含前擋泥板前緣）每約 1.3–1.4 mm 一站，中段每 2.4 mm */
const STATIONS = [...buildStations(-70, -60, 1.4, profile).slice(0, -1), ...buildStations(-60, 54, 2.4, profile).slice(0, -1), ...buildStations(54, 75.5, 1.3, profile)];

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
const CANOPY = { x0: 30, x1: -24, peakX: -6, rise: 12, halfW: 14 };

/**
 * 白色下裙板的上緣（四視圖 08 側面的白色下半部）：前輪後方從裙邊上 3.5 mm 起，往後斜升到後輪臀肩稜線下 4 mm，
 * 朱紅車身在側視是一道從鼻尖往後上揚的楔形
 * @type {(x: number) => number}
 */
const ySplit = (x) => lerp(P.yLow(x) + 3.5, ySBase(x) - 4, smoothstep(30, -55, x));

/**
 * 黑漆底緣的高度（側裙最下面一圈黑漆）：前軸之後 2.2 mm，往鼻尖收到 0
 * @type {(x: number) => number}
 */
const baseBand = (x) => 2.2 * smoothstep(72, 56, x);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 朱紅：車身主色（亮面漆）
  vermilion: namedMaterial('paint-vermilion-shu', { color: 0xd43a1c, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 珍珠白：下裙板與尾刃
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
  // 寶珠：琥珀金，微弱自發光（強度壓低，Blender 不過曝）
  jewel: namedMaterial('lamp-jewel-amber', { color: 0xffc860, emissive: 0xffa030, emissiveIntensity: 0.35, roughness: 0.15, clearcoat: 1.0 }),
  dGold: decalMaterial('decal-gold-makie', { color: 0xd4b052, metalness: 0.75, roughness: 0.32 }),
  dUrushi: decalMaterial('decal-urushi-black', { color: 0x141416, roughness: 0.5, clearcoat: 0.2 }),
  dWhite: decalMaterial('decal-pearl-white', { color: 0xf4f2ec, roughness: 0.32, clearcoat: 0.6 }),
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
 * 九片扇形尾翼（九尾 → 四視圖 08 的尖刃尾翼擴成一把九摺的扇）：扇軸在座艙正後方的後甲板上，
 * 九片摺面從扇軸往後放射、邊對邊相接成一整面扇翼，每片外緣收成一個尖角（九個尖角 = 九條尾巴），
 * 整面扇翼往後上揚（側視是一道從後甲板往後上翹的長刃）；外側兩片斜伸到後輪臀上方（四視圖俯視那兩片斜刃）。
 * span = 總張角（度）；rTip = 中央 / 最外側尖刃半徑；lobe = 尖刃長度；pitch = 上揚角（度）；fold = 摺稜高度比例
 * @type {{ x: number, rIn: number, span: number, rTip: number[], lobe: number, pitch: number, fold: number, thick: number }}
 */
const FAN = { x: -25, rIn: 4, span: 160, rTip: [53, 46], lobe: 22, pitch: 13, fold: 0.16, thick: 0.9 };
/** @type {number} 摺數 */
const FAN_PLEATS = 9;

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
 * 九摺扇翼，依顏色分組：白色摺面與尖刃前半、金色刃尖。每摺是一段沿半徑的封閉斷面（左緣、上摺稜、右緣、下摺稜），
 * 左右緣落在相鄰摺的分界射線上 → 九摺邊對邊相接；摺稜比兩緣高，整面扇有明暗交替的摺痕。
 * 扇面以扇軸為支點往後上揚 pitch，扇軸高度 = 後甲板殼面 + 0.3
 * @type {(surf: any) => { body: THREE.BufferGeometry, tip: THREE.BufferGeometry, pivotY: number }}
 */
const buildFan = (surf) => {
  const pivotY = surfaceTopY(surf, FAN.x, 0) + 0.3;
  const delta = FAN.span / FAN_PLEATS;
  const tanP = Math.tan((FAN.pitch * Math.PI) / 180);
  /** @type {(deg: number) => number[]} 俯視方向（往後為 0°、+z 為正） */
  const dir = (deg) => [-Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  /** @type {(px: number, pz: number, dy: number) => number[]} 扇面上的點（含上揚） */
  const onFan = (px, pz, dy) => [FAN.x + px, pivotY + -px * tanP + dy, pz];
  /** @type {THREE.BufferGeometry[]} */
  const bodies = [];
  /** @type {THREE.BufferGeometry[]} */
  const tips = [];
  for (let k = 0; k < FAN_PLEATS; k++) {
    const th = -FAN.span / 2 + delta * (k + 0.5);
    const q = Math.abs(th) / (FAN.span / 2 - delta / 2);
    const rTip = lerp(FAN.rTip[0], FAN.rTip[1], q ** 1.4);
    const rEdge = rTip - FAN.lobe;
    const [lx, lz] = dir(th - delta / 2);
    const [rx, rz] = dir(th + delta / 2);
    const [cx, cz] = dir(th);
    /** @type {(r: number, shrink: number) => number[][]} 半徑 r 處的斷面環；shrink 0 → 1 往尖角收 */
    const ring = (r, shrink) => {
      const re = Math.min(r, rEdge);
      const tipPt = [cx * rTip, cz * rTip];
      const L = [lerp(lx * re, tipPt[0], shrink), lerp(lz * re, tipPt[1], shrink)];
      const R = [lerp(rx * re, tipPt[0], shrink), lerp(rz * re, tipPt[1], shrink)];
      const C = [cx * lerp(re, rTip, shrink), cz * lerp(re, rTip, shrink)];
      const halfW = Math.hypot(L[0] - R[0], L[1] - R[1]) / 2;
      const up = Math.max(0.15, FAN.fold * halfW) + FAN.thick / 2;
      const down = FAN.thick / 2;
      return [onFan(L[0], L[1], 0), onFan(C[0], C[1], up), onFan(R[0], R[1], 0), onFan(C[0], C[1], -down)];
    };
    bodies.push(closedLoft([ring(FAN.rIn, 0), ring(rEdge * 0.5, 0), ring(rEdge, 0), ring(rEdge, 0.5)]));
    tips.push(closedLoft([ring(rEdge, 0.5), ring(rEdge, 0.75), ring(rEdge, 0.97)]));
  }
  return { body: mergeGeos(bodies), tip: mergeGeos(tips), pivotY };
};

/**
 * 火焰寶珠徽記（俯視，畫在鼻面中線上）：金色寶珠包在白色火團裡，兩側火舌與中央火舌往後拖（中央最長），像被迎面風往後吹
 * @type {{ jewel: (x: number, z: number) => number, flame: (x: number, z: number) => number }} 正值 = 在圖形內
 */
const JEWEL_EMBLEM = (() => {
  /** @type {number[][]} 火舌：[起點 x, 起點 |z|, 終點 x, 終點 |z|, 起點半徑] */
  const tongues = [
    [52, 0, 31, 0, 5.2],
    [51, 3, 35, 9.5, 3],
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
  return { jewel: (x, z) => 3.2 - Math.hypot(x - 52, z), flame };
})();

/**
 * 側面斜進氣口（四視圖 08 前輪後方的進氣口，畫在白色裙板上）：前後緣往後傾的平行四邊形（黑漆）
 * @type {(x: number, y: number) => number} 正值 = 黑色區域
 */
const sideIntake = (x, y) => {
  const lo = P.yLow(x) + baseBand(x) + 1.6;
  const hi = ySplit(x) - 1.6;
  const shear = 0.9 * (y - lo);
  return Math.min(-1 - shear - x, x + shear + 21, y - lo, hi - y);
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
  theme: '照四視圖 08 重新建模：尖鏟形長鼻、一路斜升的楔形背線、前移的多面切削座艙罩、細腰配外擴後輪臀；九尾化成車尾九片往後上揚放射的摺扇尾刃（白刃金尖），朱紅車身、白色下裙板與斜進氣口，鼻面一枚拖著白焰的金寶珠',
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
    // 白色下裙板（往後斜升的分色線以下）
    { mat: 'white', keep: (x, y, z) => Math.min(ySplit(x) - y, Math.abs(z) - 12) },
    // 朱紅車身
    { mat: 'vermilion', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'vermilion' }],
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
    // 九摺扇翼（實體件）：白色摺面、金色尖角；扇軸上壓一顆金色扇軸釘（摺扇的「要」，16×10 段）
    const fan = buildFan(kit.surf);
    parts.push({ geometry: fan.body, mat: 'white', solid: true, outline: true, name: 'fan-pleats' });
    parts.push({ geometry: fan.tip, mat: 'gold', solid: true, outline: true, name: 'fan-pleat-tips' });
    const pivot = new THREE.SphereGeometry(1, 16, 10);
    pivot.scale(6, 2.2, 6);
    pivot.translate(FAN.x, fan.pivotY + 0.4, 0);
    parts.push({ geometry: pivot, mat: 'gold', solid: true, outline: true, name: 'fan-pivot' });

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
    // 火焰寶珠徽記（鼻面中線）：白色火舌（挖掉寶珠的位置）＋琥珀金寶珠
    parts.push({
      geometry: kit.decal((x, y, z) => (y < 20 ? -1 : Math.min(JEWEL_EMBLEM.flame(x, z), -JEWEL_EMBLEM.jewel(x, z), -kit.underCanopy(x, z) - 0.6))),
      mat: 'dWhite',
      name: 'decal-jewel-flames',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (y < 20 ? -1 : JEWEL_EMBLEM.jewel(x, z)), { offset: 0.1 }),
      mat: 'jewel',
      name: 'lamp-flame-jewel',
    });
    // 分色線上的金蒔繪細線（線寬 0.7，從前輪後方往後斜升到車尾）
    parts.push({
      geometry: kit.decal((x, y) => Math.min(0.35 - Math.abs(y - (ySplit(x) + 0.35)), 21 - x, x + 69, y - P.yLow(x) - baseBand(x) - 0.4)),
      mat: 'dGold',
      name: 'decal-makie-beltline',
    });
    // 側面斜進氣口（黑漆）
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < 22 ? -1 : sideIntake(x, y))),
      mat: 'dUrushi',
      name: 'decal-side-intake',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估，造型照 shared/design/body-kitsune-ninetail/fourview.png 四視圖 08 與 fourview_trace.txt 的比例，尺寸照底盤）：殼長 145.5（車尾 −70 ~ 鼻尖 75.5）、外框長 152.8（扇翼尖刃到 −77.3）；後甲板 33.6、鼻尖頂 13.8、座艙頂約 44.6、扇翼尖刃 46.2（全車最高）；後輪臀 ±31.5、細腰 ±24.6、胸 ±29.6、前輪上方 ±27.6（胎面露在車身外）、鼻 ±15.6 → ±1.6；前擋泥板眉線為前輪拱同心圓 R18.5',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    fan: '九摺扇翼為 ABS 實心摺片（推估）：扇軸 x −25（後甲板殼面上 0.3）、內半徑 4、總張角 160°、尖刃半徑中央 53 → 最外側 46、尖刃長 22、往後上揚 13°、厚 0.9 + 摺稜高 0.16 × 半寬；尖刃後半為金色；扇軸釘 R6 × 2.2（16×10 段）；質量 = 封閉體積 × 1.05 g/cm³',
    palette: '朱紅主色＋珍珠白下裙板與尾刃＋黑漆底緣與座艙框＋金（扇翼刃尖、扇軸釘、腰線）；朱、白、漆黑、金的色碼參考 MYTH_RESEARCH 6-2（朱 #C8372D、白 #F7F5F0、漆黑 #1B1B1B、金 #C9A54A，推估），實際用 #D43A1C、#F4F2EC、#141416',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
