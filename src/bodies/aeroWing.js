// 流線大尾翼款（body-aero-wing）：連續曲面水滴形車身 + 鵝頸支柱高位大尾翼 + 前下擾流板，珍珠白 / 深藏青
// 設計：shared/design/body-aero-wing/DESIGN.md；尺寸資料：data/body-aero-wing.json（複製自 shared/design/body-aero-wing/sections.json）
// 塗裝全為自創：號碼「88」、洋紅→紫漸層弧線、雙 V 形箭頭；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import data from './data/body-aero-wing.json';
import { getPart } from '../parts/index.js';
import { makeLoftKit, cachedBuild, namedMaterial, decalMaterial, buildMountTabs, buildRegion, buildWingParts, buildSplitter, buildTailValance, buildRim, featureSd, lerp, sdNumber, sdConvexPolygon, sdBar, sideDecal, topDecal, mergeGeos, smoothstep } from './loft.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {(x: number) => number} 深藏青下半車身的分色線（中段約側面 1/3、往後升高成楔形，鼻部下半全藏青） */
const navyLine = (x) => 14.2 - 0.07 * x + 7 * smoothstep(28, 58, x) + 6 * smoothstep(-34, -56, x);

/**
 * 前後葉子板隆起：蓋住輪拱切到肩部造成的 V 形缺口，也讓輪廓更有肌肉感
 * @type {(x: number, az: number) => number}
 */
const bump = (x, az) =>
  smoothstep(12, 30, az) * (3.4 * Math.exp(-(((x - 49) / 8) ** 2)) + 2.5 * Math.exp(-(((x - 34) / 7) ** 2)) + 2.0 * Math.exp(-(((x + 40) / 10) ** 2))) +
  // 引擎蓋中央同步抬高 3 mm，葉子板與引擎蓋之間過渡平順（葉子板不會像兩個耳朵）
  3.0 * (1 - smoothstep(10, 26, az)) * Math.exp(-(((x - 44) / 13) ** 2));

/**
 * 本款放樣資料：D1 側導風孔改成有深度的凹腔（黑色腔體＋唇邊），其餘沿用設計資料
 * @type {any}
 */
/**
 * 站位表（推估）：細腰「可樂瓶」平面（兩輪之間半寬收到 28.5）、尾段收窄到 18，俯視輪廓和其他款明顯不同（P20）。
 * 腰部半寬 28.5 仍在電池（|z| ≤ 26.4）外側。
 * @type {any[]}
 */
const AERO_PARAMS = [
  [70, 16, 12, 15.7, 18, 15.5, 15],
  [64, 17.5, 18, 17.5, 27, 16.5, 15],
  [56, 20.5, 24, 21, 33, 18, 15],
  [50, 24, 27, 25, 36, 20, 13],
  [40, 25.5, 30, 31, 38.5, 28.5, 11],
  [30, 26.5, 28, 29.5, 35.5, 25, 9],
  [15, 29, 23, 27.5, 29.5, 22, 9],
  [0, 30.5, 22.5, 27.5, 28.5, 21.5, 9],
  [-15, 30, 23, 28, 29.5, 22, 9],
  [-30, 29, 28, 30, 36, 25, 9],
  [-40, 29, 30, 31.5, 39, 29, 11],
  [-50, 28, 25, 29, 33, 26, 17],
  [-56, 26.5, 17, 26.5, 24, 24, 18],
  [-60, 24.5, 12, 24, 18, 23, 22.5],
].map(([x, yTop, zF, yF, halfW, yShoulder, yLow]) => ({ x, yTop, zF, yF, halfW, yShoulder, yLow }));

/**
 * 控制點 Chaikin 3 次（4 點 → 32 點，點數與拓樸固定，第 i 點在每站對應同一幾何位置）
 * @type {(p: any) => number[][]}
 */
const chaikin = (p) => {
  let pts = [
    [0, p.yTop],
    [p.zF, p.yF],
    [p.halfW, p.yShoulder],
    [p.halfW, p.yLow],
  ];
  for (let it = 0; it < 3; it++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      next.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by], [0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
};

/**
 * 本款放樣資料：細腰站位表；D1 側導風孔改成有深度的凹腔（黑色腔體＋唇邊）；尾翼翼展 52（設計資料為 64；端板外緣 ±27）
 * @type {any}
 */
const AERO_DATA = {
  ...data,
  stationParams: AERO_PARAMS,
  stations: AERO_PARAMS.map((p) => ({ x: p.x, halfProfile: chaikin(p) })),
  openings: [],
  // D1 側導風孔往前移到 x −22 ~ −8（細腰後，原位置的凹腔底會太靠近後輪）
  recesses: data.openings.map((o) => ({ ...o, x: [-22, -8], depth: 2.5 })),
  // 端板比設計資料大：高 13.5、厚 1.2、下緣 35.5（長度維持 16，不影響俯視輪廓）
  wing: { ...data.wing, span: 52, endplate: { ...data.wing.endplate, height: 13.5, thickness: 1.2, yBottom: 35.5 } },
};

/** @type {number} 賽車條紋半寬（鼻尖 → 引擎蓋 → 尾甲板 → 尾翼中央的深藍寬條紋，寬 11 mm） */
const STRIPE_HALF = 5.5;
/** @type {number[]} 條紋兩側洋紅細線的 |z| 範圍（0.8 mm） */
const STRIPE_PIN = [6.2, 7.0];

/**
 * 翼面上表面的翼型曲線（與 loft.js buildWingParts 同一組 NACA 公式，只取上表面），由前緣到後緣
 * @type {(wing: any) => number[][]}
 */
const wingUpper = (wing) => {
  const chord = Math.abs(wing.xLE - wing.xTE);
  const aoa = (wing.aoa_deg * Math.PI) / 180;
  const tr = wing.thickness / chord;
  const yChordLE = wing.yLower + wing.thickness / 2;
  const pts = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const xi = (1 - Math.cos((Math.PI * i) / N)) / 2;
    const yt = 5 * tr * chord * (0.2969 * Math.sqrt(xi) - 0.126 * xi - 0.3516 * xi * xi + 0.2843 * xi ** 3 - 0.1036 * xi ** 4);
    const c = xi * chord;
    const camber = 0.35 * Math.sin(Math.PI * xi);
    const px = wing.xLE - c * Math.cos(aoa);
    const py = yChordLE + c * Math.sin(aoa);
    pts.push([px - (camber + yt) * Math.sin(aoa), py + (camber + yt) * Math.cos(aoa)]);
  }
  return pts;
};

/**
 * 翼面上表面的貼紙帶：沿上表面翼型曲線、z 從 z0 到 z1 的薄帶，往外法線偏移 0.06 mm（貼紙，不進碰撞）
 * @type {(wing: any, z0: number, z1: number) => THREE.BufferGeometry}
 */
const wingBand = (wing, z0, z1) => {
  const up = wingUpper(wing);
  const pos = [];
  for (let i = 0; i < up.length - 1; i++) {
    const [ax, ay] = up[i];
    const [bx, by] = up[i + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    // 上表面由前緣往後（x 遞減），外法線 = 切線轉 90°（朝上）
    const nx = (by - ay) / len;
    const ny = -(bx - ax) / len;
    const o = 0.06;
    const a = [ax + nx * o, ay + Math.abs(ny) * o];
    const b = [bx + nx * o, by + Math.abs(ny) * o];
    // 繞向：法線朝上（外側）
    pos.push(a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1, a[0], a[1], z0, b[0], b[1], z1, a[0], a[1], z1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 鵝頸刀片立柱：沿 loft.js 同一條鵝頸中心線、在 x–y 平面往兩側偏移成
 * 根部 5 mm、頂端 3 mm 寬的刀片輪廓，再沿 z 擠出 1.6 mm（loft.js 的 1 × 1.8–2.5 mm 細桿看起來像衣架）；封閉實體，面數也比 64 段掃掠少
 * @type {(stays: any) => THREE.BufferGeometry}
 */
const buildBladeStays = (st) => {
  const [bx, by] = st.base;
  const [tx, ty] = st.top;
  const ctrl = [
    new THREE.Vector3(bx, by - 0.6, 0),
    new THREE.Vector3(bx - 0.4, by + 7, 0),
    new THREE.Vector3(bx - 1.4, ty - 1.0, 0),
    new THREE.Vector3(bx - 3.0, ty + 2.6, 0),
    new THREE.Vector3(bx - 6.5, ty + 3.6, 0),
    new THREE.Vector3(tx + 2.2, ty + 2.8, 0),
    new THREE.Vector3(tx + 0.4, ty + 1.2, 0),
    new THREE.Vector3(tx, ty - 0.2, 0),
  ];
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const n = 20;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const h = lerp(2.5, 1.5, t);
    left.push(new THREE.Vector2(p.x - tg.y * h, p.y + tg.x * h));
    right.push(new THREE.Vector2(p.x + tg.y * h, p.y - tg.x * h));
  }
  const shape = new THREE.Shape([...left, ...right.reverse()]);
  const thick = 1.6;
  const geos = [-st.z, st.z].map((zc) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, zc - thick / 2);
    return g;
  });
  return mergeGeos(geos);
};


/** @type {THREE.Color} */
const MAGENTA = new THREE.Color(0xe6007e);
/** @type {THREE.Color} */
const PURPLE = new THREE.Color(0x6a2bd9);

/** @type {(x: number) => number[]} 漸層顏色（線性色彩空間）：前洋紅 → 後紫 */
const gradient = (x) => {
  const t = Math.min(1, Math.max(0, (58 - x) / 114));
  const c = MAGENTA.clone().lerp(PURPLE, t);
  return [c.r, c.g, c.b];
};

/**
 * 把 z 方向跨距過大的三角形沿最長邊對半細分，直到每個三角形的 z 跨距 ≤ maxDz（法線一起內插）
 * @type {(g: THREE.BufferGeometry, maxDz: number) => THREE.BufferGeometry}
 */
const splitAlongZ = (g, maxDz) => {
  const P = g.attributes.position.array;
  const N = g.attributes.normal.array;
  /** @type {number[]} */
  const pos = [];
  /** @type {number[]} */
  const nrm = [];
  /** @type {(t: number[][]) => void} t = [[px,py,pz,nx,ny,nz] × 3] */
  const rec = (t) => {
    const zs = t.map((v) => v[2]);
    if (Math.max(...zs) - Math.min(...zs) <= maxDz) {
      for (const v of t) {
        pos.push(v[0], v[1], v[2]);
        nrm.push(v[3], v[4], v[5]);
      }
      return;
    }
    let best = 0;
    let bl = -1;
    for (let e = 0; e < 3; e++) {
      const a = t[e];
      const b = t[(e + 1) % 3];
      const l = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (l > bl) {
        bl = l;
        best = e;
      }
    }
    const a = t[best];
    const b = t[(best + 1) % 3];
    const c = t[(best + 2) % 3];
    const m = a.map((v, i) => (v + b[i]) / 2);
    rec([a, m, c]);
    rec([m, b, c]);
  };
  for (let i = 0; i < P.length; i += 9) {
    const t = [0, 1, 2].map((k) => [P[i + 3 * k], P[i + 3 * k + 1], P[i + 3 * k + 2], N[i + 3 * k], N[i + 3 * k + 1], N[i + 3 * k + 2]]);
    rec(t);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return out;
};

/** @type {() => Record<string, THREE.Material>} */
const makeMaterials = () => ({
  pearl: namedMaterial('paint-pearl-white', { color: 0xf2f0ec, roughness: 0.2, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05, sheen: 0.3, sheenColor: 0xd8d0ff, sheenRoughness: 0.4 }),
  navy: namedMaterial('paint-navy-metallic', { color: 0x1b2a5c, roughness: 0.3, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  navy2: namedMaterial('paint-navy-metallic', { color: 0x1b2a5c, roughness: 0.3, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  edge: namedMaterial('shell-edge-white', { color: 0xd9d6cf, roughness: 0.5, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x202227, roughness: 0.85, side: THREE.BackSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  glass: namedMaterial('pc-smoke-navy', { color: 0x101828, roughness: 0.04, clearcoat: 1.0, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
  grad: decalMaterial('decal-gradient-magenta-purple', { vertexColors: true, roughness: 0.3, clearcoat: 0.8 }),
  purple: decalMaterial('decal-purple', { color: 0x6a2bd9, roughness: 0.35, clearcoat: 0.6 }),
  wingGrad: namedMaterial('paint-gradient-wing', { vertexColors: true, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  magenta: decalMaterial('decal-magenta', { color: 0xe6007e, roughness: 0.35, clearcoat: 0.6 }),
  // 深藍賽車條紋（貼紙）、條紋上的珍珠白號碼、洋紅亮面端板
  stripe: decalMaterial('decal-stripe-deep-blue', { color: 0x14215e, roughness: 0.25, clearcoat: 0.9 }),
  pearlDecal: decalMaterial('decal-pearl-white', { color: 0xf2f0ec, roughness: 0.3, clearcoat: 0.6 }),
  magentaPaint: namedMaterial('paint-magenta-gloss', { color: 0xd4006f, roughness: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.04, side: THREE.DoubleSide }),
  number: decalMaterial('decal-navy', { color: 0x1b2a5c, roughness: 0.5 }),
  lamp: decalMaterial('lamp-clear', { color: 0xe8f4ff, emissive: 0x9fc8ff, emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1.0 }),
  tail: decalMaterial('lamp-red', { color: 0xc4121c, emissive: 0x7a0008, emissiveIntensity: 0.4, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  vent: namedMaterial('trim-intake-black', { color: 0x121316, roughness: 0.85, side: THREE.DoubleSide }),
});

/** @type {() => BodyPart[]} */
const compose = () => {
  const kit = makeLoftKit(AERO_DATA, { mode: 'smooth', sideZMin: 26, bump, tuck: 0.6 });
  /** @type {BodyPart[]} */
  const parts = [];
  /** @type {KeepFn} */
  const cab = (x, y, z) => kit.underCanopy(x, z);
  /** @type {KeepFn} */
  const notCab = (x, y, z) => -kit.underCanopy(x, z);

  parts.push({ geometry: kit.outer([notCab, (x, y) => y - navyLine(x)]), mat: 'pearl', shell: true, name: 'shell-main' });
  parts.push({ geometry: kit.outer([notCab, (x, y) => navyLine(x) - y]), mat: 'navy', shell: true, name: 'shell-lower' });
  parts.push({ geometry: kit.outer([cab]), mat: 'cockpit', shell: true, name: 'shell-cockpit' });

  const st = kit.structure();
  // D1 側導風孔凹腔：黑色腔底與腔壁＋高出殼面 0.3 mm 的藏青唇邊
  st.recessFloor.forEach((g, i) => parts.push({ geometry: g, mat: 'vent', shell: true, name: `vent-floor-${i}` }));
  st.recessWall.forEach((g, i) => parts.push({ geometry: g, mat: 'vent', shell: true, name: `vent-wall-${i}` }));
  const ventSd = featureSd(AERO_DATA.recesses[0], 26);
  const lip = buildRegion(kit.surf, [...kit.holes, (x, y, z) => ventSd(x, y, z), (x, y, z) => 0.9 - ventSd(x, y, z)], { offset: 0.3, smoothOffset: true });
  parts.push({ geometry: lip.geometry, mat: 'navy', name: 'vent-lip' });
  parts.push({ geometry: buildRim(lip, 0, 0.3), mat: 'navy2', name: 'vent-lip-wall' });
  parts.push({ geometry: st.inner, mat: 'inner', name: 'shell-inner' });
  parts.push({ geometry: st.rim, mat: 'edge', name: 'shell-edge' });
  parts.push({ geometry: mergeGeos([st.capFront, st.capRear]), mat: 'navy', shell: true, name: 'caps' });
  parts.push({ geometry: mergeGeos([st.capFrontIn, st.capRearIn]), mat: 'inner', name: 'cap-inner' });

  // 水滴座艙罩：深藍煙燻玻璃 + 珍珠白窗框
  parts.push({ geometry: buildRegion(kit.canopy, [(x, y, z, s) => Math.abs(s) - 0.86]).geometry, mat: 'pearl', shell: true, name: 'canopy-frame' });
  parts.push({ geometry: buildRegion(kit.canopy, [(x, y, z, s) => 0.86 - Math.abs(s)]).geometry, mat: 'glass', shell: true, renderOrder: 2, name: 'canopy-glass' });

  // 尾翼、端板、鵝頸支柱、splitter（實心件；質量以表面積 × 壁厚近似，標 shell）
  const w = buildWingParts(AERO_DATA.wing);
  // 尾翼漸層塗裝——中央珍珠白，往兩端漸變成紫、翼端洋紅（頂點色）
  // 翼面側面三角形只在兩端有頂點，先沿 z 細分（每段 ≤ 2 mm）才能畫出漸層
  const wingGeo = splitAlongZ(w.wing.index ? w.wing.toNonIndexed() : w.wing, 2);
  {
    const half = AERO_DATA.wing.span / 2;
    const pos = wingGeo.attributes.position;
    const col = [];
    const pearl = new THREE.Color(0xf2f0ec);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.abs(pos.getZ(i)) / half);
      if (t < 0.3) {
        c.copy(pearl);
      } else if (t < 0.68) {
        c.copy(pearl).lerp(PURPLE, smoothstep(0.3, 0.68, t));
      } else {
        c.copy(PURPLE).lerp(MAGENTA, smoothstep(0.68, 1, t));
      }
      col.push(c.r, c.g, c.b);
    }
    wingGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  parts.push({ geometry: wingGeo, mat: 'wingGrad', solid: true, outline: true, name: 'wing' });
  // 端板用洋紅亮面（本款第三色）：不漆黑，因為白底＋藍＋黑是 HOMAGE_RESEARCH 第 3 節 B 的 Shining Scorpion 配色黑名單
  parts.push({ geometry: w.endplates, mat: 'magentaPaint', solid: true, outline: true, name: 'wing-endplates' });
  // 端板細節：外側面兩道斜切色條（洋紅端板上，色條是深藍上、紫下）
  {
    const zOut = AERO_DATA.wing.span / 2 + AERO_DATA.wing.endplate.thickness + 0.08;
    const stripes = [];
    const stripes2 = [];
    for (const sg of [-1, 1]) {
      const a = new THREE.BoxGeometry(10.5, 0.9, 0.12);
      a.rotateZ(0.12);
      a.translate(-59.5, 46.6, sg * zOut);
      stripes.push(a);
      const b = new THREE.BoxGeometry(8.5, 0.7, 0.12);
      b.rotateZ(0.12);
      b.translate(-60.5, 44.9, sg * zOut);
      stripes2.push(b);
    }
    parts.push({ geometry: mergeGeos(stripes), mat: 'stripe', name: 'endplate-stripe-blue' });
    parts.push({ geometry: mergeGeos(stripes2), mat: 'purple', name: 'endplate-stripe-purple' });
  }
  // 鵝頸支柱用本檔的刀片立柱（封閉擠出體，實心件），不用 loft.js 的細桿 w.stays
  parts.push({ geometry: buildBladeStays(AERO_DATA.wing.stays), mat: 'navy2', solid: true, outline: true, name: 'wing-stays' });
  // 尾翼中央的深藍條紋與兩側洋紅細線（翼面上表面貼紙帶，接續車身條紋）
  parts.push({ geometry: wingBand(AERO_DATA.wing, -STRIPE_HALF, STRIPE_HALF), mat: 'stripe', name: 'decal-wing-stripe' });
  parts.push({
    geometry: mergeGeos([wingBand(AERO_DATA.wing, STRIPE_PIN[0], STRIPE_PIN[1]), wingBand(AERO_DATA.wing, -STRIPE_PIN[1], -STRIPE_PIN[0])]),
    mat: 'magenta',
    name: 'decal-wing-stripe-pin',
  });
  // 寬大 splitter（概念圖）：往前伸到 x 74.5、厚 1.4 mm，前 3/4 看得到（仍在導輪 x 78 / 規則外框內）
  // 半寬 33.5（比 wedge 鼻下板更寬，俯視輪廓和 wedge 拉開）；外緣離前導輪（中心 (71.5, ±42)、半徑 6.5）≥ 2.8 mm
  parts.push({ geometry: buildSplitter({ ...data.splitter, x: [56, 74.5], halfW: 33.5, thickness: 1.4, yBottom: 14.6 }), mat: 'navy', solid: true, outline: true, name: 'splitter' });
  // splitter 兩端的直立擋板（端板）與前緣洋紅色線
  {
    const fences = [];
    for (const sg of [-1, 1]) {
      const shape = new THREE.Shape([new THREE.Vector2(58, 16), new THREE.Vector2(72.5, 16), new THREE.Vector2(71, 18.6), new THREE.Vector2(58, 19.6)]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false });
      g.translate(0, 0, sg * 32.8 - 0.4);
      fences.push(g);
    }
    parts.push({ geometry: mergeGeos(fences), mat: 'navy2', outline: true, solid: true, name: 'splitter-fences' });
    const edge = new THREE.BoxGeometry(0.5, 0.5, 46);
    edge.translate(73.6, 15.9, 0);
    parts.push({ geometry: edge, mat: 'magenta', name: 'splitter-edge' });
  }
  // 尾部裙板：尾段下緣往下延伸到 y 17.6（後導輪架最高約 16.8），封住從後方看進去的底盤
  parts.push({ geometry: buildTailValance(kit.surf, { xFrom: -55.5, yBottom: 17.6 }), mat: 'navy2', shell: true, name: 'tail-valance' });

  // ---- 貼紙 ----
  // 洋紅 → 紫漸層弧線：前輪拱後方往後上掃到後葉子板，再沿後葉子板頂面往尾部
  // 一條連續的長弧線（側視 Catmull-Rom 中心線＋新月形寬度），從前輪拱後方一路掃到後葉子板頂、收尾在尾部
  const arc = new THREE.CatmullRomCurve3(
    [
      [6.5, 15.4],
      [-4, 17.8],
      [-14, 22.0],
      [-24, 26.5],
      [-34, 30.2],
      [-44, 31.4],
      [-55, 28.6],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false,
    'centripetal',
  );
  /** @type {number[][]} 中心線取樣 [x, y]（x 遞減） */
  const arcPts = arc.getSpacedPoints(160).map((p) => [p.x, p.y]);
  /** @type {(x: number) => number} 中心線在 x 的高度 */
  const arcY = (x) => {
    for (let i = 0; i < arcPts.length - 1; i++) {
      const [xa, ya] = arcPts[i];
      const [xb, yb] = arcPts[i + 1];
      if (x <= xa && x >= xb) {
        return lerp(ya, yb, (xa - x) / (xa - xb));
      }
    }
    return NaN;
  };
  /** @type {(x: number) => number} 新月形寬度：前尖、中段最寬 3.6、尾端收細 */
  const arcW = (x) => {
    const t = (6.5 - x) / 61.5;
    return 0.5 + 3.6 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)) ** 0.8);
  };
  /** @type {KeepFn} */
  const swoosh = (x, y, z) => {
    // 只投影在側面與肩部外側（|z| 超過最寬處 − 6），避免弧線掉到尾甲板頂面變成色塊
    if (x > 6.5 || x < -55 || Math.abs(z) < kit.surf.ctrl(x).halfW - 6) {
      return -1;
    }
    return arcW(x) / 2 - Math.abs(y - arcY(x));
  };
  // 引擎蓋兩側的漸層弧線（鼻部 → 座艙前）
  const hoodBar = sdBar(57, 19.5, 27, 23.2, 2.2);
  parts.push({
    geometry: mergeGeos([kit.decal(swoosh, { color: gradient }), kit.decal((x, y, z) => (y < 19 ? -1 : -hoodBar(x, Math.abs(z))), { color: gradient })]),
    mat: 'grad',
    name: 'decal-swoosh',
  });

  // 從鼻尖貫穿到尾翼的賽車條紋：中線寬 11 mm 深藍條紋＋兩側 0.8 mm 洋紅細線，
  // 鼻尖 → 引擎蓋 → （深藍煙燻座艙罩接續）→ 尾甲板 → 尾翼中央
  /** @type {(x: number, z: number) => number} 座艙罩外圍 0.6 mm 以外（> 0）；座艙罩 x 範圍以外 halfW = 0，直接回傳 1（不然中線 |z| < 0.4 會被挖掉） */
  const outsideCab = (x, z) => (kit.underCanopy(x, 0) + 0.2 <= 0 ? 1 : -kit.underCanopy(x, z) - 0.6);
  /** @type {KeepFn} */
  const stripeKeep = (x, y, z) => Math.min(STRIPE_HALF - Math.abs(z), outsideCab(x, z), y - 15.5);
  /** @type {KeepFn} */
  const pinKeep = (x, y, z) => Math.min(Math.abs(z) - STRIPE_PIN[0], STRIPE_PIN[1] - Math.abs(z), outsideCab(x, z), y - 15.5);
  parts.push({ geometry: kit.decal(stripeKeep), mat: 'stripe', name: 'decal-racing-stripe' });
  parts.push({ geometry: kit.decal(pinKeep), mat: 'magenta', name: 'decal-racing-stripe-pin' });

  // 號碼 88：鼻部（落在深藍條紋上，用珍珠白字）、兩側（深藏青）
  parts.push({
    geometry: kit.decal(topDecal(sdNumber('88', { h: 5.4, w: 3.1, gap: 0.8 }), { x0: 56.8, yMin: 18 }), { offset: 0.12 }),
    mat: 'pearlDecal',
    name: 'decal-number-top',
  });
  parts.push({
    geometry: kit.decal(sideDecal(sdNumber('88', { h: 6.8, w: 3.9, gap: 1.0 }), { x0: 12.5, y0: 16.9, zMin: 26 })),
    mat: 'number',
    name: 'decal-number',
  });

  // 頭燈（鼻部兩側斜切細燈）、尾燈（尾甲板末端）
  const head = sdConvexPolygon([
    [65.5, 15.5],
    [63, 15.5],
    [57.5, 27],
    [59.6, 27.5],
  ]);
  parts.push({ geometry: kit.decal((x, y, z) => -head(x, Math.abs(z)), { offset: 0.08 }), mat: 'lamp', name: 'lamp-head' });
  const tail = sdConvexPolygon([
    [-57.2, 11],
    [-59.6, 11],
    [-59.6, 22],
    [-57.2, 21],
  ]);
  parts.push({ geometry: kit.decal((x, y, z) => (y < 20 ? -1 : -tail(x, Math.abs(z))), { offset: 0.08 }), mat: 'tail', name: 'lamp-tail' });

  parts.push({ geometry: buildMountTabs(MOUNTS, (x) => kit.innerYAt(x)), mat: 'mount', solid: true, name: 'mount-tabs' });
  return parts;
};

/** @type {{ id: string, x: number, y: number, z: number }[]} */
const MOUNTS = getPart('chassis-midship').bodyMounts.map((m) => ({ ...m }));

/** @type {BodyDef} */
export const aeroWingBody = {
  id: 'body-aero-wing',
  category: 'body',
  style: 'race',
  // 比賽型分類（shared/reference/BODY_RACE_RESEARCH.md）
  raceType: 'big-wing',
  form: 'teardrop',
  roof: 'canopy',
  wing: 'high-wing',
  theme: '大尾翼下壓力殼：水滴座艙、鵝頸支柱高位尾翼、前分流板',
  name: '流線大尾翼款',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: data.wallThickness_mm,
  mounts: MOUNTS.map((m) => ({ ...m })),
  build: cachedBuild(compose, makeMaterials),
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: 'shared/design/body-aero-wing/DESIGN.md §5：射出 ABS 殼常見 0.8–1.2 mm，取 0.8（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
    geometry: 'shared/design/body-aero-wing/sections.json（複製到 src/bodies/data/body-aero-wing.json）',
    wing: '尾翼 / 端板 / 支柱 / splitter 是實心件，質量以「表面積 × 殼壁厚 × 密度」近似（DESIGN.md §5 估實心體積約 2.6 g，表面積法約 2.5–3 g，量級一致）',
  },
};
