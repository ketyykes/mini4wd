// 索爾的山羊戰車（body-tanngrisnir-chariot，神話組・北歐）：《散文埃達》中索爾乘坐、由兩頭公山羊 Tanngrisnir 與 Tanngnjóstr 拉的戰車。
// 車上不做山羊本體，只取「戰車」「羊角」與「雷」三個元素做成賽車零件與塗裝。
// 造型照四視圖 25（shared/design/body-tanngrisnir-chariot/fourview.png）：
// 側視是細長低鼻 → 斜升的引擎蓋 → 中段黑色亮面艙蓋 → 和座艙頂幾乎一樣高的方正平頂車斗 → 垂直切平的方正車尾；
// 俯視是一面往前尖的六角形軛形鼻、前擋泥板夾著它、兩輪之間收腰，車尾是整片全寬的方框平板；正視中央是 V 形的軛。
// 戰車 → 雙轅與軛：鼻面中央一面凸起的暗紅六角盾（金框、盾面中央淺淺凸起），兩根鍛銀轅桿從盾的兩肩起、沿座艙兩側一路往後接到車尾的方框車斗板；
//          車尾是戰車車斗的方正後板：全寬的鍛銀方框平板（暗紅鑲面）壓在平頂車斗上；側面後輪拱前上方一面 10 輻戰車輪徽記。
// 羊角 → 車斗板兩端一對小金色渦卷端板（捲 1.5 圈、外緣有節環）。
// 雷 → 鋸齒切割塗裝：側面上半一條暗紅帶，下緣是一排往後倒的鋸齒（單一道鋸齒邊，不是雷紋符號），沿鋸齒一道鍛銀細邊；側進氣口裡一排鍛銀百葉。
// 設計：shared/design/body-tanngrisnir-chariot/DESIGN.md（典故 MYTH_RESEARCH N12、N16；車斗語彙 N3 Oseberg 四輪木車；黑名單 H6 不放雷神之鎚、不用盧恩）。
// 塗裝全為自創：暗紅亮面漆（主色）＋鐵灰（緞面）＋鍛銀＋拋光金；不畫人、不放鎚、不用盧恩字母或任何被挪用的符號，不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位節點（x 由後到前；前後軸 x = ±40；方正車尾 −60、鼻尖 72） */
const XS = [-60, -57, -50, -40, -28, -18, -8, 2, 12, 22, 32, 44, 54, 62, 68, 72];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 車斗 / 引擎蓋線（艙蓋兩側的高度）：鼻尖 17 → 斜升 → 座艙後起是平頂車斗 33.4
  yD: monoCurve(XS, [33.4, 33.4, 33.4, 33.4, 33.2, 32.8, 32, 31, 30, 28.8, 27.4, 25.2, 22.8, 20.4, 18.6, 17]),
  // 中線頂（含座艙泡）：座艙頂 36.2（x 2），座艙後端和平頂車斗 33.8 接齊
  yC: monoCurve(XS, [33.8, 33.8, 33.8, 33.8, 33.8, 34.6, 35.8, 36.2, 35.2, 31.4, 28, 25.6, 23.2, 20.8, 19, 17.4]),
  // 擋泥板稜：前輪 32.8（31 mm 輪拱頂 30.5 之上）、兩輪之間降成腰線、後段和車斗平頂齊平 33.8
  yF: monoCurve(XS, [33.8, 33.8, 33.8, 33.8, 33.6, 32.8, 31.6, 30.8, 30.8, 31.6, 32.6, 32.8, 29, 23.4, 20.2, 18]),
  // 艙蓋（點 1）半寬
  cw: monoCurve(XS, [10, 10, 10, 10, 10, 10.4, 11.4, 11.8, 11.2, 9.4, 7, 5.6, 4.8, 4.2, 3.8, 3.4]),
  // 半寬：尖軛鼻 7 → 前輪擋泥板 35.5（蓋過前輪胎外緣）→ 兩輪之間 35（側壁蓋到底盤側框外）→ 方正車斗 45 從 x −28 一路到車尾（俯視前尖後方）
  hw: monoCurve(XS, [45, 45, 45, 45, 44.5, 38.5, 35.5, 35, 35.5, 35.5, 35.5, 34, 21, 13.5, 10, 7]),
  // 最寬處（側壁頂稜）高度
  yS: monoCurve(XS, [28.6, 28.6, 28.4, 28, 27, 25.6, 24.6, 24.4, 24.6, 25, 25.2, 25, 23, 20.2, 18.6, 17.2]),
  // 側壁下緣：輪拱處 16（戰車車斗架在輪上），兩輪之間壓低到 11.5 當側裙，把底盤側框整段蓋住
  yLow: monoCurve(XS, [16.4, 16.2, 16, 16, 15, 13, 11.5, 11.5, 11.5, 13, 16, 16, 16, 15.8, 15.6, 15.4]),
};

/** @type {number} 艙蓋前端 x */
const CANOPY_X1 = 24;
/** @type {number} 艙蓋後端 x */
const CANOPY_X0 = -22;

/**
 * 半剖面 7 點：座艙頂 → 艙蓋邊 → 車斗 / 引擎蓋外緣 → 擋泥板稜 → 側壁頂稜（切角）→ 垂直側壁 → 側壁下緣；點 1–5 是稜線（方正的箱形斷面）。
 * 引擎蓋外緣最寬到 |z| 17.5、擋泥板稜最外到 |z| 25：輪胎（內側 |z| 24.7）上方整片是擋泥板頂，31 mm 輪也有 1 mm 以上間隙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = P.hw(x);
  const yS = P.yS(x);
  const yLow = P.yLow(x);
  return [
    [0, P.yC(x)],
    [P.cw(x), P.yD(x)],
    [Math.max(P.cw(x) + 1.5, Math.min(0.5 * hw, 17.5)), P.yD(x) - 0.3],
    [Math.max(P.cw(x) + 3.5, Math.min(0.8 * hw, 25)), P.yF(x)],
    [hw, lerp(P.yF(x), yS, 0.55)],
    [hw, yS],
    [hw - 1.2, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 每 2 mm 一站 */
const STATIONS = buildStations(-60, 72, 2, profile);

/**
 * 外殼在 (x, y) 高度的 |z|（沿剖面折線內插），給輪拱內襯定位用
 * @type {(x: number, y: number) => number}
 */
const shellZAt = (x, y) => {
  const pts = profile(x);
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (y >= lo && y <= hi && hi - lo > 1e-6) {
      return lerp(z0, z1, (y - y0) / (y1 - y0));
    }
  }
  return y > pts[0][1] ? 0 : pts[pts.length - 1][0];
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 主體：鐵灰（緞面）；paint- 且 roughness > 0.5 → Blender 緞面
  iron: namedMaterial('paint-forged-iron-grey', { color: 0x4a4d53, roughness: 0.54, clearcoat: 0.15, clearcoatRoughness: 0.45 }),
  // 圖形色：暗紅亮面漆
  red: namedMaterial('paint-oxblood-red', { color: 0x6e1416, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
  // 轅桿、框：鍛銀（名稱含 -steel；metalness 高）
  steel: namedMaterial('trim-forged-silver-steel', { color: 0xc9cdd3, metalness: 0.85, roughness: 0.25, clearcoat: 0.3 }),
  // 六角盾框、羊角渦卷端板：拋光金（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-shield-gold-brass', { color: 0xe0b450, metalness: 0.9, roughness: 0.24, clearcoat: 0.3 }),
  // 凸起的六角盾面：暗紅亮面漆（實體件）
  redShield: namedMaterial('paint-oxblood-shield', { color: 0x6e1416, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
  dGold: decalMaterial('decal-wheel-gold', { color: 0xe0b450, metalness: 0.85, roughness: 0.26, clearcoat: 0.3 }),
  dDark: decalMaterial('decal-wheel-disc-dark', { color: 0x16171a, roughness: 0.7 }),
  // 封閉車頂的駕駛艙蓋：黑色亮面漆（不透明）
  canopy: namedMaterial('paint-hood-gloss-black', { color: 0x16171a, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1d20, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-iron', { color: 0x2e3034, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-iron', { color: 0x2a2c30, roughness: 0.7, side: THREE.DoubleSide }),
  dSilver: decalMaterial('decal-forged-silver', { color: 0xd4d8de, metalness: 0.8, roughness: 0.24, clearcoat: 0.3 }),
  dVent: decalMaterial('decal-intake-dark', { color: 0x0d0e10, roughness: 0.8 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

// ---------------------------------------------------------------------------
// 軛板、雙轅、車斗板
// ---------------------------------------------------------------------------

/**
 * 雙轅的路徑（|z| 側）：從六角盾的肩外側起，沿盾邊、座艙兩側往後，接到車尾的車斗板前緣
 * @type {number[][]} 每點 [x, |z|]
 */
const POLE_PATH = [
  [63.5, 13.4],
  [56, 14],
  [48, 14],
  [34, 13.2],
  [18, 13.4],
  [2, 14.6],
  [-14, 14.2],
  [-30, 15],
  [-42, 16.4],
  [-50.5, 17],
];

/** @type {{ x0: number, x1: number, hz: number }} 車尾車斗板（鍛銀方框，暗紅鑲面） */
const DECK_PLATE = { x0: -60.6, x1: -49.5, hz: 47 };

/**
 * 側面暗紅鋸齒帶的下緣高度（雷的鋸齒切割）：齒距 9 mm、往後倒（前 85% 緩升、後 15% 陡降），齒高 2.6 mm；
 * 整條從車頭 22 往後降到車尾 23.6（跟著側壁頂稜）
 * @type {(x: number) => number}
 */
const sawY = (x) => {
  const u = (((70 - x) / 9) % 1 + 1) % 1;
  const saw = u < 0.85 ? u / 0.85 : (1 - u) / 0.15;
  return lerp(21, 23.4, Math.max(0, Math.min(1, (60 - x) / 120))) + 2.6 * saw;
};

/**
 * 側進氣口（側視，收腰處）：回傳正值 = 在進氣口內
 * @type {(x: number, y: number) => number}
 */
const intakeSd = (x, y) => {
  const top = 21.6 - y;
  const bot = y - 17.2;
  const front = 10 - 0.9 * (21.6 - y) - x;
  const rear = x + 14;
  return Math.min(top, bot, front, rear);
};

/** @type {(x: number, z: number) => boolean} 側面（擋泥板稜以外） */
const onSide = (x, z) => Math.abs(z) > 0.9 * P.hw(x);

/** @type {(x: number, z: number) => boolean} 垂直側壁（不含上方的切角面） */
const onWall = (x, z) => Math.abs(z) > P.hw(x) - 0.6;

// ---------------------------------------------------------------------------
// 凸起的六角盾鼻、羊角渦卷端板、戰車輪徽記
// ---------------------------------------------------------------------------

/**
 * 鼻面六角盾（俯視 (x, |z|) 的半邊頂點，順時針）：尖端 x 71、肩 x 62 半寬 12.5、後肩 x 49、後尖 x 45；左右對稱成六角形
 * @type {number[][]}
 */
const SHIELD = [
  [71, 0],
  [62, 12.5],
  [49, 12.5],
  [45, 0],
  [49, -12.5],
  [62, -12.5],
];

/** @type {number[]} 六角盾的中心（放射三角化的原點） */
const SHIELD_C = [57, 0];

/**
 * 凸起板（俯視多邊形從中心放射三角化）：頂面是順著鼻面斜度的平面，比殼面最高點高 hEdge、中心再高 crown（中央凸起），
 * 板厚 0.8 mm、側牆埋進殼面 0.3 mm（封閉實體）；scale < 1 時多邊形往中心縮
 * @type {(poly: number[][], center: number[], scale: number, hEdge: number, crown: number, topY: (x: number, z: number) => number) => THREE.BufferGeometry}
 */
const buildRaisedPlate = (poly, center, scale, hEdge, crown, topY) => {
  const per = 6;
  const rings = 6;
  /** @type {number[][]} 外緣取樣點 */
  const rim = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      rim.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
    }
  }
  const n = rim.length;
  /** @type {number} 板的最大半寬（橫向取樣範圍） */
  const zMax = Math.max(...poly.map((q) => Math.abs(q[1])));
  /** @type {(x: number) => number} 同一 x 橫跨整片板寬的殼面最高點 */
  const ridgeY = (x) => {
    let y = -Infinity;
    for (let k = 0; k <= 10; k++) {
      y = Math.max(y, topY(x, (zMax * k) / 10));
    }
    return y;
  };
  // 盾面是一個平面：斜率取前後兩端最高點的連線，再整片抬到每個 x 都不低於殼面最高點
  const xs = poly.map((q) => q[0]);
  const xLo = Math.min(...xs);
  const xHi = Math.max(...xs);
  const slope = (ridgeY(xHi) - ridgeY(xLo)) / (xHi - xLo);
  let lift = -Infinity;
  for (let k = 0; k <= 26; k++) {
    const x = lerp(xLo, xHi, k / 26);
    lift = Math.max(lift, ridgeY(x) - slope * (x - xLo));
  }
  /** @type {(x: number) => number} 盾面平面的高度（不含 hEdge） */
  const flatY = (x) => lift + slope * (x - xLo);
  /** @type {(i: number, s: number) => number[]} 第 i 個外緣點往中心第 s 圈（s = 1 在外緣）的頂面座標 */
  const topAt = (i, s) => {
    const x = center[0] + (rim[i % n][0] - center[0]) * scale * s;
    const z = center[1] + (rim[i % n][1] - center[1]) * scale * s;
    return [x, flatY(x) + hEdge + crown * (1 - s), z];
  };
  /** @type {(q: number[]) => number[]} 外緣往下埋進殼面 0.3 mm 的點 */
  const sink = (q) => [q[0], topY(q[0], q[2]) - 0.3, q[2]];
  /** @type {(i: number, s: number) => number[]} 底面點：外緣埋進殼面，內部是頂面往下 0.8 mm（薄板，下方和殼面之間由側牆封住） */
  const botAt = (i, s) => {
    const q = topAt(i, s);
    return s >= 1 ? sink(q) : [q[0], q[1] - 0.8, q[2]];
  };
  /** @type {number[]} */
  const pos = [];
  for (let r = 0; r < rings; r++) {
    const s0 = r / rings;
    const s1 = (r + 1) / rings;
    for (let i = 0; i < n; i++) {
      const a = topAt(i, s0);
      const b = topAt(i + 1, s0);
      const c = topAt(i + 1, s1);
      const d = topAt(i, s1);
      // 頂面與底面（底面反向，整塊是封閉實體）
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      pos.push(...botAt(i, s0), ...botAt(i + 1, s0), ...botAt(i + 1, s1), ...botAt(i, s0), ...botAt(i + 1, s1), ...botAt(i, s1));
    }
  }
  // 側牆：外緣往下埋進殼面 0.3 mm
  for (let i = 0; i < n; i++) {
    const a = topAt(i, 1);
    const b = topAt(i + 1, 1);
    pos.push(...b, ...a, ...sink(a), ...b, ...sink(a), ...sink(b));
  }
  // 依有號體積決定朝向：體積為負就整體翻面，讓法向朝外
  let vol = 0;
  for (let k = 0; k < pos.length; k += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = pos.slice(k, k + 9);
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  if (vol < 0) {
    for (let k = 0; k < pos.length; k += 9) {
      for (let m = 0; m < 3; m++) {
        const tmp = pos[k + 3 + m];
        pos[k + 3 + m] = pos[k + 6 + m];
        pos[k + 6 + m] = tmp;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @type {{ x: number, r: number, pitch: number, turns: number, z: number, thick: number }} 羊角渦卷端板：螺旋中心 x、外半徑、每圈內縮量、圈數、端板中心 |z|、板厚 */
const VOLUTE = { x: -55, r: 5, pitch: 2.3, turns: 1.5, z: 46.2, thick: 1.6 };

/**
 * 渦卷端板的側視輪廓：一條由粗到細的帶子（寬 2.0 → 1.0 mm）從上前方起、往後往下捲 1.5 圈收到中心，
 * 外緣前段有節環起伏（羊角的橫稜，振幅 0.3 mm 往內遞減）；cy 是螺旋中心高度
 * @type {(cy: number) => number[][]}
 */
const voluteOutline = (cy) => {
  const n = 48;
  /** @type {number[][]} */
  const outer = [];
  /** @type {number[][]} */
  const inner = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = (70 * Math.PI) / 180 + 2 * Math.PI * VOLUTE.turns * s;
    const ridge = 0.3 * Math.max(0, 1 - s / 0.7) * Math.cos(2 * Math.PI * 9 * (s / 0.7));
    const ro = VOLUTE.r - VOLUTE.pitch * VOLUTE.turns * s;
    const ri = ro - lerp(2.0, 1.0, s);
    outer.push([VOLUTE.x + (ro + ridge) * Math.cos(a), cy + (ro + ridge) * Math.sin(a)]);
    inner.push([VOLUTE.x + ri * Math.cos(a), cy + ri * Math.sin(a)]);
  }
  return [...outer, ...inner.reverse()];
};

/** @type {{ x: number, y: number, r: number, spokes: number }} 側面戰車輪徽記：後輪拱前上方的側板，10 根輻條（不做四輻十字輪） */
const EMBLEM = { x: -20.5, y: 24.4, r: 4.8, spokes: 10 };

/**
 * 戰車輪徽記的各層距離場（負值在內）：底盤（深色圓盤）、金輪輞（tire 與 felloe 同一圈）、輻條、輪轂
 * @type {(x: number, y: number) => { disc: number, tire: number, felloe: number, spoke: number, hub: number }}
 */
const emblemSd = (x, y) => {
  const W = EMBLEM;
  const dx = x - W.x;
  const dy = y - W.y;
  const r = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  /** @type {number} 每根輻條的角距 */
  const step = (2 * Math.PI) / W.spokes;
  // 第一根輻條轉半格，讓輻條不落在正上下、正前後（避免讀成十字）
  const k = Math.round((a - step / 2) / step);
  const da = a - step / 2 - k * step;
  const spokeD = Math.max(r * Math.abs(Math.sin(da)) - 0.3, 0.9 - r, r - (W.r - 1.0));
  return {
    disc: r - W.r,
    tire: Math.abs(r - (W.r - 0.45)) - 0.38,
    felloe: Math.abs(r - (W.r - 0.45)) - 0.38,
    spoke: spokeD,
    hub: r - 1.2,
  };
};

/**
 * 輪拱內襯（參考 zeppelin-xtail 的 buildHullLiner）：輪拱切口後面上半圈圓柱面，z 從殼內面（外殼 |z| − 1.2）往內 depth
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 16;
  /** @type {number[]} */
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = 0.2 + ((Math.PI - 0.4) * i) / n;
      const t1 = 0.2 + ((Math.PI - 0.4) * (i + 1)) / n;
      const x0 = arch.x + r * Math.cos(t0);
      const y0 = arch.y + r * Math.sin(t0);
      const x1 = arch.x + r * Math.cos(t1);
      const y1 = arch.y + r * Math.sin(t1);
      if (y0 < P.yLow(x0) + 0.4 || y1 < P.yLow(x1) + 0.4) {
        continue;
      }
      const zo0 = shellZAt(x0, y0) - 1.2;
      const zo1 = shellZAt(x1, y1) - 1.2;
      // 殼面在輪拱切口起點（|z| 23.5）以內的地方沒有被切開，不需要內襯
      if (zo0 < 24 || zo1 < 24) {
        continue;
      }
      const A = [x0, y0, sg * Math.max(23.5, zo0 - depth)];
      const B = [x1, y1, sg * Math.max(23.5, zo1 - depth)];
      const C = [x1, y1, sg * zo1];
      const D = [x0, y0, sg * zo0];
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
 * 箱形實體（x0–x1、y0–y1、|z| ≤ hz）
 * @type {(x0: number, x1: number, y0: number, y1: number, hz: number) => THREE.BufferGeometry}
 */
const box = (x0, x1, y0, y1, hz) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, 2 * hz);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  return g;
};

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23.5 },
];

export const tanngrisnirChariotBody = makePolyBody({
  id: 'body-tanngrisnir-chariot',
  name: '索爾的山羊戰車',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'thor-goat-chariot',
  form: 'yoke-box-chariot',
  roof: 'closed',
  wing: 'chariot-deck-plate',
  theme: '索爾的山羊戰車（軛鼻方斗）：細長低鼻斜升到中段黑色亮面艙蓋，座艙後是和座艙頂幾乎齊高的方正平頂車斗、垂直切平的車尾；鼻面中央一面凸起的暗紅六角盾（金框），兩根鍛銀轅桿從盾肩起沿座艙兩側一路接到車尾全寬的鍛銀方框車斗板，板的兩端是一對小金色羊角渦卷端板；暗紅車身側面下緣一排往後倒的雷鋸齒切割加鍛銀細邊、以下是鐵灰側裙，後輪拱前上方一面 10 輻金色戰車輪徽記，側進氣口裡一排鍛銀百葉',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格邊長 0.7 mm（箱形車斗表面積大，放寬網格讓碰撞格耗時壓在 1000 ms 內）
  step: 0.7,
  // 點 1–5 是稜線（艙蓋邊、車斗外緣、擋泥板稜、側壁切角、側壁頂稜）
  hard: [1, 2, 3, 4, 5],
  wheelArches: ARCHES,
  sideZMin: 30,
  zones: () => [
    // 封閉的駕駛艙蓋（黑色亮面）
    {
      mat: 'canopy',
      keep: (x, y, z) => Math.min(P.cw(x) - 0.4 - Math.abs(z), x - CANOPY_X0, CANOPY_X1 - x, y - P.yD(x) - 0.25),
    },
    // 側面鋸齒線以下：鐵灰
    { mat: 'iron', keep: (x, y, z) => (onSide(x, z) && x < 60 ? sawY(x) - y : -1) },
    // 主色：暗紅亮面漆（引擎蓋、車斗平頂、擋泥板、側面上半）
    { mat: 'red', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'iron', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 雙轅：左右兩根鍛銀桿（橢圓斷面 1.3 × 0.9 mm），貼著殼面上 0.5 mm
    /** @type {THREE.BufferGeometry[]} */
    const poles = [];
    for (const sg of [-1, 1]) {
      const pts = POLE_PATH.map(([x, az]) => [x, kit.surf.topY(x, az) + 0.5, sg * az]);
      poles.push(sweepEllipse(pts, 48, (t) => [1.3, lerp(0.7, 0.95, Math.min(1, t * 4))], 8));
    }
    parts.push({ geometry: mergeGeos(poles), mat: 'steel', solid: true, outline: true, name: 'twin-chariot-poles' });
    // 車尾車斗板：鍛銀方框（厚 1.6，下 0.4 埋進殼面）上壓一片暗紅鑲面（內縮 1.2、高出 0.3）
    const yTop = kit.surf.topY(-55, 0);
    parts.push({
      geometry: box(DECK_PLATE.x0, DECK_PLATE.x1, yTop - 0.4, yTop + 1.2, DECK_PLATE.hz),
      mat: 'steel',
      solid: true,
      outline: true,
      name: 'chariot-deck-frame',
    });
    parts.push({
      geometry: box(DECK_PLATE.x0 + 1.2, DECK_PLATE.x1 - 1.2, yTop + 1.1, yTop + 1.5, DECK_PLATE.hz - 1.2),
      mat: 'red',
      solid: true,
      name: 'chariot-deck-inlay',
    });
    // 鼻面凸起的六角盾：平面金框底板（高出殼面最高點 0.6）上疊一片內縮的暗紅盾面（邊緣高 0.75、中央再凸起 0.9，成淺淺的六角錐）
    parts.push({
      geometry: buildRaisedPlate(SHIELD, SHIELD_C, 1, 0.6, 0, kit.surf.topY),
      mat: 'gold',
      solid: true,
      outline: true,
      name: 'yoke-shield-frame',
    });
    parts.push({
      geometry: buildRaisedPlate(SHIELD, SHIELD_C, 0.84, 0.75, 0.9, kit.surf.topY),
      mat: 'redShield',
      solid: true,
      name: 'yoke-shield-face',
    });
    // 車斗板兩端的一對小金色羊角渦卷端板
    const voluteCy = kit.surf.topY(-55, 0) + 2.2;
    parts.push({
      geometry: mergeGeos([-1, 1].map((sg) => finPlate(voluteOutline(voluteCy), sg * VOLUTE.z, VOLUTE.thick))),
      mat: 'gold',
      solid: true,
      outline: true,
      name: 'horn-volute-endplates',
    });
    // 戰車輪徽記：深色底盤 → 金輪箍＋輪轂 → 金輪輞與 10 根輻條
    parts.push({
      geometry: kit.decal((x, y, z) => (onWall(x, z) ? -emblemSd(x, y).disc : -1), { offset: 0.16 }),
      mat: 'dDark',
      name: 'decal-wheel-emblem-disc',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onWall(x, z)) {
          return -1;
        }
        const w = emblemSd(x, y);
        return -Math.min(w.tire, w.felloe, Math.max(w.spoke, -w.hub), w.hub);
      }, { offset: 0.24 }),
      mat: 'dGold',
      name: 'decal-wheel-emblem-rim',
    });
    // 鋸齒線上一道鍛銀細邊（0.8 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 60 || emblemSd(x, y).disc < 0.6) {
          return -1;
        }
        return 0.4 - Math.abs(y - sawY(x) + 0.4);
      }, { offset: 0.1 }),
      mat: 'dSilver',
      name: 'decal-thunder-saw-edge',
    });
    // 側進氣口暗底
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? Math.min(intakeSd(x, y), sawY(x) - 0.9 - y) : -1), { offset: 0.08 }),
      mat: 'dVent',
      name: 'decal-side-intake',
    });
    // 側進氣口裡的鍛銀百葉（水平 3 道）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || intakeSd(x, y) < 0.6 || sawY(x) - 1.5 - y < 0) {
          return -1;
        }
        const k = Math.round((y - 18.4) / 1.5);
        return 0.3 - Math.abs(y - 18.4 - 1.5 * k);
      }, { offset: 0.14 }),
      mat: 'dSilver',
      name: 'decal-intake-louvers',
    });
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildLiner(a, 3))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P（推估，比例取自四視圖 25 後縮到底盤）：車殼 x −60 ~ 72；中線鼻尖 17.4 → 座艙頂 36.2（x 2）→ 平頂車斗 33.8；前擋泥板稜 32.8（31 mm 輪拱頂 30.5 之上）；側壁下緣輪拱處 16、兩輪之間 11.5；半寬鼻尖 7、前輪 35.5、兩輪之間 35、車斗 45',
    poles: '雙轅為實心 ABS 桿（橢圓斷面 2.6 × 1.4–1.9 mm），從 x 63.5 的盾肩外側、座艙兩側接到 x −50.5 的車斗板前緣（推估）',
    deckPlate: '車斗板：鍛銀方框 x −60.6 ~ −49.5、半寬 47（比車斗寬 2 mm，像戰車後板）、厚 1.6 mm（下 0.4 mm 埋進殼面），暗紅鑲面內縮 1.2 mm、厚 0.4（推估）',
    livery: '六角盾尖端 x 71、肩 x 62 ~ 49、半寬 12.5、後尖 x 45，金框寬約 1.5–2 mm、盾面板厚 0.8 mm；渦卷端板外半徑 5 mm、厚 1.6 mm；戰車輪徽記半徑 4.8、10 輻；鋸齒齒距 9 mm、齒高 2.6 mm，往後倒，鍛銀邊 0.8 mm；單一道鋸齒邊，不是雙折線閃電（MYTH_RESEARCH H9）；皆為自繪（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），切口從 |z| 23.5 起（輪胎內側 |z| 24.7）＋3 mm 深內襯',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
