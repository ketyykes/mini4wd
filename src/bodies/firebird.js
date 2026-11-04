// 火鳥（body-firebird，第八階段神話組・斯拉夫）：俄羅斯民間故事的火鳥（Zhar-ptitsa）——羽毛全是金的、眼睛像東方水晶，
// 夜裡飛進果園時整座園子像點了許多火；掉下的一根尾羽亮得像紅太陽（Magnus 1916 英譯 Afanasyev〈伊凡王子、光明鳥與灰狼〉）。
// 造型：低而流線的鳥身（俯視是飛鳥：前段展開的寬翅膀、往後掠收成細長鳥身與尾根）、車頭短小的金色鳥喙＋三片往後掠的金色冠羽、
// 中段琥珀色座艙罩（鳥背），車尾 5 根往後上方拖曳的細長尾羽（尾翼 plume-train），羽端是孔雀眼似的金框朱紅圓斑。
// 配色與紋樣取自 Khokhloma 漆器（黑底＋朱紅＋金、捲曲的草葉紋 / 火焰羽紋）：黑漆殼面（亮面）、朱紅（霧面）、金（真金屬實體件 / 金色貼紙）。
// 刻意避開：中國鳳凰（雞冠、卷雲尾）、希臘不死鳥（從火焰中升起的姿態）、Fawkes、寶可夢火焰鳥、Marvel Phoenix 徽章、Stravinsky 芭蕾舞台服。
// 設計：shared/design/body-firebird/DESIGN.md（研究一節列出實際打開的來源）。剖面為本檔站位產生器（推估）。
// 不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −58（iter-120 由 −61 縮短，車尾由尾羽翼接續）、鳥喙尖 75 */
const XS = [-58, -54.5, -49.5, -40, -28, -14, 0, 14, 28, 40, 50, 58, 64, 69, 72.5, 75];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（翅緣）：飛鳥俯視——翅膀長在身體前段（翅尖最寬 46.5 在前輪上方 x 40），翅後緣往後掠收成細長的鳥身（座艙段 24.5–26）
  // 與尾根（後輪上方 23、車尾 12）；翅前緣往前收成鳥頸（x 58：20）與鳥頭、鳥喙尖 1.6。後輪胎外側露在殼外（輪拱 R17.5 切開側裙，間隙照常）
  // iter-120：翅尖 46.5 → 43.2、x 28 處 43 → 40.5（正面面積與殼面三角面數都跟著縮）
  hw: monoCurve(XS, [13, 16, 19.5, 23, 24, 24.5, 26, 31.5, 40.5, 43.2, 37.5, 19.5, 11.5, 6.6, 3.8, 1.6]),
  // 中線殼頂（鳥背）：前後輪上方 33.6、座艙段 32.4 的低背，往前下斜成鳥頭與鳥喙（喙尖 16.8）
  // iter-120：整體壓低 0.6 mm，鳥頭往前下壓成楔形尖鼻（喙尖 16.8 → 15.2，V3 鼻尖離地 10–16）
  yTop: monoCurve(XS, [27.5, 30, 31.8, 32.6, 32.3, 31.8, 31.6, 31.8, 32.3, 32.6, 30.6, 27, 23.6, 20.4, 17.6, 15.2]),
  // 翅緣（頂面與側裙交界，銳利稜線）：前後輪上方隆起到 32.4（高過 R17.5 輪拱頂 30.5，輪胎上方有完整的殼面），
  // 中段翅緣往下垂到 26.8（翅後緣收進鳥身處）
  yS: monoCurve(XS, [24, 27, 30.4, 31.8, 30.1, 27.6, 26.8, 27.6, 30.1, 31.8, 29.8, 24.6, 20.8, 17.8, 16, 14.6]),
  // 側裙下緣
  yLow: monoCurve(XS, [15, 13.5, 11.5, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11, 12, 12.6, 13, 13.2, 13.4]),
};

/**
 * 半剖面 8 點：中線 → 圓背（鳥身）→ 翅根 → 往外緩降的翅面 → 翅緣（銳利）→ 微外張的側裙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  const d = t - s;
  return [
    [0, t],
    [0.2 * h, t - 0.07 * d],
    [0.38 * h, t - 0.3 * d],
    [0.56 * h, t - 0.6 * d],
    [0.8 * h, t - 0.86 * d],
    [h, s],
    [h + 0.6, lerp(s, lo, 0.5)],
    [h + 1.0, lo],
  ];
};

/**
 * 車尾與頭部每 1 mm 一站，中段每 2 mm（iter-120：0.75 → 1 mm。曲面內部固定每 0.5 mm 取樣，0.75 mm 站距會讓兩端變成每 0.375 mm 一列，
 * 多出約 6% 的殼面三角面，外觀看不出差別）
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = [...buildStations(-58, -50, 1, profile).slice(0, -1), ...buildStations(-50, 58, 2, profile).slice(0, -1), ...buildStations(58, 75, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/**
 * 座艙罩（iter-120）：半橢球殼（俯視橢圓：中心 x 6、前後半長 19、半寬 10.5；底面 y 30、頂 37.8）。
 * 原本用 loft 的座艙曲面（每 0.35 mm 取樣，2.8 萬面＋座艙底 4.9 千面），改成 16 × 6 段的半橢球殼（約 200 面），以殼面積計入質量
 * @type {{ xc: number, a: number, b: number, y0: number, h: number }}
 */
const CANOPY = { xc: 6, a: 19, b: 10.5, y0: 30, h: 7.8 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * Math.sqrt(1 - q * q);
};
/** @type {(x: number, z: number) => number} 座艙罩俯視橢圓的正規化半徑（1 = 底緣） */
const canopyR = (x, z) => Math.hypot((x - CANOPY.xc) / CANOPY.a, z / CANOPY.b);

/** @type {number} 金色鳥喙的起點 x */
const X_BEAK = 70.2;
/** @type {(x: number) => number} 朱紅裙帶上緣（側裙下緣往上 2.4 mm） */
const yRedBand = (x) => P.yLow(x) + 2.4;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // Khokhloma 黑漆：亮面（全車主要的亮面部位）
  black: namedMaterial('paint-khokhloma-black', { color: 0x0e0b0a, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  black2: namedMaterial('paint-khokhloma-black', { color: 0x0e0b0a, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  // 朱紅：霧面（roughness > 0.5 → Blender 緞面）
  cinnabar: namedMaterial('paint-cinnabar-red', { color: 0xb3261e, roughness: 0.56, clearcoat: 0.1 }),
  // 金：真金屬（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xd1a23e, metalness: 0.8, roughness: 0.3, clearcoat: 0.3 }),
  // 琥珀色座艙罩（火光透過鳥背）
  glass: namedMaterial('pc-smoke-tint', { color: 0x4a2a0e, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x161212, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x120e0c, roughness: 0.5, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x15110f, roughness: 0.7, side: THREE.DoubleSide }),
  // 「眼睛像東方水晶」：淡冰色水晶燈片
  eye: namedMaterial('lamp-crystal', { color: 0xf4f8ff, emissive: 0xd8e6ff, emissiveIntensity: 0.35, roughness: 0.06, clearcoat: 1.0 }),
  dGold: decalMaterial('decal-gold-khokhloma', { color: 0xd6a640, metalness: 0.75, roughness: 0.3 }),
  dRed: decalMaterial('decal-cinnabar', { color: 0xc0281c, roughness: 0.5 }),
  dBlack: decalMaterial('decal-lacquer-black', { color: 0x0e0b0a, roughness: 0.3, clearcoat: 0.6 }),
  dShadow: decalMaterial('decal-relief-shadow', { color: 0x050404, roughness: 0.6 }),
});

/**
 * 三支長尾羽（iter-120：評審「羽冠直立」→ 頭頂冠羽拿掉，改成 3 支從座艙後方沿背脊往後飄、到車尾併成尾翼的長羽）：
 * [羽根 x, 羽根 |z|, 羽梢 x, 羽梢 |z|, 羽梢高 y]；中央最長最高，兩側往外張開，三片羽梢在車尾併成一面低而寬的羽翼（V7：貼近車身）
 * @type {number[][]}
 */
const PLUMES = [
  [-14, 0, -71, 0, 43.2],
  [-18, 4.2, -67, 13.5, 41.8],
];

/**
 * 單支尾羽中心線：前段貼著背脊（殼面上 0.25 mm）往後拖，s > 0.42 後才往上揚到羽梢（被風往後吹的拖曳姿態）
 * @type {(top: (x: number, z: number) => number, spec: number[], sg: number) => number[][]} 17 個點
 */
const plumePath = (top, [xr, zr, xe, ze, ye], sg) => {
  /** @type {number[][]} */
  const pts = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const x = lerp(xr, xe, s);
    const z = sg * lerp(zr, ze, s * s);
    const yDeck = top(Math.max(-57.5, x), z) + 0.25;
    const w = Math.max(0, (s - 0.42) / 0.58) ** 1.5;
    pts.push([x, lerp(yDeck, ye, w), z]);
  }
  return pts;
};

/**
 * 尾羽斷面半徑 [羽面半寬, 半厚]：前段 28% 是細羽軸（2 × 1.5），往後展開成扁平羽片（iter-122：中央寬 6.8、兩側寬 6 mm，厚 1.4 mm），羽梢圓鈍收尖
 * （iter-120 第二版：主 agent「三根細桿＋小鉤」→ 羽面加寬）
 * @type {(s: number, w: number) => number[]}
 */
const plumeRadius = (s, w) => {
  let half = w;
  if (s < 0.28) {
    half = 1.0;
  } else if (s < 0.55) {
    half = lerp(1.0, w, Math.sin(((s - 0.28) / 0.27) * (Math.PI / 2)));
  } else if (s > 0.9) {
    half = Math.max(0.6, w * Math.sqrt(Math.max(0, 1 - ((s - 0.9) / 0.1) ** 2)));
  }
  return [half, s < 0.28 ? 0.75 : 0.7];
};

/** @type {[number, number, string][]} 尾羽分段上色：[s0, s1, 材質鍵]（Khokhloma：黑漆羽軸 → 朱紅羽面 → 金色羽梢） */
const PLUME_SEGMENTS = [
  [0, 0.28, 'black2'],
  [0.28, 0.72, 'cinnabar'],
  [0.72, 1, 'gold'],
];

/** @type {THREE.Vector3} */
const UP = new THREE.Vector3(0, 1, 0);

/**
 * 扁平羽片掃掠（sweepEllipse 的區域版，多一個繞羽軸的滾轉角 roll：斷面長軸 = 羽面寬，滾轉後羽片外緣往上翹，像微微張開的鳥尾）
 * 回傳幾何與每個取樣點的 [位置, 切線, 羽面法線, 羽面寬方向]
 * @type {(pts: number[][], n: number, radius: (t: number) => number[], seg: number, roll: number) => { geo: THREE.BufferGeometry, frames: THREE.Vector3[][] }}
 */
const sweepBlade = (pts, n, radius, seg, roll) => {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
  /** @type {THREE.Vector3[][]} */
  const rings = [];
  /** @type {THREE.Vector3[][]} */
  const frames = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = curve.getPointAt(t);
    const tg = curve.getTangentAt(t).normalize();
    const side0 = new THREE.Vector3().crossVectors(tg, UP).normalize();
    const vert0 = new THREE.Vector3().crossVectors(side0, tg).normalize();
    const side = side0.clone().multiplyScalar(Math.cos(roll)).addScaledVector(vert0, Math.sin(roll));
    const vert = new THREE.Vector3().crossVectors(side, tg).normalize();
    frames.push([c, tg, vert, side]);
    const [rw, rt] = radius(t);
    /** @type {THREE.Vector3[]} */
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg;
      ring.push(c.clone().addScaledVector(side, Math.cos(a) * rw).addScaledVector(vert, Math.sin(a) * rt));
    }
    rings.push(ring);
  }
  /** @type {number[]} */
  const pos = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < seg; k++) {
      const a = rings[i][k];
      const b = rings[i][(k + 1) % seg];
      const c = rings[i + 1][(k + 1) % seg];
      const d = rings[i + 1][k];
      pos.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    }
  }
  // 端蓋（繞向同 sweepEllipse：起點朝後、終點朝前，封閉網格才能算體積）
  for (const [ring, flip] of [
    [rings[0], false],
    [rings[n], true],
  ]) {
    const cx = ring.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / seg);
    for (let k = 0; k < seg; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % seg];
      if (flip) {
        pos.push(cx.x, cx.y, cx.z, b.x, b.y, b.z, a.x, a.y, a.z);
      } else {
        pos.push(cx.x, cx.y, cx.z, a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return { geo, frames };
};

/**
 * 三支尾羽（扁平羽片）＋羽梢孔雀眼（貼在羽面上的三層薄橢圓片：金框 → 朱紅 → 黑漆瞳），依材質分組合併
 * 中央羽片水平（寬 6.8），兩側羽片外緣往上翹 40°（寬 6；iter-122 由 28° 加大，側視看得到羽面與孔雀眼）——側視與前 3/4 看得到羽面與孔雀眼
 * @type {(top: (x: number, z: number) => number) => Record<string, THREE.BufferGeometry[]>}
 */
const buildPlumes = (top) => {
  /** @type {Record<string, THREE.BufferGeometry[]>} */
  const byMat = {};
  for (const spec of PLUMES) {
    const center = spec[1] === 0;
    const w = center ? 3.4 : 3.0;
    for (const sg of center ? [1] : [-1, 1]) {
      const path = plumePath(top, spec, sg);
      const n = path.length - 1;
      // 右側（+z）羽片：side 向量朝 −z，外緣往上翹 → roll 取負
      const roll = center ? 0 : (-sg * 40 * Math.PI) / 180;
      for (const [s0, s1, mat] of PLUME_SEGMENTS) {
        const i0 = Math.round(s0 * n);
        const i1 = Math.round(s1 * n);
        const { geo } = sweepBlade(path.slice(i0, i1 + 1), Math.max(4, (i1 - i0) * 2), (t) => plumeRadius(lerp(s0, s1, t), w), 8, roll);
        (byMat[mat] ??= []).push(smoothNormals(geo));
      }
      // 孔雀眼：羽梢前（s ≈ 0.83）、貼在羽面上方
      const { frames } = sweepBlade(path, n, (t) => plumeRadius(t, w), 4, roll);
      const [c, tg, vert, side] = frames[Math.round(0.83 * n)];
      const basis = new THREE.Matrix4().makeBasis(tg, vert, side);
      for (const [r, h, mat] of [
        [3.1, 0.3, 'gold'],
        [2.0, 0.5, 'cinnabar'],
        [0.95, 0.7, 'black2'],
      ]) {
        const disc = new THREE.CylinderGeometry(1, 1, h, 16);
        disc.scale(r * 1.35, 1, Math.min(r, w - 0.2));
        disc.translate(0, 0.55 + h / 2, 0);
        disc.applyMatrix4(basis);
        disc.translate(c.x, c.y, c.z);
        (byMat[mat] ??= []).push(disc);
      }
    }
  }
  return byMat;
};

/**
 * 側面覆羽列（iter-122：iter-120 A/B「兩排橢圓覆羽堆成方形色塊，和車身線條無關」→ 評審建議改成沿前輪拱往後斜排、逐片變小的羽列）：
 * 上排 4 片、下排 3 片，羽根從前輪拱後緣起沿一條往後上斜的線排列，每片往後上 9° 指向車尾，前大後小、間距逐漸拉開
 * （前片蓋住後片羽根，後段漸漸分開，像翅膀覆羽被風往後吹開）；羽端微尖、不分叉。[羽根 x, 羽根 y, 長, 半寬, 傾角（度）]
 * @type {number[][]} 依疊放順序（越前面越上層）
 */
const SIDE_FEATHERS = [
  [23.4, 18.4, 16, 3.0, 9],
  [13.6, 20.2, 13.4, 2.55, 9],
  [2.8, 21.9, 11, 2.1, 9],
  [-9.2, 23.4, 8.6, 1.7, 9],
  [21.6, 14.6, 12, 2.2, 7],
  [12.2, 15.9, 9.6, 1.85, 7],
  [1.8, 17.1, 7.4, 1.5, 7],
];

/**
 * 側面覆羽距離場：回傳最上層蓋住該點的羽片 { k, d（到該片邊界距離，負值 = 片內）, a（沿羽軸往後）, b（離羽軸） }；
 * 沒有任何羽片蓋住時 k = −1、d = 到最近羽片的距離
 * @type {(x: number, y: number) => { k: number, d: number, a: number, b: number }}
 */
const sideFeathers = (x, y) => {
  let nearest = Infinity;
  for (let k = 0; k < SIDE_FEATHERS.length; k++) {
    const [x0, y0, len, w, deg] = SIDE_FEATHERS[k];
    const ang = (deg * Math.PI) / 180;
    const dx = x0 - x;
    const dy = y - y0;
    const a = dx * Math.cos(ang) + dy * Math.sin(ang);
    const b = -dx * Math.sin(ang) + dy * Math.cos(ang);
    // 羽片：橢圓，羽根 1/4 收窄、後 40% 漸收成微尖的羽端
    const A = len / 2;
    const t = a / len;
    let B = w;
    if (t < 0.25) {
      B = w * lerp(0.7, 1, Math.max(0, t) / 0.25);
    } else if (t > 0.6) {
      B = w * lerp(1, 0.7, Math.min(1, (t - 0.6) / 0.4));
    }
    const d = (Math.hypot((a - A) / A, b / B) - 1) * Math.min(A, B);
    if (d < 0) {
      return { k, d, a, b };
    }
    nearest = Math.min(nearest, d);
  }
  return { k: -1, d: nearest, a: 0, b: 0 };
};

/**
 * 翼尖羽緣（iter-120）：前輪上方的翅面外緣一圈朱紅，內緣是 5 道往後指的尖羽（初級飛羽的羽尖），取代整片黑漆；回傳負值 = 在朱紅帶內
 * @type {(x: number, y: number, z: number) => number}
 */
const wingTipBand = (x, y, z) => {
  if (y < P.yS(x) - 0.4 || x < 16 || x > 54) {
    return 1;
  }
  const w = P.hw(x) - Math.abs(z);
  // 鋸齒：每 7.5 mm 一羽，羽尖朝車尾（往後漸寬、到羽尖突然收回）
  const ph = (((x - 16) % 7.5) + 7.5) % 7.5;
  const tooth = 3.4 * (1 - ph / 7.5);
  const fade = Math.min(1, (x - 16) / 8, (54 - x) / 6);
  return w - (3 + tooth) * Math.max(0, fade);
};

export const firebirdBody = makePolyBody({
  id: 'body-firebird',
  name: '火鳥',
  style: 'myth',
  phase: 8,
  mythSeries: 'slavic',
  mythTheme: 'zhar-ptitsa',
  form: 'firebird-glide',
  roof: 'canopy',
  wing: 'plume-train',
  theme: '低而流線的鳥身＋前段展開往後掠的寬翅膀（俯視飛鳥形，翼尖朱紅尖羽）、低壓的金色尖喙、琥珀座艙罩；3 支從座艙後方沿背脊往後飄的扁平長尾羽在車尾併成低寬羽翼（黑羽軸 → 朱紅羽面 → 金羽梢，羽面上孔雀眼）；側面兩排從前輪拱往後一片疊一片的朱紅覆羽（金羽軸、黑羽枝、金描邊）',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 翅緣是銳利稜線
  hard: [5],
  wheelArches: ARCHES,
  sideZMin: 30,
  zones: () => [
    // 金色鳥喙
    { mat: 'gold', keep: (x) => x - X_BEAK },
    // 朱紅裙帶（側裙最下 2.4 mm）
    { mat: 'cinnabar', keep: (x, y) => yRedBand(x) - y },
    // 翼尖朱紅尖羽（iter-120）
    { mat: 'cinnabar', keep: (x, y, z) => -wingTipBand(x, y, z) },
    // 黑漆
    { mat: 'black', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 23.4, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 座艙罩：半橢球殼（琥珀煙燻，殼面積計入質量）
    {
      const dome = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.scale(CANOPY.a, CANOPY.h, CANOPY.b);
      dome.translate(CANOPY.xc, CANOPY.y0, 0);
      parts.push({ geometry: dome, mat: 'glass', shell: true, renderOrder: 3, name: 'canopy-dome' });
    }
    // 三支長尾羽＋孔雀眼羽梢（實體件，依段上色）
    for (const [mat, geos] of Object.entries(buildPlumes(top))) {
      parts.push({ geometry: mergeGeos(geos), mat, solid: true, outline: true, name: `plume-train-${mat}` });
    }
    // 尾羽根座：金色扁橢球，把三支羽根和座艙後緣接成一體
    const boss = new THREE.SphereGeometry(1, 16, 10);
    boss.scale(4.2, 1.4, 6.4);
    boss.translate(-15.5, top(-15.5, 0) - 0.3, 0);
    parts.push({ geometry: boss, mat: 'gold', solid: true, outline: true, name: 'plume-root-boss' });

    // ---- 貼紙 ----
    // 座艙框（金，座艙罩外圍 1.2 mm）＋座艙到羽根座的金色背脊線＋座艙到冠羽的金色頸線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const r = canopyR(x, z);
        const ring = Math.min(r - 0.99, 1 + 1.2 / CANOPY.b - r);
        const neck = Math.min(0.45 - Math.abs(z), x - 25.8, 58 - x);
        return Math.max(ring, neck);
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // 翅緣金線（沿翅緣稜線內側 0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - (P.hw(x) - 1.2)), X_BEAK - 1 - x, x + 56, y - P.yS(x) + 0.1)),
      mat: 'dGold',
      name: 'decal-wing-edge',
    });
    // 翅面羽鱗：往後疊的扇形羽片（金色弧線 0.6 mm），翅根到翅緣、座艙兩側
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (x < -8 || x > 47 || az < canopyHalfW(x) + 3.2 || az > P.hw(x) - 2.6 || wingTipBand(x, y, z) < 0.6) {
          return -1;
        }
        const R = 3.4;
        const row = Math.round((az - 6) / (1.6 * R));
        const zc = 6 + row * 1.6 * R;
        const off = row % 2 === 0 ? 0 : R;
        const xc = Math.round((x - off) / (2 * R)) * 2 * R + off;
        // 羽片弧：圓心在 (xc + R·0.6, zc)，只取後半圈（x < 圓心）
        const cx = xc + 0.6 * R;
        const r = Math.hypot(x - cx, az - zc);
        if (x > cx) {
          return -1;
        }
        return 0.3 - Math.abs(r - R);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-wing-scales',
    });
    // 側面長羽片（iter-120）：上片火焰橘、中下片朱紅；金色羽軸＋金框（線寬 0.7）；羽片下緣一道 0.6 mm 黑影，讓羽片看起來是浮起的浮雕
    /** @type {(x: number, y: number, z: number) => boolean} 側裙（翅緣以下、輪拱外） */
    const onSkirt = (x, y, z) => Math.abs(z) > P.hw(x) - 0.2 && y < P.yS(x) - 0.6 && y > yRedBand(x) + 0.3 && archRingDist(x, y) > 1.2;
    // 朱紅羽面
    parts.push({
      geometry: kit.decal((x, y, z) => (onSkirt(x, y, z) ? -sideFeathers(x, y).d : -1), { offset: 0.1 }),
      mat: 'dRed',
      name: 'decal-side-feathers-red',
    });
    // 金色描邊（最上層那片的邊緣 0.7 mm）＋中央羽軸（寬 0.7，從羽根到羽端前 1.5 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSkirt(x, y, z)) {
          return -1;
        }
        const f = sideFeathers(x, y);
        if (f.k < 0) {
          return -1;
        }
        const len = SIDE_FEATHERS[f.k][2];
        const rim = 0.7 + f.d;
        const rachis = Math.min(0.35 - Math.abs(f.b), len - 1.2 - f.a);
        return Math.max(rim, rachis);
      }, { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-side-feathers-gold',
    });
    // 黑漆羽枝細紋：羽軸兩側往後外斜的細線（每 1.8 mm 一道、線寬 0.6），避開羽軸與描邊
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSkirt(x, y, z)) {
          return -1;
        }
        const f = sideFeathers(x, y);
        if (f.k < 0) {
          return -1;
        }
        const ab = Math.abs(f.b);
        // 羽枝間距隨羽片變小（1.8 → 1.3 mm），線寬 0.6
        const period = lerp(1.3, 1.8, (SIDE_FEATHERS[f.k][3] - 1.5) / 1.5);
        const ph = (((f.a - 0.9 * ab) % period) + period) % period;
        const line = 0.3 - Math.abs(ph - period / 2);
        return Math.min(line, ab - 0.7, -f.d - 0.9, f.a - 1.0);
      }, { offset: 0.12 }),
      mat: 'dBlack',
      name: 'decal-side-feather-barbs',
    });
    // 羽片下緣 0.6 mm 黑影（浮雕感）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSkirt(x, y, z)) {
          return -1;
        }
        return Math.min(-sideFeathers(x, y + 0.6).d, sideFeathers(x, y).d);
      }, { offset: 0.08 }),
      mat: 'dShadow',
      name: 'decal-side-feathers-shadow',
    });
    // 頭頂冠羽（iter-120 改成貼紙）：三道從眼後往後飄、貼著頭頂的金色細羽
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 46 || x > 67 || y < P.yS(x)) {
          return -1;
        }
        const t = (67 - x) / 21;
        let d = Infinity;
        for (const zc of [0, 2.2, -2.2]) {
          const zz = zc * (1 + 1.6 * t);
          d = Math.min(d, Math.abs(z - zz) - 0.45 * (1 - 0.6 * t));
        }
        return -d;
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-crest-plumes',
    });
    // 鳥眼：水晶燈片＋金色眼框（頭部兩側上面）
    /** @type {(grow: number) => (x: number, y: number, z: number) => number} */
    const eye = (grow) => (x, y, z) => {
      if (y < 18 || x < 58) {
        return -1;
      }
      return grow + 1 - Math.hypot((x - 63.2) / 2.1, (Math.abs(z) - 0.62 * P.hw(63.2)) / 1.45);
    };
    parts.push({ geometry: kit.decal(eye(0), { offset: 0.12 }), mat: 'eye', name: 'lamp-crystal-eyes' });
    const eyeIn = eye(0);
    const eyeOut = eye(0.42);
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(eyeOut(x, y, z), -eyeIn(x, y, z)), { offset: 0.1 }), mat: 'dGold', name: 'decal-eye-rims' });
    // 鳥頭的朱紅頰羽（眼後往後下的一道羽紋）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 50 || x > 61 || y < 17) {
          return -1;
        }
        const zc = 0.62 * P.hw(x) + 0.12 * (61 - x);
        return Math.min(1.1 - Math.abs(Math.abs(z) - zc) - 0.06 * (61 - x), x - 50.5);
      }, { offset: 0.1 }),
      mat: 'dRed',
      name: 'decal-cheek-plume',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估；iter-120 改）：殼面 x −58 ~ 75（鳥喙尖），尾羽翼梢約 x −71；殼頂 31.6–32.6、座艙頂約 37.8、尾羽翼頂約 41.3（第九階段 V7：尾翼比座艙頂高 ≤ 10）；前段翅膀半寬 43.2 + 側裙外張 1.0（外框 ±43.3）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；輪拱內襯擋住殼內空腔',
    plumes: '尾羽（iter-120）：3 支 ABS 實心掃掠件（8 段斷面），前段羽軸 2.4 × 1.6 mm 貼背脊，後段攤平成寬約 7、厚 1.5 mm 的水平羽片併成尾翼；羽梢孔雀眼為三層水平薄圓片（金 7.5 × 5.1 × 0.35、朱紅 4.8 × 3.2 × 0.55、黑 2.1 × 1.4 × 0.75 mm，推估）；質量 = 封閉體積 × 1.05 g/cm³',
    crest: '冠羽（iter-120）：改成頭頂三道往後飄的金色貼紙（不再是直立實體件）',
    canopy: '座艙罩（iter-120）：半橢球殼 38 × 21 mm、高 7.8 mm，16 × 6 段，以殼面積 × 0.8 mm 計入質量（推估）',
    palette: 'Khokhloma 漆器的黑＋朱紅＋金（研究來源見 DESIGN.md）；色碼自訂（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
