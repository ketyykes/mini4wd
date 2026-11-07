// 特洛伊木馬（body-trojan-horse，神話組・希臘）——照四視圖 28 建模的多稜面攻城木器：低鼻 → 高聳的前擋泥板肩甲夾著凹谷引擎蓋 → 高而多稜的煙燻座艙 → 平寬後甲板 → 鋸齒背鰭接上車尾中央直立單鰭與左右短 T 翼。
// 不做馬頭，木馬只用木作、青銅、希臘紋樣與「鬃」的抽象：
// 鬃 → 鋸齒背鰭：後甲板中線 4 齒往車尾升高的鋸齒鰭（青銅鑲邊＋胡桃木鰭心），接上貼著車尾的直立單鰭，鰭兩側各一片青銅短 T 翼；鼻部前緣一排青銅鋸齒，車頭下緣一條 W 形青銅鋸條。
// 木板拼接 → 每一個稜面就是一塊木板：淺橡木與中橡木交錯的大面板、面板之間是青銅接縫與鉚釘列；折線切面描橘線。
// 希臘紋樣 → 兩輪之間側裙上的青銅回紋鑲條、車尾下半車身的青銅回紋帶。
// 藏兵 → 橡木側帶上一排五面圓盾（盾內透出琥珀色火光、青銅盾緣）。
// 配色：橡木為主（肩甲與側面）、深胡桃木為圖形色（引擎蓋凹谷到後甲板的中央帶、下半車身、側裙）、青銅為金屬點綴、橘色描線與琥珀色火光少量。
// 四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-trojan-horse/DESIGN.md（MYTH_RESEARCH G1、G2）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：橡木（霧面）＋深胡桃木（霧面）＋青銅（金屬）＋橘色描線＋琥珀色火光；不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, buildArchLiner } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

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

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）；車尾 −70、鼻尖 77 */
const XS = [-70, -64, -56, -48, -40, -30, -20, -10, 0, 10, 20, 30, 40, 48, 56, 62, 68, 73, 77];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線甲板（不含座艙）：平寬後甲板 34 → 引擎蓋凹谷 27.2（前輪處，比擋泥板低 8）→ 鼻尖 16.6
  yHood: monoCurve(XS, [30.4, 32.4, 33.6, 34, 34, 33.6, 33, 32.6, 32.2, 30.8, 29.2, 28, 27.2, 26, 23.6, 21.4, 19.4, 17.8, 16.6]),
  // 擋泥板稜：高聳的前輪肩甲 35.6（比引擎蓋凹谷高 8）、後輪 36，兩輪之間 30.4
  yD: monoCurve(XS, [29.6, 33.4, 35.6, 36, 36, 34.4, 31.6, 30.4, 30.4, 31.4, 33.4, 35.2, 35.6, 35, 32.4, 28.6, 24.8, 21.8, 19.4]),
  // 半寬：車尾收成船尾形 18、後輪 39.4、腰 21（座艙段深收腰）、前輪 36.6，過了前輪先收細（x 62 半寬 17.6）再外擴成寬 39 的攻城槌頭（前緣是青銅鋸齒）
  hw: monoCurve(XS, [18, 28, 37.6, 39.4, 39.4, 34, 24.6, 21.4, 21, 21.8, 28, 35, 36.6, 36.4, 30, 17.6, 19, 19.4, 18]),
  yLow: monoCurve(XS, [22, 19.6, 15, 13, 13, 13, 14.6, 15.6, 15.6, 15.6, 14.4, 13, 13, 13.5, 14, 14.4, 14.8, 15, 15]),
};

/** @type {number[]} 座艙前後端 x */
const CAN_X = [-22, 30];
/** @type {(x: number) => number} */
const canRaw = monoCurve([-22, -14, -4, 6, 16, 24, 30], [0, 6, 9.6, 9.8, 7.2, 3.4, 0]);
/** @type {(x: number) => number} 座艙高出甲板的量（頂 ≈ 42） */
const canH = (x) => (x <= CAN_X[0] || x >= CAN_X[1] ? 0 : Math.max(0, canRaw(x)));
/** @type {(x: number) => number} 座艙半寬 */
const canW = monoCurve([-22, -12, 0, 14, 24, 30], [6, 10.4, 11.6, 10.2, 7, 4]);
/** @type {(x: number) => number} 實際座艙半寬（不超過擋泥板內側） */
const cabW = (x) => Math.max(0.3, Math.min(canW(x), P.hw(x) - 9, 0.5 * P.hw(x)));

/** @type {(x: number) => number} 腰線稜高度 */
const beltY = (x) => P.yD(x) - Math.min(4.6, 0.42 * (P.yD(x) - P.yLow(x)));

/**
 * 半剖面 8 點（折線、每點都是稜線）：中線 → 座艙肩 → 座艙底緣 → 引擎蓋斜面 → 擋泥板稜 → 腰線稜（最寬）→ 下半側面內收 → 下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yc = P.yHood(x);
  const h = canH(x);
  const hw = P.hw(x);
  const cw = cabW(x);
  const yD = P.yD(x);
  const yLow = P.yLow(x);
  const yBelt = beltY(x);
  const sh = Math.min(4.2, 0.28 * (hw - cw));
  return [
    [0, yc + h],
    [0.6 * cw, yc + 0.84 * h],
    [cw, yc + 0.05 * h],
    [cw + 0.45 * (hw - sh - cw), lerp(yc, yD, 0.42)],
    [hw - sh, yD],
    [hw, yBelt],
    [hw - 1.4, lerp(yBelt, yLow, 0.5)],
    [hw - 2.4, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 每 2 mm 一站 */
const STATIONS = buildStations(-70, 77, 2, profile);

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 在座艙上 */
const onCanopy = (x, z) => canH(x) > 0.5 && Math.abs(z) < cabW(x) - 0.3;
/** @type {(x: number, z: number) => boolean} 側面（腰線稜附近以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 3;
/** @type {(x: number, z: number) => boolean} 擋泥板肩甲頂面（引擎蓋斜面以外、側面以上） */
const onFender = (x, z) => !onSide(x, z) && Math.abs(z) > cabW(x) + 0.45 * (P.hw(x) - Math.min(4.2, 0.28 * (P.hw(x) - cabW(x))) - cabW(x));

/** @type {(x: number) => number} 深胡桃木下半車身上緣：鼻尖 17 往後上掃到車尾 27（沿腰線稜下方） */
const darkTopY = (x) => Math.min(beltY(x) - 0.8, lerp(17, 27, Math.min(1, Math.max(0, (77 - x) / 147))));

/** @type {number[][]} 鋸齒背鰭的齒尖 [x, y]（往車尾升高） */
const TEETH = [
  [-26, 39.4],
  [-35, 41.4],
  [-44, 43.4],
  [-53, 45.4],
];
/** @type {number} 鰭厚 */
const FIN_T = 1.2;
/** @type {{ x0: number, x1: number, y: number, halfSpan: number, t: number }} 車尾中央直立單鰭兩側的青銅短 T 翼 */
const TWING = { x0: -58, x1: -68, y: 43.4, halfSpan: 16, t: 0.9 };
/** @type {number[]} 側面圓盾列（藏兵的舷窗）的 x */
const PORT_XS = [-14, -7, 0, 7, 14];
/** @type {number} 圓盾半徑 */
const PORT_R = 1.9;
/** @type {number[][]} 回紋一個週期內的折線段（u 沿 x、v 帶內高度；週期 7、高 4） */
const KEY = [
  [0, 0, 7, 0],
  [0.8, 0, 0.8, 4],
  [0.8, 4, 5.2, 4],
  [5.2, 4, 5.2, 1.6],
  [5.2, 1.6, 3, 1.6],
  [0, 5.4, 7, 5.4],
];

/** @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number} 線段距離 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 木作：霧面（roughness 0.6–0.72、幾乎無清漆）；淺橡木與中橡木交錯成木板
  oak: namedMaterial('paint-oak-light', { color: 0xbb8e5c, roughness: 0.62, clearcoat: 0.06 }),
  oakMid: namedMaterial('paint-oak-mid', { color: 0xa87742, roughness: 0.64, clearcoat: 0.06 }),
  walnut: namedMaterial('paint-walnut-dark', { color: 0x3a2214, roughness: 0.7, clearcoat: 0.04 }),
  walnut2: namedMaterial('paint-walnut-dark', { color: 0x3a2214, roughness: 0.7, clearcoat: 0.04, side: THREE.DoubleSide }),
  // 青銅（真金屬：名稱以 -brass 結尾）
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb8823e, metalness: 0.8, roughness: 0.3, clearcoat: 0.3 }),
  bronze2: namedMaterial('trim-bronze-brass', { color: 0xb8823e, metalness: 0.8, roughness: 0.3, clearcoat: 0.3, side: THREE.DoubleSide }),
  canopy: namedMaterial('pc-smoke-tint', { color: 0x1e1612, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-walnut', { color: 0x3a2214, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-walnut', { color: 0x2c1a0f, roughness: 0.8, side: THREE.DoubleSide }),
  dSeam: decalMaterial('decal-plank-seam-walnut', { color: 0x6a4424, roughness: 0.8 }),
  dDark: decalMaterial('decal-walnut-vent', { color: 0x140c07, roughness: 0.8 }),
  dBronze: decalMaterial('decal-bronze', { color: 0xc48c44, roughness: 0.32, metalness: 0.75 }),
  dRivet: decalMaterial('decal-bronze-rivet', { color: 0x5e3d1c, roughness: 0.4, metalness: 0.6 }),
  dOrange: decalMaterial('decal-orange-line', { color: 0xff7a1e, emissive: 0xff5a00, emissiveIntensity: 0.35, roughness: 0.35 }),
  dGlow: decalMaterial('decal-amber-glow', { color: 0xffb347, emissive: 0xff8a1a, emissiveIntensity: 0.6, roughness: 0.3 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {number[]} 木板分段的 x 接縫（擋泥板肩甲與引擎蓋上，淺 / 中橡木交錯） */
const PLANK_XS = [-56, -40, -24, 30, 46, 60];
/** @type {(x: number) => number} 第幾塊木板（x 由後往前） */
const plankIndex = (x) => PLANK_XS.filter((px) => x > px).length;

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-trojan-horse',
  name: '特洛伊木馬',
  style: 'myth',
  phase: 8,
  mythSeries: 'greek',
  mythTheme: 'trojan-horse',
  form: 'plank-facet-pods',
  roof: 'canopy',
  wing: 'saw-fin-tbar',
  theme: '照四視圖 28 的多稜面攻城木器：低鼻、高聳的前擋泥板肩甲夾著凹谷引擎蓋、高而多稜的煙燻座艙、平寬後甲板；鬃抽象成 4 齒鋸齒背鰭（青銅鑲邊＋胡桃木鰭心）接上車尾中央直立單鰭與左右青銅短 T 翼，鼻部前緣一排青銅鋸齒、車頭下緣 W 形青銅鋸條；每個稜面是一塊淺 / 中橡木交錯的木板，接縫是青銅細線與鉚釘列，折線切面描橘線；橡木側帶上一排五面透出琥珀色火光的圓盾，兩輪之間胡桃木側裙上的青銅回紋鑲條',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格放寬到 0.6 mm（維持面數與碰撞格耗時）
  step: 0.6,
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    { mat: 'canopy', keep: (x, y, z) => (onCanopy(x, z) ? 1 : -1) },
    // 深胡桃木下半車身
    { mat: 'walnut', keep: (x, y, z) => (onSide(x, z) ? darkTopY(x) - y : -1) },
    // 擋泥板肩甲：淺 / 中橡木交錯的木板
    { mat: 'oakMid', keep: (x, y, z) => (onFender(x, z) && plankIndex(x) % 2 === 1 ? 1 : -1) },
    // 引擎蓋凹谷與後甲板中段：深胡桃木中央帶（夾在橡木肩甲之間）
    { mat: 'walnut', keep: (x, y, z) => (!onSide(x, z) && !onFender(x, z) && x < 70 ? 1 : -1) },
    { mat: 'oak', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'bronze' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'walnut', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 鬃 → 鋸齒背鰭（x −20 → −56，4 齒往車尾升高、齒尖往後勾）接上車尾中央直立單鰭（頂 46.8）；青銅鑲邊＋胡桃木鰭心 ──
    {
      /** @type {number[][]} 鑲邊外形：前端根部 → 鋸齒上緣 → 直立單鰭頂 → 後緣 → 沿鰭心上緣回到前端 */
      const rim = [[-19, top(-19, 0) - 1], [-20, top(-20, 0) + 1.8]];
      TEETH.forEach(([tx, ty]) => {
        rim.push([tx, ty], [tx + 3.2, ty - 4.4]);
      });
      rim.push([-58, 46.8], [-67.6, 46.8], [-69.4, top(-69, 0) - 1]);
      /** @type {number[][]} 鰭心：鋸齒連線往下 4.6 mm */
      const core = [[-27, top(-27, 0) - 1], [-29, 35.2], [-56, 41.4], [-64.6, 41.8], [-66, top(-66, 0) - 1]];
      rim.push(...core.slice().reverse());
      parts.push({ geometry: finPlate(rim, 0, FIN_T), mat: 'bronze2', solid: true, outline: true, name: 'saw-fin-rim' });
      parts.push({ geometry: finPlate(core, 0, FIN_T), mat: 'walnut2', solid: true, outline: true, name: 'saw-fin-core' });
      // 直立單鰭加厚段（厚 2.6，貼著車尾）
      parts.push({
        geometry: finPlate([[-57, top(-57, 0) - 1], [-58.6, 45.4], [-67, 45.6], [-68.6, top(-68.6, 0) - 1]], 0, 2.6),
        mat: 'walnut2',
        solid: true,
        outline: true,
        name: 'tail-fin-body',
      });
      // 單鰭兩側的青銅短 T 翼：後掠梯形平板（翼展 32），兩端小翼端板
      const { x0, x1, y, halfSpan, t } = TWING;
      /** @type {THREE.BufferGeometry[]} */
      const wing = [flatPlate([[x0, 0], [x0 - 4, halfSpan], [x1, halfSpan], [x1, -halfSpan], [x0 - 4, -halfSpan]], y, t)];
      for (const sg of [-1, 1]) {
        wing.push(finPlate([[x0 - 4, y + t + 1.2], [x1, y + t + 1.2], [x1, y - 2.4], [x1 + 3, y - 2.6]], sg * (halfSpan - 0.5), 1.0));
      }
      parts.push({ geometry: mergeGeos(wing), mat: 'bronze2', solid: true, outline: true, name: 'bronze-t-wing' });
    }

    // ── 側裙：兩輪之間的直立外板（|z| 36.9 → 37.4、y 10.5 → 21），從側面擋住底盤側框與電池艙；中央一根橫撐接回收腰的側壁（深胡桃木）
    //    外板兩端不接殼面，收腰在俯視上仍看得出來；外板上一條青銅回紋鑲條（週期 7、高 5.4） ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const skirt = [];
      for (const sg of [-1, 1]) {
        skirt.push(finPlate([[-21, 21], [-21, 12], [-19.5, 10.5], [19.5, 10.5], [21, 12], [21, 21]], sg * 37.15, 0.5));
        const zIn = P.hw(0) - 1.2;
        const strut = new THREE.BoxGeometry(1.6, 0.8, 37.2 - zIn);
        strut.translate(0, 20.4, sg * (zIn + 37.2) / 2);
        skirt.push(strut);
      }
      parts.push({ geometry: mergeGeos(skirt), mat: 'walnut2', solid: true, outline: true, name: 'side-skirts' });
    }
    {
      /** @type {THREE.BufferGeometry[]} */
      const inlay = [];
      for (const sg of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          const u0 = -21 + k * 7;
          for (const [ax, ay, bx, by] of KEY) {
            const len = Math.hypot(bx - ax, by - ay) + 0.7;
            const g = new THREE.BoxGeometry(bx !== ax ? len : 0.7, by !== ay ? len : 0.7, 0.3);
            g.translate(u0 + (ax + bx) / 2, 13.2 + (ay + by) / 2, sg * 37.5);
            inlay.push(g);
          }
        }
      }
      parts.push({ geometry: mergeGeos(inlay), mat: 'bronze', solid: true, name: 'skirt-meander-inlay' });
    }

    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos([buildArchLiner(ARCHES[0], 21, 33.4, 0.35, Math.PI - 0.35), buildArchLiner(ARCHES[1], 21, 34, 0.35, Math.PI - 0.35)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });

    // ── 貼紙 ──
    // 鼻部前緣的青銅鋸齒：從鼻尖往後 9 mm 內是青銅，後緣切成 5 個往後的三角齒（俯視是鋸齒鼻）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 62 || onSide(x, z) && y < darkTopY(x)) {
          return -1;
        }
        const ph = Math.abs(((Math.abs(z) + 2.4) % 4.8) - 2.4) / 2.4;
        const edge = 77 - x - 3.4 - 5.6 * (1 - ph);
        return Math.min(-edge, 76.6 - x + 3);
      }),
      mat: 'dBronze',
      name: 'decal-saw-nose',
    });
    // 木板接縫：橡木肩甲上沿 x 的縱向細縫（每 4.6 mm）＋木板分段的橫向青銅接縫
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onCanopy(x, z) || onSide(x, z) || x > 62 || x < -68) {
          return -1;
        }
        const q = Math.abs(z) / 4.6;
        return Math.min(0.32 - Math.abs(q - Math.round(q)) * 4.6, onFender(x, z) ? 1 : -1);
      }),
      mat: 'dSeam',
      name: 'decal-plank-seams',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onCanopy(x, z) || (onSide(x, z) && y < darkTopY(x) + 0.4)) {
          return -1;
        }
        const d = Math.min(...PLANK_XS.map((px) => Math.abs(x - px)));
        return Math.min(0.45 - d, archRingDist(x, y) - 0.6);
      }, { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-plank-joints',
    });
    // 鉚釘：每道青銅接縫兩側沿剖面每 3.4 mm 一顆
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onCanopy(x, z) || (onSide(x, z) && y < darkTopY(x) + 0.8) || archRingDist(x, y) < 1) {
          return -1;
        }
        const s = Math.abs(z) - y;
        const ph = ((s % 3.4) + 3.4) % 3.4;
        const d = Math.min(...PLANK_XS.map((px) => Math.abs(Math.abs(x - px) - 1.3)));
        return 0.48 - Math.hypot(d, Math.min(ph, 3.4 - ph));
      }, { offset: 0.14 }),
      mat: 'dRivet',
      name: 'decal-rivets',
    });
    // 折線切面描線（四視圖的橘色描線）：下半車身分割線＋座艙框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const split = onSide(x, z) && x < 76 ? Math.min(0.35 - Math.abs(y - darkTopY(x)), archRingDist(x, y) - 0.5) : -1;
        const frame = canH(x) > 0.5 ? 0.5 - Math.abs(Math.abs(z) - cabW(x) - 0.45) : -1;
        return Math.max(split, frame);
      }, { offset: 0.1 }),
      mat: 'dOrange',
      name: 'decal-orange-lines',
    });
    // 深胡桃木下半車身上的青銅回紋帶（希臘陶甕的回紋）：沿分割線下方，週期 7 mm、高 4 mm，上下各一條邊線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 60 || x < -66) {
          return -1;
        }
        const v = y - (darkTopY(x) - 7.8);
        if (v < -1 || v > 6.4) {
          return -1;
        }
        const u = ((x % 7) + 7) % 7;
        const d = Math.min(...KEY.map(([ax, ay, bx, by]) => segDist(u, v, ax, ay, bx, by)));
        return Math.min(0.38 - d, archRingDist(x, y) - 1.0, y - 13.4);
      }, { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-meander-frieze',
    });
    // 橡木側帶上的一排圓盾（藏兵的舷窗）：盾內透出琥珀色火光＋青銅盾緣
    /** @type {(x: number) => number} 圓盾中心高度（分割線上方 3.2 mm） */
    const portY = (x) => darkTopY(x) + 3.2;
    /** @type {(x: number, y: number) => number} 到最近圓盾中心的距離 */
    const portDist = (x, y) => Math.min(...PORT_XS.map((px) => Math.hypot(x - px, y - portY(px))));
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) && Math.abs(x) < 18 ? PORT_R - portDist(x, y) : -1), { offset: 0.12 }),
      mat: 'dGlow',
      name: 'decal-shield-row',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || Math.abs(x) > 18) {
          return -1;
        }
        const d = portDist(x, y);
        return Math.min(d - PORT_R + 0.05, PORT_R + 0.7 - d);
      }, { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-shield-rims',
    });
    // 車頭下緣一排 W 形鋸齒（正視是一條鋸條）：前段（x > 46）下緣以上的青銅鋸齒帶，齒峰上緣描橘線
    /** @type {(x: number, z: number) => number} 鋸齒上緣高度（週期 6 mm、齒高 3） */
    const sawTop = (x, z) => {
      const ph = Math.abs(((Math.abs(z) % 6) + 6) % 6 - 3) / 3;
      return P.yLow(x) + 1.6 + 3 * ph;
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (x < 46 || archRingDist(x, y) < 0.6 ? -1 : sawTop(x, z) - y), { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-front-saw',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (x < 46 || archRingDist(x, y) < 0.6 ? -1 : 0.35 - Math.abs(y - sawTop(x, z))), { offset: 0.12 }),
      mat: 'dOrange',
      name: 'decal-front-saw-line',
    });
    // 頭燈：前擋泥板肩甲前端一對往鼻根斜收的琥珀色斜縫
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) || onCanopy(x, z) ? -1 : 0.7 - segDist(x, Math.abs(z), 52, 28, 59, 21)), { offset: 0.14 }),
      mat: 'dGlow',
      name: 'decal-slit-lamps',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，比例照四視圖 28）：殼 x −70 → 77；中線甲板 後甲板 34 → 引擎蓋凹谷 27.2（x 40）→ 鼻尖 16.6；座艙高出甲板 9.8（頂 ≈ 42）；擋泥板稜 前輪 35.6、後輪 36、腰 30.4；半寬 車尾 18、後輪 39.4、腰 21、前輪 36.6、攻城槌頸 17.6、槌頭 19.4；折線剖面（每點都是稜線）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯用 gazelle 的 buildArchLiner',
    crestWing: '鋸齒背鰭（厚 1.2 mm，4 齒 39.4 → 45.4，青銅鑲邊與胡桃木鰭心兩片同厚）、車尾中央直立單鰭（頂 46.8，加厚段 2.6）、青銅短 T 翼（厚 0.9、翼展 32）與小翼端板（厚 1.0）、側裙外板（厚 0.5）與中央橫撐、青銅回紋鑲條（厚 0.3）為實心 ABS 件，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 只複製既有欄位：神話組分組欄位（mythSeries / mythTheme）在這裡補進 BodyDef
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const trojanHorseBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
