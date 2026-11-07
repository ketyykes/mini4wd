// 雅加婆婆的小屋（body-yaga-hut，神話組・斯拉夫）：俄羅斯民間故事裡「站在雞腳上、會轉身的小木屋」（izbushka）——
// Magnus 1916 英譯 Afanasyev：「a little hut standing on cocks' feet and turning round」，要對它說「背對森林站好」才會停下開門。
// 造型：一台前低後高的半罩露輪楔形車（LG1 半罩露輪攻擊型），小屋用「屋頂斷面」和零件表現，車上不做雞腳、不畫雅加婆婆：
// 低矮的圓木甲板車身上，一座陡斜的人字木瓦屋頂從車頭的屋脊線一路升高到車尾，當座艙罩與後罩；車尾封口就是小屋的山牆（白色博風板＋琥珀圓窗）；
// 屋脊兩側各一扇往車頭收窄的琥珀暖光窗當座艙窗；右側屋面一根微微後傾、立起來的紅磚煙囪，管口拖著一片往後飄的白色煙鰭；
// 兩輪之間的圓木牆上每側三扇深棕細木框的琥珀小窗——izba 正面「三扇窗」的排法，車身側面一眼就是一間木屋；
// 後翼是一道柵欄：每側三片尖頂白木樁當翼端板、兩根紅色橫木就是上下兩段翼面；
// 「會走路的小屋」只用姿態暗示：前輪罩整個切開、露出前輪，車身往前低頭；切口後方的甲板上每側三片往後掠的大型橘黃爪痕鰭（三道平行斜劃的爪痕，不做腳）。
// 配色：原木暖褐（霧面）＋深炭灰木瓦屋頂（霧面）＋白色木作（霧面）＋紅色橫木與窗框＋橘黃爪痕鰭＋琥珀窗光。
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
const X_REAR = -67;
/** @type {number} 車頭封口（小山牆）x */
const X_FRONT = 68;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-67, -62, -54, -40, -28, -14, 0, 14, 28, 40, 48, 55, 61, 68];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 圓木牆面半寬（接縫處）：俯視是往後展開的楔形（V3）——尖窄車頭（3.4）→ 前輪位置 37.4（前輪罩切開後只剩中央 ±23.6 的引擎蓋）→
  // 兩輪之間 29 的細腰 → 後輪上方最寬的後翼子板 41 → 收窄的船尾 17（車尾山牆只比人字屋頂寬一點）；腰段下層裙身的內收量由 skirtIn 限制在 |z| ≥ 28
  hw: monoCurve(XS, [17, 22.5, 33, 41, 37.5, 30.5, 29, 29.5, 33.5, 37.4, 23, 9, 4.8, 3.4]),
  // 屋脊（人字屋頂的頂線）：從鼻端 16.6 貼著甲板往後，x 28 起離開甲板一路升高，後輪上方最高 40.8，到車尾山牆緩降到 37.6；
  // 側視是一片往前低頭的楔形屋頂
  yTop: monoCurve(XS, [37.6, 38.4, 39.4, 40.8, 40.6, 38.2, 35, 31.4, 27.8, 26.6, 25, 22, 19, 16.6]),
  // 甲板外緣高度（甲板與圓木牆交界＝肩線）：後輪上方 28.6（蓋住 R15 輪拱頂 28），往前壓到鼻端 15.8
  yS: monoCurve(XS, [27, 27.6, 28.2, 28.6, 28.2, 27.4, 26.6, 26, 25.8, 25.6, 24, 21, 18, 15.8]),
  // 側裙（最下一根圓木）下緣：車尾封口下緣 17.5（遮住後齒輪箱）
  yLow: monoCurve(XS, [17.5, 14.5, 12.2, 11.2, 11.1, 11.1, 11.1, 11.1, 11.1, 11.2, 11.6, 12.2, 12.8, 13.2]),
};

/** @type {number} 甲板外伸（甲板外緣超出圓木牆的距離）；0.3 讓甲板貼齊圓木牆，不會懸在牆外像蓋了一張毯子 */
const EO = 0.3;
/** @type {number} 封簷板高度 */
const FASCIA_H = 1.0;
/** @type {number} 屋簷底到牆頂（最上一根圓木上緣）的內收高度 */
const TUCK_H = 0.3;
/** @type {number} 圓木根數 */
const LOG_COUNT = 2;
/** @type {number} 下層深色裙身相對上層屋身的內收量（側視上下兩層量體） */
const SKIRT_IN = 2.4;
/**
 * 內收量：鼻端 10 mm 內漸收為 0（鼻端封口保持乾淨）；細腰段限制裙身外面 |z| ≥ 28（底盤側壁在 |z| 23–26，留殼厚 0.8 與間隙），最少 1.0
 * @type {(x: number) => number}
 */
const skirtIn = (x) => Math.max(0, Math.min(SKIRT_IN, Math.max(1.0, P.hw(x) - 28))) * Math.max(0, Math.min(1, (64 - x) / 10));
/** @type {number} 圓木鼓起量 */
const LOG_BULGE = 0.8;
/** @type {(L: number) => number} 圓木鼓起量（車頭圓木變細，鼓起量跟著縮，最多 0.8） */
const logBulge = (L) => Math.min(LOG_BULGE, 0.2 * L);
/**
 * 圓木鼓起的漸收係數：車頭收窄段（x 46 → 56）就把鼓起收掉，鼻端圓木牆是平整的一面（車頭封口是乾淨的平滑輪廓），
 * 避免圓木層往外張開像翻開的書頁；圓木只靠接縫與陰影帶貼紙表現
 * @type {(x: number) => number}
 */
const bulgeFade = (x) => Math.max(0, Math.min(1, (56 - x) / 10));

/** @type {(x: number) => number} 牆頂（最上一根圓木上緣）高度 */
const yWallTop = (x) => P.yS(x) - FASCIA_H - TUCK_H;
/** @type {(x: number) => number} 上層屋身（2 根圓木）下緣高度；以下是內收的深色裙身 */
const yLogBot = (x) => yWallTop(x) - Math.min(7.6, 0.55 * (yWallTop(x) - P.yLow(x)));
/** @type {(x: number) => number} 每根圓木高度 */
const logH = (x) => (yWallTop(x) - yLogBot(x)) / LOG_COUNT;
/** @type {number} 人字屋頂的屋簷半寬（車尾端） */
const GABLE_HW = 15;
/** @type {(x: number) => number} 人字屋頂的屋簷半寬：後段 15，x −20 之後往車頭收窄（俯視是一支朝前的箭頭）；車尾與鼻段跟著甲板收窄（至少留 3 mm 甲板，鼻段不超過甲板半寬的 0.55） */
const gableHw = (x) => Math.min(lerp(GABLE_HW, 6, Math.max(0, Math.min(1, (x + 20) / 54))), Math.max(0.55 * P.hw(x), P.hw(x) - 3));
/** @type {number} 甲板在屋簷下比甲板外緣高出的量（甲板微拱） */
const DECK_CROWN = 0.9;
/** @type {(x: number) => number} 屋頂封簷板高度（屋簷外緣到甲板的垂直面）：屋頂越高越厚，最多 1.0；屋頂貼回甲板的鼻段只剩 0.15 */
const gableFascia = (x) => Math.max(0.15, Math.min(1.0, 0.12 * (P.yTop(x) - P.yS(x) - DECK_CROWN)));
/** @type {(x: number) => number} 屋簷外緣高度 */
const yEave = (x) => P.yS(x) + DECK_CROWN + gableFascia(x);
/** @type {(x: number) => number} 屋脊高度（鼻段不低於屋簷） */
const yRidge = (x) => Math.max(P.yTop(x), yEave(x) + 0.1);
/** @type {(x: number) => number} 屋脊高出屋簷的量（判斷哪一段算屋頂） */
const roofRise = (x) => yRidge(x) - yEave(x);
/** @type {(x: number, az: number) => number} 屋面在 |z| 處的高度（屋脊到屋簷是一條直線） */
const roofY = (x, az) => lerp(yRidge(x), yEave(x), Math.min(1, az / gableHw(x)));

/**
 * 半剖面：屋脊（銳利）→ 直線屋面 → 屋簷外緣 → 屋頂封簷板（垂直）→ 微拱的甲板 → 甲板外緣 → 封簷板（垂直）→ 內收 → 2 根圓木（每根鼓起 + 銳利接縫）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const s = P.yS(x);
  const h = P.hw(x);
  const yW = yWallTop(x);
  const L = logH(x);
  const ez = gableHw(x);
  /** @type {number[][]} */
  const pts = [
    [0, yRidge(x)],
    [ez, yEave(x)],
    [ez, yEave(x) - gableFascia(x)],
    [h + EO, s],
    [h + EO, s - FASCIA_H],
    [h, yW],
  ];
  for (let j = 0; j < LOG_COUNT; j++) {
    const yT = yW - j * L;
    pts.push([h + logBulge(L) * bulgeFade(x), yT - 0.5 * L], [h, yT - L]);
  }
  // 屋身下緣往內收一階（屋簷底面），下層深色裙身垂直到底
  const k = skirtIn(x);
  pts.push([h - k, yLogBot(x) - 0.35 * Math.min(1, k)], [h - k, P.yLow(x)]);
  return pts;
};
/** @type {number[]} 銳利稜線：屋簷外緣、屋頂封簷板下緣、甲板外緣、封簷板下緣、牆頂、圓木接縫、屋身下緣、裙身內收角 */
const HARD = [1, 2, 3, 4, 5, 7, 9, 10];

/** @type {{ x: number, pts: number[][] }[]} 車尾每 1.5 mm、車頭每 1 mm 一站（曲面內部每 0.5 mm 取樣；站距 0.75 會變成每 0.375 mm 一列），中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -55, 1.5, profile).slice(0, -1), ...buildStations(-55, 55, 2, profile).slice(0, -1), ...buildStations(55, X_FRONT, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R15：26 mm 輪胎半徑 13 + 2 mm；31 mm 輪需切輪拱） */
const ARCHES = [
  { x: 40, y: 13, radius: 15, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 15, cutZFrom: 22.5 },
];
/** @type {number} 前輪露出切口的斜切斜率（側視 dy/dx） */
const CUT_SLOPE = 1.1;
/**
 * F3 半罩露輪：前輪罩整個切開，從上方和側面都看得到整顆前輪的上半（往前跨出去的姿態）。
 * 切口範圍：|z| ≥ 23.6（輪胎內側面 22.75 之外）、x 25 → 57、輪心高以上；切口後緣是一條往前上方的斜線（x 25 處 y 20 → x 30 處切過甲板），
 * 剩下中央 ±23.6 的引擎蓋往前收成尖鼻；負值 = 開口內
 * @type {(x: number, y: number, z: number) => number}
 */
const frontCutSd = (x, y, z) => {
  if (Math.abs(z) < 23.6) {
    return 10;
  }
  const slant = (y - 20 - (x - 25) * CUT_SLOPE) / Math.hypot(1, CUT_SLOPE);
  return Math.max(25 - x, x - 57, 12 - y, slant);
};

/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, y: number, z: number) => boolean} 頂面（人字屋頂＋甲板） */
const onRoof = (x, y, z) => y > P.yS(x) - 0.05 && Math.abs(z) < P.hw(x) + EO - 0.05;
/** @type {(x: number, y: number, z: number) => boolean} 圓木牆 */
const onWall = (x, y, z) => y < yWallTop(x) + 0.05 && Math.abs(z) > P.hw(x) - 0.3;
/** @type {(x: number, y: number) => number} 圓木編號（0 = 最上一根） */
const logIndex = (x, y) => Math.floor((yWallTop(x) - y) / logH(x));

/** @type {number} 木瓦直列的列距（固定 |z| 間距，從屋脊往外量；列線是俯視的直線，不跟著屋簷外緣彎，瓦片紋才不會在曲面上扭成波浪） */
const SHINGLE_ROW = 3.4;
/** @type {number} 鼻端楔形段起點 x（再往前不畫甲板木板縫） */
const NOSE_PLAIN_X = 49;
/** @type {number} 每片木瓦沿 x 的長度（橫向搭接線間距） */
const SHINGLE_W = 3.6;
/** @type {(x: number, z: number) => { col: number, colLine: number, courseLine: number, course: number }} 直列木瓦座標：列編號、到最近列線距離、到最近搭接線距離、搭接編號（相鄰列錯開半片） */
const shingleGrid = (x, z) => {
  const u = (Math.abs(z) - 1.2) / SHINGLE_ROW;
  const col = Math.floor(u);
  const colLine = Math.abs(u - Math.round(u)) * SHINGLE_ROW;
  const v = (x + (((col % 2) + 2) % 2) * SHINGLE_W * 0.5) / SHINGLE_W;
  return { col, colLine, courseLine: Math.abs(v - Math.round(v)) * SHINGLE_W, course: Math.floor(v) };
};

/** @type {(x: number, y: number, z: number) => boolean} 人字屋頂的木瓦屋面（屋簷以內、屋頂高出甲板的那一段） */
const onShingles = (x, y, z) => onRoof(x, y, z) && Math.abs(z) < gableHw(x) - 0.06 && roofRise(x) > 0.6;

/** @type {{ x0: number, x1: number }} 座艙窗的前後緣 x */
const PANE = { x0: -12, x1: 15 };
/**
 * 座艙窗（俯視 (x, |z|)）：屋脊兩側屋面上各一扇琥珀窗，外緣跟著屋簷往車頭收窄，像被屋脊樑分成兩片的擋風玻璃；負值 = 窗內
 * @type {(x: number, az: number) => number}
 */
const paneSd = (x, az) => Math.max(PANE.x0 - x, x - PANE.x1, 2.6 - az, az - (gableHw(x) - 3));

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 原木：霧面（roughness 0.65–0.75）
  log: namedMaterial('paint-log-pine', { color: 0x8c5a32, roughness: 0.7, clearcoat: 0.03 }),
  logDark: namedMaterial('paint-log-pine-aged', { color: 0x74482a, roughness: 0.72, clearcoat: 0.03 }),
  // 木瓦屋頂（風化的白楊木瓦：深炭灰，霧面），甲板外緣底與車頭封口是 izba 彩繪的藍
  shingle: namedMaterial('paint-shingle-charcoal', { color: 0x3a3e44, roughness: 0.74, clearcoat: 0.04 }),
  soffit: namedMaterial('paint-izba-blue', { color: 0x2a5aa0, roughness: 0.6, clearcoat: 0.08 }),
  // 白色木作：封簷板、博風板、柵欄木樁（白漆，霧面）
  white: namedMaterial('paint-nalichnik-white', { color: 0xf0ece2, roughness: 0.6, clearcoat: 0.05 }),
  white2: namedMaterial('paint-nalichnik-white', { color: 0xf0ece2, roughness: 0.6, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 柵欄橫木＝兩段翼面（izba 彩繪的紅，緞面）
  rail: namedMaterial('paint-izba-red', { color: 0xb3302a, roughness: 0.48, clearcoat: 0.3 }),
  // 煙囪：紅磚＋白灰管口環（霧面）
  brick: namedMaterial('paint-brick-red', { color: 0x9b4a32, roughness: 0.78, clearcoat: 0.0 }),
  // 窗內暖光：較深的琥珀底色＋低強度自發光（不過曝），由深色木窗框框住
  window: namedMaterial('lamp-window-amber', { color: 0x9c5418, emissive: 0x8a3806, emissiveIntensity: 0.15, roughness: 0.3, clearcoat: 0.5 }),
  // 側牆小窗的窗光：比座艙窗亮一階的暖黃琥珀，和原木褐拉開明度（深棕細窗框之內才看得出是一扇亮著的窗）
  windowWarm: namedMaterial('lamp-window-amber-warm', { color: 0xe0a048, emissive: 0xb86410, emissiveIntensity: 0.35, roughness: 0.3, clearcoat: 0.5 }),
  // 側裙（腰部遮住底盤的踏板）：深炭灰
  sill: namedMaterial('paint-sill-charcoal', { color: 0x2c2f33, roughness: 0.62, clearcoat: 0.08 }),
  // 往後飄的煙鰭（霧面暖灰白；材質與網格名稱都不含 smoke，避免 Blender 當成玻璃）
  plume: namedMaterial('paint-ash-plume', { color: 0xe8e4dc, roughness: 0.92, clearcoat: 0.0, side: THREE.DoubleSide }),
  // 前輪切口後方的導流片（橘黃，緞面）
  vane: namedMaterial('paint-vane-ochre', { color: 0xf0a020, roughness: 0.5, clearcoat: 0.15, side: THREE.DoubleSide }),
  hole: namedMaterial('plastic-chimney-black', { color: 0x120d0a, roughness: 0.9 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-wood', { color: 0x4a2f1b, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-wood', { color: 0x2e1f14, roughness: 0.8, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGroove: decalMaterial('decal-moss-caulk', { color: 0x2b2116, roughness: 0.85 }),
  // 圓木上下緣的陰影帶（比圓木深兩階的木褐）與中段的受光帶 → 讀成一根根圓柱形圓木
  dLogShade: decalMaterial('decal-log-shade', { color: 0x4e2f19, roughness: 0.78 }),
  dLogLight: decalMaterial('decal-log-highlight', { color: 0xa66d3c, roughness: 0.68 }),
  // 座艙窗的深色木窗框與窗格
  dFrameWood: decalMaterial('decal-window-frame-wood', { color: 0x3a2414, roughness: 0.7 }),
  dShingleGap: decalMaterial('decal-shingle-gap', { color: 0x17191c, roughness: 0.85 }),
  dShingleDark: decalMaterial('decal-shingle-charcoal-dark', { color: 0x2a2d32, roughness: 0.76 }),
  dWhite: decalMaterial('decal-nalichnik-white', { color: 0xf0ece2, roughness: 0.6 }),
  dRed: decalMaterial('decal-window-red', { color: 0xb3302a, roughness: 0.58 }),
  dBlue: decalMaterial('decal-izba-blue', { color: 0x2a5aa0, roughness: 0.6 }),
});

/**
 * 車尾山牆（車尾封口就是小屋的山牆）：沿兩條屋面邊緣的白色 Λ 形博風板＋山牆中央的琥珀圓窗與白窗框
 * @type {() => { boards: THREE.BufferGeometry, pane: THREE.BufferGeometry, ring: THREE.BufferGeometry }}
 */
const buildRearGable = () => {
  const r = yRidge(X_REAR);
  const e = yEave(X_REAR);
  const ez = gableHw(X_REAR) + 0.6;
  const shape = new THREE.Shape([[-ez, e - 0.2], [0, r + 0.5], [ez, e - 0.2], [ez, e - 1.9], [0, r - 1.4], [-ez, e - 1.9]].map(([z, y]) => new THREE.Vector2(z, y)));
  const boards = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false });
  // 局部 +Z（厚度）→ 世界 +X；圖形左右對稱
  boards.rotateY(Math.PI / 2);
  boards.translate(X_REAR - 0.75, 0, 0);
  /** @type {(radius: number, thick: number, x: number) => THREE.BufferGeometry} 軸向沿 x 的圓片，後表面在 x */
  const disc = (radius, thick, x) => {
    const g = new THREE.CylinderGeometry(radius, radius, thick, 16);
    g.rotateZ(Math.PI / 2);
    g.translate(x + thick / 2, e + 3.2, 0);
    return g;
  };
  return { boards, pane: disc(2.1, 0.5, X_REAR - 0.4), ring: disc(2.9, 0.3, X_REAR - 0.2) };
};

/** @type {number} 柵欄木樁的中心 |z|（板厚 1.2） */
const FENCE_Z = 28.6;
/** @type {{ x0: number, x1: number, top: number }[]} 每側三片木樁（側視）：前後緣 x 與尖頂高度，越往車尾越高 */
const PICKETS = [
  { x0: -48.1, x1: -44.9, top: 43.2 },
  { x0: -52.3, x1: -49.1, top: 45 },
  { x0: -56.5, x1: -53.3, top: 46.6 },
];

/**
 * 後翼是一道柵欄（2 段翼，V9）：每側三片尖頂木樁當翼端板（根部埋進後甲板），兩根橫木就是下段主翼與上段副翼，
 * 下段架在前兩片木樁上、貼著屋脊上方，上段架在後兩片木樁上
 * @type {() => { pickets: THREE.BufferGeometry, rails: THREE.BufferGeometry }}
 */
const buildFenceWing = () => {
  /** @type {THREE.BufferGeometry[]} */
  const pickets = [];
  for (const sg of [-1, 1]) {
    for (const { x0, x1, top } of PICKETS) {
      const shape = new THREE.Shape([[x0, 27.6], [x1, 27.6], [x1, top - 1.7], [(x0 + x1) / 2, top], [x0, top - 1.7]].map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
      g.translate(0, 0, sg * FENCE_Z - 0.6);
      pickets.push(g);
    }
  }
  const span = 2 * FENCE_Z + 1.2;
  const lower = new THREE.BoxGeometry(6.6, 1.2, span);
  lower.translate(-48.5, 42, 0);
  const upper = new THREE.BoxGeometry(5.8, 1.1, span);
  upper.translate(-53.3, 44.3, 0);
  return { pickets: mergeGeos(pickets), rails: mergeGeos([lower, upper]) };
};

/** @type {{ xb: number, z: number }[]} 每側三片爪痕鰭：前端 x 與中心 |z|（越外側越靠前，跟著甲板外緣；間距 3.5 mm，三片分得開） */
const VANES = [
  { xb: 22, z: 21.4 },
  { xb: 24.5, z: 24.9 },
  { xb: 27, z: 28.4 },
];

/**
 * 前輪切口後方甲板上的爪痕鰭：每側三片往後掠的刀形薄板（長 20、高出甲板約 8、厚 1.1 mm，根部埋進甲板），
 * 前端低、往後上方斜升到尖端，三片平行錯開成三道斜劃的爪痕
 * @type {() => THREE.BufferGeometry}
 */
const buildVanes = () => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const sg of [-1, 1]) {
    for (const { xb, z } of VANES) {
      const shape = new THREE.Shape([[xb, 25.2], [xb - 15.5, 25.2], [xb - 20, 34.2], [xb - 7.5, 29.4]].map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: false });
      g.translate(0, 0, sg * z - 0.55);
      geos.push(g);
    }
  }
  return mergeGeos(geos);
};

/** @type {number} 煙囪所在的 z（立在右側屋面上） */
const FLUE_Z = 6;
/** @type {number} 煙囪根部 x（座艙窗後方） */
const FLUE_X0 = -25;
/** @type {number[]} 管口 (x, y) */
const FLUE_B = [-27.8, 45.8];

/** @type {number[][]} 煙鰭的側視外形 (x, y)：從管口往後飄、往後漸細的一片薄鰭，上緣三道波峰 */
const PLUME_FIN = [[-27.4, 46.0], [-33, 46.0], [-40, 46.3], [-48, 46.9], [-43.6, 47.7], [-41.8, 47.1], [-38.2, 48.0], [-36.4, 47.3], [-32.6, 48.1], [-29.6, 47.5]];

/**
 * 冒煙的小屋：紅磚方煙囪從右側屋面立起（往後傾約 14°，側視一看就是煙囪），
 * 管口拖出一片往後飄的霧面白色薄鰭（厚 1 mm，往柵欄翼的方向漸細；網格名不含 smoke）
 * @type {() => { stack: THREE.BufferGeometry, cap: THREE.BufferGeometry, flue: THREE.BufferGeometry, plume: THREE.BufferGeometry }}
 */
const buildChimneyPlume = () => {
  const a = new THREE.Vector3(FLUE_X0, roofY(FLUE_X0, FLUE_Z) - 1.6, FLUE_Z);
  const b = new THREE.Vector3(FLUE_B[0], FLUE_B[1], FLUE_Z);
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  /** @type {(r: number, l: number, at: number) => THREE.BufferGeometry} 沿管軸的方柱（4 段圓柱轉 45° = 方形斷面） */
  const seg = (r, l, at) => {
    const g = new THREE.CylinderGeometry(r, r, l, 4);
    g.rotateY(Math.PI / 4);
    g.applyQuaternion(quat);
    const c = a.clone().addScaledVector(dir, at);
    g.translate(c.x, c.y, c.z);
    return g;
  };
  const plume = new THREE.ExtrudeGeometry(new THREE.Shape(PLUME_FIN.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 1, bevelEnabled: false });
  plume.translate(0, 0, FLUE_Z - 0.5);
  return { stack: seg(3.0, len - 1.0, (len - 1.0) / 2), cap: seg(3.5, 1.3, len - 0.7), flue: seg(2.0, 0.3, len - 0.02), plume };
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

/** @type {number} 側裙頂面高度 */
const SILL_Y1 = 13.4;
/** @type {number} 側裙底面高度（踏板厚 1.8 mm；底盤側框頂 9.4 之上） */
const SILL_Y0 = 11.6;
/** @type {number} 側裙外緣半寬（底盤底板外緣 |z| 36.2 之外；x −20 ~ −10 的側面凸塊 38.8 只到 y 7.6，在側裙下方） */
const SILL_Z = 35;
/** @type {number} 側裙前後端 x（輪拱切口之內） */
const SILL_X = 23.5;

/**
 * 側裙：兩輪之間從圓木牆根部往外伸到 |z| 35 的踏板（厚 1.8 mm），蓋住底盤側框頂面；
 * 前後端收窄成圓角接進輪拱。右側 (x, z) 俯視多邊形沿 y 擠出；左側鏡射
 * @type {() => THREE.BufferGeometry}
 */
const buildSills = () => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const sg of [-1, 1]) {
    /** @type {THREE.Vector2[]} */
    const pts = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const x = lerp(-SILL_X, SILL_X, i / n);
      pts.push(new THREE.Vector2(x, P.hw(x) - skirtIn(x) - 0.6));
    }
    for (let i = n; i >= 0; i--) {
      const x = lerp(-SILL_X, SILL_X, i / n);
      const e = Math.max(0, (Math.abs(x) - 17) / (SILL_X - 17));
      pts.push(new THREE.Vector2(x, Math.max(P.hw(x) + 0.6, SILL_Z - 3.2 * e * e)));
    }
    const shape = new THREE.Shape(pts);
    const g = new THREE.ExtrudeGeometry(shape, { depth: SILL_Y1 - SILL_Y0 - 0.8, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelOffset: -0.4, bevelSegments: 1, curveSegments: 4 });
    // 局部 (x, z, 擠出) → 世界 (x, y, z)：繞 x 軸轉 +90°（局部 y → 世界 z、擠出 → 世界 −y），再平移到 y0
    g.rotateX(Math.PI / 2);
    g.translate(0, SILL_Y1 - 0.4, 0);
    if (sg < 0) {
      g.scale(1, 1, -1);
      const idx = g.index;
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          const t = idx.getX(i + 1);
          idx.setX(i + 1, idx.getX(i + 2));
          idx.setX(i + 2, t);
        }
      } else {
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i += 3) {
          for (const c of [0, 1, 2]) {
            const t = pos.getComponent(i + 1, c);
            pos.setComponent(i + 1, c, pos.getComponent(i + 2, c));
            pos.setComponent(i + 2, c, t);
          }
        }
      }
      g.computeVertexNormals();
    }
    geos.push(g);
  }
  return mergeGeos(geos);
};

/** @type {number[]} 側牆三扇小窗的中心 x（兩輪之間的圓木牆，izba 正面「三扇窗」的排法） */
const SIDE_WINDOW_X = [-13, -4, 5];
/**
 * 側牆小窗：到最近一扇窗玻璃的矩形距離（半寬 2.8、半高 2.4，跟著圓木牆上下置中；負值 = 玻璃內）與相對座標
 * @type {(x: number, y: number) => { rect: number, dx: number, dy: number }}
 */
const sideWindow = (x, y) => {
  const cx = SIDE_WINDOW_X.reduce((a, b) => (Math.abs(x - b) < Math.abs(x - a) ? b : a));
  const dx = Math.abs(x - cx);
  const dy = y - (yWallTop(x) + yLogBot(x)) / 2;
  return { rect: Math.max(dx - 2.8, Math.abs(dy) - 2.4), dx, dy };
};

/** @type {(x: number, y: number) => number} 奔跑速度線：腰側圓木牆上 3 道往後漸細的深色短線（負值 = 線內） */
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

export const yagaHutBody = makePolyBody({
  id: 'body-yaga-hut',
  name: '雅加婆婆的小屋',
  style: 'myth',
  phase: 8,
  mythSeries: 'slavic',
  mythTheme: 'baba-yaga-hut',
  form: 'log-hut',
  roof: 'closed',
  wing: 'chimney-stack',
  theme: '前低後高的半罩露輪楔形車：圓木甲板車身（側面 2 根橫向圓木＋內收的深色裙身、白色封簷板肩線）上一座陡斜的人字木瓦屋頂，從車頭一路升高到車尾當座艙罩與後罩，車尾封口是小屋的山牆（白色博風板、琥珀圓窗）；屋脊兩側一對琥珀暖光座艙窗、右側屋面立起的紅磚煙囪拖著一片白色煙鰭；兩輪之間圓木牆上每側三扇深棕細木框的琥珀小窗；後翼是一道柵欄（每側三片尖頂白木樁當翼端板、兩根紅色橫木當上下兩段翼面）；前輪罩整個切開露出前輪，切口後方每側三片往後掠的大型橘黃爪痕鰭，車身往前低頭',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: HARD,
  wheelArches: ARCHES,
  openings: [{ id: '前輪露出斜切', shape: 'fn', sd: frontCutSd }],
  sideZMin: 22,
  zones: () => [
    // 白色封簷板（甲板外緣的垂直板）：只在牆頂以上才判白色，圓木鼓起（牆面外 0.8 mm）才不會被塗成白色
    { mat: 'white', keep: (x, y, z) => (y > yWallTop(x) + 0.15 ? Math.abs(z) - (P.hw(x) + EO - 0.08) : -1) },
    // 甲板外緣底（深色內收）
    { mat: 'soffit', keep: (x, y, z) => (y > yWallTop(x) - 0.1 && y < P.yS(x) - FASCIA_H + 0.05 && Math.abs(z) > P.hw(x) + 0.05 ? 1 : -1) },
    // 人字屋頂的白色封簷板（屋簷外緣的垂直面）
    { mat: 'white', keep: (x, y, z) => (onRoof(x, y, z) && roofRise(x) > 0.6 ? 0.07 - Math.abs(Math.abs(z) - gableHw(x)) : -1) },
    // 木瓦屋面（深淺交錯的深色瓦片用貼紙，殼面不沿瓦片邊界切分）
    { mat: 'shingle', keep: (x, y, z) => (onShingles(x, y, z) ? 1 : -1) },
    // 下層內收裙身與屋身下緣底面（深炭灰，和上層原木屋身分成兩層）
    { mat: 'sill', keep: (x, y, z) => (y < yLogBot(x) + 0.05 && Math.abs(z) < P.hw(x) - 0.3 ? 1 : -1) },
    // 圓木牆：深淺交錯（同一批木料的色差）；甲板是原木色
    { mat: 'logDark', keep: (x, y) => (y < yWallTop(x) && logIndex(x, y) % 2 === 1 ? 1 : -1) },
    { mat: 'log', keep: () => 1 },
  ],
  // 車頭封口（鼻端）：上半白色、下半 izba 藍彩繪
  capFrontBands: [{ yMin: P.yS(X_FRONT) - FASCIA_H, mat: 'white' }, { mat: 'soffit' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'log', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯＋輪胎內側環形擋板（kitsune-ninetail 的 buildArchWell，擋住輪室看進車身內部）
    // 前輪罩整個切開，內襯只做後輪（前輪內襯會浮在切口裡）
    parts.push({ geometry: buildProfileLiner(ARCHES[1], 22.9, profile), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 15.6, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });
    // 車尾山牆：白色博風板＋琥珀圓窗
    const gable = buildRearGable();
    parts.push({ geometry: gable.boards, mat: 'white2', solid: true, outline: true, name: 'gable-bargeboards' });
    parts.push({ geometry: gable.ring, mat: 'white', solid: true, name: 'gable-window-frame' });
    parts.push({ geometry: gable.pane, mat: 'window', solid: true, name: 'lamp-gable-window' });
    // 柵欄翼：白木樁翼端板＋兩根紅色橫木翼面
    const fence = buildFenceWing();
    parts.push({ geometry: fence.pickets, mat: 'white2', solid: true, outline: true, name: 'fence-wing-pickets' });
    parts.push({ geometry: fence.rails, mat: 'rail', solid: true, outline: true, name: 'fence-wing-rails' });
    // 前輪切口後方的橘黃導流片
    parts.push({ geometry: buildVanes(), mat: 'vane', solid: true, outline: true, name: 'deck-vanes' });
    // 往後倒的煙囪與白色煙鰭
    const ch = buildChimneyPlume();
    parts.push({ geometry: ch.stack, mat: 'brick', solid: true, outline: true, name: 'chimney-stack' });
    parts.push({ geometry: ch.cap, mat: 'white', solid: true, outline: true, name: 'chimney-cap' });
    parts.push({ geometry: ch.flue, mat: 'hole', solid: true, name: 'chimney-flue' });
    parts.push({ geometry: ch.plume, mat: 'plume', solid: true, outline: true, name: 'chimney-plume' });

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
    // 每根圓木上下緣的陰影帶（接縫外 0.35 → 0.35 + 0.2 × 圓木高）＋中段受光帶（± 0.1 × 圓木高），讀成圓柱形圓木
    /** @type {(x: number, y: number, z: number) => number} 在圓木牆上時回傳在圓木內的相對位置 f（0 = 上緣、1 = 下緣），否則 −1 */
    const logFrac = (x, y, z) => {
      if (!onWall(x, y, z)) {
        return -1;
      }
      const q = (yWallTop(x) - y) / logH(x);
      if (q < 0 || q > LOG_COUNT) {
        return -1;
      }
      return q - Math.floor(q);
    };
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const f = logFrac(x, y, z);
        if (f < 0) {
          return -1;
        }
        const L = logH(x);
        const e = Math.min(f, 1 - f) * L;
        return Math.min(e - 0.3, 0.3 + 0.2 * L - e);
      }, { offset: 0.08 }),
      mat: 'dLogShade',
      name: 'decal-log-shade',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const f = logFrac(x, y, z);
        if (f < 0) {
          return -1;
        }
        return (0.1 - Math.abs(f - 0.42)) * logH(x);
      }, { offset: 0.08 }),
      mat: 'dLogLight',
      name: 'decal-log-highlight',
    });
    // 木瓦縫：平行屋脊的橫列縫（固定 |z|）＋每片之間的搭接縫（固定 x，相鄰列錯開半片），線寬 0.6；屋脊兩側 1.2 mm、屋簷邊 0.5 mm 與座艙窗不畫
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onShingles(x, y, z)) {
          return -1;
        }
        const g = shingleGrid(x, z);
        return Math.min(0.3 - Math.min(g.colLine, g.courseLine), Math.abs(z) - 1.4, gableHw(x) - 0.5 - Math.abs(z), paneSd(x, Math.abs(z)) - 1.9);
      }, { offset: 0.1 }),
      mat: 'dShingleGap',
      name: 'decal-shingle-gaps',
    });
    // 深色木瓦（每 3 片一片深色；只畫在瓦縫之內，讓開座艙窗）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onShingles(x, y, z)) {
          return -1;
        }
        const g = shingleGrid(x, z);
        if ((((g.col + g.course) % 3) + 3) % 3 !== 0) {
          return -1;
        }
        return Math.min(Math.min(g.colLine, g.courseLine) - 0.3, Math.abs(z) - 1.4, gableHw(x) - 0.5 - Math.abs(z), paneSd(x, Math.abs(z)) - 1.9);
      }, { offset: 0.08 }),
      mat: 'dShingleDark',
      name: 'decal-shingle-dark',
    });
    // 屋脊壓條（深色 2.4 mm），一路畫到鼻端，是貫穿全車的中線
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) ? Math.min(1.2, 0.3 * P.hw(x)) - Math.abs(z) : -1), { offset: 0.12 }),
      mat: 'dGroove',
      name: 'decal-ridge-board',
    });
    // 甲板木板縫：順著甲板外緣、每 4 mm 一道、線寬 0.8（屋頂以外的甲板與鼻段）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onRoof(x, y, z) || onShingles(x, y, z) || x > NOSE_PLAIN_X) {
          return -1;
        }
        const dz = P.hw(x) + EO - Math.abs(z);
        return Math.min(0.4 - Math.abs(((dz + 2) % 4) - 2), dz - 2, Math.abs(z) - gableHw(x) - 0.8);
      }, { offset: 0.1 }),
      mat: 'dGroove',
      name: 'decal-deck-planks',
    });
    /** @type {(x: number, y: number, z: number) => boolean} 側牆、輪拱外 */
    const onSideWall = (x, y, z) => onWall(x, y, z) && archRingDist(x, y) > 1;
    // 側裙
    parts.push({ geometry: buildSills(), mat: 'sill', solid: true, outline: true, name: 'side-sills' });
    // 速度線
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) ? -speedLines(x, y) : -1), { offset: 0.14 }),
      mat: 'dGroove',
      name: 'decal-speed-lines',
    });
    // 側牆三扇小窗：暖黃琥珀窗光＋和圓木同色系的深棕細窗框（0.6 mm 窗框、上方略寬的簷板、下方窗台、一道細十字窗格），像嵌在圓木牆裡的木框窗
    parts.push({
      geometry: kit.decal((x, y, z) => (onSideWall(x, y, z) ? -sideWindow(x, y).rect : -1), { offset: 0.16 }),
      mat: 'windowWarm',
      name: 'lamp-side-windows',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const { rect, dx, dy } = sideWindow(x, y);
        const ring = Math.min(rect, 0.6 - rect);
        const cornice = Math.min(3.7 - dx, 0.3 - Math.abs(dy - 3.3));
        const sill = Math.min(3.55 - dx, 0.25 - Math.abs(dy + 3.25));
        const sash = Math.min(-rect, 0.2 - Math.min(dx, Math.abs(dy)));
        return Math.max(ring, cornice, sill, sash);
      }, { offset: 0.18 }),
      mat: 'dFrameWood',
      name: 'decal-side-window-frame',
    });
    // 座艙窗：屋脊兩側一對琥珀暖光窗（V5 有色不透明座艙）＋白色窗框（寬 1.2）＋外圈藍色描邊＋深色木內框與一道窗格
    parts.push({
      geometry: kit.decal((x, y, z) => (onShingles(x, y, z) ? -paneSd(x, Math.abs(z)) : -1), { offset: 0.16 }),
      mat: 'window',
      name: 'lamp-cockpit',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onShingles(x, y, z)) {
          return -1;
        }
        const d = paneSd(x, Math.abs(z));
        return Math.min(d, 1.2 - d);
      }, { offset: 0.18 }),
      mat: 'dWhite',
      name: 'decal-cockpit-nalichnik',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onShingles(x, y, z)) {
          return -1;
        }
        const d = paneSd(x, Math.abs(z));
        return Math.min(d - 1.2, 1.9 - d);
      }, { offset: 0.18 }),
      mat: 'dBlue',
      name: 'decal-cockpit-izba-blue',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onShingles(x, y, z)) {
          return -1;
        }
        const d = paneSd(x, Math.abs(z));
        return Math.max(Math.min(-d, d + 0.8), Math.min(-d, 0.5 - Math.abs(x - 1.5)));
      }, { offset: 0.2 }),
      mat: 'dFrameWood',
      name: 'decal-window-sash-wood',
    });
    // 頭燈（V14，自創形狀）：鼻端兩側甲板上一對順著車長方向的暖光細縫＋紅框
    /** @type {(x: number, z: number) => number} */
    const lampSd = (x, z) => Math.max(Math.abs(x - 52.5) - 3.4, Math.abs(Math.abs(z) - 8) - 0.9);
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) && x > 48 ? -lampSd(x, z) : -1), { offset: 0.16 }),
      mat: 'window',
      name: 'lamp-head',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) && x > 48 ? Math.min(lampSd(x, z), 0.55 - lampSd(x, z)) : -1), { offset: 0.18 }),
      mat: 'dRed',
      name: 'decal-head-frame',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: `本檔站位產生器 P（推估）：前低後高的楔形車，殼 x ${X_REAR} ~ ${X_FRONT}；斷面是「圓木牆＋微拱甲板＋中央人字屋頂」：甲板外緣（肩線）後輪上方 28.6、前輪位置 25.6、鼻端 15.8；人字屋頂屋簷半寬 後段 15 → 往車頭收窄，屋脊 x 28 起離開甲板、後輪上方最高 40.8、車尾山牆 37.6；圓木牆半寬：腰身 29、後翼子板 41、車尾 17、甲板外伸 0.3（外框半寬約 41.4，≤ 48）；煙鰭頂 48.1（全車最高）、柵欄翼木樁尖頂 46.6`,
    wheelArches: '前後 R15（26 mm 輪胎半徑 13 + 2 mm）；31 mm 輪不切輪拱時間隙不足（需切輪拱）；前輪罩整個切開露出前輪（x 25 ~ 57、|z| ≥ 23.6），輪拱內襯只做後輪；前後都有輪胎內側環形擋板（buildArchWell）擋住殼內空腔',
    logs: '圓木：每側 2 根，殼面剖面每根鼓起 min(0.8, 0.2 × 圓木高) mm（車頭圓木變細時跟著縮，x 46 → 56 漸收為 0）；接縫為銳利稜線＋0.7 mm 深色填縫貼紙（推估）',
    cockpit: '座艙窗：屋脊兩側屋面上各一扇琥珀暖光窗（貼紙，x −12 ~ 15、|z| 2.6 → 屋簷內 3 mm）＋白色窗框（寬 1.2）、外圈 0.7 mm 藍色描邊、深色木內框與一道窗格（推估）',
    gable: '車尾山牆：封口本身是人字屋頂＋圓木牆的斷面；白色 Λ 形博風板（板高 1.7、厚 0.9 mm）＋直徑 4.2 的琥珀圓窗與白窗框；ABS 實心件（推估）',
    fence: '柵欄翼：每側三片尖頂木樁（寬 3.2、厚 1.2 mm，尖頂 43.2 / 45 / 46.6，根部 y 27.6 埋進後甲板）＋兩根橫木翼面（下段 6.6 × 1.2、上段 5.8 × 1.1，翼展 58.4 mm）；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    exhaust: '煙囪：右側屋面（z 6）立起、往後傾約 14° 的紅磚方煙囪（方形斷面邊長約 4.2 mm 的實心方柱）＋白灰管口環（邊長約 4.9、厚 1.3 mm）與黑色管口；管口後方一片往後飄的白色薄鰭（長約 21、頂 48.1、厚 1 mm）；均為 ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    vanes: '爪痕鰭：前輪切口後方甲板上每側三片往後掠的刀形薄板（長 20、頂 y 34.2、厚 1.1 mm，|z| 21.4 / 24.9 / 28.4，前端 x 22 / 24.5 / 27），橘黃；ABS 實心件（推估）',
    sideWindows: '側牆小窗：兩輪之間圓木牆上每側三扇（中心 x −13 / −4 / 5，玻璃 5.6 × 4.8）＋0.6 mm 深棕木窗框、上方簷板 7.4 × 0.6、下方窗台 7.1 × 0.5、0.4 mm 十字窗格，全為貼紙（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
