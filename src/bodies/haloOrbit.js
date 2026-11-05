// 行星環（body-halo-orbit，致敬《爆走兄弟》風格）：卵石形中高車身＋後輪側裙、環繞一圈的煙燻玻璃帶、
// 車尾後傾 30° 的封閉環形翼（光環兼作尾翼，下緣經翼根整流座嵌入車尾，不用支柱）。
// 設計：shared/design/body-halo-orbit/DESIGN.md（致敬語彙、和劇中車 / 市售車殼的差異）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：洋紅＋石墨灰＋白、點狀星軌線、號碼「08」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sdConvexPolygon, sideDecal, mergeGeos, lerp, smoothstep, buildRegion, buildRim } from './loft.js';
import { monoCurve, buildStations, sdCircle, buildArchLiner, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前） */
const XS = [-68, -60, -50, -40, -28, -14, 0, 14, 28, 40, 50, 60, 68, 76];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：卵石形，最高點在軸距中點略後（36），前後圓滑下降
  yC: monoCurve(XS, [23.5, 29.5, 32.5, 34.5, 35.8, 36.2, 35.8, 34.5, 31.5, 28.5, 25.5, 21.5, 18, 14.5]),
  // 側壁肩（側面唯一的銳利稜線）
  yS: monoCurve(XS, [20.5, 23, 24.5, 25, 24.5, 24, 23.5, 23, 22, 21, 19.5, 17, 15, 13]),
  // 半寬：淚滴平面——後輪側裙處最寬（45），往前收成圓鼻
  hw: monoCurve(XS, [22, 40.5, 45.5, 46, 46, 45, 42, 38, 36, 35.5, 32, 25, 17, 7]),
  // 側壁下緣：後輪側裙往下蓋住輪胎外側（9.8）、車尾抬起
  yLow: monoCurve(XS, [19, 15, 11, 9.8, 9.8, 9.8, 9.8, 9.8, 10.5, 12, 13, 13.5, 13.5, 13.5]),
};

/** @type {number[]} 頂面 6 點在半寬上的比例 */
const FR = [0, 0.2, 0.4, 0.58, 0.74, 0.88];

/**
 * 半剖面 8 點：頂面 6 點（冠狀曲線）＋側壁肩＋側壁下緣
 * 前輪上方的頂面沿輪拱圓柱（R16）抬高，形成圓潤的前葉子板鼓包（不被輪拱切開）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yS = P.yS(x);
  const hw = P.hw(x);
  const yLow = Math.min(P.yLow(x), yS - 1);
  const archTop = 13 + Math.sqrt(Math.max(0, 16.8 ** 2 - (x - 40) ** 2));
  const pts = FR.map((f) => {
    const z = f * hw;
    let y = yS + (yC - yS) * (1 - f ** 2.4);
    // 前葉子板：|z| 20–38 之間抬到輪拱圓柱之上
    const w = smoothstep(14, 22, z) * smoothstep(hw + 2, hw - 6, z);
    y = Math.max(y, lerp(y, archTop + 0.6, w));
    // 座艙圓頂：玻璃帶所在的橢圓區域再鼓起 4 mm（頭盔狀，讓玻璃帶落在圓頂側面）
    const q = 1 - ((x + 4) / 38) ** 2 - (z / 32) ** 2;
    y += 4.2 * Math.max(0, q) ** 0.8;
    return [z, y];
  });
  pts.push([hw, Math.min(yS, pts[5][1] - 0.6)], [hw, yLow]);
  return pts;
};

const STATIONS = buildStations(-68, 76, 2, profile);

/** 玻璃帶（俯視兩個橢圓之間的環） */
const GLASS = { cx: -4, ao: 33, bo: 31.5, ai: 21, bi: 18 };
/** @type {(x: number, z: number, a: number, b: number) => number} 正規化橢圓距離（< 1 在內） */
const ell = (x, z, a, b) => Math.hypot((x - GLASS.cx) / a, z / b);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  magenta: namedMaterial('paint-magenta', { color: 0xd4176f, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  magenta2: namedMaterial('paint-magenta', { color: 0xd4176f, roughness: 0.2, clearcoat: 1.0, side: THREE.DoubleSide }),
  graphite: namedMaterial('paint-graphite', { color: 0x34373d, roughness: 0.32, metalness: 0.35, clearcoat: 0.7 }),
  graphite2: namedMaterial('paint-graphite', { color: 0x34373d, roughness: 0.32, metalness: 0.35, clearcoat: 0.7, side: THREE.DoubleSide }),
  // 環繞玻璃帶：不透明的深煙燻（V5「小而有色的座艙」的變形）
  smoke: namedMaterial('glass-smoke-band', { color: 0x14161c, roughness: 0.04, metalness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.02 }),
  // 車尾兩側的亮黑收腰（讓洋紅車身從側面看起來不那麼胖）
  black: namedMaterial('paint-gloss-black', { color: 0x0e0f12, roughness: 0.18, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.04 }),
  white: namedMaterial('paint-gloss-white', { color: 0xf4f3f0, roughness: 0.25, clearcoat: 0.9 }),
  white2: namedMaterial('paint-gloss-white', { color: 0xf4f3f0, roughness: 0.25, clearcoat: 0.9, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1a1e, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-magenta', { color: 0x8e1048, roughness: 0.5, side: THREE.DoubleSide }),
  recess: namedMaterial('plastic-gill-black', { color: 0x050505, roughness: 0.9, side: THREE.DoubleSide }),
  recessWall: namedMaterial('paint-graphite', { color: 0x34373d, roughness: 0.4, metalness: 0.35, side: THREE.DoubleSide }),
  lamp: namedMaterial('lamp-ice', { color: 0xd8f4ff, emissive: 0x7fd8ff, emissiveIntensity: 0.6, roughness: 0.08, clearcoat: 1.0 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  dWhite: decalMaterial('decal-white', { color: 0xf6f4ee, roughness: 0.4 }),
  dGraphite: decalMaterial('decal-graphite', { color: 0x2a2c31, roughness: 0.45 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-inner-dark', { color: 0x1c1a1e, roughness: 0.85, side: THREE.DoubleSide }),
});

/**
 * 直立封閉環形翼：中心線是 y–z 平面上的橢圓（半寬 a、半高 b），斷面是沿 x 的薄翼橢圓（半弦 c、半厚 t）
 * @type {(xc: number, yc: number, a: number, b: number, c: number, t: number, n?: number, m?: number) => THREE.BufferGeometry}
 */
const buildRing = (xc, yc, a, b, c, t, n = 96, m = 16) => {
  const pos = [];
  /** @type {(i: number, j: number) => number[]} */
  const P2 = (i, j) => {
    const th = (2 * Math.PI * i) / n;
    const ph = (2 * Math.PI * j) / m;
    const cz = a * Math.cos(th);
    const cy = b * Math.sin(th);
    // 橢圓法向（在 y–z 平面，往外）
    let nz = Math.cos(th) / a;
    let ny = Math.sin(th) / b;
    const l = Math.hypot(nz, ny);
    nz /= l;
    ny /= l;
    const dx = c * Math.cos(ph);
    const dr = t * Math.sin(ph);
    return [xc + dx, yc + cy + ny * dr, cz + nz * dr];
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const p00 = P2(i, j);
      const p10 = P2(i + 1, j);
      const p11 = P2(i + 1, j + 1);
      const p01 = P2(i, j + 1);
      // 繞向讓法線朝外（朝內時 Blender 的背面變暗處理會讓光環變成黑色）
      pos.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 光環幾何參數：薄翼斷面（10.4 × 2.6）並後傾 30° 兼作尾翼，
 * 環面略壓扁（半寬 21.5、半高 10），以環底（x −52、y 27.2，埋在頸部整流座裡）為支點往後傾 30°；
 * 環頂後緣約 x −66.5（車殼外框長 ≤ 153），環頂高約 47。中空兩半合模件，以殼面積 × 壁厚算質量；底部埋進頸部整流座
 */
const RING = { xc: -52, yc: 37.2, a: 21.5, b: 10, c: 5.2, t: 1.3, tiltDeg: 30 };

/**
 * 把光環本地座標（直立環）的幾何繞環底支點往後傾 RING.tiltDeg（環頂往 −x）
 * @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry}
 */
const tiltRing = (g) => {
  const py = RING.yc - RING.b;
  g.translate(-RING.xc, -py, 0);
  g.rotateZ((RING.tiltDeg * Math.PI) / 180);
  g.translate(RING.xc, py, 0);
  return g;
};

/** @type {(x: number) => number} 黑色收腰的分色線高度（側視：車門後方往後上掃到側壁肩） */
const WAIST = (x) => 12 + 14 * smoothstep(10, -26, x);

/** @type {(x: number, y: number, z: number) => number} 後輪側裙板範圍（側視：上緣是往前後下垂的弧） */
const SKIRT_KEEP = (x, y, z) => (Math.abs(z) < 34 ? -1 : Math.min(23 - y - 0.004 * (x + 40) ** 2, x + 60, -20 - x));

export const haloOrbitBody = makePolyBody({
  id: 'body-halo-orbit',
  name: '行星環',
  style: 'homage',
  phase: 4,
  // 分組（shared/design/HOMAGE_RESEARCH.md 第 6 節）
  homageSeries: 'lg2',
  form: 'pebble',
  roof: 'canopy',
  wing: 'halo-ring',
  theme: '卵石形中高車身＋後輪側裙、環繞一圈的煙燻玻璃帶、車尾直立的封閉光環翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.4,
  // 平滑剖面，側壁肩（6）是唯一的銳利稜線（卵石形，只留一條分件線）
  hard: [6],
  // 只有前輪拱；後輪由側裙蓋住（只能裝 26 mm 輪）
  wheelArches: [{ x: 40, y: 13, radius: 16, cutZFrom: 21 }],
  recesses: [
    // 側裙前方的導風口（V10）：後輪前緣一道往後上斜的凹槽
    { id: '側裙導風口', view: 'side', shape: 'poly', pts: [[-14, 12], [-10, 12], [-15, 21], [-19, 21]], depth: 2.2 },
  ],
  sideZMin: 36,
  innerSkipRecess: true,
  zones: () => [
    // 環繞玻璃帶（俯視橢圓環）
    { mat: 'smoke', keep: (x, y, z) => Math.min(1 - ell(x, z, GLASS.ao, GLASS.bo), ell(x, z, GLASS.ai, GLASS.bi) - 1) * 20 },
    // 鼻部中央的石墨灰「軌道面板」：從鼻尖往後展開到玻璃帶前緣（概念圖的灰色鼻板）
    { mat: 'graphite', keep: (x, y, z) => Math.min(x - 24, 3 + 0.36 * (76 - x) - Math.abs(z), ell(x, z, GLASS.ao, GLASS.bo) - 1) },
    // 後輪側裙板：側視圓角板，蓋在後輪外側（亮黑，併入黑色收腰）
    {
      mat: 'black',
      keep: (x, y, z) => SKIRT_KEEP(x, y, z),
    },
    // 黑色收腰：車門後方往後上掃的斜分色線（x 10 → −26：y 12 → 側壁肩），以後整段側壁亮黑——
    // 洋紅只留在上半車身與車頭，從側面看車尾變細、腰線往後收
    { mat: 'black', keep: (x, y, z) => (Math.abs(z) > 30 ? Math.min(WAIST(x) - y, 10 - x) : -1) },
    // 下半車身石墨灰：前低後高的斜分色線，車尾整段石墨灰（和概念圖的灰色後半身呼應）
    { mat: 'graphite', keep: (x, y, z) => (Math.abs(z) > 24 ? 17 - 0.1 * x - y : -1) },
    { mat: 'magenta', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'graphite', recess: 'recess', recessWall: 'recessWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    const top = (x) => kit.surf.topY(x, 0);
    // 光環翼（白）
    // 斷面分段 12、環向 72（薄翼斷面不需要更多段，省下的三角形抵銷黑色收腰分色線多切出的殼面三角形），後傾 30°
    parts.push({ geometry: smoothNormals(tiltRing(buildRing(RING.xc, RING.yc, RING.a, RING.b, RING.c, RING.t, 72, 12))), mat: 'white', shell: true, name: 'halo-ring' });
    // 光環下緣的翼根整流座（洋紅）：沿車尾中線從後艙蓋隆起、包住光環下緣
    const pylon = [];
    // 頸部整流座——從後艙蓋中線一體隆起、往後上升托住光環下緣（中空件，以殼面積 × 壁厚算質量）
    // 整流座終點在 x −60（托住後傾光環的下緣）
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const x = lerp(-32, -60, u);
      pylon.push([x, top(Math.max(x, -67.5)) - 2.2 + 6.2 * smoothstep(0.15, 0.85, u), 0]);
    }
    parts.push({
      geometry: smoothNormals(sweepEllipse(pylon, 48, (t) => [lerp(1.0, 6.2, smoothstep(0, 0.7, t)) * (1 - 0.55 * smoothstep(0.88, 1, t)), lerp(1.2, 4.6, smoothstep(0, 0.65, t)) * (1 - 0.45 * smoothstep(0.88, 1, t))], 32)),
      mat: 'magenta2',
      shell: true,
      name: 'halo-neck',
    });
    // 環上的小衛星（白球，右上 50°）＋石墨灰底座
    const th = (50 * Math.PI) / 180;
    // 跟著光環後傾；球分段 14×9、半徑 1.8（配合薄翼斷面的光環比例）
    const sat = new THREE.SphereGeometry(1.8, 14, 9);
    sat.translate(RING.xc, RING.yc + RING.b * Math.sin(th), RING.a * Math.cos(th));
    parts.push({ geometry: tiltRing(sat), mat: 'magenta', solid: true, outline: true, name: 'halo-satellite' });
    // 鼻部石墨灰下唇刃（前下擾流片）：
    // 兩側展開的平切前分流板（鼻尖停在 x 81：伸到 83.5 會讓 race-frp 設定全長 167.1 mm 超過 165 mm 規則；x 76.5 處半寬 13.5），從俯視看是圓鼻前方一片黑刃；
    // 只做馬蹄形外圈（內圈在車殼下方，挖空省質量），讓俯視輪廓在別款車頭結束的地方多出一塊（和 prism-facet、khepri-scarab 的俯視 IoU 拉開）
    parts.push({
      geometry: flatPlate(
        [
          [62, -21],
          [71, -18],
          [76.5, -13.5],
          [80, -8],
          [81, -3],
          [81, 3],
          [80, 8],
          [76.5, 13.5],
          [71, 18],
          [62, 21],
          [62, 17],
          [69, 12],
          [74, 5.5],
          [75.5, 0],
          [74, -5.5],
          [69, -12],
          [62, -17],
        ],
        12.4,
        1.2,
      ),
      mat: 'graphite2',
      solid: true,
      outline: true,
      name: 'nose-lip',
    });
    // 傾斜的「軌道環」大圖形：一個傾斜平面和車身的交線，從鼻尖斜掃過前葉子板、沿側面升到車尾（白帶＋石墨灰細邊，V13）
    /** @type {(x: number, y: number, z: number) => number} 到軌道平面的高度差 */
    const orbitPlane = (x, y, z) => y - (24.5 - 0.11 * x + 0.06 * z);
    const offGlass = (x, y, z) => ell(x, z, GLASS.ao + 1.2, GLASS.bo + 1.2) - 1;
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(1.6 - Math.abs(orbitPlane(x, y, z)), offGlass(x, y, z) * 30, 76 - x, x - 14, y - 18), { offset: 0.1 }),
      mat: 'dWhite',
      name: 'decal-orbit-band',
    });
    // 後輪側裙板（立體）：裙板範圍往外鼓出 0.9 mm 的一層亮黑板，邊緣的台階側壁是白色＝實際高低差的弧形分件線
    const skirt = buildRegion(kit.surf, [...kit.holes, (x, y, z) => SKIRT_KEEP(x, y, z)], { offset: 0.9 });
    parts.push({ geometry: skirt.geometry, mat: 'black', shell: true, name: 'rear-skirt-panel' });
    parts.push({ geometry: buildRim(skirt, 0, 0.9), mat: 'white2', name: 'rear-skirt-edge' });
    // 玻璃帶外圈白色細邊（不做內圈細邊與頂蓋號碼，讓環繞玻璃帶成為主角）
    parts.push({
      geometry: kit.decal((x, y, z) => 0.55 - Math.abs(ell(x, z, GLASS.ao, GLASS.bo) - 1) * GLASS.bo),
      mat: 'dWhite',
      name: 'decal-glass-trim',
    });
    // 前輪拱內襯
    parts.push({ geometry: buildArchLiner({ x: 40, y: 13, radius: 16 }, 29, 36), mat: 'liner', shell: true, name: 'arch-liner' });
    // 點狀星軌線（V13 構圖：從鼻尖斜掃到光環）：側面一條往後上升的弧，上面排一串由小變大的白點，夾一條細虛線
    /** @type {(u: number) => number} 弧線高度（u = x） */
    const orbitY = (u) => 15.5 + 9 * smoothstep(70, -50, u);
    /** @type {((u: number, v: number) => number)[]} */
    const dots = [];
    for (let i = 0; i < 11; i++) {
      const u = lerp(66, -50, i / 10);
      dots.push(sdCircle(u, orbitY(u), lerp(0.7, 2.0, i / 10)));
    }
    /** @type {(u: number, v: number) => number} */
    const dash = (u, v) => {
      const ph = ((u % 4) + 4) % 4;
      return Math.max(Math.abs(v - orbitY(u) - 3.2) - 0.35, ph - 2.2, u - 60, -44 - u);
    };
    const orbitSd = (u, v) => Math.min(...dots.map((f) => f(u, v)), dash(u, v));
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(orbitSd, { x0: 0, y0: 0, zMin: 34, side: 1 })),
        kit.decal(sideDecal((u, v) => orbitSd(-u, v), { x0: 0, y0: 0, zMin: 34, side: -1 })),
      ]),
      mat: 'dWhite',
      name: 'decal-orbit-dots',
    });
    // 引擎蓋：從鼻尖往後的白色細弧（雙軌道線）＋ 小圓點
    const hoodArc = [sdBar(74, 0, 50, 9, 0.9), sdBar(50, 9, 34, 21, 0.9), sdBar(74, 0, 50, -9, 0.9), sdBar(50, -9, 34, -21, 0.9)];
    const hoodDots = [sdCircle(46, 0, 1.6), sdCircle(40, 0, 1.1), sdCircle(35.5, 0, 0.7)];
    parts.push({
      geometry: kit.decal((x, y, z) => -Math.min(...hoodArc.map((f) => f(x, z)), ...hoodDots.map((f) => f(x, z)))),
      mat: 'dWhite',
      name: 'decal-hood-orbit',
    });
    // 號碼 08（側面玻璃帶下方）
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('08', { h: 5.6, w: 3.1, gap: 0.8 }), { x0: -40, y0: 16.5, zMin: 34 })),
      ]),
      mat: 'dWhite',
      name: 'decal-number',
    });
    // 頭燈（V14）：鼻部兩側一對細長淚滴燈片
    const lampSd = sdConvexPolygon([
      [70, 6],
      [66, 14],
      [58, 21],
      [61, 13],
    ]);
    parts.push({ geometry: kit.decal((x, y, z) => -lampSd(x, Math.abs(z)), { offset: 0.1 }), mat: 'lamp', name: 'lamp-head' });
    // 尾燈：車尾封口上方一條紅色細帶
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(-64 - x, 0.9 - Math.abs(y - 23.5), Math.abs(z) - 6)),
      mat: 'tail',
      name: 'lamp-tail',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他致敬款）',
    geometry: '本檔站位產生器 P（推估）：長約 144、車頂 36（HOMAGE_RESEARCH 4-1）；前輪拱 R16（26 mm 輪胎半徑 13 + 3 mm）；後輪由側裙蓋住，只能裝 26 mm 輪',
    ring: '光環翼為實心 ABS 件（中心線橢圓半寬 21 × 半高 11.5、斷面 7.2 × 2.3 mm），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
