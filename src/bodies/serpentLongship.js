// 蛇首長船（body-serpent-longship，第八階段神話組・北歐）：維京長船意象的細長低船身——側面 4 道往外疊的疊板（clinker）稜線、
// 船舷上緣每側 5 面圓盾、中段下沉的開放甲板（座艙），船首往上往內盤捲成 Oseberg 式螺旋、收在螺旋中心的蛇頸末端（沒有龍頭、沒有嘴與牙），船尾往上捲成 stern-curl 尾翼。
// 設計：shared/design/body-serpent-longship/DESIGN.md（典故、借用的古代語彙、和市售車殼 / 現代作品 / 既有車殼的差異）。
// 造型回到出土文物（MYTH_RESEARCH N1、N2、N5–N7）：Oseberg 船艏柱盤捲的蛇（現存名船都不是龍頭）、Gokstad 陪葬的整船盾牌、疊板船殼的鉚釘列；
// 不做整車龍頭（避開市售 Dragon Jr. 系列）、不用任何盧恩字母或符號、不用白藍配色。
// 塗裝全為自創：焦油黑褐船殼＋赭紅 / 奶油白對半分區的圓盾＋青銅盾心與鉚釘點列＋疊板邊緣淺木色細線；不含任何文字、號碼、商標。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 船身站位節點（x 由後到前；前後軸 x = ±40；船尾尖 −66、船首尖 73，船首 / 船尾柱另外以實體件往上捲） */
const XS = [-66, -62, -56, -48, -40, -28, -14, 0, 14, 28, 40, 48, 56, 63, 69, 73];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 船舷上緣（sheer line）：中段最低 32.5，往船首 / 船尾翹起（長船的弦弧）
  sheer: monoCurve(XS, [42.5, 40.5, 38, 35.8, 34.6, 33.3, 32.6, 32.5, 32.6, 33.3, 34.6, 36.3, 38.5, 41, 43.5, 45]),
  // 船舷半寬：中段最寬 26（寬 52 × 長 139，長船的細長比例），往前後輪處收到 16（俯視是兩頭細長、往內凹收尖的柳葉形，船首 / 船尾很細）；
  // 四輪完全在船殼外側（輪胎內側面 |z| ≥ 23），船身像夾在四個輪子中間的細長船——俯視和既有全罩款（寬 75–95）明顯不同
  hw: monoCurve(XS, [2.4, 4, 7, 11, 16, 22, 25.5, 26, 25.5, 22, 16.5, 12.5, 8, 5, 3, 2.4]),
  // 船身下緣：中段 13.2，往船首 / 船尾彎上去（龍骨前後上翹的 forefoot）；前後卡榫處（x 52 / −50）壓到約 15，遮住卡座吊耳
  yLow: monoCurve(XS, [33, 26, 19, 15.5, 14, 13.2, 13.2, 13.2, 13.2, 13.2, 14, 15, 17, 22, 28, 34]),
  // 船底收向龍骨的下緣半寬：中段 21；前後輪附近收到 |z| < 21（船殼下段自己讓開輪胎，不靠輪拱切開）
  keel: monoCurve(XS, [1.5, 2.6, 4.6, 7.5, 11, 16.5, 20.5, 21, 20.5, 16.5, 11.5, 8.5, 5, 3, 1.8, 1.5]),
};

/** @type {{ x0: number, x1: number, ramp: number, depth: number }} 中段下沉甲板（開放座艙）：平台範圍、斜坡長、比兩端甲板再深多少 */
const WELL = { x0: -19, x1: 18, ramp: 9, depth: 10 };
/** @type {number} 疊板道數 */
const STRAKES = 4;
/** @type {number} 疊板接縫往內的階差（mm） */
const LAP_STEP = 0.8;

/**
 * 甲板下沉權重：平台內 1，兩端以餘弦斜坡降到 0（前後輪上方回到淺甲板，避開 31 mm 輪拱）
 * @type {(x: number) => number}
 */
const wellWeight = (x) => {
  if (x >= WELL.x0 && x <= WELL.x1) {
    return 1;
  }
  const d = x < WELL.x0 ? WELL.x0 - x : x - WELL.x1;
  if (d >= WELL.ramp) {
    return 0;
  }
  return 0.5 * (1 + Math.cos((Math.PI * d) / WELL.ramp));
};

/**
 * 該站的寬度縮放（兩端船尖附近，船舷欄、疊板階差等比例縮小，避免剖面點交錯）
 * @type {(x: number) => number}
 */
const tipScale = (x) => Math.min(1, P.hw(x) / 20);

/**
 * 該站的幾何量：甲板高、船舷欄內緣 z、每道疊板的上緣 / 下緣（lip）
 * @type {(x: number) => { sheer: number, hw: number, yLow: number, deckY: number, zi: number, strakes: { zTop: number, yTop: number, zLip: number, yLip: number }[] }}
 */
const stationAt = (x) => {
  const sheer = P.sheer(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const keel = Math.min(P.keel(x), hw - 0.5);
  const k = tipScale(x);
  const deckY = sheer - 3 - WELL.depth * wellWeight(x);
  const zi = hw - 3 * k;
  const yTop0 = sheer - 1.4;
  const h = (yTop0 - yLow) / STRAKES;
  const half = (LAP_STEP * k) / 2;
  /** @type {(y: number) => number} 船殼斷面曲線：上段近乎垂直、下段往龍骨收（舭部彎曲，平方根曲線） */
  const zc = (y) => keel + (hw - keel) * Math.sqrt(Math.max(0, Math.min(1, (y - yLow) / (yTop0 - yLow))));
  /** @type {{ zTop: number, yTop: number, zLip: number, yLip: number }[]} */
  const strakes = [];
  for (let i = 0; i < STRAKES; i++) {
    const yTop = yTop0 - i * h;
    const yLip = yTop - h;
    // 每道疊板：上緣比斷面曲線內收半階、下緣唇外凸半階 → 接縫處往內一階（上一道的下緣蓋在下一道外面）
    strakes.push({ zTop: i === 0 ? hw : zc(yTop) - half, yTop, zLip: zc(yLip) + half, yLip });
  }
  return { sheer, hw, yLow, deckY, zi, strakes };
};

/**
 * 半剖面 12 點：甲板中線 → 甲板邊 → 船舷欄內壁頂 → 船舷欄頂 → 外側船舷角（第 1 道疊板上緣）→ 4 道疊板（每道：下緣唇、往內一階的下一道上緣）→ 船身下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const s = stationAt(x);
  const k = tipScale(x);
  /** @type {number[][]} */
  const pts = [
    [0, s.deckY],
    [s.zi - 1.2 * k, s.deckY],
    [s.zi, s.sheer - 0.6],
    [s.hw - 0.4 * k, s.sheer],
    [s.hw, s.sheer - 1.4],
  ];
  s.strakes.forEach((st, i) => {
    pts.push([st.zLip, st.yLip]);
    if (i < STRAKES - 1) {
      pts.push([s.strakes[i + 1].zTop, st.yLip]);
    }
  });
  return pts;
};

// 船首 / 船尾尖端曲率大，每 1 mm 一站；中段 2 mm
const STATIONS = [...buildStations(-66, -54, 1, profile).slice(0, -1), ...buildStations(-54, 60, 2, profile).slice(0, -1), ...buildStations(60, 73, 1, profile)];

/**
 * 剖面參數 s 的分段點（和 polyBody 的 createSmoothPolySurface 同一算法：各段平均長度占比），給塗裝分區判斷「甲板 / 外側船殼」
 * @type {number[]}
 */
const BRK = (() => {
  const n = STATIONS[0].pts.length;
  const seg = [];
  for (let i = 0; i < n - 1; i++) {
    let l = 0;
    for (const st of STATIONS) {
      l += Math.hypot(st.pts[i + 1][0] - st.pts[i][0], st.pts[i + 1][1] - st.pts[i][1]);
    }
    seg.push(Math.max(0.5, l / STATIONS.length));
  }
  const total = seg.reduce((a, b) => a + b, 0);
  const out = [0];
  for (const l of seg) {
    out.push(out[out.length - 1] + l / total);
  }
  return out;
})();

/** @type {number[]} 圓盾中心 x（每側 5 面，間距 10；盾徑 10.8 → 相鄰兩面互相疊 0.8 mm，像 Gokstad 船舷外互疊的盾列） */
const SHIELD_X = [-20, -10, 0, 10, 20];
/** @type {number} 圓盾半徑 */
const SHIELD_R = 5.4;
/** @type {number} 圓盾厚度 */
const SHIELD_T = 0.6;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 霧面材質（基準評審 iter-112：神話款要有材質對比）：焦油木船殼、橡木甲板、盾面為霧面（roughness 0.6–0.75、低 clearcoat）
  tar: namedMaterial('paint-tar-brown', { color: 0x2a1d16, roughness: 0.72, clearcoat: 0.08, clearcoatRoughness: 0.6 }),
  deck: namedMaterial('paint-deck-oak', { color: 0x6b4a2f, roughness: 0.78, clearcoat: 0 }),
  ochre: namedMaterial('paint-ochre-red', { color: 0xa8432a, roughness: 0.62, clearcoat: 0.1 }),
  ochre2: namedMaterial('paint-ochre-red', { color: 0xa8432a, roughness: 0.62, clearcoat: 0.1, side: THREE.DoubleSide }),
  cream: namedMaterial('paint-cream-white', { color: 0xeee0c0, roughness: 0.6, clearcoat: 0.1, side: THREE.DoubleSide }),
  // 真金屬（青銅盾心、蛇眼）：名稱含 -brass → Blender 換成金屬材質
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb08d57, metalness: 0.8, roughness: 0.32, clearcoat: 0.2 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1d1612, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-tar', { color: 0x3a2a20, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-tar', { color: 0x3a2a20, roughness: 0.75, side: THREE.DoubleSide }),
  dPale: decalMaterial('decal-pale-wood', { color: 0xc9ae80, roughness: 0.65 }),
  dSeam: decalMaterial('decal-deck-seam', { color: 0x2e2018, roughness: 0.8 }),
  dBronze: decalMaterial('decal-bronze-rivet', { color: 0xb8925a, metalness: 0.75, roughness: 0.32 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 平面曲線掃掠（中心線在 z = zc 的 x–y 平面上）：斷面為橢圓，rz = 厚度方向（z）半徑、rn = 平面內法向半徑。
 * 和 sweepEllipse 不同的是側向固定為 z 軸，所以中心線可以通過垂直方向（螺旋捲）而不會翻轉；兩端封口，為封閉網格。
 * @type {(pts: number[][], zc: number, n: number, radius: (t: number) => number[], seg?: number) => THREE.BufferGeometry}
 */
const sweepPlanar = (pts, zc, n, radius, seg = 14) => {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, zc)),
    false,
    'centripetal',
  );
  const side = new THREE.Vector3(0, 0, 1);
  /** @type {THREE.Vector3[][]} */
  const rings = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const vert = new THREE.Vector3().crossVectors(side, tg).normalize();
    const [rz, rn] = radius(t);
    /** @type {THREE.Vector3[]} */
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg;
      ring.push(c.clone().addScaledVector(side, Math.cos(a) * rz).addScaledVector(vert, Math.sin(a) * rn));
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
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 依弧長參數取中心線的一段（分段上色用；兩段共用同一條曲線）
 * @type {(pts: number[][], t0: number, t1: number, n: number) => number[][]}
 */
const subPath = (pts, t0, t1, n) => {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false,
    'centripetal',
  );
  /** @type {number[][]} */
  const out = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(lerp(t0, t1, i / n));
    out.push([p.x, p.y]);
  }
  return out;
};

/**
 * 船首柱中心線（側視 x–y）：從船首尖端內部長出，往前上方翹起，到頂端往後、往下、往內捲成螺旋（Oseberg 船首的螺旋捲），收在螺旋中心的蛇頸末端
 * 船首柱最前緣約 x 79.8（車殼外框長 ≤ 153 mm，捲曲往上而不往前伸）
 * @type {number[][]}
 */
const PROW_PATH = [
  [64, 32],
  [69, 37],
  [73, 42],
  [76, 47],
  [77.6, 51.5],
  [76.6, 54.6],
  [73.8, 55.8],
  [71.2, 54.6],
  [70.4, 51.8],
  [72, 50],
  [74, 50.8],
];
/** @type {number} 船首柱：焦油黑褐柱身 / 赭紅盤捲蛇頸的分界（弧長比例） */
const PROW_SPLIT = 0.42;
/** @type {(t: number) => number[]} 船首柱斷面半徑 [z 厚度, 平面內]：根粗、往捲曲中心漸細 */
const PROW_RAD = (t) => [lerp(2.1, 1.3, t), lerp(2.8, 1.55, t)];

/**
 * 船尾柱中心線（側視 x–y）：從船尾尖端長出，往後上方翹起，到頂端往前捲成較小的螺旋（stern-curl 尾翼）
 * @type {number[][]}
 */
const STERN_PATH = [
  [-58, 33],
  [-63, 38],
  [-66.5, 42.5],
  [-68.6, 46.6],
  [-68.2, 50],
  [-66, 51.4],
  [-63.8, 50.2],
  [-63.6, 47.8],
  [-65.4, 47.2],
];
/** @type {(t: number) => number[]} 船尾柱斷面半徑：根粗尖細 */
const STERN_RAD = (t) => [lerp(1.9, 1.15, t), lerp(2.5, 1.35, t)];

/**
 * 蛇頸末端：螺旋中心一顆略膨大的扁卵形蛇頭（沿中心線末端切線方向，沒有嘴與牙）＋兩側青銅小眼（Oseberg 船艏柱末端是盤捲的蛇頭，N1）
 * @type {() => { head: THREE.BufferGeometry, eyes: THREE.BufferGeometry }}
 */
const buildSerpentHead = () => {
  const curve = new THREE.CatmullRomCurve3(
    PROW_PATH.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false,
    'centripetal',
  );
  const p = curve.getPointAt(1);
  const tg = curve.getTangentAt(1);
  const ang = Math.atan2(tg.y, tg.x);
  const head = new THREE.SphereGeometry(1, 20, 14);
  // 頭的長軸沿捲曲末端方向，只比蛇頸略粗（不做成龍頭）
  head.scale(2.4, 1.75, 1.55);
  head.rotateZ(ang);
  head.translate(p.x + 0.9 * Math.cos(ang), p.y + 0.9 * Math.sin(ang), 0);
  /** @type {THREE.BufferGeometry[]} */
  const eyes = [];
  for (const sg of [-1, 1]) {
    const e = new THREE.SphereGeometry(0.5, 12, 8);
    e.translate(p.x + 1.4 * Math.cos(ang) - 0.6 * Math.sin(ang), p.y + 1.4 * Math.sin(ang) + 0.6 * Math.cos(ang), sg * 1.3);
    eyes.push(e);
  }
  return { head, eyes: mergeGeos(eyes) };
};

/**
 * 圓盾（單面）：實心圓盤（焦油色盾緣）＋外側面對半分區的赭紅 / 奶油白兩片薄面＋青銅盾心（扁球）
 * 對半分區用直線（不用十字四分、不用放射狀，避免任何被挪用的十字 / 日輪圖形）
 * @type {(x: number, sg: number, i: number) => { disc: THREE.BufferGeometry, faceA: THREE.BufferGeometry, faceB: THREE.BufferGeometry, boss: THREE.BufferGeometry }}
 */
const buildShield = (x, sg, i) => {
  const s = stationAt(x);
  const yc = s.sheer - 1.6;
  // 奇數面盾往外多 0.35 mm，疊在偶數面盾外面（互疊的盾列）
  const lift = i % 2 === 1 ? 0.35 : 0;
  const zc = sg * (s.hw + SHIELD_T / 2 + 0.05 + lift);
  const disc = new THREE.CylinderGeometry(SHIELD_R, SHIELD_R, SHIELD_T, 36);
  disc.rotateX(Math.PI / 2);
  disc.translate(x, yc, zc);
  const zFace = sg * (s.hw + SHIELD_T + 0.12 + lift);
  // 分區線的傾角：相鄰兩面盾左右鏡射，盾列讀成有節奏的交替
  const tilt = (i % 2 === 0 ? 1 : -1) * 0.5;
  /** @type {(a0: number) => THREE.BufferGeometry} 半圓薄面（盾緣留 0.6 mm 焦油色） */
  const half = (a0) => {
    const sh = new THREE.Shape();
    const r = SHIELD_R - 0.6;
    sh.moveTo(r * Math.cos(a0), r * Math.sin(a0));
    sh.absarc(0, 0, r, a0, a0 + Math.PI, false);
    sh.lineTo(r * Math.cos(a0), r * Math.sin(a0));
    const g = new THREE.ShapeGeometry(sh, 24);
    if (sg < 0) {
      g.rotateY(Math.PI);
    }
    g.translate(x, yc, zFace);
    return g;
  };
  const faceA = half(Math.PI / 2 + tilt);
  const faceB = half(-Math.PI / 2 + tilt);
  const boss = new THREE.SphereGeometry(1, 16, 10);
  boss.scale(1.7, 1.7, 0.9);
  boss.translate(x, yc, sg * (s.hw + SHIELD_T + 0.2 + lift));
  return { disc, faceA, faceB, boss };
};

/**
 * 該站外側船殼在高度 y 的 |z|（沿剖面點 4 以下的疊板折線內插；超出範圍取端點）
 * @type {(x: number, y: number) => number}
 */
const hullZAt = (x, y) => {
  const pts = profile(x).slice(4);
  if (y >= pts[0][1]) {
    return pts[0][0];
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (y <= y0 && y >= y1) {
      return y0 - y1 < 1e-6 ? Math.min(z0, z1) : lerp(z1, z0, (y - y1) / (y0 - y1));
    }
  }
  return pts[pts.length - 1][0];
};

/**
 * 輪拱內襯（參考 zeppelin-xtail 的 buildHullLiner）：輪拱切口後面的上半圈圓柱面（半徑 = 輪拱半徑 + 0.3），
 * z 從船殼內面（外側 |z| − 1）往內 depth（不小於 zIn）；只做在船身下緣以上（不在船殼外面多出一片），擋住從側面看進去的殼內空腔與底盤
 * @type {(arch: { x: number, y: number, radius: number }, zIn: number, depth: number) => THREE.BufferGeometry}
 */
const buildArchLiner = (arch, zIn, depth) => {
  const r = arch.radius + 0.3;
  const n = 48;
  /** @type {number[]} */
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = 0.12 + ((Math.PI - 0.24) * i) / n;
      const t1 = 0.12 + ((Math.PI - 0.24) * (i + 1)) / n;
      const x0 = arch.x + r * Math.cos(t0);
      const y0 = arch.y + r * Math.sin(t0);
      const x1 = arch.x + r * Math.cos(t1);
      const y1 = arch.y + r * Math.sin(t1);
      if (y0 < P.yLow(x0) + 0.4 || y1 < P.yLow(x1) + 0.4) {
        continue;
      }
      // 船殼本身比內襯內緣還窄的地方（船首 / 船尾收尖段）不做，避免露在船殼外的細條
      if (hullZAt(x0, y0) - 1 < zIn + 1 || hullZAt(x1, y1) - 1 < zIn + 1) {
        continue;
      }
      const zo0 = Math.max(zIn + 0.5, hullZAt(x0, y0) - 1);
      const zo1 = Math.max(zIn + 0.5, hullZAt(x1, y1) - 1);
      const A = [x0, y0, sg * Math.max(zIn, zo0 - depth)];
      const B = [x1, y1, sg * Math.max(zIn, zo1 - depth)];
      const C = [x1, y1, sg * zo1];
      const D = [x0, y0, sg * zo0];
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

export const serpentLongshipBody = makePolyBody({
  id: 'body-serpent-longship',
  name: '蛇首長船',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'serpent-longship',
  form: 'longship',
  roof: 'open-cockpit',
  wing: 'stern-curl',
  theme: '維京長船：兩頭尖的低船身、側面 4 道疊板稜線、船舷每側 5 面圓盾、中段下沉開放甲板、船首往上往內盤捲的蛇頸螺旋（Oseberg）、船尾上捲',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 銳利稜線：甲板邊、船舷欄內壁頂、外側船舷角、每道疊板的下緣唇與內階（船舷欄頂 3 為圓角）
  hard: [1, 2, 4, 5, 6, 7, 8, 9, 10],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
  ],
  sideZMin: 30,
  zones: () => [
    // 甲板與船舷欄內壁（剖面點 0–2）：橡木色
    { mat: 'deck', keep: (x, y, z, s) => BRK[2] + 1e-4 - Math.abs(s) },
    { mat: 'tar', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'tar', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 船首柱：焦油黑褐柱身＋赭紅盤捲蛇頸＋螺旋中心的蛇頭（青銅小眼）
    parts.push({
      geometry: sweepPlanar(subPath(PROW_PATH, 0, PROW_SPLIT, 16), 0, 30, (t) => PROW_RAD(t * PROW_SPLIT)),
      mat: 'tar',
      solid: true,
      outline: true,
      name: 'prow-stem',
    });
    parts.push({
      geometry: sweepPlanar(subPath(PROW_PATH, PROW_SPLIT, 1, 24), 0, 60, (t) => PROW_RAD(PROW_SPLIT + t * (1 - PROW_SPLIT))),
      mat: 'ochre',
      solid: true,
      outline: true,
      name: 'prow-curl',
    });
    const sh = buildSerpentHead();
    parts.push({ geometry: sh.head, mat: 'ochre', solid: true, outline: true, name: 'prow-serpent-head' });
    parts.push({ geometry: sh.eyes, mat: 'bronze', solid: true, name: 'prow-serpent-eyes' });
    // 船尾柱（stern-curl 尾翼）：焦油黑褐，往前捲成小螺旋
    parts.push({
      geometry: sweepPlanar(STERN_PATH, 0, 60, STERN_RAD),
      mat: 'tar',
      solid: true,
      outline: true,
      name: 'stern-curl',
    });
    // 船舷圓盾：每側 5 面
    /** @type {THREE.BufferGeometry[]} */
    const discs = [];
    /** @type {THREE.BufferGeometry[]} */
    const facesRed = [];
    /** @type {THREE.BufferGeometry[]} */
    const facesCream = [];
    /** @type {THREE.BufferGeometry[]} */
    const bosses = [];
    for (const sg of [-1, 1]) {
      SHIELD_X.forEach((x, i) => {
        const sh = buildShield(x, sg, i);
        discs.push(sh.disc);
        facesRed.push(sh.faceA);
        facesCream.push(sh.faceB);
        bosses.push(sh.boss);
      });
    }
    parts.push({ geometry: mergeGeos(discs), mat: 'tar', solid: true, outline: true, name: 'shields' });
    parts.push({ geometry: mergeGeos(facesRed), mat: 'ochre2', name: 'shield-faces-ochre' });
    parts.push({ geometry: mergeGeos(facesCream), mat: 'cream', name: 'shield-faces-cream' });
    parts.push({ geometry: mergeGeos(bosses), mat: 'bronze', solid: true, name: 'shield-bosses' });
    // 輪拱內襯（前後）：深 3 mm（內緣不小於 |z| 21 = 輪拱切口起點），擋住切口裡的殼內空腔與底盤
    parts.push({
      geometry: mergeGeos([buildArchLiner({ x: 40, y: 13, radius: 17.5 }, 21, 3), buildArchLiner({ x: -40, y: 13, radius: 17.5 }, 21, 3)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 甲板上的 2 條划手橫座（實心橫板，兩端埋進船舷欄內壁）
    /** @type {THREE.BufferGeometry[]} */
    const thwarts = [];
    for (const x of [-9, 9]) {
      const s = stationAt(x);
      const g = new THREE.BoxGeometry(2.2, 0.8, 2 * (s.zi - 0.5));
      g.translate(x, s.deckY + 3.6, 0);
      thwarts.push(g);
    }
    parts.push({ geometry: mergeGeos(thwarts), mat: 'deck', solid: true, name: 'thwarts' });

    /** @type {(s: number) => boolean} 剖面參數在外側船殼（第 1 道疊板上緣以下） */
    const outerSide = (s) => Math.abs(s) > BRK[4] - 1e-4;
    // 疊板邊緣淺木色細線：每道疊板下緣唇上方 0.15–0.85 mm（線寬 0.7）
    parts.push({
      geometry: kit.decal((x, y, z, s) => {
        if (!outerSide(s)) {
          return -1;
        }
        const st = stationAt(x).strakes;
        let d = Infinity;
        for (const k of st) {
          d = Math.min(d, Math.abs(y - (k.yLip + 0.5)));
        }
        return Math.min(0.35 - d, x + 64, 71 - x);
      }),
      mat: 'dPale',
      name: 'decal-strake-edges',
    });
    // 青銅鉚釘點列：每道疊板下緣唇上方 1.6 mm，每 3.5 mm 一顆（直徑 0.9）
    parts.push({
      geometry: kit.decal((x, y, z, s) => {
        if (!outerSide(s)) {
          return -1;
        }
        const ph = (((x + 1.75) % 3.5) + 3.5) % 3.5;
        const du = Math.abs(ph - 1.75);
        const st = stationAt(x).strakes;
        let d = Infinity;
        for (const k of st) {
          d = Math.min(d, Math.hypot(du, y - (k.yLip + 1.6)));
        }
        return Math.min(0.45 - d, x + 60, 66 - x);
      }, { offset: 0.08 }),
      mat: 'dBronze',
      name: 'decal-rivets',
    });
    // 甲板木板縫：沿 x 的深色細線，每 4 mm 一道（只畫在甲板平面上）
    parts.push({
      geometry: kit.decal((x, y, z, s) => {
        if (Math.abs(s) > BRK[1] - 0.002) {
          return -1;
        }
        const ph = ((Math.abs(z) + 2) % 4) - 2;
        return 0.3 - Math.abs(ph);
      }),
      mat: 'dSeam',
      name: 'decal-deck-seams',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P（推估）：船身 x −66 ~ 73，船舷上緣中段 33.5、兩端 42.5 / 45；最寬 ±26（盾外緣約 ±27.6）；車殼外框含船首 / 船尾柱約 151 mm（SPEC 1.14a：碰撞方塊長 ≤ 153 mm 才不會在立體橋刮路面）；船首蛇頸螺旋頂約 57.5',
    strakes: '4 道疊板，每道下緣唇往內 0.8 mm 一階（推估：1/32 縮尺下看得到的最小階差；Gokstad / Oseberg 船為疊板船殼，見 DESIGN.md）',
    shields: '每側 5 面圓盾，半徑 6、厚 0.9 mm 實心 ABS（推估；Gokstad 船舷每側 32 面盾，縮尺後只放 5 面）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），中段下沉甲板在前後輪上方以斜坡回到淺甲板（甲板高 ≥ 輪拱頂 + 1.5）',
    stem: '船首柱 / 船尾柱為實心 ABS 掃掠件（斷面根部 5.4 × 6.8 mm 往捲曲中心漸細），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
