// 米諾陶洛斯（body-minotaur-maze，神話組・希臘）——F2 擋泥板肌肉型，姿態是「低頭衝撞的蠻牛」；車上沒有牛的臉、眼、鼻孔、鼻環。
// 側視：鼻尖壓到 15.6 mm 的低鼻錐，往後一路斜升到前輪上方的「牛肩」擋泥板量體（最高 37.6，比中央脊線還高），
// 中段大幅收腰（半寬 46 → 29，肩線降到 24 以下），後輪再鼓起一對較低的「牛臀」擋泥板，車尾往下收——量體集中在四個角，像低頭蓄力往前衝的公牛。
// 斷面：中央隆起的圓脊（不是 V 形）＋兩側凹谷＋擋泥板頂；肩線是唯一銳利稜線，下面往內收 3.5–4 mm 成第二層（壁畫藍下裙＋黑色下緣），側視有上下兩層量體。
// 神話元素：新月角 = 左右前擋泥板頂各一片金色新月鰭——鰭根沿擋泥板頂、側視前緣外凸後緣內凹、鰭尖往後上方掃並往外張（翼型斷面的立鰭，不是圓錐形的角）；鼻錐和車身同為赭紅、下巴黑色，沒有牛的臉、眼、鼻孔、鼻環；
// 迷宮回紋 = 從鼻尖沿中央脊往後掃到車尾的黑底奶油白雙回紋賽車條，中線一條微微發光的金色阿里阿德涅之線走進座艙；座艙是脊線後段的方形開放座艙（迷宮中心，井壁和賽車條同為黑色）。
// 設計：shared/design/body-minotaur-maze/DESIGN.md（MYTH_RESEARCH G6、G9、G10、G13）。剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, sdRoundRect, mergeGeos, lerp, smoothstep } from './loft.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { monoCurve, buildStations, smoothMax } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40；車尾 −70、鼻尖 77.5） */
const XS = [-70, -64, -56, -48, -40, -30, -20, -8, 4, 16, 26, 36, 44, 52, 60, 66, 71, 75, 77.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中央脊線：車尾 19 → 後輪 30.4 → 座艙段 34–35.4 → 牛肩前方 36.4（x 26，最高）→ 往前斜降成低頭的牛額 → 鼻尖 15.6
  yC: monoCurve(XS, [19, 22.4, 27, 29.4, 30.4, 31.8, 33.2, 34.4, 35.4, 36.2, 36.4, 35.6, 33.6, 30.4, 26.4, 23, 19.8, 17.4, 15.6]),
  // 半寬（俯視）：車尾收尖到 6、牛臀 37.6、腰 29、牛肩 46.0（外框 ≤ 48）、鼻錐往鼻尖收到 13.5
  hw: monoCurve(XS, [6, 14, 30.5, 37, 37.6, 34, 29.6, 29, 31.6, 42, 46, 46, 46, 44.4, 37.5, 29, 22, 16.5, 13.5]),
  // 下緣：中段 10.8（底盤側框頂 9.4 之上）、車尾與鼻吻抬高
  yLow: monoCurve(XS, [16.2, 15.4, 13.6, 12.2, 11.4, 11, 10.8, 10.8, 10.8, 11, 11.4, 12, 12.6, 13.4, 14.2, 14.8, 15.2, 15.4, 15.4]),
};

/** @type {(a: number, b: number, k?: number) => number} 平滑最小值（避免 Math.min 在殼面上留下沿 x 走的折痕） */
const smoothMin = (a, b, k = 1.2) => -smoothMax(-a, -b, k);
/** @type {(x: number, xc: number, h: number, k: number) => number} 拋物線擋泥板頂高度（中心 xc 高 h，往前後以 k 下降） */
const bump = (x, xc, h, k) => h - k * (x - xc) * (x - xc);
/** @type {(x: number) => number} 中央脊兩側凹谷（甲板）高度 */
const valleyY = (x) => P.yC(x) - lerp(2.6, 5.2, smoothstep(14, 34, P.hw(x)));
/**
 * 擋泥板頂高度：前輪「牛肩」最高 37.6（x 37，比脊線高 → 側視最高點在前輪上方，低頭衝撞的肩）、後輪「牛臀」33.4（x −41）；不高過脊線 2.5 mm（車尾不鼓成兩個包）；
 * 兩輪之間掉回甲板邊（凹谷 − 2），所以中段收腰、量體集中在四角；各段之間用平滑最大 / 最小值銜接，殼面沿 x 不留折痕
 * @type {(x: number) => number}
 */
const fenderY = (x) =>
  smoothMin(P.yC(x) + 2.5, smoothMax(valleyY(x) - 2.2, smoothMax(bump(x, 37, 37.6, 0.0125), bump(x, -41, 33.4, 0.016), 1.5), 1.5), 1.0);
/** @type {(x: number) => number} 肩線（側面上層的銳利稜線）高度 */
const shoulderY = (x) => smoothMax(P.yLow(x) + 4.5, fenderY(x) - 3.0, 0.8);
/** @type {(x: number) => number} 腰段權重（|x| < 16 為 1，|x| > 26 為 0，中間平滑過渡） */
const waistW = (x) => 1 - smoothstep(16, 26, Math.abs(x));
/**
 * 肩線以下往內收的量（第二層下裙）：輪旁受輪胎外緣（|z| 34.25 + 1 mm 以上）限制，腰段收 3.6 mm
 * @type {(x: number) => number}
 */
const tuckAt = (x) => smoothMax(smoothMax(1, smoothMin(4, P.hw(x) - 37.6, 0.6), 0.4), 3.6 * waistW(x), 0.4);

/**
 * 半剖面 8 點（未沿 x 平滑）：脊頂 → 脊肩 → 凹谷 → 擋泥板頂 → 肩圓角 → 肩線稜（銳利）→ 下裙中段 → 下裙下緣（內收）
 * @type {(x: number) => number[][]}
 */
const rawProfile = (x) => {
  const yC = P.yC(x);
  const hw = P.hw(x);
  const sw = smoothMin(5, 0.24 * hw, 0.5);
  const vz = smoothMin(sw + 3.2, 0.5 * hw, 0.6);
  const fz = smoothMax(vz + 1.2, hw - 7.5, 0.8);
  const yV = smoothMin(valleyY(x), yC - 1.2, 0.5);
  const yF = fenderY(x);
  const yS = shoulderY(x);
  const t = tuckAt(x);
  const yL = Math.min(P.yLow(x), yS - 2);
  // 鼻錐與車尾變窄時，脊、凹谷、擋泥板頂三層起伏擠在幾 mm 內會捏出皺摺：逐漸併成一道單純的拱（脊頂到肩線稜）；
  // 鼻錐從半寬 42（前擋泥板前坡）開始、車尾從 36 開始（不削到後輪上方的牛臀）
  const e = smoothstep(18, x > 0 ? 42 : 36, hw);
  /** @type {(z: number, y: number) => number[]} 該點的高度往拱面靠 */
  const crown = (z, y) => [z, lerp(yS + (yC - yS) * (1 - Math.min(1, z / hw) ** 2.4), y, e)];
  return [
    [0, yC],
    crown(sw, yC - 0.9),
    crown(vz, yV),
    crown(fz, yF),
    crown(hw - 1.4, lerp(yF, yS, 0.45)),
    [hw, yS],
    [hw - 0.62 * t, lerp(yS, yL, 0.5)],
    [hw - t, yL],
  ];
};

/** @type {number[]} 沿 x 平滑剖面的取樣偏移（mm）與高斯權重（σ 3 mm） */
const SMOOTH_DX = [-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5, 6];
/**
 * 半剖面（沿 x 做高斯平滑）：擋泥板、凹谷、內收各段的平滑銜接疊在一起，仍會在幾 mm 內留下小起伏（擋泥板頂的波浪、座艙前方甲板的小凹陷）；
 * 每一點取前後 ±6 mm 同序號點的加權平均，把這些短波起伏燙平。靠近車尾、鼻尖時窗口縮小，兩端剖面不變
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const reach = Math.min(1, (x - XS[0]) / 6, (XS[XS.length - 1] - x) / 6);
  if (reach <= 0) {
    return rawProfile(x);
  }
  let wSum = 0;
  /** @type {number[][] | null} */
  let acc = null;
  for (const d of SMOOTH_DX) {
    const w = Math.exp(-((d / 3) ** 2) / 2);
    const pts = rawProfile(x + d * reach);
    acc = acc ? acc.map(([z, y], i) => [z + w * pts[i][0], y + w * pts[i][1]]) : pts.map(([z, y]) => [w * z, w * y]);
    wSum += w;
  }
  return acc.map(([z, y]) => [z / wSum, y / wSum]);
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

// 鼻錐段每 0.5 mm 一站，其餘每 2 mm
const STATIONS = [...buildStations(-70, 50, 2, profile).slice(0, -1), ...buildStations(50, 77.5, 0.5, profile)];

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {number} 下裙下緣黑色帶上緣高度 */
const ROCKER_Y = 13.0;
/** @type {number} 脊線黑底賽車條半寬 */
const STRIPE_HW = 7.4;
/** 座艙開口（俯視方形，脊線後段 = 迷宮中心） */
const COCKPIT = { x0: -18, x1: -4, hz: 6.2, r: 1.2 };

/** @type {(x: number, y: number, z: number) => boolean} 肩線稜以下的第二層（只算側面，凹谷甲板不算；肩線高度取平滑後剖面的第 5 點，和殼面稜線一致） */
const belowShoulder = (x, y, z) => y < profile(x)[5][1] - 0.15 && Math.abs(z) > P.hw(x) - 4.5;
/** @type {number} 鼻端下巴的起點：x 以前的下裙是壁畫藍，以後和下緣黑帶連成一圈黑色下巴（肩線在鼻端收攏，畫藍會留下碎片） */
const CHIN_X = 70;

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

/**
 * 新月鰭的外形參數：鰭根是一條直線，沿前擋泥板頂外側（x 30–53、|z| 41，擋泥板最寬的一段），鰭尖收成一點在後上方（x 12、y 48，懸在腰段外上方）；隨高度往外傾 28°（俯視鰭尖伸出腰段外緣，外框半寬 47.5 ≤ 48）
 * @type {{ xLead: number, xTrail: number, xTip: number, yTip: number, zRoot: number, cantDeg: number, thick: number, nc: number, ns: number }}
 */
const FIN = { xLead: 53, xTrail: 30, xTip: 12, yTip: 48, zRoot: 41, cantDeg: 8, thick: 2.4, nc: 6, ns: 8 };

/**
 * 新月鰭（前擋泥板頂的金色立鰭，左右各一）：側視是新月形——前緣外凸、從擋泥板頂陡升再往後掃，後緣內凹，兩緣在後上方收成尖端；
 * 斷面是對稱翼型（後緣收尖），厚度往鰭尖收到 0.2 倍（1.4 → 0.28 mm）；鰭根埋進殼面 1 mm，所以整條根部和擋泥板頂一體，沒有接縫或懸空
 * @type {(top: (x: number, z: number) => number, sg: number) => THREE.BufferGeometry}
 */
const crescentFin = (top, sg) => {
  const { xLead, xTrail, xTip, yTip, zRoot, cantDeg, thick, nc, ns } = FIN;
  const tan = Math.tan((cantDeg * Math.PI) / 180);
  /** @type {(u: number) => number} 後緣閉合的 NACA 對稱厚度（0–1 弦長，最大約 1） */
  const tdist = (u) => (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1015 * u ** 4) / 0.1;
  /** @type {(i: number, j: number, side: number) => number[]} */
  const pt = (i, j, side) => {
    const s = j / ns;
    const u = (1 - Math.cos((Math.PI * i) / nc)) / 2;
    // 前緣：先陡升再往後掃（外凸）；後緣：先貼著擋泥板往後、到尾段才陡升（內凹）
    const xL = lerp(xLead, xTip, s ** 1.4);
    const hL = s ** 0.6;
    const xT = lerp(xTrail, xTip, s ** 0.8);
    const hT = s ** 3;
    const x = lerp(xL, xT, u);
    // 鰭尖懸在鰭根範圍之後，沿用鰭根後端的殼面高度當基準
    const xr = Math.min(xLead, Math.max(xTrail, x));
    const yRoot = top(xr, sg * zRoot) - 1.0;
    const y = lerp(yRoot, yTip, lerp(hL, hT, u));
    const zLocal = side * (thick / 2) * tdist(u) * lerp(1, 0.3, s);
    return [x, y, sg * (zRoot + Math.max(0, y - yRoot) * tan + zLocal)];
  };
  const pos = [];
  /** @type {(a: number[], b: number[], c: number[]) => void} 依左右側決定繞向（右側直接加，左側鏡射後反轉） */
  const tri = (a, b, c) => (sg > 0 ? pos.push(...a, ...b, ...c) : pos.push(...a, ...c, ...b));
  for (const side of [-1, 1]) {
    for (let i = 0; i < nc; i++) {
      for (let j = 0; j < ns; j++) {
        const a = pt(i, j, side);
        const b = pt(i + 1, j, side);
        const c = pt(i + 1, j + 1, side);
        const d = pt(i, j + 1, side);
        if (side < 0) {
          tri(a, b, c);
          tri(a, c, d);
        } else {
          tri(a, c, b);
          tri(a, d, c);
        }
      }
    }
  }
  // 鰭根與鰭尖封面（兩端繞向相反，封閉網格才能用散度定理算體積）
  for (const j of [0, ns]) {
    for (let i = 0; i < nc; i++) {
      const a = pt(i, j, -1);
      const b = pt(i + 1, j, -1);
      const c = pt(i + 1, j, 1);
      const d = pt(i, j, 1);
      if (j === 0) {
        tri(a, c, b);
        tri(a, d, c);
      } else {
        tri(a, b, c);
        tri(a, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // 前緣圓、後緣與鰭尖銳利：只在夾角小於 60° 的相鄰面之間平滑法向
  return toCreasedNormals(g, Math.PI / 3);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 壁畫色：赭紅、壁畫藍、奶油白（霧面，像灰泥上的礦物顏料）
  ochre: namedMaterial('paint-fresco-ochre-red', { color: 0xa5452c, roughness: 0.64, clearcoat: 0.05 }),
  blue: namedMaterial('paint-fresco-blue', { color: 0x2e5b85, roughness: 0.62, clearcoat: 0.05 }),
  cream: namedMaterial('paint-fresco-cream', { color: 0xebdfc1, roughness: 0.62, clearcoat: 0.05 }),
  // 賽車條底色、座艙井壁：亮面黑（少數亮面部位）
  black: namedMaterial('paint-bull-black', { color: 0x1d1b1a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  // 新月鰭：金色（真金屬：名稱含 -brass）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a23a, roughness: 0.3, metalness: 0.8, clearcoat: 0.2 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1716, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x1d1b1a, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-umber', { color: 0x3a2a22, roughness: 0.8, side: THREE.DoubleSide }),
  well: namedMaterial('paint-bull-black', { color: 0x1d1b1a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
  dCream: decalMaterial('decal-fresco-cream', { color: 0xefe4c8, roughness: 0.6 }),
  dBlack: decalMaterial('decal-slip-black', { color: 0x1b1918, roughness: 0.5 }),
  dGold: decalMaterial('decal-gold-thread', { color: 0xd4ae45, roughness: 0.3, metalness: 0.75 }),
  // 阿里阿德涅之線：金色微弱自發光（強度壓低，Blender 不過曝）
  dThread: decalMaterial('decal-ariadne-glow', { color: 0xf2c24e, emissive: 0xffb428, emissiveIntensity: 0.45, roughness: 0.3 }),
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
  theme: 'F2 擋泥板肌肉型「低頭衝撞的蠻牛」：低矮的鼻錐往後斜升到前輪上方高聳的牛肩擋泥板、中段大幅收腰、後輪牛臀擋泥板；肩線下內收的壁畫藍下裙；左右前擋泥板頂各一片金色新月鰭，鰭尖往後上方掃、往外張成 V；黑色下巴；黑底奶油白雙回紋賽車條從鼻尖沿中央脊掃到車尾，發光的金色阿里阿德涅之線走進脊線後段的迷宮中心座艙；沒有牛臉、牛眼、鼻環',
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
    // 下裙下緣黑色帶
    { mat: 'black', keep: (x, y) => ROCKER_Y - y },
    // 鼻端下巴：黑
    { mat: 'black', keep: (x, y, z) => (x >= CHIN_X && belowShoulder(x, y, z) ? 1 : -1) },
    // 下裙：壁畫藍（肩線稜以下的第二層）
    { mat: 'blue', keep: (x, y, z) => (belowShoulder(x, y, z) ? 1 : -1) },
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

    // ── 新月鰭（大件 1）：左右前擋泥板頂各一片金色立鰭，側視新月形、鰭尖指向後上方，前視往外張成 V ──
    parts.push({
      geometry: mergeGeos([crescentFin(top, 1), crescentFin(top, -1)]),
      mat: 'gold',
      solid: true,
      outline: true,
      name: 'crescent-fender-fins',
    });

    // 輪拱內襯、環形擋板
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(kit, a))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 15.5, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });

    // ── 貼紙 ──
    // 中央脊雙回紋賽車條（奶油白，大件 2 的紋樣層）：從鼻錐（x 62.5，鼻尖前兩個單元收掉，鼻尖最窄的地方不擠回紋）沿脊線往後掃到車尾（x −66），左右各一條，回紋鉤朝車尾（往後流動）；避開座艙
    /** @type {(x: number, z: number) => number} 回紋條距離函式（u = 從鼻尖往後量，v = 從中線往外量） */
    const meanderStripe = (x, z) => {
      const az = Math.abs(z);
      if (x > 62.5 || x < -66 || az > STRIPE_HW - 0.4) {
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
    // 阿里阿德涅之線（發光金線 1.1 mm）：中線從鼻尖走到座艙前緣
    parts.push({
      geometry: kit.decal((x, y, z) => (x > COCKPIT.x1 + 0.4 && x < 75 ? 0.55 - Math.abs(z) : -1), { offset: 0.12 }),
      mat: 'dThread',
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
    // 肩線金細線：沿肩線稜下方 0.9 mm，從鼻錐往後掃到車尾（被輪拱切開處留 1 mm）——把上下兩層量體分開
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < P.hw(x) - 3 || x > 66 || x < -64) {
          return -1;
        }
        return Math.min(0.4 - Math.abs(y - (profile(x)[5][1] - 0.9)), archRingDist(x, y) - 1.0);
      }),
      mat: 'dGold',
      name: 'decal-gold-shoulder-line',
    });
    // 下裙回紋帶（奶油白）：只在兩輪之間的腰段；腰段側壁內收到 |z| 25 左右，zMin 要取 24 才不會把回紋切成碎片
    /** @type {(u: number, v: number) => number} u = 往車頭為正的 x */
    const keyBand = (u, v) => Math.max(greekKey(u + 80, v - 0.6), u - 22, -22 - u, 1.2 - archRingDist(u, v));
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(keyBand, { x0: 0, y0: 0, zMin: 24, side: 1 })),
        kit.decal(sideDecal((u, v) => keyBand(-u, v), { x0: 0, y0: 0, zMin: 24, side: -1 })),
      ]),
      mat: 'dCream',
      name: 'decal-meander-band',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：殼 x −70 → 77.5（外框長 147.5 ≤ 153，SPEC 1.14a）；脊線 19（車尾）→ 36.4（x 26）→ 15.6（鼻尖）；擋泥板頂：牛肩 37.6（x 37）、牛臀 33.4（x −41）；全車最高點是新月鰭尖 48.0；半寬：牛臀 37.6、腰 29、牛肩 46.0、鼻吻 13.5；外框半寬 47.5（新月鰭尖，≤ 48.0）',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm），前 cutZFrom 33、後 30；31 mm 大輪需切輪拱。輪拱內襯從側壁內面往內 4.5 mm，輪胎內側另有 buildArchWell 環形擋板（|z| 22.9）',
    labyrinth: '迷宮 / 回紋：克諾索斯銀幣背面的直線迷宮（MYTH_RESEARCH G9）與「回紋是線性形式的迷宮」（G10）——畫成沿中央脊的雙回紋賽車條與兩輪之間的下裙回紋帶（線寬 0.75 mm，格距自訂）',
    thread: '阿里阿德涅之線（G6）：金色 1.1 mm 細線沿中線從鼻尖走進座艙，自發光強度 0.45（推估）',
    cockpit: '迷宮中心方形開放座艙 14 × 12.4 mm、井壁深約 4 mm（0.8 mm 實心壁，亮面黑），沒有底板',
    crescentFins: '新月鰭為左右各一片實心 ABS 立鰭（6 × 8 段）：對稱翼型斷面最厚 1.4 mm、往鰭尖收到 0.28 mm；鰭根沿前擋泥板頂外側 x 30–53、|z| 41，埋進殼面 1 mm；鰭尖 x 12、y 48，往外傾 28°；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    nose: '鼻錐和車身同為壁畫赭紅，素面，不做眼、鼻孔、鼻環；只有中央的黑底回紋賽車條與金線通到鼻尖',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 也會傳遞 mythSeries / mythTheme；這裡再補一次，和其他神話款一致
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const minotaurMazeBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
