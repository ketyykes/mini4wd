// 特洛伊木馬（body-trojan-horse，神話組・希臘）——F2 擋泥板肌肉型「往前奔馳的木馬」。
// 側視：馬頸是從座艙往前上方斜升的引擎蓋脊（頸脊頂 40.6 在 x 50，鼻尖在 x 79），過了頭頂再往下收成馬頭與口鼻；
// 後輪是高聳的「後腿肌肉」擋泥板（頂 38.6，比背脊高 → 兩塊後腿量體夾著下凹的臀脊），中段大幅收腰（半寬 29.5），前輪擋泥板包住 31 mm 輪；
// 鬃毛是頸脊上往後飛揚的長背鰭（3 綹，尖端往後上掃）；馬尾從兩塊後腿量體之間的臀脊長出，先往上拱再往後下方流成 3 束分開的尾毛（尾翼 / 擴散器）。
// 頭側一對立耳、琥珀色發光眼與青銅口勒貼紙；座艙是頸根後的胡桃木士兵艙蓋；木板接縫、黑繪回紋赭紅下半車身、斜排舷窗。
// 四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-trojan-horse/DESIGN.md（MYTH_RESEARCH G1、G2）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：淺 / 中橡木＋深胡桃木（霧面）＋黑繪陶黑與赭紅（霧面）＋青銅（金屬）；不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）；車尾 −70、口鼻 79 */
const XS = [-70, -64, -56, -48, -40, -30, -20, -8, 4, 14, 24, 34, 42, 50, 54, 58, 64, 70, 75, 79];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂（臀脊 / 背 / 座艙 / 馬頸 / 馬頭）：臀脊 32（夾在兩塊後腿量體之間，比後腿低）→ 座艙 34.6 → 馬頸往前上方斜升到頸頂 40（x 50）→ 頭頂往下收 → 口鼻 21.4
  yN: monoCurve(XS, [26, 29, 31, 32, 32.4, 32, 31.6, 33, 34.6, 35.8, 37, 38.4, 39.4, 40, 39.6, 37.2, 32.4, 27.6, 24, 21.4]),
  // 擋泥板頂：後腿肌肉 35.8（x −40，比臀脊高 3.4 mm）、收腰段掉到 26.8、前輪擋泥板 33.6（R17.5 輪拱頂 30.5）、往口鼻降到 17.5
  yD: monoCurve(XS, [23, 29.4, 33.4, 35.4, 35.8, 33.4, 28.2, 26.8, 26.8, 28.4, 31.6, 33.4, 33.6, 31, 28.6, 26, 23, 20.8, 19, 17.5]),
  // 頸脊 / 座艙 / 臀脊半寬
  nw: monoCurve(XS, [5, 6, 7, 7.5, 8, 9, 10.5, 11.5, 11.5, 10.5, 9.5, 9, 9, 8.6, 9, 9.6, 9, 7.5, 6, 4.5]),
  // 半寬：後腿 39.2（往車尾仍保持寬方的臀部，車尾 29）、腰 24.4（大幅收腰）、前輪 36.8（包住 31 mm 輪胎外緣）、x 54 以後收成馬頭鼻錐（18.5 → 6）
  hw: monoCurve(XS, [24, 33, 38.4, 39.2, 39.2, 34, 27, 24.4, 25, 29.6, 34.2, 35.6, 35.6, 35.4, 35.2, 18.5, 14, 11, 8.5, 6]),
  // 側裙下緣：兩輪之間 10.5（底盤側框頂 9.4 之上，包住電池艙側面）、口鼻 15
  yLow: monoCurve(XS, [21, 18.5, 15.5, 13.5, 13, 11.5, 10.5, 10.5, 10.5, 10.5, 11, 13, 13, 13.5, 14, 14.5, 15, 15, 15, 15]),
};

/**
 * 擋泥板頂高度：x < −12（後腿量體）可以比中線高（臀脊下凹），其餘不高過中線 0.3 mm
 * @type {(x: number) => number}
 */
const deckY = (x) => (x < -12 ? P.yD(x) : Math.min(P.yD(x), P.yN(x) - 0.3));

/**
 * 半剖面 8 點：中線頂 → 頸脊肩 → 頸脊側 → 擋泥板頂 → 肩 → 腰線稜（銳利，最寬處）→ 側面 → 下緣內收
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yN = P.yN(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const yD = deckY(x);
  const nw = Math.max(0.6, Math.min(P.nw(x), hw - 7, 0.55 * hw));
  const dr = yN - yD;
  const drop = Math.min(4.5, 0.42 * (yD - yLow));
  const yBelt = yD - drop;
  const sh = Math.min(4, 0.3 * (hw - nw));
  return [
    [0, yN],
    [0.5 * nw, yN - 0.22 * dr],
    [nw, yD + 0.35 * dr],
    [nw + 0.45 * (hw - sh - nw), yD + 0.12],
    [hw - sh, yD - 0.5],
    [hw, yBelt],
    [hw - 0.7, lerp(yBelt, yLow, 0.55)],
    [hw - 1.8, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車身每 2 mm 一站；馬頭段（x 50 起）每 1 mm */
const STATIONS = [...buildStations(-70, 50, 2, profile).slice(0, -1), ...buildStations(50, 79, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {number[]} 座艙（青銅艙蓋）前後端 x */
const COCKPIT_X = [-8, 16];

/** @type {(x: number) => number} 赭紅側條中心高度：鼻尖 16.5 → 車尾 30（往後上掃） */
const stripeY = (x) => lerp(16.5, 30, Math.min(1, Math.max(0, (79 - x) / 140)));
/** @type {number} 赭紅側條半寬 */
const STRIPE_HW = 2.8;

/** @type {number[]} 舷窗 x 中心（沿側條上方斜向排列） */
const PORT_XS = [-19, -10.5, -2, 6.5, 15];
/** @type {number} 舷窗半徑 */
const PORT_R = 1.7;
/** @type {(x: number) => number} 舷窗中心高度（側條上緣再往上 3.4 mm） */
const portY = (x) => stripeY(x) + STRIPE_HW + 3.4;

/**
 * 赭紅陶土 / 淺橡木分割高度（赭紅飾帶佔下半車身 1/2，和其他木褐色車款拉開）：
 * 取「斜側條上緣」與「腰線稜下 0.6 mm」較高者——兩輪之間到前後輪拱，腰線稜以下整片是赭紅陶土＋黑繪紋帶（腰線稜上方的橡木肩帶留給斜排舷窗）；
 * 馬頭（x 54 以後）仍沿斜側條，保持木頭馬頭
 * @type {(x: number) => number}
 */
const redTopY = (x) => {
  const yLow = P.yLow(x);
  const yD = deckY(x);
  const yBelt = yD - Math.min(4.5, 0.42 * (yD - yLow));
  return x > 54 ? stripeY(x) + STRIPE_HW : Math.max(stripeY(x) + STRIPE_HW, yBelt - 0.6);
};

/** @type {(x: number, z: number) => boolean} 頸脊 / 座艙 / 背脊（中線隆起段） */
const onCrest = (x, z) => Math.abs(z) < Math.min(P.nw(x), P.hw(x) - 7, 0.55 * P.hw(x)) + 0.5;
/** @type {(x: number, z: number) => boolean} 側面（肩以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - Math.min(4, 0.3 * (P.hw(x) - P.nw(x))) - 0.6;

/**
 * 腹側裙板（包住側面外露的電池管）：前後輪拱之間每側一組 L 形實心板——
 * 直立外板（|z| zOut − t → zOut，y yBot → yTop）＋頂部水平棚板（y yTop − t → yTop，從殼側壁內 1 mm 的 zIn(x) 往外接到外板），
 * 把底盤側框（|z| 35–36.2、頂 y 9.4）上方、殼側壁下緣以下的電池艙側面整片蓋住。yBot 預設 10.5（離底盤側框頂 1.1 mm）。
 * 外形在 x–z 平面畫棚板外形、沿 y 擠出；外板是 x–y 外形沿 z 擠出；兩件在外板內緣重疊 0.2 mm（質量重複計入極小，偏保守）。
 * ribs 有值時（省質量用）：棚板不做整片，只在這些 x 各做一條寬 ribW 的橫撐把外板接到殼側壁
 * @type {(o: { x0: number, x1: number, zIn: (x: number) => number, zOut: number, yTop: number, yBot?: number, t?: number, ribs?: number[], ribW?: number }) => THREE.BufferGeometry}
 */
export function buildBellySkirt({ x0, x1, zIn, zOut, yTop, yBot = 10.5, t = 1.2, ribs, ribW = 2.4 }) {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  const n = 24;
  for (const sg of [-1, 1]) {
    // 棚板：shape 座標 (x, |z|)，rotateX(+90°) 後 shape y → 世界 z、擠出方向 → 世界 −y
    /** @type {number[][]} 棚板（或每條橫撐）的 x 範圍 */
    const spans = ribs ? ribs.map((xr) => [xr - ribW / 2, xr + ribW / 2]) : [[x0, x1]];
    for (const [a, b] of spans) {
      /** @type {THREE.Vector2[]} */
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const x = lerp(a, b, i / n);
        pts.push(new THREE.Vector2(x, sg * Math.min(zIn(x), zOut - t)));
      }
      pts.push(new THREE.Vector2(b, sg * (zOut - 0.2)), new THREE.Vector2(a, sg * (zOut - 0.2)));
      const shelf = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: t, bevelEnabled: false });
      shelf.rotateX(Math.PI / 2);
      shelf.translate(0, yTop, 0);
      geos.push(shelf);
    }
    // 外板：x–y 外形（前後端下角倒 1.5 mm），沿 z 擠出厚 t
    const plate = new THREE.Shape([
      new THREE.Vector2(x0, yTop),
      new THREE.Vector2(x0, yBot + 1.5),
      new THREE.Vector2(x0 + 1.5, yBot),
      new THREE.Vector2(x1 - 1.5, yBot),
      new THREE.Vector2(x1, yBot + 1.5),
      new THREE.Vector2(x1, yTop),
    ]);
    const pg = new THREE.ExtrudeGeometry(plate, { depth: t, bevelEnabled: false });
    pg.translate(0, 0, sg > 0 ? zOut - t : -zOut);
    geos.push(pg);
  }
  return mergeGeos(geos);
}

/**
 * 斜腹板：前後輪拱之間每側一片往外下斜的實心板——上緣埋進殼側壁（|z| zIn、y yTop），下緣到底盤側框外緣上方（|z| zOut、y yBot），
 * 斷面是平行四邊形（水平寬 tz，板法向厚約 1.2 mm），沿 x 擠出 x0 → x1；把殼側壁下方、底盤側框以上外露的側框 / 電池艙整片蓋住，
 * 比「直立外板＋水平棚板」省一半質量，側視也像車殼的下斜裙邊
 * @type {(o: { x0: number, x1: number, zIn: number, zOut: number, yTop: number, yBot?: number, tz?: number }) => THREE.BufferGeometry}
 */
export function buildSlantSkirt({ x0, x1, zIn, zOut, yTop, yBot = 10.5, tz = 1.8 }) {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const sg of [-1, 1]) {
    // 斷面 (u = z, v = y)
    const pts = [
      [sg * zIn, yTop],
      [sg * zOut, yBot],
      [sg * (zOut - tz), yBot],
      [sg * (zIn - tz), yTop],
    ].map(([u, v]) => new THREE.Vector2(u, v));
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: x1 - x0, bevelEnabled: false });
    // 擠出方向 → 世界 x：rotateY(−90°) 後 (u, v, w) → (−w, v, u)，再平移到 x1
    g.rotateY(-Math.PI / 2);
    g.translate(x1, 0, 0);
    geos.push(g);
  }
  return mergeGeos(geos);
}

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 木作：霧面（roughness 0.62–0.72、幾乎無清漆）
  oak: namedMaterial('paint-oak-light', { color: 0xb98a55, roughness: 0.66, clearcoat: 0.05 }),
  walnut: namedMaterial('paint-walnut-dark', { color: 0x5c3a21, roughness: 0.7, clearcoat: 0.04 }),
  walnut2: namedMaterial('paint-walnut-dark', { color: 0x5c3a21, roughness: 0.7, clearcoat: 0.04, side: THREE.DoubleSide }),
  // 黑繪陶的黑釉（帶光澤的釉面）
  slip: namedMaterial('paint-slip-black', { color: 0x16110e, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.2 }),
  slip2: namedMaterial('paint-slip-black', { color: 0x16110e, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
  // 霧面黑釉（roughness > 0.5 → Blender 緞面）：亮面的黑釉斜板在算圖裡會反光成一整片白板
  slipMatte: namedMaterial('paint-slip-black-matte', { color: 0x16110e, roughness: 0.62, clearcoat: 0.08 }),
  // 陶甕赭紅（霧面陶土）
  // 色相偏阿提卡陶土橘（0xc25a2c），和淺橡木、胡桃木的褐色拉開
  terracotta: namedMaterial('paint-terracotta-ochre', { color: 0xc25a2c, roughness: 0.66, clearcoat: 0.05 }),
  // 青銅（真金屬：名稱含 -brass）：座艙艙蓋、尾翼
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb07a3c, roughness: 0.3, metalness: 0.8, clearcoat: 0.25 }),
  bronze2: namedMaterial('trim-bronze-brass', { color: 0xb07a3c, roughness: 0.3, metalness: 0.8, clearcoat: 0.25, side: THREE.DoubleSide }),
  // 眼：琥珀色自發光（炫砲手法 5）
  eye: namedMaterial('lamp-eye-amber', { color: 0xffb347, emissive: 0xff8a1a, emissiveIntensity: 0.55, roughness: 0.1, clearcoat: 1.0 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-walnut', { color: 0x4a2f1b, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-walnut', { color: 0x3a2516, roughness: 0.8, side: THREE.DoubleSide }),
  dGroove: decalMaterial('decal-walnut-groove', { color: 0x2c1b0f, roughness: 0.8 }),
  // 木板接縫：深木色（不是黑），霧面
  dSeam: decalMaterial('decal-plank-seam-walnut', { color: 0x6a4426, roughness: 0.8 }),
  // 馬尾翼（霧面胡桃木，roughness 0.74、無清漆 → 不會反光成白板）
  tailWood: namedMaterial('paint-walnut-tail-matte', { color: 0x5c3a21, roughness: 0.74, clearcoat: 0, side: THREE.DoubleSide }),
  dSlip: decalMaterial('decal-slip-black', { color: 0x16110e, roughness: 0.45 }),
  // 黑繪陶的刻線（刻穿黑釉露出底下的赭紅陶土）
  dIncise: decalMaterial('decal-terracotta-incised', { color: 0xb5583a, roughness: 0.6 }),
  dBronze: decalMaterial('decal-bronze', { color: 0xb07a3c, roughness: 0.34, metalness: 0.72 }),
  dPort: decalMaterial('decal-porthole-dark', { color: 0x0d0a08, roughness: 0.3, clearcoat: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number} 線段距離 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定（神話組欄位由下方匯出時補進 BodyDef） */
const CONFIG = {
  id: 'body-trojan-horse',
  name: '特洛伊木馬',
  style: 'myth',
  phase: 8,
  mythSeries: 'greek',
  mythTheme: 'trojan-horse',
  form: 'plank-wagon',
  roof: 'closed',
  wing: 'horse-tail',
  theme: '奔馬伸頸的低趴楔形全罩（iter-122）：鼻端是看得出的馬頭側影（立耳、頭頂到口鼻的落差、頸根下凹）、頸脊上 3 綹往後飄的長鬃（赭紅刻線毛流）；黑繪陶配色——黑釉上半車身＋從鼻尖往後上掃的赭紅下半車身（青銅分割細線），木紋只當刻線紋理、木質士兵艙蓋；斜排舷窗、腰部斜裙；貼身的馬尾翼（iter-127：翼展收在後輪拱寬度內，後緣 4 束下垂的尖馬尾毛）',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 腰線稜（5）是唯一的銳利稜線，其餘平滑
  hard: [5],
  wheelArches: ARCHES,
  sideZMin: 22,
  // 配色：木色為主、赭紅為次、黑只當輔色（和希臘組其他款、firebird 的黑＋赭紅拉開，也避開 Black Saber 的色域）——
  // 上半車身與馬頭 = 淺橡木（木板車身＋接縫），頸脊 / 背脊 = 胡桃深木（從口鼻掃到車尾的中央條），下半車身 = 赭紅陶土飾帶（上面黑繪回紋），
  // 黑釉只用在鬃毛與回紋
  zones: () => [
    // 士兵艙蓋（座艙）：胡桃深木，和淺橡木車身分開
    { mat: 'walnut', keep: (x, y, z) => (onCrest(x, z) ? Math.min(x - COCKPIT_X[0], COCKPIT_X[1] - x) : -1) },
    // 馬頭（x 52 以前的頸脊段）：淺橡木，讓木馬頭整顆是木頭
    { mat: 'oak', keep: (x, y, z) => (onCrest(x, z) ? x - 52 : -1) },
    // 頸脊 / 背脊：胡桃深木中央條
    { mat: 'walnut', keep: (x, y, z) => (onCrest(x, z) ? 1 : -1) },
    // 赭紅陶土下半車身，分割線從鼻尖往後上掃
    // 上緣是 redTopY（腰線稜以下整片赭紅）
    { mat: 'terracotta', keep: (x, y) => Math.min(redTopY(x) - y, y - 13.4) },
    // 淺橡木上半車身（木板）與下緣
    { mat: 'oak', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'walnut', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 鬃毛 = 往後飛揚的背鰭（大件 1）：頸脊中線 x 55 → 16，3 綹長鬃，每綹前緣低、往後上掃到尖端（高 5.6 → 6.8 mm），
    //    尖端都在根部後方 6–8 mm（被迎風往後吹開的動勢）；厚 1.6，根部埋進殼面 1 mm；毛流用赭紅刻線貼紙畫在頸側 ──
    {
      /** @type {(x: number, h: number) => number[]} 頸脊上 x 處高 h 的點 */
      const at = (x, h) => [x, top(x, 0) + h];
      const pts = [
        at(55, -1), at(54.4, 1.6), at(50.5, 3.6), at(44.5, 6.4), at(42.6, 6.8), at(45.6, 3.4),
        at(39, 4.4), at(32.6, 6.4), at(31, 6.6), at(34.4, 3.2), at(28, 3.8), at(21.6, 5.4), at(20.2, 5.6), at(19.6, 2.6), at(16.6, 0.4), at(16.4, -1),
      ];
      parts.push({ geometry: finPlate(pts.reverse(), 0, 1.6), mat: 'slip2', solid: true, outline: true, name: 'horse-mane-locks' });
    }
    // ── 耳朵：頭頂（poll，x 55–61）一對立耳（高出殼面約 4.6 mm、底寬 5.6 mm、厚 1.8），略往後傾、往外張 10° ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const ears = [];
      for (const sg of [-1, 1]) {
        const zc = sg * 4.8;
        const yb = top(58, 4.8);
        ears.push(finPlate([[60.8, yb - 1], [60, yb + 2.2], [57.6, yb + 4.6], [56.2, yb + 4.0], [55.2, yb - 1]], zc, 1.8, sg * -10));
      }
      parts.push({ geometry: mergeGeos(ears), mat: 'walnut2', solid: true, outline: true, name: 'horse-ears' });
    }
    // ── 眼睛：頭側（頸脊側面）一對琥珀色發光橢球 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const eyes = [];
      const ex = 63.6;
      const [ez, ey] = profile(ex)[2];
      for (const sg of [-1, 1]) {
        const e = new THREE.SphereGeometry(1, 12, 8);
        e.scale(2.0, 1.15, 0.8);
        e.translate(ex, ey + 0.3, sg * (ez - 0.05));
        eyes.push(e);
      }
      parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, name: 'horse-eyes' });
    }

    // ── 馬尾（大件 2）：從兩塊後腿量體之間的臀脊（x −52）長出，尾根先往後上拱（像奔馳時揚起的尾根），
    //    再往後下方流成 3 束分開的尾毛（中束沿中線、兩側束往外張到 |z| 13），束尖垂到車尾下緣附近（x −73.6、y 約 21）——
    //    側視是一道往後下方甩出去的 S 形弧，後 3/4 看得到 3 束尾毛，讀起來是馬尾而不是一片翼板；
    //    斷面是扁橢圓（寬 3.4 → 0.9 mm、厚 2.2 → 0.8 mm，≥ 0.8 的射出件），霧面胡桃木 ──
    {
      const y0 = top(-52, 0);
      /** @type {(sz: number) => number[][]} 一束尾毛的中心線（sz = 往外張的量） */
      const strand = (sz) => [
        [-50.6, y0 - 2.2, 0],
        [-53.6, y0 + 0.8, 0.15 * sz],
        [-57.8, y0 + 3.2, 0.3 * sz],
        [-62.4, y0 + 3.6, 0.48 * sz],
        [-66.6, y0 + 1.6, 0.66 * sz],
        [-69.8, y0 - 2.0, 0.82 * sz],
        [-72.2, y0 - 6.4, 0.94 * sz],
        [-73.6, y0 - 10.6, sz],
      ];
      /** @type {(t: number) => number[]} 扁橢圓斷面（寬、厚） */
      const tailR = (t) => [lerp(1.7, 0.45, t ** 0.9), lerp(1.1, 0.4, t)];
      /** @type {THREE.BufferGeometry[]} */
      const strands = [];
      for (const sz of [-13, 0, 13]) {
        strands.push(sweepEllipse(strand(sz), 22, tailR, 8));
      }
      parts.push({ geometry: mergeGeos(strands), mat: 'tailWood', solid: true, outline: true, name: 'horse-tail-wing' });
    }

    // 不裝腹側裙板（裙板外緣會把俯視收腰填平；側面兩層量體由腰線稜＋下半內收＋赭紅下半車身表現）
    // 輪拱內襯（前後）：沿剖面反查殼內面，擋住從輪拱看進去的殼內空腔
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 21, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    // 輪胎內側的環形擋板（|z| 22.9）：擋住從輪拱橫越車身看到另一側地板的視線
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });

    // ── 貼紙 ──
    // 木板接縫：等距平行的細直縫（寬 0.44 mm、深木色 0x6a4426，不用黑；不規則的黑線會像裂紋或塗鴉）——
    // 側面：和斜側條平行的直線（每 4.2 mm 一道），對接縫是垂直直線（每 16 mm，相鄰排錯開 8 mm）；
    // 擋泥板頂面：固定 |z| 的縱向直線（每 4.2 mm 一道，俯視是平行直線，不跟著半寬起伏成波浪），對接縫同上；馬頭（x > 52）與車尾收尖段（x < −56）不畫
    /** @type {(row: number, x: number) => number} 第 row 排木板在 x 處到最近對接縫的距離 */
    const buttDist = (row, x) => {
      const ph = (((x + (row % 2 === 0 ? 0 : 8)) % 16) + 16) % 16;
      return Math.min(ph, 16 - ph);
    };
    /** @type {(x: number, y: number, z: number) => number} 接縫距離函式（正值 = 在縫上） */
    const seam = (x, y, z) => {
      if (onCrest(x, z) || y < 13.6) {
        return -1;
      }
      if (onSide(x, z)) {
        const q = (y - stripeY(x) - STRIPE_HW) / 4.2;
        const row = Math.floor(q);
        const along = Math.abs(q - Math.round(q)) * 4.2;
        return Math.min(0.22 - Math.min(along, buttDist(row, x)), y - redTopY(x) - 0.8, archRingDist(x, y) - 0.6);
      }
      if (x > 52 || x < -56) {
        return -1;
      }
      const q = Math.abs(z) / 4.2;
      const row = Math.floor(q);
      const along = Math.abs(q - Math.round(q)) * 4.2;
      return Math.min(0.22 - Math.min(along, buttDist(row, x)), Math.abs(z) - P.nw(x) - 1.2);
    };
    /** @type {(x: number, y: number) => boolean} 在赭紅下半車身 */
    const onRed = (x, y) => y < redTopY(x) && y > 13.4;
    parts.push({ geometry: kit.decal((x, y, z) => (onRed(x, y) ? -1 : seam(x, y, z))), mat: 'dSeam', name: 'decal-plank-seams' });
    // 赭紅陶土飾帶上的黑繪回紋（MYTH_RESEARCH 希臘陶甕的回紋帶）：沿分割線斜向的連續鉤形回紋，週期 7 mm、高 4 mm，上下各一條邊線
    /** @type {number[][]} 一個週期內的回紋折線段（u = 沿 x，v = 帶內高度） */
    const KEY = [
      [0, 0, 7, 0],
      [0.8, 0, 0.8, 4],
      [0.8, 4, 5.2, 4],
      [5.2, 4, 5.2, 1.6],
      [5.2, 1.6, 3, 1.6],
      [0, 5.4, 7, 5.4],
    ];
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 60 || x < -66) {
          return -1;
        }
        // 紋帶跟著赭紅上緣（redTopY）走；下方是一圈黑繪陶甕底部常見的放射尖齒紋（底線＋往上的尖三角，週期 3.5 mm、高 3.2 mm）
        const v = y - (redTopY(x) - 7.8);
        const u = ((x % 7) + 7) % 7;
        if (v >= -1 && v <= 6.4) {
          const d = Math.min(...KEY.map(([ax, ay, bx, by]) => segDist(u, v, ax, ay, bx, by)));
          return Math.min(0.38 - d, archRingDist(x, y) - 1.0);
        }
        const w = v + 2.6;
        if (w < -4.4 || w > 0.5) {
          return -1;
        }
        const ur = Math.abs((((x % 3.5) + 3.5) % 3.5) - 1.75) / 1.75;
        // 底線（w −4.4 → −3.6）＋尖齒（底寬 3.5、尖端在 w ≈ 0）
        const ray = w < -3.6 ? 1 : 0.15 + (-w / 3.6) * 0.85 - ur;
        return Math.min(ray, archRingDist(x, y) - 1.0, y - 13.8);
      }, { offset: 0.1 }),
      mat: 'dSlip',
      name: 'decal-meander-frieze',
    });
    // 鬃毛毛流（赭紅刻線）：頸脊兩側（x 20 → 56）往後下斜的細線，每 2.2 mm 一道
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 20 || x > 56 || !onCrest(x, z) || Math.abs(z) < 1.4) {
          return -1;
        }
        const q = (x + 1.8 * (P.yN(x) - y)) / 2.2;
        return 0.26 - Math.abs(q - Math.round(q)) * 2.2;
      }, { offset: 0.1 }),
      mat: 'dIncise',
      name: 'decal-mane-flow',
    });
    // 座艙艙蓋木板縫（深色）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onCrest(x, z) || x < COCKPIT_X[0] + 0.6 || x > COCKPIT_X[1] - 0.6) {
          return -1;
        }
        const q = z / 3.2;
        return 0.25 - Math.abs(q - Math.round(q)) * 3.2;
      }, { offset: 0.1 }),
      mat: 'dGroove',
      name: 'decal-hatch-planks',
    });
    // 淺橡木 / 赭紅分割線上的青銅細線（0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => (onCrest(x, z) ? -1 : 0.35 - Math.abs(y - redTopY(x))), { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-split-pinstripe',
    });
    // 斜排圓舷窗（士兵窗）：深色窗＋青銅窗框
    /** @type {(x: number, y: number) => number} 到最近舷窗中心的距離 */
    const portDist = (x, y) => Math.min(...PORT_XS.map((px) => Math.hypot(x - px, y - portY(px))));
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) && Math.abs(x) < 25 ? PORT_R - portDist(x, y) : -1), { offset: 0.12 }),
      mat: 'dPort',
      name: 'decal-portholes',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || Math.abs(x) > 25) {
          return -1;
        }
        const d = portDist(x, y);
        return Math.min(d - PORT_R + 0.05, PORT_R + 0.65 - d);
      }, { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-porthole-rims',
    });
    // 青銅口勒：鼻革（x 72.5 一圈）＋額帶（x 61）＋頰帶（鼻革 → 眼後）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 58) {
          return -1;
        }
        const noseband = Math.abs(z) < P.hw(x) - 0.4 ? 0.6 - Math.abs(x - 72.5) : -1;
        const browband = onCrest(x, z) ? 0.6 - Math.abs(x - 61.8) : -1;
        const [ez, ey] = profile(65.6)[2];
        const cheek = Math.abs(z) > ez - 1.5 ? 0.6 - segDist(x, y, 72.5, P.yD(72.5) + 0.6, 61.4, ey + 0.8) : -1;
        return Math.max(noseband, browband, cheek);
      }, { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-head-harness',
    });
    // 鼻孔：口鼻頂兩側一對橢圓深色鼻孔
    parts.push({
      geometry: kit.decal((x, y, z) => (x < 74 || y < P.yD(x) ? -1 : 1 - Math.hypot((x - 76.6) / 1.3, (Math.abs(z) - 2.4) / 0.75)), { offset: 0.14 }),
      mat: 'dGroove',
      name: 'decal-nostrils',
    });
    // 不加青銅鉚釘點列（會和赭紅飾帶的回紋重疊）
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，iter-122）：殼 x −70 → 79、尾翼後緣 −71.8（iter-127：馬尾毛束尖 −73.9，外框長 152.9 ≤ 153，SPEC 1.14a）；口鼻頂 19.5、頭頂 32.6（x 58）、耳尖約 37.8、頸根 31.4、座艙頂 41.5、尾翼頂 41.2；半寬：前輪拱 36.8（到 x 54 仍 35.7，包住輪胎外緣 34.25）、腰 31.2＋斜裙 33.2、後輪拱 37.4、馬頭 18.5 → 6、尾翼 ±45.6 → iter-127 ±37（≤ 48.0）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯用 buildProfileLiner（沿剖面反查殼內面）',
    windows: '舷窗：米科諾斯島浮雕陶甕木馬側面的舷窗（MYTH_RESEARCH G2）；本款 5 個 φ3.4 mm 圓窗貼紙沿側條斜排（數量與尺寸自訂）',
    headNeck: '馬頸、馬頭是殼面的一部分（中央隆起的頸脊）；鬃毛鰭、耳、眼、尾根支柱、尾翼為實心 ABS 件（厚 1.3–2.2 mm），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 只複製既有欄位：神話組分組欄位（mythSeries / mythTheme）在這裡補進 BodyDef
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const trojanHorseBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
