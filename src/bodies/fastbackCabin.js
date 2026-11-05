// 快背雙門座艙殼（body-fastback-cabin，比賽型，raceType 'coupe-cabin'）：
// 長引擎蓋、偏後的封閉座艙、車頂平順滑到車尾的快背，尾端一體的低鴨尾唇；前後大輪拱 R17.6 可裝 31 mm 大徑輪（前葉子板頂抬到輪拱之上，前輪拱只切側壁）。
// 比賽做法：0.5 mm 真空成形 PC 透明殼，從內側噴漆、留煙燻車窗（shared/reference/BODY_RACE_RESEARCH.md 4.1、4.7、7.2 (1)）。
// 設計：shared/design/body-fastback-cabin/DESIGN.md。剖面由本檔縱向控制表產生（推估，依外框限制與底盤高度掃描）。
// 塗裝全為自創：石墨灰下身＋金屬銅上身、白色細分色線、中線兩側雙白寬條紋、白色圓形號碼底「64」；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import { makePolyBody, buildDriver } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sideDecal, topDecal, mergeGeos } from './loft.js';

/** @typedef {import('./loft.js').KeepFn} KeepFn */

/**
 * 單調三次內插（Fritsch–Carlson，不過衝）：給節點 tx（遞增）與各欄位的值，回傳 f(key, x)
 * @type {(tx: number[], tab: Record<string, number[]>) => (key: string, x: number) => number}
 */
export const monoTable = (tx, tab) => {
  /** @type {(v: number[]) => number[]} */
  const slopes = (v) => {
    const n = v.length;
    const d = [];
    for (let k = 0; k < n - 1; k++) {
      d.push((v[k + 1] - v[k]) / (tx[k + 1] - tx[k]));
    }
    const m = [d[0]];
    for (let k = 1; k < n - 1; k++) {
      if (d[k - 1] * d[k] <= 0) {
        m.push(0);
      } else {
        m.push((2 * d[k - 1] * d[k]) / (d[k - 1] + d[k]));
      }
    }
    m.push(d[n - 2]);
    return m;
  };
  /** @type {Record<string, number[]>} */
  const sl = {};
  for (const key of Object.keys(tab)) {
    sl[key] = slopes(tab[key]);
  }
  return (key, x) => {
    let k = 0;
    while (k < tx.length - 2 && x > tx[k + 1]) {
      k++;
    }
    const h = tx[k + 1] - tx[k];
    const t = Math.min(1, Math.max(0, (x - tx[k]) / h));
    const t2 = t * t;
    const t3 = t2 * t;
    const v = tab[key];
    const m = sl[key];
    return (2 * t3 - 3 * t2 + 1) * v[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * v[k + 1] + (t3 - t2) * h * m[k + 1];
  };
};

/** @type {number} 車尾 x */
const X_TAIL = -72;
/** @type {number} 鼻端 x */
const X_NOSE = 74;

/**
 * 縱向控制表（推估）：
 * - yC：中線高度。鼻端 14.5 → 引擎蓋 23–25（前齒輪箱 y ≤ 21.4 上方留 ≥ 1.5 mm）→ 擋風玻璃 → 車頂最高 38（x −6）→ 快背斜降 → 尾唇上翹 +2
 * - cw：車頂（窗框上緣）半寬；dr：車頂中線到窗框上緣的落差（車頂的弧度；引擎蓋段 dr ≈ 1 → 引擎蓋中央微拱）
 * - bw / yBelt：腰線（窗下緣）半寬與高度；腰線從前往後微升（楔形腰線）
 * - hw / ySh：最寬處（肩稜）半寬與高度；yLow：側裙下緣
 * 前輪範圍半寬 42.5、腰部收到 40、後輪葉子板鼓到 43（尾段 x ≤ −64 的側裙下緣抬到 y 22 以上，避開後上導輪 y 15.5–20.5；俯視可樂瓶，全寬 86，接近官方雙門跑車殼的全幅 88–92）；尾端收到 31
 */
const T = monoTable([-72, -69, -64, -56, -46, -36, -24, -12, -4, 4, 12, 20, 26, 36, 46, 56, 64, 69, 74], {
  yC: [29.0, 28.7, 27.0, 28.2, 30.6, 33.0, 35.8, 37.6, 38.0, 37.4, 34.2, 29.0, 25.6, 24.6, 23.8, 22.0, 19.6, 17.4, 14.8],
  cw: [12, 13.5, 15, 16, 17, 18, 19, 19.5, 19.5, 19.5, 20, 21, 22, 22, 22, 20, 16, 12, 8],
  dr: [0.6, 0.7, 0.9, 1.2, 1.6, 2.0, 2.4, 2.6, 2.6, 2.6, 2.2, 1.4, 0.9, 1.1, 1.1, 1.0, 0.8, 0.6, 0.4],
  bw: [24, 26, 29, 32, 33, 33, 33, 32.5, 32, 32, 32, 32, 32, 32, 31.5, 29, 24, 19, 13],
  yBelt: [26.2, 26.4, 26.2, 26.8, 27.6, 27.6, 27.2, 26.8, 26.4, 26, 25.6, 25.2, 24.2, 22.6, 21.6, 19.8, 17.6, 15.8, 13.8],
  // 鼻端半寬 x 69 / 74：21 / 13，俯視收成較尖的鼻（鼻部正面不要太寬平）
  hw: [31, 36, 40, 42.5, 43, 42.5, 41, 40, 40, 40.2, 40.8, 41.8, 42.5, 42.5, 41.2, 36.5, 30, 21, 13],
  ySh: [24.0, 24.0, 23.6, 23.4, 23.2, 23.0, 22.6, 22.2, 22.0, 21.8, 21.6, 21.4, 21.2, 21.0, 20.4, 19.0, 17.0, 15.4, 13.9],
  yLow: [22.8, 22.6, 22.0, 17.5, 13.0, 11.0, 9.6, 9.2, 9.2, 9.2, 9.4, 9.6, 10.0, 11.0, 12.0, 12.8, 13.2, 13.4, 13.5],
});

/**
 * 半剖面站位產生器（每 2 mm 一站，8 點）：車頂中線、車頂 1/2、窗框上緣、腰線、葉子板上緣、肩稜上方、肩稜、側裙下緣。
 * body-trail-canopy 也用同一套 8 點剖面（欄位意義相同：cw / dr 改當座艙罩半寬與弧度、bw / yBelt 改當側箱頂面內緣）
 * @type {(tab: (key: string, x: number) => number, xTail: number, xNose: number) => { x: number, pts: number[][] }[]}
 */
export const cabinStations = (tab, xTail, xNose) => {
  const xs = [];
  for (let x = xTail; x < xNose; x += 2) {
    xs.push(x);
  }
  xs.push(xNose);
  return xs.map((x) => {
    const yC = tab('yC', x);
    const cw = tab('cw', x);
    const dr = tab('dr', x);
    const bw = Math.max(tab('bw', x), cw + 1);
    const yBelt = Math.min(tab('yBelt', x), yC - dr - 0.2);
    const hw = Math.max(tab('hw', x), bw + 2);
    const ySh = Math.min(tab('ySh', x), yBelt - 0.4);
    const yLow = Math.min(tab('yLow', x), ySh - 0.6);
    const pts = [
      [0, yC],
      [0.5 * cw, yC - 0.28 * dr],
      [cw, yC - dr],
      [bw, yBelt],
      [bw + 0.55 * (hw - bw), yBelt - 0.32 * (yBelt - ySh)],
      [hw - 0.5, ySh + 0.35 * (yBelt - ySh) * 0.5],
      [hw, ySh],
      [hw, yLow],
    ];
    return { x, pts };
  });
};

/**
 * 前葉子板覆寫表（推估）：前輪拱範圍（x 22 → 58）把葉子板頂抬到輪拱圓（R17.6、圓心 y 13）之上，
 * 輪拱只切開側壁、不切穿葉子板頂 → 前葉子板和車門、鼻部連成連續殼面，俯視蓋住前輪胎頂（31 mm 輪頂 28.5，殼內面 ≥ 30.5）。
 * 後葉子板不覆寫（輪拱切穿葉子板頂）：後葉子板也蓋滿時俯視輪廓會和 halo-orbit / griffin-vane / zeppelin-xtail 太像（IoU 0.85–0.86，P20 門檻 0.85）。
 * - fk：覆寫權重（0 = 沿用 T 與 cabinStations 的原剖面；x ≤ 16 為 0，座艙剖面不變）。鼻端也是 fk = 1、各欄位到鼻尖單調收斂
 *   （若在 x 60 → 66 由覆寫表切回 T，兩表的鼻部寬度 / 高度不同，剖面點會來回擺動 1 mm，銅漆反光把它放大成凹凸）
 * - yC / dr：引擎蓋中線抬高 2–3 mm（擋風玻璃前緣 28.3 單調降到鼻端，不起伏），和葉子板頂只差約 4 mm，是緩坡而不是深谷
 * - cw：引擎蓋半寬（收窄到 15，引擎蓋夾在兩側葉子板之間）；bw / yBelt：葉子板內側上緣（引擎蓋兩側的谷壁頂）
 * - fw / yF：葉子板頂稜；ySh：肩稜（輪拱上方抬高，形成包住輪拱的葉子板鼓包）
 * 輪拱內的殼面高度門檻：y > 13 + √(17.6² − (x − 40)²)（|z| ≥ 23.3），各欄位在門檻上方留 ≥ 0.5 mm
 */
const F = monoTable([16, 26, 32, 40, 48, 54, 60, 66, 70, 74], {
  fk: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  yC: [31.7, 28.3, 28.0, 27.5, 26.6, 25.4, 23.7, 21.2, 18.4, 14.8],
  dr: [1.8, 1.0, 0.8, 0.8, 0.8, 0.8, 0.8, 0.7, 0.6, 0.4],
  // 鼻端 x 66 / 70 / 74 的引擎蓋、葉子板跟著 hw 收窄（cw 11.8 / 9 / 6，bw 18.6 / 14 / 9.5，fw 24.4 / 18.5 / 11.5）
  cw: [20.4, 18.5, 15, 15, 15, 14.6, 13.8, 11.8, 9, 6],
  bw: [32, 25, 23, 23, 23, 22.6, 21.6, 18.6, 14, 9.5],
  yBelt: [25.4, 26.5, 30.2, 31.5, 30.2, 27.5, 24.5, 21.4, 18.7, 14.8],
  fw: [37.1, 33, 32, 32, 32, 31, 28.8, 24.4, 18.5, 11.5],
  yF: [24.2, 27.4, 30.4, 32.3, 30.6, 27.9, 24.9, 21.7, 19.0, 15.0],
  ySh: [21.5, 25.0, 29.8, 31.4, 29.8, 25.0, 22.0, 19.2, 16.8, 13.9],
});

/**
 * 合成後的縱向表：fk = 0 的範圍完全等於 T，前葉子板段用 F 覆寫
 * @type {(key: string, x: number) => number}
 */
const TF = (key, x) => {
  const k = Math.min(1, Math.max(0, F('fk', x)));
  if (key === 'fw' || key === 'yF') {
    // 座艙段的葉子板上緣點 = cabinStations 第 4 點的原公式
    const bw = T('bw', x);
    const hw = Math.max(T('hw', x), bw + 2);
    const yBelt = T('yBelt', x);
    const ySh = Math.min(T('ySh', x), yBelt - 0.4);
    const auto = key === 'fw' ? bw + 0.55 * (hw - bw) : yBelt - 0.32 * (yBelt - ySh);
    return auto + (F(key, x) - auto) * k;
  }
  if (key === 'yC' || key === 'dr' || key === 'cw' || key === 'bw' || key === 'yBelt' || key === 'ySh') {
    return T(key, x) + (F(key, x) - T(key, x)) * k;
  }
  return T(key, x);
};

/**
 * 本款專用站位產生器（8 點，同 cabinStations 的點序；不動共用的 cabinStations，hinge-deck / lowline-flat 不受影響）：
 * 車頂中線、車頂 1/2、窗框上緣（引擎蓋邊）、腰線（葉子板內側上緣）、葉子板頂稜、肩稜上方、肩稜、側裙下緣
 * @type {() => { x: number, pts: number[][] }[]}
 */
const fastbackStations = () => {
  const xs = [];
  for (let x = X_TAIL; x < X_NOSE; x += 2) {
    xs.push(x);
  }
  xs.push(X_NOSE);
  return xs.map((x) => {
    const k = Math.min(1, Math.max(0, F('fk', x)));
    const yC = TF('yC', x);
    const cw = TF('cw', x);
    const dr = TF('dr', x);
    const bw = Math.max(TF('bw', x), cw + 1);
    // 座艙段：腰線不高於窗框上緣（原規則）；葉子板段：腰線可高於引擎蓋中線（谷壁）
    let yBelt = TF('yBelt', x);
    if (k < 0.5) {
      yBelt = Math.min(yBelt, yC - dr - 0.2);
    }
    const hw = Math.max(TF('hw', x), bw + 2);
    const fw = Math.min(Math.max(TF('fw', x), bw + 0.5), hw - 1);
    const yF = TF('yF', x);
    const ySh = Math.min(TF('ySh', x), Math.max(yBelt, yF) - 0.3);
    const yLow = Math.min(TF('yLow', x), ySh - 0.6);
    // 肩稜上方點：座艙段沿用原公式，葉子板段取頂稜與肩稜中間
    const y5a = ySh + 0.35 * (yBelt - ySh) * 0.5;
    const y5b = ySh + 0.5 * (yF - ySh);
    const pts = [
      [0, yC],
      [0.5 * cw, yC - 0.28 * dr],
      [cw, yC - dr],
      [bw, yBelt],
      [fw, yF],
      [hw - 0.5, y5a + (y5b - y5a) * k],
      [hw, ySh],
      [hw, yLow],
    ];
    return { x, pts };
  });
};

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = fastbackStations();

/** @type {(x: number) => number} 窗框上緣高度（車頂邊線） */
const roofEdgeY = (x) => TF('yC', x) - TF('dr', x);
/** @type {(x: number) => number} 腰線高度 */
const beltY = (x) => Math.min(TF('yBelt', x), roofEdgeY(x) - 0.2);
/**
 * 上身金屬銅 / 下身石墨灰的分色線（依概念圖，灰色下身佔比大）：
 * 鼻端與前輪拱段 y 16.5（前下巴灰）→ 前輪拱後方 x 22 → 4 從 y 18.5 斜掃下到車門下緣 y 14（側裙灰）→
 * 後輪拱前方 x −14 開始急升，到肩稜下 2 mm 後沿肩稜往後（整片後葉子板側壁為灰），尾端約 y 22（尾燈條下方）
 * @type {(x: number) => number}
 */
const splitY = (x) => {
  let y = 16.5;
  if (x < 22 && x >= 4) {
    y = 14.0 + (4.5 * (x - 4)) / 18;
  } else if (x < 4 && x >= -14) {
    y = 13.8 + (0.2 * (x + 14)) / 18;
  } else if (x < -14) {
    y = Math.min(13.8 + 0.85 * (-14 - x), TF('ySh', x) - 2.0);
  }
  return Math.min(beltY(x) - 2.6, y);
};

/**
 * 車窗（留煙燻透明的部分）：擋風玻璃、側窗（B 柱分前後兩片）、快背後窗；其餘窗框、A / B / C 柱內噴黑
 * 回傳 > 0 = 在玻璃內
 * @type {KeepFn}
 */
const glassKeep = (x, y, z) => {
  const az = Math.abs(z);
  const cw = TF('cw', x);
  const above = y - (beltY(x) + 0.7);
  // 擋風玻璃：x 23 → 9，車頂邊線內側
  const shield = Math.min(23 - x, x - 9.5, cw - 1.6 - az, above);
  // 側窗：窗框上緣以下、腰線以上，x 20 → −34，B 柱 x −6.5 ~ −8.5
  const side = Math.min(az - cw - 0.7, roofEdgeY(x) - 0.6 - y, above, 20.5 - x - 0.6 * (y - beltY(x)), x + 34 - 0.9 * (y - beltY(x)), Math.max(-6.4 - x, x + 8.6));
  // 快背後窗：x −30 → −56，車頂邊線內側
  const rear = Math.min(-30 - x, x + 56, cw - 1.8 - az, y - 27.6);
  return Math.max(shield, side, rear);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 透明 PC 殼的內噴漆（Blender 依名稱對應：pc-paint 類為透明殼內噴漆、pc-smoke 類為煙燻透明窗）
  // 主色金屬銅（避開陣容已大量使用的萊姆 / 黃綠）；下身石墨灰是調亮到看得出的金屬灰
  copper: namedMaterial('pc-paint-copper-metallic', { color: 0xb4602c, roughness: 0.18, metalness: 0.45, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  copper2: namedMaterial('pc-paint-copper-metallic', { color: 0xb4602c, roughness: 0.18, metalness: 0.45, clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide }),
  graphite: namedMaterial('pc-paint-graphite', { color: 0x4a4f56, roughness: 0.25, metalness: 0.45, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  graphite2: namedMaterial('pc-paint-graphite', { color: 0x4a4f56, roughness: 0.25, metalness: 0.45, clearcoat: 1.0, side: THREE.DoubleSide }),
  frame: namedMaterial('pc-paint-black', { color: 0x111214, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  window: namedMaterial('pc-smoke-window', { color: 0x1c2128, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.9, envMapIntensity: 0.5, depthWrite: false }),
  // 透明 PC 的內面與切邊
  inner: namedMaterial('pc-clear-shell-inner', { color: 0x2a2e33, roughness: 0.6, side: THREE.BackSide }),
  edge: namedMaterial('pc-clear-edge', { color: 0xb8c8d8, roughness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-white', { color: 0xf2f2ee, roughness: 0.3, clearcoat: 0.8 }),
  whiteDecal: decalMaterial('decal-white', { color: 0xf4f4f2, roughness: 0.3 }),
  black: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  head: decalMaterial('lamp-clear', { color: 0xe8f4ff, emissive: 0x9fc8ff, emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1.0 }),
  tailLamp: decalMaterial('lamp-red', { color: 0xc4121c, emissive: 0x7a0008, emissiveIntensity: 0.5, roughness: 0.1, clearcoat: 1.0 }),
  tailLampSolid: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

export const fastbackCabinBody = makePolyBody({
  id: 'body-fastback-cabin',
  name: 'PC 快背雙門座艙殼',
  style: 'race',
  // 分組（shared/reference/BODY_RACE_RESEARCH.md 4.7、7.2 (1)）
  raceType: 'coupe-cabin',
  form: 'fastback',
  roof: 'closed',
  wing: 'lip-spoiler',
  theme: '長引擎蓋、偏後封閉座艙、快背斜線接一體鴨尾唇的透明 PC 跑車殼（可裝 31 mm 輪）',
  material: 'PC',
  density_g_cm3: 1.2,
  wallThickness_mm: 0.5,
  stations: STATIONS,
  tuck: 1.0,
  // 平滑剖面（大圓角連續曲面）；只保留肩稜（第 6 點）為銳利稜線
  hard: [6],
  wheelArches: [
    { x: 40, y: 13, radius: 17.6, cutZFrom: 23.3 },
    { x: -40, y: 13, radius: 17.6, cutZFrom: 23.3 },
  ],
  // 側進氣凹槽：後輪拱前方（x −4 → −21）往後漸寬的一道淺凹槽（深 0.8 mm，真空成形可做出的高低差）
  recesses: [
    {
      id: '側進氣凹槽',
      view: 'side',
      shape: 'fn',
      sd: (x, y, z) => {
        if (Math.abs(z) < 30) {
          return 10;
        }
        const yMid = 15.2 + 0.08 * (x + 4);
        const w = 0.9 + 1.5 * Math.max(0, Math.min(1, (-4 - x) / 17));
        return Math.max(Math.abs(y - yMid) - w, x + 4, -21 - x);
      },
      depth: 0.8,
    },
  ],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [
    // 車窗留煙燻透明；窗框（玻璃外圍 0.9 mm）、A / B / C 柱內噴黑
    { mat: 'window', keep: glassKeep },
    { mat: 'frame', keep: (x, y, z, s) => glassKeep(x, y, z, s) + 0.9 },
    // 石墨灰下身
    { mat: 'graphite', keep: (x, y) => splitY(x) - y },
    { mat: 'copper', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'graphite2', recess: 'frame', recessWall: 'frame', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    // 透明車窗裡看得到的駕駛人（座艙偏後：頭盔在 x −4）
    const drv = buildDriver(-4, kit.innerYAt(-4) - 9.5, 1.15);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 白色細分色線：沿上下身分色線（只在側面）
    parts.push({ geometry: kit.decal((x, y, z) => (Math.abs(z) < 26 ? -1 : 0.32 - Math.abs(y - splitY(x) - 0.1))), mat: 'whiteDecal', name: 'decal-pinstripe' });
    // 雙白色寬條紋（自創）：鼻端 → 引擎蓋 → 車頂 → 快背 → 尾唇，中線兩側各一條（|z| 1.4–4.2），遇車窗與窗框中斷
    parts.push({
      geometry: kit.decal((x, y, z, s) => Math.min(1.4 - Math.abs(Math.abs(z) - 2.8), -(glassKeep(x, y, z, s) + 0.9), 72.5 - x)),
      mat: 'whiteDecal',
      name: 'decal-racing-stripes',
    });
    // 號碼 64：車門白色圓形號碼底＋黑字；引擎蓋前端（條紋外側）黑字
    const roundel = (u, v) => Math.hypot(u, v) - 4.1;
    parts.push({ geometry: kit.decal(sideDecal(roundel, { x0: 9, y0: 18.1, zMin: 30 })), mat: 'whiteDecal', name: 'decal-number-roundel' });
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('64', { h: 4.4, w: 2.6, gap: 0.7 }), { x0: 9, y0: 18.1, zMin: 30 }), { offset: 0.12 }),
        kit.decal(topDecal(sdNumber('64', { h: 5.0, w: 2.9, gap: 0.8 }), { x0: 54, z0: -12.5, yMin: 19 }), { offset: 0.12 }),
      ]),
      mat: 'black',
      name: 'decal-number',
    });
    // 尾燈：尾板上一條橫貫的細長燈條（中央斷開放號碼位置；不做獨立燈具造型）
    const lampBar = (z0, z1) => {
      const g = new THREE.BoxGeometry(0.5, 1.3, z1 - z0);
      g.translate(X_TAIL - 0.15, 24.6, (z0 + z1) / 2);
      return g;
    };
    parts.push({ geometry: mergeGeos([lampBar(-25, -5), lampBar(5, 25)]), mat: 'tailLampSolid', solid: true, name: 'lamp-tail' });
    return parts;
  },
  src: {
    density_g_cm3: 'BODY_RACE_RESEARCH 第 3 節 [COV]：PC 1.20 g/cm³',
    wallThickness_mm: 'BODY_RACE_RESEARCH 第 3 節：官方 PC 透明殼片材 0.4 mm；本專案 PC 款取 0.5 mm（推估：開口與輪拱周圍的剛性）',
    geometry: '本檔縱向控制表（推估）；外形型態依 BODY_RACE_RESEARCH 4.7（[T95615] [T95486] [FD]Raikiri）；輪拱 R17.6 可裝 31 mm 大徑輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
