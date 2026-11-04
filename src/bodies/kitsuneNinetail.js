// 九尾狐（body-kitsune-ninetail，第八階段神話組・日本）：取材日本民間傳說的九尾妖狐（玉藻前傳說；九尾狐源自中國典籍），
// 不是稻荷神使——不用稻荷的白＋朱紅、不放鳥居、寶珠與鑰匙。
// 造型：尖長的狐吻楔形車頭（鼻尖黑漆）、前軸後方一對立起的三角狐耳（實體件，耳內黑漆）、車身中段煙燻座艙罩、
// 車尾 9 條蓬鬆狐尾尾翼（iter-118：粗蓬中空、毛流分面、圓潤毛筆尖；根部錯開排在後甲板上、往後外上方展開；靛藍尾根 → 霧面銀灰毛身 → 白色尾尖）。
// 設計：shared/design/body-kitsune-ninetail/DESIGN.md（典故與文物對應 MYTH_RESEARCH 日本節 J1、J2、J5、J6、J12、J13；
// 黑名單：《火影忍者》九喇嘛、寶可夢九尾〔J14〕、The Fox Jr.、WGP 銀狐隊、旭日放射紋〔J15〕）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：珍珠銀白（上半車身，亮面）、靛藍（下半車身與尾根，霧面）、黑漆（鼻尖、耳內、座艙框，緞面）、
// 金色蒔繪細線（青海波、眼線、腰線）；不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、鼻尖 75.5 */
const XS = [-70, -66, -60, -50, -40, -25, -10, 5, 20, 30, 40, 50, 58, 64, 69, 73, 75.5];
/** @type {number[]} 俯視半寬的站位（比其他參數多一個腰身控制點） */
const XS_HW = [-70, -66, -60, -50, -40, -30, -18, -5, 8, 20, 30, 40, 50, 58, 64, 69, 73, 75.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：狐狸的「深胸—細腰—窄臀」——座艙前的胸最寬 40（x 20）、座艙後段收成細腰 27（x −18）、
  // 後軸上方的臀 37、往後收成窄尾（車尾半寬 15，九尾從上方往外展開）、往前收成尖長狐吻（鼻尖半寬 2.5）
  hw: monoCurve(XS_HW, [15, 18.5, 24, 30, 37, 34, 27, 29.5, 36.5, 40, 33, 33, 26, 21, 15.5, 10, 5.5, 2.5]),
  // 中線殼頂：座艙段 34.3 的低平背，往前一路下斜成楔形狐吻（鼻尖 17.8）
  yTop: monoCurve(XS, [30.5, 32, 33, 33.5, 33.8, 34, 34.2, 34.3, 34.2, 33.6, 32, 29.5, 26.8, 24.3, 21.8, 19.5, 17.8]),
  // 肩稜線高度（頂面與側面交界）
  yS: monoCurve(XS, [27, 28, 28.6, 29, 29.3, 29.5, 29.5, 29.5, 29.5, 29, 28, 25.8, 23.2, 21, 18.8, 17, 16]),
  // 側裙下緣
  yLow: monoCurve(XS, [14, 12.5, 11, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11, 12, 13, 14, 14.8]),
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
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [h + 0.7, lerp(s, lo, 0.5)],
    [h + 1.1, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與狐吻每 0.75 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-70, -60, 0.75, profile).slice(0, -1), ...buildStations(-60, 62, 2, profile).slice(0, -1), ...buildStations(62, 75.5, 0.75, profile)];

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

/** @type {(x: number) => number} 靛藍下半車身的分色線高度（肩稜線往下 4.6 mm） */
const ySplit = (x) => P.yS(x) - 4.6;

/** @type {number} 黑漆鼻尖的起點 x */
const X_NOSE = 72.4;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 珍珠銀白：上半車身（少數亮面部位）
  silver: namedMaterial('paint-pearl-silver-white', { color: 0xe4e6ea, metalness: 0.3, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  // 靛藍（藍染）：霧面
  indigo: namedMaterial('paint-indigo-ai', { color: 0x223061, roughness: 0.62, clearcoat: 0.08 }),
  // 黑漆：緞面（漆器感）
  urushi: namedMaterial('paint-urushi-black', { color: 0x141416, roughness: 0.55, clearcoat: 0.2 }),
  // 真金屬金（尾尖；名稱含 -brass → Blender metallic）
  // 狐尾毛身：霧面銀灰（iter-118；霧面讀成毛、不是亮面羽毛）
  fur: namedMaterial('paint-fox-fur-silvergrey', { color: 0xa7acb6, roughness: 0.72, clearcoat: 0.05 }),
  // 狐尾白尖：霧面雪白（iter-118；取代金色尾尖，不用金毛）
  furTip: namedMaterial('paint-fox-fur-snowwhite', { color: 0xf6f6f2, roughness: 0.68, clearcoat: 0.05 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x262c38, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-indigo', { color: 0x1b2650, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-indigo', { color: 0x1c2240, roughness: 0.7, side: THREE.DoubleSide }),
  // 狐眼燈片：淡冰白（不用紅眼）
  eye: namedMaterial('lamp-ice', { color: 0xf2f6ff, emissive: 0xcfe0ff, emissiveIntensity: 0.4, roughness: 0.08, clearcoat: 1.0 }),
  dGold: decalMaterial('decal-gold-makie', { color: 0xd4b052, metalness: 0.75, roughness: 0.32 }),
  dUrushi: decalMaterial('decal-urushi-black', { color: 0x141416, roughness: 0.5, clearcoat: 0.2 }),
});

/**
 * 把局部座標（u 橫向、v 往上、w 往前）的耳朵幾何擺到車上：往後仰 14°、往外張 11.5°，耳根中心 (31, 30.8, ±11)
 * @type {(g: THREE.BufferGeometry, sg: number) => THREE.BufferGeometry}
 */
const placeEar = (g, sg) => {
  // 局部 w（往前）→ 世界 +x；局部 u → 世界 −z
  g.rotateY(Math.PI / 2);
  // 往後仰（耳尖往 −x）
  g.rotateZ(0.24);
  // 往外張（耳尖往 sg·z）
  g.rotateX(sg * 0.2);
  g.translate(31, 30.8, sg * 11);
  return g;
};

/**
 * 狐耳（單側）：iter-114 改成有厚度的射出件——三角耳板（底寬 10、高 19，兩側微外凸、耳尖小圓角）擠出 1.6 mm、
 * 四周 0.5 mm 圓角倒邊（總厚 2.6 mm），不再是邊緣銳利如刀的四面體（評審：耳朵像無厚度的薄片）；
 * 耳根埋進前罩約 2.5 mm（和殼面接成一體）。耳內另貼一片 0.55 mm 黑漆三角片（略凸出耳面 0.35 mm）
 * @type {(sg: number) => { ear: THREE.BufferGeometry, inner: THREE.BufferGeometry }}
 */
const buildEar = (sg) => {
  /** @type {THREE.Shape} 耳板外形（局部 u 橫向、v 往上） */
  const shape = new THREE.Shape();
  shape.moveTo(-5, 0);
  shape.lineTo(5, 0);
  shape.quadraticCurveTo(3.6, 10.5, 0.7, 18.6);
  shape.quadraticCurveTo(0, 19.4, -0.7, 18.6);
  shape.quadraticCurveTo(-3.6, 10.5, -5, 0);
  /** @type {number} 擠出深度（不含倒邊） */
  const depth = 1.6;
  /** @type {number} 倒邊（圓角）尺寸 */
  const bev = 0.5;
  const ear = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 10 });
  // 耳面（前面）在局部 w = 0，耳板往後佔 w −2.6 → 0
  ear.translate(0, 0, -(depth + bev));
  const innerShape = new THREE.Shape();
  innerShape.moveTo(-3.1, 3.4);
  innerShape.lineTo(3.1, 3.4);
  innerShape.quadraticCurveTo(2.2, 10, 0, 15.2);
  innerShape.quadraticCurveTo(-2.2, 10, -3.1, 3.4);
  const inner = new THREE.ExtrudeGeometry(innerShape, { depth: 0.55, bevelEnabled: false, curveSegments: 8 });
  inner.translate(0, 0, -0.2);
  return { ear: placeEar(ear, sg), inner: placeEar(inner, sg) };
};

/**
 * 輪拱內側擋板（iter-114：修正 Blender 展示圖前輪拱內的黑白條紋）：
 * 原本的輪拱內襯只是靠外側的一段圓柱面，從側面 / 前 3/4 看進輪拱，視線會穿過輪胎上方與前方的空隙、橫越車身、
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
 * chassis-midship 在輪拱內側（|z| 19–26）的障礙物（iter-114 量測，已加 1 mm 間隙）：
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

/** @type {number} 狐尾條數 */
const TAIL_COUNT = 9;

/** @type {number[][]} 各條狐尾的尾尖俯視位置 [x, |z|]（依 |k| = 0 … 4）：外側的尾巴往外張得越開，最外側尾尖 |z| 34 仍在車寬 ±36.7 以內 */
const TAIL_TIPS = [
  [-69.5, 0],
  [-69, 10],
  [-68, 19],
  [-66, 27],
  [-63, 34],
];

/**
 * 單條狐尾的中心線（k = −4 … 4；k = 0 在中線）：根部錯開排在後甲板（z = 2.4k、x 往外略後退），
 * 俯視是二次 Bézier（先往後、尾段再往外甩），側視由根部往上漸翹（尾尖比根部高 13–15.5 mm，中間的較高）；整束像半開的摺扇
 * @type {(k: number) => number[][]} 41 個點（s = 0 … 1）
 */
const tailPath = (k) => {
  const n = 40;
  const sg = Math.sign(k);
  const ak = Math.abs(k);
  const xr = -44 - 0.4 * ak;
  const zr = 2.4 * k;
  const yr = P.yTop(xr) - 1.1 - 0.02 * zr * zr;
  const [xt, azt] = TAIL_TIPS[ak];
  const zt = sg * azt;
  // 控制點：偏向「先往後」，尾段才往外甩
  const xc = lerp(xr, xt, 0.6) - 1.5;
  const zc = lerp(zr, zt, 0.35);
  // 中間的尾巴翹得稍高一點（扇形的層次）
  const rise = 13 + 2.5 * (1 - ak / 4);
  /** @type {number[][]} */
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const x = (1 - s) ** 2 * xr + 2 * s * (1 - s) * xc + s * s * xt;
    const z = (1 - s) ** 2 * zr + 2 * s * (1 - s) * zc + s * s * zt;
    const y = yr + rise * (0.33 * s + 0.67 * s * s);
    pts.push([x, y, z]);
  }
  return pts;
};

/**
 * 狐尾斷面基準半徑 [橫向, 垂直]（iter-118：改成粗蓬的狐尾）：根部 1.4 細頸 → s 0.62 鼓到 2.7 × 2.5（斷面約 5.4 × 5.0 mm，毛束稜再外凸約 8%）
 * → 尾端以橢圓弧圓潤收成毛筆尖（0.35）；垂直略扁（蓬鬆圓尾）
 * @type {(s: number) => number[]}
 */
const tailRadius = (s) => {
  let rz;
  if (s <= 0.62) {
    const u = Math.min(1, Math.max(0, (s - 0.2) / 0.42));
    rz = lerp(1.4, 2.7, u * u * (3 - 2 * u));
  } else {
    // 尾端：圓潤收成毛筆尖（不是針尖），最後 0.35 mm 半徑
    const v = (s - 0.62) / 0.38;
    rz = Math.max(0.35, 2.7 * Math.sqrt(Math.max(0, 1 - v * v)) ** 0.85);
  }
  return [rz, 0.93 * rz];
};

/**
 * 毛流分面倍率：斷面上 7 道往尾尖螺旋的毛束稜（餘弦起伏，稜高約 ±8%，圓潤不尖銳），
 * 再加沿長度 5 層「一撮疊一撮」的毛層（每層前端鼓、後端收，像層層覆蓋的毛簇）；尾尖 10% 漸收成光滑尖端
 * @type {(s: number, a: number) => number}
 */
const furScale = (s, a) => {
  const ph = (7 * a) / (2 * Math.PI) + 1.6 * s;
  const tri = Math.cos(2 * Math.PI * ph);
  const layer = ((s * 5.5) % 1 + 1) % 1;
  const fade = Math.min(1, (1 - s) / 0.1);
  return 1 + fade * (0.08 * tri + 0.06 * (0.5 - layer));
};

/**
 * 沿中心線掃掠帶毛流分面的狐尾段（s0 → s1 為整條尾巴的長度參數），兩端封口（封閉網格，可算體積）
 * @type {(pts: number[][], n: number, s0: number, s1: number, seg: number) => THREE.BufferGeometry}
 */
const sweepFur = (pts, n, s0, s1, seg) => {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
  const frames = curve.computeFrenetFrames(n, false);
  const up = new THREE.Vector3(0, 1, 0);
  /** @type {THREE.Vector3[][]} */
  const rings = [];
  /** @type {THREE.Vector3[][]} 內壁（中空射出件，壁厚 TAIL_WALL；細到放不下內腔的地方收成中心點） */
  const inner = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = lerp(s0, s1, t);
    const c = curve.getPointAt(t);
    const tg = frames.tangents[i];
    const side = new THREE.Vector3().crossVectors(tg, up).normalize();
    const vert = new THREE.Vector3().crossVectors(side, tg).normalize();
    const [rz, ry] = tailRadius(s);
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg;
      const m = furScale(s, a);
      ring.push(c.clone().addScaledVector(side, Math.cos(a) * rz * m).addScaledVector(vert, Math.sin(a) * ry * m));
    }
    rings.push(ring);
    const iz = Math.max(0, rz - TAIL_WALL);
    const iy = Math.max(0, ry - TAIL_WALL);
    const iring = [];
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg;
      iring.push(c.clone().addScaledVector(side, Math.cos(a) * iz).addScaledVector(vert, Math.sin(a) * iy));
    }
    inner.push(iring);
  }
  /** @type {number[]} */
  const pos = [];
  /** @type {(...v: THREE.Vector3[]) => void} */
  const tri = (...v) => {
    for (const p of v) {
      pos.push(p.x, p.y, p.z);
    }
  };
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg;
      // 外壁
      tri(rings[i][k], rings[i + 1][k], rings[i + 1][k1], rings[i][k], rings[i + 1][k1], rings[i][k1]);
      // 內壁（反向繞，體積扣掉內腔）
      tri(inner[i][k], inner[i + 1][k1], inner[i + 1][k], inner[i][k], inner[i][k1], inner[i + 1][k1]);
    }
  }
  // 端蓋＝外環到內環的環形片（繞向同 polyBody.sweepEllipse：起點蓋朝後、終點蓋朝前）
  for (const [i, flip] of /** @type {[number, boolean][]} */ ([
    [0, false],
    [n, true],
  ])) {
    for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg;
      const [a, b, ai, bi] = [rings[i][k], rings[i][k1], inner[i][k], inner[i][k1]];
      if (flip) {
        tri(ai, b, a, ai, bi, b);
      } else {
        tri(ai, a, b, ai, b, bi);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @type {number} 狐尾壁厚（mm）：中空射出件（左右兩半黏合，推估），壁厚 1.2 符合薄片 ≥ 1.2 mm */
const TAIL_WALL = 1.2;

/** @type {[number, number, string][]} 狐尾分段上色：[s0, s1, 材質鍵]（靛藍尾根 → 霧面銀灰毛身 → 白色尾尖；iter-118 拿掉金色尾尖） */
const TAIL_SEGMENTS = [
  [0.15, 0.3, 'indigo'],
  [0.3, 0.84, 'fur'],
  [0.84, 1, 'furTip'],
];

/**
 * 九條狐尾，依材質分組合併（平滑法線，毛束稜讀成蓬鬆的毛流而不是結晶稜角）
 * @type {() => Record<string, THREE.BufferGeometry>}
 */
const buildTails = () => {
  /** @type {Record<string, THREE.BufferGeometry[]>} */
  const byMat = {};
  for (let k = -(TAIL_COUNT - 1) / 2; k <= (TAIL_COUNT - 1) / 2; k++) {
    const path = tailPath(k);
    const n = path.length - 1;
    for (const [s0, s1, mat] of TAIL_SEGMENTS) {
      const i0 = Math.round(s0 * n);
      const i1 = Math.round(s1 * n);
      const pts = path.slice(i0, i1 + 1);
      const g = sweepFur(pts, Math.max(8, (i1 - i0) * 3), s0, s1, 28);
      (byMat[mat] ??= []).push(smoothNormals(g));
    }
  }
  /** @type {Record<string, THREE.BufferGeometry>} */
  const out = {};
  for (const [mat, geos] of Object.entries(byMat)) {
    out[mat] = mergeGeos(geos);
  }
  return out;
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
 * 狐眼（俯視杏仁形，斜放在狐吻兩側的上面）：兩圓交集的透鏡，內角在前內側、外角往後外上挑
 * @type {(grow: number) => (x: number, y: number, z: number) => number} 正值 = 在眼內（grow 往外擴）
 */
const eyeKeep = (grow) => {
  const inner = [61, 10.2];
  const outer = [53, 16.8];
  const cx = (inner[0] + outer[0]) / 2;
  const cz = (inner[1] + outer[1]) / 2;
  const ax = outer[0] - inner[0];
  const az = outer[1] - inner[1];
  const half = Math.hypot(ax, az) / 2;
  const ux = ax / (2 * half);
  const uz = az / (2 * half);
  const b = 1.7;
  const rv = (half * half + b * b) / (2 * b);
  const dv = rv - b;
  return (x, y, z) => {
    if (y < 20) {
      return -1;
    }
    const px = x - cx;
    const pz = Math.abs(z) - cz;
    const along = px * ux + pz * uz;
    const across = -px * uz + pz * ux;
    const d = Math.max(Math.hypot(along, across - dv), Math.hypot(along, across + dv)) - rv;
    return grow - d;
  };
};

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
  theme: '尖長狐吻楔形車頭＋前軸後方一對立起的三角狐耳、中段煙燻座艙罩、車尾 9 條往後外上方展開的狐尾尾翼；銀白＋靛藍＋黑漆＋金蒔繪的夜行妖狐',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 肩稜線是銳利稜線
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 超橢圓座艙：x 21.6 → −15.6（每 1.24 mm 一站）；最寬 12.5、最高 10.5（座艙頂約 44.6）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = lerp(21.6, -15.6, u);
        const halfW = Math.max(2.6, canopyHalfW(x));
        const rise = 10.5 * Math.sin(Math.PI * u ** 0.8) ** 0.6;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 黑漆鼻尖
    { mat: 'urushi', keep: (x) => x - X_NOSE },
    // 靛藍下半車身
    { mat: 'indigo', keep: (x, y) => ySplit(x) - y },
    // 珍珠銀白上半車身
    { mat: 'silver', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'indigo', glass: 'glass', cockpit: 'urushi', mount: 'mount' },
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
    // iter-114：輪胎內側的環形擋板（|z| 22.9 = 內襯內緣，接成一個輪室；離 26 mm 輪內側面 2.4、31 mm 輪 1.9 mm）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 狐耳（實體件）＋耳內黑漆
    const ears = [-1, 1].map((sg) => buildEar(sg));
    parts.push({ geometry: mergeGeos(ears.map((e) => e.ear)), mat: 'silver', solid: true, outline: true, name: 'fox-ears' });
    parts.push({ geometry: mergeGeos(ears.map((e) => e.inner)), mat: 'urushi', solid: true, outline: true, name: 'fox-ears-inner' });
    // 九條狐尾（實體件，依段上色）
    const tails = buildTails();
    for (const [mat, g] of Object.entries(tails)) {
      parts.push({ geometry: g, mat, solid: true, outline: true, name: `nine-tails-${mat}` });
    }
    // 尾根座：黑漆扁橢球，把九條尾根和後甲板接成一體
    const boss = new THREE.SphereGeometry(1, 32, 16);
    boss.scale(5, 1.7, 11);
    boss.translate(-45, P.yTop(-45) - 0.5, 0);
    parts.push({ geometry: boss, mat: 'urushi', solid: true, outline: true, name: 'tail-root-boss' });

    // ---- 貼紙 ----
    // 座艙框（黑漆，座艙罩外圍 1.4 mm）＋座艙到尾根座的黑漆背脊線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        const ring = x > -16.8 && x < 22.8 ? Math.min(u + 1.4, 0.05 - u) : -1;
        const spine = Math.min(1.2 - Math.abs(z), -14.5 - x, x + 40);
        return Math.max(ring, spine);
      }),
      mat: 'dUrushi',
      name: 'decal-canopy-frame',
    });
    // 狐眼：冰白燈片＋黑漆眼框＋往後上挑的金色眼尾線
    parts.push({ geometry: kit.decal(eyeKeep(0), { offset: 0.1 }), mat: 'eye', name: 'lamp-fox-eyes' });
    const eyeIn = eyeKeep(0);
    const eyeOut = eyeKeep(0.75);
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(eyeOut(x, y, z), -eyeIn(x, y, z)), { offset: 0.1 }), mat: 'dUrushi', name: 'decal-eye-rims' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < 20) {
          return -1;
        }
        // 眼尾線：外角 (53, 16.8) 往後外延伸到 (45.5, 21.5)，線寬 0.7
        const az = Math.abs(z);
        const t = Math.max(0, Math.min(1, ((x - 52.6) * -7.5 + (az - 17.1) * 4.7) / (7.5 * 7.5 + 4.7 * 4.7)));
        const px = 52.6 - 7.5 * t;
        const pz = 17.1 + 4.7 * t;
        return 0.35 - Math.hypot(x - px, az - pz);
      }),
      mat: 'dGold',
      name: 'decal-eye-flicks',
    });
    // 分色線上的金蒔繪腰線
    parts.push({
      geometry: kit.decal((x, y) => Math.min(0.34 - Math.abs(y - (ySplit(x) + 0.4)), X_NOSE - 1 - x, x + 68.5)),
      mat: 'dGold',
      name: 'decal-makie-beltline',
    });
    // 側面青海波（前後輪之間的靛藍下半車身，金蒔繪細線）
    const wave = seigaiha(4.5, 9.8);
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(wave(u, v), Math.abs(u) - 20.5, v - (ySplit(u) - 1.2), 11.6 - v), { x0: 0, y0: 0, zMin: 30, side })),
        mat: 'dGold',
        name: `decal-seigaiha-${side}`,
      });
    }
    // 後側面一道往尾根上揚的金蒔繪弧線（尾巴的「勢」）
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(
          sideDecal(
            (u, v) => {
              const c = P.yS(u) - 1.6 - 1.8 * Math.sin((Math.PI * (u + 64)) / 44);
              return Math.max(Math.abs(v - c) - 0.33, -64 - u, u + 18);
            },
            { x0: 0, y0: 0, zMin: 30, side },
          ),
        ),
        mat: 'dGold',
        name: `decal-makie-tail-sweep-${side}`,
      });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：長 145.5（車尾 −70 ~ 鼻尖 75.5，batch2 規格「長約 140–150」）、殼頂 34.3、座艙頂 44.6、耳尖約 49.8（batch2「高約 45–52（耳尖）」）；寬 ±40（座艙前的胸；座艙後細腰 ±27、後軸臀 ±37）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    ears: '狐耳：ABS 實心耳板（底寬 10 × 高 19、擠出 1.6 mm＋0.5 mm 圓角倒邊，總厚 2.6 mm；iter-114 由四面體改）＋耳內 0.55 mm 黑漆片（推估），質量 = 封閉體積 × 1.05 g/cm³',
    tails: '九條狐尾（iter-118）：ABS 中空掃掠件（壁厚 1.2、外露長約 22–25 mm、最粗斷面約 5.4 × 5.0 mm＋毛束稜 ±8%、白色毛筆尖，推估），根部錯開 2.4 mm 排在後甲板＋黑漆尾根座，展開成半開摺扇：尾尖 x −63 ~ −69.5、最外 |z| 34（車寬 ±36.7 以內）、尾尖高約 46–48（不碰後導輪：後導輪頂 y 20.5）',
    palette: '配色依 batch2 主 agent 決定（銀白＋靛藍＋黑漆＋少量金蒔繪，不用稻荷朱白、不用金毛 / 橘色主體、不用紅眼）；黑漆 #1B1B1B、金 #C9A54A 取 MYTH_RESEARCH 6-2（推估），其餘色碼自訂',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
