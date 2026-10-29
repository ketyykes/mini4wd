// B10（iter-109）：附件 vs 底盤 3D 網格干涉。原本只有側制振器檢查底盤側面（chassisSideSolids），
// 其他附件（導輪板、制振器、海綿、配重、穩定頭）和底盤本體沒有檢查。這裡用底盤本體網格（與質量分布同一份）的表面取樣點，
// 對每個示範設定逐一換裝每個 slot 的每個零件（只算規則合法的組合），檢查附件實體不穿進底盤。
// 門檻：有號距離 ≥ −1e-6 mm——安裝面本來就貼合（距離 0），只容許浮點誤差，不容許任何穿透
import { test, expect, beforeAll } from 'vitest';
import { assemble, loadConfig, SLOTS, OPTIONAL_SLOTS } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';
import { listParts } from '../src/parts/index.js';
import { verticesGap } from '../src/parts/clearance.js';
import { initRapier } from '../src/sim.js';
import { chassisSurfaceSamples } from './helpers/chassisMesh.js';

beforeAll(async () => {
  await initRapier();
});

const CONFIGS = ['default', 'p5-taiwan', 'p7-demo', 'p7-parts', 'vz-demo', 'vz-tuned'];
const SWAP_SLOTS = ['massDamper', 'brakeSponge', 'brakePlate', 'ballast', 'stabilizer', 'frontStay', 'rearStay', 'frontRollers', 'rearRollers', 'frontRollerAngle', 'rearRollerAngle'];

test('P18_chassis_mesh_clearance 附件（導輪板、制振器、海綿、配重、穩定頭）不穿進底盤本體 3D 網格（MA／VZ，示範設定逐 slot 換裝）', () => {
  /** @type {Map<string, Float32Array>} 底盤網格只隨底盤與導輪板（保桿切除）改變 */
  const meshCache = new Map();
  let checked = 0;
  /** @type {{ gap: number, where: string }} */
  let worst = { gap: Infinity, where: '' };
  for (const name of CONFIGS) {
    const base = loadConfig(name);
    for (const slot of SWAP_SLOTS) {
      /** @type {(string | null)[]} */
      const ids = listParts(SLOTS[slot]).map((q) => q.id);
      if (OPTIONAL_SLOTS.includes(slot)) ids.push(null);
      for (const id of ids) {
        const asm = assemble({ ...base, [slot]: id });
        if (validateAssembly(asm).violations.length) continue;
        checked++;
        const key = JSON.stringify([asm.partsBySlot.chassis.id, asm.partsBySlot.frontStay.id, asm.partsBySlot.rearStay.id]);
        if (!meshCache.has(key)) meshCache.set(key, chassisSurfaceSamples(asm));
        const pts = meshCache.get(key);
        for (const s of asm.optional.solids) {
          if (s.mountingHardware) continue;
          const g = verticesGap(pts, s.solid);
          if (g < worst.gap) worst = { gap: g, where: `${name} ${slot}=${id}：${s.label}` };
          expect(g, `${name} ${slot}=${id}：${s.label} 穿進底盤`).toBeGreaterThanOrEqual(-1e-6);
        }
      }
    }
  }
  console.log(`[P18_chassis_mesh] ${checked} 組合法組裝、${meshCache.size} 種底盤網格；最小間隙 ${worst.gap.toFixed(3)} mm（${worst.where}）`);
  expect(checked).toBeGreaterThan(250);
}, 600000);
