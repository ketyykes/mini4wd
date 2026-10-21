// 猛獸頭部重裝型（body-beast，致敬《爆走兄弟》風格）：高聳的「獸頭」前段＋中央衝角、左右鼓出的肩部翼艙、收窄的腰線與短尾。
// 設計：shared/design/body-beast/DESIGN.md（致敬元素、和原作車的差異）。剖面為本檔站位表（推估，依 DESIGN.md 外框限制與底盤高度掃描）。
// 塗裝全為自創：暗紅＋槍灰＋古銅、號碼「55」、爪痕斜紋；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, buildRegion, buildRim, featureSd, sdNumber, sdBar, sideDecal, topDecal, mergeGeos, lerp } from './loft.js';

/** @typedef {import('./loft.js').KeepFn} KeepFn */

/**
 * 半剖面站位表（8 點：中線頂 → 衝角邊 → 眉溝內 → 眉溝外 → 翼艙內稜 → 翼艙外稜 → 最寬處 → 下緣）
 * - 前段 x 40–54 中線頂 37–38（獸頭最高點），往後降到 28.5：和其他款「前低後高」相反的反楔形
 * - 翼艙最寬 45（前後輪上方），腰線 32：俯視是「啞鈴」形
 * - 輪拱 R17.5（可裝 31 mm 大徑輪）
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = [
  [68, [[0, 20], [3, 19.6], [6, 18.5], [9, 18.4], [12, 18.8], [16, 18.6], [24, 17], [24, 15]]],
  [62, [[0, 27], [4, 26.4], [8, 24], [11, 23.8], [16, 25.5], [26, 25], [34, 21], [34, 15]]],
  [54, [[0, 33], [5, 32.4], [10, 28.5], [13, 28.3], [19, 31], [34, 31], [41, 26], [41, 14]]],
  [46, [[0, 37], [5, 36.4], [11, 31.5], [14, 31.2], [20, 33.5], [36, 33.5], [44.5, 28.5], [44.5, 11.5]]],
  [40, [[0, 38], [5, 37.4], [11, 32], [14, 31.6], [20, 34], [36, 34], [45, 29], [45, 10]]],
  [32, [[0, 36.5], [5, 36], [11, 31.5], [14, 31], [20, 33], [35, 33], [43, 28], [43, 9.5]]],
  [22, [[0, 33.5], [5, 33], [11, 30], [14, 29.6], [19, 30.5], [26, 30.5], [31.5, 27], [31.5, 9.5]]],
  [8, [[0, 31.5], [5, 31.2], [11, 29], [14, 28.7], [18, 29], [24, 28.8], [29.5, 26], [29.5, 9.5]]],
  [-8, [[0, 30.8], [5, 30.6], [11, 28.6], [14, 28.4], [18, 28.8], [24, 28.8], [29.5, 26], [29.5, 9.5]]],
  [-22, [[0, 30.4], [5, 30.2], [11, 28.6], [14, 28.5], [19, 30], [28, 30.2], [35, 27], [35, 9.5]]],
  [-32, [[0, 30.2], [5, 30], [11, 28.8], [14, 28.8], [20, 32], [34, 32.2], [44.5, 28], [44.5, 9.5]]],
  [-42, [[0, 30], [5, 29.8], [11, 29], [14, 29], [20, 32.6], [35, 32.8], [45, 29], [45, 10]]],
  [-50, [[0, 29.5], [5, 29.3], [11, 28.8], [14, 28.8], [19, 31.5], [33, 31.5], [41, 28], [41, 15.5]]],
  [-56, [[0, 28.8], [4, 28.6], [9, 28.2], [12, 28.2], [16, 29.8], [26, 29.6], [32, 27.5], [32, 19]]],
  [-58, [[0, 28.5], [3, 28.3], [7, 28], [10, 28], [13, 28.8], [20, 28.6], [26, 27.5], [26, 22]]],
].map(([x, pts]) => ({ x, pts }));

/** @type {any} 獸眼凹槽（俯視菱形，見 recesses） */
const EYE = { view: 'top', shape: 'poly', pts: [[63.85, 1.5], [60.57, 9.14], [53.44, 15.23], [57.06, 6.53]], depth: 1.0 };

/** @type {(x: number) => number} 槍灰下半車身分色線（前低後高的斜線，和獸頭的反楔形相呼應） */
const lowerLine = (x) => 17 - 0.06 * x;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  crimson: namedMaterial('paint-crimson', { color: 0x8e1a22, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  gunmetal: namedMaterial('paint-gunmetal', { color: 0x3a3d42, roughness: 0.35, metalness: 0.45, clearcoat: 0.6 }),
  gunmetal2: namedMaterial('paint-gunmetal', { color: 0x3a3d42, roughness: 0.35, metalness: 0.45, side: THREE.DoubleSide }),
  // 金屬古銅（名稱含 brass → Blender 匯出分類為 metal）
  bronze: namedMaterial('brass-horn-bronze', { color: 0xb08d57, roughness: 0.28, metalness: 0.9, clearcoat: 0.3 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x221a1a, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-crimson', { color: 0x6e141a, roughness: 0.5, side: THREE.DoubleSide }),
  recess: namedMaterial('trim-intake-black', { color: 0x0b0b0c, roughness: 0.9, side: THREE.DoubleSide }),
  recessWall: namedMaterial('trim-intake-wall', { color: 0x46494f, roughness: 0.7, side: THREE.DoubleSide }),
  eye: namedMaterial('lamp-amber', { color: 0xffb020, emissive: 0xff8a00, emissiveIntensity: 0.9, roughness: 0.1, clearcoat: 1.0 }),
  black: decalMaterial('decal-black', { color: 0x111214, roughness: 0.55 }),
  gold: decalMaterial('decal-bronze', { color: 0xc49a5a, roughness: 0.35, metalness: 0.5 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

export const beastBody = makePolyBody({
  id: 'body-beast',
  name: '猛獸頭部重裝型',
  style: 'homage',
  theme: '高聳獸頭＋中央衝角、鼓出的肩部翼艙、收腰短尾的重裝型',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 2.0,
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 23.3 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 23.3 },
  ],
  recesses: [
    // 獸眼：頭部前斜面上兩道往外上斜的凹槽（之後貼琥珀色燈）
    // iter-47：細長菱形、往外上斜（iter-47b 放大 1.4 倍、iter-50 再放大 1.2 倍：長約 17、寬 4.3），淺凹 1 mm，槽底整面琥珀燈
    { id: '獸眼 ×2', view: 'top', shape: 'poly', pts: [[63.85, 1.5], [60.57, 9.14], [53.44, 15.23], [57.06, 6.53]], depth: 1.0 },
    // 側面層疊鰓狀進氣口（側視三道斜槽）
    { id: '鰓 1', view: 'side', shape: 'poly', pts: [[20, 14], [22.5, 14], [16, 25], [13.5, 25]], depth: 2.2 },
    { id: '鰓 2', view: 'side', shape: 'poly', pts: [[14, 14], [16.5, 14], [10, 25], [7.5, 25]], depth: 2.2 },
    { id: '鰓 3', view: 'side', shape: 'poly', pts: [[8, 14], [10.5, 14], [4, 25], [1.5, 25]], depth: 2.2 },
  ],
  sideZMin: 28,
  zones: () => [
    { mat: 'gunmetal', keep: (x, y) => lowerLine(x) - y },
    // 眉溝（衝角兩側的凹溝）塗槍灰
    {
      mat: 'gunmetal',
      keep: (x, y, z) => {
        const az = Math.abs(z);
        return x > 14 ? Math.min(az - 9.5, 15 - az, 66 - x) : -1;
      },
    },
    { mat: 'crimson', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'gunmetal', recess: 'recess', recessWall: 'recessWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    // 中央衝角（獸角）：鼻部中線上往前上方伸出的古銅色刃片
    const top = (x) => kit.surf.topY(x, 0);
    // iter-47b：衝角做成有厚度的立體角——沿往前上翹的弧線掃掠橢圓斷面，根部 5.6 × 6.4 mm 埋在殼裡，尖端收到 0.4 mm
    const horn = sweepEllipse(
      [
        [39, top(39) - 2.2, 0],
        [46, top(46) - 0.2, 0],
        [53, 38.6, 0],
        [60, 40, 0],
        [66, 42.2, 0],
        [71, 45.4, 0],
      ],
      56,
      (t) => [lerp(2.9, 0.2, t ** 1.2), lerp(3.4, 0.2, t ** 1.05)],
      20,
    );
    parts.push({ geometry: horn, mat: 'bronze', outline: true, solid: true, name: 'horn' });
    // 肩部翼艙上的短鰭（後翼艙上方，左右各一，往外傾 10°）
    const fins = [];
    for (const sg of [-1, 1]) {
      fins.push(
        finPlate(
          [
            [-30, 32.4],
            [-50, 31.6],
            [-54, 36.5],
            [-44, 36.5],
          ],
          sg * 30,
          1.2,
          sg * 10,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(fins), mat: 'gunmetal', outline: true, solid: true, name: 'haunch-fins' });
    // 獸眼燈（iter-47）：琥珀燈片鋪滿菱形凹槽底；凹槽外圍 0.5 mm、凸出 0.25 mm 的槍灰眉骨唇邊
    const eyeSd = featureSd(EYE, 28);
    const lamp = buildRegion(kit.surf, [...kit.holes, (x, y, z) => -eyeSd(x, y, z)], { offset: -EYE.depth + 0.06 });
    parts.push({ geometry: lamp.geometry, mat: 'eye', name: 'lamp-eyes' });
    const brow = buildRegion(kit.surf, [...kit.holes, (x, y, z) => eyeSd(x, y, z), (x, y, z) => 0.5 - eyeSd(x, y, z)], { offset: 0.25 });
    parts.push({ geometry: brow.geometry, mat: 'gunmetal', name: 'eye-brow' });
    parts.push({ geometry: buildRim(brow, 0, 0.25), mat: 'gunmetal2', name: 'eye-brow-wall' });
    // 爪痕：前翼艙上三道斜條（古銅）
    const claws = [0, 1, 2].map((i) => sdBar(30 + i * 5, 24, 36 + i * 5, 38, 1.4));
    parts.push({
      geometry: kit.decal((x, y, z) => (y < 30 ? -1 : -Math.min(...claws.map((f) => f(x, Math.abs(z)))))),
      mat: 'gold',
      name: 'decal-claws',
    });
    // 號碼 55：側面翼艙後方、引擎蓋（衝角後方）
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('55', { h: 6, w: 3.4, gap: 0.9 }), { x0: -10, y0: 19.5, zMin: 28 })),
        kit.decal(topDecal(sdNumber('55', { h: 5, w: 2.8, gap: 0.7 }), { x0: 29, yMin: 30 })),
      ]),
      mat: 'black',
      name: 'decal-number',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同 body-aero-wing）',
    geometry: '本檔 STATIONS（推估，依 DESIGN.md 外框限制與底盤高度掃描）；輪拱 R17.5 以容納 31 mm 大徑輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
    horn: 'iter-49：古銅衝角視為 ABS 電鍍件（迷你四驅車殼的金屬色飾件多為塑膠電鍍，推估），質量 = 封閉體積 × ABS 1.05 g/cm³',
  },
});

