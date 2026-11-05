// 米諾陶洛斯（body-minotaur-maze，第八階段神話組・希臘）——第十階段 iter-128 從頭重塑：F2 擋泥板肌肉型「低頭衝撞的蠻牛」。
// 側視：鼻尖壓到 15.6 mm 的黑色牛鼻，往後一路斜升到前輪上方的「牛肩」擋泥板量體（最高 37.6，比中央脊線還高），
// 中段大幅收腰（半寬 46 → 33.5，肩線降到 24 以下），後輪再鼓起一對較低的「牛臀」擋泥板，車尾往下收——量體集中在四個角，像低頭蓄力往前衝的公牛。
// 斷面：中央隆起的圓脊（不是 V 形）＋兩側凹谷＋擋泥板頂；肩線是唯一銳利稜線，下面往內收 3.5–4 mm 成第二層（壁畫藍下裙＋黑色下緣），側視有上下兩層量體。
// 神話元素：牛頭 = 黑色鼻錐（亮黑眼、逗號形鼻孔、金鼻環）；牛角 = 從牛肩擋泥板長出、貼著擋泥板往前衝、在鼻尖兩側往上挑的金色粗長新月角（前翼 / 分流片，圓斷面）；
// 迷宮回紋 = 從鼻尖沿中央脊往後掃到車尾的黑底奶油白雙回紋賽車條，中線一條金色阿里阿德涅之線走進座艙；座艙是脊線後段的方形開放座艙（迷宮中心）。
// 設計：shared/design/body-minotaur-maze/DESIGN.md（MYTH_RESEARCH G6、G9、G10、G13）。剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, sdRoundRect, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40；車尾 −70、鼻尖 77.5，和 iter-127 相同，不往前伸） */
const XS = [-70, -64, -56, -48, -40, -30, -20, -8, 4, 16, 26, 36, 44, 52, 60, 66, 71, 75, 77.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中央脊線：車尾 19 → 後輪 30.4 → 座艙段 34–35.4 → 牛肩前方 36.4（x 26，最高）→ 往前斜降成低頭的牛額 → 鼻尖 15.6
  yC: monoCurve(XS, [19, 22.4, 27, 29.4, 30.4, 31.8, 33.2, 34.4, 35.4, 36.2, 36.4, 35.6, 33.6, 30.4, 26.4, 23, 19.8, 17.4, 15.6]),
  // 半寬（俯視）：牛臀 37.6、腰 29、牛肩 46.0（外框 ≤ 48）、牛頭往鼻吻收到 13
  hw: monoCurve(XS, [10, 19, 31, 37, 37.6, 34, 29.6, 29, 31.6, 42, 46, 46, 46, 44, 36, 27.5, 21, 16, 13.5]),
  // 下緣：中段 10.8（底盤側框頂 9.4 之上）、車尾與鼻吻抬高
  yLow: monoCurve(XS, [16.2, 15.4, 13.6, 12.2, 11.4, 11, 10.8, 10.8, 10.8, 11, 11.4, 12, 12.6, 13.4, 14.2, 14.8, 15.2, 15.4, 15.4]),
};

/** @type {(x: number, xc: number, h: number, k: number) => number} 拋物線擋泥板頂高度（中心 xc 高 h，往前後以 k 下降） */
const bump = (x, xc, h, k) => h - k * (x - xc) * (x - xc);
/** @type {(x: number) => number} 中央脊兩側凹谷（甲板）高度 */
const valleyY = (x) => P.yC(x) - lerp(2.6, 5.2, Math.min(1, Math.max(0, (P.hw(x) - 14) / 20)));
/**
 * 擋泥板頂高度：前輪「牛肩」最高 37.6（x 37，比脊線高 → 側視最高點在前輪上方，低頭衝撞的肩）、後輪「牛臀」33.4（x −41）；不高過脊線 2.5 mm（車尾不鼓成兩個包）；
 * 兩輪之間掉回甲板邊（凹谷 − 2），所以中段收腰、量體集中在四角
 * @type {(x: number) => number}
 */
const fenderY = (x) => Math.min(P.yC(x) + 2.5, Math.max(valleyY(x) - 2.2, bump(x, 37, 37.6, 0.0125), bump(x, -41, 33.4, 0.016)));
/** @type {(x: number) => number} 肩線（側面上層的銳利稜線）高度 */
const shoulderY = (x) => Math.max(P.yLow(x) + 4.5, fenderY(x) - 3.0);
/** @type {(x: number) => number} 腰段權重（|x| < 16 為 1，|x| > 26 為 0） */
const waistW = (x) => Math.min(1, Math.max(0, (26 - Math.abs(x)) / 10));
/**
 * 肩線以下往內收的量（第二層下裙）：輪旁受輪胎外緣（|z| 34.25 + 1 mm 以上）限制，腰段收 3.6 mm
 * @type {(x: number) => number}
 */
const tuckAt = (x) => Math.max(1, Math.min(4, P.hw(x) - 37.6), 3.6 * waistW(x));

/**
 * 半剖面 8 點：脊頂 → 脊肩 → 凹谷 → 擋泥板頂 → 肩圓角 → 肩線稜（銳利）→ 下裙中段 → 下裙下緣（內收）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const hw = P.hw(x);
  const sw = Math.min(5, 0.24 * hw);
  const vz = Math.min(sw + 3.2, 0.5 * hw);
  const fz = Math.max(vz + 1.2, hw - 7.5);
  const yV = Math.min(valleyY(x), yC - 1.2);
  const yF = fenderY(x);
  const yS = shoulderY(x);
  const t = tuckAt(x);
  const yL = Math.min(P.yLow(x), yS - 2);
  return [
    [0, yC],
    [sw, yC - 0.9],
    [vz, yV],
    [fz, yF],
    [hw - 1.4, lerp(yF, yS, 0.45)],
    [hw, yS],
    [hw - 0.62 * t, lerp(yS, yL, 0.5)],
    [hw - t, yL],
  ];
};

/**
 * 側壁外面在高度 y 的 |z|（沿剖面第 5–7 點的折線內插；y 超出範圍時取端點）
 * @type {(x: number, y: number) => number}
 */
const sideZAt = (x, y) => {
  const pts = profile(x);
  for (let i = 5; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (y <= y0 && y >= y1) {
      return lerp(z0, z1, y0 === y1 ? 0 : (y0 - y) / (y0 - y1));
    }
  }
  return y > pts[5][1] ? pts[5][0] : pts[pts.length - 1][0];
};

// 牛頭、鼻吻段每 0.5 mm 一站，其餘每 2 mm
const STATIONS = [...buildStations(-70, 50, 2, profile).slice(0, -1), ...buildStations(50, 77.5, 0.5, profile)];

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {number} 牛頭起點（x 大於此值是黑色牛頭） */
const X_HEAD = 55;
/** @type {{ x: number, zOff: number, r: number, rise: number }} 牛眼：x、離側壁的內縮量、球半徑、突出殼面高度 */
const EYE = { x: 62.5, zOff: 3.4, r: 2.6, rise: 1.1 };
/** @type {{ x: number, y: number }} 金鼻環中心（鼻吻正面） */
const NOSE_RING = { x: 77.9, y: 13.6 };
/** @type {number} 下裙下緣黑色帶上緣高度 */
const ROCKER_Y = 13.0;
/** @type {number} 脊線黑底賽車條半寬 */
const STRIPE_HW = 7.4;
/** 座艙開口（俯視方形，脊線後段 = 迷宮中心） */
const COCKPIT = { x0: -18, x1: -4, hz: 6.2, r: 1.2 };

/** @type {(x: number, y: number, z: number) => boolean} 下裙（肩線稜以下的第二層；只算側面，凹谷甲板不算） */
const onSkirt = (x, y, z) => y < shoulderY(x) - 0.15 && Math.abs(z) > P.hw(x) - 4.5;

/**
 * 線段距離
 * @type {(px: number, pz: number, ax: number, az: number, bx: number, bz: number) => number}
 */
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
};

// ── 側裙回紋帶（側視 (u, v)，u 往車頭為正）────────────────────────────────

/** @type {number} 回紋格距 */
const KEY_G = 1.25;
/** @type {number} 回紋一單元長度（4.6 格） */
const KEY_P = 4.6 * KEY_G;
/** @type {number} 回紋帶下緣高度 */
const KEY_Y0 = 15.6;
/** @type {number} 回紋線寬 */
const KEY_W = 0.75;

/**
 * 連續回紋（方折螺旋鉤，全部同一方向、掛在下邊線上；上邊線另一條）：每單元 (0,0)→(0,3)→(3,3)→(3,1)→(1.5,1)→(1.5,2)
 * @type {(u: number, v: number) => number} 到回紋線的距離（減半線寬）
 */
const greekKey = (u, v) => {
  const g = KEY_G;
  const y = v - KEY_Y0;
  // 上下邊線
  let d = Math.min(Math.abs(y + 0.9), Math.abs(y - 4 * g));
  const k = Math.floor(u / KEY_P);
  for (const kk of [k - 1, k, k + 1]) {
    const u0 = kk * KEY_P;
    /** @type {number[][]} */
    const pts = [
      [0, -0.9],
      [0, 3 * g],
      [3 * g, 3 * g],
      [3 * g, 1 * g],
      [1.5 * g, 1 * g],
      [1.5 * g, 2 * g],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      d = Math.min(d, segDist(u - u0, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    }
  }
  return d - KEY_W / 2;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 壁畫色：赭紅、壁畫藍、奶油白（霧面，像灰泥上的礦物顏料）
  ochre: namedMaterial('paint-fresco-ochre-red', { color: 0xa5452c, roughness: 0.64, clearcoat: 0.05 }),
  blue: namedMaterial('paint-fresco-blue', { color: 0x2e5b85, roughness: 0.62, clearcoat: 0.05 }),
  cream: namedMaterial('paint-fresco-cream', { color: 0xebdfc1, roughness: 0.62, clearcoat: 0.05 }),
  // 牛頭與甲板框邊：亮面黑（少數亮面部位）
  black: namedMaterial('paint-bull-black', { color: 0x1d1b1a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  // 牛角：金色（真金屬：名稱含 -brass）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a23a, roughness: 0.3, metalness: 0.8, clearcoat: 0.2 }),
  // 牛眼：亮面黑
  eye: namedMaterial('paint-bull-eye-black', { color: 0x0e0d0c, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1716, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x1d1b1a, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-umber', { color: 0x3a2a22, roughness: 0.8, side: THREE.DoubleSide }),
  well: namedMaterial('paint-fresco-cream', { color: 0xebdfc1, roughness: 0.62, clearcoat: 0.05, side: THREE.DoubleSide }),
  dCream: decalMaterial('decal-fresco-cream', { color: 0xefe4c8, roughness: 0.6 }),
  dBlack: decalMaterial('decal-slip-black', { color: 0x1b1918, roughness: 0.5 }),
  dOchre: decalMaterial('decal-fresco-ochre', { color: 0x9c3b26, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-thread', { color: 0xd4ae45, roughness: 0.3, metalness: 0.75 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯：輪拱切口後面的上半圈圓柱面（半徑 = 輪拱半徑 + 0.3），z 從殼內面往內 4.5 mm（最深到 |z| 25.5），
 * 擋住從輪拱看進去的殼內空腔與底盤；每個角度的外側界限 = 側壁內面與「殼面高度 ≥ 內襯高度 + 0.9」兩者較小者（不穿出倒角）
 * @type {(kit: any, arch: { x: number, y: number, radius: number }) => THREE.BufferGeometry}
 */
const buildLiner = (kit, arch) => {
  /** @type {number} 內襯從外側往內的深度（只遮住從輪拱斜看進去的殼內空腔，不做整圈輪室，省質量） */
  const LINER_DEPTH = 4.5;
  const r = arch.radius + 0.3;
  const n = 44;
  const a0 = 0.1;
  const a1 = Math.PI - 0.1;
  const zInner = 25.5;
  /** @type {(t: number) => number} 該角度內襯的外側 z */
  const zOuter = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    const zSide = sideZAt(x, y) - 1.0;
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

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-minotaur-maze',
  name: '米諾陶洛斯迷宮',
  style: 'myth',
  phase: 8,
  mythSeries: 'greek',
  mythTheme: 'minotaur-labyrinth',
  form: 'bull-slab',
  roof: 'open-cockpit',
  wing: 'none',
  theme: 'F2 擋泥板肌肉型「低頭衝撞的蠻牛」（iter-128 重塑）：低黑牛鼻往後斜升到前輪上方高聳的牛肩擋泥板、中段大幅收腰、後輪牛臀擋泥板；肩線下內收的壁畫藍下裙；金色粗長新月牛角貼著牛肩往前衝、在鼻尖兩側上挑（前翼 / 分流片）；黑底奶油白雙回紋賽車條從鼻尖沿中央脊掃到車尾，金色阿里阿德涅之線走進脊線後段的迷宮中心座艙',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 肩線稜（5）與下裙下緣（7，端點自動）是銳利稜線，其餘平滑
  hard: [5],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 33 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 30 },
  ],
  openings: [
    {
      id: '迷宮中心座艙',
      shape: 'fn',
      sd: (x, y, z) => (y < 26 ? 10 : sdRoundRect(x, Math.abs(z), COCKPIT.x0, COCKPIT.x1, -COCKPIT.hz, COCKPIT.hz, COCKPIT.r)),
    },
  ],
  sideZMin: 28,
  zones: () => [
    // 黑色牛頭（額頭、頰面、牛鼻）
    { mat: 'black', keep: (x) => x - X_HEAD },
    // 下裙下緣黑色帶
    { mat: 'black', keep: (x, y) => ROCKER_Y - y },
    // 下裙：壁畫藍（肩線稜以下的第二層）
    { mat: 'blue', keep: (x, y, z) => (onSkirt(x, y, z) ? 1 : -1) },
    // 中央脊黑底賽車條（鼻尖 → 車尾）
    { mat: 'black', keep: (x, y, z) => STRIPE_HW - Math.abs(z) },
    // 擋泥板與甲板：赭紅
    { mat: 'ochre', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 座艙井壁：沿座艙開口往下 4 mm 的方形井（0.8 mm 壁，頂端埋進甲板殼內；沒有底，看得到底盤）──
    {
      const t = 0.8;
      const depth = 4.0;
      /** @type {THREE.BufferGeometry[]} */
      const walls = [];
      const yTopAt = (x) => top(x, 0) - 0.3;
      const yBot = Math.min(yTopAt(COCKPIT.x0), yTopAt(COCKPIT.x1)) - depth;
      const yTop = Math.max(yTopAt(COCKPIT.x0), yTopAt(COCKPIT.x1));
      const h = yTop - yBot;
      const lx = COCKPIT.x1 - COCKPIT.x0;
      const xc = (COCKPIT.x0 + COCKPIT.x1) / 2;
      for (const sg of [-1, 1]) {
        const gz = new THREE.BoxGeometry(lx + 2 * t, h, t);
        gz.translate(xc, yBot + h / 2, sg * (COCKPIT.hz + t / 2));
        walls.push(gz);
        const gx = new THREE.BoxGeometry(t, h, 2 * COCKPIT.hz);
        gx.translate(sg > 0 ? COCKPIT.x1 + t / 2 : COCKPIT.x0 - t / 2, yBot + h / 2, 0);
        walls.push(gx);
      }
      parts.push({ geometry: mergeGeos(walls), mat: 'well', solid: true, name: 'cockpit-well' });
    }

    // ── 牛角 = 往前衝的前翼（大件 1）：根部埋進牛肩擋泥板頂（x 42、|z| 38），貼著擋泥板前坡往前、往外鼓成新月，
    //    到鼻尖兩側（x 80.4、|z| 30）往上挑——俯視是兩道往外凸的新月，角尖左右分開（不在鼻前合成 U 形）；側視是低伏前衝、尖端上挑的弧 ──
    {
      /** @type {(sg: number) => number[][]} */
      const hornPath = (sg) => [
        [41.0, top(41, 38) - 2.4, sg * 38],
        [45.0, top(45, 39.6) + 0.9, sg * 39.6],
        [51.0, 34.0, sg * 41.6],
        [57.5, 31.6, sg * 42.4],
        [64.0, 30.2, sg * 41.6],
        [70.0, 30.0, sg * 39.4],
        [74.6, 31.2, sg * 36.4],
        [78.0, 33.6, sg * 33.2],
        [80.2, 36.8, sg * 30.4],
      ];
      /** @type {(t: number) => number[]} 角的斷面半徑（正圓）：根部 3.6 → 角尖 0.85 */
      const hornR = (t) => {
        const r = lerp(3.6, 0.85, Math.pow(t, 0.85));
        return [r, r];
      };
      /** @type {THREE.BufferGeometry[]} */
      const horns = [];
      for (const sg of [-1, 1]) {
        horns.push(smoothNormals(sweepEllipse(hornPath(sg), 28, hornR, 10)));
      }
      parts.push({ geometry: mergeGeos(horns), mat: 'gold', solid: true, outline: true, name: 'bull-horns' });
    }
    // 牛眼：牛頭兩側肩圓角上的亮黑圓頂＋奶油白眼白環
    {
      /** @type {THREE.BufferGeometry[]} */
      const eyes = [];
      /** @type {number[][]} 兩眼在殼面上的點 */
      const eyePts = [];
      for (const sg of [-1, 1]) {
        const z = sg * (P.hw(EYE.x) - EYE.zOff);
        const y = top(EYE.x, z);
        const h = 0.05;
        const gx = (top(EYE.x + h, z) - top(EYE.x - h, z)) / (2 * h);
        const gz = (top(EYE.x, z + h) - top(EYE.x, z - h)) / (2 * h);
        const n = new THREE.Vector3(-gx, 1, -gz).normalize();
        const c = new THREE.Vector3(EYE.x, y, z).addScaledVector(n, EYE.rise - EYE.r);
        const e = new THREE.SphereGeometry(EYE.r, 16, 10);
        e.scale(1.25, 1, 1);
        e.translate(c.x, c.y, c.z);
        eyes.push(e);
        eyePts.push([EYE.x, y, z]);
      }
      parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, name: 'bull-eyes' });
      const ringR = Math.sqrt(EYE.r * EYE.r - (EYE.r - EYE.rise) * (EYE.r - EYE.rise)) + 0.1;
      /** @type {(x: number, y: number, z: number) => number} 到最近眼睛的距離 */
      const eyeDist = (x, y, z) => {
        const p = eyePts[z < 0 ? 0 : 1];
        return Math.hypot((x - p[0]) / 1.25, y - p[1], z - p[2]);
      };
      parts.push({
        geometry: kit.decal((x, y, z) => Math.min(eyeDist(x, y, z) - ringR, ringR + 0.9 - eyeDist(x, y, z))),
        mat: 'dCream',
        name: 'decal-eye-rings',
      });
    }
    // 金鼻環：鼻吻正面、環面朝前（上緣埋進鼻吻）
    {
      const ring = new THREE.TorusGeometry(2.4, 0.65, 8, 24);
      ring.rotateY(Math.PI / 2);
      ring.translate(NOSE_RING.x, NOSE_RING.y, 0);
      parts.push({ geometry: ring, mat: 'gold', solid: true, outline: true, name: 'bull-nose-ring' });
    }

    // 輪拱內襯、環形擋板
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(kit, a))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 15.5, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });

    // ── 貼紙 ──
    // 中央脊雙回紋賽車條（奶油白，大件 2 的紋樣層）：從鼻尖（x 74）沿脊線往後掃到車尾（x −66），左右各一條，回紋鉤朝車尾（往後流動）；避開座艙
    /** @type {(x: number, z: number) => number} 回紋條距離函式（u = 從鼻尖往後量，v = 從中線往外量） */
    const meanderStripe = (x, z) => {
      const az = Math.abs(z);
      if (x > 74 || x < -66 || az > STRIPE_HW - 0.4) {
        return -1;
      }
      const inCockpit = sdRoundRect(x, az, COCKPIT.x0 - 1.4, COCKPIT.x1 + 1.4, -COCKPIT.hz - 1.4, COCKPIT.hz + 1.4, 1.5);
      return Math.min(-greekKey(74 - x, KEY_Y0 + az - 1.5), inCockpit);
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < P.hw(x) - 4.5 ? meanderStripe(x, z) : -1)),
      mat: 'dCream',
      name: 'decal-meander-stripes',
    });
    // 阿里阿德涅之線（金色 0.8 mm）：中線從鼻尖走到座艙前緣
    parts.push({
      geometry: kit.decal((x, y, z) => (x > COCKPIT.x1 + 0.4 && x < 75 ? 0.4 - Math.abs(z) : -1), { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-ariadne-thread',
    });
    // 座艙口一圈奶油白框（0.9 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = sdRoundRect(x, Math.abs(z), COCKPIT.x0, COCKPIT.x1, -COCKPIT.hz, COCKPIT.hz, COCKPIT.r);
        return y > 26 ? 0.9 - d : -1;
      }),
      mat: 'dCream',
      name: 'decal-cockpit-rim',
    });
    // 肩線金細線：沿肩線稜下方 0.9 mm，從牛頭往後掃到車尾（被輪拱切開處留 1 mm）——把上下兩層量體分開
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < P.hw(x) - 3 || x > 66 || x < -64) {
          return -1;
        }
        return Math.min(0.4 - Math.abs(y - (shoulderY(x) - 0.9)), archRingDist(x, y) - 1.0);
      }),
      mat: 'dGold',
      name: 'decal-gold-shoulder-line',
    });
    // 下裙回紋帶（奶油白）：只在兩輪之間的腰段
    /** @type {(u: number, v: number) => number} u = 往車頭為正的 x */
    const keyBand = (u, v) => Math.max(greekKey(u + 80, v - 0.6), u - 22, -22 - u, 1.2 - archRingDist(u, v));
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(keyBand, { x0: 0, y0: 0, zMin: 28, side: 1 })),
        kit.decal(sideDecal((u, v) => keyBand(-u, v), { x0: 0, y0: 0, zMin: 28, side: -1 })),
      ]),
      mat: 'dCream',
      name: 'decal-meander-band',
    });
    // 鼻孔：鼻吻頂前端一對往外斜的逗號形鼻孔（赭紅）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 70 || y < P.yC(x) - 1.6) {
          return -1;
        }
        const u = x - 74.6;
        const v = Math.abs(z) - 5.0;
        const c = Math.cos(0.6);
        const sn = Math.sin(0.6);
        const a = u * c + v * sn;
        const b2 = -u * sn + v * c;
        return 1 - Math.hypot(a / 1.2, b2 / 2.4);
      }),
      mat: 'dOchre',
      name: 'decal-nostrils',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，iter-128 重塑）：殼 x −70 → 77.5、牛角尖 x 約 81（外框長 ≤ 153，SPEC 1.14a；鼻尖不超過 iter-127）；脊線 19（車尾）→ 36.4（x 26）→ 15.6（鼻尖）；擋泥板頂：牛肩 37.6（x 37）、牛臀 33.4（x −41）；半寬：牛臀 42.6、腰 33.5、牛肩 46.0（外框半寬 ≤ 48.0）、鼻吻 13',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm），前 cutZFrom 33、後 30；31 mm 大輪需切輪拱（和 iter-127 相同）。輪拱內襯從側壁內面往內 4.5 mm',
    labyrinth: '迷宮 / 回紋：克諾索斯銀幣背面的直線迷宮（MYTH_RESEARCH G9）與「回紋是線性形式的迷宮」（G10）——iter-128 改成沿中央脊的雙回紋賽車條（線寬 0.75 mm，格距自訂）',
    thread: '阿里阿德涅之線（G6）：金色 0.8 mm 細線沿中線從鼻尖走進座艙',
    cockpit: '迷宮中心方形開放座艙 14 × 12.4 mm、井壁深約 4 mm（0.8 mm 實心壁），沒有底板',
    horns: '牛角為實心 ABS 掃掠件（根部 φ7.2 → 角尖 φ1.7，圓斷面），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    head: '黑色牛頭借克諾索斯石雕牛頭角杯的黑色石材（Minoan art 條目）；牛眼、鼻孔、鼻環造型自創',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 也會傳遞 mythSeries / mythTheme；這裡再補一次，和其他神話款一致
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const minotaurMazeBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
