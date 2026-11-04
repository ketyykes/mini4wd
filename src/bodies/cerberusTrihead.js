// 三頭犬（body-cerberus-trihead，第八階段神話組・希臘）：低趴、肩部寬厚的全罩，車頭從同一個寬肩長出三顆犬頭
// （iter-113：顱＋額段＋方口吻＋微張下顎、鼻墊、眉骨與白眼點、往後豎的三角耳＋陶土色內耳；中間頭略前略大，
// 兩側往外偏 12°；中空射出件，頸根埋進引擎蓋）、中後段暗紅煙燻座艙罩、
// 車尾一條往上彎再往後的蛇形尾鰭（實體件，扁平斷面，尾端一個小蛇頭）。
// 設計：shared/design/body-cerberus-trihead/DESIGN.md（MYTH_RESEARCH G3–G5、G12：羅浮宮 E 701 卡厄瑞水罐、《書庫》2.122 的「三個犬頭、蛇尾、背上蛇頭」、黑繪技法）。
// 塗裝：黑繪陶風格——赭紅陶土（霧面）＋半光澤黑釉（緞面，iter-113）、刻線（露出陶土色的細線）、白 / 深紅加彩、前胸項圈與回紋飾帶；全為自創，不含任何文字或商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-71, -66, -58, -48, -40, -28, -14, 0, 14, 28, 40, 48, 53, 56];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：低趴（最高 32），車尾往下收；前段引擎蓋往前下斜（兩肩高於中線），三個犬頭從斜面上長出
  yC: monoCurve(XS, [24.5, 27.5, 30, 31.2, 31.6, 31.8, 32, 32, 32, 31.8, 30.6, 28.4, 25.8, 23.6]),
  // 側肩稜線（iter-113：一律低於中線頂 ≥ 0.8，頂面是單純外凸的拱，不再有高於中線的肩肌隆起 → 消除波浪反光）
  yE: monoCurve(XS, [21.5, 24.5, 28, 29.6, 30, 29.6, 28.2, 28, 28.4, 29.6, 29.2, 27.2, 24.6, 22.4]),
  // 半寬（俯視楔形）：肩部最寬厚（46.5，前輪上方），往後一路收窄成細瘦的後半身（後輪上方 32，後輪外側露出），車尾 27
  hw: monoCurve(XS, [24.5, 26, 27.6, 28.6, 29, 29.4, 30.2, 32.4, 37.6, 45.4, 48.2, 46.6, 41.4, 33.5]),
  // 側壁下緣
  yLow: monoCurve(XS, [19, 17.2, 14.5, 13, 12.6, 12.5, 12.5, 12.5, 12.5, 12.5, 12.6, 13.4, 15, 16.6]),
};

/**
 * 半剖面 7 點：中線頂 → 頂拱三點（單調往外降，外凸、無起伏）→ 肩稜（銳利）→ 側壁 → 側壁下緣（內收）
 * iter-113：原本的「肩肌隆起」點高於中線，殼面起伏造成 Blender 黑釉大片波浪反光，改成單純的外凸頂拱
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yE = Math.min(P.yE(x), yC - 0.8);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const rise = yC - yE;
  /** @type {(u: number) => number} 頂拱：u = |z| / hw，y = yE + rise·(1 − u^2.4) */
  const crown = (u) => yE + rise * (1 - u ** 2.4);
  return [
    [0, yC],
    [0.38 * hw, crown(0.38)],
    [0.7 * hw, crown(0.7)],
    [hw - 2.4, crown((hw - 2.4) / hw)],
    [hw, yE],
    [hw, lerp(yE, yLow, 0.55)],
    [hw - 0.6, yLow],
  ];
};

const STATIONS = buildStations(-71, 56, 1.5, profile);

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 側壁（肩稜以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 0.3;

/** 回紋飾帶（側壁下段赭紅帶上的黑色回紋）：帶的上下緣高度 */
const FRIEZE = { y0: 13.6, y1: 18.6 };

/**
 * 線段距離（膠囊）
 * @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number}
 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/**
 * 回紋（鉤形連續回紋，週期 4 單位、高 3 單位，線寬 0.6 單位）：u 沿帶、v 由帶下緣往上（單位 mm × scale）
 * 每個週期：底線全長＋往上的鉤（x+3 上到頂、往回 2 格、下 2 格、往前 1 格）
 * @type {(u: number, v: number, unit: number) => number} 回傳距離（負值 = 線內）
 */
const meanderSd = (u, v, unit) => {
  const uu = u / unit;
  const vv = v / unit;
  const p = Math.floor(uu / 4) * 4;
  const lu = uu - p;
  /** @type {number[][]} 單一週期的折線（含相鄰週期的端點避免接縫斷線） */
  const segs = [
    [-4, 0, 8, 0],
    [3, 0, 3, 3],
    [3, 3, 1, 3],
    [1, 3, 1, 1],
    [1, 1, 2, 1],
    [-1, 0, -1, 3],
    [-1, 3, -3, 3],
    [7, 0, 7, 3],
    [7, 3, 5, 3],
    [5, 3, 5, 1],
    [5, 1, 6, 1],
  ];
  let d = Infinity;
  for (const [ax, ay, bx, by] of segs) {
    d = Math.min(d, segDist(lu, vv, ax, ay, bx, by));
  }
  return (d - 0.3) * unit;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 黑釉：黑繪陶的半光澤黑（iter-113 改緞面 roughness 0.56：原 0.3 亮面在 Blender 出現大片波浪反光），赭紅陶土為霧面
  black: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.4 }),
  black2: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.4, side: THREE.DoubleSide }),
  clay: namedMaterial('paint-terracotta-clay', { color: 0xc0623a, roughness: 0.72, clearcoat: 0.0 }),
  clay2: namedMaterial('paint-terracotta-clay', { color: 0xc0623a, roughness: 0.72, clearcoat: 0.0, side: THREE.DoubleSide }),
  // 加彩：深紅（項圈）、白（眼、項圈細環）——陶繪加彩是霧面礦物顏料
  addedRed: namedMaterial('paint-added-red', { color: 0x7e2220, roughness: 0.66, clearcoat: 0.05 }),
  addedWhite: namedMaterial('paint-added-white', { color: 0xeee6d6, roughness: 0.6, clearcoat: 0.05 }),
  // 鼻墊：全車唯一的亮面黑（和緞面黑釉的犬頭做出光澤對比）
  nose: namedMaterial('paint-nose-gloss-black', { color: 0x0b0a0a, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1412, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-clay', { color: 0xa9532f, roughness: 0.7, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x1a1412, roughness: 0.85, side: THREE.DoubleSide }),
  // 暗紅煙燻座艙罩（有色透明 PC：保留色相）
  glass: namedMaterial('pc-tint-garnet-smoke', { color: 0x5a1416, roughness: 0.06, specularIntensity: 0.6, transparent: true, opacity: 0.62, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-clay', { color: 0x5a2c1c, roughness: 0.8, side: THREE.DoubleSide }),
  dIncised: decalMaterial('decal-incised-clay', { color: 0xc0623a, roughness: 0.72 }),
  dBlack: decalMaterial('decal-figure-black', { color: 0x141110, roughness: 0.4 }),
  dRed: decalMaterial('decal-added-red', { color: 0x7e2220, roughness: 0.66 }),
  dWhite: decalMaterial('decal-added-white', { color: 0xeee6d6, roughness: 0.6 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯（沿垂直側壁內側裁切，參考 zeppelin 的 buildHullLiner）：只取上半圈，擋住從輪拱看進去的殼內空腔與底盤空隙
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.12;
  const a1 = Math.PI - 0.12;
  const pos = [];
  /** @type {(t: number) => number} 該角度的側壁內面 z */
  const zIn = (t) => P.hw(arch.x + r * Math.cos(t)) - 1.2;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zIn(t0) - depth);
      const B = p(t1, zIn(t1) - depth);
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
 * 犬頭斷面（局部座標：x 沿頭往前、y 往上、z 橫向）：中心高度 yc、半寬 w、半高 h、超橢圓指數 p（2 = 橢圓，越大越方）
 * @typedef {{ x: number, yc: number, w: number, h: number, p: number }} HeadSection
 */

/** @type {HeadSection[]} 上半顆頭（頸根 → 顱 → 額段（stop）→ 方口吻 → 鼻端）；口吻下緣 = 嘴線 */
const HEAD_UPPER = [
  { x: 0, yc: -1.2, w: 4.4, h: 3.0, p: 2 },
  { x: 3.5, yc: 1.0, w: 5.0, h: 4.2, p: 2 },
  { x: 7, yc: 2.7, w: 5.9, h: 5.0, p: 2.1 },
  { x: 10, yc: 3.2, w: 6.2, h: 5.0, p: 2.2 },
  { x: 12.8, yc: 2.9, w: 5.8, h: 4.4, p: 2.3 },
  { x: 15, yc: 2.0, w: 4.8, h: 3.4, p: 2.5 },
  { x: 16.8, yc: 1.3, w: 4.0, h: 2.8, p: 2.8 },
  { x: 19.5, yc: 1.1, w: 3.7, h: 2.6, p: 2.9 },
  { x: 22.5, yc: 0.95, w: 3.4, h: 2.4, p: 2.8 },
  { x: 24.4, yc: 0.9, w: 3.0, h: 2.2, p: 2.5 },
  { x: 25.4, yc: 0.9, w: 2.2, h: 1.7, p: 2.2 },
  { x: 25.9, yc: 0.9, w: 1.0, h: 0.8, p: 2 },
];
/** @type {HeadSection[]} 下顎（微張，前端往下 8° 左右，露出口內的深紅） */
const HEAD_JAW = [
  { x: 11.5, yc: -1.2, w: 4.2, h: 1.9, p: 2.2 },
  { x: 15, yc: -2.0, w: 3.6, h: 1.5, p: 2.4 },
  { x: 19, yc: -2.6, w: 3.0, h: 1.15, p: 2.4 },
  { x: 22.2, yc: -3.1, w: 2.4, h: 0.95, p: 2.2 },
  { x: 23.4, yc: -3.25, w: 1.4, h: 0.6, p: 2 },
];
/** @type {HeadSection[]} 口內（深紅加彩，夾在上下顎之間） */
const HEAD_MOUTH = [
  { x: 15, yc: -1.6, w: 2.7, h: 0.9, p: 2.4 },
  { x: 23.2, yc: -1.95, w: 2.2, h: 0.8, p: 2.4 },
  { x: 23.8, yc: -1.95, w: 1.1, h: 0.4, p: 2 },
];

/**
 * 斷面線性內插（局部 x 處）
 * @type {(secs: HeadSection[], x: number) => HeadSection}
 */
const sectionAt = (secs, x) => {
  for (let i = 0; i < secs.length - 1; i++) {
    const a = secs[i];
    const b = secs[i + 1];
    if (x <= b.x || i === secs.length - 2) {
      const t = Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x)));
      return { x, yc: lerp(a.yc, b.yc, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), p: lerp(a.p, b.p, t) };
    }
  }
  return secs[0];
};

/**
 * 超橢圓斷面環（局部 x 處的一圈頂點）
 * @type {(s: HeadSection, seg: number) => THREE.Vector3[]}
 */
const sectionRing = (s, seg) => {
  /** @type {THREE.Vector3[]} */
  const ring = [];
  const e = 2 / s.p;
  for (let k = 0; k < seg; k++) {
    const a = (2 * Math.PI * k) / seg;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    ring.push(new THREE.Vector3(s.x, s.yc + s.h * Math.sign(sn) * Math.abs(sn) ** e, s.w * Math.sign(c) * Math.abs(c) ** e));
  }
  return ring;
};

/**
 * 放樣網格累加器：側面（相鄰兩環）、端蓋（環＋中心）、環狀端面（外環＋內環）；inward = 反向繞（內腔面）
 * 繞向同 sweepEllipse：外法線朝外（散度定理算體積）
 */
class LoftMesh {
  constructor() {
    /** @type {number[]} */
    this.pos = [];
  }

  /** @type {(...vs: THREE.Vector3[]) => void} */
  put(...vs) {
    vs.forEach((v) => this.pos.push(v.x, v.y, v.z));
  }

  /** @type {(rings: THREE.Vector3[][], inward: boolean) => void} */
  sides(rings, inward) {
    const seg = rings[0].length;
    for (let i = 0; i < rings.length - 1; i++) {
      for (let k = 0; k < seg; k++) {
        const a = rings[i][k];
        const b = rings[i][(k + 1) % seg];
        const c = rings[i + 1][(k + 1) % seg];
        const d = rings[i + 1][k];
        if (inward) {
          this.put(a, c, d, a, b, c);
        } else {
          this.put(a, d, c, a, c, b);
        }
      }
    }
  }

  /** @type {(ring: THREE.Vector3[], facingBack: boolean) => void} 端蓋：facingBack = 朝 −x（起點蓋） */
  cap(ring, facingBack) {
    const seg = ring.length;
    const cx = ring.reduce((acc, p) => acc.clone().add(p), new THREE.Vector3()).multiplyScalar(1 / seg);
    for (let k = 0; k < seg; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % seg];
      if (facingBack) {
        this.put(cx, a, b);
      } else {
        this.put(cx, b, a);
      }
    }
  }

  /** @type {(outer: THREE.Vector3[], inner: THREE.Vector3[]) => void} 起點的環狀端面（朝 −x），外環與內環同點數 */
  annulus(outer, inner) {
    const seg = outer.length;
    for (let k = 0; k < seg; k++) {
      const a = outer[k];
      const b = outer[(k + 1) % seg];
      const ia = inner[k];
      const ib = inner[(k + 1) % seg];
      this.put(ia, a, b, ia, b, ib);
    }
  }

  /** @type {() => THREE.BufferGeometry} */
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    return g;
  }
}

/**
 * 沿 x 放樣超橢圓斷面的實心封閉件（兩端加蓋）
 * @type {(secs: HeadSection[], seg?: number) => THREE.BufferGeometry}
 */
const loftSections = (secs, seg = 28) => {
  const m = new LoftMesh();
  const rings = secs.map((s) => sectionRing(s, seg));
  m.sides(rings, false);
  m.cap(rings[0], true);
  m.cap(rings[rings.length - 1], false);
  return m.geometry();
};

/**
 * 中空射出件（後端開口、壁厚 wall）：外形放樣＋往內縮 wall 的內腔面（到 x1 封底），後端用環狀端面把外、內面連成同一塊，
 * 質量計算（index.js closedVolume：同一連通塊的有號體積）= 外形體積 − 內腔體積
 * @type {(secs: HeadSection[], wall: number, x1: number, seg?: number) => THREE.BufferGeometry}
 */
const hollowLoft = (secs, wall, x1, seg = 28) => {
  const m = new LoftMesh();
  const outer = secs.map((s) => sectionRing(s, seg));
  /** @type {THREE.Vector3[][]} */
  const inner = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const sc = sectionAt(secs, lerp(secs[0].x, x1, i / n));
    inner.push(sectionRing({ ...sc, w: sc.w - wall, h: sc.h - wall }, seg));
  }
  m.sides(outer, false);
  m.cap(outer[outer.length - 1], false);
  m.sides(inner, true);
  // 內腔前端封底（法線朝內腔 = −x）
  m.cap(inner[inner.length - 1], true);
  m.annulus(outer[0], inner[0]);
  return m.geometry();
};

/**
 * 立在 yz 平面、往後豎起的三角耳（局部：底邊中心在原點、厚度沿 x；lean = 往後傾角、splay = 往外張角；
 * inset > 0 時是內縮的內耳片，xOff = 沿厚度方向往前移，貼在耳朵前面）
 * @type {(w: number, h: number, thick: number, lean: number, splay: number, inset?: number, xOff?: number) => THREE.BufferGeometry}
 */
const earPlate = (w, h, thick, lean, splay, inset = 0, xOff = 0) => {
  const shape = new THREE.Shape([
    new THREE.Vector2(-w / 2 + inset, inset * 0.7),
    new THREE.Vector2(w / 2 - inset, inset * 0.7),
    new THREE.Vector2(0, h - inset * 1.8),
  ]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  // 形狀 (X, Y)、厚度沿 Z；rotateY(90°) 後 X → −z、Z → x
  g.translate(0, 0, -thick / 2);
  g.rotateY(Math.PI / 2);
  g.translate(xOff, 0, 0);
  g.rotateZ((lean * Math.PI) / 180);
  g.rotateX((splay * Math.PI) / 180);
  return g;
};

/**
 * 犬頭擺位：局部座標的頸根放在 (x, y, z)，往外偏航 yaw 度（正值 = 頭往 +z 偏）
 * @typedef {{ x: number, y: number, z: number, yaw: number, s: number }} HeadPose
 */
/** @type {HeadPose[]} 中間頭略前略大，兩側頭往外偏、略後 */
const HEADS = [
  { x: 48.5, y: 25.8, z: 0, yaw: 0, s: 1.12 },
  { x: 44.5, y: 25.4, z: -18.2, yaw: -12, s: 1.04 },
  { x: 44.5, y: 25.4, z: 18.2, yaw: 12, s: 1.04 },
];
/** @type {(pose: HeadPose) => THREE.Matrix4} 局部 → 車殼座標 */
const headMatrix = (pose) =>
  new THREE.Matrix4()
    .makeTranslation(pose.x, pose.y, pose.z)
    .multiply(new THREE.Matrix4().makeRotationY((-pose.yaw * Math.PI) / 180))
    .multiply(new THREE.Matrix4().makeScale(pose.s, pose.s, pose.s));

/** 蛇形尾鰭路徑（從座艙後方的背上順著往上彎、再往後微垂；根部沿背脊拉長融進殼面） */
const TAIL_PATH = [[-36, 29.6, 0], [-46, 32.4, 0], [-55, 36.2, 0], [-62, 39.2, 0], [-66.4, 39.4, 0], [-68.6, 38.4, 0]];

/** 座艙罩（暗紅煙燻，中後段）：x 12 → −32 */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(12, -32, u);
      const halfW = i === 0 || i === n ? 2.5 : 11.5 * Math.sin(Math.PI * u ** 0.9) ** 0.55;
      const rise = 8.2 * Math.sin(Math.PI * u ** 0.75) ** 0.65;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定（神話組欄位由下方匯出時補進 BodyDef） */
const CONFIG = {
  id: 'body-cerberus-trihead',
  name: '冥府三頭犬',
  style: 'myth',
  phase: 8,
  mythSeries: 'greek',
  mythTheme: 'cerberus',
  form: 'tri-snout',
  roof: 'canopy',
  wing: 'serpent-tail',
  theme: '低趴寬肩全罩、車頭從同一個寬肩長出三顆豎耳犬頭（中間略前、短吻鼻墊、白眼點、微張的嘴）、中後段暗紅煙燻座艙罩、車尾往上彎再往後的蛇形尾鰭；黑繪陶的赭紅＋緞面黑釉＋刻線',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 0.8,
  // 平滑剖面：只有肩稜（4）是銳利稜線
  hard: [4],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  canopy: CANOPY,
  sideZMin: 28,
  zones: () => [
    // 黑釉：輪拱外 1.6 mm 一圈（側面赭紅底上的黑色輪拱框）
    { mat: 'black', keep: (x, y, z) => (onSide(x, z) ? 1.6 - archRingDist(x, y) : -1) },
    // 赭紅陶土：整片側壁（肩稜以下）——陶繪的赭紅底；犬身（背、肩、頭）是黑釉，俯視黑、側視赭紅
    { mat: 'clay', keep: (x, y, z) => (onSide(x, z) ? 1 : -1) },
    // 赭紅陶土：前胸（三個犬頭之間的頸根，像陶繪的底色從頸間露出；兩肩前緣維持黑釉）
    { mat: 'clay', keep: (x, y, z) => Math.min(x - 54.5, 27 - Math.abs(z)) },
    { mat: 'black', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 三個犬頭（實體件）：從同一個寬肩的前胸長出，頸根埋進引擎蓋；中間頭略前略大、兩側往外偏 12° ──
    // 每顆頭：顱＋額段（stop）＋方口吻（上半顆）、微張的下顎、口內深紅、上犬齒（白）、鼻墊（亮面黑）、眉骨、白眼點、往後豎的三角耳（內耳陶土色）
    /** @type {Record<string, THREE.BufferGeometry[]>} */
    const g = { head: [], nose: [], eye: [], mouth: [], fang: [], ear: [], earIn: [] };
    for (const pose of HEADS) {
      const m = headMatrix(pose);
      /** @type {(key: string, geo: THREE.BufferGeometry) => void} 局部幾何 → 車殼座標 */
      const add = (key, geo) => g[key].push(geo.applyMatrix4(m));
      // 上半顆頭做成壁厚 1.4 mm 的中空射出件（頸根到口吻中段），下顎實心
      add('head', hollowLoft(HEAD_UPPER, 1.4, 21));
      add('head', loftSections(HEAD_JAW, 20));
      add('mouth', loftSections(HEAD_MOUTH, 16));
      // 眉骨：額段上方一對隆起（讓眼睛藏在眉下）
      const sb = sectionAt(HEAD_UPPER, 13.6);
      for (const sg of [-1, 1]) {
        const brow = new THREE.SphereGeometry(1, 14, 10);
        brow.scale(2.1, 1.1, 1.5);
        brow.translate(13.6, sb.yc + 0.68 * sb.h, sg * 0.5 * sb.w);
        add('head', brow);
      }
      // 眼點（白色加彩）：眉骨下、額段兩側的殼面上
      const se = sectionAt(HEAD_UPPER, 15.4);
      const ey = 0.42;
      const ez = se.w * (1 - ey ** se.p) ** (1 / se.p);
      for (const sg of [-1, 1]) {
        const eye = new THREE.SphereGeometry(0.85, 12, 8);
        eye.scale(1.1, 0.85, 0.6);
        eye.translate(15.4, se.yc + ey * se.h, sg * (ez - 0.12));
        add('eye', eye);
      }
      // 鼻墊：口吻前端上方一塊亮面黑
      const nose = new THREE.SphereGeometry(1, 16, 10);
      nose.scale(1.25, 1.2, 1.9);
      nose.translate(25.5, 1.55, 0);
      add('nose', nose);
      // 上犬齒（白）：口吻前端兩側往下的短錐
      for (const sg of [-1, 1]) {
        const fang = new THREE.ConeGeometry(0.5, 1.9, 8);
        fang.rotateX(Math.PI);
        fang.translate(22.4, -1.75, sg * 1.9);
        add('fang', fang);
      }
      // 三角耳：顱頂後方，往後傾 22°、往外張 14°；前面貼一片陶土色內耳
      const sk = sectionAt(HEAD_UPPER, 8.6);
      const kz = 0.55;
      const ky = sk.h * (1 - kz ** sk.p) ** (1 / sk.p);
      for (const sg of [-1, 1]) {
        const ear = earPlate(4.6, 6.4, 1.3, 22, sg * 14);
        ear.translate(8.6, sk.yc + ky - 0.7, sg * kz * sk.w);
        add('ear', ear);
        const inner = earPlate(4.6, 6.4, 0.45, 22, sg * 14, 1.0, 0.8);
        inner.translate(8.6, sk.yc + ky - 0.7, sg * kz * sk.w);
        add('earIn', inner);
      }
    }
    parts.push({ geometry: smoothNormals(mergeGeos(g.head)), mat: 'black2', solid: true, outline: true, name: 'dog-heads' });
    parts.push({ geometry: mergeGeos(g.ear), mat: 'black2', solid: true, outline: true, name: 'dog-ears' });
    parts.push({ geometry: mergeGeos(g.earIn), mat: 'clay2', solid: true, name: 'dog-ears-inner' });
    parts.push({ geometry: mergeGeos(g.nose), mat: 'nose', solid: true, outline: true, name: 'dog-noses' });
    parts.push({ geometry: mergeGeos(g.eye), mat: 'addedWhite', solid: true, name: 'dog-eyes' });
    parts.push({ geometry: smoothNormals(mergeGeos(g.mouth)), mat: 'addedRed', solid: true, name: 'dog-mouths' });
    parts.push({ geometry: mergeGeos(g.fang), mat: 'addedWhite', solid: true, name: 'dog-fangs' });

    // ── 蛇形尾鰭（尾翼，實體件）：扁平斷面（左右 1.2、上下 3.4），從背上往上彎再往後；尾端蛇頭；尾下一片鰭膜連到背上 ──
    parts.push({
      geometry: smoothNormals(sweepEllipse(TAIL_PATH, 40, (t) => [lerp(1.2, 0.85, t), lerp(3.4, 1.6, t)], 16)),
      mat: 'black2',
      solid: true,
      outline: true,
      name: 'serpent-tail',
    });
    {
      // 鰭膜（厚 1.2）：蛇尾下緣到背脊之間的薄板，讓蛇尾讀成尾鰭而不是提把
      const curve = new THREE.CatmullRomCurve3(TAIL_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
      /** @type {number[][]} */
      const outline = [];
      for (let i = 2; i <= 16; i++) {
        const t = 0.12 + (0.7 * i) / 16;
        const p = curve.getPointAt(t);
        outline.push([p.x, p.y - lerp(3.4, 1.6, t) * 0.5]);
      }
      const xEnd = outline[outline.length - 1][0];
      const xStart = outline[0][0];
      outline.push([xEnd + 0.6, kit.surf.topY(xEnd + 0.6, 0) - 1]);
      outline.push([xStart, kit.surf.topY(xStart, 0) - 1]);
      parts.push({ geometry: finPlate(outline.reverse(), 0, 1.2), mat: 'black2', solid: true, outline: true, name: 'serpent-fin-web' });
    }
    {
      const g = new THREE.SphereGeometry(1, 18, 12);
      g.scale(2.4, 1.5, 1.7);
      g.rotateZ(0.12);
      g.translate(-69.4, 38.1, 0);
      parts.push({ geometry: g, mat: 'black2', solid: true, outline: true, name: 'serpent-head' });
      const eye = new THREE.SphereGeometry(0.55, 10, 8);
      eye.scale(1, 1, 0.6);
      parts.push({
        geometry: mergeGeos([-1, 1].map((sg) => eye.clone().translate(-70, 38.7, sg * 1.45))),
        mat: 'addedWhite',
        solid: true,
        name: 'serpent-eyes',
      });
    }
    // 尾鰭上的赭紅刻線鱗紋（沿尾鰭兩側一列小環）：做成細薄環片
    {
      const curve = new THREE.CatmullRomCurve3(TAIL_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
      /** @type {THREE.BufferGeometry[]} */
      const bands = [];
      for (const t of [0.22, 0.4, 0.58, 0.76]) {
        const p = curve.getPointAt(t);
        const tg = curve.getTangentAt(t);
        const ring = new THREE.TorusGeometry(1, 0.2, 6, 28);
        ring.scale(lerp(1.2, 0.85, t) + 0.1, lerp(3.4, 1.6, t) + 0.1, 1);
        // 環面法線對齊尾鰭切線
        ring.rotateY(Math.PI / 2);
        ring.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.atan2(tg.y, tg.x)));
        ring.translate(p.x, p.y, p.z);
        bands.push(ring);
      }
      parts.push({ geometry: mergeGeos(bands), mat: 'clay2', solid: true, name: 'serpent-bands' });
    }

    // 輪拱內襯（前後，R15.2）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(a, 2.2))), mat: 'liner', shell: true, name: 'arch-liners' });

    // ── 貼紙（黑繪陶紋樣）──
    // 回紋飾帶：側壁下段赭紅帶上的黑色鉤形回紋（線寬 0.6 mm），帶上下各一條黑邊線
    /** @type {(u: number, v: number) => number} u = 往前為正的 x、v = 高度 */
    const frieze = (u, v) => {
      if (archRingDist(u, v) < 2.4 || u > 52 || u < -64) {
        return 1;
      }
      const edgeLines = Math.min(Math.abs(v - FRIEZE.y0 + 0.2), Math.abs(v - FRIEZE.y1 - 0.2)) - 0.3;
      const key = v > FRIEZE.y0 + 0.4 && v < FRIEZE.y1 - 0.4 ? meanderSd(u + 64, v - (FRIEZE.y0 + 0.9), 1.05) : 1;
      return Math.min(edgeLines, key);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(frieze, { x0: 0, y0: 0, zMin: 28, side: 1 }), { offset: 0.1 }),
        kit.decal(sideDecal((u, v) => frieze(-u, v), { x0: 0, y0: 0, zMin: 28, side: -1 }), { offset: 0.1 }),
      ]),
      mat: 'dBlack',
      name: 'decal-meander-frieze',
    });
    // 頸部項圈帶（殼面）：前胸頸根處一道深紅寬帶＋白點列（陶繪加彩）
    parts.push({ geometry: kit.decal((x) => 1.4 - Math.abs(x - 51), { offset: 0.1 }), mat: 'dRed', name: 'decal-collar-band' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const ph = ((Math.abs(z) % 3.2) + 3.2) % 3.2;
        return 0.5 - Math.hypot(x - 51, Math.min(ph, 3.2 - ph));
      }, { offset: 0.16 }),
      mat: 'dWhite',
      name: 'decal-collar-dots',
    });
    // 黑線（赭紅側壁上）：肩肌弧線＋臀部弧線＋肋線
    /** @type {(u: number, v: number) => number} */
    const muscle = (u, v) => {
      const shoulder = Math.abs(Math.hypot(u - 40, (v - 13) * 1.15) - 19.6) - 0.32;
      const haunch = Math.abs(Math.hypot(u + 40, (v - 13) * 1.15) - 19.6) - 0.32;
      const ribs = Math.min(...[-14, -8, -2, 4].map((xr) => Math.max(Math.abs(u - xr - 0.35 * (v - 22)) - 0.3, Math.abs(v - 22.6) - 3.2)));
      return Math.max(Math.min(shoulder, haunch, ribs), FRIEZE.y1 + 1.6 - v);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(muscle, { x0: 0, y0: 0, zMin: 28, side: 1 }), { offset: 0.1 }),
        kit.decal(sideDecal((u, v) => muscle(-u, v), { x0: 0, y0: 0, zMin: 28, side: -1 }), { offset: 0.1 }),
      ]),
      mat: 'dBlack',
      name: 'decal-muscle-lines',
    });
    // 刻線：背上兩條波浪（蛇鬃——典籍說背上長滿蛇頭），從頸根沿座艙兩側到尾根
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > 46 || x < -52 || y < 26) {
          return -1;
        }
        const zc = 16.5 + 1.6 * Math.sin((x + 52) / 3.1);
        return 0.32 - Math.abs(Math.abs(z) - zc);
      }, { offset: 0.1 }),
      mat: 'dIncised',
      name: 'decal-incised-serpent-mane',
    });
    // 蛇鬃上的蛇頭點（白色加彩小點，每 12 mm 一顆）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > 44 || x < -48 || y < 26) {
          return -1;
        }
        const ph = (((x + 48) % 12) + 12) % 12;
        const xc = x - ph + 6;
        const zc = 16.5 + 1.6 * Math.sin((xc + 52) / 3.1);
        return 0.55 - Math.hypot(x - xc, Math.abs(z) - zc);
      }, { offset: 0.16 }),
      mat: 'dWhite',
      name: 'decal-serpent-mane-dots',
    });
    // 尾燈：車尾封口上方兩段紅色細帶
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(-69.6 - x, 0.9 - Math.abs(y - 22.5), Math.abs(z) - 8, 22 - Math.abs(z))),
      mat: 'tail',
      name: 'lamp-tail',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：車殼外框長 150.2（蛇頭 x −71.8 → 中間犬頭鼻墊 78.5）、殼頂 32、犬頭頂約 35、耳尖約 40、座艙罩頂約 40、蛇尾鰭頂 41.4；俯視楔形：肩寬 96.4、後輪上方 58（後輪外側露出）；SPEC 1.14a 車殼外框長 ≤ 153 mm',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm，同 owl-hush / mantis-scythe），cutZFrom 23.8；只對應 26 mm 輪（低車身）',
    snouts: '三顆犬頭的上半顆是壁厚 1.4 mm（× 縮放 1.04–1.12）、後端開口的中空射出件，下顎、耳、鼻墊、口內、眼、犬齒與蛇形尾鰭為實心 ABS 件；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 只複製既有欄位：神話組分組欄位（mythSeries / mythTheme）在這裡補進 BodyDef
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const cerberusTriheadBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
