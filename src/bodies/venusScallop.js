// 維納斯扇貝（body-venus-scallop，神話組・羅馬）——照四視圖 31 建模的低趴楔形車：前臉封到下緣的厚浪頭鼻 → 長斜引擎蓋 → 圓潤的珍珠座艙 → 後甲板橫條紋 → 往後上方斜切的 3 階尾翼（頂階是寬展扇貝翼）。
// 只用維納斯的象徵物，不做人像：
// 海浪泡沫（維納斯從海沫中誕生）→ 鼻部頂面一道金色波浪唇邊＋兩道橫跨鼻面的珍珠白浪花圓捲，車鼻正面與兩側是一道珍珠白圓捲邊（像貝殼開口的厚唇，正面緩和起伏）。
// 扇貝殼 → 只留局部：頂階尾翼的波浪後緣。不做扇形輪廓、放射肋或從單點放射的紋樣。
// 珍珠 → 渾圓的座艙罩。
// 玫瑰 → 前後輪之間的側面三片珍珠白花瓣（金邊），畫在深玫瑰下半車身上。
// 配色：玫瑰粉珍珠為主色（腰線以下漸深成深玫瑰），珍珠白為圖形色（浪花圓捲、鼻緣捲邊、尾翼翼板、花瓣、甲板條紋）、金點綴。造型柔和，和同為羅馬的 mars-spear（尖銳、紅銅黑）明顯不同。
// 四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-venus-scallop/DESIGN.md。剖面為本檔站位產生器（推估）。塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, buildArchLiner } from './gazelleLeap.js';
import { buildBellySkirt } from './trojanHorse.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）；車尾 −70、鼻尖 77 */
const XS = [-70, -64, -56, -48, -40, -30, -20, -10, 0, 10, 20, 30, 40, 48, 56, 64, 70, 74, 77];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線甲板（不含座艙罩）：低平後甲板 31.8 → 引擎蓋緩降到鼻尖 22.4（鼻部是有厚度的殼，前臉封到下緣）
  yHood: monoCurve(XS, [30, 31.2, 31.8, 31.8, 31.4, 30.4, 29.6, 29.2, 28.8, 28.6, 28.4, 28.2, 28, 27.4, 26.4, 25, 23.8, 23, 22.4]),
  // 擋泥板頂：壓低貼著輪拱（前輪 32.6、後輪 33），兩輪之間降成 27.6 的腰線
  yD: monoCurve(XS, [28, 31, 32.6, 33, 33, 31, 28.8, 27.8, 27.6, 27.8, 28.8, 31.4, 32.6, 32.6, 31.4, 28.6, 26.2, 24.4, 22.6]),
  // 半寬：車尾 33.6（避開後上導輪）、後輪 40、腰 30.4、前輪 37.2，過了前輪外擴成浪頭鼻（x 64–70 半寬 46，鼻尖 41）
  hw: monoCurve(XS, [33.6, 38.6, 40, 40, 39.6, 36.8, 32.8, 30.8, 30.4, 30.8, 32.4, 35.4, 37.2, 39.2, 43.2, 45.6, 46, 44.6, 40.6]),
  // 側裙下緣
  yLow: monoCurve(XS, [22, 19, 14.8, 13, 13, 13.4, 14.4, 14.6, 14.6, 14.6, 14.2, 13, 13, 13.5, 14, 14.4, 14.6, 14.8, 15]),
};

/** @type {number[]} 座艙罩前後端 x */
const CAN_X = [-26, 32];
/** @type {(x: number) => number} 座艙罩高出甲板的量（渾圓的珍珠形，頂點在 x −2） */
const canRaw = monoCurve([-26, -20, -10, -2, 8, 18, 26, 32], [0, 5.8, 11.6, 13.2, 12, 7.6, 3, 0]);
/** @type {(x: number) => number} */
const canH = (x) => (x <= CAN_X[0] || x >= CAN_X[1] ? 0 : Math.max(0, canRaw(x)));
/** @type {(x: number) => number} 座艙罩半寬 */
const canW = monoCurve([-26, -18, -4, 10, 22, 32], [6, 10, 12, 11.6, 9, 5]);

/** @type {(x: number) => number} 腰線稜高度（側面唯一的銳利稜線） */
const beltY = (x) => P.yD(x) - Math.min(4.2, 0.4 * (P.yD(x) - P.yLow(x)));

/**
 * 半剖面 8 點：中線頂 → 座艙罩肩 → 座艙罩底緣（銳利）→ 甲板 → 擋泥板頂 → 腰線稜（銳利）→ 側面 → 下緣內收
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yc = P.yHood(x);
  const h = canH(x);
  const hw = P.hw(x);
  const cw = Math.min(canW(x), hw - 8);
  const yD = P.yD(x);
  const yLow = P.yLow(x);
  const yBelt = beltY(x);
  const sh = Math.min(3.6, 0.28 * (hw - cw));
  return [
    [0, yc + h],
    [0.62 * cw, yc + 0.74 * h],
    [cw, yc + 0.06 * h],
    [cw + 0.5 * (hw - sh - cw), lerp(yc, yD, 0.55)],
    [hw - sh, yD],
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

/** @type {(x: number, z: number) => boolean} 在座艙罩上 */
const onCanopy = (x, z) => canH(x) > 0.5 && Math.abs(z) < Math.min(canW(x), P.hw(x) - 8) - 0.3;
/** @type {(x: number, y: number) => boolean} 在腰線稜以下的側面 */
const belowBelt = (x, y) => y < beltY(x) - 0.3;

/** @type {number[]} 鼻部兩道浪花稜的基準 x（由後往前） */
const FOAM_X = [55, 64.5];
/** @type {(x0: number, z: number) => number} 浪花稜的平面走向：橫跨鼻部、往前後起伏的波浪線（波長 15，每道錯開半個相位） */
const foamLine = (x0, z) => x0 + 1.5 * Math.sin((2 * Math.PI * z) / 15 + x0);
/** @type {number} 前緣捲邊中心線 x（車鼻正面） */
const LIP_X = 75;
/** @type {number} 前緣捲邊從兩側往後收到的 x */
const LIP_BACK_X = 52;

/** @type {{ x0: number, x1: number, y: number }[]} 往後上方斜切的 3 階尾翼：每階翼板的前後緣 x 與高度（後一階比前一階高 3、往後退 7） */
const TAIL_STEPS = [
  { x0: -49, x1: -58, y: 36.4 },
  { x0: -56, x1: -65, y: 39.4 },
  { x0: -63, x1: -72.6, y: 42.4 },
];
/** @type {number} 尾翼端板 |z| */
const TAIL_Z = 20;
/** @type {number} 頂階扇貝翼的半展長 */
const WING_Z = 46.5;
/** @type {number} 翼板厚 */
const TAIL_T = 0.5;

/** @type {(x: number, z: number) => number} 到鼻部波浪後緣的距離（正值 = 在鼻部側） */
const noseEdge = (x, z) => {
  const c = Math.cos((Math.PI * z) / 6.5);
  return x - (46 - 1.4 * c * c);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 玫瑰粉珍珠：車身主色（亮面＋高清漆）
  rose: namedMaterial('paint-rose-pearl', { color: 0xe892aa, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.08 }),
  rose2: namedMaterial('paint-rose-pearl', { color: 0xe892aa, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  // 深玫瑰珍珠：腰線以下、側裙
  deep: namedMaterial('paint-deep-rose-pearl', { color: 0xc4587c, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.1 }),
  deep2: namedMaterial('paint-deep-rose-pearl', { color: 0xc4587c, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  // 珍珠白：浪花圓捲、鼻緣捲邊、尾翼翼板
  white: namedMaterial('paint-pearl-white', { color: 0xf6f0ea, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.08 }),
  white2: namedMaterial('paint-pearl-white', { color: 0xf6f0ea, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  // 金（真金屬：名稱以 -brass 結尾）
  gold: namedMaterial('trim-gold-brass', { color: 0xd8b25a, metalness: 0.85, roughness: 0.26, clearcoat: 0.4, side: THREE.DoubleSide }),
  // 座艙罩：玫瑰色煙燻透明殼
  canopy: namedMaterial('pc-smoke-rose', { color: 0x3a1e2a, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x2a2226, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-pearl', { color: 0xe8d8dc, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-dark', { color: 0x2a2024, roughness: 0.8, side: THREE.DoubleSide }),
  dWhite: decalMaterial('decal-pearl-white', { color: 0xf6f0ea, roughness: 0.3 }),
  dGold: decalMaterial('decal-gold', { color: 0xd8b25a, roughness: 0.28, metalness: 0.8 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {import('./polyBody.js').PolyBodyConfig} */
const CONFIG = {
  id: 'body-venus-scallop',
  name: '維納斯扇貝',
  style: 'myth',
  phase: 13,
  mythSeries: 'roman',
  mythTheme: 'venus',
  form: 'scallop-wedge',
  roof: 'canopy',
  wing: 'scallop-step',
  theme: '照四視圖 31 的低趴楔形車：前臉封到下緣的厚浪頭鼻（玫瑰粉鼻面上一道金色波浪唇邊、兩道珍珠白浪花圓捲，鼻緣一圈珍珠白圓捲邊）；長斜引擎蓋、渾圓的座艙、後甲板兩道橫條紋；車尾是往後上方斜切的 3 階尾翼（珍珠白後掠翼板，頂階是往兩側後掠到車身外的寬展扇貝翼、玫瑰粉斜切階梯端板）；前後輪之間三片珍珠白花瓣、深玫瑰側裙；玫瑰粉珍珠為主色、腰線以下深玫瑰，珍珠白與金為圖形色',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格放寬到 0.6 mm（車身面積大，維持面數與碰撞格耗時）
  step: 0.6,
  hard: [2, 5],
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    { mat: 'canopy', keep: (x, y, z) => (onCanopy(x, z) ? 1 : -1) },
    // 深玫瑰下半車身：腰線稜以下，往鼻尖跟著腰線收低
    { mat: 'deep', keep: (x, y, z) => (belowBelt(x, y) && Math.abs(z) > P.hw(x) - 10 ? 1 : -1) },
    { mat: 'rose', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'deep', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 往後上方斜切的 3 階尾翼：3 片珍珠白後掠翼板一階比一階高、往後退，左右兩片玫瑰粉端板（側影是往後上方斜切的階梯） ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const blades = [];
      for (const st of TAIL_STEPS.slice(0, 2)) {
        // 後掠翼板：中央前緣往前凸 2.4（俯視是淺 V 形前緣）
        blades.push(flatPlate([[st.x0 + 2.4, 0], [st.x0, TAIL_Z], [st.x1, TAIL_Z], [st.x1 + 1.6, 0], [st.x1, -TAIL_Z], [st.x0, -TAIL_Z]], st.y, TAIL_T));
      }
      // 頂階是一片寬展的扇貝翼：往兩側後掠到 |z| 46.5，後緣是扇貝的波浪邊（每 6.5 mm 一個波峰）
      const st3 = TAIL_STEPS[2];
      /** @type {(az: number) => number} 扇貝翼前緣 x */
      const le = (az) => st3.x0 + 2.4 - 2.4 * Math.min(1, az / TAIL_Z) - 0.16 * Math.max(0, az - TAIL_Z);
      /** @type {(z: number) => number} 扇貝翼後緣 x（波浪邊） */
      const te = (z) => {
        const c = Math.cos((Math.PI * z) / 6.5);
        return st3.x1 + 1.2 - 0.04 * Math.abs(z) - 1.2 * c * c;
      };
      /** @type {number[][]} */
      const wingPts = [];
      for (let z = -WING_Z; z <= WING_Z + 1e-6; z += 0.5) {
        wingPts.push([le(Math.abs(z)), z]);
      }
      for (let z = WING_Z; z >= -WING_Z - 1e-6; z -= 0.5) {
        wingPts.push([te(z), z]);
      }
      blades.push(flatPlate(wingPts, st3.y, TAIL_T));
      parts.push({ geometry: mergeGeos(blades), mat: 'white2', solid: true, outline: true, name: 'tail-step-blades' });
      /** @type {THREE.BufferGeometry[]} */
      const plates = [];
      for (const sg of [-1, 1]) {
        const z = sg * (TAIL_Z + 0.5);
        /** @type {number[][]} 端板側影：前下緣從甲板斜升 → 3 階斜切階梯上緣 → 後緣斜切回甲板 */
        const pts = [[-44, top(-44, z) - 1]];
        for (const st of TAIL_STEPS) {
          pts.push([st.x0 + 1, st.y - 0.8], [st.x0 - 2, st.y + TAIL_T + 0.6], [st.x1 + 3.5, st.y + TAIL_T + 1.4]);
        }
        pts.push([-75.4, 44.4], [-73.2, top(-70, z) - 1.5]);
        plates.push(finPlate(pts, z, 0.7));
      }
      parts.push({ geometry: mergeGeos(plates), mat: 'rose2', solid: true, outline: true, name: 'tail-endplates' });
    }

    // ── 側裙：兩輪之間把底盤側框與電池艙側面封起來（深玫瑰） ──
    parts.push({
      geometry: buildBellySkirt({ x0: -21, x1: 21, zIn: (x) => P.hw(x) - 1.2, zOut: 37.0, yTop: 14.2, t: 0.5 }),
      mat: 'deep2',
      solid: true,
      outline: true,
      name: 'side-skirts',
    });

    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos([buildArchLiner(ARCHES[0], 23, 33.4, 0.35, Math.PI - 0.35), buildArchLiner(ARCHES[1], 23, 34, 0.35, Math.PI - 0.35)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });

    // ── 貼紙 ──
    // 浪頭鼻：金色波浪後緣（每 6.5 mm 一個波峰）→ 兩道珍珠白浪花圓捲 → 鼻緣珍珠白圓捲邊，全部是橫向或沿外緣走，不收到任何一點
    /**
     * 沿殼面的一條半圓捲邊（半橢圓截面貼在殼面上、底面封口，兩端收細並封口）：寬 2·rad(t)、高 height(x, z, r)
     * @type {(pts: number[][], rad: (t: number) => number, height: (x: number, z: number, r: number) => number) => THREE.BufferGeometry}
     */
    const roll = (pts, rad, height) => {
      /** @type {number} 半圓截面分段 */
      const seg = 8;
      /** @type {number[][][]} 每個取樣點的截面（seg + 1 點，從 −法向經頂部到 +法向，底邊自動封口） */
      const secs = pts.map(([x, z], k) => {
        const [xa, za] = pts[Math.max(0, k - 1)];
        const [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
        const len = Math.hypot(xb - xa, zb - za) || 1;
        const nx = -(zb - za) / len;
        const nz = (xb - xa) / len;
        const r = rad(k / (pts.length - 1));
        const h = height(x, z, r);
        /** @type {number[][]} */
        const ring = [];
        for (let e = 0; e <= seg; e++) {
          const t = (Math.PI * e) / seg;
          const px = x - nx * r * Math.cos(t);
          const pz = z - nz * r * Math.cos(t);
          ring.push([px, top(px, pz) - 0.1 + h * Math.sin(t), pz]);
        }
        return ring;
      });
      /** @type {number[]} */
      const pos = [];
      const n = seg + 1;
      for (let k = 0; k + 1 < secs.length; k++) {
        const [p, q] = [secs[k], secs[k + 1]];
        for (let e = 0; e < n; e++) {
          const f = (e + 1) % n;
          pos.push(...p[e], ...q[f], ...q[e], ...p[e], ...p[f], ...q[f]);
        }
      }
      const [c0, c1] = [secs[0], secs[secs.length - 1]];
      for (let e = 1; e + 1 < n; e++) {
        pos.push(...c0[0], ...c0[e], ...c0[e + 1], ...c1[0], ...c1[e + 1], ...c1[e]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    };
    /** @type {(t: number) => number} 浪花稜半寬：0.9，兩端收細 */
    const crestRad = (t) => 0.2 + 0.7 * Math.min(1, Math.min(t, 1 - t) / 0.12);
    // 鼻部兩道浪花稜：橫跨玫瑰粉鼻面的珍珠白圓捲（海浪泡沫，一道接一道往車頭推）
    {
      /** @type {THREE.BufferGeometry[]} */
      const crests = [];
      for (const x0 of FOAM_X) {
        /** @type {number[][]} */
        const run = [];
        for (let z = -46; z <= 46; z += 1.2) {
          const x = foamLine(x0, z);
          if (P.hw(x) - 4.4 - Math.abs(z) > 0) {
            run.push([x, z]);
          }
        }
        crests.push(roll(run, crestRad, (x, z, r) => 1.25 * r));
      }
      parts.push({ geometry: mergeGeos(crests), mat: 'white2', solid: true, outline: true, name: 'nose-foam-crests' });
      // 前緣捲邊：沿鼻部兩側往前、橫過車鼻正面的一道珍珠白圓捲邊（貝殼開口的厚唇，正面看是緩和的波浪起伏），兩側往後收細
      /** @type {number[][]} */
      const lip = [];
      for (let x = LIP_BACK_X; x < LIP_X - 1.6; x += 1.2) {
        lip.push([x, -(P.hw(x) - 2.3)]);
      }
      const zf = P.hw(LIP_X) - 2.3;
      for (let z = -zf; z <= zf + 1e-6; z += 1.1) {
        // 正面兩角往後圓一點
        const k = Math.abs(z) / zf;
        lip.push([LIP_X - 1.6 * k ** 6, z]);
      }
      for (let x = LIP_X - 1.6; x >= LIP_BACK_X; x -= 1.2) {
        lip.push([x, P.hw(x) - 2.3]);
      }
      /** @type {(t: number) => number} 捲邊半寬：正面 1.45，兩側往後收細 */
      const lipRad = (t) => 0.3 + 1.15 * Math.min(1, Math.min(t, 1 - t) / 0.22);
      /** @type {(x: number, z: number, r: number) => number} 捲邊高度（正面隨 z 緩和起伏，像貝殼開口的波浪唇） */
      const lipH = (x, z, r) => 1.15 * r + (x > LIP_X - 2 ? 0.5 * Math.cos((2 * Math.PI * z) / 16) ** 2 : 0);
      parts.push({ geometry: roll(lip, lipRad, lipH), mat: 'white2', solid: true, outline: true, name: 'nose-lip-roll' });
      // 鼻部的波浪後緣：凸起 1.0 的金色唇邊（第一道浪）
      /** @type {number[][]} */
      const rim = [];
      for (let z = -40; z <= 40; z += 0.65) {
        const c = Math.cos((Math.PI * z) / 6.5);
        const x = 46 - 1.4 * c * c + 0.6;
        if (Math.abs(z) < P.hw(x) - 3.6) {
          rim.push([x, z]);
        }
      }
      parts.push({ geometry: roll(rim, (t) => 0.2 + 0.5 * Math.min(1, Math.min(t, 1 - t) / 0.04), () => 1.0), mat: 'gold', solid: true, outline: true, name: 'nose-wave-rim' });
    }
    // 鼻部後緣金線（沿波浪唇邊）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > 76.6 || x < 42 || y < P.yLow(x) + 3) {
          return -1;
        }
        return Math.min(0.4 - Math.abs(noseEdge(x, z) - 0.25), P.hw(x) - 3.5 - Math.abs(z) + 0.4);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-nose-scallop-rim',
    });
    // 後甲板兩道橫向珍珠白條紋
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (belowBelt(x, y) || Math.abs(z) > P.hw(x) - 4.5 || onCanopy(x, z)) {
          return -1;
        }
        return Math.max(Math.min(x + 33.4, -31 - x), Math.min(x + 38.4, -36 - x));
      }),
      mat: 'dWhite',
      name: 'decal-deck-stripes',
    });
    // 側面玫瑰花瓣切割：前後輪之間三片從前下方往後上展開的花瓣（珍珠白、金邊）
    /** @type {number[][]} 每片花瓣 [起點 x, 起點 y, 角度（度，0 = 往後）, 長, 半寬] */
    const PETALS = [
      [17, 17.2, 4, 27, 3.6],
      [15, 19.4, 24, 21, 2.9],
      [19, 15.4, -12, 21, 2.6],
    ];
    /** @type {(petal: number[], x: number, y: number) => number} 到單片花瓣的近似距離（正值 = 在花瓣內） */
    const petalOne = ([px, py, deg, len, w], x, y) => {
      const a = (deg * Math.PI) / 180;
      const dx = px - x;
      const dy = y - py;
      const u = dx * Math.cos(a) + dy * Math.sin(a);
      const v = -dx * Math.sin(a) + dy * Math.cos(a);
      if (u < 0 || u > len) {
        return -Math.min(Math.abs(u), Math.abs(u - len)) - Math.abs(v);
      }
      return w * Math.sin((Math.PI * u) / len) - Math.abs(v);
    };
    /** @type {(x: number, y: number) => number} 到花瓣聯集的近似距離 */
    const petalSd = (x, y) => Math.max(...PETALS.map((pt) => petalOne(pt, x, y)));
    /** @type {(x: number, y: number) => number} 到最近一片花瓣邊線的距離（每片各自描金邊） */
    const petalEdge = (x, y) => Math.min(...PETALS.map((pt) => Math.abs(petalOne(pt, x, y))));
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < P.hw(x) - 4 ? -1 : Math.min(petalSd(x, y) - 0.4, archRingDist(x, y) - 0.8, y - 11.2))),
      mat: 'dWhite',
      name: 'decal-rose-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < P.hw(x) - 4 ? -1 : Math.min(0.4 - petalEdge(x, y), archRingDist(x, y) - 0.8, y - 11.2)), { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-petal-rims',
    });
    // 腰線稜上的金色細線與座艙罩金框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onCanopy(x, z) || x < -69 || x > 74) {
          return -1;
        }
        const belt = Math.abs(z) > P.hw(x) - 4 ? 0.32 - Math.abs(y - beltY(x)) : -1;
        const cw = Math.min(canW(x), P.hw(x) - 8);
        const rim = canH(x) > 0.5 ? 0.45 - Math.abs(Math.abs(z) - cw - 0.4) : -1;
        return Math.max(Math.min(belt, archRingDist(x, y) - 0.5), rim);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-gold-lines',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，比例照四視圖 31）：殼 x −70 → 77；中線甲板 後甲板 31.8 → 鼻尖 22.4；座艙罩高出甲板 13.2（x −2）；擋泥板頂 前輪 32.6、後輪 33、腰 27.6；半寬 車尾 33.6、後輪 40、腰 30.4、前輪 37.2、鼻部 x 64–70 外擴到 45.6–46、鼻尖 40.6',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯用 gazelle 的 buildArchLiner',
    wing: '往後上方斜切的 3 階尾翼：前 2 片後掠翼板（厚 0.5、半寬 20、高 36.4 / 39.4，一階往後退 7）＋頂階寬展扇貝翼（厚 0.5、高 42.4、往兩側後掠到 |z| 46.5、波浪後緣）、左右端板（厚 0.7，側影是斜切階梯）；鼻部半橢圓截面圓捲：金唇邊（半寬 0.7、高 1.0）、浪花稜（半寬 0.9、高 1.1）、鼻緣捲邊（半寬 1.45、高 1.7–2.2）；側裙（厚 0.5，|z| 37.0，x −21 → 21）。皆為實心 ABS 件，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    symbols: '扇貝殼：Pompeii「Casa della Venere in conchiglia」花園壁畫（Wikipedia〈Venus (mythology)〉）；玫瑰：Porta Collina 的維納斯祭儀獻玫瑰（同條目）；珍珠：凱撒在 Venus Genetrix 神廟獻上鑲不列顛珍珠的胸甲（Wikipedia〈Temple of Venus Genetrix〉）。造型皆為抽象化的車身零件與貼紙，不出人像',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

/** @type {import('./types').BodyDef} */
export const venusScallopBody = makePolyBody(CONFIG);
