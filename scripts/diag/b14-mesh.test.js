// B14 診斷：由 VZ 3D 模型網格重算底盤質心與每 g 慣性（寫回 chassis.js 用）
import { test } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { chassisMeshDistribution } from '../../tests/helpers/chassisMesh.js';

test('b14 mesh', () => {
  const asm = assemble({ ...loadConfig('vz-demo'), body: null, frontStay: 'stay-front-standard', rearStay: 'stay-rear-vz' });
  const d = chassisMeshDistribution(asm);
  console.log(JSON.stringify(d));
});
