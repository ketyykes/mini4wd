// 分叉尾翼高速型（body-fork，致敬《爆走兄弟》風格）：極窄的箭形機身＋長刃鼻、外露的車輪、兩支往後伸出的尾樑與外傾的分叉尾鰭。
// 設計：shared/design/body-fork/DESIGN.md（致敬元素、和原作車的差異）。剖面為本檔站位表（推估，依 DESIGN.md 外框限制與底盤高度掃描）。
// 塗裝全為自創：珍珠銀＋電光青＋黑、閃電斜紋、號碼「9」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, flatPlate, buildDriver, sweepEllipse, airfoilFin } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sideDecal, topDecal, mergeGeos, lerp, smoothstep } from './loft.js';

/**
 * iter-50：機身站位改由平順函式產生（每 2 mm 一站），不再手寫 14 個站：
 * 原本相鄰站之間側箱半寬突然 22.5 ↔ 30、剖面點在各站的 z 位置不一致，平滑曲面插值後出現不規則凹凸反光。
 * - 中線頂高 yTop、肩部落差 drop、下緣 yLow：沿用原本站位表的值，以單調三次內插（不過衝）
 * - 半寬 = 基本半寬（同原表，兩輪之間 22.5）＋側箱隆起 7.5 × smoothstep，隆起只在 x −23 ~ 23（後輪 x ≤ −24.5、前輪 x ≥ 24.5 之外，31 mm 輪胎仍有間隙）
 * - 剖面 8 點：頂面 6 點固定在半寬的 0 / 0.2 / 0.4 / 0.6 / 0.78 / 0.92 處（每站同一相對位置），頂面高度依 (z / 半寬)² 下降，第 6 點起是側壁
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = (() => {
  const tx = [-42, -34, -27, -21, -14, 0, 14, 21, 29, 40, 50, 60, 70, 77];
  const tab = {
    yTop: [25.6, 27, 28.5, 28.8, 29.1, 28.6, 28, 27.6, 27, 26, 24, 20.5, 17.2, 15.6],
    drop: [2.4, 3.4, 4, 4, 4, 4, 3.8, 3.3, 3.5, 3.5, 4, 2.9, 1.6, 0.6],
    yLow: [22.6, 22.6, 14, 13, 9.5, 9, 9.5, 11, 12, 13, 12, 13, 14, 14.6],
    halfW: [8, 16, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 20, 18, 14, 9, 3],
  };
  /** @type {(v: number[]) => number[]} 單調三次（Fritsch–Carlson）斜率 */
  const slopes = (v) => {
    const n = v.length;
    const d = [];
    for (let k = 0; k < n - 1; k++) {
      d.push((v[k + 1] - v[k]) / (tx[k + 1] - tx[k]));
    }
    const m = [d[0]];
    for (let k = 1; k < n - 1; k++) {
      m.push(d[k - 1] * d[k] <= 0 ? 0 : (2 * d[k - 1] * d[k]) / (d[k - 1] + d[k]));
    }
    m.push(d[n - 2]);
    return m;
  };
  /** @type {Record<string, number[]>} */
  const sl = {};
  for (const key of Object.keys(tab)) {
    sl[key] = slopes(tab[key]);
  }
  /** @type {(key: string, x: number) => number} */
  const f = (key, x) => {
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
  const fr = [0, 0.2, 0.4, 0.6, 0.78, 0.92];
  const out = [];
  const xsAll = [];
  for (let x = -42; x < 77; x += 2) {
    xsAll.push(x);
  }
  xsAll.push(77);
  for (const xx of xsAll) {
    const hw = f('halfW', xx) + 7.5 * smoothstep(23, 12, xx) * smoothstep(-23, -12, xx);
    const yTop = f('yTop', xx);
    const drop = f('drop', xx);
    const yLow = Math.min(f('yLow', xx), yTop - drop - 0.6);
    const pts = fr.map((q) => [q * hw, yTop - drop * 0.85 * q * q]);
    pts.push([hw, yTop - drop], [hw, yLow]);
    out.push({ x: xx, pts });
  }
  return out;
})();

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  silver: namedMaterial('paint-pearl-silver', { color: 0xc9ced6, roughness: 0.2, metalness: 0.55, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  silver2: namedMaterial('paint-pearl-silver', { color: 0xc9ced6, roughness: 0.2, metalness: 0.55, clearcoat: 1.0, side: THREE.DoubleSide }),
  black: namedMaterial('paint-gloss-black', { color: 0x15171b, roughness: 0.3, clearcoat: 0.8 }),
  black2: namedMaterial('paint-gloss-black', { color: 0x15171b, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
  cyan2: namedMaterial('paint-electric-cyan', { color: 0x19c6ff, roughness: 0.25, clearcoat: 0.8, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1f2226, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-silver', { color: 0x9aa0a8, roughness: 0.45, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1a2a3a, roughness: 0.06, specularIntensity: 0.5, transparent: true, opacity: 0.5, envMapIntensity: 0.4, depthWrite: false }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-cyan', { color: 0x19c6ff, roughness: 0.3, clearcoat: 0.8 }),
  cyan: decalMaterial('decal-electric-cyan', { color: 0x19c6ff, roughness: 0.3, clearcoat: 0.6 }),
  dark: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 尾臂（iter-47）：從側箱後端長出、往後內收的掃掠橢圓管（概念圖的一體流線尾臂），x −14 ~ −72。
 * 後輪範圍（x −55.5 ~ −24.5）內外緣 |z| ≤ 23.5（31 mm 輪胎內側面 24.75）、下緣 y ≥ 24.4（開關頂 23.2）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildArm = (sg) =>
  sweepEllipse(
    [
      [0, 25.2, sg * 23],
      [-12, 26.4, sg * 23.2],
      [-24, 27.1, sg * 19.6],
      [-40, 27.6, sg * 17.6],
      [-56, 27.6, sg * 17],
      [-72, 26.8, sg * 17],
    ],
    56,
    // iter-48：前段從側箱裡長出來（埋在殼內），根部最粗（4.4 × 3.2），往後收細；
    // 末段斷面轉成「窄而高」（0.9 × 2.4），收成尾鰭的翼根
    (t) => {
      const grow = Math.min(1, t / 0.22);
      if (t <= 0.22) {
        return [lerp(1.6, 4.4, grow), lerp(0.8, 3.2, grow)];
      }
      const k = (t - 0.22) / 0.78;
      const e = k * k * (3 - 2 * k);
      return [lerp(4.4, 0.9, e), lerp(3.2, 2.4, e ** 0.7)];
    },
  );

export const forkBody = makePolyBody({
  id: 'body-fork',
  name: '分叉尾翼高速型',
  style: 'homage',
  theme: '極窄箭形機身＋長刃鼻、外露車輪、雙尾樑與外傾分叉尾鰭的高速型',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.2,
  // iter-47：平滑剖面，只保留側箱肩稜（第 6 點）為銳利稜線
  hard: [6],
  // 車輪外露：機身避開輪胎，不需要輪拱
  wheelArches: [],
  canopy: {
    section: 'ellipse',
    stations: [
      { x: 30, yBase: 0, yTop: 0, halfW: 3 },
      { x: 25, yBase: 0, yTop: 3.6, halfW: 6.5 },
      { x: 16, yBase: 0, yTop: 5.6, halfW: 8 },
      { x: 6, yBase: 0, yTop: 5.2, halfW: 7.5 },
      { x: -2, yBase: 0, yTop: 3, halfW: 5.5 },
      { x: -6, yBase: 0, yTop: 0, halfW: 3 },
    ],
  },
  sideZMin: 24,
  zones: () => [
    // 黑色下半＋尖鼻黑色刀面
    { mat: 'black', keep: (x, y) => 21.5 - 0.05 * x - y },
    { mat: 'silver', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  mountInnerY: (kit) => (x) => (x < -44 ? 27.2 : kit.innerYAt(x)),
  extras: (kit) => {
    const parts = [];
    // 雙尾臂（實心管，以表面積 × 壁厚近似質量）
    parts.push({ geometry: mergeGeos([buildArm(-1), buildArm(1)]), mat: 'silver2', solid: true, outline: true, name: 'tail-arms' });
    // 尾樑之間的橋板（後卡座吊在這裡）
    parts.push({
      geometry: flatPlate(
        [
          [-46, -14.5],
          [-46, 14.5],
          [-58, 14.5],
          [-58, -14.5],
        ],
        27.2,
        1.4,
      ),
      mat: 'black2',
      solid: true,
      outline: true,
      name: 'tail-bridge',
    });
    // 分叉尾鰭（iter-47）：尾臂上外傾 14° 的後掠薄翼型鰭（前緣圓、後緣尖）
    // iter-48：尾鰭從尾臂順順長出——鰭根沿尾臂中心線（y 27.4），弦長從尾臂中段一路到末端；
    // 分三段上色：銀底（下 55%）、青色細帶、黑色鰭頂（共用同一個外傾支點，接縫對齊）
    const finsSilver = [];
    const finsCyan = [];
    const finsBlack = [];
    const root = [-44, -72.5, 27.4];
    const tip = [-65, -75, 47];
    /** @type {(f: number) => number[]} 弦線在展向比例 f 的 [前緣 x, 後緣 x, y] */
    const at = (f) => [lerp(root[0], tip[0], f), lerp(root[1], tip[1], f), lerp(root[2], tip[2], f)];
    const tp = (f) => lerp(1, 0.55, f);
    for (const sg of [-1, 1]) {
      const piece = (f0, f1) => airfoilFin(at(f0), at(f1), 1.6, sg * 17, sg * 14, 16, 8, { pivotY: root[2], taper: [tp(f0), tp(f1)] });
      finsSilver.push(piece(0, 0.55));
      finsCyan.push(piece(0.55, 0.66));
      finsBlack.push(piece(0.66, 1));
    }
    parts.push({ geometry: mergeGeos(finsSilver), mat: 'silver2', outline: true, solid: true, name: 'fork-fins-silver' });
    parts.push({ geometry: mergeGeos(finsCyan), mat: 'cyan2', outline: true, solid: true, name: 'fork-fins-cyan' });
    parts.push({ geometry: mergeGeos(finsBlack), mat: 'black2', outline: true, solid: true, name: 'fork-fins-black' });
    // 刃鼻下方的黑色前翼（細長分流板，往前尖出）
    parts.push({
      geometry: flatPlate(
        [
          [58, -22],
          [66, -12],
          [76, -2],
          [76, 2],
          [66, 12],
          [58, 22],
          [56, 20],
          [56, -20],
        ],
        13.6,
        0.8,
      ),
      mat: 'black2',
      outline: true,
      solid: true, name: 'front-wing',
    });
    // 座艙內裝
    const drv = buildDriver(12, kit.innerYAt(12) + kit.t, 0.95);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 閃電斜紋（側箱）與機身中線細線
    const bolt = [sdBar(20, 23.5, 8, 17, 1.4), sdBar(8, 17, 2, 22, 1.4), sdBar(2, 22, -16, 13.5, 1.4)];
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal((u, v) => Math.min(...bolt.map((f) => f(u, v))), { x0: 0, y0: 0, zMin: 24, side: 1 })),
        kit.decal(sideDecal((u, v) => Math.min(...bolt.map((f) => f(-u, v))), { x0: 0, y0: 0, zMin: 24, side: -1 })),
        kit.decal((x, y, z) => (x < 34 || x > 74 ? -1 : 0.5 - Math.abs(z))),
      ]),
      mat: 'cyan',
      name: 'decal-bolt',
    });
    parts.push({
      geometry: kit.decal(topDecal(sdNumber('9', { h: 6, w: 3.4, gap: 0 }), { x0: 46, yMin: 20 })),
      mat: 'dark',
      name: 'decal-number',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm',
    geometry: '本檔 STATIONS（推估）：輪胎範圍內機身半寬 ≤ 23.5，26 / 31 mm 輪胎都留 ≥ 1 mm',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）；後卡座吊在尾樑橋板下',
  },
});
