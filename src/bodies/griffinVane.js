// 獅鷲（body-griffin-vane，第六階段 LG2 致敬款）：高姿態全罩、四個高聳大輪拱（31 mm 輪為造型重點）、往下勾的鷹勾鼻、
// 中線一列鋸齒「頸羽脊」、不透明珍珠白面罩座艙、左右後擋泥板頂上各一組三片羽片小翼（可調下壓力的外露機能件，沒有中央尾翼）。
// 設計：shared/design/body-griffin-vane/DESIGN.md（HOMAGE_RESEARCH 第 6 節 LG2 語彙、和劇中車 / 市售車殼的差異）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：薰衣草紫＋珍珠白＋金細線、兩道平行金色儀仗飾帶、號碼「36」；不含任何廠商 / 作品名稱、商標、隊徽、國旗或角色圖像。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sdRoundRect, sdConvexPolygon, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations, smoothMax, fenderFloor, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-72, -66, -62, -54, -44, -34, -22, -10, 2, 14, 26, 38, 48, 56, 62, 68, 72, 76, 79];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：厚實的後段（獅身）升到面罩座艙頂（40），往前降到鷹勾鼻尖（13.5）
  yC: monoCurve(XS, [25.5, 28, 30.5, 32.5, 33.5, 35, 37.5, 39.5, 40, 38, 33.5, 30.5, 28.5, 26.5, 24.5, 22, 19.5, 16.5, 13.5]),
  // 擋泥板稜線：四輪上方高聳（前 37.5、後 38.5＝獅子後腿較厚），兩輪之間降到 33
  yF: monoCurve(XS, [26.5, 29, 33, 36.5, 38.5, 37, 34, 33, 33, 34, 36, 37.5, 35.5, 31, 27, 23, 20, 17, 14]),
  // 半寬：俯視「前寬（鷹的胸與前爪）、細腰、後段高而不寬的獅臀、長喙」——前擋泥板最寬（46.5），腰部收到 30，
  // 後擋泥板 41、車尾方正（34），往前收成細長的鳥喙
  hw: monoCurve(XS, [27, 34, 38, 40.5, 41, 40.5, 34, 28, 27, 30.5, 41, 46.5, 45, 37, 28, 18, 11, 5.5, 2]),
  // 側壁下緣：車尾下緣 21；鼻尖下緣比鼻樑後方低（x 62 → 79：15.5 → 11）＝往下勾的鷹勾唇
  yLow: monoCurve(XS, [22.5, 21, 18.5, 14, 12.5, 12.5, 15, 18, 18, 16, 12.5, 12, 13.5, 15, 15.5, 14.5, 13.5, 12, 11]),
};

/**
 * 半剖面 8 點：中線頂 → 中線肩 → 座艙側溝 → 擋泥板內坡 → 擋泥板稜線 → 外側圓肩 → 側壁肩 → 側壁下緣
 * 座艙段中線比擋泥板高 6–7 mm（面罩座艙隆起），前後輪上方擋泥板高於中線（高聳輪拱）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const hw = P.hw(x);
  const k = Math.min(1, (hw - 2.4) / 34);
  const yF0 = P.yF(x);
  const yValley0 = Math.min(yC - 1.5, yF0 - 1.5);
  const yValley = smoothMax(yValley0, Math.min(fenderFloor(x), yF0 - 0.8), 1.5);
  const yF = smoothMax(yF0, yValley + 1, 1);
  const zF = Math.min(32 * k, hw - 4);
  // 鳥喙段側壁很矮：肩線不低於下緣 + 1.5（鼻尖下緣才會停在 P.yLow，不會往下垂到導輪）
  const yShoulder = Math.max(yF - 5 - 0.4 * Math.max(0, hw - zF - 8), P.yLow(x) + 1.5);
  const yLow = Math.min(P.yLow(x), yShoulder - 1);
  return [
    [0, yC],
    [6 * k, yC - 0.3],
    [12 * k, lerp(yC - 1.4, yValley0, 0.6)],
    [19 * k, yValley],
    [zF, yF],
    [Math.max(zF + 0.4, hw - 3), yF - 2.2],
    [hw, yShoulder],
    [hw, yLow],
  ];
};

// 鳥喙段每 1 mm 一站（曲率大）
const STATIONS = [...buildStations(-72, 60, 2, profile).slice(0, -1), ...buildStations(60, 79, 1, profile)];

/** @type {(x: number) => number} 金色儀仗飾帶（上線）的側視高度：從鼻側起，越過前擋泥板上掃，沿腰線到後擋泥板 */
const SASH = monoCurve([-46, -32, -20, 0, 20, 34, 46, 56, 66], [35.2, 33, 30.5, 29.5, 30, 31.8, 31.5, 25.5, 18.5]);

/** @type {(x: number, z: number) => number} 白色「鷹頭」範圍（正值 = 鷹頭內）：鼻部往後到 x ≈ 50，後緣是鋸齒狀的羽毛領 */
const headKeep = (x, z) => {
  const az = Math.abs(z);
  const saw = 2.2 * Math.abs(((az / 6) % 1) * 2 - 1);
  return x - (49 + 0.15 * az + saw);
};

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（側視） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5 },
  { x: -40, y: 13, radius: 17.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** 面罩座艙（俯視橢圓） */
const FACE = { cx: -1, a: 23, b: 14.5 };
/** @type {(x: number, z: number) => number} 正規化橢圓距離（< 1 在面罩內） */
const faceEll = (x, z) => Math.hypot((x - FACE.cx) / FACE.a, z / FACE.b);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  lavender: namedMaterial('paint-lavender', { color: 0x9a78d8, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  lavender2: namedMaterial('paint-lavender', { color: 0x9a78d8, roughness: 0.22, clearcoat: 1.0, side: THREE.DoubleSide }),
  pearl: namedMaterial('paint-pearl-white', { color: 0xf5f1f7, roughness: 0.2, clearcoat: 1.0, sheen: 0.6, sheenColor: 0xe6d8ff }),
  pearl2: namedMaterial('paint-pearl-white', { color: 0xf5f1f7, roughness: 0.2, clearcoat: 1.0, side: THREE.DoubleSide }),
  gold: namedMaterial('metal-gold', { color: 0xd8aa45, roughness: 0.28, metalness: 0.85, clearcoat: 0.6 }),
  gold2: namedMaterial('metal-gold', { color: 0xd8aa45, roughness: 0.28, metalness: 0.85, clearcoat: 0.6, side: THREE.DoubleSide }),
  violet: namedMaterial('paint-deep-violet', { color: 0x3a2560, roughness: 0.3, clearcoat: 0.8 }),
  violet2: namedMaterial('paint-deep-violet', { color: 0x3a2560, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1d1a22, roughness: 0.85, side: THREE.BackSide }),
  // iter-69：切口厚度面改珍珠白（輪拱邊緣和白飾邊連成一圈，不再露出紫色碎邊）
  edge: namedMaterial('shell-edge-pearl', { color: 0xe9e4ee, roughness: 0.4, side: THREE.DoubleSide }),
  recess: namedMaterial('plastic-gill-black', { color: 0x07060a, roughness: 0.9, side: THREE.DoubleSide }),
  recessWall: namedMaterial('paint-deep-violet', { color: 0x3a2560, roughness: 0.4, side: THREE.DoubleSide }),
  lamp: namedMaterial('lamp-amber', { color: 0xffc94a, emissive: 0xff9d00, emissiveIntensity: 0.7, roughness: 0.1, clearcoat: 1.0 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  dGold: decalMaterial('decal-gold', { color: 0xd8aa45, roughness: 0.3, metalness: 0.7 }),
  dViolet: decalMaterial('decal-deep-violet', { color: 0x2e1d4d, roughness: 0.45 }),
  dPearl: decalMaterial('decal-white', { color: 0xf6f3f8, roughness: 0.4 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-inner-dark', { color: 0x1d1a22, roughness: 0.85, side: THREE.DoubleSide }),
});

/**
 * 羽片（側視葉形：根部寬、尖端尖，後緣一個小缺刻）：根點 (x0, y0)，往後上 angDeg、長 len、寬 w
 * @type {(x0: number, y0: number, angDeg: number, len: number, w: number) => number[][]}
 */
const featherOutline = (x0, y0, angDeg, len, w) => {
  const a = (angDeg * Math.PI) / 180;
  // 沿羽軸往後上（−x、+y）的單位向量與法向（指向羽片前上緣）
  const ux = -Math.cos(a);
  const uy = Math.sin(a);
  const nx = Math.sin(a);
  const ny = Math.cos(a);
  /** @type {(s: number, h: number) => number[]} s = 沿羽軸、h = 法向 */
  const at = (s, h) => [x0 + ux * s + nx * h, y0 + uy * s + ny * h];
  return [
    at(0, -w * 0.45),
    at(0, w * 0.45),
    at(len * 0.45, w * 0.55),
    at(len * 0.8, w * 0.32),
    at(len, 0),
    at(len * 0.82, -w * 0.3),
    at(len * 0.66, -w * 0.12),
    at(len * 0.58, -w * 0.42),
    at(len * 0.3, -w * 0.5),
  ];
};

/**
 * 輪拱內襯（沿殼側壁內側裁切）：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3，只取上半圈），
 * 每個角度的 z 範圍 = [側壁內面 − depth, 側壁內面]，不會凸出車身外（gazelle 的 buildArchLiner 是固定 z 範圍，窄鼻處會凸出）
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildClippedLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.3;
  const a1 = Math.PI - 0.3;
  const pos = [];
  /** @type {(t: number) => number} 該角度的側壁內面 z */
  const zIn = (t) => P.hw(arch.x + r * Math.cos(t)) - 1.4;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
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

export const griffinVaneBody = makePolyBody({
  id: 'body-griffin-vane',
  name: '獅鷲羽翼',
  style: 'homage',
  phase: 6,
  homageSeries: 'lg2',
  form: 'high-cowl',
  roof: 'closed',
  wing: 'fender-winglets',
  theme: '高姿態全罩＋四個高聳大輪拱、鷹勾鼻與頸羽脊、珍珠白面罩座艙、後擋泥板頂左右各一組三片羽片小翼（無中央尾翼）',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.4,
  // 平滑剖面，只保留座艙側溝（2）、擋泥板稜線（4）、側壁肩（6）為銳利稜線
  hard: [2, 4, 6],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
  ],
  recesses: [
    // 前輪後方的「羽狀側鰓」：三道往後上斜、由短到長的平行四邊形凹槽（V10）
    // iter-71：三道整體往後移 1.5 mm（第一道原本離前輪拱圓只有 0.6 mm，在輪拱後端露出一顆黑點）
    { id: '羽鰓-1', view: 'side', shape: 'poly', pts: [[18, 15], [20.5, 15], [17, 22.5], [14.5, 22.5]], depth: 1.8 },
    { id: '羽鰓-2', view: 'side', shape: 'poly', pts: [[13, 14], [15.5, 14], [11.5, 24], [9, 24]], depth: 1.8 },
    { id: '羽鰓-3', view: 'side', shape: 'poly', pts: [[8, 13], [10.5, 13], [6, 25.5], [3.5, 25.5]], depth: 1.8 },
  ],
  sideZMin: 36,
  innerSkipRecess: true,
  zones: () => [
    // 金色鳥喙尖（鼻尖 8 mm）
    { mat: 'gold', keep: (x) => x - 71 },
    // 珍珠白面罩座艙（不透明、沒有玻璃）
    { mat: 'pearl', keep: (x, y, z) => (y > 30 ? 1 - faceEll(x, z) : -1) },
    // 珍珠白鷹頭（鼻部到鋸齒羽毛領）
    { mat: 'pearl', keep: (x, y, z) => headKeep(x, z) },
    // 珍珠白下半車身（獅身腹部）：分色線在金色飾帶下方 3.2 mm，跟著飾帶從鼻側上掃到後擋泥板
    // iter-69：輪拱圓外 3 mm 內一律珍珠白（白飾邊和白色下身連成一片，分色線不再從輪拱邊上穿過而破碎）
    { mat: 'pearl', keep: (x, y, z) => (Math.abs(z) > 20 ? Math.max(SASH(x) - 3.2 - y, Math.abs(z) > 22 ? 3 - archRingDist(x, y) : -1) : -1) },
    { mat: 'lavender', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'lavender', recess: 'recess', recessWall: 'recessWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // 頸羽脊（V4 中央隆起的變形）：中線一列 6 片後傾鋸齒，從引擎蓋經面罩到後艙蓋，高 ≤ 3 mm
    /** @type {THREE.BufferGeometry[]} */
    const crest = [];
    for (const xc of [44, 32, 18, 2, -14, -30]) {
      const xf = xc + 4;
      const xr = xc - 4;
      const h = xc > 30 || xc < -20 ? 2.4 : 2.9;
      crest.push(
        finPlate(
          [
            [xf, top(xf, 0) - 0.8],
            [xr + 0.6, top(xr + 0.6, 0) - 0.8],
            [xr - 1.6, top(xr, 0) + h],
            [xc - 1, top(xc, 0) + h * 0.55],
          ],
          0,
          1.1,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(crest), mat: 'gold', solid: true, outline: true, name: 'neck-crest' });

    // 擋泥板羽片小翼（L2-1 外露機能件）：左右後擋泥板頂各四片，往後上扇形展開、往外 32° 傾，兩組不相連、沒有中央主翼
    /** @type {Record<string, THREE.BufferGeometry[]>} */
    const vanes = { pearl: [], violet: [] };
    // iter-69：羽片放大（長 19–22 → 25–29、寬 4.4–4.8 → 6.0–6.4）並加厚（0.9 → 1.0 mm；26 / 31 mm 整車都要 ≤ 135 g，輪拱內襯深度 2.6 → 1.0 mm 抵銷加重），讓「有翼」的意象撐得起來
    const FEATHERS = [
      { x0: -24, ang: 6, len: 25, w: 6.0, mat: 'pearl' },
      { x0: -28.5, ang: 15, len: 28, w: 6.2, mat: 'violet' },
      { x0: -33, ang: 24, len: 29, w: 6.4, mat: 'pearl' },
      { x0: -37.5, ang: 33, len: 27, w: 6.2, mat: 'violet' },
    ];
    for (const sg of [-1, 1]) {
      FEATHERS.forEach((f, i) => {
        const zc = sg * (31 + i * 0.8);
        const y0 = top(f.x0, zc) - 0.7;
        vanes[f.mat].push(finPlate(featherOutline(f.x0, y0, f.ang, f.len, f.w), zc, 1.0, -sg * 32));
      });
    }
    parts.push({ geometry: mergeGeos(vanes.pearl), mat: 'pearl2', solid: true, outline: true, name: 'fender-winglets-pearl' });
    parts.push({ geometry: mergeGeos(vanes.violet), mat: 'violet2', solid: true, outline: true, name: 'fender-winglets-violet' });
    // 羽片根部的金色羽座（可調角度的樞軸蓋）
    /** @type {THREE.BufferGeometry[]} */
    const knuckles = [];
    for (const sg of [-1, 1]) {
      const g = new THREE.SphereGeometry(1, 18, 10);
      g.scale(6.2, 1.7, 2.6);
      g.rotateZ(-0.25);
      g.translate(-34, top(-34, sg * 32.4) + 0.2, sg * 32.4);
      knuckles.push(g);
    }
    parts.push({ geometry: mergeGeos(knuckles), mat: 'gold', solid: true, outline: true, name: 'winglet-knuckles' });

    // 前擋泥板頂面的珍珠白羽紋：三片往後外掠的葉形羽片（和羽片小翼呼應）
    const leaf = (ax, az, bx, bz, w) => {
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const l = Math.hypot(bx - ax, bz - az);
      const nx = (-(bz - az) / l) * (w / 2);
      const nz = ((bx - ax) / l) * (w / 2);
      return sdConvexPolygon([
        [ax, az],
        [mx + nx, mz + nz],
        [bx, bz],
        [mx - nx, mz - nz],
      ]);
    };
    const fenderLeaves = [leaf(50, 31, 33, 43, 4.2), leaf(43, 30, 27, 40.5, 3.8), leaf(36, 29.5, 23, 37, 3.2)];
    parts.push({
      geometry: kit.decal((x, y, z) => (y > 29 ? -Math.min(...fenderLeaves.map((f) => f(x, Math.abs(z)))) : -1)),
      mat: 'dPearl',
      name: 'decal-fender-feathers',
    });
    // 輪拱內襯（前後，31 mm 大輪拱）
    parts.push({
      geometry: mergeGeos([buildClippedLiner({ x: 40, y: 13, radius: 17.5 }, 1.0), buildClippedLiner({ x: -40, y: 13, radius: 17.5 }, 1.0)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 輪拱外緣珍珠白飾邊（強調高聳大輪拱）
    // iter-71：拿掉輪拱白飾邊貼紙——珍珠白塗裝區已涵蓋輪拱圓外 3 mm，同色貼紙疊在漆面上會 z-fighting，形成白紫碎點

    // 兩道平行金色「儀仗飾帶」：從鼻側起，越過前擋泥板上掃，沿腰線到後擋泥板羽座
    const sash = SASH;
    /** @type {(u: number, v: number) => number} u = 往前為正的 x */
    const sashSd = (u, v) => {
      const d1 = Math.abs(v - sash(u)) - 0.45;
      const d2 = Math.abs(v - sash(u) + 2.1) - 0.45;
      // iter-69：飾帶在輪拱白飾邊外 0.8 mm 處乾淨收尾（舊版直接越過輪拱邊，留下金色碎片）
      return Math.max(Math.min(d1, d2), u - 66, -46 - u, 2.6 - archRingDist(u, v));
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sashSd, { x0: 0, y0: 0, zMin: 26, side: 1 })),
        kit.decal(sideDecal((u, v) => sashSd(-u, v), { x0: 0, y0: 0, zMin: 26, side: -1 })),
      ]),
      mat: 'dGold',
      name: 'decal-parade-sash',
    });
    // 面罩分件線（深紫細線）＋兩道後掠的眼縫
    parts.push({ geometry: kit.decal((x, y, z) => (y > 30 ? 0.45 - Math.abs(faceEll(x, z) - 1) * FACE.b : -1)), mat: 'dViolet', name: 'decal-face-seam' });
    const visor = [sdBar(19, 3.2, 11, 10.5, 1.5), sdBar(19, -3.2, 11, -10.5, 1.5)];
    parts.push({ geometry: kit.decal((x, y, z) => (y > 30 ? -Math.min(...visor.map((f) => f(x, z))) : -1)), mat: 'dViolet', name: 'decal-visor-slits' });
    // 號碼板：後擋泥板（獅臀）側面的深紫圓角板＋珍珠白號碼 36
    const plateSd = (u, v) => sdRoundRect(u, v, -7, 7, -4.2, 4.2, 1.6);
    const numSd = sdNumber('36', { h: 5.6, w: 3.0, gap: 0.8 });
    parts.push({
      geometry: kit.decal(sideDecal((u, v) => Math.max(plateSd(u, v), -numSd(u, v)), { x0: -60.5, y0: 26, zMin: 26 }), { offset: 0.1 }),
      mat: 'dViolet',
      name: 'decal-number-plate',
      // iter-71：號碼板墊高到 0.1、號碼 0.15（原本號碼板和肌肉線、飾帶同為 0.06，下緣交疊處 z-fighting 出白紫碎點）
    });
    parts.push({ geometry: kit.decal(sideDecal(numSd, { x0: -60.5, y0: 26, zMin: 26 }), { offset: 0.15 }), mat: 'dPearl', name: 'decal-number' });
    // 鷹勾喙（上喙）：從鼻樑隆起、越過鼻尖往前下勾的金色實心件
    const beakPath = [
      [62, 23.6, 0],
      [70, 23.2, 0],
      [76, 21.2, 0],
      [80, 17.8, 0],
      [82, 14.2, 0],
    ];
    parts.push({
      geometry: smoothNormals(sweepEllipse(beakPath, 40, (t) => [lerp(6.5, 0.7, t ** 0.9), lerp(2.6, 0.7, t)], 20)),
      mat: 'gold',
      solid: true,
      outline: true,
      name: 'hooked-beak',
    });
    // 羽毛領：白色鷹頭後緣的金色鋸齒細線
    parts.push({ geometry: kit.decal((x, y, z) => 0.4 - Math.abs(headKeep(x, z))), mat: 'dGold', name: 'decal-feather-collar' });
    // 鼻樑上的自創羽形符號（V15）：三道往後張開的金色短羽
    const emblem = [sdBar(60, 0, 52, 0, 1.1), sdBar(59, 1, 52.5, 4.5, 0.9), sdBar(59, -1, 52.5, -4.5, 0.9)];
    parts.push({ geometry: kit.decal((x, y, z) => -Math.min(...emblem.map((f) => f(x, z)))), mat: 'dGold', name: 'decal-feather-emblem' });
    // 鷹眼頭燈（V14）：鳥喙兩側一對往後上斜的細長琥珀燈
    const lampSd = sdConvexPolygon([
      [67, 9],
      [63, 15],
      [56, 20.5],
      [60, 13.5],
    ]);
    parts.push({ geometry: kit.decal((x, y, z) => (y > 18 ? -lampSd(x, Math.abs(z)) : -1), { offset: 0.1 }), mat: 'lamp', name: 'lamp-eagle-eyes' });
    // 尾燈：車尾封口上方兩段紅色細帶
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(-69.5 - x, 0.9 - Math.abs(y - 24), Math.abs(z) - 6, 20 - Math.abs(z))),
      mat: 'tail',
      name: 'lamp-tail',
    });
    // 後擋泥板「獅腿」肌肉線（深紫細弧）
    /** @type {(u: number, v: number) => number} */
    const haunch = (u, v) => {
      const yy = 27 + 0.004 * (u + 40) ** 2;
      // iter-71：後端收在 x −51.5（原本 −58 會伸進號碼板，在號碼板前緣露出一小段深紫碎線）
      return Math.max(Math.abs(v - yy) - 0.35, u + 22, -51.5 - u);
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(haunch, { x0: 0, y0: 0, zMin: 40, side: 1 })),
        kit.decal(sideDecal((u, v) => haunch(-u, v), { x0: 0, y0: 0, zMin: 40, side: -1 })),
      ]),
      mat: 'dViolet',
      name: 'decal-haunch-line',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他致敬款）',
    geometry: '本檔站位產生器 P（推估）：長約 141、面罩頂 40、羽片尖約 44.5（HOMAGE_RESEARCH 6-5-2 P1）；前後輪拱 R17.5（31 mm 輪胎半徑 15.5 + 2 mm）＋內襯',
    winglets: '羽片小翼為實心 ABS 件（每側 4 片、厚 0.9 mm），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
