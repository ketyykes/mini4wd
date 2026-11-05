// 捲首長船（body-serpent-longship，神話組・北歐）：維京長船主題只用元素表現，車上沒有蛇或龍的頭、臉、眼。
// 船 → 車身：側面 4 道往外疊的疊板（clinker）稜線沿前低後平的船舷排成速度線（最上一道漆赭紅），船舷下每側 5 面圓盾，第 3 道疊板上一排槳孔圓環；
// 船首柱 → 鼻尖：赭紅龍骨脊從座艙前沿甲板中線往前，在鼻尖往上捲成一圈捲渦（Oseberg 船艏柱的盤捲，只取螺旋、不做頭）；
// 條紋方帆 → 尾翼：一片往後上揚、被風灌滿微微下凹的赭紅 / 奶油白直條帆翼，後緣是橫桁（兩端青銅帽），中央一支後傾桅座、兩側各一條拉到船舷的帆索。
// 側視是一把低平的刀（F1 刀鋒型）：船首從前輪上方一路壓低到鼻尖，兩輪之間微凹，船尾不翹高。
// 船殼寬並往下包（船舷在前後輪上方蓋住輪胎上半部、中段側面往下到 y 10 擋住電池艙），四輪與電池艙不外露。
// 設計：shared/design/body-serpent-longship/DESIGN.md（典故、借用的古代語彙、和市售車殼 / 現代作品 / 既有車殼的差異）。
// 造型回到出土文物（MYTH_RESEARCH N1、N2、N5–N7）：Oseberg 船艏柱的盤捲、Gokstad 陪葬的整船盾牌、疊板船殼的鉚釘列；
// 不用任何盧恩字母或符號、不用白藍配色。
// 塗裝全為自創：焦油黑褐船殼＋赭紅 / 奶油白對半分區的圓盾與直條帆＋青銅盾心與鉚釘點列＋疊板邊緣淺木色細線；不含任何文字、號碼、商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, sdRoundRect } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch, closedLoft } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 船身站位節點（x 由後到前；前後軸 x = ±40；船尾尖 −66、船首尖 73；船首柱捲渦與帆翼另外以實體件製作） */
const XS = [-66, -62, -56, -48, -40, -28, -14, 0, 14, 28, 40, 48, 56, 63, 69, 73];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 船舷上緣（sheer line）：側視是一把前低後平的刀——船首從前輪上方 32.4 一路壓到船首尖 17.5（V3 鼻尖低），
  // 兩輪之間微凹到 30.2（前後輪上方各鼓起一段，讀成擋泥板），船尾往後收低到 30.5、不翹高（翹高的船尾側視又方又高）。
  // 前後輪上方甲板 = 船舷 − 0.9 ≥ 31.5（31 mm 輪拱頂 30.5 之上）
  sheer: monoCurve(XS, [30.5, 31.2, 32, 32.4, 32.4, 31.4, 30.4, 30.2, 30.6, 31.6, 32.4, 30.4, 26, 22.3, 19.2, 17.5]),
  // 船舷半寬：前後輪上方最寬 35（船舷蓋住輪胎上半部，31 mm 輪胎外側面 |z| 34.75），中段收到 27.5，
  // 往船首 / 船尾收尖；船殼要夠寬，四輪與電池艙才不會全露在船殼外
  // 船首收尖段留一點寬度（x 56 / 63 / 69 / 73：16 / 10.5 / 6.4 / 4），船首柱的根部才埋得進甲板
  hw: monoCurve(XS, [2.4, 4.5, 10, 21.5, 35, 30.5, 28, 27.5, 28, 30.5, 35, 25, 16, 10.5, 6.4, 4]),
  // 船身下緣：中段 10（剛好在底盤側壁頂 9.4 之上，側面擋住電池艙），往船尾彎上去（龍骨上翹）；
  // 前後卡榫處（x 52 / −50）約 15，遮住卡座吊耳；船首 / 船尾下緣壓低到前後齒輪不從船尖下方露出
  // 船首下緣不往上翹（上翹的 forefoot 會讓車頭開口露出底盤），壓在 15.6–16 封住車頭
  yLow: monoCurve(XS, [27.5, 21.5, 16.5, 14, 12.5, 10.4, 10, 10, 10, 10.4, 12.5, 14.2, 15.5, 15.6, 15.8, 16]),
  // 船底收向龍骨的下緣半寬：中段 25.5（船殼下段幾乎垂直往下，像龍骨側板）；前後輪處由輪拱切開（cutZFrom 21）
  keel: monoCurve(XS, [1.5, 3, 7.5, 18.5, 31, 28, 26, 25.5, 26, 28, 31, 21, 12.5, 7.5, 4.4, 2.6]),
};

/** @type {number} 甲板蓋板比船舷頂低多少（船舷欄成一道低矮的護欄，不下沉） */
const DECK_DROP = 0.9;
/** @type {number} 甲板中線拱高（蓋板是一片弧面而不是平板；拱高壓低以減少正面面積） */
const DECK_CROWN = 1.2;

/**
 * 甲板蓋板上的小座艙開口：甲板是和船舷齊平的木板蓋板（開放式船斗不像比賽用車殼），
 * 只在中段留一個 24 × 18 mm 的圓角方口（舵手 / 划手位），深 4.5 mm
 * @type {{ x0: number, x1: number, hz: number, r: number, depth: number }}
 */
const HATCH = { x0: -14, x1: 10, hz: 9, r: 3, depth: 4.5 };
/** @type {number} 疊板道數 */
const STRAKES = 4;
/** @type {number} 疊板接縫往內的階差（mm） */
const LAP_STEP = 0.8;

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
  const deckY = sheer - DECK_DROP;
  // 船舷欄厚度（外側船殼到內壁）至少 1.5 mm：船首 / 船尾尖端只用 3k 的話會小於殼厚 0.8，殼內面會從外側穿出（Blender 看到內面色塊）
  const zi = Math.max(0.4, hw - Math.max(3 * k, 1.5));
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
    [0, s.deckY + DECK_CROWN * k],
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

/** @type {(x: number) => number} 甲板中線頂高 */
const deckTop = (x) => P.sheer(x) - DECK_DROP + DECK_CROWN * tipScale(x);

/** @type {number[]} 圓盾中心 x（每側 5 面，間距 10；盾徑 10.8 → 相鄰兩面互相疊 0.8 mm，像 Gokstad 船舷外互疊的盾列） */
const SHIELD_X = [-20, -10, 0, 10, 20];
/** @type {number} 圓盾半徑 */
const SHIELD_R = 5.4;
/** @type {number} 圓盾厚度 */
const SHIELD_T = 0.6;
/** @type {number[]} 槳孔中心 x（每側 4 個，在盾與盾之間的正下方） */
const OAR_PORT_X = [-15, -5, 5, 15];

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 霧面材質（神話款要有材質對比）：焦油木船殼、深色橡木甲板、盾面、帆布為霧面（roughness 0.6–0.8、低 clearcoat）
  tar: namedMaterial('paint-tar-brown', { color: 0x2a1d16, roughness: 0.72, clearcoat: 0.08, clearcoatRoughness: 0.6 }),
  deck: namedMaterial('paint-deck-oak', { color: 0x4f3422, roughness: 0.78, clearcoat: 0 }),
  deck2: namedMaterial('paint-deck-oak', { color: 0x3f2a1b, roughness: 0.78, clearcoat: 0, side: THREE.DoubleSide }),
  ochre: namedMaterial('paint-ochre-red', { color: 0xa8432a, roughness: 0.62, clearcoat: 0.1 }),
  ochre2: namedMaterial('paint-ochre-red', { color: 0xa8432a, roughness: 0.62, clearcoat: 0.1, side: THREE.DoubleSide }),
  cream: namedMaterial('paint-cream-white', { color: 0xeee0c0, roughness: 0.6, clearcoat: 0.1, side: THREE.DoubleSide }),
  // 帆索：麻繩色（霧面）
  rope: namedMaterial('paint-rope-hemp', { color: 0xc9ae80, roughness: 0.8, clearcoat: 0 }),
  // 真金屬（青銅盾心）：名稱含 -brass → Blender 換成金屬材質
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb08d57, metalness: 0.8, roughness: 0.32, clearcoat: 0.2 }),
  // 擋風罩：深色煙燻 PC（V5 有色座艙；名稱 pc-smoke → Blender 煙燻 PC）
  smoke: namedMaterial('pc-smoke-umber', { color: 0x1c130d, roughness: 0.05, clearcoat: 1.0, transparent: true, opacity: 0.85 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1d1612, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-tar', { color: 0x3a2a20, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-tar', { color: 0x3a2a20, roughness: 0.75, side: THREE.DoubleSide }),
  dPale: decalMaterial('decal-pale-wood', { color: 0xc9ae80, roughness: 0.65 }),
  dCream: decalMaterial('decal-cream-white', { color: 0xeee0c0, roughness: 0.6 }),
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
 * 船首柱捲渦的中心線（側視 x–y，接在甲板龍骨脊的前端）：沿鼻尖往前，再往上、往後捲一圈。
 * 只取 Oseberg 船艏柱的螺旋，末端收細成一個尖，不做頭。最前緣（含斷面半徑）不超過 x 83
 * @type {number[][]}
 */
const PROW_SCROLL = [
  [70, 19.3],
  [75.5, 19.3],
  [79.3, 20.6],
  [80.8, 23.4],
  [79.6, 26.2],
  [77, 27],
  [75.3, 25.4],
  [76.2, 23.6],
];
/** @type {number} 龍骨脊接到捲渦的位置（沿整條中心線的比例） */
const PROW_T = 0.7;
/**
 * 龍骨脊＋船首柱的斷面半徑 [z 向半厚, 平面內半高]：甲板上是寬而低的圓脊，到鼻尖變成窄而高的板條（船首柱是一片立著的木板），捲渦末端收細
 * @type {(t: number) => number[]}
 */
const PROW_RAD = (t) => {
  if (t < PROW_T) {
    return [lerp(2.3, 1.3, t / PROW_T), lerp(1.5, 2.1, t / PROW_T)];
  }
  const q = (t - PROW_T) / (1 - PROW_T);
  return [lerp(1.3, 0.9, q), lerp(2.1, 1, q)];
};

/**
 * 條紋方帆尾翼：帆腳（前緣）貼在後甲板上，帆面往後上揚到橫桁（後緣），中段被風灌滿而下凹 sag；
 * 俯視是長方形的方帆，stripes 道直條（赭紅 / 奶油白相間，最外兩道赭紅）。hs = 半翼展
 * @type {{ xFoot: number, yFoot: number, xHead: number, yHead: number, hs: number, sag: number, thick: number, stripes: number }}
 */
const SAIL = { xFoot: -38, yFoot: 33.2, xHead: -64.5, yHead: 37, hs: 20.5, sag: 1.2, thick: 1, stripes: 7 };
/** @type {number} 翼端盾的半徑（比船舷的盾小一號） */
const END_SHIELD_R = 4.4;

/** @type {(u: number) => { x: number, y: number }} 帆面中心（u = 0 帆腳、1 橫桁） */
const sailAt = (u) => ({
  x: lerp(SAIL.xFoot, SAIL.xHead, u),
  y: lerp(SAIL.yFoot, SAIL.yHead, u) - SAIL.sag * Math.sin(Math.PI * u),
});

/**
 * 帆翼：每道直條是一片沿弦向 6 段的封閉薄板（低面數），依顏色合併
 * @type {() => { ochre: THREE.BufferGeometry, cream: THREE.BufferGeometry }}
 */
const buildSail = () => {
  const nu = 6;
  /** @type {THREE.BufferGeometry[]} */
  const ochre = [];
  /** @type {THREE.BufferGeometry[]} */
  const cream = [];
  for (let i = 0; i < SAIL.stripes; i++) {
    const v0 = -1 + (2 * i) / SAIL.stripes;
    const v1 = -1 + (2 * (i + 1)) / SAIL.stripes;
    /** @type {number[][][]} */
    const rings = [];
    for (let j = 0; j <= nu; j++) {
      const c = sailAt(j / nu);
      rings.push([
        [c.x, c.y - SAIL.thick / 2, v0 * SAIL.hs],
        [c.x, c.y + SAIL.thick / 2, v0 * SAIL.hs],
        [c.x, c.y + SAIL.thick / 2, v1 * SAIL.hs],
        [c.x, c.y - SAIL.thick / 2, v1 * SAIL.hs],
      ]);
    }
    if (i % 2 === 0) {
      ochre.push(closedLoft(rings));
    } else {
      cream.push(closedLoft(rings));
    }
  }
  return { ochre: mergeGeos(ochre), cream: mergeGeos(cream) };
};

/**
 * 圓盾（單面）：實心圓盤（焦油色盾緣）＋外側面對半分區的赭紅 / 奶油白兩片薄面＋青銅盾心（扁球）。
 * 對半分區用直線（不用十字四分、不用放射狀，避免任何被挪用的十字 / 日輪圖形）。
 * (x, yc) = 盾心；zBase = 盾背面貼著的 |z|；tilt = 分區線的傾角；r = 盾半徑
 * @type {(x: number, yc: number, zBase: number, sg: number, tilt: number, r?: number) => { disc: THREE.BufferGeometry, faceA: THREE.BufferGeometry, faceB: THREE.BufferGeometry, boss: THREE.BufferGeometry }}
 */
const shieldAt = (x, yc, zBase, sg, tilt, r = SHIELD_R) => {
  const disc = new THREE.CylinderGeometry(r, r, SHIELD_T, 16);
  disc.rotateX(Math.PI / 2);
  disc.translate(x, yc, sg * (zBase + SHIELD_T / 2 + 0.05));
  const zFace = sg * (zBase + SHIELD_T + 0.12);
  /** @type {(a0: number) => THREE.BufferGeometry} 半圓薄面（盾緣留 0.6 mm 焦油色） */
  const half = (a0) => {
    const sh = new THREE.Shape();
    const rr = r - 0.6;
    sh.moveTo(rr * Math.cos(a0), rr * Math.sin(a0));
    sh.absarc(0, 0, rr, a0, a0 + Math.PI, false);
    sh.lineTo(rr * Math.cos(a0), rr * Math.sin(a0));
    const g = new THREE.ShapeGeometry(sh, 8);
    if (sg < 0) {
      g.rotateY(Math.PI);
    }
    g.translate(x, yc, zFace);
    return g;
  };
  const boss = new THREE.SphereGeometry(1, 10, 6);
  boss.scale(1.7, 1.7, 0.9);
  boss.translate(x, yc, sg * (zBase + SHIELD_T + 0.2));
  return { disc, faceA: half(Math.PI / 2 + tilt), faceB: half(-Math.PI / 2 + tilt), boss };
};

/**
 * 船舷盾列的第 i 面盾：盾心在船舷下 4.4（盾頂只高出船舷 1 mm，盾列沿船側排成一條帶，不在正面輪廓上方多出一圈），貼在該高度的外側船殼上。
 * 奇數面盾往外多 0.35 mm，疊在偶數面盾外面（互疊的盾列）；相鄰兩面盾的分區線左右鏡射，盾列讀成有節奏的交替
 * @type {(x: number, sg: number, i: number) => ReturnType<typeof shieldAt>}
 */
const buildShield = (x, sg, i) => {
  const yc = stationAt(x).sheer - 4.4;
  const lift = i % 2 === 1 ? 0.35 : 0;
  return shieldAt(x, yc, hullZAt(x, yc) + lift, sg, (i % 2 === 0 ? 1 : -1) * 0.5);
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
  name: '捲首長船',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'serpent-longship',
  form: 'longship',
  roof: 'open-cockpit',
  wing: 'sail-wing',
  theme: '維京長船用元素表現：前低後平的刀形船身、鼻尖往上捲一圈的船首柱捲渦（赭紅龍骨脊一路接到座艙前）、側面 4 道疊板速度線（最上一道赭紅）、船舷下每側 5 面圓盾與一排槳孔、齊平木板甲板只留小座艙口、車尾一片被風灌滿的赭紅 / 奶油白直條方帆尾翼（橫桁、桅座、帆索）',
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
  recesses: [
    {
      id: '小座艙',
      view: 'top',
      shape: 'fn',
      sd: (x, y, z) => sdRoundRect(x, Math.abs(z), HATCH.x0, HATCH.x1, -HATCH.hz, HATCH.hz, HATCH.r),
      depth: HATCH.depth,
    },
  ],
  innerSkipRecess: true,
  sideZMin: 30,
  zones: () => [
    // 甲板與船舷欄內壁（剖面點 0–2）：橡木色
    { mat: 'deck', keep: (x, y, z, s) => BRK[2] + 1e-4 - Math.abs(s) },
    // 賽車條：最上一道疊板漆赭紅，從鼻尖沿船舷一路往後掃到船尾；疊板在船首往下收，紅條就是一條從鼻尖斜向後上的速度線
    { mat: 'ochre', keep: (x, y, z, s) => Math.min(Math.abs(s) - BRK[4] + 1e-4, BRK[5] + 1e-4 - Math.abs(s)) },
    { mat: 'tar', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'tar', recess: 'deck2', recessWall: 'deck2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 龍骨脊＋船首柱捲渦（赭紅，一條連續的掃掠件）：低矮圓脊從座艙前沿甲板中線往前（V4 中央隆起的概念，圓脊不是 V 形），
    // 到鼻尖變成立著的板條、往上往後捲一圈
    parts.push({
      geometry: sweepPlanar(
        [
          [17, deckTop(17) + 1.2],
          [28, deckTop(28) + 1.1],
          [40, deckTop(40) + 0.8],
          [52, deckTop(52) + 0.5],
          [62, deckTop(62) + 0.3],
          ...PROW_SCROLL,
        ],
        0,
        48,
        PROW_RAD,
        8,
      ),
      mat: 'ochre',
      solid: true,
      outline: true,
      name: 'keel-ridge-prow-scroll',
    });
    // 條紋方帆尾翼
    const sail = buildSail();
    parts.push({ geometry: sail.ochre, mat: 'ochre', solid: true, outline: true, name: 'sail-wing-ochre' });
    parts.push({ geometry: sail.cream, mat: 'cream', solid: true, outline: true, name: 'sail-wing-cream' });
    // 橫桁：帆翼後緣一支橫木，兩端穿進翼端盾的盾心
    {
      const yard = new THREE.CylinderGeometry(0.8, 0.8, 2 * (SAIL.hs + 0.8), 10);
      yard.rotateX(Math.PI / 2);
      yard.translate(SAIL.xHead - 0.2, SAIL.yHead + 0.3, 0);
      parts.push({ geometry: yard, mat: 'tar', solid: true, outline: true, name: 'sail-yard' });
    }
    // 桅座：帆翼下方中央一片後傾的立板，根部埋進船尾甲板，頂端頂住帆面
    {
      /** @type {(x: number) => number} 帆面底面在 x 處的高度 */
      const sailUnder = (x) => sailAt((x - SAIL.xFoot) / (SAIL.xHead - SAIL.xFoot)).y - 0.2;
      parts.push({
        geometry: finPlate(
          [
            [-47, 31.2],
            [-53, 31.2],
            [-61, sailUnder(-61)],
            [-57.5, sailUnder(-57.5)],
          ],
          0,
          1.8,
        ),
        mat: 'tar',
        solid: true,
        outline: true,
        name: 'sail-mast',
      });
    }
    // 帆索：橫桁兩端各一條往前拉到船舷的繩（中段微垂），讓帆翼和船舷連成一體
    parts.push({
      geometry: mergeGeos(
        [-1, 1].map((sg) =>
          sweepEllipse(
            [
              [-33, 31.8, sg * 32.6],
              [-49, 34.3, sg * 27.5],
              [SAIL.xHead - 0.2, SAIL.yHead + 0.3, sg * (SAIL.hs - 0.5)],
            ],
            6,
            () => [0.55, 0.55],
            6,
          ),
        ),
      ),
      mat: 'rope',
      solid: true,
      name: 'sail-stays',
    });
    // 頂面起伏（避免頂面是一整片平甲板、座艙只是凹洞）：
    // 1) 擋風罩：座艙口前段一個深色煙燻的低矮擋風罩（V5 小而有色的座艙，長 18、寬 17、高出甲板約 3.5 mm），座艙口後段仍開放
    // 2) 座艙後方焦油色低矮整流背（頭枕整流罩，往後收進甲板）
    {
      /**
       * 上半橢球＋平底封口（封閉網格；只做甲板以上那一半，不在船殼內多算一整顆橢球的質量）
       * @type {(r: number[], c: number[]) => THREE.BufferGeometry}
       */
      const dome = (r, c) => {
        const top = new THREE.SphereGeometry(1, 16, 6, 0, 2 * Math.PI, 0, Math.PI / 2).toNonIndexed();
        const cap = new THREE.CircleGeometry(1, 16);
        cap.rotateX(Math.PI / 2);
        const g = mergeGeos([top, cap.toNonIndexed()]);
        g.scale(r[0], r[1], r[2]);
        g.translate(c[0], c[1], c[2] ?? 0);
        return g;
      };
      parts.push({ geometry: dome([9, 4.6, 8.5], [13, deckTop(13) - 1.1]), mat: 'smoke', solid: true, outline: true, name: 'cockpit-windshield' });
      parts.push({ geometry: dome([11, 2.8, 6.5], [-25, deckTop(-25) - 0.9]), mat: 'tar', solid: true, outline: true, name: 'headrest-fairing' });
    }
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
    // 翼端盾：帆翼兩端各掛一面圓盾當翼端板，橫桁穿過盾心（側視看得到帆翼的位置）
    for (const sg of [-1, 1]) {
      const sh = shieldAt(SAIL.xHead - 0.2, SAIL.yHead + 0.3, SAIL.hs + 0.2, sg, sg * 0.5, END_SHIELD_R);
      discs.push(sh.disc);
      facesRed.push(sh.faceA);
      facesCream.push(sh.faceB);
      bosses.push(sh.boss);
    }
    parts.push({ geometry: mergeGeos(discs), mat: 'tar', solid: true, outline: true, name: 'shields' });
    parts.push({ geometry: mergeGeos(facesRed), mat: 'ochre2', name: 'shield-faces-ochre' });
    parts.push({ geometry: mergeGeos(facesCream), mat: 'cream', name: 'shield-faces-cream' });
    parts.push({ geometry: mergeGeos(bosses), mat: 'bronze', solid: true, name: 'shield-bosses' });
    // 輪拱內襯（前後）：從殼內面一路做到 |z| 21（輪拱切口起點；只深 3 mm 的話，寬船殼會露出殼內空腔），擋住切口裡的殼內空腔與底盤
    parts.push({
      geometry: mergeGeos([buildArchLiner({ x: 40, y: 13, radius: 17.5 }, 21, 14), buildArchLiner({ x: -40, y: 13, radius: 17.5 }, 21, 14)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 輪胎內側環形擋板（kitsune 的 buildArchWell，|z| 22.9；離 31 mm 輪內側面 1.85 mm）
    parts.push({
      geometry: mergeGeos([{ x: 40, y: 13 }, { x: -40, y: 13 }].map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 小座艙裡的一條划手橫座（實心橫板，兩端埋進座艙壁）
    {
      const g = new THREE.BoxGeometry(2.2, 0.9, 2 * HATCH.hz + 0.6);
      g.translate(-1, stationAt(-1).deckY - HATCH.depth + 2.2, 0);
      parts.push({ geometry: g, mat: 'deck', solid: true, name: 'thwart' });
    }

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
    // 青銅鉚釘點列：每道疊板下緣唇上方 1.6 mm，每 3.5 mm 一顆（直徑 0.9）；第 3 道疊板留給槳孔，不放鉚釘
    parts.push({
      geometry: kit.decal((x, y, z, s) => {
        if (!outerSide(s)) {
          return -1;
        }
        const ph = (((x + 1.75) % 3.5) + 3.5) % 3.5;
        const du = Math.abs(ph - 1.75);
        const st = stationAt(x).strakes;
        let d = Infinity;
        st.forEach((k, i) => {
          if (i !== 2) {
            d = Math.min(d, Math.hypot(du, y - (k.yLip + 1.6)));
          }
        });
        return Math.min(0.45 - d, x + 60, 66 - x);
      }, { offset: 0.08 }),
      mat: 'dBronze',
      name: 'decal-rivets',
    });
    // 槳孔：第 3 道疊板上一排淺木色圓環（外徑 3.5、線寬 0.76），圓心比疊板中線高 0.3，不壓到下緣的淺木色細線
    parts.push({
      geometry: kit.decal((x, y, z, s) => {
        if (!outerSide(s)) {
          return -1;
        }
        const k = stationAt(x).strakes[2];
        const yc = (k.yTop + k.yLip) / 2 + 0.3;
        let d = Infinity;
        for (const px of OAR_PORT_X) {
          d = Math.min(d, Math.hypot(x - px, y - yc));
        }
        return 0.38 - Math.abs(d - 1.35);
      }),
      mat: 'dPale',
      name: 'decal-oar-ports',
    });
    // 甲板賽車條：龍骨脊兩側各一道奶油白直條（|z| 4.6–7.4，落在兩道木板縫之間），從鼻尖一路往後到帆腳，和帆的直條呼應
    parts.push({
      geometry: kit.decal((x, y, z, s) => {
        if (Math.abs(s) > BRK[1] - 0.002 || (x > HATCH.x0 - 1.5 && x < HATCH.x1 + 1.5)) {
          return -1;
        }
        return Math.min(1.4 - Math.abs(Math.abs(z) - 6), x - SAIL.xFoot, 66 - x);
      }),
      mat: 'dCream',
      name: 'decal-deck-stripes',
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
    geometry: '本檔站位產生器 P（推估）：船身 x −66 ~ 73；船舷上緣 船尾 30.5 → 後輪 32.4 → 中段 30.2 → 前輪 32.4 → 船首尖 17.5（刀形）、船首下緣 15.6–16（封住車頭）；前後輪上方最寬 ±35（蓋住 31 mm 輪胎外側面 ±34.75）、中段 ±27.5（盾面外緣約 ±29.5）、側面下緣中段 y 10；船首柱捲渦前緣 x 82.2、翼端盾後緣 −69.1，車殼外框 151.3 mm（SPEC 1.14a：碰撞方塊長 ≤ 153 mm 才不會在立體橋刮路面）；頂高 41.7（翼端盾頂）；盾心在船舷下 4.4 mm',
    strakes: '4 道疊板，每道下緣唇往內 0.8 mm 一階（推估：1/32 縮尺下看得到的最小階差；Gokstad / Oseberg 船為疊板船殼，見 DESIGN.md）；第 3 道疊板每側 4 個槳孔圓環（貼紙；Oseberg 船每側 15 個槳孔，縮尺後只放 4 個）',
    shields: '每側 5 面圓盾，半徑 5.4、厚 0.6 mm 實心 ABS（推估；Gokstad 船舷每側 32 面盾，縮尺後只放 5 面）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），甲板高 = 船舷 − 0.9 ≥ 31.5（輪拱頂 30.5 之上）；另有 buildArchWell 輪胎內側環形擋板（|z| 22.9）',
    deck: '甲板蓋板 = 船舷頂 − 0.9 mm、中線拱 1.2 mm；小座艙 x −14 ~ 10、|z| ≤ 9、深 4.5 mm、內有一條划手橫座（推估）',
    prow: '龍骨脊＋船首柱捲渦為一條實心 ABS 掃掠件（48 × 8 段）：甲板上是寬 4.6 × 高 3 mm 的圓脊，到鼻尖變成厚 2.6 × 高 4.2 mm 的立板，往上往後捲一圈（捲渦外徑約 8 mm、頂 y 約 28），末端收細；只取 Oseberg 船艏柱的盤捲，不做頭（推估）',
    sail: '條紋方帆尾翼：長方形帆面 26.5 × 41 mm、厚 1 mm，帆腳 y 33.2（貼後甲板）往後上揚到橫桁 y 37.0、中段下凹 1.2 mm；7 道直條（赭紅 4、奶油白 3），每道沿弦向 6 段；橫桁直徑 1.6 mm，兩端各一面半徑 4.4 mm 的翼端盾；桅座為厚 1.8 mm 立板；帆索直徑 1.1 mm（推估；直條帆是自創塗裝，沒有查證過對應的文物）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
