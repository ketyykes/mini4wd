// 鯤鵬（body-kunpeng，神話組・中國）：《莊子・逍遙遊》「北冥有魚，其名為鯤……化而為鳥，其名為鵬」。
// 不做魚頭、鳥頭與眼睛，「化」用三種元素表現：
// (1) 鰭 → 翼的變形：車身中段兩側一對後掠的小鰭刀（墨黑），到車尾放大成上下兩層、往後上方揚起的翼片（青灰 → 留白），三組翼片前緣都是金線；
// (2) 水 → 風的漸變 livery：前半墨黑亮面（深水）、後半留白霧面（長風），中間是往後上方斜掃、一條比一條細的青灰條帶；
//     前半有浪頭帶與淡金水波線（水擊三千里），後半是青灰人字羽紋；
// (3) 配色與材質：水墨黑白＋青灰珍珠漆＋淡金線，朱砂紅只用在一枚無字印章。
// 低扁全罩的尖楔車身，頂部一道兩端尖的長條透明窗（水天之間）；前輪 R17.5 輪拱、後輪在窄車尾外側由翼片罩住（26 / 31 mm 輪都可裝）。
// 設計：shared/design/body-kunpeng/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 7 節 Z1–Z4；黑名單 7-3）。剖面為本檔站位產生器（推估）。
// 不寫任何文字（含「Kunpeng」字樣）、不做晶片紋、不做紅色魚身 / 海豚形、不做龍角龍鬚。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdRoundRect, sideDecal, mergeGeos, buildRegion, buildRim, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -72;
/** @type {number} 鼻尖 x */
const X_NOSE = 78;
/** @type {number} 車頭收尖起點 x（往前到鼻尖收成尖楔） */
const X_HEAD = 50;
/** @type {number} 車尾圓收起點 x */
const X_TAILROUND = -54;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40；圓收前的基礎值，推估） */
const XS = [-72, -64, -56, -46, -36, -26, -18, -8, 4, 16, 28, 40, 50, 60, 68, 74, 78];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬：前段最寬（37，罩住前輪、切 R17.5 輪拱），在前輪之前收窄成尖楔鼻；
  // 中段（兩輪之間）鼓起（半寬 35–35.5），側面往下包到 y 10.5，擋住電池艙；
  // 在後輪前（x −26 → −18）收回窄車尾（20，在後輪內側、31 mm 輪內側面 24.75 之內留 ≥ 4 mm）——後輪在窄車尾外側由上方的翼片罩住，
  // 俯視是「寬前身、收腰、寬後掠翼」
  hw: monoCurve(XS, [13, 17, 19.5, 20, 20, 20.5, 25, 33, 35.5, 35.5, 36.5, 37, 36, 31.5, 27, 24, 22]),
  // 中線頂：最高點在座艙段（36.6），往鼻端一路下壓，往後緩降；殼頂低扁，壓低正面面積
  yTop: monoCurve(XS, [28, 31, 33, 34.2, 35, 35.6, 36, 36.4, 36.6, 36.4, 36, 35.4, 34.6, 33.2, 31.6, 30.4, 29.6]),
  // 側線（剖面最寬處的高度）：往鼻端下壓（鼻尖離地約 16，V3）
  ySh: monoCurve(XS, [27, 26.5, 26, 26, 26, 25.5, 25, 24, 23.5, 23, 23, 23, 22.6, 21.2, 19.4, 17.6, 16.4]),
  // 側裙下緣：前段與中段 10.5–13（底盤側壁頂 9.4 之上）；窄車尾約 17（底盤上方，不和底盤重疊；壓低到車尾不露後齒輪）
  yLow: monoCurve(XS, [19.5, 17.5, 16.8, 16.8, 17, 16.5, 12, 10.5, 10.5, 11, 11, 11, 11.5, 12, 12.4, 12.6, 12.6]),
};

/**
 * 端部圓收係數：車頭往鼻尖收成尖楔、車尾往尾端以四分之一橢圓縮小（1 = 不縮）
 * @type {(x: number) => number}
 */
const endFactor = (x) => {
  if (x > X_HEAD) {
    // 車頭：(1 − u^1.5)^0.9 的尖楔（鼻端收尖，不用四分之一橢圓的圓鈍車頭）
    const u = Math.min(1, (x - X_HEAD) / (X_NOSE - X_HEAD));
    return Math.max(0.06, (1 - u ** 1.5) ** 0.9);
  }
  if (x < X_TAILROUND) {
    const u = Math.min(1, (X_TAILROUND - x) / (X_TAILROUND - X_TAIL + 2.5));
    return Math.max(0.4, Math.sqrt(1 - u * u));
  }
  return 1;
};

/**
 * 圓收後的斷面參數
 * @type {(x: number) => { hw: number, ySh: number, ry: number, yLow: number }}
 */
const sec = (x) => {
  const f = endFactor(x);
  const ySh = P.ySh(x);
  return { hw: P.hw(x) * f, ySh, ry: (P.yTop(x) - ySh) * f, yLow: ySh - (ySh - P.yLow(x)) * f };
};

/** @type {number} 上半斷面超橢圓指數（0.8 → 比橢圓飽滿的背面） */
const SE = 0.8;
/** @type {number[]} 上半斷面 6 點的角度（度） */
const ANGLES = [90, 70, 50, 32, 16, 0];

/**
 * 半剖面 8 點：上半超橢圓（中線頂 → 側線）＋側裙兩點（往下微收）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const { hw, ySh, ry, yLow } = sec(x);
  const pts = ANGLES.map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [hw * Math.cos(a) ** SE, ySh + ry * Math.sin(a) ** SE];
  });
  pts.push([hw * 0.99, ySh - 0.5 * (ySh - yLow)], [hw - 1.2 * endFactor(x), yLow]);
  return pts;
};

/** @type {{ x: number, pts: number[][] }[]} 站位表（車頭與車尾曲率大的段落加密） */
const STATIONS = [
  ...buildStations(X_TAIL, -54, 1, profile).slice(0, -1),
  ...buildStations(-54, 52, 2, profile).slice(0, -1),
  ...buildStations(52, X_NOSE, 0.75, profile),
];

/**
 * 某高度的殼外面 |z|（超橢圓反解；側線以下視為最寬處）
 * @type {(x: number, y: number) => number}
 */
const shellZ = (x, y) => {
  const { hw, ySh, ry } = sec(x);
  const q = (y - ySh) / Math.max(0.5, ry);
  if (q <= 0) {
    return hw;
  }
  if (q >= 1) {
    return 0;
  }
  const s = q ** (1 / SE);
  return hw * Math.sqrt(1 - s * s) ** SE;
};

/** @type {{ x0: number, x1: number, h: number }} 頂部長條透明窗：兩端尖的透鏡形（兩圓交集），x −26 → 34、最寬半寬 8.5 */
const WIN = { x0: -26, x1: 34, h: 8.5 };
/** @type {number} 透鏡窗兩側圓弧半徑 */
const WIN_R = ((WIN.x1 - WIN.x0) ** 2 / 4 + WIN.h ** 2) / (2 * WIN.h);
/** @type {number} 透鏡窗中心 x */
const WIN_XC = (WIN.x0 + WIN.x1) / 2;
/** @type {(x: number, z: number) => number} 透鏡窗 2D 距離（負值 = 窗內） */
const lensSd = (x, z) => Math.max(Math.hypot(x - WIN_XC, z - (WIN_R - WIN.h)) - WIN_R, Math.hypot(x - WIN_XC, z + (WIN_R - WIN.h)) - WIN_R);
/** @type {(x: number, y: number, z: number) => number} */
const windowSd = (x, y, z) => (y < 32 ? 10 : lensSd(x, z));

/** @type {{ x: number, y: number, radius: number }} 前輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const FRONT_ARCH = { x: 40, y: 13, radius: 17.5 };

/** @type {{ x: number, y: number, len: number, h: number, lean: number }} 側進氣口：前輪拱後方一道往後上方斜的圓角長槽（中心、半長、半高；斜率和塗裝條帶一致） */
const INTAKE = { x: 11.5, y: 18.2, len: 5.5, h: 1.9, lean: 0.9 };
/** @type {(x: number, y: number, z: number) => number} 側進氣口凹槽（負值 = 槽內） */
const intakeSd = (x, y, z) => {
  if (Math.abs(z) < 24) {
    return 10;
  }
  const v = y - INTAKE.y;
  return sdRoundRect(x - INTAKE.x + INTAKE.lean * v, v, -INTAKE.len, INTAKE.len, -INTAKE.h, INTAKE.h, 1.2);
};

/** @type {number} 深水墨黑區的後緣在塗裝斜向座標上的位置 */
const LIVERY_C0 = 20;
/** @type {number[][]} 青灰條帶 [後緣, 前緣]（相對墨黑後緣的斜向距離，往車尾為負）：一條比一條細，水化為風 */
const LIVERY_BARS = [
  [-10, -3],
  [-18, -13],
  [-24.5, -21.5],
  [-30, -28.5],
];
/**
 * 塗裝斜向座標（0 = 墨黑後緣，往車頭為正）：越高、越靠外側的點越往後算，
 * 側視分界線往後上方斜、俯視是尖端朝前的箭形
 * @type {(x: number, y: number, z: number) => number}
 */
const sweepCoord = (x, y, z) => x + 1.1 * (y - 22) + 0.45 * Math.abs(z) - LIVERY_C0;

/**
 * 羽紋人字：沿 x 每 6.5 mm 一列、尖端朝車尾的人字線（以殼面 y 與 |z| 的弧長近似作為橫向座標），線寬 0.84 mm
 * @type {(x: number, y: number, az: number) => number}
 */
const chevrons = (x, y, az) => {
  // 橫向座標：頂面以 |z|、側面以 y 計（兩者在肩部相接）
  const w = az + Math.max(0, sec(x).ySh + 6 - y);
  const period = 6.5;
  const rows = 4.6;
  const j = Math.floor(w / rows);
  const v = w - (j + 0.5) * rows;
  const shift = (((j % 2) + 2) % 2) * (period / 2);
  const ph = ((((x - shift) % period) + period) % period) - 0.95 * Math.abs(v);
  const local = ((ph % period) + period) % period;
  return Math.min(local, period - local) - 0.42;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 深水：墨黑亮面珍珠漆（前半）；長風：留白霧面（後半，roughness > 0.5，Blender 以緞面漆處理）——亮面對霧面的材質對比
  ink: namedMaterial('paint-ink-black-pearl', { color: 0x15191f, roughness: 0.3, metalness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  ink2: namedMaterial('paint-ink-black-pearl', { color: 0x15191f, roughness: 0.3, metalness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  // 青灰：珍珠金屬漆（條帶與下層翼片）
  slate: namedMaterial('paint-slate-pearl', { color: 0x4a6170, roughness: 0.3, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  slate2: namedMaterial('paint-slate-pearl', { color: 0x4a6170, roughness: 0.3, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  paper: namedMaterial('paint-rice-paper-white', { color: 0xece8de, roughness: 0.66, clearcoat: 0.05 }),
  paper2: namedMaterial('paint-rice-paper-white', { color: 0xece8de, roughness: 0.66, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 真金屬：翼片前緣金線（Blender 依 -brass 結尾換成金屬）
  gold: namedMaterial('trim-gold-brass', { color: 0xd4b56a, roughness: 0.32, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x16181b, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-ink', { color: 0x2a2e33, roughness: 0.6, side: THREE.DoubleSide }),
  // 水天之間：淡青灰的透明窗
  glass: namedMaterial('pc-smoke-tint', { color: 0x9fc2c8, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.38, envMapIntensity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  frame: namedMaterial('paint-ink-frame', { color: 0x15171a, roughness: 0.45, clearcoat: 0.6, side: THREE.DoubleSide }),
  intake: namedMaterial('paint-intake-dark', { color: 0x0e1114, roughness: 0.7, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-pale-gold', { color: 0xd8c38a, roughness: 0.35, metalness: 0.6 }),
  dSlate: decalMaterial('decal-slate-blue', { color: 0x4a6170, roughness: 0.4 }),
  dRed: decalMaterial('decal-cinnabar-red', { color: 0xb5322a, roughness: 0.5 }),
  dPaper: decalMaterial('decal-paper-white', { color: 0xf1ede3, roughness: 0.55 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-slate', { color: 0x3b4850, roughness: 0.65, side: THREE.DoubleSide }),
});

/** @type {number} 輪拱內襯 / 輪井內壁的 |z|（31 mm 輪胎內側面 24.75 之內 3.25 mm） */
const WELL_Z = 21.5;
/** @type {number} 輪井內壁下緣 y（底盤頂 17、前齒輪箱之上） */
const WELL_Y0 = 20;

/**
 * 輪拱內襯：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3，只取上半圈），z 範圍沿殼內面往內 depth（不小於 WELL_Z）
 * 內襯要一路延伸到 WELL_Z（depth 給足）：只有 3.5 mm 寬時，從輪拱看進去大半是殼內面，Blender 算圖時殼內面在前輪拱內側會出現黑白條紋
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.3;
  const a1 = Math.PI - 0.3;
  const pos = [];
  /** @type {(t: number) => number} */
  const zIn = (t) => shellZ(arch.x + r * Math.cos(t), arch.y + r * Math.sin(t)) - 1.2;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, Math.max(WELL_Z, zIn(t0) - depth));
      const B = p(t1, Math.max(WELL_Z, zIn(t1) - depth));
      const C = p(t1, zIn(t1));
      const D = p(t0, zIn(t0));
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
 * 輪井內壁：|z| = WELL_Z 的直立板，範圍是內襯圓弧以內、y ≥ WELL_Y0 的弓形，和內襯一起把前輪拱上半部圍成封閉輪井，
 * 從輪拱看進去只看到內襯與內壁（看不到殼內面）；下緣以下是底盤與輪軸，不擋
 * @type {(arch: { x: number, y: number, radius: number }) => THREE.BufferGeometry}
 */
const buildWellWall = (arch) => {
  const r = arch.radius + 0.3;
  const d = WELL_Y0 - arch.y;
  const a0 = Math.asin(d / r);
  const n = 32;
  /** @type {number[]} */
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, Math.PI - a0, i / n);
      const t1 = lerp(a0, Math.PI - a0, (i + 1) / n);
      // 扇形三角：弓形弦中點 → 圓弧兩點
      const c = [arch.x, WELL_Y0, sg * WELL_Z];
      const p0 = [arch.x + r * Math.cos(t0), arch.y + r * Math.sin(t0), sg * WELL_Z];
      const p1 = [arch.x + r * Math.cos(t1), arch.y + r * Math.sin(t1), sg * WELL_Z];
      // 法線朝外（朝輪胎）
      if (sg > 0) {
        pos.push(...c, ...p0, ...p1);
      } else {
        pos.push(...c, ...p1, ...p0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 繞 x 軸以 (yPivot, zPivot) 為支點轉 deg 度（右側翼片的上反角；正值 = 翼尖往上）
 * @type {(g: THREE.BufferGeometry, yPivot: number, zPivot: number, deg: number) => THREE.BufferGeometry}
 */
const dihedral = (g, yPivot, zPivot, deg) => {
  g.translate(0, -yPivot, -zPivot);
  g.rotateX((-deg * Math.PI) / 180);
  g.translate(0, yPivot, zPivot);
  return g;
};

/**
 * 倒角平板（flatPlate 直角薄板的倒角版）：俯視多邊形 pts（(x, z)），底面 y、總厚 thick，上下緣各倒 bevel 的圓角
 * （bevelOffset 往內縮，俯視外形不變大）
 * @type {(pts: number[][], y: number, thick: number, bevel: number) => THREE.BufferGeometry}
 */
const bevelPlate = (pts, y, thick, bevel) => {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thick - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 3,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y + bevel, 0);
  return g;
};

/** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} 左右鏡射（z → −z） */
const mirrorZ = (g) => {
  const m = g.clone();
  m.scale(1, 1, -1);
  m.computeVertexNormals();
  return m;
};

/**
 * 翼片（右側，俯視多邊形 (x, z)；左側鏡射）：底面高 y、厚 thick，以 (y, pivotZ) 為支點上反 dihedral 度；
 * 多邊形前三點是前緣（翼根 → 翼尖）
 * @typedef {{ y: number, thick: number, dihedral: number, pivotZ: number, poly: number[][] }} Blade
 */

/** @type {Blade} 鰭刀：車身中段側線上的一對後掠小鰭（鰭 → 翼變形的起點），翼根埋進殼面 2.5 mm */
const FIN = {
  y: 21.6,
  thick: 1.6,
  dihedral: 10,
  pivotZ: 33,
  poly: [
    [16, 33],
    [9, 39.5],
    [-6, 45.6],
    [-12, 45.8],
    [-7, 39],
    [-2, 33],
  ],
};
/** @type {Blade} 下層翼片：鰭刀放大、後移，罩在後輪上方（底面 y 30.6，高於 31 mm 後輪頂 28.5），翼尖上揚到約 y 36 */
const VANE_LOW = {
  y: 30.6,
  thick: 1.8,
  dihedral: 14,
  pivotZ: 25,
  poly: [
    [-12, 17.5],
    [-28, 33],
    [-44, 45.4],
    [-55, 46.8],
    [-52, 40.5],
    [-45, 29.5],
    [-37, 17.5],
  ],
};
/** @type {Blade} 上層翼片：再放大、再後移，翼尖揚到全車最高（約 y 46，比窗頂高 9 mm）；和下層前後、上下錯開成兩層 */
const VANE_UP = {
  y: 32.6,
  thick: 1.6,
  dihedral: 24,
  pivotZ: 15,
  poly: [
    [-36, 13],
    [-50, 28],
    [-58, 37.8],
    [-65.8, 32.2],
    [-61, 25],
    [-55, 13],
  ],
};
/** @type {Blade} 上層翼片的翼尖：同一片翼面分出來的墨黑翼尖（留白的翼蘸了墨），和翼身之間是一道倒角分件線 */
const VANE_TIP = {
  ...VANE_UP,
  poly: [
    [-58, 37.8],
    [-61, 41.5],
    [-71.5, 44],
    [-68.5, 36],
    [-65.8, 32.2],
  ],
};

/** @type {(b: Blade) => THREE.BufferGeometry} 右側翼片：上下緣倒 0.45 mm 圓角的平板（射出件的倒角邊），再上反 */
const buildBlade = (b) => dihedral(bevelPlate(b.poly, b.y, b.thick, 0.45), b.y, b.pivotZ, b.dihedral);

/** @type {(b: Blade) => THREE.BufferGeometry} 右側翼片的前緣金線：沿前緣的一道 Ø1.1 圓肋，和翼片一起上反 */
const buildEdgeRail = (b) => {
  const pts = b.poly.slice(0, 3).map(([x, z]) => [x, b.y + b.thick / 2, z]);
  return dihedral(sweepEllipse(pts, 8, () => [0.55, 0.55], 6), b.y, b.pivotZ, b.dihedral);
};

export const kunpengBody = makePolyBody({
  id: 'body-kunpeng',
  name: '鯤鵬',
  style: 'myth',
  phase: 8,
  mythSeries: 'chinese',
  mythTheme: 'kunpeng',
  form: 'wave-wedge',
  roof: 'clear',
  wing: 'fin-vanes',
  theme: '《莊子・逍遙遊》鯤化為鵬，不做魚頭與鳥頭：低扁的尖楔車身前半墨黑亮面（深水）、後半留白霧面（長風），中間是往後上方斜掃、一條比一條細的青灰條帶；車身中段一對後掠小鰭刀，到車尾放大成上下兩層往後上方揚起的翼片，前緣都是金線；前半浪頭帶與淡金水波線、後半青灰人字羽紋，頂部一道水天之間的長條透明窗',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面，沒有銳利稜線
  hard: [],
  // 只有前輪拱（後輪在窄車尾外側，由翼片從上方罩住）
  wheelArches: [{ ...FRONT_ARCH, cutZFrom: 22 }],
  openings: [{ id: '水天窗', shape: 'fn', sd: windowSd }],
  recesses: [{ id: '側進氣口', view: 'side', shape: 'fn', sd: intakeSd, depth: 0.6 }],
  sideZMin: 24,
  innerSkipRecess: true,
  zones: () => [
    // 墨黑（深水）：後緣帶一點浪頭起伏
    { mat: 'ink', keep: (x, y, z) => sweepCoord(x, y, z) + 1.3 * Math.sin(0.8 * (y + 0.5 * Math.abs(z))) },
    // 青灰條帶：往車尾一條比一條細
    {
      mat: 'slate',
      keep: (x, y, z) => {
        const d = sweepCoord(x, y, z);
        return Math.max(...LIVERY_BARS.map(([d0, d1]) => Math.min(d - d0, d1 - d)));
      },
    },
    // 留白（長風）
    { mat: 'paper', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'ink' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'paper2', recess: 'intake', recessWall: 'intake', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 水天窗：淡青灰透明窗片（計入殼面質量）＋墨黑窗框
    const pane = buildRegion(kit.surf, [(x, y, z) => -windowSd(x, y, z)], { offset: -0.1 });
    parts.push({ geometry: pane.geometry, mat: 'glass', shell: true, renderOrder: 3, name: 'canopy-window' });
    const frame = buildRegion(kit.surf, [...kit.holes, (x, y, z) => 1.0 - windowSd(x, y, z)], { offset: 0.3 });
    parts.push({ geometry: frame.geometry, mat: 'frame', name: 'window-frame' });
    parts.push({ geometry: buildRim(frame, 0, 0.3), mat: 'frame', name: 'window-frame-wall' });

    // 輪拱內襯（擋住從輪拱看進去的殼內空腔）
    parts.push({
      geometry: mergeGeos([buildLiner(FRONT_ARCH, 20), buildWellWall(FRONT_ARCH)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });

    // 鰭 → 翼：鰭刀（墨黑）→ 下層翼片（青灰）→ 上層翼片（留白＋墨黑翼尖），顏色跟著塗裝由深到淺；前緣金線各組共用，讀成同一個形狀的三個階段
    /** @type {[Blade, string, string][]} */
    const blades = [
      [FIN, 'ink2', 'fin-blades'],
      [VANE_LOW, 'slate2', 'wing-vanes-lower'],
      [VANE_UP, 'paper2', 'wing-vanes-upper'],
      [VANE_TIP, 'ink2', 'wing-vanes-upper-tips'],
    ];
    for (const [blade, mat, name] of blades) {
      const g = buildBlade(blade);
      parts.push({ geometry: mergeGeos([g, mirrorZ(g)]), mat, solid: true, outline: true, name });
    }
    const rails = blades.map(([blade]) => buildEdgeRail(blade));
    parts.push({ geometry: mergeGeos([...rails, ...rails.map(mirrorZ)]), mat: 'gold', solid: true, outline: true, name: 'blade-edge-rails' });

    // 水波 livery（墨黑區）：從鼻尖沿肩部往後掃的一道米白浪頭帶（上緣是起伏的浪頭，往鼻尖收細），上下各一道淡金細浪線（只到前輪前方，兩端收尖）；
    // 位置用斷面周向座標算（側線為 0，沿側面往上、再沿頂面往中線遞增；斷面接近方形，近似弧長），頂面上的浪幅才不會被放大
    /** @type {(x: number, y: number, z: number) => number} 相對浪頭帶中線的周向距離（mm，往頂面為正） */
    const waveV = (x, y, z) => {
      const s = sec(x);
      return s.hw - Math.abs(z) + (y - s.ySh) - 1.25 * s.ry;
    };
    /** @type {(x: number, y: number, z: number) => boolean} 墨黑區 */
    const onWater = (x, y, z) => x < 76 && sweepCoord(x, y, z) > 2.5;
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onWater(x, y, z)) {
          return -1;
        }
        const v = waveV(x, y, z);
        const half = 1.3 * Math.min(1, Math.max(0.3, (76 - x) / 14));
        return Math.min(half + 0.8 * Math.sin(x / 2.6) - v, v + half);
      }),
      mat: 'dPaper',
      name: 'decal-wave-band',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const half = 0.5 * Math.min(1, (60 - x) / 6);
        if (!onWater(x, y, z) || half < 0.05) {
          return -1;
        }
        const v = waveV(x, y, z);
        return half - Math.min(Math.abs(v - 3.4 - 0.6 * Math.sin(x / 2.6 + 1.2)), Math.abs(v + 3.0 - 0.6 * Math.sin(x / 2.6 + 2.4)));
      }),
      mat: 'dGold',
      name: 'decal-wave-lines',
    });
    // 羽紋（留白區）：條帶之後到車尾，一排排尖端朝車尾的青灰人字線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 5 || sweepCoord(x, y, z) > -33 || x < -66 || y < sec(x).ySh - 1) {
          return -1;
        }
        return -chevrons(x, y, Math.abs(z));
      }),
      mat: 'dSlate',
      name: 'decal-wind-chevrons',
    });
    // 朱砂無字印章：車尾側面一枚圓角方印（紅底、米白內框與一道雲紋，不含任何文字）
    /** @type {{ x0: number, y0: number }} 印章中心（側視） */
    const SEAL = { x0: -60, y0: 25.5 };
    parts.push({
      geometry: kit.decal(sideDecal((u, v) => sdRoundRect(u, v, -2.8, 2.8, -2.8, 2.8, 0.5), { x0: SEAL.x0, y0: SEAL.y0, zMin: 16 })),
      mat: 'dRed',
      name: 'decal-seal',
    });
    parts.push({
      geometry: kit.decal(
        sideDecal(
          (u, v) => {
            const frameLine = Math.abs(sdRoundRect(u, v, -2.0, 2.0, -2.0, 2.0, 0.3)) - 0.3;
            const cloud = Math.abs(v - 0.55 * Math.sin(u * 2.1)) - 0.3;
            return Math.min(frameLine, Math.max(cloud, Math.abs(u) - 1.3));
          },
          { x0: SEAL.x0, y0: SEAL.y0, zMin: 16 },
        ),
        { offset: 0.12 },
      ),
      mat: 'dPaper',
      name: 'decal-seal-inner',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）；水天窗片同厚度，以殼面積計入質量',
    geometry: '本檔站位產生器 P＋endFactor（推估）：長 150（鼻尖 x 78、車尾 x −72，≤ 153 避免立體橋刮底）；前低後高的楔形：殼頂 36.6（座艙段）、鼻尖離地約 16、車頭以 (1 − u^1.5)^0.9 收尖；前輪拱 R17.5（31 mm 輪半徑 15.5 + 2 mm）；窄車尾半寬 20、下緣約 16.5–17（在後輪內側、底盤上方）；側進氣口為前輪拱後方深 0.6 的斜長槽',
    wings: '鰭刀（x −12 ~ 16、厚 1.6、上反 10°）、下層翼片（x −55 ~ −12、厚 1.8、上反 14°、底面 y 30.6，高於 31 mm 後輪頂 28.5 與後上導輪 20.5）、上層翼片（x −71.5 ~ −36、厚 1.6、上反 24°，翼尖頂約 y 46；翼尖分件上墨黑）、前緣金線 Ø1.1 圓肋，均為 ABS 實心件（推估），上下緣倒圓角 0.45，質量 = 封閉體積 × 1.05 g/cm³；翼根埋進殼面',
    myth: '典故《莊子・逍遙遊》（MYTH_RESEARCH Z1）：「化而為鳥」做成鰭 → 翼的三段變形與水 → 風的漸變塗裝，「水擊三千里」做成浪頭帶與水波線；上下兩段、水與風同一件的構成參考故宮〈松花石鯤鵬硯〉故文001376（Z4：下方波濤、上方雲海），不做魚首、鳥首',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
