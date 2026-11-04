// 鯤鵬（body-kunpeng，第八階段神話組・中國）：《莊子・逍遙遊》「北冥有魚，其名為鯤……化而為鳥，其名為鵬」。
// 前半是魚（鯤）：圓鈍魚頭、魚眼、口線、鰓蓋弧溝、側面魚鱗紋；後半是鳥（鵬）：魚鱗往後拉長成羽紋，
// 車尾左右一對低而寬、往後掠的大鵬翼（覆羽板＋5 片分段飛羽，實體件），中央一片短扇尾；
// 頂部一道兩端尖的長條透明窗（水天之間）。低扁全罩，前輪 R17.5 輪拱、後輪在窄鳥身外側由鵬翼罩住（26 / 31 mm 輪都可裝）。
// 設計：shared/design/body-kunpeng/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 7 節 Z1–Z4、Z6；黑名單 7-3）。剖面為本檔站位產生器（推估）。
// 塗裝為自創水墨感：墨黑 → 青灰 → 霧灰 → 留白的分段漸層、淡金細線魚鱗 / 羽紋、朱砂紅點睛與無字印章；
// 不寫任何文字（含「Kunpeng」字樣）、不做晶片紋、不做紅色魚身 / 海豚形、不做龍角龍鬚。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdRoundRect, sideDecal, mergeGeos, buildRegion, buildRim, lerp } from './loft.js';
import { monoCurve, buildStations, sdCircle } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -72;
/** @type {number} 魚頭鼻尖 x */
const X_NOSE = 78;
/** @type {number} 魚頭圓鈍化起點 x（往前到鼻尖以四分之一橢圓收圓） */
const X_HEAD = 50;
/** @type {number} 車尾圓收起點 x */
const X_TAILROUND = -54;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40；圓收前的基礎值，推估） */
const XS = [-72, -64, -56, -46, -36, -26, -18, -8, 4, 16, 28, 40, 50, 60, 68, 74, 78];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬：前半魚頭最寬（37.5，罩住前輪、切 R17.5 輪拱），鰓蓋之後收腰，後半是窄的鳥身（20，在後輪內側、
  // 31 mm 輪內側面 24.75 之內留 ≥ 4 mm）——後輪由上方的鵬翼罩住，俯視是「圓寬魚頭、細腰、寬後掠翼」
  // （輪廓 IoU：和既有 19 款俯視最大 0.80，避開 owl-hush / griffin-vane 的寬水滴形）
  // iter-114：中段（兩輪之間）改成鼓起的魚腹（半寬 35–35.5，比 owl-hush / griffin-vane 的腰身寬），魚頭在前輪之前收窄成較尖的魚吻（俯視 IoU），側面往下包到 y 10.5，擋住原本外露的電池艙；
  // 魚腹在後輪前（x −26 → −18）收回窄鳥身，後輪仍在窄鳥身外側由鵬翼罩住
  hw: monoCurve(XS, [13, 17, 19.5, 20, 20, 20.5, 25, 33, 35.5, 35.5, 36.5, 37, 36, 31.5, 27, 24, 22]),
  // 中線頂：魚頭頂（前輪上方 41.5）最高，往後緩降成鳥背；低扁
  yTop: monoCurve(XS, [28, 31, 33, 34, 34.5, 35, 35.5, 36.5, 38, 39.5, 40.5, 41.5, 41, 40, 38.5, 37, 36]),
  // 側線（魚的側線＝剖面最寬處的高度）
  ySh: monoCurve(XS, [27, 26.5, 26, 26, 26, 25.5, 25, 24, 23.5, 23, 23, 23, 23, 23, 23, 23, 23]),
  // 側裙下緣：前半魚身與中段魚腹 10.5–13（底盤側壁頂 9.4 之上）；後半窄鳥身約 17（底盤上方，不和底盤重疊；iter-114 由 18–23 壓低，車尾不露後齒輪）
  yLow: monoCurve(XS, [19.5, 17.5, 16.8, 16.8, 17, 16.5, 12, 10.5, 10.5, 11, 11, 11, 11.5, 12, 12.5, 13, 13]),
};

/**
 * 端部圓收係數：魚頭往鼻尖、車尾往尾端以四分之一橢圓縮小（1 = 不縮）
 * @type {(x: number) => number}
 */
const endFactor = (x) => {
  if (x > X_HEAD) {
    const u = Math.min(1, (x - X_HEAD) / (X_NOSE - X_HEAD));
    return Math.max(0.07, Math.sqrt(1 - u * u));
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

/** @type {number} 上半斷面超橢圓指數（0.8 → 比橢圓飽滿的魚背） */
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

/** @type {{ x: number, pts: number[][] }[]} 站位表（魚頭與車尾曲率大的段落加密） */
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
/** @type {(x: number, y: number) => boolean} 側視點是否在前輪拱切口外擴 2 mm 之內（鰓蓋紋與金線避開輪拱邊緣） */
const nearFrontArch = (x, y) => Math.hypot(x - FRONT_ARCH.x, y - FRONT_ARCH.y) < FRONT_ARCH.radius + 2;

/** @type {{ x: number, y: number, r: number[] }} 鰓蓋弧（側視圓心 (34, 22)，半徑 14 與 10.5 兩道，只取後半弧） */
const GILL = { x: 34, y: 22, r: [14, 10.5] };
/** @type {(x: number, y: number, z: number) => number} 鰓蓋弧溝（負值 = 溝內） */
const gillSd = (x, y, z) => {
  // iter-114：鰓蓋弧溝的下端原本伸進前輪拱切口（弧溝牆被輪拱切斷，留下碎片面），現在在輪拱外 2 mm 內不刻溝
  if (Math.abs(z) < 24 || x > GILL.x - 2 || nearFrontArch(x, y)) {
    return 10;
  }
  const r = Math.hypot(x - GILL.x, y - GILL.y);
  return Math.min(...GILL.r.map((rr) => Math.abs(r - rr))) - 0.45;
};

/**
 * 魚鱗 / 羽紋：交錯排列的弧線（每格一道朝車尾凸出的半圓弧）；sx / sy 為格距、stretch 為沿 x 拉長比例（羽 > 鱗）
 * @type {(x: number, y: number, sx: number, sy: number, r: number, stretch: number) => number}
 */
const scaleArcs = (x, y, sx, sy, r, stretch) => {
  let d = Infinity;
  const j0 = Math.floor(y / sy);
  for (let j = j0 - 1; j <= j0 + 1; j++) {
    const shift = (((j % 2) + 2) % 2) * (sx / 2);
    const i0 = Math.floor((x - shift) / sx);
    for (let i = i0 - 1; i <= i0 + 2; i++) {
      const cx = i * sx + shift;
      const cy = j * sy;
      // 只取圓心後方（−x）的半弧，弧線寬 0.65 mm
      if (x > cx) {
        continue;
      }
      d = Math.min(d, Math.abs(Math.hypot((x - cx) / stretch, y - cy) - r) - 0.33 / Math.max(1, stretch * 0.75));
    }
  }
  return d;
};

/**
 * 羽紋人字：沿 x 每 6.5 mm 一列、尖端朝車尾的人字線（以殼面 y 與 |z| 的弧長近似作為橫向座標），線寬 0.65 mm
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
  return Math.min(local, period - local) - 0.33;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 水墨分段（霧面 / 緞面：roughness > 0.5，Blender 以緞面漆處理）
  ink: namedMaterial('paint-ink-black-satin', { color: 0x1c1f24, roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.5 }),
  ink2: namedMaterial('paint-ink-black-satin', { color: 0x1c1f24, roughness: 0.62, clearcoat: 0.15, side: THREE.DoubleSide }),
  slate: namedMaterial('paint-slate-blue-grey', { color: 0x4f6470, roughness: 0.6, clearcoat: 0.1 }),
  slate2: namedMaterial('paint-slate-blue-grey', { color: 0x4f6470, roughness: 0.6, clearcoat: 0.1, side: THREE.DoubleSide }),
  mist: namedMaterial('paint-mist-grey', { color: 0x98a8ae, roughness: 0.62, clearcoat: 0.1 }),
  mist2: namedMaterial('paint-mist-grey', { color: 0x98a8ae, roughness: 0.62, clearcoat: 0.1, side: THREE.DoubleSide }),
  paper: namedMaterial('paint-rice-paper-white', { color: 0xece8de, roughness: 0.66, clearcoat: 0.05 }),
  paper2: namedMaterial('paint-rice-paper-white', { color: 0xece8de, roughness: 0.66, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 真金屬：鵬翼羽軸（Blender 依 -brass 結尾換成金屬）
  gold: namedMaterial('trim-gold-brass', { color: 0xd4b56a, roughness: 0.32, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x16181b, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-ink', { color: 0x2a2e33, roughness: 0.6, side: THREE.DoubleSide }),
  // 水天之間：淡青灰的透明窗（亮面，全車少數的高光澤部位之一）
  glass: namedMaterial('pc-smoke-tint', { color: 0x9fc2c8, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.38, envMapIntensity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  frame: namedMaterial('paint-ink-frame', { color: 0x15171a, roughness: 0.45, clearcoat: 0.6, side: THREE.DoubleSide }),
  gill: namedMaterial('paint-slate-gill', { color: 0x2b3940, roughness: 0.7, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-pale-gold', { color: 0xd8c38a, roughness: 0.35, metalness: 0.6 }),
  dInk: decalMaterial('decal-ink-black', { color: 0x16181b, roughness: 0.55 }),
  dRed: decalMaterial('decal-cinnabar-red', { color: 0xb5322a, roughness: 0.5 }),
  dPaper: decalMaterial('decal-paper-white', { color: 0xf1ede3, roughness: 0.55 }),
  eye: namedMaterial('lamp-eye-pearl', { color: 0xf4f1e6, emissive: 0x3a3428, emissiveIntensity: 0.3, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-slate', { color: 0x3b4850, roughness: 0.65, side: THREE.DoubleSide }),
});

/** @type {number} 輪拱內襯 / 輪井內壁的 |z|（31 mm 輪胎內側面 24.75 之內 3.25 mm） */
const WELL_Z = 21.5;
/** @type {number} 輪井內壁下緣 y（底盤頂 17、前齒輪箱之上） */
const WELL_Y0 = 20;

/**
 * 輪拱內襯：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3，只取上半圈），z 範圍沿殼內面往內 depth（不小於 WELL_Z）
 * iter-114：depth 3.5 → 一路到 WELL_Z（原本內襯只有 3.5 mm 寬，從輪拱看進去大半是殼內面；Blender 算圖時殼內面在前輪拱內側出現黑白條紋）
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
 * 輪井內壁（iter-114）：|z| = WELL_Z 的直立板，範圍是內襯圓弧以內、y ≥ WELL_Y0 的弓形，和內襯一起把前輪拱上半部圍成封閉輪井，
 * 從輪拱看進去只看到內襯與內壁（不再看到殼內面）；下緣以下是底盤與輪軸，不擋
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
 * 繞 x 軸以 (yPivot, zPivot) 為支點轉 deg 度（右翼上反角；正值 = 翼尖往上）
 * @type {(g: THREE.BufferGeometry, yPivot: number, zPivot: number, deg: number) => THREE.BufferGeometry}
 */
const dihedral = (g, yPivot, zPivot, deg) => {
  g.translate(0, -yPivot, -zPivot);
  g.rotateX((-deg * Math.PI) / 180);
  g.translate(0, yPivot, zPivot);
  return g;
};

/**
 * 倒角平板（iter-114，取代 flatPlate 的直角薄板）：俯視多邊形 pts（(x, z)），底面 y、總厚 thick，上下緣各倒 bevel 的圓角
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

/** @type {{ y: number, covert: number[][], primaries: number[][] }} 鵬翼（右翼，俯視 (x, z)；左翼鏡射）：覆羽板前緣從翼根往後外掠，後半由 5 片分段飛羽組成 */
const WING = {
  y: 30.6,
  covert: [
    [-18, 18],
    [-32, 34],
    [-45, 45.5],
    [-51, 47],
    [-50, 41],
    [-45, 30],
    [-39, 18],
  ],
  // 飛羽（由翼尖往翼根）：每片 [根 x, 根 z, 尖 x, 尖 z, 半寬]；後緣分成 5 段（羽尖鋸齒），往後掠、和窄鳥身之間留開口
  primaries: [
    [-49, 44.5, -67, 46.2, 2.0],
    [-47.5, 39.8, -68, 41.4, 2.1],
    [-46, 35.2, -67, 36.4, 2.1],
    [-44.5, 30.6, -64.5, 31.4, 2.0],
    [-43, 26.0, -60, 26.4, 1.9],
  ],
};

/**
 * 一片飛羽的俯視多邊形：羽根平切、羽尖收成往外偏的尖頭（像真羽的不對稱羽片）
 * @type {(p: number[]) => number[][]}
 */
const featherPoly = ([x0, z0, x1, z1, w]) => {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const nx = -uz;
  const nz = ux;
  /** @type {(s: number, h: number) => number[]} */
  const at = (s, h) => [x0 + ux * s + nx * h, z0 + uz * s + nz * h];
  return [at(0, -w), at(len * 0.7, -w), at(len * 0.92, -w * 0.45), at(len, w * 0.2), at(len * 0.8, w), at(0, w)];
};

export const kunpengBody = makePolyBody({
  id: 'body-kunpeng',
  name: '鯤鵬',
  style: 'myth',
  phase: 8,
  mythSeries: 'chinese',
  mythTheme: 'kunpeng',
  form: 'fish-bird',
  roof: 'clear',
  wing: 'peng-wings',
  theme: '《莊子・逍遙遊》北冥之魚化為大鵬：前半圓鈍魚頭與魚鱗、後半鱗化為羽、車尾一對低寬後掠的鵬翼，頂部一道水天之間的長條透明窗',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面，沒有銳利稜線（魚身）
  hard: [],
  // 只有前輪拱（後輪在窄鳥身外側，由鵬翼從上方罩住）
  wheelArches: [{ ...FRONT_ARCH, cutZFrom: 22 }],
  openings: [{ id: '水天窗', shape: 'fn', sd: windowSd }],
  recesses: [{ id: '鰓蓋弧溝', view: 'side', shape: 'fn', sd: gillSd, depth: 0.6 }],
  sideZMin: 24,
  innerSkipRecess: true,
  zones: () => {
    /** @type {(x: number, y: number) => number} 相對側線的正規化高度（0 = 側線、1 = 中線頂） */
    const q = (x, y) => {
      const s = sec(x);
      return (y - s.ySh) / Math.max(0.5, s.ry);
    };
    // 水墨分界線帶一點筆觸起伏（兩個不同週期的正弦）
    /** @type {(x: number, a: number) => number} */
    const brush = (x, a) => a * (Math.sin(x / 7.3) + 0.6 * Math.sin(x / 2.9 + 1.3));
    return [
      // 墨黑：背脊（魚頭頂往後一路到鳥背）
      { mat: 'ink', keep: (x, y, z) => (y < sec(x).ySh ? -1 : 0.4 * sec(x).hw + brush(x, 1.6) - Math.abs(z)) },
      // 青灰：上側面
      { mat: 'slate', keep: (x, y) => q(x, y) - (0.42 + brush(x + 11, 0.05)) },
      // 霧灰：側線附近
      { mat: 'mist', keep: (x, y) => y - (sec(x).ySh - 3.2 + brush(x + 5, 0.7)) },
      // 留白：腹側
      { mat: 'paper', keep: () => 1 },
    ];
  },
  mats: { inner: 'inner', edge: 'edge', cap: 'ink2', recess: 'gill', recessWall: 'gill', mount: 'mount' },
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

    // 鵬翼：覆羽板（墨黑）＋5 片飛羽（青灰、霧灰交替，往翼尖一片疊一片）＋金色羽軸細肋；翼根埋進殼面，上反 4°
    // iter-114：評審「尾翼是平板疊片」→ 覆羽板 1.4 → 2.0 mm、飛羽 1.2 → 1.6 mm，上下緣都倒 0.5 / 0.45 mm 圓角（射出件的倒角邊）
    const covertR = bevelPlate(WING.covert, WING.y, 2.0, 0.5);
    const featherR = WING.primaries.map((p, i) => bevelPlate(featherPoly(p), WING.y + 1.1 - 0.15 * i, 1.6, 0.45));
    const rachisR = WING.primaries.map(([x0, z0, x1, z1], i) => {
      /** @type {number[][]} 羽軸中心線（貼在各片飛羽頂面） */
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        pts.push([lerp(x0 + 2, x1 + 3, t), WING.y + 2.65 - 0.15 * i, lerp(z0, z1, t)]);
      }
      return sweepEllipse(pts, 12, (t) => [0.4, 0.3 * (1 - 0.5 * t)], 6);
    });
    /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} */
    const tilt = (g) => dihedral(g, WING.y, 25, 4);
    const covert = tilt(covertR);
    const feathersA = WING.primaries.map((_, i) => tilt(featherR[i])).filter((_, i) => i % 2 === 0);
    const feathersB = WING.primaries.map((_, i) => tilt(featherR[i])).filter((_, i) => i % 2 === 1);
    const rachis = rachisR.map(tilt);
    parts.push({ geometry: mergeGeos([covert, mirrorZ(covert)]), mat: 'ink2', solid: true, outline: true, name: 'peng-wing-coverts' });
    parts.push({ geometry: mergeGeos([...feathersA, ...feathersA.map(mirrorZ)]), mat: 'mist2', solid: true, outline: true, name: 'peng-wing-primaries-a' });
    parts.push({ geometry: mergeGeos([...feathersB, ...feathersB.map(mirrorZ)]), mat: 'paper2', solid: true, outline: true, name: 'peng-wing-primaries-b' });
    parts.push({ geometry: mergeGeos([...rachis, ...rachis.map(mirrorZ)]), mat: 'gold', solid: true, outline: true, name: 'peng-wing-rachis' });

    // 鵬尾：車尾中央一片短扇尾（三片尾羽的扇形外緣），貼在尾端殼面上
    const yTailPlate = kit.surf.topY(-60, 0) - 0.6;
    // iter-114：扇尾 1.2 → 1.6 mm、倒角 0.45
    const tail = bevelPlate(
      [
        [-52, 9],
        [-66, 13],
        [-71.5, 9.5],
        [-69, 4.5],
        [-71.8, 0],
        [-69, -4.5],
        [-71.5, -9.5],
        [-66, -13],
        [-52, -9],
      ],
      yTailPlate,
      1.6,
      0.45,
    );
    parts.push({ geometry: tail, mat: 'ink2', solid: true, outline: true, name: 'peng-tail-fan' });

    // 魚眼：朱砂紅眼圈＋米白眼珠＋墨黑瞳孔（點睛），魚頭側面
    /** @type {{ x: number, y: number }} 魚眼中心（側視） */
    const EYE = { x: 66, y: 27.5 };
    parts.push({
      geometry: kit.decal(sideDecal((u, v) => Math.max(sdCircle(0, 0, 3.4)(u, v), -sdCircle(0, 0, 2.5)(u, v)), { x0: EYE.x, y0: EYE.y, zMin: 18 })),
      mat: 'dRed',
      name: 'decal-eye-ring',
    });
    parts.push({ geometry: kit.decal(sideDecal(sdCircle(0, 0, 2.5), { x0: EYE.x, y0: EYE.y, zMin: 18 })), mat: 'eye', name: 'lamp-eye' });
    parts.push({
      geometry: kit.decal(sideDecal(sdCircle(0.35, 0.2, 1.3), { x0: EYE.x, y0: EYE.y, zMin: 18 }), { offset: 0.12 }),
      mat: 'dInk',
      name: 'decal-eye-pupil',
    });
    // 口線：鼻端一道往後微下彎的墨線（魚口）
    parts.push({
      geometry: kit.decal((x, y) => (x < 68.5 ? -1 : 0.45 - Math.abs(y - (20.6 - 0.08 * (X_NOSE - x))))),
      mat: 'dInk',
      name: 'decal-mouth',
    });
    // 鰓蓋弧溝旁的淡金細線（沿外弧外側 1.1 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 24 || x > GILL.x - 2 || nearFrontArch(x, y)) {
          return -1;
        }
        return 0.32 - Math.abs(Math.hypot(x - GILL.x, y - GILL.y) - (GILL.r[0] + 1.1));
      }),
      mat: 'dGold',
      name: 'decal-gill-line',
    });
    // 魚鱗（淡金細弧，鰓蓋之後到車身中段）→ 往後拉長成羽紋（鵬）：同一套交錯弧線、格距與拉長比例沿 x 漸變分成兩段
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 0.72 * sec(x).hw || x > GILL.x - GILL.r[0] - 1.5 || x < -14 || y < sec(x).ySh - 4) {
          return -1;
        }
        return -scaleArcs(x, y, 4.4, 3.6, 2.6, 1);
      }),
      mat: 'dGold',
      name: 'decal-fish-scales',
    });
    // 羽紋：鳥身上一排排往後尖的人字紋（鵬的覆羽），從魚鱗區後緣接續到車尾
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 7 || x > -10 || x < -64 || y < sec(x).ySh - 1) {
          return -1;
        }
        return -chevrons(x, y, Math.abs(z));
      }),
      mat: 'dGold',
      name: 'decal-peng-feathers',
    });
    // 波濤紋：腹側留白上一道連續起伏的墨線（鯤在北冥），由魚頭到後輪前
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 26 || x > 60 || x < -22) {
          return -1;
        }
        const yw = sec(x).ySh - 6.2 + 1.1 * Math.sin(x / 3.2);
        return 0.33 - Math.abs(y - yw);
      }),
      mat: 'dInk',
      name: 'decal-wave-line',
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
    geometry: '本檔站位產生器 P＋endFactor（推估）：長 150（鼻尖 x 78、車尾 x −72，≤ 153 避免立體橋刮底）、殼頂約 41.6（魚頭頂，前輪上方）、低扁；前輪拱 R17.5（31 mm 輪半徑 15.5 + 2 mm）；後半窄鳥身半寬 20、下緣 ≥ 18（在後輪內側、底盤上方）',
    wings: '鵬翼覆羽板厚 2.0（iter-114 前 1.4）、飛羽厚 1.6（前 1.2）、上下緣倒圓角 0.45–0.5、羽軸 0.8 × 0.6 圓肋、扇尾厚 1.6（前 1.2），均為 ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；翼面高 y ≈ 30.6，高於 31 mm 後輪頂 28.5 與後上導輪 20.5',
    myth: '典故《莊子・逍遙遊》（MYTH_RESEARCH Z1）；魚首 / 鵬身造型參考故宮〈松花石鯤鵬硯〉故文001376 的「魚尾、鷹首鳳身」描述（Z4），本款魚頭不做龍首（避免龍頭車身撞形）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
