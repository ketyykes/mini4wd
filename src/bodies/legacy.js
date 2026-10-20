// 第一階段車殼（過渡用基準）：外型沿用第一階段的參考車款，iter-31 起已移除所有品牌字樣。
// 原創車殼完成後從 index.js 移除。
import { buildLegacyBody } from '../bodyShell.js';
import { getPart } from '../parts/index.js';

/** @type {import('./types').BodyDef} */
export const legacyBody = {
  id: 'legacy',
  category: 'body',
  name: '第一階段車殼（過渡用）',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 1.0,
  mounts: getPart('chassis-midship').bodyMounts.map((m) => ({ ...m })),
  build: (mats) => buildLegacyBody(mats),
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出成型車殼壁厚約 1 mm',
    mounts: '對齊 chassis-midship 的車殼安裝點',
  },
};
