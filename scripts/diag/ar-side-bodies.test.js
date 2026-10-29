// AR 側制振器 15459 × 全部車殼（iter-111）：MA（default）與 VZ（vz-demo）各裝一次，列出制振器與車殼的最小間隙（負值 = 穿入）
import { test } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';
import { listBodies } from '../../src/bodies/index.js';
import { getPart } from '../../src/parts/index.js';

// MOUNT="y,z,spacer" 暫時改 MA 側制振器座（只在本診斷）
if (process.env.MOUNT) {
  const [y, z, sp] = process.env.MOUNT.split(',').map(Number);
  getPart('chassis-midship').sideDamperMount = { x_mm: 0, z_mm: z, y_mm: y, spacer_mm: sp };
}

test('ar-side × bodies', () => {
  for (const base of (process.env.BASES ?? 'default,vz-demo').split(',')) {
    let hit = 0;
    const rows = [];
    for (const b of listBodies()) {
      const cfg = { ...loadConfig(base), massDamper: process.env.DAMPER ?? 'damper-ar-side', body: b.id };
      let asm;
      try {
        asm = assemble(cfg);
      } catch (e) {
        rows.push(`${b.id}: 組裝失敗 ${e.message.slice(0, 60)}`);
        continue;
      }
      const g = (asm.interference ?? []).find((c) => c.code === 'DAMPER_BODY_CLEARANCE');
      const codes = validateAssembly(asm).violations.map((v) => v.code);
      if (codes.includes('DAMPER_BODY_CLEARANCE')) {
        hit++;
      }
      rows.push(`${b.id}: 間隙 ${g ? g.gap_mm.toFixed(2) : '—'} mm ${codes.join(',')}`);
    }
    console.log(`ARSIDE ${base}：${hit}/${listBodies().length} 款車殼干涉\n  ${rows.join('\n  ')}`);
  }
});
