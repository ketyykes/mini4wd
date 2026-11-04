// 羽蛇（body-quetzal-serpent，第八階段神話組・阿茲特克 / 馬雅）：特奧蒂瓦坎羽蛇神殿立面伸出的羽蛇頭（頭後一圈羽毛領、眼窩嵌黑曜石），
// 加上阿茲特克綠松石馬賽克雙頭蛇的配色（綠松石面、海菊蛤紅嘴、螺貝白牙）。
// iter-113：原本的寬方頭＋一排白牙像鱷魚，改成羽蛇頭——頭後顎角最寬、往前收成圓尖蛇吻（吻端往上捲）、眼上捲紋、
// 張口（上顎前伸、兩根彎毒牙、紅色口內與分叉蛇信）；頭後一圈環繞頭部的放射狀大羽毛領（外圈長羽＋內圈紅短羽）；細頸（前輪外露）；
// 車身側面是 talud-tablero 式的兩階側壁，上緣稜線沿 x 波浪起伏（蛇身蜿蜒）；中段黑曜石色座艙罩；車尾 5 片側視寬羽扇（綠咬鵑尾羽）。
// 設計：shared/design/body-quetzal-serpent/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 8 節 A1–A3、A6、A7；黑名單 8-3）。剖面為本檔站位產生器（推估）。
// 紋樣與配色取自文物描述、圖形為自繪：綠松石小片馬賽克、連續帶狀階梯回紋（xicalcoliuhqui，不做四向旋轉單元）；
// 不做鷹＋蛇＋仙人掌組合、不用國旗色排列、不做骷髏 / 人祭圖像、不畫神像人臉；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, flatPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdRoundRect, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildBellySkirt } from './trojanHorse.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -70;
/** @type {number} 蛇頭前臉 x（iter-113：蛇吻往前收成圓尖、往上翹） */
const X_NOSE = 78.5;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-70, -64, -56, -40, -20, 0, 14, 22, 30, 44, 52, 55, 58, 62, 66, 70, 73, 75.5, 77.5, 78.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬（基礎值，另加 halfW 的蛇身波浪）：蛇尾收尖（15）→ 車身罩住後輪（37.5）→ 往前收成細頸（14.5，前輪內側面 25.25 之內）→
  // iter-113：蛇頭不再是平行的寬方頭（原 32.5 寬方頭像鱷魚），改成頭後顎角最寬 20、往前收成圓尖蛇吻（俯視蛇頭的水滴形）
  // iter-114：補前輪擋泥板後俯視和 marlin-sail 的 IoU 升到 0.84 → 蛇尾收細（x −64：25 → 18.5、x −56：34 → 32）、兩輪之間收窄（x −20 / 0 / 14：
  // 35.5 / 30 / 22.5 → 33.5 / 28.5 / 19.5）；再窄（30 / 25.5）會從 front34 看進電池艙，已試過不用
  hw: monoCurve(XS, [13, 18.5, 32, 37, 33.5, 28.5, 19.5, 17, 15, 14.5, 14.5, 15.5, 18.5, 20.2, 19.6, 17.2, 14.6, 11.6, 8.6, 6.5]),
  // 中線頂：後段蛇身 33 → 座艙段 31.5 → 細頸下凹 25 → 蛇頭 30（眼上）→ 蛇吻往上翹到 34.2（接上方的捲鼻）
  // iter-121：蛇吻不再往上捲，改成往前壓低的楔形上顎（眼後 29.5 → 吻端 22.4；車頭到座艙是連續斜面）
  yTop: monoCurve(XS, [30, 32, 32.8, 33, 32, 31.5, 30, 27.5, 25.5, 25, 25.5, 26.5, 28, 29.5, 28.6, 27, 25.6, 24.2, 23, 22.4]),
  // 側裙下緣：車身 10.5–13（底盤側框段 ≥ 9.9）；細頸段抬到 18（底盤上方）；蛇頭下顎 12.5；
  // iter-113：下顎在 x 70 收掉、x 73 以前只剩上顎（張口：上顎前伸、兩根毒牙垂在下顎前方）
  // iter-121：上顎前端下緣 18.8 → 17.8（楔形吻端仍保有 4.6 mm 厚）
  yLow: monoCurve(XS, [22, 18, 13, 12, 11, 10.5, 14, 18, 18, 18, 18, 16, 13.5, 12.5, 12.5, 13.4, 18, 18, 17.9, 17.8]),
};

/** @type {{ y: number, amp: number, len: number, peak: number }} 蛇身波浪稜線：y = 27 ± 2.2，波長 46 mm，波峰落在後輪軸（x −40）上方 */
const WAVE = { y: 27, amp: 2.2, len: 46, peak: -40 };

/**
 * 半寬＝基礎值＋蛇身段的左右波浪（和稜線同相位：稜線波峰處車身也最寬，俯視像一節節蜿蜒的蛇身；車尾與細頸前漸消失）
 * @type {(x: number) => number}
 */
const halfW = (x) => {
  // iter-114：前端淡出由 x 4–16 提前到 0–12（俯視和 marlin-sail 的 IoU 留餘裕）
  const env = smoothstep(-64, -54, x) * (1 - smoothstep(0, 12, x));
  return P.hw(x) + 3.2 * env * Math.cos((2 * Math.PI * (x - WAVE.peak)) / WAVE.len);
};

/**
 * 側壁上緣稜線高度（蛇身段波浪起伏；往前漸變成蛇頭平頂的邊稜）
 * @type {(x: number) => number}
 */
const ridgeY = (x) => {
  const wave = WAVE.y + WAVE.amp * Math.cos((2 * Math.PI * (x - WAVE.peak)) / WAVE.len);
  const head = P.yTop(x) - 1.8;
  const y = lerp(wave, head, smoothstep(22, 34, x));
  return Math.min(y, P.yTop(x) - 1.2);
};

/**
 * 立板（tablero）下緣：蛇頭段 = 口線（17.5），車身段 = 稜線下 8 mm；並夾在下緣之上
 * @type {(x: number) => number}
 */
const tableroY = (x) => {
  const body = ridgeY(x) - 8;
  const y = lerp(body, 17.5, smoothstep(54, 58, x));
  return Math.max(P.yLow(x) + 2.2, Math.min(y, ridgeY(x) - 2));
};

/**
 * 半剖面 8 點：頂面（中線 → 頂面外緣）→ 稜線（銳利）→ 立板 tablero（垂直）→ 立板下緣（銳利）→ 內收一階（銳利）→ 斜坡 talud 到下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = halfW(x);
  const yTop = P.yTop(x);
  const yR = ridgeY(x);
  const yT = tableroY(x);
  const yLow = P.yLow(x);
  return [
    [0, yTop],
    [0.5 * hw, yTop - 0.35],
    [hw - 3.5, Math.max(yR + 0.9, lerp(yR, yTop, 0.5))],
    [hw - 0.6, yR],
    [hw, yR - 1],
    [hw, yT],
    [hw - 1.5, yT - 0.5],
    [hw - 0.4, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 站位表（蛇頭與車尾段加密：蛇頭外擴、前臉圓角曲率大） */
const STATIONS = [
  ...buildStations(X_TAIL, -60, 1, profile).slice(0, -1),
  ...buildStations(-60, 50, 2, profile).slice(0, -1),
  ...buildStations(50, X_NOSE, 0.5, profile),
];

/**
 * 黑曜石眼窩（蛇頭頂面兩側）。iter-124（評審：iter-121 的大圓眼＋白眼圈像卡通青蛙 / 烏龜）：改回羽蛇神殿石雕頭的
 * 黑曜石嵌片式扁杏仁眼——半長 a 4.2、最寬處半寬 b 1.25、兩端收尖；眼尾（往後）往外斜開 slant（每 mm 外移 0.18），眼神往後上挑
 * @type {{ x: number, z: number, a: number, b: number, slant: number }}
 */
const EYE = { x: 64.5, z: 10.6, a: 4.2, b: 1.25, slant: 0.18 };
/** @type {(x: number, y: number, z: number) => number} 眼窩距離（近似；負值 = 凹窩內） */
const eyeSd = (x, y, z) => {
  if (y < 22) {
    return 10;
  }
  const dx = x - EYE.x;
  const u = Math.min(1, Math.abs(dx) / EYE.a);
  const half = EYE.b * (1 - u * u) ** 0.9;
  const zc = EYE.z - EYE.slant * dx;
  return Math.max(Math.abs(dx) - EYE.a, Math.abs(Math.abs(z) - zc) - half);
};

/**
 * 可重現的格點雜湊（0–1）
 * @type {(i: number, j: number) => number}
 */
const hash2 = (i, j) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * 綠松石馬賽克：5.2 mm 方格（iter-114 由 2.6 放大一倍：評審「頂面雜訊紋太細碎」），依雜湊挑出一部分格子畫成內縮 0.6 mm 的小片（深 / 淺兩色各一組）
 * @type {(x: number, z: number, lo: number, hi: number) => number} 回傳正值 = 在被挑中的小片內
 */
const mosaic = (x, z, lo, hi) => {
  const c = 5.2;
  const i = Math.floor(x / c);
  const j = Math.floor(z / c);
  const h = hash2(i, j);
  if (h < lo || h >= hi) {
    return -1;
  }
  return -sdRoundRect(x, z, i * c + 0.6, (i + 1) * c - 0.6, j * c + 0.6, (j + 1) * c - 0.6, 0.6);
};

/**
 * 線段距離
 * @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number}
 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** @type {number} 階梯回紋單元寬（xicalcoliuhqui，自繪）：寬 10.4、高 5.2 的帶內，一道三階梯往上接一個往內捲的方鉤；單元往同一方向連續重複 */
const FRET_W = 10.4;
/** @type {number[][]} 折線頂點（單元座標 u, v） */
const FRET_PATH = [
  [-0.8, 0.6],
  [2, 0.6],
  [2, 1.9],
  [3.6, 1.9],
  [3.6, 3.3],
  [5.2, 3.3],
  [5.2, 4.6],
  [9.6, 4.6],
  [9.6, 1.6],
  [7.2, 1.6],
  [7.2, 3.1],
  [8.2, 3.1],
];

/**
 * 階梯回紋帶距離（u 沿帶、v 由帶下緣往上，線寬 0.66 mm）
 * @type {(u: number, v: number) => number}
 */
const fretSd = (u, v) => {
  const k = Math.floor(u / FRET_W);
  let d = Infinity;
  for (const off of [k - 1, k]) {
    const lu = u - off * FRET_W;
    for (let i = 0; i < FRET_PATH.length - 1; i++) {
      const [ax, ay] = FRET_PATH[i];
      const [bx, by] = FRET_PATH[i + 1];
      d = Math.min(d, segDist(lu, v, ax, ay, bx, by));
    }
  }
  return d - 0.33;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 綠松石馬賽克面、翡翠綠立板、海菊蛤紅斜坡：石材 / 貝殼感用霧面（roughness > 0.5）
  turq: namedMaterial('paint-turquoise-mosaic', { color: 0x2bb3a3, roughness: 0.62, clearcoat: 0.1 }),
  turq2: namedMaterial('paint-turquoise-mosaic', { color: 0x2bb3a3, roughness: 0.62, clearcoat: 0.1, side: THREE.DoubleSide }),
  jade: namedMaterial('paint-jade-green', { color: 0x1e7f4e, roughness: 0.56, clearcoat: 0.15 }),
  jade2: namedMaterial('paint-jade-green', { color: 0x1e7f4e, roughness: 0.56, clearcoat: 0.15, side: THREE.DoubleSide }),
  red: namedMaterial('paint-spondylus-red', { color: 0xc2452d, roughness: 0.6, clearcoat: 0.1 }),
  red2: namedMaterial('paint-spondylus-red', { color: 0xc2452d, roughness: 0.6, clearcoat: 0.1, side: THREE.DoubleSide }),
  shell: namedMaterial('paint-shell-white', { color: 0xf1ebdd, roughness: 0.58, clearcoat: 0.1, side: THREE.DoubleSide }),
  // 綠咬鵑長羽：全車少數的亮面金屬漆（羽毛的金屬綠光澤）
  plume: namedMaterial('paint-quetzal-green-metallic', { color: 0x168a5a, roughness: 0.28, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  // 黑曜石：亮面黑（眼窩、鼻孔）
  obsidian: namedMaterial('paint-obsidian-gloss', { color: 0x1c1c22, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x15201c, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-jade', { color: 0x17603c, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x121416, roughness: 0.6 }),
  // 黑曜石色煙燻座艙罩
  glass: namedMaterial('pc-smoke-tint', { color: 0x16161c, roughness: 0.05, specularIntensity: 0.7, transparent: true, opacity: 0.8, envMapIntensity: 0.6, depthWrite: false }),
  dTurqDark: decalMaterial('decal-turquoise-dark', { color: 0x16857a, roughness: 0.6 }),
  dTurqLight: decalMaterial('decal-turquoise-light', { color: 0x7fd8c8, roughness: 0.6 }),
  dShell: decalMaterial('decal-shell-white', { color: 0xf3ede0, roughness: 0.55 }),
  dRed: decalMaterial('decal-spondylus-red', { color: 0xc2452d, roughness: 0.55 }),
  dObsidian: decalMaterial('decal-obsidian', { color: 0x18181d, roughness: 0.2, clearcoat: 0.8 }),
  // iter-124：眼窩內面改霧面黑曜石（拿掉亮面高光，評審：帶高光的大圓眼像卡通臉）
  obsidianEye: namedMaterial('paint-obsidian-matte', { color: 0x121216, roughness: 0.62, clearcoat: 0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-jade', { color: 0x123f2b, roughness: 0.7, side: THREE.DoubleSide }),
});

/**
 * 輪拱內襯（後輪）：輪拱切口後面的一段圓柱面（只取上半圈），z 從側壁內面往內 depth
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.3;
  const a1 = Math.PI - 0.3;
  const pos = [];
  /** @type {(t: number) => number} */
  const zIn = (t) => halfW(arch.x + r * Math.cos(t)) - 1.8;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zIn(t0) - depth);
      const B = p(t1, zIn(t1) - depth);
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
 * 羽片外形（局部座標：a 沿羽長 0–L、b 為半寬方向）：根部窄、中段最寬、尖端收尖；取 a ∈ [a0, a1] 一段
 * @type {(L: number, wMax: number, a0: number, a1: number) => number[][]} 回傳 [b, a] 多邊形
 */
const featherOutline = (L, wMax, a0, a1) => {
  /** @type {(a: number) => number} */
  const w = (a) => Math.max(0.15, wMax * Math.sin(Math.PI * (0.12 + (0.88 * a) / L)) ** 0.7);
  const n = 10;
  /** @type {number[][]} */
  const right = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    right.push([w(a), a]);
  }
  const left = right.map(([b, a]) => [-b, a]).reverse();
  return [...right, ...left];
};

/**
 * 圓角厚板（iter-114，羽毛領用）：平面外形 pts 沿 z 擠出總厚 thick（以 z = 0 為中心），上下緣倒 bev 圓角（3 段），
 * bevelOffset 往內縮 → 外形輪廓不變大；取代 finPlate 的 0.2 mm 單段倒角（評審：羽冠像一片很薄的直立圓盤）
 * @type {(pts: number[][], thick: number, bev: number) => THREE.BufferGeometry}
 */
const roundFin = (pts, thick, bev) => {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thick - 2 * bev,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelOffset: -bev,
    bevelSegments: 3,
  });
  g.translate(0, 0, -thick / 2 + bev);
  return g;
};

/**
 * 立在 yz 平面的羽片（厚度沿 x）：先在局部平面畫外形，再依扇形角 fanDeg（0 = 直立、正值往 +z 倒）與後傾角 leanDeg 擺到根點
 * @type {(outline: number[][], thick: number, fanDeg: number, leanDeg: number, root: number[]) => THREE.BufferGeometry}
 */
const placeFeather = (outline, thick, fanDeg, leanDeg, root) => {
  const g = roundFin(outline, thick, Math.min(0.5, thick * 0.3));
  // 外形 (b, a) → (z, y)，厚度轉到 x
  g.rotateY(Math.PI / 2);
  g.rotateX((fanDeg * Math.PI) / 180);
  // iter-121：後傾改成「繞垂直於羽軸的軸」轉，羽軸 r = (0, cos f, sin f) 直接往 −x 倒 leanDeg——
  // 兩側的羽片也一樣往後飄（原本 rotateZ 只讓頭頂的羽片後傾，兩側的羽片仍往外直伸）
  const f = (fanDeg * Math.PI) / 180;
  const axis = new THREE.Vector3(0, -Math.sin(f), Math.cos(f));
  g.applyMatrix4(new THREE.Matrix4().makeRotationAxis(axis, (leanDeg * Math.PI) / 180));
  g.translate(root[0], root[1], root[2]);
  return g;
};

/**
 * 前輪擋泥板參數（iter-114）：評審「前輪幾乎沒有輪拱遮蓋」→ 每個前輪上方一片厚 1.3 mm 的弧形擋泥板（以前軸為圓心、內半徑 16.4，
 * 26 mm 輪胎頂上留 3.4 mm、厚 1.25），z 26.5 → 36.4 蓋住胎面外側 8 mm 並外伸 2 mm（26 mm 輪 25.25–34.25；往外偏是為了俯視 IoU），前後各蓋到輪頂兩側 35°（x 30–50；俯視 IoU 每一 x 只看最寬處，擋泥板再長會和 marlin-sail 的 IoU 超過 0.82）；
 * 擋泥板用一片斜撐板接到細頸側面（只在 x 36–44，細頸與擋泥板之間其餘保持鏤空——細頸蛇身的俯視輪廓不變寬）
 * @type {{ x: number, y: number, rIn: number, t: number, a0: number, a1: number, z0: number, z1: number, bev: number }}
 */
const FENDER = { x: 40, y: 13, rIn: 16.4, t: 1.25, a0: 55, a1: 125, z0: 26.5, z1: 36.4, bev: 0.5 };

/**
 * 一片前輪擋泥板（側視圓環扇形沿 z 擠出，四周倒 0.5 mm 圓角）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildFender = (sg) => {
  const f = FENDER;
  const a0 = (f.a0 * Math.PI) / 180;
  const a1 = (f.a1 * Math.PI) / 180;
  const shape = new THREE.Shape();
  shape.absarc(f.x, f.y, f.rIn + f.t, a0, a1, false);
  shape.absarc(f.x, f.y, f.rIn, a1, a0, true);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: f.z1 - f.z0 - 2 * f.bev,
    bevelEnabled: true,
    bevelThickness: f.bev,
    bevelSize: f.bev,
    bevelOffset: -f.bev,
    // iter-121：40 → 16 段（面數預算；弧長 20 mm，16 段已看不出折角）
    bevelSegments: 2,
    curveSegments: 16,
  });
  g.translate(0, 0, (sg > 0 ? f.z0 : -f.z1) + f.bev);
  return g;
};

/**
 * 擋泥板斜撐：從細頸側面（|z| 11.5，埋進殼內）斜上到擋泥板內側（|z| 27.2，埋進擋泥板），x 37.5–42.5，垂直厚 1.4 mm（板法向厚約 1.28）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildFenderStay = (sg) => {
  /** @type {number[][]} 斷面（z, y） */
  const sec = [
    [11.5, 22.6],
    [27.2, 29.3],
    [27.2, 30.6],
    [11.5, 24.0],
  ];
  const shape = new THREE.Shape(sec.map(([z, y]) => new THREE.Vector2(sg * z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelOffset: -0.3, bevelSegments: 2 });
  // 斷面 (z, y) 擠出沿 −x：rotateY(−90°) 把形狀 x → 世界 z、擠出 z → 世界 −x
  g.rotateY(-Math.PI / 2);
  g.translate(42.5, 0, 0);
  return g;
};

export const quetzalSerpentBody = makePolyBody({
  id: 'body-quetzal-serpent',
  name: '羽蛇',
  style: 'myth',
  phase: 8,
  mythSeries: 'mesoamerican',
  mythTheme: 'feathered-serpent',
  form: 'serpent',
  roof: 'canopy',
  wing: 'feather-fan',
  theme: '特奧蒂瓦坎羽蛇神殿的羽蛇頭：張口的楔形蛇吻＋彎毒牙、頭後一圈往後飄的羽領、細頸、兩階側壁的波浪稜線蛇身、黑曜石座艙罩、車尾平躺展開的綠咬鵑羽扇鴨尾翼；綠松石馬賽克＋紅白雙線往後掃的 livery',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面，稜線（3）、立板下緣（5）、內收階（6）為銳利稜線
  hard: [3, 5, 6],
  // 只有後輪拱（26 mm 輪：半徑 13 + 2.5）；前輪在細頸外側外露
  wheelArches: [{ x: -40, y: 13, radius: 15.5, cutZFrom: 25 }],
  canopy: {
    section: 'ellipse',
    // 中段座艙罩：x 24 → −16，最寬 11.5、最高 7.5（罩頂約 38.5）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 27;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(24, -16, u);
        const halfW = i === 0 || i === n ? 2.5 : 11.5 * Math.sin(Math.PI * u ** 0.85) ** 0.55;
        const rise = 7.5 * Math.sin(Math.PI * u ** 0.8) ** 0.65;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  recesses: [{ id: '黑曜石眼窩', view: 'top', shape: 'fn', sd: eyeSd, depth: 0.9 }],
  sideZMin: 20,
  innerSkipRecess: true,
  zones: () => [
    // 綠松石：頂面（稜線以上）
    { mat: 'turq', keep: (x, y) => y - (ridgeY(x) + 0.02) },
    // 翡翠綠：立板（稜線到立板下緣）
    { mat: 'jade', keep: (x, y) => y - (tableroY(x) - 0.1) },
    // 海菊蛤紅：內收階以下的斜坡（蛇頭段 = 下顎）
    { mat: 'red', keep: () => 1 },
  ],
  // 前臉：口線以上翡翠綠、以下海菊蛤紅（下顎）
  capFrontBands: [{ yMin: 17.5, mat: 'jade' }, { mat: 'red' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'red', recess: 'obsidianEye', recessWall: 'obsidianEye', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // iter-115 腹側裙板（朱紅，接續後段紅色蛇腹）：評審「側面電池管仍外露」→ 細頸段（x 2 → 21.5；x < 2 已由紅色蛇腹蓋住）每側一片直立外板，
    // 外緣 |z| 35.5（底盤側框外緣）、y 10.5 → 17；整車已 132.6 g（上限 133），棚板改成 2 條寬 2.4 mm 的橫撐（x 3.2 / 11，細頸側壁下緣 < 17 處）接到細頸側壁（半寬 − 1.2）
    parts.push({
      geometry: buildBellySkirt({ x0: 2, x1: 21.5, zIn: (x) => halfW(x) - 1.2, zOut: 35.5, yTop: 17, ribs: [3.2, 11] }),
      mat: 'red2',
      solid: true,
      outline: true,
      name: 'belly-skirt',
    });
    /** @type {(x: number) => number} 中線頂面高度 */
    const top = (x) => kit.surf.topY(x, 0);

    // 後輪拱內襯
    parts.push({ geometry: buildLiner({ x: -40, y: 13, radius: 15.5 }, 3.5), mat: 'liner', shell: true, name: 'arch-liners' });
    // 前輪擋泥板（iter-114）＋接到細頸的斜撐
    parts.push({ geometry: mergeGeos([buildFender(1), buildFender(-1)]), mat: 'jade2', solid: true, outline: true, name: 'front-fenders' });
    parts.push({ geometry: mergeGeos([buildFenderStay(1), buildFenderStay(-1)]), mat: 'turq2', solid: true, outline: true, name: 'front-fender-stays' });

    // ── 羽毛領（iter-113 放大，最主要的辨識特徵）：特奧蒂瓦坎羽蛇頭像那種環繞頭部一圈的放射狀大羽片 ──
    // 外圈 11 片長羽（長 16、寬 10.4、厚 1.6、圓角 0.48；綠松石 / 翡翠綠交替、羽尖螺貝白）、內圈 10 片短羽（海菊蛤紅，厚 1.4，錯開半格、在外圈前方），
    // 以頭後斷面中心 (x 57, y 20) 往外放射，從兩側略低於水平（−10°）繞過頭頂到另一側；羽片往後傾，奇偶片 16° / 30° 交錯（前後兩層，側視有厚度與層次）
    // iter-114：評審「羽冠是一片很薄的直立圓盤」→ 原本 17 片 × 厚 1.1、同一後傾角（側視是一片薄盤），改成較少、較厚、前後錯層的羽片
    /** @type {{ x: number, yc: number, A: number, B: number, L: number, w: number, n: number, th0: number, th1: number, lean: number[] }} */
    // iter-121：評審「羽冠在車尾像一把蔥」、「車頭零件多」→ 羽領改成頭後一圈「往後飄」的羽片：只取上半圈（θ 22° → 158°）、
    // 9 片長 19 的羽片往後倒 58° / 66°（兩層交錯），側視是一道從頭後往座艙順風掠過的羽領，不再是向外放射的直立圓盤（正面面積大減）
    const RUFF = { x: 58, yc: 20, A: 16.4, B: 7.4, L: 19, w: 5.0, n: 9, th0: 22, th1: 158, lean: [58, 66] };
    /** @type {THREE.BufferGeometry[][]} [綠松石, 翡翠綠, 羽尖, 內圈紅] */
    const ruff = [[], [], [], []];
    /** @type {(th: number, k: number) => number[]} 羽根點：頭後斷面橢圓上（埋入比例 k） */
    const ruffRoot = (th, k) => {
      const t = (th * Math.PI) / 180;
      const rEll = 1 / Math.hypot(Math.cos(t) / RUFF.A, Math.sin(t) / RUFF.B);
      return [RUFF.x, RUFF.yc + k * rEll * Math.sin(t), k * rEll * Math.cos(t)];
    };
    for (let i = 0; i < RUFF.n; i++) {
      const th = lerp(RUFF.th0, RUFF.th1, i / (RUFF.n - 1));
      const root = ruffRoot(th, 0.9);
      // 扇形角：羽片沿放射方向（從 +y 往 +z 倒 90° − θ）
      const fan = 90 - th;
      const lean = RUFF.lean[i % 2];
      ruff[i % 2].push(placeFeather(featherOutline(RUFF.L, RUFF.w, 0, 0.78 * RUFF.L), 1.6, fan, lean, root));
      ruff[2].push(placeFeather(featherOutline(RUFF.L, RUFF.w, 0.78 * RUFF.L, RUFF.L), 1.6, fan, lean, root));
    }
    for (let i = 0; i < RUFF.n - 1; i++) {
      const th = lerp(RUFF.th0, RUFF.th1, (i + 0.5) / (RUFF.n - 1));
      const root = ruffRoot(th, 0.95);
      root[0] += 1.2;
      ruff[3].push(placeFeather(featherOutline(9, 3.4, 0, 9), 1.4, 90 - th, 48, root));
    }
    parts.push({ geometry: mergeGeos(ruff[0]), mat: 'turq2', solid: true, outline: true, name: 'feather-ruff-a' });
    parts.push({ geometry: mergeGeos(ruff[1]), mat: 'jade2', solid: true, outline: true, name: 'feather-ruff-b' });
    parts.push({ geometry: mergeGeos(ruff[2]), mat: 'shell', solid: true, outline: true, name: 'feather-ruff-tips' });
    parts.push({ geometry: mergeGeos(ruff[3]), mat: 'red2', solid: true, outline: true, name: 'feather-ruff-inner' });

    // iter-121：拿掉往上捲的蛇吻與眼上捲紋（評審「車頭蛇頭零件多、輪廓雜」），車頭只留楔形上顎＋毒牙＋口內＋蛇信
    // iter-124：吻端加回小鼻捲（評審：基準的蛇頭有神殿石雕的捲吻）——比基準的捲鼻（頂約 42）小很多，
    // 從吻端頂面往前上捲再往後收一小圈，頂約 27.6，低於眼後頭頂 29.5（正視被頭部擋住，不增加正面面積）；翡翠綠實心件
    {
      const curlPts = [
        [69.5, top(69.5) - 1.2, 0],
        [74.5, top(74.5) - 0.5, 0],
        [77.6, top(77.6) + 0.3, 0],
        [78.9, 24.8, 0],
        [78.4, 26.9, 0],
        [76.8, 27.6, 0],
        [75.4, 26.9, 0],
        [75.7, 25.7, 0],
      ];
      parts.push({
        geometry: sweepEllipse(curlPts, 24, (t) => [lerp(3.0, 1.5, t), lerp(1.4, 0.8, t)], 8),
        mat: 'jade2',
        solid: true,
        outline: true,
        name: 'snout-curl',
      });
    }
    // 兩根彎曲毒牙（螺貝白實體件）：上顎前角往下、往後彎（不做整排牙）
    {
      /** @type {THREE.BufferGeometry[]} */
      const fangs = [];
      for (const sg of [-1, 1]) {
        fangs.push(
          sweepEllipse(
            [
              [73.6, 18.6, sg * 6.2],
              [74.6, 16.4, sg * 6.4],
              [74.4, 13.8, sg * 6.6],
              [73, 11.9, sg * 6.6],
            ],
            20,
            (t) => [lerp(1.25, 0.18, t ** 0.9), lerp(1.25, 0.18, t ** 0.9)],
            12,
          ),
        );
      }
      parts.push({ geometry: mergeGeos(fangs), mat: 'shell', solid: true, outline: true, name: 'serpent-fangs' });
    }
    // 口內（海菊蛤紅）：上顎下方的口頂板（封住上顎殼內，張口處看到紅色口腔）＋往前伸的分叉蛇信
    {
      /** @type {number[][]} 口頂板外形（俯視 x, z）：沿上顎內側 */
      const roof = [];
      for (let i = 0; i <= 10; i++) {
        const x = lerp(69.5, 78, i / 10);
        roof.push([x, halfW(x) - 0.9]);
      }
      const roofPts = [...roof, ...roof.map(([x, z]) => [x, -z]).reverse()];
      parts.push({ geometry: flatPlate(roofPts, 17.7, 0.6), mat: 'red2', solid: true, name: 'mouth-roof' });
      // 蛇信：從下顎前緣（x 69）往前伸到 x 80，前端分叉（厚 0.8，寬 2.2）
      const tongue = [
        [68.5, 1.1],
        [76.6, 1.1],
        [80.4, 2.4],
        [80.6, 1.6],
        [77.8, 0.3],
        [77.8, -0.3],
        [80.6, -1.6],
        [80.4, -2.4],
        [76.6, -1.1],
        [68.5, -1.1],
      ];
      parts.push({ geometry: flatPlate(tongue, 15.2, 0.8), mat: 'red2', solid: true, outline: true, name: 'forked-tongue' });
    }

    // iter-121 車尾綠咬鵑長羽扇：原本 5 片立起的側視寬羽（頂高 52.9，評審「像一把蔥」）改成 5 片平躺、往後展開的扁平羽片
    // （俯視是一把開扇、側視是一道貼著車尾往後微揚 7° 的鴨尾翼），頂高 ≈ 35；中央最長，羽尖一段綠松石
    /** @type {{ x: number, angles: number[], len: number[], tilt: number }} */
    // iter-124（評審：平躺的尾羽在前 3/4 幾乎看不到）：外側兩片沿羽軸往上翹 roll 度（20°），羽尖分成海菊蛤紅帶＋綠松石尖兩個明顯色塊
    const FAN = { x: -51, angles: [-50, -25, 0, 25, 50], len: [14, 17, 20, 17, 14], tilt: 7, roll: [20, 0, 0, 0, 20] };
    /** @type {THREE.BufferGeometry[]} */
    const plumes = [];
    /** @type {THREE.BufferGeometry[]} */
    const plumeBands = [];
    /** @type {THREE.BufferGeometry[]} */
    const plumeTips = [];
    const yRoot = top(FAN.x) - 0.9;
    FAN.angles.forEach((deg, i) => {
      const L = FAN.len[i];
      const phi = (deg * Math.PI) / 180;
      // 羽軸方向（俯視往後、往外展開）與橫向
      const dir = [-Math.cos(phi), Math.sin(phi)];
      const perp = [Math.sin(phi), Math.cos(phi)];
      /** @type {(poly: number[][]) => number[][]} 局部 [b, a] → 俯視 [x, z] */
      const toPlan = (poly) => poly.map(([b, a]) => [FAN.x + a * dir[0] + b * perp[0], 1.4 * Math.sin(phi) + a * dir[1] + b * perp[1]]);
      const root = [FAN.x, 1.4 * Math.sin(phi)];
      for (const [a0, a1, out] of [
        [0, 0.6 * L, plumes],
        [0.6 * L, 0.76 * L, plumeBands],
        [0.76 * L, L, plumeTips],
      ]) {
        const g = flatPlate(toPlan(featherOutline(L, 3.6, a0, a1)), 0, 1.2);
        if (FAN.roll[i]) {
          // 外側羽片：繞「過羽根、俯視垂直於羽軸」的水平軸轉，羽尖往上翹
          const axis = new THREE.Vector3(perp[0], 0, perp[1]);
          g.translate(-root[0], 0, -root[1]);
          g.applyMatrix4(new THREE.Matrix4().makeRotationAxis(axis, (-FAN.roll[i] * Math.PI) / 180));
          g.translate(root[0], 0, root[1]);
        }
        // 以羽根為支點往後上揚
        g.translate(-FAN.x, 0, 0);
        g.rotateZ((-FAN.tilt * Math.PI) / 180);
        g.translate(FAN.x, yRoot, 0);
        out.push(g);
      }
    });
    parts.push({ geometry: mergeGeos(plumes), mat: 'plume', solid: true, outline: true, name: 'quetzal-plume-fan' });
    parts.push({ geometry: mergeGeos(plumeBands), mat: 'red2', solid: true, outline: true, name: 'quetzal-plume-bands' });
    parts.push({ geometry: mergeGeos(plumeTips), mat: 'turq2', solid: true, outline: true, name: 'quetzal-plume-tips' });
    // 長羽根部的束帶（海菊蛤紅橫向圓肋，根部融進殼面）
    const bandPts = [];
    for (let k = 0; k <= 8; k++) {
      const z = lerp(-7, 7, k / 8);
      bandPts.push([FAN.x - 0.6, kit.surf.topY(FAN.x - 0.6, z) - 0.2, z]);
    }
    parts.push({ geometry: sweepEllipse(bandPts, 16, () => [1.6, 1.3], 10), mat: 'red2', solid: true, outline: true, name: 'plume-binding' });

    // 蛇身側羽：沿兩側稜線下方伸出的短羽片（羽蛇身上的羽毛），每側 5 片、往後掠，根部埋進立板；俯視外緣成一列羽齒
    /** @type {number[]} 側羽中心 x */
    // iter-115：x 8 那對拿掉（位置被腹側裙板取代，也省質量）
    const SIDE_FEATHERS = [-52, -37, -22, -7];
    /** @type {THREE.BufferGeometry[]} */
    const sideFeathers = [];
    for (const xc of SIDE_FEATHERS) {
      const zr = halfW(xc) - 1.6;
      const y = ridgeY(xc) - 2.6;
      // iter-113：羽片往外加長（外伸 5.6 → 7.8），俯視一列更明顯的羽齒
      const pts = [
        [xc + 3.2, zr],
        [xc + 1.4, zr + 4.6],
        [xc - 3.4, zr + 7.8],
        [xc - 6.6, zr + 7.2],
        [xc - 3.4, zr + 3.2],
        [xc - 3.4, zr],
      ];
      for (const sg of [-1, 1]) {
        sideFeathers.push(flatPlate(pts.map(([x, z]) => [x, sg * z]), y, 1.2));
      }
    }
    parts.push({ geometry: mergeGeos(sideFeathers), mat: 'plume', solid: true, outline: true, name: 'serpent-side-feathers' });

    // 綠松石馬賽克小片（頂面，避開座艙與眼窩）：iter-114 改大片、變少——深色 16%、淺色 10%（原 22% / 14%）
    /** @type {(lo: number, hi: number) => import('./loft.js').KeepFn} */
    const tiles = (lo, hi) => (x, y, z) => {
      if (y < ridgeY(x) + 0.4 || kit.underCanopy(x, z) > -0.8 || eyeSd(x, y, z) < 1.2) {
        return -1;
      }
      // iter-121：小片排成往前尖的箭羽列（x 依 |z| 錯開 = 往後掃）、密度由蛇頭往車尾遞減（速度感）
      const f = lerp(0.45, 1.25, smoothstep(-60, 60, x));
      return mosaic(x + 0.55 * Math.abs(z), z, lo * f, hi * f);
    };
    parts.push({ geometry: kit.decal(tiles(0, 0.16)), mat: 'dTurqDark', name: 'decal-mosaic-dark' });
    parts.push({ geometry: kit.decal(tiles(0.16, 0.26)), mat: 'dTurqLight', name: 'decal-mosaic-light' });

    // iter-121 往後掃的 livery：頂面兩側沿稜線內側的海菊蛤紅寬條（1.8）＋螺貝白細條（0.7），從吻端一路掃到車尾
    /** @type {(x: number) => number} 紅條中心距稜線的內縮量（蛇頭段 2.2、車身段 4.2） */
    const stripeIn = (x) => lerp(4.2, 2.2, smoothstep(30, 60, x));
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < ridgeY(x) + 0.3 || x < X_TAIL + 3 || x > 76 || kit.underCanopy(x, z) > -0.6 || eyeSd(x, y, z) < 0.8) {
          return -1;
        }
        return 0.9 - Math.abs(Math.abs(z) - (halfW(x) - stripeIn(x)));
      }),
      mat: 'dRed',
      name: 'decal-sweep-red',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < ridgeY(x) + 0.3 || x < X_TAIL + 3 || x > 75 || kit.underCanopy(x, z) > -0.6 || eyeSd(x, y, z) < 0.8) {
          return -1;
        }
        return 0.35 - Math.abs(Math.abs(z) - (halfW(x) - stripeIn(x) - 1.8));
      }),
      mat: 'dShell',
      name: 'decal-sweep-white',
    });
    // 稜線下方的海菊蛤紅細線（沿波浪稜線，蛇身蜿蜒）
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < halfW(x) - 0.5 || x < X_TAIL + 2 ? -1 : 0.35 - Math.abs(y - (ridgeY(x) - 1.5)))),
      mat: 'dRed',
      name: 'decal-ridge-line',
    });
    // 階梯回紋帶（螺貝白，連續帶）：車身立板上，x −66 → 20，帶高 5.2（立板下緣往上 0.9 起）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < halfW(x) - 0.5 || x < -66 || x > 20) {
          return -1;
        }
        // 左側 u 反向，兩側紋樣都往車頭方向前進
        const u = z < 0 ? -x : x;
        return -fretSd(u - 1000, y - (tableroY(x) + 0.9));
      }),
      mat: 'dShell',
      name: 'decal-step-fret',
    });

    // 黑曜石眼窩外的深綠松石細眼框（iter-124：原螺貝白寬眼圈讀成卡通眼白，改成 0.45 mm 的石雕刻線框）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = eyeSd(x, y, z);
        return d > 5 ? -1 : Math.min(d - 0.1, 0.55 - d);
      }),
      mat: 'dTurqDark',
      name: 'decal-eye-ring',
    });
    // 鼻孔：前臉上方兩個黑曜石小橢圓
    parts.push({
      geometry: kit.decal((x, y, z) => (y < 24 ? -1 : 0.9 - Math.hypot((x - 69.6) / 1.5, Math.abs(z) - 4.2))),
      mat: 'dObsidian',
      name: 'decal-nostrils',
    });
    // 嘴線（黑曜石色）：蛇頭側面口線，後端往上捲（嘴角上揚的羽蛇頭像）；iter-113 取代原本整排白牙
    parts.push({
      geometry: kit.decal(
        sideDecal(
          (u, v) => {
            if (u < 58 || u > 79) {
              return 1;
            }
            const line = Math.max(Math.abs(v - 17.6) - 0.45, 61.4 - u);
            // 嘴角：口線後端往上繞半圈的鉤（圓心 (61.4, 20.2)、半徑 2.6）
            const corner = Math.max(Math.abs(Math.hypot(u - 61.4, v - 20.2) - 2.6) - 0.45, u - 61.4);
            return Math.min(line, corner);
          },
          { x0: 0, y0: 0, zMin: 3 },
        ),
      ),
      mat: 'dObsidian',
      name: 'decal-mouth-line',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P＋ridgeY / tableroY（推估）：外框長 151.5（車尾羽尖 x −70.9 → 蛇信 x 80.6，≤ 153）、殼頂約 33；iter-121：蛇頭頂 30 → 楔形吻端 22.4（拿掉上捲蛇吻）、羽領頂約 37、座艙罩頂 38.5（全車最高）、車尾平躺羽扇頂約 35.6（原立起長羽 52.9）；細頸半寬 14.5（26 mm 前輪內側面 25.25 之內）；後輪拱 R15.5（26 mm 輪半徑 13 + 2.5，只支援 26 mm 輪）',
    feathers: 'iter-121：羽領外圈 9 片（長 19、寬 10、厚 1.6，往後倒 58° / 66°）＋內圈 8 片（長 9、厚 1.4）、車尾平躺羽扇 5 片（長 14–20、厚 1.2、往後升 7°）、毒牙、口頂板、蛇信：ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；根部埋進殼面',
    myth: '羽蛇頭＋羽毛領、黑曜石眼窩、藍底彩繪：MYTH_RESEARCH A2（特奧蒂瓦坎羽蛇神殿）、A3（Met 00.5.111 羽蛇頭）；綠松石 / 海菊蛤紅 / 螺貝白牙：A6（大英博物館雙頭蛇）；階梯回紋：A7',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
