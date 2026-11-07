// 火鳥（body-firebird，神話組・斯拉夫）：俄羅斯民間故事的火鳥（Zhar-ptitsa）——夜裡飛進果園偷金蘋果，整座園子像點了許多火；
// 掉下的一根尾羽亮得像紅太陽（Magnus 1916 英譯 Afanasyev〈伊凡王子、光明鳥與灰狼〉）。
// 車上不做鳥：主題只用「火羽」「金蘋果」「Khokhloma 漆器」三種元素表現。
// 造型（F3 半罩露輪）：箭簇形的楔形尖鼻，前輪罩後半切開露出前輪，切口前緣往外側微微後掠；
// 車尾是 7 片從同一個翼根放射、往後上方張開的扇形尾翼（每片由翼根到翼梢深紅 → 火焰橘 → 金）；
// 座艙罩是琥珀金色的透明半球，罩在金色底盤與金框上（金蘋果）。
// 塗裝：殼面由鼻到尾深紅 → 朱紅 → 火焰橘三段漸層（車尾整段是火焰橘亮漆，不用深色，免得看起來像破洞），分界是往後疊的圓弧羽緣＋金線；鼻尖到座艙一支黑漆草葉形長條，
// 上面是 Khokhloma 的金色捲莖與朱紅漿果；側面 5 片往後拉長的飛羽貼紙。
// 刻意避開：中國鳳凰（雞冠、卷雲尾）、希臘不死鳥（從火焰中升起的姿態）、Fawkes、寶可夢火焰鳥、Marvel Phoenix 徽章、Stravinsky 芭蕾舞台服。
// 設計：shared/design/body-firebird/DESIGN.md（研究一節列出實際打開的來源）。剖面為本檔站位產生器（推估）。
// 不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −58（車尾由扇形尾翼接續）、鼻尖 75 */
const XS = [-58, -54.5, -49.5, -40, -28, -14, 0, 14, 28, 40, 50, 58, 64, 69, 72.5, 75];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬：箭簇形——前輪上方最寬 39.2（x 40），往前直線收成尖鼻（鼻尖 1.6），往後掠收成細長的車身（座艙段 24.5–26）
  // 與尾根（後輪上方 23、車尾 13）。後輪胎外側露在殼外（輪拱 R17.5 切開側裙，間隙照常）
  hw: monoCurve(XS, [13, 16, 19.5, 23, 24, 24.5, 26.5, 32, 37, 39.2, 34.5, 15.5, 8.8, 5.4, 3.4, 1.6]),
  // 中線殼頂：前後輪上方 32.6、座艙段 31.6 的低背，x 40 之後一路往前下壓成楔形尖鼻（鼻尖 15.2，V3 鼻尖離地 10–16）
  yTop: monoCurve(XS, [27.5, 30, 31.8, 32.6, 32.3, 31.8, 31.6, 31.8, 32.3, 32.6, 30.6, 27, 23.6, 20.4, 17.6, 15.2]),
  // 肩線（頂面與側裙交界，銳利稜線）：前後輪上方隆起到 31.8（高過 R17.5 輪拱頂 30.5，輪胎上方有完整的殼面），
  // 中段往下垂到 26.8（收腰處）
  yS: monoCurve(XS, [24, 27, 30.4, 31.8, 30.1, 27.6, 26.8, 27.6, 30.1, 31.8, 29.8, 24.6, 20.8, 17.8, 16, 14.6]),
  // 側裙下緣
  yLow: monoCurve(XS, [15, 13.5, 11.5, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11, 12, 12.6, 13, 13.2, 13.4]),
};

/**
 * 半剖面 8 點：中線 → 圓背 → 往外緩降的頂面 → 肩線（銳利）→ 微外張的側裙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  const d = t - s;
  return [
    [0, t],
    [0.2 * h, t - 0.07 * d],
    [0.38 * h, t - 0.3 * d],
    [0.56 * h, t - 0.6 * d],
    [0.8 * h, t - 0.86 * d],
    [h, s],
    [h + 0.6, lerp(s, lo, 0.5)],
    [h + 1.0, lo],
  ];
};

/**
 * 車尾與鼻部每 1 mm 一站，中段每 2 mm（曲面內部固定每 0.5 mm 取樣，0.75 mm 站距會讓兩端變成每 0.375 mm 一列，
 * 多出約 6% 的殼面三角面，外觀看不出差別）
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = [...buildStations(-58, -50, 1, profile).slice(0, -1), ...buildStations(-50, 58, 2, profile).slice(0, -1), ...buildStations(58, 75, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {number} 前輪露出切口只切 |z| ≥ 這個值（輪胎內側面 22.75 之外） */
const CUT_Z = 23.6;
/** @type {number} 切口前緣的後掠率（俯視每往外 1 mm 往後 0.3 mm）：內側 x 44 → 外緣約 x 39.3，擋泥板後緣停在輪軸正上方附近，不往後懸出薄翼尖 */
const CUT_SWEEP = 0.3;
/** @type {(az: number) => number} 前輪露出切口的前緣 x（俯視往外側後掠） */
const cutFrontX = (az) => 44 - CUT_SWEEP * (az - CUT_Z);
/**
 * F3 半罩露輪：前輪罩後半切開（x 22 → cutFrontX），從上方與側面都看得到前輪胎面；切口後緣和輪拱後緣（x 22.5）接在一起，
 * 前緣是一條俯視後掠的斜線。負值 = 開口內
 * @type {(x: number, y: number, z: number) => number}
 */
const frontCutSd = (x, y, z) => {
  const az = Math.abs(z);
  return Math.max(CUT_Z - az, 22 - x, (x - cutFrontX(az)) / Math.hypot(1, CUT_SWEEP));
};

/**
 * 座艙罩（金蘋果）：琥珀金色的透明半橢球殼（俯視橢圓：中心 x 4、前後半長 15、半寬 10.5；底面 y 30、頂 38），罩下的殼面貼金。
 * 16 × 6 段，以殼面積計入質量
 * @type {{ xc: number, a: number, b: number, y0: number, h: number }}
 */
const CANOPY = { xc: 4, a: 15, b: 10.5, y0: 30, h: 8 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * Math.sqrt(1 - q * q);
};
/** @type {(x: number, z: number) => number} 座艙罩俯視橢圓的正規化半徑（1 = 底緣） */
const canopyR = (x, z) => Math.hypot((x - CANOPY.xc) / CANOPY.a, z / CANOPY.b);

/** @type {(x: number) => number} 黑漆裙帶上緣（側裙下緣往上 2.4 mm） */
const yRedBand = (x) => P.yLow(x) + 2.4;

/**
 * 漸層分界線（往後疊的羽緣）：x0 在中線的位置，往兩側每 1 mm 後掠 0.3 mm，再減掉一排朝車尾鼓出的半圓弧（每 7 mm 一瓣、深 4 mm）
 * @type {(x0: number, z: number) => number}
 */
const featherEdgeX = (x0, z) => {
  const az = Math.abs(z);
  const q = 2 * ((((az / 7 + 0.5) % 1) + 1) % 1) - 1;
  return x0 - 0.3 * az - 4 * Math.sqrt(Math.max(0, 1 - q * q));
};
/** @type {number[]} 兩條漸層分界的 x0：深紅 | 朱紅、朱紅 | 火焰橘 */
const EDGE_X0 = [33, -16];

/** @type {{ x0: number, x1: number, w: number }} 鼻尖到座艙的黑漆草葉形長條（俯視兩端收尖，最寬處半寬 w） */
const BLADE = { x0: 12, x1: 73.5, w: 5.4 };
/** @type {(x: number, y: number, z: number) => number} 黑漆長條：正值 = 長條內（只在頂面） */
const bladeKeep = (x, y, z) => {
  if (x <= BLADE.x0 || x >= BLADE.x1 || y < P.yS(x) - 0.05) {
    return -1;
  }
  const t = (x - BLADE.x0) / (BLADE.x1 - BLADE.x0);
  return BLADE.w * Math.sin(Math.PI * t) ** 0.8 - Math.abs(z);
};
/** @type {(x: number) => number} 長條上 Khokhloma 捲莖的中心線 z（沿 x 每 13 mm 左右擺一次） */
const stemZ = (x) => 1.5 * Math.sin((2 * Math.PI * (x - 22)) / 13);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // Khokhloma 黑漆：鼻上的草葉形長條、側裙下緣帶、扇形尾翼的羽軸
  black: namedMaterial('paint-khokhloma-black', { color: 0x0e0b0a, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 漸層三色（亮漆）：鼻段深紅 → 中段朱紅 → 尾段火焰橘；以紅橙為主、黑只當圖形色，避開 Black Saber 的黑＋紅灰＋深金座艙
  crimson: namedMaterial('paint-firebird-crimson', { color: 0x8a1512, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  vermilion: namedMaterial('paint-firebird-vermilion', { color: 0xc4301a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  flame: namedMaterial('paint-flame-orange', { color: 0xe0761c, roughness: 0.42, clearcoat: 0.5 }),
  // 金：真金屬（名稱含 -brass → Blender metallic）：扇形尾翼的翼梢、翼根座
  gold: namedMaterial('trim-gold-brass', { color: 0xd1a23e, metalness: 0.8, roughness: 0.3, clearcoat: 0.3 }),
  // 金蘋果座艙罩：琥珀金色的透明 PC（名稱沿用座艙罩的 pc-smoke-tint，Blender 依名稱當玻璃）
  glass: namedMaterial('pc-smoke-tint', { color: 0xd9962a, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  // 殼內面與殼緣厚度面：深紅（前輪切口與輪拱邊看到的是紅色殼的內側與斷面，不是黑縫）
  inner: namedMaterial('shell-inner-crimson', { color: 0x5a1512, roughness: 0.8, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-crimson', { color: 0x8a1512, roughness: 0.5, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x15110f, roughness: 0.7, side: THREE.DoubleSide }),
  // 前輪室封板（切口後方隔板、前擋泥板下的內襯與斷面牆）：比殼內面亮一階的紅（輪室多半在陰影裡，太深會讀成黑洞），
  // 從切口看進去是封起來的紅色輪室
  well: namedMaterial('shell-wheelwell-crimson', { color: 0xb33a22, roughness: 0.55, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-gold-khokhloma', { color: 0xd6a640, metalness: 0.75, roughness: 0.3 }),
  // 漿果：朱紅（在黑漆上要比殼面的朱紅亮）
  dBerry: decalMaterial('decal-berry-cinnabar', { color: 0xe23a22, roughness: 0.35 }),
  // 側面飛羽羽面（金橙，非金屬）與羽枝（深紅）
  dFlame: decalMaterial('decal-feather-amber', { color: 0xeb9a2c, roughness: 0.45 }),
  dBarb: decalMaterial('decal-feather-barb', { color: 0x7a1a10, roughness: 0.5 }),
  dBlack: decalMaterial('decal-lacquer-black', { color: 0x0e0b0a, roughness: 0.3, clearcoat: 0.6 }),
  dShadow: decalMaterial('decal-relief-shadow', { color: 0x050404, roughness: 0.6 }),
});

/** @type {number} 扇形尾翼翼根 x（座艙後方的背脊上） */
const FAN_ROOT_X = -27;
/**
 * 扇形尾翼的 4 種翼片（中央 1 片＋左右各 3 片，共 7 片）：[偏航角（度，往外側）, 長, 最大半寬, 翼梢高 y, 滾轉角（度，外緣往下）]。
 * 全部從同一個翼根放射、往後上方張開；中央最長最高，越外側越短越低、外緣略垂（翼面朝外上方，側視與 3/4 視角都看得到翼面的漸層；
 * 外緣垂太多時最外側兩片會貼到車尾頂面上，從後方看像一片翹起的薄邊）。
 * V7：翼頂比座艙頂高約 7.5
 * @type {number[][]}
 */
const FAN_BLADES = [
  [0, 50, 4.6, 44.4, 0],
  [11, 48, 4.4, 43.8, 6],
  [22, 44, 4.1, 42.8, 12],
  [33, 38, 3.6, 41.6, 18],
];
/** @type {[number, number, string][]} 翼片分段上色：[t0, t1, 材質鍵]（翼根深紅 → 火焰橘 → 金翼梢） */
const FAN_SEGMENTS = [
  [0, 0.36, 'crimson'],
  [0.36, 0.7, 'flame'],
  [0.7, 1, 'gold'],
];
/** @type {number} 翼片厚度（射出件可成形） */
const FAN_THICK = 1.1;
/** @type {THREE.Vector3} */
const UP = new THREE.Vector3(0, 1, 0);

/**
 * 翼片半寬：翼根 1.6，到 72% 處展到最寬，之後收成尖梢
 * @type {(t: number, w: number) => number}
 */
const bladeHalfW = (t, w) => {
  if (t < 0.72) {
    return lerp(1.6, w, (t / 0.72) ** 0.8);
  }
  return w * (1 - ((t - 0.72) / 0.28) ** 1.6);
};

/**
 * 7 片扇形尾翼（平板實體件，依段上色，每片中線一條黑漆羽軸；按材質分組）。rootY 為翼根高度
 * @type {(rootY: number) => Record<string, THREE.BufferGeometry[]>}
 */
const buildFan = (rootY) => {
  /** @type {Record<string, THREE.BufferGeometry[]>} */
  const byMat = {};
  for (const [yawDeg, len, w, tipY, rollDeg] of FAN_BLADES) {
    for (const sg of yawDeg === 0 ? [1] : [-1, 1]) {
      const yaw = (sg * yawDeg * Math.PI) / 180;
      const pitch = Math.asin((tipY - rootY) / len);
      const dir = new THREE.Vector3(-Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw));
      const flat = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const roll = (-sg * rollDeg * Math.PI) / 180;
      const across = flat.clone().multiplyScalar(Math.cos(roll)).addScaledVector(new THREE.Vector3().crossVectors(dir, flat), Math.sin(roll));
      const normal = new THREE.Vector3().crossVectors(dir, across);
      const basis = new THREE.Matrix4().makeBasis(dir, across, normal).setPosition(FAN_ROOT_X, rootY, 0);
      for (const [t0, t1, mat] of FAN_SEGMENTS) {
        /** @type {THREE.Vector2[]} */
        const upper = [];
        /** @type {THREE.Vector2[]} */
        const lower = [];
        const n = 6;
        for (let i = 0; i <= n; i++) {
          const t = lerp(t0, t1, i / n);
          const h = bladeHalfW(t, w);
          upper.push(new THREE.Vector2(t * len, h));
          if (h > 1e-6) {
            lower.push(new THREE.Vector2(t * len, -h));
          }
        }
        const geo = new THREE.ExtrudeGeometry(new THREE.Shape([...upper, ...lower.reverse()]), { depth: FAN_THICK, bevelEnabled: false });
        geo.applyMatrix4(basis);
        (byMat[mat] ??= []).push(geo);
      }
      // 黑漆羽軸：翼片上表面中線的細長凸條（翼根寬 0.9 → 翼梢前收到 0.3，高 0.15 mm；不和翼片重疊，質量不重複計）
      const shaft = new THREE.Shape([
        new THREE.Vector2(0.05 * len, 0.45),
        new THREE.Vector2(0.9 * len, 0.15),
        new THREE.Vector2(0.9 * len, -0.15),
        new THREE.Vector2(0.05 * len, -0.45),
      ]);
      const shaftGeo = new THREE.ExtrudeGeometry(shaft, { depth: 0.15, bevelEnabled: false });
      shaftGeo.translate(0, 0, FAN_THICK);
      shaftGeo.applyMatrix4(basis);
      (byMat.black ??= []).push(shaftGeo);
    }
  }
  return byMat;
};

/**
 * 側面飛羽列（細長、尖端朝後的飛羽，有往後掃的方向感；不做金框橢圓的覆羽，那會像豆子或葉子）：
 * 5 片羽根都收在前輪拱後緣（x 20.6 → 23.2），由下往上一片疊一片，越上面越長（26 → 42 mm）、往後上揚的角度越大（2° → 6°），
 * 像被風往後拉長的火羽；羽片長寬比 9:1 → 12:1（≥ 4:1），羽根窄、中段等寬、後 45% 收成尖端。
 * 不用朱紅火焰尖羽：羽面金橙、直的黑漆羽軸、深紅斜向羽枝細紋。[羽根 x, 羽根 y, 長, 半寬, 上揚角（度）]
 * @type {number[][]} 依疊放順序（越前面越上層：上片蓋住下片）
 */
const SIDE_FEATHERS = [
  [23.2, 22.0, 42, 1.7, 6],
  [22.3, 20.0, 38, 1.65, 5.5],
  [21.6, 18.0, 34, 1.6, 4.5],
  [21.0, 16.0, 30, 1.5, 3.5],
  [20.6, 14.3, 26, 1.45, 2],
];

/**
 * 側面飛羽距離場：回傳最上層蓋住該點的羽片 { k, d（到該片邊界距離，負值 = 片內）, a（沿羽軸往後）, b（離羽軸，往上為正） }；
 * 沒有任何羽片蓋住時 k = −1、d = 到最近羽片的距離
 * @type {(x: number, y: number) => { k: number, d: number, a: number, b: number }}
 */
const sideFeathers = (x, y) => {
  let nearest = Infinity;
  for (let k = 0; k < SIDE_FEATHERS.length; k++) {
    const [x0, y0, len, w, deg] = SIDE_FEATHERS[k];
    const ang = (deg * Math.PI) / 180;
    const dx = x0 - x;
    const dy = y - y0;
    const a = dx * Math.cos(ang) + dy * Math.sin(ang);
    const b = -dx * Math.sin(ang) + dy * Math.cos(ang);
    // 羽片輪廓：羽根 12% 由 0.55 倍寬展開、中段等寬、後 45% 直線收成尖端（尖端朝後）
    const t = a / len;
    let B = w;
    if (t < 0.12) {
      B = w * lerp(0.55, 1, Math.max(0, t) / 0.12);
    } else if (t > 0.55) {
      B = w * Math.max(0, (1 - t) / 0.45);
    }
    const d = Math.max(Math.abs(b) - B, -a, a - len);
    if (d < 0) {
      return { k, d, a, b };
    }
    nearest = Math.min(nearest, d);
  }
  return { k: -1, d: nearest, a: 0, b: 0 };
};

/**
 * 翼尖羽緣：前輪上方的頂面外緣一圈火焰橘，內緣是往後指的鋸齒尖羽；回傳負值 = 在羽緣帶內
 * @type {(x: number, y: number, z: number) => number}
 */
const wingTipBand = (x, y, z) => {
  if (y < P.yS(x) - 0.4 || x < 16 || x > 54) {
    return 1;
  }
  const w = P.hw(x) - Math.abs(z);
  // 鋸齒：每 7.5 mm 一羽，羽尖朝車尾（往後漸寬、到羽尖突然收回）
  const ph = (((x - 16) % 7.5) + 7.5) % 7.5;
  const tooth = 3.4 * (1 - ph / 7.5);
  const fade = Math.min(1, (x - 16) / 8, (54 - x) / 6);
  return w - (3 + tooth) * Math.max(0, fade);
};

/**
 * 平面條帶：沿參數 t（0 → 1，n 段）每個取樣點給一對 [下緣點, 上緣點]（null = 這裡沒有板），相鄰兩個有效取樣之間接一個四邊形
 * @type {(n: number, at: (t: number) => number[][] | null) => THREE.BufferGeometry}
 */
const buildStrip = (n, at) => {
  /** @type {number[]} */
  const pos = [];
  let prev = at(0);
  for (let i = 1; i <= n; i++) {
    const cur = at(i / n);
    if (prev && cur) {
      const [A, B] = prev;
      const [D, C] = cur;
      pos.push(...A, ...D, ...C, ...A, ...C, ...B);
    }
    prev = cur;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 車尾端面（x −58 的平面端蓋）的羽鱗弧線：往下垂的半圓弧（像一層層往下疊的羽鱗），每排錯開半格；
 * 只留整段落在端蓋輪廓內（往內縮 0.7 mm）、黑漆裙帶之上的弧段。r0 / r1 = 弧帶內外半徑偏移（相對 R），dx = 離端蓋往後的距離
 * @type {(r0: number, r1: number, dx: number) => THREE.BufferGeometry}
 */
const buildTailCapScales = (r0, r1, dx) => {
  const x = STATIONS[0].x - dx;
  const half = profile(STATIONS[0].x);
  /** @type {(z: number) => number} 端蓋輪廓在 |z| 處的上緣 y（半剖面折線內插） */
  const capTop = (z) => {
    const az = Math.abs(z);
    for (let i = 0; i < half.length - 1; i++) {
      const [z0, y0] = half[i];
      const [z1, y1] = half[i + 1];
      if (az >= z0 && az <= z1 && z1 > z0) {
        return lerp(y0, y1, (az - z0) / (z1 - z0));
      }
    }
    return -Infinity;
  };
  const yMin = yRedBand(x) + 0.7;
  /** @type {(z: number, y: number) => boolean} */
  const inside = (z, y) => y > yMin && y < capTop(z) - 0.7;
  const R = 3;
  const n = 12;
  /** @type {number[]} */
  const pos = [];
  for (let row = 0; row < 3; row++) {
    const yc = 21 + row * 1.6 * R;
    const off = row % 2 === 0 ? 0 : R;
    for (let k = -4; k <= 4; k++) {
      const zc = k * 2 * R + off;
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI + (Math.PI * i) / n;
        const a1 = Math.PI + (Math.PI * (i + 1)) / n;
        const pts = [
          [zc + (R + r0) * Math.cos(a0), yc + (R + r0) * Math.sin(a0)],
          [zc + (R + r1) * Math.cos(a0), yc + (R + r1) * Math.sin(a0)],
          [zc + (R + r1) * Math.cos(a1), yc + (R + r1) * Math.sin(a1)],
          [zc + (R + r0) * Math.cos(a1), yc + (R + r0) * Math.sin(a1)],
        ];
        if (!pts.every(([z, y]) => inside(z, y))) {
          continue;
        }
        const [A, B, C, D] = pts.map(([z, y]) => [x, y, z]);
        // 法線朝車尾（−x）
        pos.push(...A, ...C, ...B, ...A, ...D, ...C);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @type {number} 擋泥板下折後緣的起點 |z|（31 mm 輪外側面 = 輪距 59.5 / 2 + 輪寬 10 / 2 = 34.75，再留 1.15 mm 間隙） */
const FENDER_LIP_Z = 35.9;

/** @type {number} 前輪室封板的 |z|（和胎內側環形擋板同一平面） */
const WELL_Z = 22.9;
/** @type {number} 前輪擋泥板內襯半徑（R17.5 輪拱 + 0.3） */
const WELL_R = 17.8;
/** @type {(x: number) => number} 前輪拱圓（半徑 r）在 x 處的上緣 y（超出圓的範圍回傳 −∞） */
const archTopY = (x, r) => {
  const d = r * r - (x - ARCHES[0].x) ** 2;
  return d > 0 ? ARCHES[0].y + Math.sqrt(d) : -Infinity;
};
/** @type {(x: number) => number} 前輪罩殘留部分（切口前緣之前）在 x 處的最內側 |z|（x ≥ 44 時整段都在） */
const fenderZIn = (x) => Math.max(WELL_Z, x >= 44 ? WELL_Z : CUT_Z + (44 - x) / CUT_SWEEP);

/**
 * 前輪室封板（右側；左側鏡射）：前輪罩後半切開後，從切口看進去原本是殼內的空腔（暗洞）與擋泥板下方的空腔（從後方看像一片翹起的薄邊）。
 * 用 5 片板把輪室圍起來：
 * (0) 胎內側環形擋板（|z| 22.9，輪拱圓心為圓心、半徑 12.3 → 17.8 的上半圈，避開底盤側框與安裝柱）：把輪室和殼內空腔隔開；
 * (1) 胎內側隔板（|z| 22.9）：切口範圍內、R17.6 圓以外、底盤側框之上，到殼頂內面；
 * (2) 切口後壁（x 21.7）：殼內面的斷面，從底盤側框或側裙下緣到殼頂內面；
 * (3) 擋泥板內襯：R17.8 圓柱面，從切口前緣往前到擋泥板收窄處；
 * (4) 擋泥板斷面牆：沿切口前緣，從內襯到殼頂內面，讓擋泥板後緣看起來是實心的端面；輪胎外側（|z| ≥ 35.9，31 mm 輪外側面 34.75 外 1.15 mm）
 *     再往下延伸成 3.5 mm 高的下折後緣：擋泥板在輪胎正上方只有約 1.3 mm 厚，從後方看是一片往上翹的薄邊，下折後緣讓它讀成有厚度的擋泥板
 * @type {(topY: (x: number, z: number) => number) => THREE.BufferGeometry}
 */
const buildFrontWell = (topY) => {
  /** @type {(x: number, y: number, z: number) => number[]} */
  const v = (x, y, z) => [x, y, z];
  const geos = [];
  // (0) 胎內側環形擋板（徑向 2 段）
  for (const [r0, r1] of [
    [12.3, 15],
    [15, 17.8],
  ]) {
    geos.push(
      buildStrip(30, (t) => {
        const a = lerp(0.1, Math.PI - 0.1, t);
        const p0 = [ARCHES[0].x + r0 * Math.cos(a), ARCHES[0].y + r0 * Math.sin(a)];
        const p1 = [ARCHES[0].x + r1 * Math.cos(a), ARCHES[0].y + r1 * Math.sin(a)];
        if (chassisBlockedNearArch(p0[0], p0[1]) || chassisBlockedNearArch(p1[0], p1[1])) {
          return null;
        }
        return [v(p0[0], p0[1], WELL_Z), v(p1[0], p1[1], WELL_Z)];
      }),
    );
  }
  // (1) 胎內側隔板
  geos.push(
    buildStrip(24, (t) => {
      const x = lerp(21.6, 44.5, t);
      const yb = Math.max(x < 26.8 ? 22.4 : -Infinity, archTopY(x, 17.6), 13);
      const yt = topY(x, WELL_Z) - 0.9;
      return yt > yb + 0.1 ? [v(x, yb, WELL_Z), v(x, yt, WELL_Z)] : null;
    }),
  );
  // (2) 切口後壁：底盤側框（|z| ≤ 26.5）之上，外側一路到側裙下緣
  const XB = 21.7;
  const zMax = P.hw(XB) - 0.4;
  for (const [z0, z1, yb] of [
    [WELL_Z, 26.5, 22.4],
    [26.5, zMax, P.yLow(XB) + 0.4],
  ]) {
    geos.push(
      buildStrip(5, (t) => {
        const z = lerp(z0, z1, t);
        const yt = topY(XB, z) - 0.9;
        return yt > yb + 0.1 ? [v(XB, yb, z), v(XB, yt, z)] : null;
      }),
    );
  }
  // (3) 擋泥板內襯：R17.8 圓柱面，角度從切口外緣（x 39.2）往前到 x 56
  geos.push(
    buildStrip(20, (t) => {
      const a = lerp(Math.acos(-0.8 / WELL_R), Math.acos(16 / WELL_R), t);
      const x = ARCHES[0].x + WELL_R * Math.cos(a);
      const y = ARCHES[0].y + WELL_R * Math.sin(a);
      const z0 = fenderZIn(x);
      const z1 = P.hw(x) - 0.4;
      return z1 > z0 + 0.1 ? [v(x, y, z0), v(x, y, z1)] : null;
    }),
  );
  // (4) 擋泥板斷面牆：沿切口前緣（往外側後掠的斜線，往殼內退 0.25）
  const zEnd = P.hw(cutFrontX(39)) - 0.4;
  geos.push(
    buildStrip(14, (t) => {
      const z = lerp(CUT_Z, zEnd, t);
      const x = cutFrontX(z) + 0.25;
      const yt = topY(x, z) - 0.3;
      const yb = z >= FENDER_LIP_Z ? Math.min(archTopY(x, WELL_R) - 0.1, yt - 3.5) : archTopY(x, WELL_R) - 0.1;
      return yt > yb + 0.1 ? [v(x, yb, z), v(x, yt, z)] : null;
    }),
  );
  const right = mergeGeos(geos);
  const left = right.clone();
  left.scale(1, 1, -1);
  return mergeGeos([right, left]);
};

export const firebirdBody = makePolyBody({
  id: 'body-firebird',
  name: '火鳥火羽',
  style: 'myth',
  phase: 8,
  mythSeries: 'slavic',
  mythTheme: 'zhar-ptitsa',
  form: 'firebird-glide',
  roof: 'canopy',
  wing: 'radial-fan',
  theme: '火鳥的元素（不做鳥）：箭簇形楔形尖鼻、前輪罩後半切開露出前輪；車尾 7 片從同一翼根放射的扇形尾翼（深紅 → 火焰橘 → 金翼梢）；琥珀金透明半球座艙罩（罩下貼金）；殼面由鼻到尾深紅 → 朱紅 → 火焰橘三段漸層（圓弧羽緣＋金線分界），鼻上一支黑漆草葉長條畫 Khokhloma 金色捲莖與朱紅漿果，側面 5 片往後拉長的飛羽貼紙',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 肩線是銳利稜線
  hard: [5],
  wheelArches: ARCHES,
  openings: [{ id: '前輪露出後掠切口', shape: 'fn', sd: frontCutSd }],
  sideZMin: 30,
  zones: () => [
    // 黑漆裙帶（側裙最下 2.4 mm）
    { mat: 'black', keep: (x, y) => yRedBand(x) - y },
    // 鼻尖到座艙的黑漆草葉長條
    { mat: 'black', keep: bladeKeep },
    // 翼尖火焰橘尖羽
    { mat: 'flame', keep: (x, y, z) => -wingTipBand(x, y, z) },
    // 由鼻到尾漸層：深紅 → 朱紅 → 火焰橘
    { mat: 'crimson', keep: (x, y, z) => x - featherEdgeX(EDGE_X0[0], z) },
    { mat: 'vermilion', keep: (x, y, z) => x - featherEdgeX(EDGE_X0[1], z) },
    { mat: 'flame', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'flame', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯：前輪罩後半切開，內襯只做後輪（前輪內襯會浮在切口裡）
    parts.push({
      geometry: buildProfileLiner(ARCHES[1], 23.4, profile),
      mat: 'liner',
      shell: true,
      name: 'arch-liner-rear',
    });
    // 前輪胎內側的環形擋板（|z| 22.9）＋前輪室封板（隔板、切口後壁、擋泥板內襯與斷面牆）：從切口看進去是封起來的深紅輪室
    parts.push({
      geometry: buildFrontWell((x, z) => kit.surf.topY(x, z)),
      mat: 'well',
      shell: true,
      name: 'arch-well-front',
    });
    // 座艙罩：琥珀金透明半橢球殼（殼面積計入質量）
    {
      const dome = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.scale(CANOPY.a, CANOPY.h, CANOPY.b);
      dome.translate(CANOPY.xc, CANOPY.y0, 0);
      parts.push({ geometry: dome, mat: 'glass', shell: true, renderOrder: 3, name: 'canopy-dome' });
    }
    // 扇形尾翼（實體件，依段上色）；翼根埋進背脊 0.5 mm
    const rootY = kit.surf.topY(FAN_ROOT_X, 0) - 0.5;
    for (const [mat, geos] of Object.entries(buildFan(rootY))) {
      parts.push({ geometry: mergeGeos(geos), mat, solid: true, outline: true, name: `feather-fan-${mat}` });
    }
    // 翼根座：金色扁橢球，把 7 片翼根和背脊接成一體
    const boss = new THREE.SphereGeometry(1, 16, 10);
    boss.scale(4.6, 1.6, 5.2);
    boss.translate(FAN_ROOT_X + 0.5, rootY + 0.5, 0);
    parts.push({ geometry: boss, mat: 'gold', solid: true, outline: true, name: 'fan-root-boss' });

    // ---- 貼紙 ----
    // 座艙罩下的貼金底面連同外圍 1.2 mm 金框（透過琥珀罩看到的是金色）＋座艙到翼根座的金色背脊線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const r = canopyR(x, z);
        const ring = 1 + 1.2 / CANOPY.b - r;
        const spine = Math.min(0.45 - Math.abs(z), CANOPY.xc - CANOPY.a - x, x - FAN_ROOT_X);
        return Math.max(ring, spine);
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // 前擋泥板後緣金邊：沿切口前緣的頂面一道 0.8 mm 金線，讓擋泥板後緣讀成收邊的端面
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (az < CUT_Z || y < P.yS(x) - 0.05) {
          return -1;
        }
        const d = x - cutFrontX(az);
        return Math.min(d - 0.05, 0.85 - d);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-fender-trailing-edge',
    });
    // 肩線金線（沿稜線內側）
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - (P.hw(x) - 1.2)), 69 - x, x + 57.8, y - P.yS(x) + 0.1)),
      mat: 'dGold',
      name: 'decal-shoulder-edge',
    });
    // 漸層分界的金線（只在頂面，避開黑漆長條與座艙罩）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < P.yS(x) - 0.05 || bladeKeep(x, y, z) > -0.6 || canopyR(x, z) < 1.15) {
          return -1;
        }
        return 0.4 - Math.min(...EDGE_X0.map((x0) => Math.abs(x - featherEdgeX(x0, z))));
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-gradient-edges',
    });
    // 黑漆長條：金色外框（0.5 mm）＋ Khokhloma 捲莖（沿中線左右擺的金線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const k = bladeKeep(x, y, z);
        if (k < 0 || canopyR(x, z) < 1.15) {
          return -1;
        }
        const frame = 0.5 - k;
        const stem = x > 24 && x < 66 ? Math.min(0.32 - Math.abs(z - stemZ(x)), k - 1) : -1;
        return Math.max(frame, stem);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-blade-stem',
    });
    // 朱紅漿果：捲莖每個彎的內側一顆（半徑 0.9）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (bladeKeep(x, y, z) < 1.2) {
          return -1;
        }
        const k = Math.round((x - 25.25) / 6.5);
        const xc = 25.25 + 6.5 * k;
        if (xc < 25 || xc > 62) {
          return -1;
        }
        return 0.9 - Math.hypot(x - xc, z + Math.sign(stemZ(xc)) * 1.1);
      }, { offset: 0.12 }),
      mat: 'dBerry',
      name: 'decal-blade-berries',
    });
    // 頂面羽鱗：往後疊的扇形羽片（金色弧線 0.7 mm，外圈一道 0.35 mm 深紅描邊，讓金紋在橘底上跳出來（黑色描邊近看像一排小破洞）），
    // 從前輪上方一路鋪到車尾，座艙兩側到肩線；避開黑漆長條與背脊線（扇尾翼根之後沒有背脊線，鋪到中線旁）
    /** @type {(x: number, y: number, z: number) => number} 頂面羽鱗弧的半徑差（NaN = 這裡不鋪） */
    const wingScaleDr = (x, y, z) => {
      const az = Math.abs(z);
      const zIn = x < FAN_ROOT_X ? 1.2 : canopyHalfW(x) + 3.2;
      if (x < -57 || x > 47 || az < zIn || az > P.hw(x) - 2.6 || wingTipBand(x, y, z) < 0.6 || bladeKeep(x, y, z) > -1) {
        return NaN;
      }
      const R = 3.4;
      const row = Math.round((az - 6) / (1.6 * R));
      const zc = 6 + row * 1.6 * R;
      const off = row % 2 === 0 ? 0 : R;
      const xc = Math.round((x - off) / (2 * R)) * 2 * R + off;
      // 羽片弧：圓心在 (xc + R·0.6, zc)，只取後半圈（x < 圓心）
      const cx = xc + 0.6 * R;
      if (x > cx) {
        return NaN;
      }
      return Math.hypot(x - cx, az - zc) - R;
    };
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const dr = wingScaleDr(x, y, z);
        return Number.isNaN(dr) ? -1 : 0.35 - Math.abs(dr);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-wing-scales',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const dr = wingScaleDr(x, y, z);
        return Number.isNaN(dr) ? -1 : 0.2 - Math.abs(dr - 0.55);
      }, { offset: 0.1 }),
      mat: 'dBarb',
      name: 'decal-wing-scales-ink',
    });
    // 車尾側壁羽鱗：後輪後方收窄的車尾側壁（輪胎內側）鋪同一種扇形羽片弧線（側視 (x, y) 格）＋深紅描邊，車尾不留整片素面
    /** @type {(x: number, y: number, z: number) => number} 側壁羽鱗弧的半徑差（NaN = 這裡不鋪） */
    const tailScaleDr = (x, y, z) => {
      const az = Math.abs(z);
      if (x > -38 || az < P.hw(x) - 0.2 || y > P.yS(x) - 0.8 || y < yRedBand(x) + 0.6 || (az > 22.8 && archRingDist(x, y) < 1.2)) {
        return NaN;
      }
      const R = 3;
      const row = Math.round((y - 13) / (1.6 * R));
      const yc = 13 + row * 1.6 * R;
      const off = row % 2 === 0 ? 0 : R;
      const cx = Math.round((x - off) / (2 * R)) * 2 * R + off + 0.6 * R;
      if (x > cx) {
        return NaN;
      }
      return Math.hypot(x - cx, y - yc) - R;
    };
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const dr = tailScaleDr(x, y, z);
        return Number.isNaN(dr) ? -1 : 0.35 - Math.abs(dr);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-tail-side-scales',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const dr = tailScaleDr(x, y, z);
        return Number.isNaN(dr) ? -1 : 0.2 - Math.abs(dr - 0.55);
      }, { offset: 0.1 }),
      mat: 'dBarb',
      name: 'decal-tail-side-scales-ink',
    });
    // 車尾端面羽鱗（正後方那一面）：往下垂的金色半圓弧＋深紅描邊
    parts.push({ geometry: buildTailCapScales(-0.35, 0.35, 0.12), mat: 'dGold', name: 'decal-tail-cap-scales' });
    parts.push({ geometry: buildTailCapScales(0.35, 0.75, 0.1), mat: 'dBarb', name: 'decal-tail-cap-scales-ink' });
    // 側面飛羽：金橙羽面＋直的黑漆羽軸＋深紅斜向羽枝細紋；每片下緣 0.6 mm 黑影，讓上片疊在下片上
    /** @type {(x: number, y: number, z: number) => boolean} 側裙（肩線以下、輪拱外） */
    const onSkirt = (x, y, z) => Math.abs(z) > P.hw(x) - 0.2 && y < P.yS(x) - 0.6 && y > yRedBand(x) + 0.3 && archRingDist(x, y) > 1.2;
    // 金橙羽面
    parts.push({
      geometry: kit.decal((x, y, z) => (onSkirt(x, y, z) ? -sideFeathers(x, y).d : -1), { offset: 0.1 }),
      mat: 'dFlame',
      name: 'decal-side-feathers-face',
    });
    // 黑漆羽軸：沿羽片中線的直線（寬 0.55），從羽根到羽尖前 2 mm
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSkirt(x, y, z)) {
          return -1;
        }
        const f = sideFeathers(x, y);
        if (f.k < 0) {
          return -1;
        }
        const len = SIDE_FEATHERS[f.k][2];
        return Math.min(0.275 - Math.abs(f.b), len - 2 - f.a);
      }, { offset: 0.14 }),
      mat: 'dBlack',
      name: 'decal-side-feather-rachis',
    });
    // 深紅羽枝細紋：羽軸兩側往後外斜的細線（每 1.1 mm 一道、線寬 0.32），避開羽軸與羽緣
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSkirt(x, y, z)) {
          return -1;
        }
        const f = sideFeathers(x, y);
        if (f.k < 0) {
          return -1;
        }
        const ab = Math.abs(f.b);
        const period = 1.1;
        const ph = (((f.a - 1.6 * ab) % period) + period) % period;
        const line = 0.16 - Math.abs(ph - period / 2);
        return Math.min(line, ab - 0.5, -f.d - 0.25, f.a - 1.5);
      }, { offset: 0.12 }),
      mat: 'dBarb',
      name: 'decal-side-feather-barbs',
    });
    // 羽片下緣 0.6 mm 黑影（上片疊在下片上的落差）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSkirt(x, y, z)) {
          return -1;
        }
        // 上方 0.6 mm 是更上層的羽片（或下方沒有羽片）→ 這裡是上片下緣的落影
        const here = sideFeathers(x, y);
        const above = sideFeathers(x, y + 0.6);
        if (above.k < 0 || (here.k >= 0 && here.k <= above.k)) {
          return -1;
        }
        return Math.min(-above.d, 0.3);
      }, { offset: 0.08 }),
      mat: 'dShadow',
      name: 'decal-side-feathers-shadow',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：殼面 x −58 ~ 75（鼻尖），扇形尾翼翼梢約 x −75；殼頂 31.6–32.6、座艙罩頂 38、扇形尾翼頂約 45.5（V7：尾翼比座艙頂高 ≤ 10）；前輪上方半寬 39.2（側裙外張 1.0）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；前輪罩後半切開露出輪胎（x 22 起，前緣俯視後掠：內側 x 44、外緣約 x 39.3，|z| ≥ 23.6）；後輪有輪拱內襯；前輪室以深紅封板圍起（胎內側環形擋板與隔板、切口後壁、擋泥板內襯與斷面牆）',
    fan: '扇形尾翼：7 片 ABS 平板（厚 1.1 mm，推估），偏航 0° / ±11° / ±22° / ±33°、長 50 / 48 / 44 / 38 mm、最大半寬 4.6 → 3.6 mm、外緣下垂 0° / 6° / 12° / 18°，同一翼根（x −27 背脊）放射，翼梢高 44.4 → 41.6；每片分三段上色（深紅、火焰橘、金），上表面中線一條黑漆羽軸凸條（寬 0.9 → 0.3、高 0.15 mm）；翼根座為金色扁橢球；質量 = 封閉體積 × 1.05 g/cm³',
    canopy: '座艙罩（金蘋果）：琥珀金透明半橢球殼 30 × 21 mm、罩下殼面貼金、高 8 mm，16 × 6 段，以殼面積 × 0.8 mm 計入質量（推估）',
    palette: 'Khokhloma 漆器的黑＋朱紅＋金與捲莖、漿果母題（研究來源見 DESIGN.md S3）；金蘋果與發亮的尾羽取自 Afanasyev 故事（S2）；色碼自訂（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
