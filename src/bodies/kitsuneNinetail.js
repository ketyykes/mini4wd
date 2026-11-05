// 九尾狐（body-kitsune-ninetail，神話組・日本）：取材日本民間傳說的九尾妖狐（玉藻前傳說；九尾狐源自中國典籍），
// 不是稻荷神使——不用稻荷的白＋朱紅、不放鳥居、寶珠與鑰匙。
// 造型：尖長的狐吻楔形車頭（鼻尖黑漆）、前軸後方一對往後貼的三角狐耳（實體件，耳內黑漆）、車身中段煙燻座艙罩、
// 車尾 9 條狐尾尾翼（上下兩層：下層 5 條、上層 4 條往後展開；銀白 → 淡朱 → 朱紅漸層尖端，毛流用貼紙；
// 每條是有厚度、圓斷面、尾尖收細的實心毛束）。
// 設計：shared/design/body-kitsune-ninetail/DESIGN.md（典故與文物對應 MYTH_RESEARCH 日本節 J1、J2、J5、J6、J12、J13；
// 黑名單：《火影忍者》九喇嘛、寶可夢九尾〔J14〕、The Fox Jr.、WGP 銀狐隊、旭日放射紋〔J15〕）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創：珍珠銀白（上半車身，亮面）、黑漆（往後斜升的下半車身、鼻尖、耳內、座艙框，緞面；不用靛藍）、
// 朱紅（分色線上的賽車條、尾尖漸層）、金色蒔繪細線（青海波、眼線、腰線）；不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、鼻尖 75.5 */
const XS = [-70, -66, -60, -50, -40, -25, -10, 5, 20, 30, 40, 50, 58, 64, 69, 73, 75.5];
/** @type {number[]} 俯視半寬的站位（比其他參數多一個腰身控制點） */
const XS_HW = [-70, -66, -60, -50, -40, -30, -18, -5, 8, 20, 30, 40, 50, 58, 64, 69, 73, 75.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：狐狸的「深胸—細腰—窄臀」——座艙前的胸最寬 38.5（x 20）、座艙後段收成細腰 26.5（x −18）、
  // 後軸上方的臀 36、往後收成窄尾（車尾半寬 15，九尾從上方往外展開）、往前收成尖長狐吻（鼻尖半寬 2.5）；
  // 胸與臀不做更寬（正面面積、和 trojan 的俯視 IoU）
  hw: monoCurve(XS_HW, [15, 18.5, 24, 30, 36, 33, 26.5, 29, 36, 38.5, 33, 33, 26, 21, 15.5, 10, 5.5, 2.5]),
  // 中線殼頂：座艙段 33.0 的低平背，狐吻從前軸前方開始往前下斜成尖楔（鼻尖 14.8；前軸上方維持 ≥ 31.6，31 mm 輪的輪拱不破頂）
  yTop: monoCurve(XS, [29.6, 31, 31.8, 32.3, 32.6, 32.8, 33, 33, 32.9, 32.4, 31.6, 29, 25, 21.8, 19, 16.6, 14.8]),
  // 肩稜線高度（頂面與側面交界）
  yS: monoCurve(XS, [26.4, 27.4, 28, 28.4, 28.6, 28.8, 28.8, 28.8, 28.8, 28.4, 27.6, 25.6, 21.6, 18.8, 16.4, 14.6, 13.4]),
  // 側裙下緣
  yLow: monoCurve(XS, [14, 12.5, 11, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11, 12, 12.6, 12.8, 12.9]),
};

/**
 * 半剖面 7 點：中線 → 微圓的頂面 → 肩稜線（銳利）→ 微外張的側裙
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
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [h + 0.7, lerp(s, lo, 0.5)],
    [h + 1.1, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與狐吻每 0.75 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-70, -60, 0.75, profile).slice(0, -1), ...buildStations(-60, 62, 2, profile).slice(0, -1), ...buildStations(62, 75.5, 0.75, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 3、前後半長 19、半寬 12.5） */
const CANOPY = { xc: 3, a: 19, b: 12.5, n: 2.6 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/**
 * 斜向分色線（V12 從鼻尖往後掃）：黑漆下半車身在車頭只到肩稜線下 7 mm，往後一路斜升，
 * 到車尾越過肩稜線 2 mm（後甲板兩側也是黑漆，只留中央一道白背脊接到尾翼）——側視是一道往後上揚的楔形分割
 * @type {(x: number) => number}
 */
const ySplit = (x) => P.yS(x) - 7 + 9 * smoothstep(55, -62, x);

/** @type {number} 黑漆鼻尖的起點 x */
const X_NOSE = 72.4;

/** @type {number} 尾尖漸層的色階數（最後一階是朱紅尾尖） */
const TAIL_FADE_STEPS = 7;

/**
 * 尾尖漸層材質：7 階、每階色差很小的漸層（銀白 #E4E6EA → 淡朱 #EC8A66 → 朱紅 #D8401F，sRGB 內插），沿長每段一階；
 * 只分三段的硬邊色塊會像色鉛筆筆芯。
 * @type {() => Record<string, THREE.Material>}
 */
const tailFadeMaterials = () => {
  const silver = new THREE.Color(0xe4e6ea);
  const pale = new THREE.Color(0xec8a66);
  const shu = new THREE.Color(0xd8401f);
  /** @type {Record<string, THREE.Material>} */
  const out = {};
  for (let i = 1; i <= TAIL_FADE_STEPS; i++) {
    const t = i / TAIL_FADE_STEPS;
    const c = new THREE.Color();
    if (t <= 0.5) {
      c.lerpColors(silver, pale, t / 0.5);
    } else {
      c.lerpColors(pale, shu, (t - 0.5) / 0.5);
    }
    out[`fade${i}`] = namedMaterial(`paint-pearl-tail-fade-${i}`, {
      color: c.getHex(),
      metalness: lerp(0.3, 0, t),
      roughness: 0.32,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });
  }
  return out;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 珍珠銀白：上半車身（少數亮面部位）
  silver: namedMaterial('paint-pearl-silver-white', { color: 0xe4e6ea, metalness: 0.3, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  // 黑漆：緞面（漆器感）；也是下半車身的主色（不用靛藍：避開「白＋藍」的 WGP 隊伍配色風險）
  urushi: namedMaterial('paint-urushi-black', { color: 0x141416, roughness: 0.55, clearcoat: 0.2 }),
  // 朱紅（尾尖漸層末端、分色線上賽車條的顏色），亮面漆
  vermilion: namedMaterial('paint-vermilion-shu', { color: 0xd8401f, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  // 尾尖漸層 7 階（銀白 → 淡朱 → 朱紅；名稱含 pearl，和銀白尾身同一個 Blender 材質類別，色階之間不跳光澤）
  ...tailFadeMaterials(),
  // 真金屬金（尾尖；名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a54a, metalness: 0.8, roughness: 0.3, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x262c38, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x18181b, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x1a1a1e, roughness: 0.7, side: THREE.DoubleSide }),
  // 狐眼燈片：淡冰白（不用紅眼）
  eye: namedMaterial('lamp-ice', { color: 0xf2f6ff, emissive: 0xcfe0ff, emissiveIntensity: 0.4, roughness: 0.08, clearcoat: 1.0 }),
  dGold: decalMaterial('decal-gold-makie', { color: 0xd4b052, metalness: 0.75, roughness: 0.32 }),
  dUrushi: decalMaterial('decal-urushi-black', { color: 0x141416, roughness: 0.5, clearcoat: 0.2 }),
  dShu: decalMaterial('decal-vermilion-shu', { color: 0xd8401f, roughness: 0.35, clearcoat: 0.6 }),
  dFur: decalMaterial('decal-fur-silver', { color: 0xdfe2e8, metalness: 0.25, roughness: 0.35 }),
});

/**
 * 把局部座標（u 橫向、v 往上、w 往前）的耳朵幾何擺到車上：往後仰 26°、往外張 11.5°，耳根中心 (31, 29.6, ±11)
 * @type {(g: THREE.BufferGeometry, sg: number) => THREE.BufferGeometry}
 */
const placeEar = (g, sg) => {
  // 局部 w（往前）→ 世界 +x；局部 u → 世界 −z
  g.rotateY(Math.PI / 2);
  // 往後仰 26°（耳尖往 −x；耳朵順風往後貼，頂高 ≤ 49）
  g.rotateZ(0.45);
  // 往外張（耳尖往 sg·z）
  g.rotateX(sg * 0.2);
  g.translate(31, 29.6, sg * 11);
  return g;
};

/**
 * 狐耳（單側）：有厚度的射出件——三角耳板（底寬 10、高 19，兩側微外凸、耳尖小圓角）擠出 1.6 mm、
 * 四周 0.5 mm 圓角倒邊（總厚 2.6 mm），不做邊緣銳利如刀的四面體（會像無厚度的薄片）；
 * 耳根埋進前罩約 2.5 mm（和殼面接成一體）。耳內另貼一片 0.55 mm 黑漆三角片（略凸出耳面 0.35 mm）
 * @type {(sg: number) => { ear: THREE.BufferGeometry, inner: THREE.BufferGeometry }}
 */
const buildEar = (sg) => {
  /** @type {THREE.Shape} 耳板外形（局部 u 橫向、v 往上） */
  const shape = new THREE.Shape();
  shape.moveTo(-5, 0);
  shape.lineTo(5, 0);
  shape.quadraticCurveTo(3.6, 10.5, 0.7, 18.6);
  shape.quadraticCurveTo(0, 19.4, -0.7, 18.6);
  shape.quadraticCurveTo(-3.6, 10.5, -5, 0);
  /** @type {number} 擠出深度（不含倒邊） */
  const depth = 1.6;
  /** @type {number} 倒邊（圓角）尺寸 */
  const bev = 0.5;
  const ear = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 10 });
  // 耳面（前面）在局部 w = 0，耳板往後佔 w −2.6 → 0
  ear.translate(0, 0, -(depth + bev));
  const innerShape = new THREE.Shape();
  innerShape.moveTo(-3.1, 3.4);
  innerShape.lineTo(3.1, 3.4);
  innerShape.quadraticCurveTo(2.2, 10, 0, 15.2);
  innerShape.quadraticCurveTo(-2.2, 10, -3.1, 3.4);
  const inner = new THREE.ExtrudeGeometry(innerShape, { depth: 0.55, bevelEnabled: false, curveSegments: 8 });
  inner.translate(0, 0, -0.2);
  return { ear: placeEar(ear, sg), inner: placeEar(inner, sg) };
};

/**
 * 輪拱內側擋板（避免 Blender 展示圖前輪拱內出現黑白條紋）：
 * 輪拱內襯只是靠外側的一段圓柱面，從側面 / 前 3/4 看進輪拱，視線會穿過輪胎上方與前方的空隙、橫越車身、
 * 從另一側輪拱與側裙下方看到地板（Blender 攝影棚地板在車旁最亮）→ 和車殼安裝柱、對側內面的深色交錯成直條紋。
 * 這裡在輪胎內側（|z| = zw）補一片環形擋板（輪拱圓心為圓心，半徑 rIn → rOut、只取上半圈），把輪室從車身內部隔開。
 * blocked(x, y) 回傳 true 的位置（底盤側框、安裝柱等，已含 1 mm 間隙）不放擋板。
 * @type {(arch: { x: number, y: number }, zw: number, rIn: number, rOut: number, blocked: (x: number, y: number) => boolean) => THREE.BufferGeometry}
 */
export function buildArchWell(arch, zw, rIn, rOut, blocked) {
  const nt = 56;
  const nr = 6;
  const a0 = 0.1;
  const a1 = Math.PI - 0.1;
  /** @type {number[]} */
  const pos = [];
  /** @type {(t: number, r: number) => number[]} */
  const xy = (t, r) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t)];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < nt; i++) {
      const t0 = lerp(a0, a1, i / nt);
      const t1 = lerp(a0, a1, (i + 1) / nt);
      for (let j = 0; j < nr; j++) {
        const r0 = lerp(rIn, rOut, j / nr);
        const r1 = lerp(rIn, rOut, (j + 1) / nr);
        const q = [xy(t0, r0), xy(t1, r0), xy(t1, r1), xy(t0, r1)];
        if (q.some(([x, y]) => blocked(x, y))) {
          continue;
        }
        const [A, B, C, D] = q.map(([x, y]) => [x, y, sg * zw]);
        // 法線朝輪胎（z 往外）
        if (sg > 0) {
          pos.push(...A, ...B, ...C, ...A, ...C, ...D);
        } else {
          pos.push(...A, ...C, ...B, ...A, ...D, ...C);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * chassis-midship 在輪拱內側（|z| 19–26）的障礙物（量測值，已加 1 mm 間隙）：
 * 前後軸之間的底盤側框（前輪拱 x ≤ 25.5、後輪拱 x ≥ −27.5，頂 y 20.4–21.0；後輪拱 x ≥ −20.5 處頂 23.2）、
 * 安裝柱（x ±33.5、±50，寬 < 1 mm、頂 y 19.6，|z| 21.4–24.6）；軸承座（軸心半徑 4.1）在擋板內徑以內
 * @type {(x: number, y: number) => boolean}
 */
export const chassisBlockedNearArch = (x, y) => {
  if (x > 0 && x < 26.5 && y < 22) {
    return true;
  }
  if (x < 0 && x > -28.5 && y < (x > -21.5 ? 24.2 : 22)) {
    return true;
  }
  if (y < 20.6 && [33.5, 50].some((px) => Math.abs(Math.abs(x) - px) < 1.8)) {
    return true;
  }
  return false;
};

/**
 * 雙層狐尾尾翼（九條尾巴不擠在車尾一處；蓬鬆中空的尾巴面數太高，不用）。
 * 兩層九條狐尾，中心線是二次 Bézier（先往後、尾段往外甩，像被風往後吹開）：
 * - 下層 5 條：貼著後甲板、往後微升 3°，中央最長；
 * - 上層 4 條：從尾根座往後上揚 13°，錯開半格、張得比下層開——後視兩層錯開，側視是一道往後上揚的雙層尾翼。
 * 每條尾巴是低分段的實心毛束（扁平尾片又薄又有稜角，會像一堆紅白碎紙或火舌）——
 * 斷面是 12 段的扁橢圓（寬 w、厚 t），沿長 14 段：根部 55% 粗、約 55% 處最蓬、尾尖收細成尖；
 * 中心比尾片底面高 0.35 t，下半截埋進尾根座 / 後甲板，只露出圓鼓的上半截。前 7 段銀白尾身，後 7 段每段一階漸層（銀白 → 淡朱 → 朱紅尾尖）。
 * @type {{ y: number, tilt: number, xr: number, tips: number[][], wMax: number, tMax: number }[]} tips = 尾尖 [x, z]（含左右）；wMax / tMax = 最蓬處半寬 / 半厚
 */
const TAIL_LAYERS = [
  {
    // 下層：根 x −40、底面 y 33.3（埋在尾根座裡），往後 3° 微升；最蓬處寬 5.6、厚 3.6
    y: 33.3,
    tilt: 3,
    xr: -40,
    wMax: 2.8,
    tMax: 1.8,
    tips: [
      [-74.4, 0],
      [-72.6, 16],
      [-72.6, -16],
      [-65.5, 37],
      [-65.5, -37],
    ],
  },
  {
    // 上層：根 x −38、底面 y 34.2，往後 13° 上揚（尾尖約 y 42.5，比座艙頂高 0–2 mm：V7 貼近車身的尾翼）；最蓬處寬 5.0、厚 3.2
    y: 34.2,
    tilt: 13,
    xr: -38,
    wMax: 2.5,
    tMax: 1.6,
    tips: [
      [-72, 8],
      [-72, -8],
      [-67, 26],
      [-67, -26],
    ],
  },
];

/** @type {number} 尾束沿長段數（前 7 段銀白尾身，後 7 段每段一階漸層） */
const TAIL_LEN_SEGS = 14;

/** @type {number} 尾束斷面段數（平滑法向、共用頂點，不做 flat shading） */
const TAIL_RING_SEGS = 12;

/** @type {(i: number) => string} 第 i 段（0 起算）的材質鍵 */
const tailSegMat = (i) => {
  const k = i - (TAIL_LEN_SEGS - TAIL_FADE_STEPS) + 1;
  if (k <= 0) {
    return 'silver';
  }
  return `fade${k}`;
};

/** @type {(s: number) => number} 毛束粗細比例（0–1）：根部 0.55 → 約 55% 處最蓬 → 尾尖收成 0 */
const tuftScale = (s) => {
  if (s < 0.55) {
    return lerp(0.55, 1, smoothstep(0, 0.55, s));
  }
  return Math.cos((Math.PI / 2) * ((s - 0.55) / 0.45)) ** 0.8;
};

/**
 * 單條毛束（兩端封口的實心網格）：中心線 root → ctrl → tip 的二次 Bézier（在 xz 平面），
 * 斷面 12 段扁橢圓：側向半寬 wMax·k(s)、上下半厚 tMax·k(s)，中心高 0.35·tMax（相對尾片底面 y = 0）。
 * 先整條建好、算一次平滑法向，再依段切成各材質的子網格並沿用整條的法向——色階交界不會出現法向折線。
 * @type {(root: number[], tip: number[], wMax: number, tMax: number) => Record<string, THREE.BufferGeometry>}
 */
const tailTuft = (root, tip, wMax, tMax) => {
  // 控制點：先往後（x 取 60%）、z 只走 25%，尾段才往外甩
  const ctrl = [lerp(root[0], tip[0], 0.6), lerp(root[1], tip[1], 0.25)];
  /** @type {(s: number) => number[]} */
  const at = (s) => [
    (1 - s) ** 2 * root[0] + 2 * s * (1 - s) * ctrl[0] + s * s * tip[0],
    (1 - s) ** 2 * root[1] + 2 * s * (1 - s) * ctrl[1] + s * s * tip[1],
  ];
  /** @type {(s: number) => number[]} 單位切線 */
  const tan = (s) => {
    const dx = 2 * (1 - s) * (ctrl[0] - root[0]) + 2 * s * (tip[0] - ctrl[0]);
    const dz = 2 * (1 - s) * (ctrl[1] - root[1]) + 2 * s * (tip[1] - ctrl[1]);
    const l = Math.hypot(dx, dz);
    return [dx / l, dz / l];
  };
  const seg = TAIL_RING_SEGS;
  const nLen = TAIL_LEN_SEGS;
  const yc = 0.35 * tMax;
  /** @type {number[]} */
  const pos = [];
  for (let i = 0; i <= nLen; i++) {
    const s = i / nLen;
    const [x, z] = at(s);
    const [tx, tz] = tan(s);
    const k = Math.max(0.03, tuftScale(s));
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const lat = Math.cos(th) * wMax * k;
      pos.push(x - tz * lat, yc + Math.sin(th) * tMax * k, z + tx * lat);
    }
  }
  // 兩端封口的中心點
  const [x0, z0] = at(0);
  const [x1, z1] = at(1);
  const c0 = pos.length / 3;
  pos.push(x0, yc, z0);
  const c1 = c0 + 1;
  pos.push(x1, yc, z1);
  /** @type {number[][]} 每段的三角形索引（全域頂點編號） */
  const segIdx = [];
  for (let i = 0; i < nLen; i++) {
    /** @type {number[]} */
    const idx = [];
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j;
      const b = i * seg + ((j + 1) % seg);
      const c = a + seg;
      const d = b + seg;
      idx.push(a, c, b, b, c, d);
    }
    if (i === 0) {
      for (let j = 0; j < seg; j++) {
        idx.push(c0, j, (j + 1) % seg);
      }
    }
    if (i === nLen - 1) {
      for (let j = 0; j < seg; j++) {
        idx.push(c1, nLen * seg + ((j + 1) % seg), nLen * seg + j);
      }
    }
    segIdx.push(idx);
  }
  const full = new THREE.BufferGeometry();
  full.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  full.setIndex(segIdx.flat());
  full.computeVertexNormals();
  const nrm = full.getAttribute('normal');
  /** @type {Record<string, number[][]>} 材質鍵 → 該材質的段索引陣列 */
  const groups = {};
  segIdx.forEach((idx, i) => {
    (groups[tailSegMat(i)] ??= []).push(idx);
  });
  /** @type {Record<string, THREE.BufferGeometry>} */
  const out = {};
  for (const [mat, lists] of Object.entries(groups)) {
    /** @type {Map<number, number>} 全域頂點 → 子網格頂點 */
    const remap = new Map();
    /** @type {number[]} */
    const p = [];
    /** @type {number[]} */
    const n = [];
    /** @type {number[]} */
    const id = [];
    for (const v of lists.flat()) {
      if (!remap.has(v)) {
        remap.set(v, p.length / 3);
        p.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]);
        n.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
      }
      id.push(/** @type {number} */ (remap.get(v)));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setIndex(id);
    out[mat] = g;
  }
  return out;
};

/**
 * 兩層九條狐尾，依材質分組合併（每條毛束以根部為支點往後上揚 tilt 度）
 * @type {() => Record<string, THREE.BufferGeometry>}
 */
const buildTails = () => {
  /** @type {Record<string, THREE.BufferGeometry[]>} */
  const byMat = {};
  for (const layer of TAIL_LAYERS) {
    for (const tip of layer.tips) {
      // 根部：沿中線排開（z 取尾尖的 12%），埋進尾根座
      const root = [layer.xr, 0.12 * tip[1]];
      for (const [mat, g] of Object.entries(tailTuft(root, tip, layer.wMax, layer.tMax))) {
        // 以根部為支點往後上揚（rotateZ 負角：x 越往後 y 越高）
        g.translate(-layer.xr, 0, 0);
        g.rotateZ((-layer.tilt * Math.PI) / 180);
        g.translate(layer.xr, layer.y, 0);
        (byMat[mat] ??= []).push(g);
      }
    }
  }
  /** @type {Record<string, THREE.BufferGeometry>} */
  const out = {};
  for (const [mat, geos] of Object.entries(byMat)) {
    out[mat] = mergeGeos(geos);
  }
  return out;
};

/**
 * 青海波（J13：半圓三重相疊、像波浪一樣反覆）：圓半徑 R、水平間距 2R、垂直間距 R/2、隔列錯開 R；
 * 每點取「最下面一列」蓋住它的圓（下排疊在上排之上），畫三道同心圓弧線（線寬 0.6）
 * @type {(R: number, v0: number) => (u: number, v: number) => number} 負值 = 在金線上
 */
const seigaiha = (R, v0) => (u, v) => {
  const rowH = R / 2;
  const jTop = Math.floor((v - v0) / rowH) + 2;
  for (let j = jTop - 5; j <= jTop; j++) {
    const vc = v0 + j * rowH;
    const off = ((j % 2) + 2) % 2 === 1 ? R : 0;
    const ic = Math.round((u - off) / (2 * R));
    let best = Infinity;
    for (const i of [ic - 1, ic, ic + 1]) {
      best = Math.min(best, Math.hypot(u - (off + 2 * R * i), v - vc));
    }
    if (best < R) {
      let d = Infinity;
      for (const r of [R - 0.35, R - 1.75, R - 3.15]) {
        d = Math.min(d, Math.abs(best - r));
      }
      return d - 0.3;
    }
  }
  return 1;
};

/**
 * 狐眼（俯視杏仁形，斜放在狐吻兩側的上面）：兩圓交集的透鏡，內角在前內側、外角往後外上挑
 * @type {(grow: number) => (x: number, y: number, z: number) => number} 正值 = 在眼內（grow 往外擴）
 */
const eyeKeep = (grow) => {
  const inner = [61, 10.2];
  const outer = [53, 16.8];
  const cx = (inner[0] + outer[0]) / 2;
  const cz = (inner[1] + outer[1]) / 2;
  const ax = outer[0] - inner[0];
  const az = outer[1] - inner[1];
  const half = Math.hypot(ax, az) / 2;
  const ux = ax / (2 * half);
  const uz = az / (2 * half);
  const b = 1.7;
  const rv = (half * half + b * b) / (2 * b);
  const dv = rv - b;
  return (x, y, z) => {
    if (y < 20) {
      return -1;
    }
    const px = x - cx;
    const pz = Math.abs(z) - cz;
    const along = px * ux + pz * uz;
    const across = -px * uz + pz * ux;
    const d = Math.max(Math.hypot(along, across - dv), Math.hypot(along, across + dv)) - rv;
    return grow - d;
  };
};

export const kitsuneNinetailBody = makePolyBody({
  id: 'body-kitsune-ninetail',
  name: '九尾狐',
  style: 'myth',
  phase: 8,
  mythSeries: 'japanese',
  mythTheme: 'kitsune',
  form: 'fox-wedge',
  roof: 'canopy',
  wing: 'nine-tails',
  theme: '壓低的尖長狐吻楔形車頭＋前軸後方一對往後貼的三角狐耳、中段煙燻座艙罩、車尾上下兩層往後展開的九條扁平狐尾尾翼（銀白 → 朱紅漸層尖端）；珍珠白＋黑漆斜向分割＋朱紅賽車條＋金蒔繪的夜行妖狐',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 肩稜線是銳利稜線
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 超橢圓座艙：x 21.6 → −15.6（每 1.24 mm 一站）；最寬 12.5、最高 8.6（壓低；座艙頂約 41.6）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = lerp(21.6, -15.6, u);
        const halfW = Math.max(2.6, canopyHalfW(x));
        const rise = 8.6 * Math.sin(Math.PI * u ** 0.8) ** 0.6;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 黑漆鼻尖
    { mat: 'urushi', keep: (x) => x - X_NOSE },
    // 黑漆下半車身（斜向往後上揚的分色線）
    { mat: 'urushi', keep: (x, y) => ySplit(x) - y },
    // 珍珠銀白上半車身
    { mat: 'silver', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'urushi', glass: 'glass', cockpit: 'urushi', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 輪胎內側的環形擋板（|z| 22.9 = 內襯內緣，接成一個輪室；離 26 mm 輪內側面 2.4、31 mm 輪 1.9 mm）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 狐耳（實體件）＋耳內黑漆
    const ears = [-1, 1].map((sg) => buildEar(sg));
    parts.push({ geometry: mergeGeos(ears.map((e) => e.ear)), mat: 'silver', solid: true, outline: true, name: 'fox-ears' });
    parts.push({ geometry: mergeGeos(ears.map((e) => e.inner)), mat: 'urushi', solid: true, outline: true, name: 'fox-ears-inner' });
    // 九條狐尾（上下兩層的實心紡錘毛束，實體件，依段上色）
    const tails = buildTails();
    for (const [mat, g] of Object.entries(tails)) {
      parts.push({ geometry: g, mat, solid: true, outline: true, name: `nine-tails-${mat}` });
    }
    // 尾根座：黑漆扁橢球，把九條尾根和後甲板接成一體
    // 分段 16×10（面數預算）；拉長蓋住兩層尾根
    const boss = new THREE.SphereGeometry(1, 16, 10);
    boss.scale(8, 2.2, 9);
    boss.translate(-42, P.yTop(-42) + 0.2, 0);
    parts.push({ geometry: boss, mat: 'urushi', solid: true, outline: true, name: 'tail-root-boss' });

    // ---- 貼紙 ----
    // 座艙框（黑漆，座艙罩外圍 1.4 mm）＋座艙到尾根座的黑漆背脊線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        const ring = x > -16.8 && x < 22.8 ? Math.min(u + 1.4, 0.05 - u) : -1;
        const spine = Math.min(1.2 - Math.abs(z), -14.5 - x, x + 40);
        return Math.max(ring, spine);
      }),
      mat: 'dUrushi',
      name: 'decal-canopy-frame',
    });
    // 狐眼：冰白燈片＋黑漆眼框＋往後上挑的金色眼尾線
    parts.push({ geometry: kit.decal(eyeKeep(0), { offset: 0.1 }), mat: 'eye', name: 'lamp-fox-eyes' });
    const eyeIn = eyeKeep(0);
    const eyeOut = eyeKeep(0.75);
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(eyeOut(x, y, z), -eyeIn(x, y, z)), { offset: 0.1 }), mat: 'dUrushi', name: 'decal-eye-rims' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < 20) {
          return -1;
        }
        // 眼尾線：外角 (53, 16.8) 往後外延伸到 (45.5, 21.5)，線寬 0.7
        const az = Math.abs(z);
        const t = Math.max(0, Math.min(1, ((x - 52.6) * -7.5 + (az - 17.1) * 4.7) / (7.5 * 7.5 + 4.7 * 4.7)));
        const px = 52.6 - 7.5 * t;
        const pz = 17.1 + 4.7 * t;
        return 0.35 - Math.hypot(x - px, az - pz);
      }),
      mat: 'dGold',
      name: 'decal-eye-flicks',
    });
    // 分色線上方的朱紅賽車條（寬 1.8，從狐吻往後斜升到車尾）＋其上 0.6 mm 的金蒔繪細線
    parts.push({
      geometry: kit.decal((x, y) => Math.min(0.9 - Math.abs(y - (ySplit(x) + 1.0)), X_NOSE - 1 - x, x + 68.5)),
      mat: 'dShu',
      name: 'decal-shu-stripe',
    });
    parts.push({
      geometry: kit.decal((x, y) => Math.min(0.3 - Math.abs(y - (ySplit(x) + 2.4)), X_NOSE - 1 - x, x + 68.5)),
      mat: 'dGold',
      name: 'decal-makie-beltline',
    });
    // 毛流（貼紙）：後甲板兩側黑漆區上的銀白細毛流線——
    // 俯視是一束往後、往中線收攏的弧線（流向尾根），每條線寬由 0.55 往兩端收細、長短錯開
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > -14 || x < -66 || y < ySplit(x) - 3.2 || y > ySplit(x) + 0.2) {
          return -1;
        }
        // 弧線族：|z| + 0.0045 (x + 66)² = 常數（往後收向中線），每 2.2 mm 一條
        const q = Math.abs(z) + 0.0045 * (x + 66) ** 2;
        const k = Math.round(q / 2.2);
        const d = Math.abs(q - 2.2 * k);
        // 每條線的起訖點錯開（毛流長短不一）
        const xs = -20 - 14 * (((k * 37) % 11) / 11);
        const xe = -62 + 6 * (((k * 53) % 7) / 7);
        const t = (x - xe) / (xs - xe);
        if (t < 0 || t > 1) {
          return -1;
        }
        return 0.55 * Math.sin(Math.PI * t) ** 0.5 - d;
      }),
      mat: 'dFur',
      name: 'decal-fur-flow',
    });
    // 側面青海波（前後輪之間的黑漆下半車身，金蒔繪細線）
    const wave = seigaiha(4.5, 9.8);
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(wave(u, v), Math.abs(u) - 20.5, v - (ySplit(u) - 1.2), 11.6 - v), { x0: 0, y0: 0, zMin: 30, side })),
        mat: 'dGold',
        name: `decal-seigaiha-${side}`,
      });
    }
    // 後側面一道往尾根上揚的金蒔繪弧線（尾巴的「勢」）
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(
          sideDecal(
            (u, v) => {
              const c = P.yS(u) - 1.6 - 1.8 * Math.sin((Math.PI * (u + 64)) / 44);
              return Math.max(Math.abs(v - c) - 0.33, -64 - u, u + 18);
            },
            { x0: 0, y0: 0, zMin: 30, side },
          ),
        ),
        mat: 'dGold',
        name: `decal-makie-tail-sweep-${side}`,
      });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：殼長 145.5（車尾 −70 ~ 鼻尖 75.5）、外框長 149.9（尾尖 −74.4）；iter-121：殼頂 34.3 → 33.0、鼻尖頂 17.8 → 14.8、座艙頂 44.6 → 41.5、耳尖 49.3 → 46.7、胸寬 ±40 → ±38.5（座艙後細腰 ±26.5、後軸臀 ±36）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    ears: '狐耳：ABS 實心耳板（底寬 10 × 高 19、擠出 1.6 mm＋0.5 mm 圓角倒邊，總厚 2.6 mm；iter-114 由四面體改）＋耳內 0.55 mm 黑漆片（推估），質量 = 封閉體積 × 1.05 g/cm³',
    tails: 'iter-125：毛束斷面 8 → 12 段（平滑法向、共用頂點）、沿長 14 段，尾尖改成 7 階銀白 → 淡朱 → 朱紅漸層；iter-124：九條狐尾改成兩層 ABS 實心紡錘形毛束（斷面 8 段扁橢圓、沿長 10 段；最蓬處寬 5.6 × 厚 3.6（下層）/ 5.0 × 3.2（上層）mm，根部 55%、尾尖收尖，推估）；iter-121 為厚 1.3 mm 的扁平尾片：下層 5 條（根 x −40、往後升 3°，尾尖 x −65.5 ~ −74.4、最外 |z| 37，往外張開成扇）、上層 4 條（根 x −38、往後升 13°，尾尖約 y 43）；根部埋進黑漆尾根座（16×10 段）；不碰後導輪（後導輪頂 y 20.5）',
    palette: 'iter-121：銀白＋黑漆斜向分割＋朱紅賽車條 / 尾尖漸層＋少量金蒔繪（靛藍拿掉：基準評審指出白＋藍接近 WGP 隊伍配色；朱紅只佔約 10%，主色仍是銀白，不做稻荷的白＋朱主體，不用金毛 / 橘色主體、不用紅眼）；黑漆 #1B1B1B、金 #C9A54A 取 MYTH_RESEARCH 6-2（推估），其餘色碼自訂',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
