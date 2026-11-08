// 特洛伊木馬（body-trojan-horse，神話組・希臘）——F2 擋泥板肌肉型「攻城木器」：不做馬頭，木馬用木作、青銅與藏兵的元素表現。
// 側視：前低後高的楔形——青銅包頭的攻城槌樑鼻（鼻尖頂 17.8）→ 前輪擋泥板 33 → 活板門艙蓋 34.6 → 後輪擋泥板 35.4，
// 中段大幅收腰（半寬 24.4）；前後擋泥板都比中線高，引擎蓋與臀脊是夾在擋泥板之間的凹谷。
// 鬃 → 鋸齒背鰭：從活板門後緣沿臀脊一路升到車尾的鋸齒鰭（5 齒，齒尖往後勾；青銅鑲邊＋黑釉鰭心），同時是科林斯式頭盔的鬃冠；
// 鰭尾托著一片青銅翼刃（後掠梯形、翼面一條回紋鑲嵌、兩端小翼端板、左右各一支從後擋泥板長出的斜撐）。
// 藏兵：座艙是深胡桃木活板門，門縫一圈琥珀色火光；橡木肩帶上一排透出火光的圓舷窗（青銅窗框）；鼻側一對琥珀色斜縫頭燈。
// 木作：淺橡木木板車身（等距接縫）、3 道青銅鉚釘箍帶橫跨車身；中褐胡桃木下半車身上是青銅回紋與放射尖齒紋，分割線從鼻尖往後上掃。
// 四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-trojan-horse/DESIGN.md（MYTH_RESEARCH G1、G2）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：淺橡木＋中褐胡桃木（霧面）＋青銅（金屬）＋琥珀色火光；不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）；車尾 −70、鼻尖 77 */
const XS = [-70, -64, -56, -48, -40, -30, -20, -8, 4, 14, 24, 34, 42, 50, 56, 62, 68, 73, 77];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：臀脊 32.4（夾在兩塊後擋泥板之間）→ 活板門艙蓋 34.6（x 4）→ 引擎蓋一路往鼻尖降到 17.8（楔形）
  yN: monoCurve(XS, [26, 29, 31, 32, 32.4, 32.2, 32.6, 34, 34.6, 33.6, 32.2, 30.6, 29, 27, 25.2, 23.2, 21, 19.2, 17.8]),
  // 擋泥板頂：後輪 35.4（比臀脊高 3 mm）、收腰段掉到 26.6、前輪 33（比引擎蓋中線高 4 mm；R17.5 輪拱頂 30.5）、過了前輪併進鼻部
  yD: monoCurve(XS, [23, 29.4, 33.4, 35.2, 35.4, 33.2, 28.2, 26.6, 26.6, 27.8, 30.4, 32.8, 33, 30.4, 24.6, 22.4, 20.4, 18.7, 17.4]),
  // 中央脊 / 艙蓋半寬
  nw: monoCurve(XS, [5, 6, 7, 7.5, 8, 9, 10.5, 11.5, 11.5, 10.5, 9.5, 9, 9, 8.6, 8.4, 8, 7, 5.6, 4.4]),
  // 半寬：車尾收成船尾形（17）、後輪 39.6、腰 23.6（大幅收腰）、前輪 35.6（包住 31 mm 輪胎外緣），x 56 以後急收成一根攻城槌樑（16 → 9）
  hw: monoCurve(XS, [17, 27, 37.4, 39.6, 39.6, 34, 26, 23.6, 24.4, 29.6, 34.2, 35.6, 35.6, 35.2, 30, 16, 11.5, 10, 9]),
  // 側裙下緣：兩輪之間 10.5（底盤側框頂 9.4 之上，包住電池艙側面）、鼻部 15
  yLow: monoCurve(XS, [21, 18.5, 15.5, 13.5, 13, 11.5, 10.5, 10.5, 10.5, 10.5, 11, 13, 13, 13.5, 14.2, 14.6, 15, 15, 15]),
};

/** @type {(x: number) => number} 中央脊實際半寬（鼻尖與車尾收窄處不超過半寬的 0.55 倍） */
const crestHw = (x) => Math.max(0.6, Math.min(P.nw(x), P.hw(x) - 7, 0.55 * P.hw(x)));

/**
 * 半剖面 8 點：中線頂 → 中央脊肩 → 中央脊側 → 擋泥板頂 → 肩 → 腰線稜（銳利，最寬處）→ 側面 → 下緣內收
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yN = P.yN(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const yD = P.yD(x);
  const nw = crestHw(x);
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

/** @type {{ x: number, pts: number[][] }[]} 每 2 mm 一站 */
const STATIONS = buildStations(-70, 77, 2, profile);

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {number[]} 活板門艙蓋（座艙）前後端 x */
const HATCH_X = [-8, 16];
/** @type {number} 青銅包頭的後緣 x */
const RAM_X = 66;

/** @type {(x: number) => number} 腰線稜高度：擋泥板頂往下 min(4.5, 0.42 × (擋泥板頂 − 下緣))；它和擋泥板頂之間是橡木肩帶 */
const beltY = (x) => P.yD(x) - Math.min(4.5, 0.42 * (P.yD(x) - P.yLow(x)));
/** @type {(x: number) => number} 斜掃線中心高度：鼻尖 16.5 → 車尾 30（往後上掃），木板接縫與下半車身分割線都跟它平行 */
const stripeY = (x) => lerp(16.5, 30, Math.min(1, Math.max(0, (77 - x) / 140)));
/** @type {number} 斜掃線到分割線的距離 */
const STRIPE_HW = 2.8;

/** @type {number[]} 舷窗 x 中心（沿橡木肩帶排成一排） */
const PORT_XS = [-14, -7, 0, 7, 14];
/** @type {number} 舷窗半徑 */
const PORT_R = 1.7;
/** @type {(x: number) => number} 舷窗中心高度：橡木肩帶（腰線稜到擋泥板肩點）的中線，舷窗才會落在殼面上 */
const portY = (x) => 0.5 * (beltY(x) + P.yD(x) - 0.5);

/** @type {number[]} 青銅鉚釘箍帶的 x 位置（鼻根、活板門前、活板門後） */
const BAND_XS = [61, 22, -22];

/**
 * 深胡桃木下半車身的上緣：取「斜掃線上緣」與「腰線稜下 0.6 mm」較高者——
 * 兩輪之間腰線稜以下整片是深胡桃木＋青銅紋帶（腰線稜上方的橡木肩帶留給舷窗），往鼻尖沿斜掃線收低
 * @type {(x: number) => number}
 */
const darkTopY = (x) => Math.max(stripeY(x) + STRIPE_HW, beltY(x) - 0.6);

/** @type {(x: number, z: number) => boolean} 中央脊 / 艙蓋（中線段） */
const onCrest = (x, z) => Math.abs(z) < crestHw(x) + 0.5;
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

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 木作：霧面（roughness 0.62–0.72、幾乎無清漆）
  oak: namedMaterial('paint-oak-light', { color: 0xdcb886, roughness: 0.64, clearcoat: 0.05 }),
  walnut: namedMaterial('paint-walnut-dark', { color: 0x74471f, roughness: 0.7, clearcoat: 0.04 }),
  // 青銅（真金屬：名稱以 -brass 結尾，Blender 換成 metallic 1）：包頭、翼刃
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb8823e, metalness: 0.8, roughness: 0.3, clearcoat: 0.3 }),
  bronze2: namedMaterial('trim-bronze-brass', { color: 0xb8823e, metalness: 0.8, roughness: 0.3, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 鋸齒鬃鰭的鰭心：黑釉（帶光澤的釉面，和霧面木作做出對比）
  slip2: namedMaterial('paint-slip-black', { color: 0x16110e, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-walnut', { color: 0x74471f, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-walnut', { color: 0x2c1a0f, roughness: 0.8, side: THREE.DoubleSide }),
  dGroove: decalMaterial('decal-walnut-groove', { color: 0x1c1109, roughness: 0.8 }),
  // 木板接縫：深木色（不是黑），霧面
  dSeam: decalMaterial('decal-plank-seam-walnut', { color: 0x9a6b3c, roughness: 0.8 }),
  dBronze: decalMaterial('decal-bronze', { color: 0xc48c44, roughness: 0.32, metalness: 0.75 }),
  // 鉚釘頭：比箍帶深的青銅
  dRivet: decalMaterial('decal-bronze-rivet', { color: 0x5e3d1c, roughness: 0.4, metalness: 0.6 }),
  // 藏兵的火光：琥珀色自發光（強度低，Blender 不過曝）
  dGlow: decalMaterial('decal-amber-glow', { color: 0xffb347, emissive: 0xff8a1a, emissiveIntensity: 0.6, roughness: 0.3 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number} 線段距離 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** @type {number[][]} 鋸齒鬃鰭的齒尖 [x, y] 與齒後缺口深度：齒尖沿一條往車尾升高的直線排列，越往後齒越大 */
const TEETH = [
  [-15, 40, 2],
  [-28, 42, 2.4],
  [-41, 43.6, 2.6],
  [-54, 45, 2.8],
  [-67, 46, 0],
];
/** @type {number} 鰭上緣青銅鑲邊的寬度：齒尖連線往下這麼多以內是青銅，再往下是黑釉鰭心 */
const FIN_RIM = 4.4;
/** @type {number} 鰭厚 */
const FIN_T = 1.2;

/** @type {{ y: number, thick: number, pitchDeg: number, pivot: number[], halfSpan: number }} 青銅翼刃：水平板繞 z 軸抬起後緣 */
const WING = { y: 40.4, thick: 1.0, pitchDeg: 5, pivot: [-63, 40.4], halfSpan: 30 };

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
  wing: 'crest-keel-wing',
  theme: 'F2 擋泥板肌肉型的攻城木器：青銅包頭的攻城槌樑鼻往後升成前低後高的楔形，前後擋泥板夾著凹谷狀的引擎蓋與臀脊、中段大幅收腰；鬃變成從活板門後緣一路升到車尾的鋸齒背鰭（5 齒，青銅鑲邊＋黑釉鰭心），鰭尾托著後掠、翼面有回紋鑲嵌的青銅翼刃；座艙是門縫透出琥珀色火光的深胡桃木活板門，橡木肩帶上一排透光圓舷窗、鼻側一對斜縫頭燈；淺橡木木板車身＋3 道青銅鉚釘箍帶＋深胡桃木下半車身的青銅回紋',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 腰線稜（5）是唯一的銳利稜線，其餘平滑
  hard: [5],
  wheelArches: ARCHES,
  sideZMin: 22,
  // 配色：淺橡木為主（木板車身），深胡桃木為次（中央脊、活板門、下半車身），青銅金屬（包頭、翼刃、箍帶、回紋），琥珀色火光點綴
  zones: () => [
    // 青銅包頭（攻城槌的金屬頭）
    { mat: 'bronze', keep: (x) => x - RAM_X },
    // 中央脊與活板門：深胡桃木，從鼻根掃到車尾的中央條
    { mat: 'walnut', keep: (x, y, z) => (onCrest(x, z) ? 1 : -1) },
    // 深胡桃木下半車身，分割線從鼻尖往後上掃
    { mat: 'walnut', keep: (x, y) => Math.min(darkTopY(x) - y, y - 13.4) },
    // 淺橡木上半車身（木板）與下緣
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

    // ── 鬃 → 鋸齒背鰭：活板門後緣（x −2）沿臀脊到車尾，齒尖往後勾（缺口在齒尖前方），根部埋進殼面 1 mm；
    //    分成兩片同厚的立板：上緣一圈青銅鑲邊（含全部鋸齒），裡面是黑釉鰭心，深色中央脊上才看得出鰭的輪廓 ──
    {
      /** @type {number[][]} 鰭心上緣（齒尖連線往下 FIN_RIM），由前往後 */
      const coreTop = TEETH.map(([tx, ty]) => [tx, ty - FIN_RIM]);
      coreTop[coreTop.length - 1] = [-65.2, 41.4];
      /** @type {number[][]} 鰭心外形：前端從臀脊（x −12）起，後緣比鰭的後緣內縮約 2 mm */
      const core = [[-12, P.yN(-12) - 1], ...coreTop, [-66.6, 36.2], [-64.6, P.yN(-64.6) - 1]];
      for (const x of [-56, -48, -40, -30, -20]) {
        core.push([x, P.yN(x) - 1]);
      }
      /** @type {number[][]} 鑲邊外形：鋸齒上緣（由前往後）→ 後緣 → 沿鰭心上緣回到前端 */
      const rim = [[-2, P.yN(-2) - 1], [-3.2, P.yN(-3.2) + 0.9]];
      for (const [tx, ty, notch] of TEETH) {
        rim.push([tx, ty]);
        if (notch > 0) {
          rim.push([tx + 2.4, ty - notch]);
        }
      }
      rim.push([-68.8, 36], [-66, P.yN(-66) - 1], [-64.6, P.yN(-64.6) - 1], [-66.6, 36.2], ...coreTop.slice().reverse(), [-12, P.yN(-12) - 1], [-8, P.yN(-8) - 1]);
      parts.push({ geometry: finPlate(rim, 0, FIN_T), mat: 'bronze2', solid: true, outline: true, name: 'crest-saw-fin-rim' });
      parts.push({ geometry: finPlate(core, 0, FIN_T), mat: 'slip2', solid: true, outline: true, name: 'crest-saw-fin-core' });
    }
    // ── 青銅翼刃：後掠梯形平板（前緣中央 x −57、翼端 −62.5，後緣 −73），後緣抬高 5°，由鋸齒鰭尾托住；
    //    兩端是往後上翹的小翼端板，左右各一支從後擋泥板頂長出的後掠斜撐（根部埋進殼面 1 mm）──
    {
      const { y, thick, pitchDeg, pivot, halfSpan } = WING;
      const blade = flatPlate([[-57, 0], [-62.5, halfSpan], [-73, halfSpan], [-73, -halfSpan], [-62.5, -halfSpan]], y, thick);
      blade.translate(-pivot[0], -pivot[1], 0);
      blade.rotateZ((-pitchDeg * Math.PI) / 180);
      blade.translate(pivot[0], pivot[1], 0);
      /** @type {(x: number) => number} 翼刃底面在 x 處的高度 */
      const bladeY = (x) => y + (pivot[0] - x) * Math.tan((pitchDeg * Math.PI) / 180);
      /** @type {THREE.BufferGeometry[]} */
      const geos = [blade];
      for (const sg of [-1, 1]) {
        geos.push(finPlate([[-62, bladeY(-62) - 1.2], [-73.4, bladeY(-73.4) - 0.6], [-74.2, 44.4], [-70.6, 43.6], [-63, bladeY(-63) + thick + 0.2]], sg * halfSpan, 1.2));
        const zs = sg * 20;
        geos.push(finPlate([[-54, top(-54, zs) - 1], [-63.5, bladeY(-63.5) + 0.3], [-67.5, bladeY(-67.5) + 0.3], [-59, top(-59, zs) - 1]], zs, 1.2));
      }
      parts.push({ geometry: mergeGeos(geos), mat: 'bronze2', solid: true, outline: true, name: 'bronze-blade-wing' });
      // 翼面上的回紋鑲嵌：沿翼展一條深色連續回紋帶（週期 7 mm、高 4 mm、線寬 0.7 mm，和下半車身的回紋同一個單元），
      // 用貼在翼面上 0.14 mm 厚的薄片拼成（只算裝飾，不計質量），跟翼面一起抬高後緣
      /** @type {THREE.BufferGeometry[]} */
      const inlay = [];
      /** @type {(u0: number, v0: number, u1: number, v1: number) => void} 回紋線段（u 沿翼展、v 從帶下緣往前緣） */
      const stroke = (u0, v0, u1, v1) => {
        const g = new THREE.BoxGeometry(Math.abs(v1 - v0) + 0.7, 0.14, Math.abs(u1 - u0) + 0.7);
        g.translate(-71.6 + (v0 + v1) / 2, y + thick + 0.09, -28 + (u0 + u1) / 2);
        inlay.push(g);
      };
      stroke(0, 0, 56, 0);
      stroke(0, 5.4, 56, 5.4);
      for (let k = 0; k < 8; k++) {
        const u = 7 * k;
        stroke(u + 0.8, 0, u + 0.8, 4);
        stroke(u + 0.8, 4, u + 5.2, 4);
        stroke(u + 5.2, 4, u + 5.2, 1.6);
        stroke(u + 5.2, 1.6, u + 3, 1.6);
      }
      const meander = mergeGeos(inlay);
      meander.translate(-pivot[0], -pivot[1], 0);
      meander.rotateZ((-pitchDeg * Math.PI) / 180);
      meander.translate(pivot[0], pivot[1], 0);
      parts.push({ geometry: meander, mat: 'dGroove', name: 'decal-wing-meander' });
    }

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
    /** @type {(x: number, y: number) => boolean} 在深胡桃木下半車身 */
    const onDark = (x, y) => y < darkTopY(x) && y > 13.4;
    /** @type {(x: number) => number} 到最近一道箍帶中心的距離 */
    const bandDist = (x) => Math.min(...BAND_XS.map((xb) => Math.abs(x - xb)));
    // 木板接縫：等距平行的細直縫（寬 0.44 mm、深木色，不用黑；不規則的黑線會像裂紋或塗鴉）——
    // 側面：和斜掃線平行的直線（每 4.2 mm 一道），對接縫是垂直直線（每 34 mm，相鄰排錯開 17 mm；板要夠長才像木板而不是磚）；
    // 擋泥板頂面：固定 |z| 的縱向直線（每 4.2 mm 一道，俯視是平行直線，不跟著半寬起伏成波浪），對接縫同上；青銅包頭、箍帶與車尾收尖段（x < −56）不畫
    /** @type {(row: number, x: number) => number} 第 row 排木板在 x 處到最近對接縫的距離 */
    const buttDist = (row, x) => {
      const ph = (((x + (row % 2 === 0 ? 0 : 17)) % 34) + 34) % 34;
      return Math.min(ph, 34 - ph);
    };
    /** @type {(x: number, y: number, z: number) => number} 接縫距離函式（正值 = 在縫上） */
    const seam = (x, y, z) => {
      if (onCrest(x, z) || y < 13.6 || x > RAM_X - 0.6 || bandDist(x) < 1.3) {
        return -1;
      }
      if (onSide(x, z)) {
        const q = (y - stripeY(x) - STRIPE_HW) / 4.2;
        const row = Math.floor(q);
        const along = Math.abs(q - Math.round(q)) * 4.2;
        return Math.min(0.22 - Math.min(along, buttDist(row, x)), y - darkTopY(x) - 0.8, archRingDist(x, y) - 0.6);
      }
      if (x < -56) {
        return -1;
      }
      const q = Math.abs(z) / 4.2;
      const row = Math.floor(q);
      const along = Math.abs(q - Math.round(q)) * 4.2;
      return Math.min(0.22 - Math.min(along, buttDist(row, x)), Math.abs(z) - P.nw(x) - 1.2);
    };
    parts.push({ geometry: kit.decal((x, y, z) => (onDark(x, y) ? -1 : seam(x, y, z))), mat: 'dSeam', name: 'decal-plank-seams' });
    // 深胡桃木下半車身上的青銅回紋（MYTH_RESEARCH 希臘陶甕的回紋帶）：沿分割線斜向的連續鉤形回紋，週期 7 mm、高 4 mm，上下各一條邊線
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
        // 紋帶跟著下半車身上緣（darkTopY）走；下方是一圈陶甕底部常見的放射尖齒紋（底線＋往上的尖三角，週期 3.5 mm、高 3.2 mm）
        const v = y - (darkTopY(x) - 7.8);
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
      mat: 'dBronze',
      name: 'decal-meander-frieze',
    });
    // 活板門木板縫（深色）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onCrest(x, z) || x < HATCH_X[0] + 2 || x > HATCH_X[1] - 2) {
          return -1;
        }
        const q = z / 3.2;
        return Math.min(0.25 - Math.abs(q - Math.round(q)) * 3.2, crestHw(x) - 1.8 - Math.abs(z));
      }, { offset: 0.1 }),
      mat: 'dGroove',
      name: 'decal-hatch-planks',
    });
    // 活板門門縫的火光：沿艙蓋四邊內縮 1 mm 的一圈琥珀色發光線（寬 0.9 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onCrest(x, z)) {
          return -1;
        }
        const inset = Math.min(x - HATCH_X[0], HATCH_X[1] - x, crestHw(x) - Math.abs(z));
        return 0.45 - Math.abs(inset - 1.0);
      }, { offset: 0.14 }),
      mat: 'dGlow',
      name: 'decal-hatch-glow',
    });
    // 淺橡木 / 深胡桃木分割線上的青銅細線（0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => (onCrest(x, z) || x > RAM_X ? -1 : 0.35 - Math.abs(y - darkTopY(x))), { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-split-pinstripe',
    });
    // 青銅鉚釘箍帶：3 道橫跨車身的箍帶（寬 1.8 mm），從中線一路包到分割線；鉚釘頭沿剖面每 3.4 mm 一顆
    parts.push({
      geometry: kit.decal((x, y) => (onDark(x, y) || y < 13.6 ? -1 : Math.min(0.9 - bandDist(x), archRingDist(x, y) - 0.6)), { offset: 0.12 }),
      mat: 'dBronze',
      name: 'decal-bronze-bands',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onDark(x, y) || y < 14.4 || archRingDist(x, y) < 1) {
          return -1;
        }
        // 沿剖面單調遞增的量（往外 |z| 變大、往下 y 變小）當作弧長
        const s = Math.abs(z) - y;
        const ph = ((s % 3.4) + 3.4) % 3.4;
        return 0.48 - Math.hypot(bandDist(x), Math.min(ph, 3.4 - ph));
      }, { offset: 0.16 }),
      mat: 'dRivet',
      name: 'decal-band-rivets',
    });
    // 橡木肩帶上的一排圓舷窗：窗內透出火光＋青銅窗框
    /** @type {(x: number, y: number) => number} 到最近舷窗中心的距離 */
    const portDist = (x, y) => Math.min(...PORT_XS.map((px) => Math.hypot(x - px, y - portY(px))));
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) && Math.abs(x) < 18 ? PORT_R - portDist(x, y) : -1), { offset: 0.12 }),
      mat: 'dGlow',
      name: 'decal-portholes',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || Math.abs(x) > 18) {
          return -1;
        }
        const d = portDist(x, y);
        return Math.min(d - PORT_R + 0.05, PORT_R + 0.65 - d);
      }, { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-porthole-rims',
    });
    // 頭燈：前擋泥板前緣頂面一對往鼻根斜收的琥珀色斜縫（寬 1.4 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) || onCrest(x, z) ? -1 : 0.7 - segDist(x, Math.abs(z), 50.5, 26.5, 57.5, 19.5)), { offset: 0.14 }),
      mat: 'dGlow',
      name: 'decal-slit-lamps',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：殼 x −70 → 77、翼端板後緣 −74.2；中線頂：臀脊 32.4、活板門 34.6（x 4）→ 鼻尖 17.8；擋泥板頂：後輪 35.4、腰 26.6、前輪 33；半寬：車尾 17、後輪 39.6、腰 23.6、前輪 35.6（到 x 50 仍 35.2，包住輪胎外緣 34.25）、攻城槌樑 16 → 9',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯用 buildProfileLiner（沿剖面反查殼內面）',
    windows: '舷窗：米科諾斯島浮雕陶甕木馬側面的舷窗（MYTH_RESEARCH G2）；本款 5 個 φ3.4 mm 圓窗貼紙，沿腰線稜上方的橡木肩帶排成一排（數量與尺寸自訂）',
    crestWing: '鋸齒背鰭（厚 1.2 mm，齒尖 40 → 46，青銅鑲邊與黑釉鰭心兩片同厚）、青銅翼刃（厚 1.0 mm、翼展 60、後緣抬高 5°）、翼端板與斜撐（厚 1.2 mm）為實心 ABS 件，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 只複製既有欄位：神話組分組欄位（mythSeries / mythTheme）在這裡補進 BodyDef
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const trojanHorseBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
