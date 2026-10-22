// 箭毒蛙（body-dartfrog-hop，第四階段致敬《爆走兄弟》風格）：前低後高的蹲伏楔形——寬而低的圓鼻、鼓成「後腿肌肉」的後輪拱、
// 封閉車頂上一對半球形眼泡、車尾低位扇形蹼翼（4 根放射肋、肋間凹弧）。
// 設計：shared/design/body-dartfrog-hop/DESIGN.md（致敬語彙、和劇中車 / 市售車殼的差異）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：檸檬黃＋黑＋土耳其藍、大小不一的黑圓斑、號碼「13」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sdConvexPolygon, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations, sdCircle, smoothMax, fenderFloor, buildArchLiner, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前） */
const XS = [-58, -50, -40, -30, -18, -4, 10, 24, 34, 40, 48, 56, 62, 66];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：前低後高的蹲伏楔形（鼻 15 → 尾 33）
  yC: monoCurve(XS, [27, 32.5, 33.5, 33.2, 32, 30, 28, 25.5, 23.5, 22.5, 21, 19, 17, 15]),
  // 擋泥板稜線：後腿肌肉（40）明顯高於前輪拱（32）
  yF: monoCurve(XS, [29.5, 38.5, 40, 38.5, 33.5, 30, 29, 30, 31.8, 32.2, 31, 26, 21, 17]),
  // 半寬：寬圓鼻、腰部略收、後腿外鼓（46.5）
  hw: monoCurve(XS, [40.5, 46, 46.5, 46, 41, 32.5, 31.5, 34.5, 38.5, 39.5, 40.5, 40, 38, 34]),
  // 側壁下緣
  yLow: monoCurve(XS, [21, 16, 12, 11, 13, 17.5, 17.5, 15, 11, 12, 13.5, 14, 14, 14]),
};

/**
 * 半剖面 8 點：中線頂 → 中線肩 → 中央低谷 → 擋泥板內坡頂（沿輪拱圓柱抬高）→ 擋泥板稜線 → 外側圓肩 → 側壁肩 → 側壁下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const hw = P.hw(x);
  const k = Math.min(1, (hw - 2.4) / 34);
  const yF0 = P.yF(x);
  // iter-55：擋泥板內坡改用平滑拋物線＋平滑最大值（原本圓弧＋Math.max 在站位間留下折痕，車頂像融化的表皮）
  const yValley0 = Math.min(yC - 1.2, yF0 - 1.5);
  const yValley = smoothMax(yValley0, Math.min(fenderFloor(x), yF0 - 0.8), 1.5);
  const yF = smoothMax(yF0, yValley + 1, 1);
  const zF = Math.min(32 * k, hw - 4);
  const yShoulder = yF - 5.5 - 0.5 * Math.max(0, hw - zF - 8);
  const yLow = Math.min(P.yLow(x), yShoulder - 1);
  return [
    [0, yC],
    [7 * k, yC - 0.35],
    [13 * k, yValley0],
    [21 * k, yValley],
    [zF, yF],
    [Math.max(zF + 0.4, hw - 3), yF - 2.6],
    [hw, yShoulder],
    [hw, yLow],
  ];
};

const STATIONS = buildStations(-58, 66, 2, profile);

/** 眼泡位置（x、|z|、底座高度由殼面決定） */
const EYE = { x: 14, z: 13, r: 6 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  yellow: namedMaterial('paint-lemon-yellow', { color: 0xffe600, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  yellow2: namedMaterial('paint-lemon-yellow', { color: 0xffe600, roughness: 0.2, clearcoat: 1.0, side: THREE.DoubleSide }),
  black: namedMaterial('paint-gloss-black', { color: 0x121316, roughness: 0.28, clearcoat: 0.9 }),
  black2: namedMaterial('paint-gloss-black', { color: 0x121316, roughness: 0.28, clearcoat: 0.9, side: THREE.DoubleSide }),
  turq: namedMaterial('paint-turquoise', { color: 0x12b3b0, roughness: 0.22, clearcoat: 1.0 }),
  turq2: namedMaterial('paint-turquoise', { color: 0x12b3b0, roughness: 0.22, clearcoat: 1.0, side: THREE.DoubleSide }),
  // 眼泡：深煙燻透明圓頂（不透明度高，看起來是有色的「眼」，V5 的變形）
  // 球眼：不透明黑色亮面漆（iter-55：原本煙燻透明，在 Blender 裡讀成透明小罩）
  eyeBall: namedMaterial('paint-gloss-black-eye', { color: 0x0a0b0d, roughness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.02 }),
  liner: namedMaterial('shell-inner-dark', { color: 0x1c1b14, roughness: 0.85, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1b14, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-yellow', { color: 0xb89400, roughness: 0.5, side: THREE.DoubleSide }),
  recess: namedMaterial('plastic-gill-black', { color: 0x050505, roughness: 0.9, side: THREE.DoubleSide }),
  recessWall: namedMaterial('paint-turquoise', { color: 0x12b3b0, roughness: 0.3, side: THREE.DoubleSide }),
  lamp: namedMaterial('lamp-ice', { color: 0xd8fbff, emissive: 0x6fe0ff, emissiveIntensity: 0.6, roughness: 0.08, clearcoat: 1.0 }),
  dBlack: decalMaterial('decal-black', { color: 0x111214, roughness: 0.45 }),
  dTurq: decalMaterial('decal-turquoise', { color: 0x12b3b0, roughness: 0.35 }),
  dWhite: decalMaterial('decal-white', { color: 0xf6f4ee, roughness: 0.4 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** 蹼翼：翼根在車尾中線（x −44、殼面上 1 mm），4 根肋往後外放射，翼面往後上仰 */
const FAN = { hubX: -45, tilt: 0.4, ribs: [-27, -9.5, 9.5, 27], tipX: -71 };

/**
 * 扇形蹼翼的翼面（俯視多邊形：肋尖之間是往內凹的弧，像張開的蹼），以翼根為支點往後上仰
 * @type {(hubY: number) => THREE.BufferGeometry}
 */
const buildWebMembrane = (hubY) => {
  const shape = new THREE.Shape();
  const tips = FAN.ribs.map((z) => [FAN.tipX + 0.06 * Math.abs(z) * 2, z]);
  shape.moveTo(FAN.hubX + 1, -3);
  shape.lineTo(tips[0][0], tips[0][1]);
  for (let i = 0; i < tips.length - 1; i++) {
    const [x0, z0] = tips[i];
    const [x1, z1] = tips[i + 1];
    // 凹弧：控制點往前（+x）內收 6 mm
    shape.quadraticCurveTo((x0 + x1) / 2 + 6, (z0 + z1) / 2, x1, z1);
  }
  shape.lineTo(FAN.hubX + 1, 3);
  shape.lineTo(FAN.hubX + 1, -3);
  // shape 的 (x, y) = 俯視 (x, z)；擠出方向 = 厚度
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false, curveSegments: 16 });
  // (x, y, z) → (x, z, y)：擠出方向轉成 +y
  g.rotateX(-Math.PI / 2);
  g.translate(0, hubY + 0.9, 0);
  g.translate(-FAN.hubX, -hubY, 0);
  g.rotateZ(-FAN.tilt);
  g.translate(FAN.hubX, hubY, 0);
  return g;
};

/**
 * 蹼翼的 4 根放射肋（黑色掃掠管，根粗尖細）
 * @type {(hubY: number) => THREE.BufferGeometry}
 */
const buildWebRibs = (hubY) => {
  const c = Math.cos(FAN.tilt);
  const s = Math.sin(FAN.tilt);
  /** @type {(x: number, y: number, z: number) => number[]} 以翼根為支點往後上仰 */
  const rot = (x, y, z) => {
    const dx = x - FAN.hubX;
    const dy = y - hubY;
    return [FAN.hubX + dx * c + dy * s, hubY - dx * s + dy * c, z];
  };
  return mergeGeos(
    FAN.ribs.map((z) => {
      const tipX = FAN.tipX + 0.06 * Math.abs(z) * 2 - 1.2;
      const pts = [0, 0.33, 0.66, 1].map((t) => rot(lerp(FAN.hubX + 1, tipX, t), hubY + 1.4, lerp(0, z * 1.04, t)));
      return sweepEllipse(pts, 20, (t) => [lerp(1.7, 0.6, t), lerp(1.7, 0.6, t)], 14);
    }),
  );
};

/**
 * 頂面黑圓斑（x、|z|、半徑）：以固定種子的偽亂數撒點（大小 1.2–3.8 mm，彼此不重疊、避開眼泡與蹼翼翼根），左右各一組不同的點
 * @type {(seed: number) => [number, number, number][]}
 */
const makeSpots = (seed) => {
  let st = seed;
  /** @type {() => number} */
  const rnd = () => {
    st = (st * 16807) % 2147483647;
    return st / 2147483647;
  };
  /** @type {[number, number, number][]} */
  const out = [];
  for (let tries = 0; tries < 400 && out.length < 26; tries++) {
    const x = lerp(-56, 62, rnd());
    const z = lerp(2, 44, rnd());
    const r = lerp(1.2, 3.8, rnd() ** 1.6);
    if (Math.hypot(x - EYE.x, z - EYE.z) < EYE.r + 3 + r || (x < -38 && z < 10)) {
      continue;
    }
    if (out.some(([x2, z2, r2]) => Math.hypot(x - x2, z - z2) < r + r2 + 2.2)) {
      continue;
    }
    out.push([x, z, r]);
  }
  return out;
};
const SPOTS_L = makeSpots(12345);
const SPOTS_R = makeSpots(67891);

export const dartfrogHopBody = makePolyBody({
  id: 'body-dartfrog-hop',
  name: '箭毒蛙',
  style: 'homage',
  phase: 4,
  roof: 'closed',
  wing: 'web-fan',
  theme: '前低後高的蹲伏楔形：寬低圓鼻、後腿肌肉般的後輪拱、車頂一對半球眼泡、車尾低位扇形蹼翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.6,
  // 平滑剖面：擋泥板稜線（4）與側壁肩（6）是銳利稜線
  hard: [4, 6],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
  ],
  recesses: [
    // 眼泡前方的導流槽（V10）：往外後斜的細長槽
    { id: '眼下導流槽', view: 'top', shape: 'poly', pts: [[26, 7], [27.5, 9], [21.5, 19], [19.5, 18]], depth: 1.6 },
    // 後腿前緣的側面進氣口
    { id: '後腿進氣口', view: 'side', shape: 'poly', pts: [[-14, 13], [-10.5, 13], [-16, 24], [-19.5, 24]], depth: 2.4 },
  ],
  sideZMin: 34,
  innerSkipRecess: true,
  zones: () => [
    // 土耳其藍腹部：側壁下段，前低後高
    { mat: 'turq', keep: (x, y, z) => (Math.abs(z) > 30 ? 15.2 + 0.035 * (-x) - y : -1) },
    // 鼻部黑色「嘴唇」刃（鼻尖往後 7 mm 的下半）
    { mat: 'black', keep: (x, y) => Math.min(x - 59, 17.5 - y + 0.5 * (x - 59)) },
    { mat: 'yellow', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'turq', recess: 'recess', recessWall: 'recessWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    const topAt = (x, z) => kit.surf.topY(x, z);
    // 眼泡（iter-55 放大）：黃色扁座（半埋）＋ 土耳其藍環 ＋ 黑色亮面球眼（直徑 12 mm，中空件以殼面積 × 壁厚算質量）
    const bases = [];
    const rings = [];
    const balls = [];
    for (const sg of [-1, 1]) {
      const yb = topAt(EYE.x, EYE.z);
      const base = new THREE.SphereGeometry(1, 28, 12);
      base.scale(EYE.r + 1.2, 1.5, EYE.r + 1.2);
      base.translate(EYE.x, yb + 1.3, sg * EYE.z);
      bases.push(base);
      const ring = new THREE.TorusGeometry(EYE.r + 0.2, 0.9, 10, 40);
      ring.rotateX(Math.PI / 2);
      ring.translate(EYE.x, yb + 2.6, sg * EYE.z);
      rings.push(ring);
      // 球眼：球心在環面上方 0.9 mm，下緣 35% 藏進座裡（開口朝下的球冠）
      const ball = new THREE.SphereGeometry(EYE.r, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.68);
      ball.translate(EYE.x, yb + 3.5, sg * EYE.z);
      balls.push(ball);
    }
    parts.push({ geometry: mergeGeos(bases), mat: 'yellow', solid: true, outline: true, name: 'eye-bases' });
    parts.push({ geometry: mergeGeos(rings), mat: 'turq', solid: true, name: 'eye-rings' });
    parts.push({ geometry: mergeGeos(balls), mat: 'eyeBall', shell: true, name: 'eye-balls' });
    // 前輪拱內襯（iter-55）
    parts.push({ geometry: buildArchLiner({ x: 40, y: 13, radius: 17.5 }, 29.5, 35.5, 0.35, Math.PI - 0.35), mat: 'liner', shell: true, name: 'arch-liner' });
    // 扇形蹼翼：黃色翼根座 ＋ 土耳其藍翼面 ＋ 黑色放射肋
    const hubY = topAt(FAN.hubX, 0) + 3;
    const hub = new THREE.SphereGeometry(1, 20, 10);
    hub.scale(6.2, 3.8, 4.2);
    hub.translate(FAN.hubX - 0.5, hubY - 2.2, 0);
    parts.push({ geometry: hub, mat: 'yellow', solid: true, outline: true, name: 'web-hub' });
    parts.push({ geometry: buildWebMembrane(hubY), mat: 'turq2', solid: true, outline: true, name: 'web-membrane' });
    parts.push({ geometry: buildWebRibs(hubY), mat: 'yellow2', solid: true, outline: true, name: 'web-ribs' });
    // 黑圓斑（頂面，左右錯開）
    const spotsL = SPOTS_L.map(([x, z, r]) => sdCircle(x, z, r));
    const spotsR = SPOTS_R.map(([x, z, r]) => sdCircle(x, z, r));
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < 20) {
          return -1;
        }
        const fs = z > 0 ? spotsR : spotsL;
        return -Math.min(...fs.map((f) => f(x, Math.abs(z))));
      }),
      mat: 'dBlack',
      name: 'decal-spots',
    });
    // 側面：從鼻尖往後上掃的土耳其藍側線（黑邊），一路升到後腿上緣（V13 構圖）
    /** @type {(u: number) => number} */
    const lineY = (u) => 19 + 9 * smoothstep(40, -40, u);
    /** @type {(u: number, v: number) => number} */
    const lateral = (u, v) => Math.max(Math.abs(v - lineY(u)) - lerp(2.4, 0.6, smoothstep(-10, -48, u)) * smoothstep(66, 52, u), u - 64, -50 - u);
    /** @type {(u: number, v: number) => number} */
    const lateralEdge = (u, v) => lateral(u, v) - 0.8;
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(lateralEdge, { x0: 0, y0: 0, zMin: 30, side: 1 })),
        kit.decal(sideDecal((u, v) => lateralEdge(-u, v), { x0: 0, y0: 0, zMin: 30, side: -1 })),
      ]),
      mat: 'dBlack',
      name: 'decal-lateral-edge',
    });
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(lateral, { x0: 0, y0: 0, zMin: 30, side: 1 }), { offset: 0.08 }),
        kit.decal(sideDecal((u, v) => lateral(-u, v), { x0: 0, y0: 0, zMin: 30, side: -1 }), { offset: 0.08 }),
      ]),
      mat: 'dTurq',
      name: 'decal-lateral-line',
    });
    // 側面黑圓斑（後腿上）
    const sideSpots = [sdCircle(-34, 31, 2.6), sdCircle(-46, 26, 1.8), sdCircle(-24, 23, 1.5), sdCircle(8, 25, 1.7)];
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal((u, v) => Math.min(...sideSpots.map((f) => f(u, v))), { x0: 0, y0: 0, zMin: 34, side: 1 }), { offset: 0.1 }),
        kit.decal(sideDecal((u, v) => Math.min(...sideSpots.map((f) => f(-u - 3, v))), { x0: 0, y0: 0, zMin: 34, side: -1 }), { offset: 0.1 }),
      ]),
      mat: 'dBlack',
      name: 'decal-side-spots',
    });
    // 號碼 13（側面腰部白字）
    parts.push({
      geometry: kit.decal(sideDecal(sdNumber('13', { h: 5.4, w: 3, gap: 0.8 }), { x0: 10, y0: 16.5, zMin: 34 }), { offset: 0.1 }),
      mat: 'dWhite',
      name: 'decal-number',
    });
    // 頭燈（V14）：寬鼻兩側一對往外後斜的三角燈片
    // iter-55：拿掉鼻端的三角燈片（看起來像獠牙），改成前擋泥板頂面一對往後拉長的橢圓燈
    const lampSd = (px, pz) => Math.hypot((px - 52) / 4.2, (pz - 27) / 2.2) - 1;
    parts.push({ geometry: kit.decal((x, y, z) => -lampSd(x, Math.abs(z)), { offset: 0.1 }), mat: 'lamp', name: 'lamp-head' });
    // 鼻部「嘴線」：寬鼻正面一條黑色細橫線
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(x - 50, 0.9 - Math.abs(y - (18.2 - 0.12 * (66 - x))))),
      mat: 'dBlack',
      name: 'decal-mouth',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他致敬款）',
    geometry: '本檔站位產生器 P（推估）：長約 124、後腿輪拱頂 40、鼻 15（HOMAGE_RESEARCH 4-1）；前後輪拱 R17.5（31 mm 輪胎半徑 15.5 + 2 mm）',
    eyes: '眼泡為實心件（半徑 5.2 mm 半球＋扁球底座），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    web: '蹼翼翼面厚 0.9 mm、肋徑 2.6→0.9 mm，實心 ABS（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
