// GLB 匯出頁：建整台車 → 依材質屬性標註類別（寫進名稱與 userData → glTF extras）→ GLTFExporter（binary）
// 由 scripts/export-glb.mjs 以 Playwright 開啟：export.html?body=<車殼 id>
// 完成後設定 window.__glb（base64）與 window.__exportReport；失敗時設定 window.__exportError
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildCarModel } from '../src/model.js';
import { assemble, loadConfig } from '../src/assembly.js';

/**
 * 建立要匯出的車輛模型（模型 API 改為依組裝設定 / 車殼 id 建模時，只需改這個函式）
 * bodyId：車殼 id（預設 body-wedge；'none' 只匯出底盤）；回傳單位 mm，x 向前、y 向上、z 向右
 * @type {(bodyId: string) => THREE.Object3D}
 */
// eslint-disable-next-line no-unused-vars
const buildModelForExport = (bodyId) => {
  // iter-33：依車殼 id 組裝（預設組裝＋指定車殼）；'none' 只匯出底盤
  const config = loadConfig('default');
  if (bodyId && bodyId !== 'none') {
    config.body = bodyId;
  }
  return buildCarModel(assemble(config), { body: bodyId !== 'none' });
};

/** @type {string[]} 所有可能帶貼圖的材質欄位 */
const TEXTURE_SLOTS = [
  'map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap',
  'clearcoatMap', 'clearcoatRoughnessMap', 'clearcoatNormalMap', 'sheenColorMap', 'sheenRoughnessMap',
  'iridescenceMap', 'iridescenceThicknessMap', 'specularIntensityMap', 'specularColorMap',
  'transmissionMap', 'thicknessMap', 'displacementMap', 'lightMap', 'anisotropyMap',
];

/**
 * 判斷網格所屬區塊（車殼 / 輪組 / 底盤）
 * 規則：往上找祖先，名稱或 userData.part 含 body / shell → body；含 wheel / tire → wheel；都沒有 → chassis
 * （buildCarModel 結構：mini4wd > sprung > chassis / wheel-<id> / body）
 * @type {(obj: THREE.Object3D, root: THREE.Object3D) => 'body' | 'wheel' | 'chassis'}
 */
const zoneOf = (obj, root) => {
  for (let o = obj; o && o !== root; o = o.parent) {
    const tag = `${o.name || ''} ${o.userData && typeof o.userData.part === 'string' ? o.userData.part : ''}`.toLowerCase();
    if (tag.includes('body') || tag.includes('shell')) {
      return 'body';
    }
    if (tag.includes('wheel') || tag.includes('tire') || tag.includes('tyre')) {
      return 'wheel';
    }
  }
  return 'chassis';
};

/**
 * 依材質屬性推斷寫實材質類別（Blender 端依此重新指定 Principled BSDF）
 * @param {THREE.Material} mat
 * @param {'body' | 'wheel' | 'chassis'} zone
 * @returns {string}
 */
function classifyMaterial(mat, zone) {
  const color = mat.color ? mat.color : new THREE.Color(1, 1, 1);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const metalness = mat.metalness ?? 0;
  const roughness = mat.roughness ?? 1;
  const clearcoat = mat.clearcoat ?? 0;
  const transmission = mat.transmission ?? 0;
  const emissiveStrength = mat.emissive ? Math.max(mat.emissive.r, mat.emissive.g, mat.emissive.b) * (mat.emissiveIntensity ?? 1) : 0;
  const isDecal = mat.polygonOffset === true;
  const isTranslucent = transmission > 0.01 || (mat.transparent === true && mat.opacity < 0.95);

  if (isTranslucent) {
    if (hsl.l > 0.6) {
      return 'lens';
    }
    return 'glass';
  }
  if (emissiveStrength > 0.05) {
    return 'lamp';
  }
  // 程序化 DataTexture 圖樣（目前只有碳纖網格）→ Blender 端改用程序化碳纖材質
  if (mat.map && mat.map.isDataTexture) {
    return 'carbon';
  }
  if (zone === 'wheel' && roughness >= 0.85 && metalness < 0.1) {
    return 'rubber';
  }
  if (mat.map && isDecal) {
    return 'decal';
  }
  if (metalness >= 0.8) {
    return 'metal';
  }
  if (zone === 'body' && !isDecal && metalness >= 0.5 && clearcoat >= 0.9 && hsl.s > 0.25) {
    return 'paint';
  }
  if (isDecal) {
    return 'decal';
  }
  if (zone === 'wheel' && metalness >= 0.3) {
    return 'rim';
  }
  if (metalness >= 0.3) {
    return 'metallic_plastic';
  }
  if (hsl.l < 0.3 && hsl.s < 0.35) {
    if (roughness < 0.5) {
      return 'plastic_gloss';
    }
    return 'plastic_matte';
  }
  if (!mat.vertexColors) {
    return 'plastic_color';
  }
  return 'unknown';
}

/**
 * 依材質原名對應類別（優先於屬性推斷）；對不到回傳 null
 * 名稱慣例見 src/bodies：paint-*、pc-smoke / pc-clear、decal-*、lamp-*、shell-inner-dark 等
 * @type {(name: string, mat?: THREE.Material) => string | null}
 */
const categoryFromName = (name, mat) => {
  const n = (name || '').toLowerCase();
  if (!n) {
    return null;
  }
  /** @type {[RegExp, string][]} 依序比對，先符合先採用 */
  const rules = [
    [/^decal-/, 'decal'],
    [/^lamp-.*(lens|cover)/, 'lens'],
    [/^lamp-/, 'lamp'],
    [/pc-clear|clear-pc|lens/, 'lens'],
    [/pc-smoke|smoke|glass|canopy-glass/, 'glass'],
    [/pearl/, 'paint_pearl'],
    [/metallic|^paint-.*metal/, 'paint'],
    [/^paint-/, 'paint_gloss'],
    [/inner|interior|dark-matte/, 'plastic_matte'],
    [/carbon/, 'carbon'],
    [/^frp-/, 'frp'],
    [/^sponge-/, 'sponge'],
    [/rubber|tire|tyre/, 'rubber'],
    [/(^|-)(abs|plastic|pom|nylon)(-|$)/, (mat && (mat.roughness ?? 1) < 0.5) ? 'plastic_gloss' : 'plastic_matte'],
    [/chrome|steel|(^|-)(metal|alu|aluminium|brass|copper)(-|$)/, 'metal'],
  ];
  for (const [re, cat] of rules) {
    if (re.test(n)) {
      return cat;
    }
  }
  return null;
};

/**
 * 只保留 userData 中可 JSON 序列化的原始值（字串 / 數字 / 布林），避免 GLTFExporter 序列化材質物件
 * @type {(ud: Record<string, unknown> | undefined) => Record<string, string | number | boolean>}
 */
const plainUserData = (ud) => {
  /** @type {Record<string, string | number | boolean>} */
  const out = {};
  for (const [k, v] of Object.entries(ud || {})) {
    if (['string', 'number', 'boolean'].includes(typeof v)) {
      out[k] = v;
    }
  }
  return out;
};

/** side 列舉 → 字串 */
function sideName(side) {
  if (side === THREE.BackSide) {
    return 'back';
  }
  if (side === THREE.DoubleSide) {
    return 'double';
  }
  return 'front';
}

/**
 * 為所有材質與網格命名、寫入 userData（GLTFExporter 會輸出成 extras）
 * @param {THREE.Object3D} root
 * @returns {{ meshes: number, materials: Record<string, number> }} 統計
 */
function annotateModel(root) {
  /** @type {Map<THREE.Material, string>} */
  const matNames = new Map();
  /** @type {Record<string, number>} */
  const counts = {};
  let meshIndex = 0;
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.isMesh) {
      return;
    }
    const zone = zoneOf(obj, root);
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const cats = [];
    for (const mat of mats) {
      if (!matNames.has(mat)) {
        const origName = mat.name || '';
        const category = categoryFromName(origName, mat) ?? classifyMaterial(mat, zone);
        counts[category] = (counts[category] ?? 0) + 1;
        // 有原名就沿用原名（Blender 依 extras 的 m4Category 換材質，名稱只給人看）；沒有才用 m4_<類別>_NNN
        const name = origName || `m4_${category}_${String(matNames.size).padStart(3, '0')}`;
        matNames.set(mat, name);
        const c = mat.color ? mat.color : new THREE.Color(1, 1, 1);
        // userData 可能含不可序列化的物件（例如 inner.userData.flange 是另一個材質）：只保留可序列化的原始值，再補上匯出資訊
        mat.userData = {
          ...plainUserData(mat.userData),
          m4Name: origName,
          m4CategorySource: categoryFromName(origName, mat) ? 'name' : 'props',
          m4Category: category,
          m4Zone: zone,
          m4Side: sideName(mat.side),
          m4Decal: mat.polygonOffset === true,
          m4VertexColors: mat.vertexColors === true,
          m4Color: [c.r, c.g, c.b],
          m4Metalness: mat.metalness ?? 0,
          m4Roughness: mat.roughness ?? 1,
          m4Clearcoat: mat.clearcoat ?? 0,
          m4Opacity: mat.opacity ?? 1,
        };
        mat.name = name;
      }
      cats.push(matNames.get(mat));
    }
    const first = mats[0].userData.m4Category;
    const origMesh = obj.name || '';
    obj.name = `${zone}_${first}_${String(meshIndex).padStart(4, '0')}${origMesh ? `_${origMesh}` : ''}`;
    obj.userData = { ...plainUserData(obj.userData), m4MeshName: origMesh, m4Zone: zone, m4Materials: cats.join(','), m4Side: mats[0].userData.m4Side };
    meshIndex += 1;
  });
  /** @type {string[]} 每個材質一行摘要（除錯用） */
  const list = [...matNames.entries()].map(([m, n]) => {
    const u = m.userData;
    const hex = m.color ? `#${m.color.getHexString()}` : '-';
    return `${n} [${u.m4Category}/${u.m4CategorySource}] ${u.m4Zone} ${hex} met=${u.m4Metalness} rough=${u.m4Roughness} cc=${u.m4Clearcoat} op=${u.m4Opacity} side=${u.m4Side} map=${Boolean(m.map)}`;
  });
  return { meshes: meshIndex, materials: counts, materialList: list };
}

/**
 * DataTexture（例如橡膠雜訊、碳纖網格）轉成 CanvasTexture：GLTFExporter 只能 drawImage 畫布 / 圖片，
 * 直接匯出 DataTexture 會丟出 drawImage 型別錯誤。只處理 Uint8 RGBA，其他格式移除該貼圖
 * @type {(root: THREE.Object3D) => number} 回傳轉換數量
 */
const convertDataTextures = (root) => {
  /** @type {Map<THREE.Texture, THREE.Texture | null>} */
  const cache = new Map();
  /** @type {(tex: THREE.DataTexture) => THREE.Texture | null} */
  const toCanvas = (tex) => {
    const { data, width, height } = tex.image;
    if (!(data instanceof Uint8Array || data instanceof Uint8ClampedArray) || data.length !== width * height * 4) {
      return null;
    }
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    const ctx = cv.getContext('2d');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
    const out = new THREE.CanvasTexture(cv);
    out.wrapS = tex.wrapS;
    out.wrapT = tex.wrapT;
    out.repeat.copy(tex.repeat);
    out.offset.copy(tex.offset);
    out.flipY = tex.flipY;
    out.colorSpace = tex.colorSpace;
    return out;
  };
  let converted = 0;
  root.traverse((obj) => {
    if (!obj.isMesh) {
      return;
    }
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      for (const slot of TEXTURE_SLOTS) {
        const tex = mat[slot];
        if (!tex || !tex.isDataTexture) {
          continue;
        }
        if (!cache.has(tex)) {
          cache.set(tex, toCanvas(tex));
          converted += 1;
        }
        mat[slot] = cache.get(tex);
      }
    }
  });
  return converted;
};

/** 移除所有貼圖（GLTFExporter 處理 Canvas 貼圖失敗時的退路） */
function stripTextures(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) {
      return;
    }
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      for (const slot of TEXTURE_SLOTS) {
        if (mat[slot]) {
          mat[slot] = null;
        }
      }
    }
  });
}

/** ArrayBuffer → base64（分段避免 call stack 過深） */
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

/** @param {THREE.Object3D} root */
async function exportGlb(root) {
  const exporter = new GLTFExporter();
  return exporter.parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
}

async function main() {
  const params = new URLSearchParams(location.search);
  const bodyId = params.get('body') || 'body-wedge';
  const model = buildModelForExport(bodyId);
  model.name = `mini4wd_${bodyId}`;
  model.userData = { m4BodyId: bodyId, m4Units: 'mm', m4Axes: 'x-forward,y-up,z-right' };
  // GLTFExporter 只匯出 Scene 或 Object3D；包一層 Scene 讓根節點名稱固定
  const scene = new THREE.Scene();
  scene.add(model);
  const report = annotateModel(model);
  const dataTexturesConverted = convertDataTextures(model);
  let texturesStripped = false;
  let glb;
  try {
    glb = await exportGlb(scene);
  } catch (e) {
    console.warn('含貼圖匯出失敗，移除貼圖後重試：', e && e.message);
    stripTextures(model);
    texturesStripped = true;
    glb = await exportGlb(scene);
  }
  const box = new THREE.Box3().setFromObject(model);
  window.__exportReport = {
    bodyId,
    ...report,
    dataTexturesConverted,
    texturesStripped,
    bytes: glb.byteLength,
    bboxMin: box.min.toArray(),
    bboxMax: box.max.toArray(),
  };
  window.__glb = toBase64(glb);
}

main().catch((e) => {
  window.__exportError = String(e && e.stack ? e.stack : e);
});
