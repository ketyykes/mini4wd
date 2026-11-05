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
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';
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
  // 圓木牆面半寬（接縫處）：俯視是往後展開的楔形（V3）——尖窄車頭（7.5）→ 前輪上方翼子板 37.4（輪胎外緣 34.75 之外）→
  // 兩輪之間 29 的細腰 → 後輪上方最寬的後翼子板 43.5 → 平切的寬車尾 31（kamm tail）；俯視避開 tortoise-dome（四輪等寬凸包）、skeleton（等寬直框）、mantis-scythe（前寬後窄）的輪廓（IoU）
  // iter-128（第十階段 F3 重塑）：俯視維持細腰（加寬會讓俯視 IoU 和 trail-canopy 超過 0.845）；腰段下層裙身的內收量由 skirtIn 限制在 |z| ≥ 28
  // iter-128 修正（合併後俯視 IoU 撞 cerberus 0.857 / mushussu 0.850）：鼻段收窄（x 48 29.5 → 24.5、x 55 15.5 → 10、x 61 8.2 → 5.2、鼻端 5.5 → 3.6），
  // 這一段別款都比 yaga 寬，收窄只減少交集；前輪前半因此多露出一點。車尾兩角也倒角（x −67 27 → 22、x −62 33.5 → 27.5、x −54 40 → 36），最寬處 41 不變（正面面積不增加）
  hw: monoCurve(XS, [22, 27.5, 36, 41, 37.5, 30.5, 29, 29.5, 33.5, 37.4, 23, 9, 4.8, 3.4]),
  // 屋脊（中線殼頂）：iter-120 前低後高的楔形車頂——鼻端 18.4 一路往後升到後輪上方 35.6（原本是座艙段 41.5 的屋脊駝峰）
  // iter-127（評審連兩輪「仍是平板車」）：屋脊改成從車尾一路往前下壓的楔形——車尾 38 → 座艙 33.4 → 前輪上方 28.6 → 鼻端 16，
  // 側視像一間往前衝、低頭的小屋（原本 34.6 一路平到前輪才降）；屋簷 yS 不動（前輪擋泥板隆起與輪拱間隙不變）
  // iter-128：屋脊整條壓低（車尾 38 → 33.6），讓出正面面積給 2 段式瓦片後翼；仍是鼻端 16 往後升的楔形
  yTop: monoCurve(XS, [33.4, 34, 34.2, 33.9, 33.2, 32.4, 31.6, 30.6, 29.6, 28.6, 26.4, 23, 19.4, 16]),
  // 屋簷外緣高度（頂面與側面交界＝肩線）：前輪上方隆起成擋泥板（28.2，V1），往前壓到鼻端 16.6
  yS: monoCurve(XS, [28.6, 29.4, 30, 30.2, 29.4, 28.4, 27.6, 27, 27.2, 28.2, 25.6, 21.8, 18.2, 15.8]),
  // 側裙（最下一根圓木）下緣：車尾封口下緣 14.2（遮住後齒輪箱）
  yLow: monoCurve(XS, [17.5, 14.5, 12, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11.4, 12.2, 12.8, 13.2]),
};

/** @type {number} 屋簷外伸（屋面外緣超出圓木牆的距離）；iter-124：評審「屋簷懸在牆外像蓋了一張毯子」→ 1.4 → 0.3，屋簷貼齊圓木牆 */
const EO = 0.3;
/** @type {number} 封簷板高度 */
const FASCIA_H = 1.0;
/** @type {number} 屋簷底到牆頂（最上一根圓木上緣）的內收高度 */
const TUCK_H = 0.3;
/** @type {number} 圓木根數 */
const LOG_COUNT = 2;
/** @type {number} iter-128：下層深色裙身相對上層屋身的內收量（側視上下兩層量體） */
const SKIRT_IN = 2.4;
/**
 * 內收量：鼻端 10 mm 內漸收為 0（鼻端封口保持乾淨）；細腰段限制裙身外面 |z| ≥ 28（底盤側壁在 |z| 23–26，留殼厚 0.8 與間隙），最少 1.0
 * @type {(x: number) => number}
 */
const skirtIn = (x) => Math.max(0, Math.min(SKIRT_IN, Math.max(1.0, P.hw(x) - 28))) * Math.max(0, Math.min(1, (64 - x) / 10));
/** @type {number} 圓木鼓起量 */
const LOG_BULGE = 0.8;
/** @type {(L: number) => number} 圓木鼓起量（iter-120：車頭圓木變細，鼓起量跟著縮，最多 0.8） */
const logBulge = (L) => Math.min(LOG_BULGE, 0.2 * L);
/**
 * iter-122：圓木鼓起在車頭前 10 mm 漸收為 0（評審「前端圓木斷面像撕開的邊」→ 車頭封口是乾淨的平滑輪廓）
 * iter-125（評審「車頭圓木層往外張開像翻開的書頁」）：車頭收窄段（x 46 → 56）就把鼓起收掉，鼻端圓木牆是平整的一面，圓木只靠接縫與陰影帶貼紙表現
 * @type {(x: number) => number}
 */
const bulgeFade = (x) => Math.max(0, Math.min(1, (56 - x) / 10));

/** @type {(x: number) => number} 牆頂（最上一根圓木上緣）高度 */
const yWallTop = (x) => P.yS(x) - FASCIA_H - TUCK_H;
/** @type {(x: number) => number} iter-128：上層屋身（2 根圓木）下緣高度；以下是內收的深色裙身 */
const yLogBot = (x) => yWallTop(x) - Math.min(7.6, 0.55 * (yWallTop(x) - P.yLow(x)));
/** @type {(x: number) => number} 每根圓木高度 */
const logH = (x) => (yWallTop(x) - yLogBot(x)) / LOG_COUNT;
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
    pts.push([h + logBulge(L) * bulgeFade(x), yT - 0.5 * L], [h, yT - L]);
  }
  // iter-128：屋身下緣往內收一階（屋簷底面），下層深色裙身垂直到底
  const k = skirtIn(x);
  pts.push([h - k, yLogBot(x) - 0.35 * Math.min(1, k)], [h - k, P.yLow(x)]);
  return pts;
};
/** @type {number[]} 銳利稜線：屋簷外緣、封簷板下緣、牆頂、圓木接縫、屋身下緣、裙身內收角 */
const HARD = [2, 3, 4, 6, 8, 9];

/** @type {{ x: number, pts: number[][] }[]} 車尾與車頭每 1 mm 一站（iter-120：0.75 → 1，曲面內部每 0.5 mm 取樣，0.75 會變成每 0.375 mm 一列），中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -55, 1, profile).slice(0, -1), ...buildStations(-55, 55, 2, profile).slice(0, -1), ...buildStations(55, X_FRONT, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R15：26 mm 輪胎半徑 13 + 2 mm；31 mm 輪需切輪拱） */
const ARCHES = [
  { x: 40, y: 13, radius: 15, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 15, cutZFrom: 22.5 },
];
/** @type {number} iter-128：前輪露出切口的斜切斜率（側視 dy/dx） */
const CUT_SLOPE = 1.1;
/**
 * iter-128（F3 半罩露輪）：前輪罩後半斜切開，露出輪胎後上方約 1/3（側視與俯視都看得到胎面）。
 * 切口範圍：|z| ≥ 23.6（輪胎內側面 22.75 之外）、x 25 → 45、輪心高以上；切口後緣是一條往前上方的斜線（x 25 處 y 20 → x 32 處 y 27.7 切過屋簷），
 * 前輪拱前半（x > 42）的擋泥板保留，像小屋往前跨出去的一隻腳；負值 = 開口內
 * @type {(x: number, y: number, z: number) => number}
 */
const frontCutSd = (x, y, z) => {
  if (Math.abs(z) < 23.6) {
    return 10;
  }
  const slant = (y - 20 - (x - 25) * CUT_SLOPE) / Math.hypot(1, CUT_SLOPE);
  return Math.max(25 - x, x - 45, 12 - y, slant);
};

/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, y: number, z: number) => boolean} 屋面 */
const onRoof = (x, y, z) => y > P.yS(x) - 0.05 && Math.abs(z) < P.hw(x) + EO - 0.05;
/** @type {(x: number, y: number, z: number) => boolean} 圓木牆 */
const onWall = (x, y, z) => y < yWallTop(x) + 0.05 && Math.abs(z) > P.hw(x) - 0.3;
/** @type {(x: number, y: number) => number} 圓木編號（0 = 最上一根） */
const logIndex = (x, y) => Math.floor((yWallTop(x) - y) / logH(x));

/** @type {number} 木瓦直列的列距（iter-124：固定 |z| 間距，從屋脊往外量；評審「瓦片紋在曲面上扭成波浪」→ 列線是俯視的直線，不再跟著屋簷外緣彎） */
const SHINGLE_ROW = 3.4;
/** @type {number} iter-127：鼻端楔形段起點 x（之前不畫瓦縫與深色瓦） */
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

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 原木：霧面（roughness 0.65–0.75）
  log: namedMaterial('paint-log-pine', { color: 0x8c5a32, roughness: 0.7, clearcoat: 0.03 }),
  logDark: namedMaterial('paint-log-pine-aged', { color: 0x74482a, roughness: 0.72, clearcoat: 0.03 }),
  gable: namedMaterial('paint-gable-plank', { color: 0x5e3b22, roughness: 0.72, clearcoat: 0.03 }),
  // 木瓦屋頂（風化的白楊木瓦：深灰褐，霧面）
  // iter-122：木瓦改成深炭灰（和 trojan / serpent / tanngrisnir 的木褐低平車拉開），屋簷底與車頭封口是 izba 彩繪的藍
  shingle: namedMaterial('paint-shingle-charcoal', { color: 0x3a3e44, roughness: 0.74, clearcoat: 0.04 }),
  shingleDark: namedMaterial('paint-shingle-charcoal-dark', { color: 0x2a2d32, roughness: 0.76, clearcoat: 0.04 }),
  soffit: namedMaterial('paint-izba-blue', { color: 0x2a5aa0, roughness: 0.6, clearcoat: 0.08 }),
  // 白色窗飾 / 封簷板 / 博風板（白漆木作，霧面）
  white: namedMaterial('paint-nalichnik-white', { color: 0xf0ece2, roughness: 0.6, clearcoat: 0.05 }),
  white2: namedMaterial('paint-nalichnik-white', { color: 0xf0ece2, roughness: 0.6, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 排氣管：紅磚＋白灰管口環（霧面）
  brick: namedMaterial('paint-brick-red', { color: 0x9b4a32, roughness: 0.78, clearcoat: 0.0 }),
  // 窗內暖光
  // iter-122：評審「座艙暖光偏白過曝像白標籤」→ 改成較深的琥珀底色＋低強度自發光
  // iter-125（評審「座艙光仍像一張貼紙」）：窗光再壓一階（不過曝），由深色木窗框＋十字窗格框住
  window: namedMaterial('lamp-window-amber', { color: 0x9c5418, emissive: 0x8a3806, emissiveIntensity: 0.15, roughness: 0.3, clearcoat: 0.5 }),
  // 雞腳：褐色羽毛大腿（霧面）＋亮黃橙跗蹠與趾（緞面，和深色木瓦、圓木強對比）＋深色爪尖
  feather: namedMaterial('paint-hen-feather-brown', { color: 0x5a3519, roughness: 0.72, clearcoat: 0.02 }),
  claw: namedMaterial('paint-claw-ochre', { color: 0xf0a020, roughness: 0.5, clearcoat: 0.15 }),
  clawTip: namedMaterial('paint-claw-horn', { color: 0x2b1e14, roughness: 0.5, clearcoat: 0.1 }),
  // 側裙（腰部遮住底盤的踏板）：深炭灰
  sill: namedMaterial('paint-sill-charcoal', { color: 0x2c2f33, roughness: 0.62, clearcoat: 0.08 }),
  // iter-127：往後飄的煙流（霧面暖灰白）
  // iter-128：煙流背鰭（霧面暖灰白；材質與網格名稱都不含 smoke，避免 Blender 當成玻璃）
  plume: namedMaterial('paint-ash-plume', { color: 0xd6d1c8, roughness: 0.92, clearcoat: 0.0, side: THREE.DoubleSide }),
  hole: namedMaterial('plastic-chimney-black', { color: 0x120d0a, roughness: 0.9 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-wood', { color: 0x4a2f1b, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-wood', { color: 0x2e1f14, roughness: 0.8, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGroove: decalMaterial('decal-moss-caulk', { color: 0x2b2116, roughness: 0.85 }),
  // iter-125：圓木上下緣的陰影帶（比圓木深兩階的木褐）與中段的受光帶 → 讀成一根根圓柱形圓木
  dLogShade: decalMaterial('decal-log-shade', { color: 0x4e2f19, roughness: 0.78 }),
  dLogLight: decalMaterial('decal-log-highlight', { color: 0xa66d3c, roughness: 0.68 }),
  // iter-125：座艙窗的深色木窗框與十字窗格
  dFrameWood: decalMaterial('decal-window-frame-wood', { color: 0x3a2414, roughness: 0.7 }),
  dShingleGap: decalMaterial('decal-shingle-gap', { color: 0x17191c, roughness: 0.85 }),
  dShingleDark: decalMaterial('decal-shingle-charcoal-dark', { color: 0x2a2d32, roughness: 0.76 }),
  dWhite: decalMaterial('decal-nalichnik-white', { color: 0xf0ece2, roughness: 0.6 }),
  dRed: decalMaterial('decal-window-red', { color: 0xb3302a, roughness: 0.58 }),
  dBlue: decalMaterial('decal-izba-blue', { color: 0x2a5aa0, roughness: 0.6 }),
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
      // 下緣：車尾封口是 4 個半圓扇的波浪雕花；iter-124 車頭封口改成直邊（評審「車頭白色山牆板像荷葉邊」）
      const depth = dir > 0 ? 1.0 : 1.0 + 0.5 * Math.abs(Math.sin(Math.PI * q * 4));
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

/** @type {number} iter-128：煙囪中心 x（座艙正後方屋脊上） */
const CHIMNEY_X = -20.5;
/** @type {number} 煙囪頂高度 */
const CHIMNEY_TOP = 36.4;
/** @type {{ le: number[], te: number[], thick: number, span: number }[]} iter-128：2 段式瓦片後翼（主翼、上翼）：前緣 / 後緣 (x, y)、厚度、半翼展 */
const WING_ELEMENTS = [
  { le: [-46.5, 37.4], te: [-58.5, 38.4], thick: 1.2, span: 26 },
  { le: [-56, 40.4], te: [-66.5, 41.8], thick: 1.1, span: 21 },
];

/**
 * 翼斷面（側視多邊形）：前緣圓鈍、後緣收薄，弦線從 le 到 te；上表面拱起 thick
 * @type {(le: number[], te: number[], thick: number) => number[][]}
 */
const wingSection = (le, te, thick) => {
  /** @type {number[][]} */
  const up = [];
  /** @type {number[][]} */
  const lo = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const q = i / n;
    const x = lerp(le[0], te[0], q);
    const y = lerp(le[1], te[1], q);
    // 厚度分布：前 30% 最厚，往後緣收到 0.35
    const th = thick * Math.max(0.27, Math.sin(Math.PI * Math.min(1, q / 0.6) * 0.5 + (q > 0.3 ? 0 : 0)) * (1 - 0.73 * Math.max(0, q - 0.3) / 0.7));
    up.push([x, y + 0.62 * th]);
    lo.push([x, y - 0.38 * th]);
  }
  return [...up, ...lo.reverse()];
};

/**
 * iter-128：2 段式瓦片後翼＋白色博風板端板＋煙囪＋往後飛揚的煙流背鰭。
 * 木瓦屋頂延伸成主翼與上翼（不是 3 段）；端板是封口博風板的造型（下緣貼著屋面、後上角往後掃）；
 * 煙流背鰭從煙囪口往後上方飛揚，越過車頂接到主翼中央（兼主翼中央支柱），上緣是 3 團被風拉長的煙
 * @type {() => { planes: THREE.BufferGeometry, endplates: THREE.BufferGeometry, chimney: THREE.BufferGeometry, cap: THREE.BufferGeometry, flue: THREE.BufferGeometry, plume: THREE.BufferGeometry }}
 */
const buildRearWing = () => {
  const planes = mergeGeos(WING_ELEMENTS.map((w) => finPlate(wingSection(w.le, w.te, w.thick), 0, 2 * w.span)));
  /** @type {THREE.BufferGeometry[]} */
  const ends = [];
  const zE = 21.4; // iter-128 修正：車尾倒角後端板內移，仍在屋面之內
  for (const sg of [-1, 1]) {
    /** @type {number[][]} */
    const pts = [];
    const n = 8;
    // 下緣：沿屋面（|z| = zE）往後；上緣：前低後高往後掃
    for (let i = 0; i <= n; i++) {
      const x = lerp(-44, -66.8, i / n);
      pts.push([x, roofY(x, zE) - 0.6]);
    }
    pts.length = 0;
    // 前緣是一支從屋面往後上方斜立的支柱，上半是往後掃的博風板帶（不做整片立板）
    pts.push([-43.5, roofY(-43.5, zE) - 0.6], [-48.5, roofY(-48.5, zE) - 0.6], [-58, 36.4], [-67.6, 39.4], [-68.4, 43.6], [-63, 44.2], [-55, 41.2], [-46.5, 38.9]);
    ends.push(finPlate(pts.reverse(), sg * zE, 1.3));
  }
  const ry = P.yTop(CHIMNEY_X);
  const chimney = new THREE.BoxGeometry(4.6, CHIMNEY_TOP - ry + 1.6, 4.0);
  chimney.translate(CHIMNEY_X, (CHIMNEY_TOP + ry - 1.6) / 2, 0);
  const cap = new THREE.BoxGeometry(5.6, 1.0, 5.0);
  cap.translate(CHIMNEY_X, CHIMNEY_TOP + 0.4, 0);
  const flue = new THREE.BoxGeometry(3.2, 0.3, 2.6);
  flue.translate(CHIMNEY_X - 0.3, CHIMNEY_TOP + 0.95, 0);
  // 煙流背鰭：側視多邊形，下緣貼屋脊，上緣從煙囪口往後上升到主翼前緣上方，3 團煙的起伏
  /** @type {number[][]} */
  const top = [];
  const n = 18;
  const xa = CHIMNEY_X + 1.0;
  const xb = -52;
  for (let i = 0; i <= n; i++) {
    const q = i / n;
    const x = lerp(xa, xb, q);
    const puff = 0.9 * Math.sin(Math.PI * ((q * 3) % 1)) ** 2 * (1 - 0.4 * q);
    top.push([x, lerp(CHIMNEY_TOP + 1.3, 40.6, q ** 0.85) + puff]);
  }
  /** @type {number[][]} */
  const bottom = [];
  for (let i = 0; i <= 8; i++) {
    const x = lerp(xb, CHIMNEY_X - 2.3, i / 8);
    bottom.push([x, P.yTop(x) - 1.0]);
  }
  bottom.push([CHIMNEY_X - 2.3, CHIMNEY_TOP]);
  const plume = finPlate([...top, ...bottom].reverse(), 0, 1.5);
  return { planes, endplates: mergeGeos(ends), chimney, cap, flue, plume };
};

/**
 * 後傾排氣管（iter-120：直立煙囪 → 從後輪上方屋脊往車尾倒下的磚紅排氣管，wing 仍是 chimney-stack）：
 * 管根埋進屋脊 x −36，管口在 x −54、y 約 39.4（後傾約 66°），白灰管口環＋黑色管口
 * @type {() => { pipe: THREE.BufferGeometry, ring: THREE.BufferGeometry, flue: THREE.BufferGeometry }}
 */
const buildExhaust = () => {
  const a = new THREE.Vector3(-35.5, P.yTop(-35.5) - 1.2, 0);
  // iter-127：屋脊後段升高，管口跟著抬到 y 42.4（仍往後傾）
  const b = new THREE.Vector3(-57, 42.4, 0);
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
 * 往後飄的煙流（iter-127）：從排氣管口往後、微微上升的 3 團漸小的煙（沿 x 拉長的橢球，彼此重疊成一道煙尾），
 * 側視讀成「奔跑中的小屋冒著煙」；最後一團停在車尾封口 x −67 之內
 * @type {() => THREE.BufferGeometry}
 */
const buildSmoke = () => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const [x, y, r, sx] of [
    [-59.4, 44.0, 2.3, 1.35],
    [-62.8, 45.0, 1.9, 1.5],
    [-65.6, 45.5, 1.4, 1.6],
  ]) {
    const g = new THREE.SphereGeometry(r, 12, 8);
    g.scale(sx, 1, 1);
    g.translate(x, y, 0);
    geos.push(g);
  }
  return mergeGeos(geos);
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
 * 側裙（iter-122：評審「腰部露底盤」）：兩輪之間從圓木牆根部往外伸到 |z| 39.4 的踏板（厚 1.8 mm），蓋住底盤側框頂面；
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

/**
 * 奔跑的雞腳（iter-122：iter-120 的平面貼紙「三個視角都看不到」→ 改成立體實體件，從圓木牆伸出、腳掌踩在側裙上）：
 * 每側一隻往前跨（膝抬高、腳掌在前輪拱後）、一隻往後蹬（腿往後伸直、腳掌在後輪拱前）；
 * 羽毛大腿從牆面伸出 → 黃橙跗蹠往外下斜到側裙頂面 → 三前一後的趾攤在側裙上、最外側趾尖伸到側裙外緣。
 * [髖 x, 膝 x, 踝 x]（右側；z 由牆面往外推算）
 * @type {number[][]}
 */
const LEGS = [
  // iter-128：腰側只留往後蹬的後腳；前腳改成跨過露出前輪的擋泥板支柱（buildFenderLeg）
  [-4, -10.5, -18],
];

/**
 * iter-128：雞腳擋泥板支柱——前輪罩斜切後，一隻雞腳從前輪罩前半的屋簷長出，羽毛大腿往後上方跨過露出的輪胎（膝高 29），
 * 黃橙跗蹠往後下斜到前輪後方的側裙頂面，趾往後外攤開（蹬地）。整隻腳在 |z| 36.3–38.4（輪胎外緣 34.75 之外 ≥ 1.4 mm）。
 * 俯視時它把切口外緣圍起來，車殼俯視輪廓和切口前一樣完整（IoU 不變），側視則看得到胎面從腿下露出
 * @type {() => { thigh: THREE.BufferGeometry, leg: THREE.BufferGeometry, tips: THREE.BufferGeometry }}
 */
const buildFenderLeg = () => {
  /** @type {THREE.BufferGeometry[]} */
  const thighs = [];
  /** @type {THREE.BufferGeometry[]} */
  const legs = [];
  /** @type {THREE.BufferGeometry[]} */
  const tips = [];
  for (const sg of [-1, 1]) {
    // 髖根埋進前輪罩前半的屋簷頂面（x 47），往後外上方跨出
    const hip = [47.5, P.yS(47.5) + 1.5, sg * (P.hw(47.5) - 0.6)];
    const knee = [32.5, 29, sg * 37.4];
    const ankle = [23.6, SILL_Y1 + 1.2, sg * 37.2];
    thighs.push(smoothNormals(sweepEllipse([hip, [39.5, 29.6, sg * 35.6], knee], 8, (q) => [lerp(1.6, 1.5, q), lerp(1.6, 1.5, q)], 8)));
    legs.push(smoothNormals(sweepEllipse([knee, [28, 23, sg * 37.6], ankle], 8, (q) => [lerp(1.05, 0.85, q), lerp(1.05, 0.85, q)], 8)));
    for (const [c, r] of [
      [knee, 1.5],
      [ankle, 1.1],
    ]) {
      const ball = new THREE.SphereGeometry(r, 8, 6);
      ball.translate(...c);
      legs.push(ball);
    }
    // 趾：蹬地時往後、往外攤開（不朝前，避開輪胎）
    for (const [dx, dz, len] of [
      [-1, 0.1, 5.0],
      [-0.8, 0.5, 4.4],
      [-0.85, -0.45, 3.8],
    ]) {
      const l = Math.hypot(dx, dz);
      const ux = dx / l;
      const uz = (sg * dz) / l;
      const p0 = ankle;
      const p2 = [ankle[0] + ux * len, SILL_Y1 + 0.5, ankle[2] + uz * len];
      const p1 = [lerp(p0[0], p2[0], 0.5), SILL_Y1 + 0.8, lerp(p0[2], p2[2], 0.5)];
      legs.push(smoothNormals(sweepEllipse([p0, p1, p2], 4, (q) => [lerp(0.7, 0.5, q), lerp(0.6, 0.45, q)], 6)));
      const tip = new THREE.ConeGeometry(0.48, 1.4, 6);
      tip.rotateZ(-Math.PI / 2);
      tip.rotateY(-Math.atan2(uz, ux));
      tip.translate(p2[0] + ux * 0.6, SILL_Y1 + 0.45, p2[2] + uz * 0.6);
      tips.push(tip);
    }
  }
  return { thigh: mergeGeos(thighs), leg: mergeGeos(legs), tips: mergeGeos(tips) };
};

/**
 * @type {() => { thigh: THREE.BufferGeometry, leg: THREE.BufferGeometry, tips: THREE.BufferGeometry }}
 */
const buildHenLegs = () => {
  /** @type {THREE.BufferGeometry[]} */
  const thighs = [];
  /** @type {THREE.BufferGeometry[]} */
  const legs = [];
  /** @type {THREE.BufferGeometry[]} */
  const tips = [];
  for (const sg of [-1, 1]) {
    for (const [hx, kx, ax] of LEGS) {
      // iter-128：髖從上層屋身下緣底下伸出（內收裙身面上），膝蓋凸出屋身外側
      const hip = [hx, yLogBot(hx) - 1.2, sg * (P.hw(hx) - skirtIn(hx) + 0.6)];
      const knee = [kx, kx > 0 ? 19.6 : 18.2, sg * (P.hw(kx) + 1.4)];
      const ankle = [ax, SILL_Y1 + 1.0, sg * 34.2];
      // 羽毛大腿（粗 4.4 → 3.2）
      thighs.push(smoothNormals(sweepEllipse([hip, [lerp(hip[0], knee[0], 0.5), lerp(hip[1], knee[1], 0.5) + 0.5, lerp(hip[2], knee[2], 0.5)], knee], 6, (q) => [lerp(2.2, 1.6, q), lerp(2.2, 1.6, q)], 8)));
      // 跗蹠（粗 2.2 → 1.8）＋膝、踝關節
      legs.push(smoothNormals(sweepEllipse([knee, [lerp(knee[0], ankle[0], 0.5), lerp(knee[1], ankle[1], 0.5), lerp(knee[2], ankle[2], 0.5)], ankle], 6, (q) => [lerp(1.1, 0.9, q), lerp(1.1, 0.9, q)], 8)));
      for (const [c, r] of [
        [knee, 1.5],
        [ankle, 1.15],
      ]) {
        const ball = new THREE.SphereGeometry(r, 8, 6);
        ball.translate(...c);
        legs.push(ball);
      }
      // 趾：[往前 dx, 往外 dz, 長]；三前趾往前張開、最外趾伸到側裙外緣，一根後趾
      for (const [dx, dz, len] of [
        [1, 0, 5.4],
        [0.85, 0.42, 5.0],
        [0.85, -0.5, 4.2],
        [-1, 0.1, 2.8],
      ]) {
        const l = Math.hypot(dx, dz);
        const ux = dx / l;
        const uz = (sg * dz) / l;
        const p0 = ankle;
        const p2 = [ankle[0] + ux * len, SILL_Y1 + 0.5, ankle[2] + uz * len];
        const p1 = [lerp(p0[0], p2[0], 0.5), SILL_Y1 + 0.75, lerp(p0[2], p2[2], 0.5)];
        legs.push(smoothNormals(sweepEllipse([p0, p1, p2], 4, (q) => [lerp(0.7, 0.5, q), lerp(0.6, 0.45, q)], 6)));
        // 爪尖
        const tip = new THREE.ConeGeometry(0.48, 1.4, 6);
        tip.rotateZ(-Math.PI / 2);
        tip.rotateY(-Math.atan2(uz, ux));
        tip.translate(p2[0] + ux * 0.6, SILL_Y1 + 0.45, p2[2] + uz * 0.6);
        tips.push(tip);
      }
    }
  }
  return { thigh: mergeGeos(thighs), leg: mergeGeos(legs), tips: mergeGeos(tips) };
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
  openings: [{ id: '前輪露出斜切', shape: 'fn', sd: frontCutSd }],
  sideZMin: 22,
  zones: () => [
    // 白色封簷板（屋簷外緣的垂直板）
    // iter-125（評審「圓木牆變成淺米灰，像一疊紙頁」）：iter-124 屋簷外伸 1.4 → 0.3 後，圓木鼓起（牆面外 0.8 mm）也落在 |z| > 半寬 + 0.22 的判定內，
    // 每根圓木中段被塗成白色封簷板色 → 只剩接縫是木色。改成只在牆頂以上（封簷板與屋簷外緣）才判白色，圓木牆回到木褐色
    { mat: 'white', keep: (x, y, z) => (y > yWallTop(x) + 0.15 ? Math.abs(z) - (P.hw(x) + EO - 0.08) : -1) },
    // 屋簷底（深色內收）
    { mat: 'soffit', keep: (x, y, z) => (y > yWallTop(x) - 0.1 && y < P.yS(x) - FASCIA_H + 0.05 && Math.abs(z) > P.hw(x) + 0.05 ? 1 : -1) },
    // 木瓦（iter-124：深淺交錯的深色瓦片改成貼紙 decal-shingle-dark，殼面不再沿瓦片邊界切分，殼面三角面數不增）
    { mat: 'shingle', keep: (x, y, z) => (onRoof(x, y, z) ? 1 : -1) },
    // iter-128：下層內收裙身與屋身下緣底面（深炭灰，和上層原木屋身分成兩層）
    { mat: 'sill', keep: (x, y, z) => (y < yLogBot(x) + 0.05 && Math.abs(z) < P.hw(x) - 0.3 ? 1 : -1) },
    // 圓木牆：深淺交錯（同一批木料的色差）
    { mat: 'logDark', keep: (x, y) => (logIndex(x, y) % 2 === 1 ? 1 : -1) },
    { mat: 'log', keep: () => 1 },
  ],
  // 車頭小山牆：屋簷以上是深色山牆板，以下是圓木
  // iter-122：車頭封口（鼻端）上半白色山牆板、下半 izba 藍彩繪（乾淨的平滑封口）
  capFrontBands: [{ yMin: P.yS(X_FRONT) - FASCIA_H, mat: 'white' }, { mat: 'soffit' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'log', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）＋輪胎內側環形擋板（kitsune-ninetail 的 buildArchWell，擋住輪室看進車身內部）
    // iter-128：前輪拱後半已切開露輪，內襯只做後輪（前輪內襯會浮在切口裡）
    parts.push({ geometry: buildProfileLiner(ARCHES[1], 22.9, profile), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 15.6, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });
    // 前後封口博風板＋屋脊垂飾
    parts.push({ geometry: mergeGeos([buildBargeboards(X_FRONT, 1), buildBargeboards(X_REAR, -1)]), mat: 'white2', solid: true, outline: true, name: 'gable-bargeboards' });
    // iter-128：2 段式瓦片後翼＋博風板端板＋煙囪＋煙流背鰭（取代 iter-120 的後倒排氣管與 iter-127 的煙球）
    const wing = buildRearWing();
    parts.push({ geometry: wing.planes, mat: 'shingle', solid: true, outline: true, name: 'shingle-wing' });
    parts.push({ geometry: wing.endplates, mat: 'white2', solid: true, outline: true, name: 'bargeboard-endplates' });
    parts.push({ geometry: wing.chimney, mat: 'brick', solid: true, outline: true, name: 'chimney-stack' });
    parts.push({ geometry: wing.cap, mat: 'white', solid: true, outline: true, name: 'chimney-cap' });
    parts.push({ geometry: wing.flue, mat: 'hole', solid: true, name: 'chimney-flue' });
    parts.push({ geometry: wing.plume, mat: 'plume', solid: true, outline: true, name: 'chimney-plume-fin' });

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
    // iter-125：每根圓木上下緣的陰影帶（接縫外 0.35 → 0.35 + 0.2 × 圓木高）＋中段受光帶（± 0.1 × 圓木高），讀成圓柱形圓木
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
    // 木瓦縫（iter-124 直列瓦）：沿車長方向的直列縫（固定 |z|）＋每片之間的橫向搭接縫（固定 x，相鄰列錯開半片），線寬 0.6
    parts.push({
      geometry: kit.decal((x, y, z) => {
        // iter-127（評審「鼻端瓦片屋頂邊緣呈鋸齒、往下翻，像紙邊」）：楔形鼻段（x > 49）不畫瓦縫，鼻端是一片乾淨的炭灰屋面
        if (!onRoof(x, y, z) || x > NOSE_PLAIN_X) {
          return -1;
        }
        const g = shingleGrid(x, z);
        // 屋脊兩側 1.2 mm 不畫（屋脊壓條）；屋簷外緣 0.6 mm 內不畫（留給白色封簷板收邊）
        return Math.min(0.3 - Math.min(g.colLine, g.courseLine), Math.abs(z) - 1.4, P.hw(x) + EO - 0.6 - Math.abs(z));
      }, { offset: 0.1 }),
      mat: 'dShingleGap',
      name: 'decal-shingle-gaps',
    });
    // 深色木瓦（直列瓦每 3 片一片深色；只畫在瓦縫之內）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onRoof(x, y, z) || x > NOSE_PLAIN_X) {
          return -1;
        }
        const g = shingleGrid(x, z);
        if ((((g.col + g.course) % 3) + 3) % 3 !== 0) {
          return -1;
        }
        return Math.min(Math.min(g.colLine, g.courseLine) - 0.3, Math.abs(z) - 1.4, P.hw(x) + EO - 0.6 - Math.abs(z));
      }, { offset: 0.08 }),
      mat: 'dShingleDark',
      name: 'decal-shingle-dark',
    });
    // 屋脊壓條（深色 2.4 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) ? 1.2 - Math.abs(z) : -1), { offset: 0.12 }),
      mat: 'dGroove',
      name: 'decal-ridge-board',
    });
    /** @type {(x: number, y: number, z: number) => boolean} 側牆、輪拱外 */
    const onSideWall = (x, y, z) => onWall(x, y, z) && archRingDist(x, y) > 1;
    // 側裙（iter-122）＋立體奔跑雞腳（iter-122）
    parts.push({ geometry: buildSills(), mat: 'sill', solid: true, outline: true, name: 'side-sills' });
    const hen = buildHenLegs();
    const fl = buildFenderLeg();
    parts.push({ geometry: mergeGeos([hen.thigh, fl.thigh]), mat: 'feather', solid: true, outline: true, name: 'hen-thighs' });
    parts.push({ geometry: mergeGeos([hen.leg, fl.leg]), mat: 'claw', solid: true, outline: true, name: 'hen-legs' });
    parts.push({ geometry: mergeGeos([hen.tips, fl.tips]), mat: 'clawTip', solid: true, outline: true, name: 'hen-claw-tips' });
    // 速度線
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
    // izba 彩繪：白色座艙框外圈一道 0.8 mm 藍色描邊（iter-122）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y, z)) {
          return -1;
        }
        const d = cockpitFrameSd(x, z);
        return Math.min(d, 0.8 - d);
      }, { offset: 0.18 }),
      mat: 'dBlue',
      name: 'decal-cockpit-izba-blue',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y, z)) {
          return -1;
        }
        // iter-125：紅色細窗櫺 → 深色木窗框（內緣 1.1 mm）＋十字窗格（寬 1.0 mm），窗光被分成四格
        const d = cockpitSd(x, z);
        const ring = Math.min(-d, d + 1.1);
        const cross = Math.min(-d, 0.5 - Math.min(Math.abs(z), Math.abs(x - 6.5)));
        return Math.max(ring, cross);
      }, { offset: 0.2 }),
      mat: 'dFrameWood',
      name: 'decal-window-sash-wood',
    });
    // 頭燈（V14，自創形狀）：鼻端兩側屋面上一對暖光小方窗＋紅框
    /** @type {(x: number, z: number) => number} */
    const lampSd = (x, z) => Math.max(Math.abs(x - 58.5) - 1.8, Math.abs(Math.abs(z) - 6.6) - 1.5);
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
