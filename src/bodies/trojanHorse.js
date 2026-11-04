// 特洛伊木馬（body-trojan-horse，第八階段神話組・希臘；第九階段 iter-120 改成低趴楔形全罩）：
// 奔馬伸頸——馬頭與馬頸往前伸成鼻錐（中央隆起的頸脊從座艙前一路往前下降到口鼻，鼻尖離地約 15–19 mm），
// 頸脊上一列往後傾的鬃毛鰭（被風吹的動勢）、頭側一對往後貼的耳、琥珀色發光眼與青銅口勒貼紙；
// 車身是木板拼成的曲面全罩：前後輪拱外擴、肩線（腰線稜）＋下半內收（tumblehome），座艙是小的青銅色艙蓋（士兵艙口）；
// 黑繪陶 livery：黑色頸脊／背脊中線條＋從鼻尖往後上掃的赭紅側條（黑細邊），側面一列沿條紋斜向排列的圓形舷窗（米科諾斯陶甕木馬的側窗）；
// 車尾是馬尾形的貼身尾翼（尾毛分岔的平面形），由往後傾的尾根支柱撐起。
// 四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-trojan-horse/DESIGN.md（MYTH_RESEARCH G1、G2）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：淺 / 中橡木＋深胡桃木（霧面）＋黑繪陶黑與赭紅（霧面）＋青銅（金屬）；不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）；iter-120：車尾 −70、口鼻 79 */
const XS = [-70, -64, -56, -48, -40, -30, -20, -8, 4, 14, 24, 34, 42, 50, 54, 58, 64, 70, 75, 79];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂（頸脊 / 座艙 / 背脊）：口鼻 19.5 → 額頭往後上升到頭頂（poll，x 58，32.6）→ 頸根下凹（x 50，30.8，馬頭側影）→ 頸脊往後上升 → 座艙頂 41.5（x −8）→ 背脊往車尾降到 32
  yN: monoCurve(XS, [32, 35, 37, 37.8, 38.4, 39.5, 41, 41.5, 40.8, 39, 36.8, 35.2, 34, 31.4, 32, 32.6, 29.8, 25.8, 22.4, 19.5]),
  // 擋泥板 / 甲板高度（頸脊兩側）：前後輪上方 ≥ 32（R17.5 輪拱頂 30.5），往口鼻降到 17.5
  yD: monoCurve(XS, [30, 32.5, 33.6, 33.8, 33.8, 32.8, 32, 31.5, 31.2, 31.2, 31.8, 33.2, 33.4, 30.8, 28.6, 26, 23, 20.8, 19, 17.5]),
  // 頸脊 / 座艙半寬：座艙 13（約車寬 35%）、頸 9、口鼻 4.5
  nw: monoCurve(XS, [6, 7, 8, 9, 10, 11.5, 12.5, 13, 12.5, 11, 9.5, 9, 9, 8.2, 9, 9.6, 9, 7.5, 6, 4.5]),
  // 半寬（腰線稜）：前輪拱外擴 36.8（iter-122：包住輪胎外緣 34.25，到 x 54 仍 35.7）、後輪拱外擴 37.4（馬的後臀）、腰收 31.2、x 54 以後收成細長馬頭鼻錐（22.5 → 7）、後輪拱後方收尖（29 → 12）
  hw: monoCurve(XS, [10, 17, 27.5, 37, 37.4, 35.4, 32.4, 31.4, 31.2, 32.2, 35.2, 36.8, 36.8, 36.4, 35.7, 18.5, 14, 11, 8.5, 6]),
  // 側裙下緣：兩輪之間 10.5（底盤側框頂 9.4 之上，包住電池艙側面）、口鼻 15
  yLow: monoCurve(XS, [21, 18.5, 15.5, 13.5, 13, 11.5, 10.5, 10.5, 10.5, 10.5, 11, 13, 13, 13.5, 14, 14.5, 15, 15, 15, 15]),
};

/**
 * 半剖面 8 點：中線頂 → 頸脊肩 → 頸脊側 → 擋泥板頂 → 肩 → 腰線稜（銳利，最寬處）→ 側面 → 下緣內收
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yN = P.yN(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const yD = Math.min(P.yD(x), yN - 0.3);
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
const COCKPIT_X = [-26, 8];

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

/** @type {(x: number, z: number) => boolean} 頸脊 / 座艙 / 背脊（中線隆起段） */
const onCrest = (x, z) => Math.abs(z) < Math.min(P.nw(x), P.hw(x) - 7, 0.55 * P.hw(x)) + 0.5;
/** @type {(x: number, z: number) => boolean} 側面（肩以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - Math.min(4, 0.3 * (P.hw(x) - P.nw(x))) - 0.6;

/**
 * 腹側裙板（iter-115：評審「側面電池管外露 → 比照 longship、kunpeng 加側裙或腹板包住」）：前後輪拱之間每側一組 L 形實心板——
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
 * 斜腹板（iter-115）：前後輪拱之間每側一片往外下斜的實心板——上緣埋進殼側壁（|z| zIn、y yTop），下緣到底盤側框外緣上方（|z| zOut、y yBot），
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
  // 黑繪陶的黑釉（霧面略帶光澤）
  // iter-122：黑繪陶的黑釉當上半車身主色（帶光澤的釉面）
  slip: namedMaterial('paint-slip-black', { color: 0x16110e, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.2 }),
  slip2: namedMaterial('paint-slip-black', { color: 0x16110e, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
  // 陶甕赭紅（霧面陶土）
  terracotta: namedMaterial('paint-terracotta-ochre', { color: 0xb04a2a, roughness: 0.66, clearcoat: 0.05 }),
  // 青銅（真金屬：名稱含 -brass）：座艙艙蓋、尾翼
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb07a3c, roughness: 0.3, metalness: 0.8, clearcoat: 0.25 }),
  bronze2: namedMaterial('trim-bronze-brass', { color: 0xb07a3c, roughness: 0.3, metalness: 0.8, clearcoat: 0.25, side: THREE.DoubleSide }),
  // 眼：琥珀色自發光（炫砲手法 5）
  eye: namedMaterial('lamp-eye-amber', { color: 0xffb347, emissive: 0xff8a1a, emissiveIntensity: 0.55, roughness: 0.1, clearcoat: 1.0 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-walnut', { color: 0x4a2f1b, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-walnut', { color: 0x3a2516, roughness: 0.8, side: THREE.DoubleSide }),
  dGroove: decalMaterial('decal-walnut-groove', { color: 0x2c1b0f, roughness: 0.8 }),
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
  theme: '奔馬伸頸的低趴楔形全罩（iter-122）：鼻端是看得出的馬頭側影（立耳、頭頂到口鼻的落差、頸根下凹）、頸脊上 3 綹往後飄的長鬃（赭紅刻線毛流）；黑繪陶配色——黑釉上半車身＋從鼻尖往後上掃的赭紅下半車身（青銅分割細線），木紋只當刻線紋理、木質士兵艙蓋；斜排舷窗、腰部斜裙；貼身的寬扇形馬尾翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 腰線稜（5）是唯一的銳利稜線，其餘平滑
  hard: [5],
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    // 木質士兵艙蓋（座艙：淺橡木，全車唯一的大面積木作，木紋當紋理）
    { mat: 'oak', keep: (x, y, z) => (onCrest(x, z) ? Math.min(x - COCKPIT_X[0], COCKPIT_X[1] - x) : -1) },
    // 黑繪陶黑：頸脊 / 馬頭 / 背脊
    { mat: 'slip', keep: (x, y, z) => (onCrest(x, z) ? 1 : -1) },
    // iter-122：赭紅陶土下半車身（黑繪陶的「黑底＋赭紅大面積分割」），分割線從鼻尖往後上掃
    { mat: 'terracotta', keep: (x, y) => Math.min(stripeY(x) + STRIPE_HW - y, y - 13.4) },
    // 黑釉上半車身與下緣（側裙）
    { mat: 'slip', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'slip', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 鬃毛片（iter-122：評審「鋸齒像拉鍊」→ 改成 3 綹往後飄的長鬃）：頸脊中線 x 56 → 17，每綹前緣低、往後拉長到尖端，
    //    綹與綹之間只淺淺分開（厚 1.4，高 2.2 → 3.8 mm），根部埋進殼面 1 mm；毛流用赭紅刻線貼紙畫在頸側 ──
    {
      /** @type {(x: number, h: number) => number[]} 頸脊上 x 處高 h 的點 */
      const at = (x, h) => [x, top(x, 0) + h];
      const pts = [
        at(56.5, -1), at(56, 1.0), at(52, 2.2), at(47, 3.0), at(43.2, 3.6), at(44.6, 2.2),
        at(39, 3.0), at(33.6, 3.8), at(35.2, 2.2), at(29, 2.8), at(22.4, 3.4), at(19.4, 2.4), at(17.6, 0.6), at(17.6, -1),
      ];
      parts.push({ geometry: finPlate(pts.reverse(), 0, 1.4), mat: 'slip2', solid: true, outline: true, name: 'horse-mane-locks' });
    }
    // ── 耳朵（iter-122：評審「要立起來」）：頭頂（poll，x 57–61）一對立耳，高 5 mm、略往後傾、往外張 10° ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const ears = [];
      for (const sg of [-1, 1]) {
        const zc = sg * 4.8;
        const yb = top(59, 4.8);
        ears.push(finPlate([[61, yb - 1], [60.4, yb + 2.6], [58.4, yb + 5.2], [57.4, yb + 4.6], [57, yb - 1]], zc, 1.5, sg * -10));
      }
      parts.push({ geometry: mergeGeos(ears), mat: 'slip2', solid: true, outline: true, name: 'horse-ears' });
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

    // ── 馬尾尾翼：往後傾的尾根支柱＋尾毛分岔的平面尾翼（貼身：翼頂 44.4，比座艙頂高 2.9） ──
    {
      // iter-122：尾翼降低到翼頂 ≈ 座艙頂（41.2）、加厚 2.0，尾根支柱加粗成貼身的尾根塊
      const yWing = 39.2;
      const ys = top(-57, 0);
      parts.push({
        geometry: finPlate([[-53, ys - 1.2], [-58, ys - 1.2], [-66, yWing + 0.6], [-59.4, yWing + 0.6]], 0, 2.6),
        mat: 'slip2',
        solid: true,
        outline: true,
        name: 'horse-tail-stalk',
      });
      /** @type {number[][]} 半邊尾翼平面（x, z）：iter-122 展開成寬扇形馬尾（前緣後掠、後緣三岔尾毛） */
      const half = [[-58.6, 0], [-59.8, 12], [-62.2, 26], [-65.4, 38], [-69.8, 45.6], [-71.8, 44.2], [-71.2, 33], [-69.8, 24], [-71.6, 16], [-70.6, 8], [-71.4, 0]];
      const outline = [...half, ...half.slice(1, -1).reverse().map(([x, z]) => [x, -z])];
      parts.push({ geometry: flatPlate(outline, yWing, 2.0), mat: 'slip2', solid: true, outline: true, name: 'horse-tail-wing' });
    }

    // iter-122 腹側斜裙（評審「腰部露底盤」）：前後輪之間每側一片往外下斜的實心板（buildSlantSkirt），上緣埋進殼側壁、下緣到 |z| 33.2、y 10.5
    parts.push({ geometry: buildSlantSkirt({ x0: -21.5, x1: 21.5, zIn: 28, zOut: 33.2, yTop: 19 }), mat: 'slip', solid: true, outline: true, name: 'belly-skirt' });
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
    // 木板接縫（iter-122：木紋只當紋理）：黑釉面上是赭紅刻線（黑繪陶刻線技法），赭紅面上是黑線；側面沿分割線方向（往後上斜）每 4.2 mm 一道，
    // 擋泥板頂面沿半寬比例（往鼻尖、車尾收攏）
    /** @type {(x: number, y: number, z: number) => number} 接縫距離函式（正值 = 在縫上） */
    const seam = (x, y, z) => {
      if (onCrest(x, z) || y < 13.6) {
        return -1;
      }
      if (onSide(x, z)) {
        const q = (y - stripeY(x) - STRIPE_HW) / 4.2;
        return Math.min(0.28 - Math.abs(q - Math.round(q)) * 4.2, Math.abs(y - stripeY(x) - STRIPE_HW) - 0.8);
      }
      const f = Math.abs(z) / P.hw(x);
      return 0.28 - Math.min(Math.abs(f - 0.55), Math.abs(f - 0.75)) * P.hw(x);
    };
    /** @type {(x: number, y: number) => boolean} 在赭紅下半車身 */
    const onRed = (x, y) => y < stripeY(x) + STRIPE_HW && y > 13.4;
    parts.push({ geometry: kit.decal((x, y, z) => (onRed(x, y) ? -1 : seam(x, y, z))), mat: 'dIncise', name: 'decal-plank-incisions' });
    parts.push({ geometry: kit.decal((x, y, z) => (onRed(x, y) ? seam(x, y, z) : -1)), mat: 'dSlip', name: 'decal-plank-seams' });
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
    // 黑 / 赭紅分割線上的青銅細線（0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => (onCrest(x, z) ? -1 : 0.35 - Math.abs(y - stripeY(x) - STRIPE_HW)), { offset: 0.1 }),
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
    // 青銅鉚釘點列：赭紅側條上緣上方一列（每 3.2 mm，直徑 0.9），避開輪拱與舷窗
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 56 || x < -64) {
          return -1;
        }
        const ph = ((x % 3.2) + 3.2) % 3.2;
        const du = Math.min(ph, 3.2 - ph);
        return Math.min(0.45 - Math.hypot(du, y - (stripeY(x) - STRIPE_HW - 1.6)), archRingDist(x, y) - 1.6);
      }, { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-rivets',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，iter-122）：殼 x −70 → 79、尾翼後緣 −71.8（外框長 150.8 ≤ 153，SPEC 1.14a）；口鼻頂 19.5、頭頂 32.6（x 58）、耳尖約 37.8、頸根 31.4、座艙頂 41.5、尾翼頂 41.2；半寬：前輪拱 36.8（到 x 54 仍 35.7，包住輪胎外緣 34.25）、腰 31.2＋斜裙 33.2、後輪拱 37.4、馬頭 18.5 → 6、尾翼 ±45.6（≤ 48.0）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯用 buildProfileLiner（沿剖面反查殼內面）',
    windows: '舷窗：米科諾斯島浮雕陶甕木馬側面的舷窗（MYTH_RESEARCH G2）；本款 5 個 φ3.4 mm 圓窗貼紙沿側條斜排（數量與尺寸自訂）',
    headNeck: '馬頸、馬頭是殼面的一部分（中央隆起的頸脊）；鬃毛鰭、耳、眼、尾根支柱、尾翼為實心 ABS 件（厚 1.3–2.2 mm），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 只複製既有欄位：神話組分組欄位（mythSeries / mythTheme）在這裡補進 BodyDef
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const trojanHorseBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
