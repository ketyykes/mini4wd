// 火鳥（body-firebird，神話組・斯拉夫）：俄羅斯民間故事的火鳥（Zhar-ptitsa）——夜裡飛進果園偷金蘋果，整座園子像點了許多火；
// 掉下的一根尾羽亮得像紅太陽（Magnus 1916 英譯 Afanasyev〈伊凡王子、光明鳥與灰狼〉）。車上不做鳥頭、不做鳥身。
// 照四視圖 12 建模：長楔形尖鼻、刀稜般高過引擎蓋的前翼子板、前移的箭形座艙、兩側鼓起的側箱（後段有進氣百葉），
// 車尾是四視圖招牌的「分成兩半往上翹的鷗翼」→ 兩片火羽大翼：每半片由 4 根層疊的長羽組成（前橘後深紅、羽尖貼金），
// 從背脊兩側往外上方張開成 V 形、往後掠到車尾之後，後緣是一階一階的羽尖。
// 塗裝：火紅主色、車尾段往後疊的圓弧羽緣漸層成火焰橘；側箱是 Khokhloma 黑漆面板，上面畫金色捲莖與朱紅漿果；
// 前翼子板稜線與側箱上緣的金線（四視圖的黃色細線）；側箱後段的進氣百葉透出微弱的餘燼橘光。
// 刻意避開：中國鳳凰（雞冠、卷雲尾）、希臘不死鳥（從火焰中升起的姿態）、Fawkes、寶可夢火焰鳥、Marvel Phoenix 徽章、Stravinsky 芭蕾舞台服。
// 設計：shared/design/body-firebird/DESIGN.md。剖面為本檔站位產生器（推估）。不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾封口 x（火羽大翼再往後伸） */
const X_REAR = -66;
/** @type {number} 鼻尖 x */
const X_FRONT = 75;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-66, -62, -54, -40, -28, -14, 0, 14, 28, 40, 48, 56, 62, 67, 71, 75];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：尖鼻 2.5 → 前翼子板 38 → 座艙前收到 31 → 往後鼓成側箱 37.5（四視圖俯視側箱最寬處）→ 後輪 37 → 收成窄車尾 14（火羽大翼的翼根）
  hw: monoCurve(XS, [14, 18, 27, 37, 37.5, 37.5, 34, 31, 33.5, 38, 35.5, 28.5, 21, 14.5, 8.5, 2.5]),
  // 中線高度：鼻尖 15.2 → 一路斜升的長楔形引擎蓋 30.5（x 40）→ 座艙頂 37.2（x 0）→ 後甲板 32.5 → 車尾 29.5
  yTop: monoCurve(XS, [29.5, 30.5, 31.5, 32.5, 34, 36, 37.2, 35.5, 32.5, 30.5, 28.4, 26, 23.4, 20.6, 18, 15.2]),
  // 車頂（座艙 / 背脊）平台半寬：座艙段 12，往鼻尖收成 0.8 的刀稜
  cw: monoCurve(XS, [7, 7.5, 8.5, 10, 11, 12, 12, 11, 8, 5, 4, 3, 2.2, 1.6, 1.2, 0.8]),
  // 翼子板刀稜高度：前輪上方 33.2（高過引擎蓋中線 2 mm），往鼻尖跟著楔形降下
  yF: monoCurve(XS, [27, 29, 31.5, 33, 32, 30.5, 30, 30.5, 32, 33.2, 31.2, 27.5, 23.5, 20, 17.4, 15]),
  // 肩稜線（頂面與側牆交界，銳利）：輪上 31.2–31.4、腰 26.6
  yS: monoCurve(XS, [24, 26.5, 29.5, 31.4, 29.6, 27.2, 26.6, 27.2, 29.4, 31.2, 29.4, 25, 21, 18, 16, 14.6]),
  // 側裙下緣
  yLow: monoCurve(XS, [17, 15.5, 13, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11.5, 12.5, 13, 13.2, 13.4, 13.6]),
};

/** @type {number} 側牆往下的外張量 */
const FLARE = 0.8;
/** @type {(x: number) => number} 翼子板刀稜的 |z|（車頂平台與肩線之間 62%） */
const zF = (x) => lerp(P.cw(x), P.hw(x), 0.62);

/**
 * 半剖面 7 點：中線 → 車頂平台邊（銳利）→ 斜面 → 翼子板刀稜（銳利）→ 肩稜線（銳利）→ 外張側牆 → 側裙下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const c = P.cw(x);
  const f = P.yF(x);
  const z3 = zF(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  return [
    [0, t],
    [c, t - 0.4],
    [lerp(c, z3, 0.5), lerp(t - 0.4, f, 0.5) - 0.3],
    [z3, f],
    [h, s],
    [h + FLARE / 2, lerp(s, lo, 0.5)],
    [h + FLARE, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與鼻端每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -58, 1, profile).slice(0, -1), ...buildStations(-58, 58, 2, profile).slice(0, -1), ...buildStations(58, X_FRONT, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, y: number) => number} 側牆外表面在 (x, y) 的 |z| */
const wallZ = (x, y) => {
  const s = P.yS(x);
  const t = Math.min(1, Math.max(0, (s - y) / (s - P.yLow(x))));
  return P.hw(x) + FLARE * t;
};
/** @type {(x: number, y: number, z: number) => boolean} 側牆 */
const onSideWall = (x, y, z) => y < P.yS(x) + 0.05 && Math.abs(z) > wallZ(x, y) - 0.4 && x > X_REAR + 1 && x < X_FRONT - 1;
/** @type {(x: number, y: number) => boolean} 頂面 */
const onTop = (x, y) => y > P.yS(x) + 0.05;

/** @type {number} 黑漆裙帶高度 */
const SKIRT_H = 2.2;
/**
 * 側箱黑漆面板的上緣（側視）：前輪後方 x 22 從 y 15 往後斜升到後輪前方 x −22 的 y 24.5（四視圖側箱上緣的斜線）
 * @type {(x: number) => number}
 */
const podTopY = (x) => lerp(15, 24.5, Math.min(1, Math.max(0, (22 - x) / 44)));
/** @type {(x: number, y: number) => number} 側箱黑漆面板（兩輪之間、斜線之下；負值 = 板內） */
const podSd = (x, y) => Math.max(y - podTopY(x), x - 23, -23.5 - x, 1.6 - archDist(x, y));
/** @type {(x: number, y: number) => number} 鼻側黑漆面板（前輪前方的側牆下半，上緣往鼻尖斜降；負值 = 板內） */
const noseSideSd = (x, y) => Math.max(y - lerp(P.yS(57) - 2.4, P.yLow(73) + 1, (x - 57) / 16), 57 - x, 1.6 - archDist(x, y));

/**
 * 漸層分界線（往後疊的羽緣）：x0 在中線的位置，往兩側每 1 mm 後掠 0.35 mm，再減掉一排朝車尾鼓出的半圓弧（每 7 mm 一瓣、深 3.5 mm）
 * @type {(x0: number, z: number) => number}
 */
const featherEdgeX = (x0, z) => {
  const az = Math.abs(z);
  const q = 2 * ((((az / 7 + 0.5) % 1) + 1) % 1) - 1;
  return x0 - 0.35 * az - 3.5 * Math.sqrt(Math.max(0, 1 - q * q));
};
/** @type {number} 火紅 | 火焰橘 分界在中線的 x */
const EDGE_X0 = -22;

/** @type {{ xr: number, xm: number, xf: number, wr: number, wm: number }} 箭形座艙（俯視）：後緣 xr、最寬處 xm、前尖 xf；後緣半寬 wr、最寬半寬 wm */
const CAB = { xr: -16, xm: 6, xf: 36, wr: 5.5, wm: 10.8 };
/** @type {(x: number, z: number) => number} 箭形座艙距離（負值 = 座艙內） */
const cabinSd = (x, z) => {
  if (x < CAB.xr || x > CAB.xf) {
    return Math.max(CAB.xr - x, x - CAB.xf);
  }
  const w = x < CAB.xm ? lerp(CAB.wr, CAB.wm, (x - CAB.xr) / (CAB.xm - CAB.xr)) : lerp(CAB.wm, 0, (x - CAB.xm) / (CAB.xf - CAB.xm));
  return Math.max(Math.abs(z) - w, CAB.xr - x, x - CAB.xf);
};

/** @type {(x: number) => number} 側箱上 Khokhloma 捲莖的中心線 y（沿 x 每 11 mm 擺一次） */
const stemY = (x) => podTopY(x) - 4.4 + 1.5 * Math.sin((2 * Math.PI * (x + 2)) / 11);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  fire: namedMaterial('paint-firebird-red', { color: 0xc81e16, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  fire2: namedMaterial('paint-firebird-red', { color: 0xc81e16, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  flame: namedMaterial('paint-flame-orange', { color: 0xe8701a, roughness: 0.36, clearcoat: 0.6 }),
  flame2: namedMaterial('paint-flame-orange', { color: 0xe8701a, roughness: 0.36, clearcoat: 0.6, side: THREE.DoubleSide }),
  crimson2: namedMaterial('paint-firebird-crimson', { color: 0x8a1512, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  ember2: namedMaterial('paint-ember-vermilion', { color: 0xd8401a, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
  // Khokhloma 黑漆（側箱、裙帶、封口）
  black: namedMaterial('paint-khokhloma-black', { color: 0x0e0b0a, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  black2: namedMaterial('paint-khokhloma-black', { color: 0x0e0b0a, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  // 箭形座艙：琥珀深色煙燻亮漆（不透明，殼面分區）
  amber: namedMaterial('paint-amber-smoke-dark', { color: 0x4a200c, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  gold2: namedMaterial('trim-gold-brass', { color: 0xd1a23e, metalness: 0.8, roughness: 0.3, clearcoat: 0.3, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-crimson', { color: 0x5a1512, roughness: 0.8, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-crimson', { color: 0x8a1512, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x15110f, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-khokhloma', { color: 0xd6a640, metalness: 0.75, roughness: 0.3 }),
  dBerry: decalMaterial('decal-berry-cinnabar', { color: 0xe23a22, roughness: 0.35 }),
  dBlack: decalMaterial('decal-lacquer-black', { color: 0x0e0b0a, roughness: 0.3, clearcoat: 0.6 }),
  // 進氣百葉裡的餘燼光（低強度自發光，不過曝）
  dEmber: decalMaterial('lamp-ember-vent', { color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.4, roughness: 0.4 }),
  lamp: decalMaterial('lamp-head-amber', { color: 0xffc060, emissive: 0xff9a20, emissiveIntensity: 0.35, roughness: 0.3 }),
});

/** @type {number} 火羽大翼的上反角（rad）：從背脊往外上方張開成 V 形 */
const WING_DIHEDRAL = (24 * Math.PI) / 180;
/** @type {{ x: number, y: number, z: number }} 翼根基準點（翼平面的原點，埋進後甲板） */
const WING_ROOT = { x: -30, y: 30.6, z: 4.6 };
/** @type {number} 翼展方向長度 */
const WING_SPAN = 40;
/**
 * 4 根層疊長羽（翼平面座標 u = 往後、v = 往外）：羽根 (u0, 0) → 羽尖 (u1, v1)，最寬半寬 w，材質；由前（橘）往後（深紅）
 * @type {{ u0: number, u1: number, v1: number, w: number, mat: string }[]}
 */
const FEATHERS = [
  { u0: 2, u1: 40, v1: WING_SPAN, w: 4.8, mat: 'flame2' },
  { u0: 9, u1: 42.5, v1: WING_SPAN - 4.5, w: 4.6, mat: 'ember2' },
  { u0: 16, u1: 44, v1: WING_SPAN - 9.5, w: 4.4, mat: 'fire2' },
  { u0: 23, u1: 45, v1: WING_SPAN - 15, w: 4.2, mat: 'crimson2' },
];

/**
 * 一根長羽的輪廓（翼平面）：羽根到羽尖的中心線，兩側半寬 w·sin(πt)^0.55，最寬點偏後、羽尖收尖；t0 → 1 只取尖端段（貼金羽尖）
 * @type {(f: { u0: number, u1: number, v1: number, w: number }, t0: number) => number[][]}
 */
const featherOutline = (f, t0) => {
  const n = 12;
  const du = f.u1 - f.u0;
  const dv = f.v1;
  const len = Math.hypot(du, dv);
  const nu = -dv / len;
  const nv = du / len;
  /** @type {(t: number) => number} */
  const halfW = (t) => f.w * Math.sin(Math.PI * Math.min(1, 0.08 + 0.92 * t) ** 1.3) ** 0.55;
  /** @type {number[][]} */
  const left = [];
  /** @type {number[][]} */
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(t0, 1, i / n);
    const cu = f.u0 + du * t;
    const cv = dv * t;
    const w = halfW(t);
    left.push([cu + nu * w, cv + nv * w]);
    right.push([cu - nu * w, cv - nv * w]);
  }
  return [...left, ...right.reverse()];
};

/**
 * 把翼平面上的板（u, v 平面、沿法線擠出 thick，法線偏移 lift）放到世界座標：翼根基準點、上反角、左右對稱；
 * 鏡像那一側翻轉三角形繞向，封閉體積保持正值
 * @type {(pts: number[][], thick: number, lift: number, sg: number) => THREE.BufferGeometry}
 */
const wingPlate = (pts, thick, lift, sg) => {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))), { depth: thick, bevelEnabled: false, curveSegments: 1 });
  const pos = g.getAttribute('position');
  const c = Math.cos(WING_DIHEDRAL);
  const s = Math.sin(WING_DIHEDRAL);
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = pos.getY(i);
    const w = pos.getZ(i) + lift;
    const x = WING_ROOT.x - u;
    const y = WING_ROOT.y + v * s + w * c;
    const z = WING_ROOT.z + v * c - w * s;
    pos.setXYZ(i, x, y, z);
  }
  // u → −x 的映射本身是鏡像：右側（sg = 1）要翻繞向，左側再鏡像一次 z 就不用翻
  if (sg < 0) {
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, -pos.getZ(i));
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      const ax = pos.getX(i + 1);
      const ay = pos.getY(i + 1);
      const az = pos.getZ(i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, ax, ay, az);
    }
  }
  const out = g.index ? g.toNonIndexed() : g;
  out.computeVertexNormals();
  return out;
};

/**
 * 火羽大翼：每半片 4 根層疊長羽（往後一根比一根短、疊高 0.25 mm）＋每根羽尖 28% 的貼金片
 * @type {() => { byMat: Record<string, THREE.BufferGeometry>, tips: THREE.BufferGeometry }}
 */
const buildPlumeWings = () => {
  /** @type {Record<string, THREE.BufferGeometry[]>} */
  const groups = {};
  /** @type {THREE.BufferGeometry[]} */
  const tips = [];
  for (const sg of [-1, 1]) {
    FEATHERS.forEach((f, k) => {
      const lift = 0.25 * k;
      (groups[f.mat] ??= []).push(wingPlate(featherOutline(f, 0), 1.2, lift, sg));
      tips.push(wingPlate(featherOutline(f, 0.72), 0.3, lift + 1.2, sg));
    });
  }
  /** @type {Record<string, THREE.BufferGeometry>} */
  const byMat = {};
  for (const [m, gs] of Object.entries(groups)) {
    byMat[m] = mergeGeos(gs);
  }
  return { byMat, tips: mergeGeos(tips) };
};

export const firebirdBody = makePolyBody({
  id: 'body-firebird',
  name: '火鳥火羽',
  style: 'myth',
  phase: 13,
  mythSeries: 'slavic',
  mythTheme: 'zhar-ptitsa',
  form: 'ember-wedge-pod',
  roof: 'canopy',
  wing: 'split-plume-gull',
  theme: '火鳥的元素（不做鳥）：長楔形尖鼻、高過引擎蓋的刀稜前翼子板、前移的琥珀深色箭形座艙、兩側鼓起的 Khokhloma 黑漆側箱（金色捲莖、朱紅漿果、透出餘燼橘光的進氣百葉）；車尾兩片分開往外上方翹起的火羽大翼（每半片 4 根層疊長羽，橘 → 朱紅 → 火紅 → 深紅，羽尖貼金）；火紅車身在車尾段以圓弧羽緣漸層成火焰橘，金線沿翼子板刀稜與側箱上緣',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: [1, 3, 4],
  step: 0.72,
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    { mat: 'black', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.5 ? P.yLow(x) + SKIRT_H - y : -1) },
    { mat: 'black', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.5 ? -Math.min(podSd(x, y), noseSideSd(x, y)) : -1) },
    { mat: 'amber', keep: (x, y, z) => (onTop(x, y) ? -cabinSd(x, z) : -1) },
    { mat: 'fire', keep: (x, y, z) => x - featherEdgeX(EDGE_X0, z) },
    { mat: 'flame', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 金線：翼子板刀稜（鼻尖 → 座艙後）、羽緣漸層分界、座艙框、側箱上緣
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y) || x > X_FRONT - 2) {
          return -1;
        }
        const crest = x > -20 ? 0.35 - Math.abs(Math.abs(z) - zF(x)) : -1;
        const fe = 0.35 - Math.abs(x - featherEdgeX(EDGE_X0, z));
        const cab = cabinSd(x, z);
        return Math.max(crest, fe, Math.min(cab, 0.9 - cab));
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-gold-lines',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = podSd(x, y);
        return Math.min(-d + 0.7, d + 0.0001) >= 0 ? Math.min(0.7 + d, -d) : Math.min(d, 0.6 - d);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-pod-edge',
    });

    // Khokhloma 金色捲莖（側箱黑漆上沿 x 擺動的金線，寬 0.7）＋每個彎內側一顆朱紅漿果（半徑 0.95）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || podSd(x, y) > -1.2 || x < -14) {
          return -1;
        }
        return 0.35 - Math.abs(y - stemY(x));
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-pod-stem',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || podSd(x, y) > -1.2 || x < -14) {
          return -1;
        }
        const k = Math.round((x + 2 - 2.75) / 5.5);
        const xc = 2.75 - 2 + 5.5 * k;
        const yc = stemY(xc) - Math.sign(Math.sin((2 * Math.PI * (xc + 2)) / 11)) * 1.6;
        return 0.95 - Math.hypot(x - xc, y - yc);
      }, { offset: 0.14 }),
      mat: 'dBerry',
      name: 'decal-pod-berries',
    });
    // 進氣百葉（側箱後段 x −22 → −14）：5 道斜縫，縫裡是餘燼橘光
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || podSd(x, y) > -1 || x > -13 || y < P.yLow(x) + SKIRT_H + 1.2) {
          return -1;
        }
        const q = (((x - 0.5 * y) % 1.9) + 1.9) % 1.9;
        return Math.min(0.5 - Math.abs(q - 0.95), x + 22.5);
      }, { offset: 0.12 }),
      mat: 'dEmber',
      name: 'decal-pod-vents',
    });

    // 頭燈：鼻尖兩側沿肩線的細長燈條（x 56 → 70）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y) || x < 56 || x > 70) {
          return -1;
        }
        const dz = P.hw(x) - Math.abs(z);
        return Math.min(dz - 0.5, 1.6 - dz);
      }, { offset: 0.12 }),
      mat: 'lamp',
      name: 'lamp-head',
    });

    // 火羽大翼（split-plume-gull）
    const wings = buildPlumeWings();
    for (const [m, g] of Object.entries(wings.byMat)) {
      parts.push({ geometry: g, mat: m, solid: true, outline: true, name: `wing-plume-${m.replace(/2$/, '')}` });
    }
    parts.push({ geometry: wings.tips, mat: 'gold2', solid: true, name: 'wing-plume-gilt-tips' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    fourview: 'shared/design/body-firebird/fourview.png（四視圖 12）與 fourview_trace.txt：長楔形鼻、座艙位置、側箱、分成兩半往上翹的鷗翼照圖，高度縮到合法範圍（推估）',
    geometry:
      '本檔站位產生器 P（推估）：殼 x −66 → 75；肩線半寬 鼻尖 2.5、前翼子板 38、座艙前 31、側箱 37.5、後輪 37、車尾 14（＋牆腳外張 0.8，外框半寬 ≤ 48.0）；中線 鼻尖 15.2、引擎蓋 30.5（x 40）、座艙頂 37.2、車尾 29.5；翼子板刀稜 33.2；側裙下緣 10.5',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    wings: '火羽大翼：翼根基準 (x −30, y 30.6, |z| 4.6)、上反角 24°、翼展 40；每半片 4 根長羽（板厚 1.2、最寬半寬 4.2–4.8、羽尖 x −70 → −75），往後一根短 5–6 mm；羽尖 28% 貼 0.3 mm 金片；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    livery: '箭形座艙 x −16 → 36、最寬半寬 10.8；側箱黑漆 x −23.5 → 23、上緣 y 15 → 24.5；捲莖週期 11、漿果半徑 0.95；百葉 5 道；漸層羽緣 x0 −22、後掠 0.35、瓣寬 7（皆為塗裝分區 / 貼紙，推估）',
    myth: '火鳥尾羽（Afanasyev 故事，DESIGN.md 研究一節）、Khokhloma 漆器黑紅金與捲莖漿果紋（MYTH_RESEARCH 斯拉夫節）；不做鳥頭、鳥身、鳥爪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
