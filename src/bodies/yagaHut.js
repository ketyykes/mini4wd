// 雅加婆婆的雞腳小屋（body-yaga-hut，第八階段神話組・斯拉夫）：俄羅斯民間故事裡「站在雞腳上、會轉身的小木屋」（izbushka）——
// Magnus 1916 英譯 Afanasyev：「a little hut standing on cocks' feet and turning round」，要對它說「背對森林站好」才會停下開門。
// iter-115：評審「整棟木屋，最像盒子」→ 先做成一台低矮流線的迷你四驅車殼（斜車頭、屋脊駝峰、車尾收尾、輪拱），小木屋改用表面處理暗示：
// 車頂兩片斜面＝人字屋頂（屋脊沿車長方向、木瓦紋、白色封簷板），側面是 4 根橫向圓木凸紋（殼面剖面本身鼓起），
// 車頭封口是小山牆：一扇俄式雕花窗框（nalichnik：頂冠、側板、窗台；紅窗櫺、暖色窗光）＋白色博風板；車尾屋脊上一根短煙囪當尾翼（chimney-stack）。
// 前後輪之間每側兩隻加長、加粗的雞腳：羽毛大腿貼在圓木牆上、膝關節球、帶鱗片環節的跗蹠、腳踝關節、三前一後的趾（趾節）與深色爪尖。
// iter-120（第九階段第二方案）：評審「方屋＋瓦頂＋煙囪，雞腳垂在車底，完全是房子」→ 先做成一台低趴楔形車：
// 兩坡木瓦屋頂改成前低後高的楔形車頂（屋脊鼻端 18.4 → 後輪上方 35.6），前輪上方是隆起的擋泥板（簷線），車長 115 → 123；
// 車頭山牆的 nalichnik 雕花窗框移到車頂當座艙框（暖光琥珀座艙、白色頂冠與垂飾、紅色窗櫺）；
// 雞腳從車底的實體件改成側面圓木牆上「奔跑姿態」的爪形貼紙（一腳前伸、一腳後蹬）；煙囪改成往後傾倒的排氣管（尾翼位置）。
// 不畫雅加婆婆本人。配色：原木暖褐（霧面）＋深灰褐木瓦屋頂（霧面）＋白色窗飾（霧面）＋黃橙雞腳＋少量紅色窗櫺；暖色窗光。
// 設計：shared/design/body-yaga-hut/DESIGN.md（研究一節列出實際打開的來源）。剖面為本檔站位產生器（推估）。
// 不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾封口 x */
const X_REAR = -62;
/** @type {number} 車頭封口（小山牆）x */
const X_FRONT = 64;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-62, -58, -51, -40, -28, -14, 0, 14, 28, 40, 48, 55, 60, 64];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 圓木牆面半寬（接縫處）：俯視是往後展開的楔形（V3）——尖窄車頭（7.5）→ 前輪上方翼子板 37.4（輪胎外緣 34.75 之外）→
  // 兩輪之間 29 的細腰 → 後輪上方最寬的後翼子板 43.5 → 平切的寬車尾 31（kamm tail）；俯視避開 tortoise-dome（四輪等寬凸包）、skeleton（等寬直框）、mantis-scythe（前寬後窄）的輪廓（IoU）
  hw: monoCurve(XS, [31, 36.5, 42, 43.5, 39, 30.5, 29, 29.5, 33.5, 37.4, 33, 22, 13.5, 7.5]),
  // 屋脊（中線殼頂）：iter-120 前低後高的楔形車頂——鼻端 18.4 一路往後升到後輪上方 35.6（原本是座艙段 41.5 的屋脊駝峰）
  yTop: monoCurve(XS, [33.6, 35, 35.5, 35.6, 35.4, 34.6, 33.4, 32.2, 31.2, 30.2, 27.6, 23.8, 20.8, 18.4]),
  // 屋簷外緣高度（頂面與側面交界＝肩線）：前輪上方隆起成擋泥板（28.2，V1），往前壓到鼻端 16.6
  yS: monoCurve(XS, [28, 28.8, 29.4, 29.6, 29.2, 28.4, 27.6, 27, 27.2, 28.2, 25.6, 21.6, 18.6, 16.6]),
  // 側裙（最下一根圓木）下緣：車尾封口下緣 14.2（遮住後齒輪箱）
  yLow: monoCurve(XS, [14.2, 12.8, 11.6, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11.4, 12.2, 12.8, 13.2]),
};

/** @type {number} 屋簷外伸（屋面外緣超出圓木牆的距離） */
const EO = 1.4;
/** @type {number} 封簷板高度 */
const FASCIA_H = 1.0;
/** @type {number} 屋簷底到牆頂（最上一根圓木上緣）的內收高度 */
const TUCK_H = 0.3;
/** @type {number} 圓木根數 */
const LOG_COUNT = 4;
/** @type {number} 圓木鼓起量 */
const LOG_BULGE = 0.8;
/** @type {(L: number) => number} 圓木鼓起量（iter-120：車頭圓木變細，鼓起量跟著縮，最多 0.8） */
const logBulge = (L) => Math.min(LOG_BULGE, 0.2 * L);

/** @type {(x: number) => number} 牆頂（最上一根圓木上緣）高度 */
const yWallTop = (x) => P.yS(x) - FASCIA_H - TUCK_H;
/** @type {(x: number) => number} 每根圓木高度 */
const logH = (x) => (yWallTop(x) - P.yLow(x)) / LOG_COUNT;
/** @type {(x: number, az: number) => number} 屋面高度（|z| 處，直線斜面） */
const roofY = (x, az) => P.yTop(x) - ((P.yTop(x) - P.yS(x)) * az) / (P.hw(x) + EO);

/**
 * 半剖面：屋脊 → 直線屋面 → 屋簷外緣（銳利）→ 封簷板（垂直）→ 屋簷底內收 → 4 根圓木（每根鼓起 + 銳利接縫）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const h = P.hw(x);
  const yW = yWallTop(x);
  const L = logH(x);
  /** @type {number[][]} */
  const pts = [
    [0, t],
    [0.5 * (h + EO), lerp(t, s, 0.5)],
    [h + EO, s],
    [h + EO, s - FASCIA_H],
    [h, yW],
  ];
  for (let j = 0; j < LOG_COUNT; j++) {
    const yT = yW - j * L;
    pts.push([h + logBulge(L), yT - 0.5 * L], [h, yT - L]);
  }
  return pts;
};
/** @type {number[]} 銳利稜線：屋簷外緣、封簷板下緣、牆頂、圓木接縫 */
const HARD = [2, 3, 4, 6, 8, 10];

/** @type {{ x: number, pts: number[][] }[]} 車尾與車頭每 1 mm 一站（iter-120：0.75 → 1，曲面內部每 0.5 mm 取樣，0.75 會變成每 0.375 mm 一列），中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -51, 1, profile).slice(0, -1), ...buildStations(-51, 55, 2, profile).slice(0, -1), ...buildStations(55, X_FRONT, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R15：26 mm 輪胎半徑 13 + 2 mm；31 mm 輪需切輪拱） */
const ARCHES = [
  { x: 40, y: 13, radius: 15, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 15, cutZFrom: 22.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, y: number, z: number) => boolean} 屋面 */
const onRoof = (x, y, z) => y > P.yS(x) - 0.05 && Math.abs(z) < P.hw(x) + EO - 0.05;
/** @type {(x: number, y: number, z: number) => boolean} 圓木牆 */
const onWall = (x, y, z) => y < yWallTop(x) + 0.05 && Math.abs(z) > P.hw(x) - 0.3;
/** @type {(x: number, y: number) => number} 圓木編號（0 = 最上一根） */
const logIndex = (x, y) => Math.floor((yWallTop(x) - y) / logH(x));

/** @type {number} 木瓦排距（沿屋面的水平 |z| 間距）與每片寬（沿 x） */
const SHINGLE_ROW = 3.4;
/** @type {number} */
const SHINGLE_W = 3.2;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 原木：霧面（roughness 0.65–0.75）
  log: namedMaterial('paint-log-pine', { color: 0x8c5a32, roughness: 0.7, clearcoat: 0.03 }),
  logDark: namedMaterial('paint-log-pine-aged', { color: 0x74482a, roughness: 0.72, clearcoat: 0.03 }),
  gable: namedMaterial('paint-gable-plank', { color: 0x5e3b22, roughness: 0.72, clearcoat: 0.03 }),
  // 木瓦屋頂（風化的白楊木瓦：深灰褐，霧面）
  shingle: namedMaterial('paint-shingle-aspen', { color: 0x5a5249, roughness: 0.76, clearcoat: 0.02 }),
  shingleDark: namedMaterial('paint-shingle-aspen-dark', { color: 0x4a433c, roughness: 0.78, clearcoat: 0.02 }),
  soffit: namedMaterial('paint-soffit-dark', { color: 0x3a281a, roughness: 0.75, clearcoat: 0.02 }),
  // 白色窗飾 / 封簷板 / 博風板（白漆木作，霧面）
  white: namedMaterial('paint-nalichnik-white', { color: 0xf0ece2, roughness: 0.6, clearcoat: 0.05 }),
  white2: namedMaterial('paint-nalichnik-white', { color: 0xf0ece2, roughness: 0.6, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 排氣管：紅磚＋白灰管口環（霧面）
  brick: namedMaterial('paint-brick-red', { color: 0x9b4a32, roughness: 0.78, clearcoat: 0.0 }),
  // 窗內暖光
  window: namedMaterial('lamp-window-warm', { color: 0xffc46b, emissive: 0xff9a2e, emissiveIntensity: 0.45, roughness: 0.2, clearcoat: 0.6 }),
  hole: namedMaterial('plastic-chimney-black', { color: 0x120d0a, roughness: 0.9 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-wood', { color: 0x4a2f1b, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-wood', { color: 0x2e1f14, roughness: 0.8, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGroove: decalMaterial('decal-moss-caulk', { color: 0x2b2116, roughness: 0.85 }),
  dShingleGap: decalMaterial('decal-shingle-gap', { color: 0x2a2520, roughness: 0.85 }),
  dWhite: decalMaterial('decal-nalichnik-white', { color: 0xf0ece2, roughness: 0.6 }),
  dRed: decalMaterial('decal-window-red', { color: 0xb3302a, roughness: 0.58 }),
  dFeather: decalMaterial('decal-hen-feather-brown', { color: 0x4e2f18, roughness: 0.7 }),
  dClaw: decalMaterial('decal-claw-ochre', { color: 0xe0962c, roughness: 0.6 }),
});

/**
 * 山牆上的立板（(z, y) 平面的多邊形，可含孔），沿 x 往外長 thick；dir = +1 車頭山牆、−1 車尾山牆
 * @type {(pts: number[][], holes: number[][][], xFace: number, thick: number, dir: number) => THREE.BufferGeometry}
 */
const gablePlate = (pts, holes, xFace, thick, dir) => {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 16 });
  // 局部 +Z（厚度）→ 世界 +X；局部 +X → 世界 −Z（圖形左右對稱，不影響）
  g.rotateY(Math.PI / 2);
  if (dir < 0) {
    g.scale(-1, 1, 1);
    // 鏡射後繞向反轉，翻回來（封閉網格才能用散度定理算體積）
    const idx = g.index;
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
    } else {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        for (const c of [0, 1, 2]) {
          const a = pos.getComponent(i + 1, c);
          pos.setComponent(i + 1, c, pos.getComponent(i + 2, c));
          pos.setComponent(i + 2, c, a);
        }
      }
    }
    g.computeVertexNormals();
  }
  g.translate(xFace - dir * 0.15, 0, 0);
  return g;
};

/**
 * 博風板（prichelina）：沿封口兩條屋面邊緣的白色板帶，下緣是波浪雕花；屋脊下一片尖底垂飾
 * @type {(xFace: number, dir: number) => THREE.BufferGeometry}
 */
const buildBargeboards = (xFace, dir) => {
  const t = P.yTop(xFace);
  const s = P.yS(xFace);
  const ez = P.hw(xFace) + EO;
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  const len = Math.hypot(ez, t - s);
  const nz = (t - s) / len;
  const ny = ez / len;
  for (const sg of [-1, 1]) {
    const n = 20;
    /** @type {number[][]} */
    const top = [];
    /** @type {number[][]} */
    const bottom = [];
    for (let i = 0; i <= n; i++) {
      const q = i / n;
      const z = lerp(ez - 0.2, 0.7, q);
      const y = t - ((t - s) * z) / ez + 0.15;
      top.push([sg * z, y]);
      // 下緣波浪：4 個半圓扇
      const depth = 1.0 + 0.5 * Math.abs(Math.sin(Math.PI * q * 4));
      bottom.push([sg * (z - nz * depth), y - ny * depth]);
    }
    const pts = [...top, ...bottom.reverse()];
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [z0, y0] = pts[i];
      const [z1, y1] = pts[(i + 1) % pts.length];
      area += z0 * y1 - z1 * y0;
    }
    if (area < 0) {
      pts.reverse();
    }
    geos.push(gablePlate(pts, [], xFace, 0.9, dir));
  }
  // 屋脊垂飾（只在車尾封口；車頭封口的屋脊下是窗框頂冠）
  if (dir > 0) {
    return mergeGeos(geos);
  }
  geos.push(
    gablePlate(
      [
        [-0.8, t - 0.2],
        [-0.8, t - 2.6],
        [0, t - 3.6],
        [0.8, t - 2.6],
        [0.8, t - 0.2],
      ].reverse(),
      [],
      xFace,
      0.9,
      dir,
    ),
  );
  return mergeGeos(geos);
};

/**
 * 後傾排氣管（iter-120：直立煙囪 → 從後輪上方屋脊往車尾倒下的磚紅排氣管，wing 仍是 chimney-stack）：
 * 管根埋進屋脊 x −36，管口在 x −54、y 約 39.4（後傾約 66°），白灰管口環＋黑色管口
 * @type {() => { pipe: THREE.BufferGeometry, ring: THREE.BufferGeometry, flue: THREE.BufferGeometry }}
 */
const buildExhaust = () => {
  const a = new THREE.Vector3(-35.5, P.yTop(-35.5) - 1.2, 0);
  const b = new THREE.Vector3(-54, 39.4, 0);
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  /** @type {(r0: number, r1: number, l: number, at: number) => THREE.BufferGeometry} 沿管軸、距管根 at 的圓柱（12 段） */
  const seg = (r0, r1, l, at) => {
    const g = new THREE.CylinderGeometry(r1, r0, l, 12);
    g.applyQuaternion(quat);
    const c = a.clone().addScaledVector(dir, at);
    g.translate(c.x, c.y, c.z);
    return g;
  };
  return { pipe: seg(2.6, 2.2, len - 1.2, (len - 1.2) / 2), ring: seg(2.75, 2.75, 1.4, len - 0.9), flue: seg(1.6, 1.6, 0.3, len - 0.05) };
};

/**
 * 膠囊（線段＋半徑）的 2D 距離
 * @type {(x: number, y: number, ax: number, ay: number, bx: number, by: number, r0: number, r1: number) => number}
 */
const sdCapsule = (x, y, ax, ay, bx, by, r0, r1) => {
  const ex = bx - ax;
  const ey = by - ay;
  const k = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
  return Math.hypot(x - ax - k * ex, y - ay - k * ey) - lerp(r0, r1, k);
};

/**
 * 奔跑的雞腳（側面圓木牆上的貼紙，左右同向：腳趾朝車頭）：一腳往前伸（膝抬高、三趾張開準備落地）、一腳往後蹬（腿伸直、趾尖點地），
 * 每隻腳 = 羽毛大腿＋跗蹠＋三前一後的趾；回傳各部位距離（負值 = 在內）
 * @type {{ hip: number[], knee: number[], ankle: number[], toes: number[][] }[]}
 */
const LEGS = [
  // 前伸腳
  { hip: [4, 23.2], knee: [12.5, 19.6], ankle: [17.5, 14.4], toes: [[22.6, 13.2], [21.4, 11.8], [20, 15.6], [15.2, 12.6]] },
  // 後蹬腳
  { hip: [-6, 23.2], knee: [-9.5, 17.8], ankle: [-17.5, 13.6], toes: [[-13.2, 11.6], [-14.6, 11.2], [-12.6, 13.2], [-20.4, 15.4]] },
];

/** @type {(x: number, y: number) => { thigh: number, leg: number, tip: number }} */
const henLegs = (x, y) => {
  let thigh = Infinity;
  let leg = Infinity;
  let tip = Infinity;
  for (const { hip, knee, ankle, toes } of LEGS) {
    thigh = Math.min(thigh, sdCapsule(x, y, hip[0], hip[1], knee[0], knee[1], 2.4, 1.5));
    leg = Math.min(leg, sdCapsule(x, y, knee[0], knee[1], ankle[0], ankle[1], 0.95, 0.75), Math.hypot(x - ankle[0], y - ankle[1]) - 1.0);
    for (const [tx, ty] of toes) {
      leg = Math.min(leg, sdCapsule(x, y, ankle[0], ankle[1], tx, ty, 0.62, 0.4));
      // 爪尖：趾端往外 0.9 mm 的深色小段
      const ux = tx - ankle[0];
      const uy = ty - ankle[1];
      const ul = Math.hypot(ux, uy);
      tip = Math.min(tip, sdCapsule(x, y, tx, ty, tx + (ux / ul) * 1.1, ty + (uy / ul) * 1.1, 0.42, 0.18));
    }
  }
  return { thigh, leg, tip };
};

/** @type {(x: number, y: number) => number} 奔跑速度線：後蹬腳後方 3 道往後漸細的深色短線（負值 = 線內） */
const speedLines = (x, y) => {
  let d = Infinity;
  for (const [x0, y0, len] of [
    [-21.5, 24.2, 6],
    [-22.5, 21.4, 5],
    [-23, 18.8, 3.4],
  ]) {
    d = Math.min(d, sdCapsule(x, y, x0, y0, x0 - len, y0, 0.45, 0.15));
  }
  return d;
};

/**
 * 座艙（iter-120：nalichnik 雕花窗框變成座艙框）：車頂上一扇往前收窄的窗（俯視 x −8 → 20、半寬 9 → 5.6），
 * 回傳窗洞距離（負值 = 窗內）
 * @type {(x: number, z: number) => number}
 */
const cockpitSd = (x, z) => {
  const t = Math.max(0, Math.min(1, (x + 8) / 28));
  const hw = lerp(9, 5.6, t);
  return Math.max(Math.abs(z) - hw, -8 - x, x - 20);
};

/**
 * 座艙框外形：窗洞外 1.3 mm 的框板＋前端 kokoshnik 尖拱頂冠（往車頭尖出 5 mm）＋後端波浪垂飾（podzor）；負值 = 框內
 * @type {(x: number, z: number) => number}
 */
const cockpitFrameSd = (x, z) => {
  const board = cockpitSd(x, z) - 1.3;
  const az = Math.abs(z);
  // 頂冠：窗前緣往前的尖拱（寬 ±7.4 → 尖端 x 26.5）
  const crown = Math.max(x - (21.3 + 5.2 * (1 - (az / 7.4) ** 1.4)), 20 - x, az - 7.4);
  // 垂飾：窗後緣往後 2–2.8 mm 的波浪
  const apron = Math.max(-9.3 - 1.8 - 0.8 * Math.abs(Math.sin((Math.PI * z) / 2.4)) - x, x + 9.3, az - 9.6);
  return Math.min(board, crown, apron);
};

export const yagaHutBody = makePolyBody({
  id: 'body-yaga-hut',
  name: '雅加婆婆的雞腳小屋',
  style: 'myth',
  phase: 8,
  mythSeries: 'slavic',
  mythTheme: 'baba-yaga-hut',
  form: 'log-hut',
  roof: 'closed',
  wing: 'chimney-stack',
  theme: '前低後高的低趴楔形車：木瓦屋頂變成楔形車頂（白色封簷板是貫穿全車的肩線）、側面 4 根橫向圓木、nalichnik 雕花窗框變成車頂座艙框（琥珀暖光座艙、紅窗櫺）、側面圓木牆上一對奔跑姿態的雞腳、車尾往後倒的磚紅排氣管',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: HARD,
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    // 白色封簷板（屋簷外緣的垂直板）
    { mat: 'white', keep: (x, y, z) => Math.abs(z) - (P.hw(x) + EO - 0.08) },
    // 屋簷底（深色內收）
    { mat: 'soffit', keep: (x, y, z) => (y > yWallTop(x) - 0.1 && y < P.yS(x) - FASCIA_H + 0.05 && Math.abs(z) > P.hw(x) + 0.05 ? 1 : -1) },
    // 木瓦：每排錯開半片，深淺交錯
    {
      mat: 'shingleDark',
      keep: (x, y, z) => {
        if (!onRoof(x, y, z)) {
          return -1;
        }
        const row = Math.floor((P.hw(x) + EO - Math.abs(z)) / SHINGLE_ROW);
        const col = Math.floor((x + (row % 2) * SHINGLE_W * 0.5) / SHINGLE_W);
        return (row + col) % 3 === 0 ? 1 : -1;
      },
    },
    { mat: 'shingle', keep: (x, y, z) => (onRoof(x, y, z) ? 1 : -1) },
    // 圓木牆：深淺交錯（同一批木料的色差）
    { mat: 'logDark', keep: (x, y) => (logIndex(x, y) % 2 === 1 ? 1 : -1) },
    { mat: 'log', keep: () => 1 },
  ],
  // 車頭小山牆：屋簷以上是深色山牆板，以下是圓木
  capFrontBands: [{ yMin: P.yS(X_FRONT) - FASCIA_H, mat: 'gable' }, { mat: 'log' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'log', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）＋輪胎內側環形擋板（kitsune-ninetail 的 buildArchWell，擋住輪室看進車身內部）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 15.6, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });
    // 前後封口博風板＋屋脊垂飾
    parts.push({ geometry: mergeGeos([buildBargeboards(X_FRONT, 1), buildBargeboards(X_REAR, -1)]), mat: 'white2', solid: true, outline: true, name: 'gable-bargeboards' });
    // 後傾排氣管（尾翼 chimney-stack）
    const ex = buildExhaust();
    parts.push({ geometry: ex.pipe, mat: 'brick', solid: true, outline: true, name: 'exhaust-pipe' });
    parts.push({ geometry: ex.ring, mat: 'white', solid: true, outline: true, name: 'exhaust-ring' });
    parts.push({ geometry: ex.flue, mat: 'hole', solid: true, name: 'exhaust-flue' });

    // ---- 貼紙 ----
    // 圓木接縫（苔蘚填縫，深色 0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onWall(x, y, z)) {
          return -1;
        }
        const L = logH(x);
        const q = (yWallTop(x) - y) / L;
        if (q < 0.5 || q > LOG_COUNT - 0.5) {
          return -1;
        }
        return 0.35 - Math.abs(q - Math.round(q)) * L;
      }, { offset: 0.1 }),
      mat: 'dGroove',
      name: 'decal-log-chinks',
    });
    // 木瓦縫：每排下緣橫縫＋片與片之間的直縫（線寬 0.6）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onRoof(x, y, z)) {
          return -1;
        }
        const u = (P.hw(x) + EO - Math.abs(z)) / SHINGLE_ROW;
        const row = Math.floor(u);
        const rowLine = (0.5 - Math.abs(u - Math.round(u))) * SHINGLE_ROW;
        const v = (x + (row % 2) * SHINGLE_W * 0.5) / SHINGLE_W;
        const colLine = Math.abs(v - Math.round(v)) * SHINGLE_W;
        // 屋脊兩側 1.2 mm 不畫（屋脊壓條）
        return Math.min(0.3 - Math.min(SHINGLE_ROW / 2 - rowLine, colLine), Math.abs(z) - 1.4);
      }, { offset: 0.1 }),
      mat: 'dShingleGap',
      name: 'decal-shingle-gaps',
    });
    // 屋脊壓條（深色 2.4 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) ? 1.2 - Math.abs(z) : -1), { offset: 0.12 }),
      mat: 'dGroove',
      name: 'decal-ridge-board',
    });
    /** @type {(x: number, y: number, z: number) => boolean} 側牆、輪拱外 */
    const onSideWall = (x, y, z) => onWall(x, y, z) && archRingDist(x, y) > 1;
    // 奔跑的雞腳（iter-120，取代車底的實體雞腳）：褐色羽毛大腿、黃橙跗蹠與趾、深色爪尖、後方速度線
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) ? -henLegs(x, y).thigh : -1), { offset: 0.14 }),
      mat: 'dFeather',
      name: 'decal-hen-thighs',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const h = henLegs(x, y);
        return Math.min(-h.leg, h.thigh);
      }, { offset: 0.12 }),
      mat: 'dClaw',
      name: 'decal-hen-legs',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) ? -henLegs(x, y).tip : -1), { offset: 0.16 }),
      mat: 'dGroove',
      name: 'decal-hen-claw-tips',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) ? -speedLines(x, y) : -1), { offset: 0.14 }),
      mat: 'dGroove',
      name: 'decal-speed-lines',
    });
    // 座艙：琥珀暖光窗（V5 有色不透明座艙）＋白色 nalichnik 座艙框（頂冠、垂飾）＋紅色十字窗櫺
    /** @type {(x: number, y: number, z: number) => boolean} 車頂 */
    const onTop = (x, y, z) => onRoof(x, y, z) && x > -16 && x < 32;
    parts.push({
      geometry: kit.decal((x, y, z) => (onTop(x, y, z) ? -cockpitSd(x, z) : -1), { offset: 0.16 }),
      mat: 'window',
      name: 'lamp-cockpit',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y, z)) {
          return -1;
        }
        const fret = 0.8 - Math.hypot(x - 22.6, z);
        return Math.min(-cockpitFrameSd(x, z), cockpitSd(x, z), -fret);
      }, { offset: 0.18 }),
      mat: 'dWhite',
      name: 'decal-cockpit-nalichnik',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y, z)) {
          return -1;
        }
        const d = cockpitSd(x, z);
        const ring = Math.min(-d, d + 0.55);
        const cross = Math.min(-d, 0.32 - Math.min(Math.abs(z), Math.abs(x - 8)));
        return Math.max(ring, cross);
      }, { offset: 0.2 }),
      mat: 'dRed',
      name: 'decal-cockpit-sash',
    });
    // 頭燈（V14，自創形狀）：鼻端兩側屋面上一對暖光小方窗＋紅框
    /** @type {(x: number, z: number) => number} */
    const lampSd = (x, z) => Math.max(Math.abs(x - 56.5) - 1.8, Math.abs(Math.abs(z) - 6.2) - 1.5);
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) && x > 50 ? -lampSd(x, z) : -1), { offset: 0.16 }),
      mat: 'window',
      name: 'lamp-head',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) && x > 50 ? Math.min(lampSd(x, z), 0.55 - lampSd(x, z)) : -1), { offset: 0.18 }),
      mat: 'dRed',
      name: 'decal-head-frame',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: `本檔站位產生器 P（推估，iter-120 改成前低後高的楔形車）：殼 x ${X_REAR} ~ ${X_FRONT}；屋脊鼻端 18.4 → 後輪上方 35.6、屋簷（肩線）前輪上方 28.2、車頭封口頂約 18.4；圓木牆半寬：前翼子板 37.4、腰身 29、後翼子板 43.5、屋簷外伸 1.4（外框半寬 ≤ 48）；排氣管口頂約 42（頂高 / 長度約 0.33，V17）`,
    wheelArches: '前後 R15（26 mm 輪胎半徑 13 + 2 mm）；31 mm 輪不切輪拱時間隙不足（需切輪拱，第八階段起即如此）；輪拱內襯＋輪胎內側環形擋板（buildArchWell）擋住殼內空腔',
    logs: '圓木：殼面剖面每根鼓起 min(0.8, 0.2 × 圓木高) mm（車頭圓木變細時跟著縮）；接縫為銳利稜線＋0.7 mm 深色填縫貼紙（推估）',
    cockpit: '座艙（iter-120）：車頂 x −8 ~ 20 的琥珀暖光窗（貼紙，半寬 9 → 5.6）＋白色 nalichnik 座艙框（框寬 1.3、前端尖拱頂冠、後端波浪垂飾）＋紅色十字窗櫺（推估）',
    feet: '雞腳（iter-120）：改成側面圓木牆上的貼紙（不再是實體件）：每側一前伸、一後蹬兩隻腳，大腿寬 3–4.8、跗蹠 1.5–1.9、趾 0.8–1.2 mm＋深色爪尖與 3 道速度線（推估）',
    exhaust: '排氣管（iter-120，取代直立煙囪）：管徑 4.4–5.2 mm、長約 19 mm 的 12 段實心圓柱，從後輪上方屋脊往後倒約 66°，白灰管口環 5.5 × 1.4 mm（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
