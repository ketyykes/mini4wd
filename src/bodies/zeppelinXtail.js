// 硬式飛船（body-zeppelin-xtail，第六階段 LG2 致敬款）：圓斷面雪茄形全罩（最粗處在前 1/3、半球形圓鼻、往後收成圓錐尾），
// 四個 31 mm 輪拱直接在雪茄側面切出；頂部一條長窄煙燻透明觀景窗帶（看得到底盤）；車尾 4 片小舵面呈 X 形（穩定舵＝外露機能件，舵面不超出車尾）。
// 設計：shared/design/body-zeppelin-xtail/DESIGN.md（HOMAGE_RESEARCH 第 6 節 LG2 語彙、和劇中車 / 市售車殼的差異）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：錫灰＋奶油白＋訊號橘、環向骨架分節線、縱向鉚釘點列、號碼「75」；不含任何廠商 / 作品名稱、商標、隊徽、國旗或角色圖像。
import * as THREE from 'three';
import { makePolyBody, airfoilFin, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdRoundRect, sideDecal, mergeGeos, buildRegion, buildRim } from './loft.js';
import { monoCurve, buildStations, sdCircle } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-72, -66, -60, -50, -40, -28, -14, 0, 14, 28, 40, 50, 58, 65, 70.5, 75.3, 78.2, 79.6];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 雪茄軸線高度（iter-69：前段 21.5 → 23，配合加高的圓斷面；圓錐尾往上收到 28.5，讓下兩片 X 舵離開後保桿）
  yA: monoCurve(XS, [28.5, 27.5, 26, 24.5, 23.5, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23]),
  // 垂直半軸（iter-69：最大 16.4 → 21.5，斷面由扁橢圓改成接近 1.8 : 1 的圓胖雪茄）：最粗處在前 1/3，鼻部改成尖拱（ogive）收尖、往後收成圓錐尾
  ry: monoCurve(XS, [2.5, 6, 9.5, 13.5, 16.5, 19, 20.5, 21.2, 21.5, 21.3, 20.5, 18.5, 16, 12.8, 9.4, 5.8, 3, 0.8]),
  // 水平半軸（iter-69：最寬 47.2 → 39，俯視不再是方肥皂盒）：鼻、尾都提早收窄成尖拱 / 圓錐
  hw: monoCurve(XS, [4.5, 11, 18, 26, 31.5, 35.5, 37.8, 38.8, 39, 38.8, 37.8, 34.8, 30.2, 24.4, 18, 11, 5.6, 1.6]),
};

/** @type {number[]} 剖面 7 點在橢圓上的角度（度；90 = 中線頂，負值 = 側面往下內收的「腹部」） */
const ANGLES = [90, 70, 50, 32, 15, -3, -22];

/**
 * 半剖面 7 點：以 (0, yA) 為中心的橢圓弧，中線頂 → 側面最寬處 → 往下內收的下緣（圓斷面雪茄，沒有銳利稜線）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yA = P.yA(x);
  const ry = P.ry(x);
  const hw = P.hw(x);
  return ANGLES.map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [hw * Math.cos(a), yA + ry * Math.sin(a)];
  });
};

// 圓鼻、圓錐尾段每 1 mm 一站（曲率大）
const STATIONS = [...buildStations(-72, -60, 1, profile).slice(0, -1), ...buildStations(-60, 64, 2, profile).slice(0, -1), ...buildStations(64, 79.6, 0.75, profile)];

/** 觀景窗帶（俯視圓角長條，中線兩側各 7 mm） */
const WINDOW = { x0: -36, x1: 30, hz: 7 };
/** @type {(x: number, y: number, z: number) => number} 觀景窗距離（負值 = 窗內） */
const windowSd = (x, y, z) => (y < 30 ? 10 : sdRoundRect(x, z, WINDOW.x0, WINDOW.x1, -WINDOW.hz, WINDOW.hz, WINDOW.hz));

/** 骨架分節線的 x 位置（約每 18 mm 一道） */
const FRAMES = [-58, -40, -22, -4, 14, 32, 50, 64];

/** 號碼位置 */
const NUM = { x0: -12, y0: 29.5 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  pewter: namedMaterial('paint-pewter-grey', { color: 0x7c8189, roughness: 0.3, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  cream: namedMaterial('paint-cream-white', { color: 0xf1e8d2, roughness: 0.25, clearcoat: 0.9 }),
  orange: namedMaterial('paint-signal-orange', { color: 0xff5a14, roughness: 0.22, clearcoat: 1.0 }),
  orange2: namedMaterial('paint-signal-orange', { color: 0xff5a14, roughness: 0.22, clearcoat: 1.0, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1d20, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-pewter', { color: 0x5d6167, roughness: 0.5, side: THREE.DoubleSide }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x2a3440, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.4, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  frame: namedMaterial('paint-graphite', { color: 0x2c2f34, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }),
  lamp: namedMaterial('lamp-ice', { color: 0xfff6dc, emissive: 0xffe2a0, emissiveIntensity: 0.6, roughness: 0.08, clearcoat: 1.0 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  dDark: decalMaterial('decal-graphite', { color: 0x2c2f34, roughness: 0.45 }),
  dOrange: decalMaterial('decal-signal-orange', { color: 0xff5a14, roughness: 0.4 }),
  dCream: decalMaterial('decal-cream', { color: 0xf3ead6, roughness: 0.4 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  // iter-71：輪拱內襯改成深錫灰（原為近黑），從輪拱切口看進去是灰色輪弧，不再是黑色殼內面
  liner: namedMaterial('shell-wheelwell-pewter', { color: 0x4b4f56, roughness: 0.6, side: THREE.DoubleSide }),
});

/**
 * X 形尾舵（單片）：以尾部軸線 (x, yA) 為支點，鰭從軸線往上（dir = 1）或往下（dir = −1）伸出 span，再繞 x 軸傾 tiltDeg
 * root / tip 為 [x前緣, x後緣]（後緣不超出車尾 x = −72）
 * @type {(root: number[], tip: number[], span: number, dir: number, tiltDeg: number) => THREE.BufferGeometry}
 */
const buildRudder = (root, tip, span, dir, tiltDeg) => {
  const yAxis = P.yA(-66);
  return airfoilFin([root[0], root[1], yAxis], [tip[0], tip[1], yAxis + dir * span], 1.6, 0, tiltDeg, 14, 8, { pivotY: yAxis, taper: [1, 0.55] });
};

/**
 * 輪拱內襯（沿雪茄殼側壁內側裁切）：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3，只取上半圈），
 * 每個角度的 z 範圍 = [殼內面 − depth, 殼內面]；殼內面 z 依該點高度在橢圓斷面上求得
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildHullLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.3;
  const a1 = Math.PI - 0.3;
  const pos = [];
  /** @type {(t: number) => number} 該角度的殼內面 z（橢圓斷面） */
  const zIn = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    const q = Math.min(1, Math.abs(y - P.yA(x)) / Math.max(0.5, P.ry(x)));
    return P.hw(x) * Math.sqrt(1 - q * q) - 1.2;
  };
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zIn(t0) - depth);
      const B = p(t1, zIn(t1) - depth);
      const C = p(t1, zIn(t1));
      const D = p(t0, zIn(t0));
      // 法線朝輪心（內襯面向輪胎）
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

/**
 * 輪拱擋泥唇（iter-71）：沿輪拱切口上半圈、半埋在雪茄殼面上的圓斷面細唇（半徑 0.75），往外凸出約 0.7 mm；
 * 只沿殼面真的被切開的那一段（殼面 |z| > 21.5），且只在軸線上方（俯視不變寬）
 * @type {(arch: { x: number, y: number, radius: number }, sg: number) => THREE.BufferGeometry}
 */
const buildArchLip = (arch, sg) => {
  const pts = [];
  const r = arch.radius + 0.5;
  for (let i = 0; i <= 60; i++) {
    const t = 0.05 + ((Math.PI - 0.1) * i) / 60;
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    const q = (y - P.yA(x)) / Math.max(0.5, P.ry(x));
    // 只做軸線上方 0.25 ry 以上的上半圈（軸線附近是殼面最寬處，唇會讓俯視輪廓變寬）
    if (q < 0.25 || q > 0.98) {
      continue;
    }
    const zH = P.hw(x) * Math.sqrt(1 - q * q);
    // 唇的外緣不超出該站殼面最寬處（俯視輪廓不變寬，不往 prism-facet 靠近）
    if (zH < 21.5 || zH + 0.7 > P.hw(x) - 0.25) {
      continue;
    }
    pts.push([x, y, sg * (zH - 0.05)]);
  }
  return sweepEllipse(pts, 80, () => [0.75, 0.75], 10);
};

export const zeppelinXtailBody = makePolyBody({
  id: 'body-zeppelin-xtail',
  name: '硬式飛船',
  style: 'homage',
  phase: 6,
  homageSeries: 'lg2',
  form: 'bullet',
  roof: 'clear',
  wing: 'x-tail',
  theme: '圓斷面雪茄形全罩（最粗處在前 1/3、半球形圓鼻、圓錐尾）、頂部長窄透明觀景窗帶、車尾 X 形四片穩定舵',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面，沒有銳利稜線（圓斷面）
  hard: [],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
  ],
  // 觀景窗：殼面開口（另外蓋一片煙燻透明 PC 窗）
  openings: [{ id: '觀景窗', shape: 'fn', sd: windowSd }],
  sideZMin: 36,
  zones: () => [
    // 奶油白鼻帽（半球形圓鼻）
    { mat: 'cream', keep: (x) => x - 73.8 },
    // 訊號橘鼻環
    { mat: 'orange', keep: (x) => x - 70.5 },
    // 奶油白下半船身：軸線以下（飛船吊艙側的分色）
    { mat: 'cream', keep: (x, y, z) => (Math.abs(z) > 16 ? P.yA(x) - 0.6 - y : -1) },
    { mat: 'pewter', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'pewter', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 觀景窗：煙燻透明窗片（沿殼面，計入殼面質量）＋石墨灰窗框
    const pane = buildRegion(kit.surf, [(x, y, z) => -windowSd(x, y, z)], { offset: -0.1 });
    parts.push({ geometry: pane.geometry, mat: 'glass', shell: true, renderOrder: 3, name: 'canopy-window' });
    const frame = buildRegion(kit.surf, [...kit.holes, (x, y, z) => 1.1 - windowSd(x, y, z)], { offset: 0.35 });
    parts.push({ geometry: frame.geometry, mat: 'frame', name: 'window-frame' });
    parts.push({ geometry: buildRim(frame, 0, 0.35), mat: 'frame', name: 'window-frame-wall' });
    // 觀景窗的兩道橫向窗框（把長窗分成三格）
    const bars = buildRegion(kit.surf, [(x, y, z) => Math.min(0.6 - Math.min(Math.abs(x + 14), Math.abs(x - 8)), 0.5 - windowSd(x, y, z))], { offset: 0.35 });
    parts.push({ geometry: bars.geometry, mat: 'frame', name: 'window-bars' });
    // 鼻尖繫留錐（石墨灰金屬圓錐，往前尖出）
    // iter-103（評審 iter-73「zeppelin 缺臉」，對照概念圖 concept_front34_v1）：底徑 4 → 6.4、底面往後埋進鼻帽到 x 78.4，錐尖仍在 x 81.2（全長不變）
    const cone = new THREE.ConeGeometry(3.2, 2.8, 32);
    cone.rotateZ(-Math.PI / 2);
    cone.translate(78.4 + 1.4, P.yA(78.4), 0);
    parts.push({ geometry: cone, mat: 'frame', solid: true, outline: true, name: 'mooring-cone' });

    // 輪拱內襯（前後，31 mm 大輪拱）：擋住從側面看進去的殼內空腔
    parts.push({
      geometry: mergeGeos([buildHullLiner({ x: 40, y: 13, radius: 17.5 }, 3), buildHullLiner({ x: -40, y: 13, radius: 17.5 }, 3)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 輪拱擋泥唇（iter-71）：石墨灰細唇沿四個輪拱切口邊緣，收住切口、框出車輪（評審：車身變窄後四輪外側外露、看得到黑色殼內面）
    parts.push({
      geometry: mergeGeos([-1, 1].flatMap((sg) => [buildArchLip({ x: 40, y: 13, radius: 17.5 }, sg), buildArchLip({ x: -40, y: 13, radius: 17.5 }, sg)])),
      mat: 'frame',
      solid: true,
      outline: true,
      name: 'arch-lips',
    });
    // X 形尾舵（L2-1 外露機能件「穩定舵」）：上兩片外上 45°、下兩片外下 45°（下片較短，保持離地與導輪間隙），後緣不超出車尾
    // iter-69：圓錐尾軸線抬高到 27.5、下片 11.5 → 9 mm，下舵尖離開後保桿（舵尖約 y 21）
    const rudders = [
      buildRudder([-55, -71.5], [-65, -72], 21, 1, -45),
      buildRudder([-55, -71.5], [-65, -72], 21, 1, 45),
      buildRudder([-58, -71.5], [-66, -72], 9, -1, -45),
      buildRudder([-58, -71.5], [-66, -72], 9, -1, 45),
    ];
    parts.push({ geometry: mergeGeos(rudders), mat: 'orange2', solid: true, outline: true, name: 'x-tail-rudders' });

    // 環向骨架分節線（石墨灰細線，繞船身一圈）
    parts.push({
      geometry: kit.decal((x) => Math.max(...FRAMES.map((xf) => 0.32 - Math.abs(x - xf)))),
      mat: 'dDark',
      name: 'decal-frame-rings',
    });
    // 縱向鉚釘點列：側面兩列小圓點（上列沿肩、下列沿分色線上方）
    /** @type {(u: number, v: number) => number} u = 往前為正的 x */
    const rivets = (u, v) => {
      const ph = ((u % 3) + 3) % 3;
      const du = Math.min(ph, 3 - ph);
      const vy = P.yA(u) + 0.62 * P.ry(u);
      return Math.max(Math.hypot(du, v - vy) - 0.42, u - 66, -56 - u);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(rivets, { x0: 0, y0: 0, zMin: 22, side: 1 })),
        kit.decal(sideDecal((u, v) => rivets(-u, v), { x0: 0, y0: 0, zMin: 22, side: -1 })),
      ]),
      mat: 'dDark',
      name: 'decal-rivets',
    });
    // 分色線上的訊號橘細帶（從鼻環沿軸線拉到圓錐尾）
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) > 16 ? Math.min(0.6 - Math.abs(y - (P.yA(x) + 0.2)), 70.5 - x, x + 67.5) : -1)),
      mat: 'dOrange',
      name: 'decal-axis-stripe',
    });
    // 側面大號碼 75（訊號橘，奶油白描邊）
    const numSd = sdNumber('75', { h: 9, w: 4.8, gap: 1.3 });
    parts.push({ geometry: kit.decal(sideDecal((u, v) => numSd(u, v) - 0.7, { x0: NUM.x0, y0: NUM.y0, zMin: 30 })), mat: 'dCream', name: 'decal-number-outline' });
    parts.push({ geometry: kit.decal(sideDecal(numSd, { x0: NUM.x0, y0: NUM.y0, zMin: 30 }), { offset: 0.1 }), mat: 'dOrange', name: 'decal-number' });
    // iter-103：繫留錐底一圈訊號橘同心環（概念圖鼻帽上的橘環），和鼻環、尾環呼應
    parts.push({ geometry: kit.decal((x) => Math.min(x - 76.9, 78.3 - x)), mat: 'dOrange', name: 'decal-nose-cone-ring' });
    // 鼻帽兩側一對圓形探照燈（V14）；iter-103：燈片 r 1.5 → 1.7，外加石墨灰燈圈（r 2.3），讀成「一對眼睛」
    parts.push({
      // iter-110（評審 iter-106「斜看時白色內圓有視差」）：燈圈 r 2.3 → 2.5、燈片 r 1.9 → 1.8；
      // 燈圈原本是整片圓、燈片墊高 0.35 mm 蓋在上面，鼻帽斜面上燈片沿法線外移 → 一側露出白圓（評審 iter-110 仍見左眼 9–11 點缺框）。
      // 改成燈圈只畫 r 1.8–2.5 的環、燈片同高（offset 0.1），兩者不重疊：沒有視差，也沒有深度緩衝打架（iter-106 俯視問題的原因）
      geometry: kit.decal((x, y, z) => {
        if (y <= 20) {
          return -1;
        }
        const d = sdCircle(75.0, 5.0, 2.5)(x, Math.abs(z));
        return Math.min(-d, d + 0.7);
      }, { offset: 0.1 }),
      mat: 'dDark',
      name: 'lamp-searchlight-bezels',
    });
    parts.push({
      // iter-106（評審 iter-103／104「俯視兩眼仍是實心黑點」）：近距離正上方看燈片是白的；整車俯視時相機很遠，
      // 燈片只比燈圈高 0.1 mm（offset 0.2 對 0.1），深度緩衝分不出前後，燈圈蓋過燈片 → 燈片 offset 0.2 → 0.45
      // iter-110：燈圈改成環、和燈片不重疊 → 燈片回到 offset 0.1（同燈圈），不再墊高
      geometry: kit.decal((x, y, z) => (y > 20 ? -sdCircle(75.0, 5.0, 1.8)(x, Math.abs(z)) : -1), { offset: 0.1 }),
      mat: 'lamp',
      name: 'lamp-searchlights',
    });
    // 圓錐尾前的訊號橘尾環＋奶油白細邊（和鼻環呼應）
    parts.push({ geometry: kit.decal((x) => 1.6 - Math.abs(x + 52)), mat: 'dOrange', name: 'decal-tail-ring' });
    parts.push({ geometry: kit.decal((x) => 0.5 - Math.abs(Math.abs(x + 52) - 2.3)), mat: 'dCream', name: 'decal-tail-ring-trim' });
    // 圓錐尾端紅色尾燈環
    parts.push({ geometry: kit.decal((x) => Math.min(-69.8 - x, x + 71.4)), mat: 'tail', name: 'lamp-tail' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他致敬款）；觀景窗片同厚度，以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：長約 154（iter-67 修正卡橋：車尾 −75 → −72、繫留錐縮短；物理碰撞方塊長度 = 車殼外框長）、殼頂約 44.5（iter-69 由扁橢圓改成圓胖斷面：最寬 94 → 78、殼頂 38 → 44.5、鼻部改尖拱）、上舵尖約 42（HOMAGE_RESEARCH 6-5-2 P3）；前後輪拱 R17.5（31 mm 輪胎半徑 15.5 + 2 mm）',
    rudders: 'X 形尾舵為實心 ABS 件（厚 1.6 mm 翼型），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
