import { expect, test } from 'vitest';
import * as THREE from 'three';
import { bodySilhouette, frontalArea, silhouetteArea } from '../src/bodies/silhouette.js';
import { bumperTrim, bumperGeometry } from '../src/parts/bumperGeom.js';
import { chassisParts } from '../src/parts/chassis.js';
import { assemble, loadConfig } from '../src/assembly.js';
import { spec } from '../src/spec.js';

const square = {
  id: 'test-front-square',
  build: () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 10));
    mesh.userData.shell = true;
    return new THREE.Group().add(mesh);
  },
};
const triangle = {
  id: 'test-front-triangle',
  build: () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -5, -5, 0, -5, 5, 0, 5, -5], 3));
    const mesh = new THREE.Mesh(geometry);
    mesh.userData.shell = true;
    return new THREE.Group().add(mesh);
  },
};

test('P13_frontal_projection 同外框的方形與三角形使用不同正面面積；聯集不重算遮蔽部分', () => {
  expect(silhouetteArea(bodySilhouette(square, 'front')).area_mm2).toBe(100);
  const triArea = silhouetteArea(bodySilhouette(triangle, 'front')).area_mm2;
  // A 0.5 mm raster includes centers on the diagonal (max error 2.5 mm²).
  expect(Math.abs(triArea - 50)).toBeLessThanOrEqual(2.5);
  const covered = { min: { y: -5, z: -5 }, max: { y: 5, z: 0 } };
  const separate = { min: { y: -5, z: 10 }, max: { y: 5, z: 20 } };
  expect(frontalArea(square, [covered])).toBe(100);
  expect(frontalArea(square, [separate])).toBe(200);
  expect(frontalArea(square, [], 2.5)).toBe(100);
  expect(frontalArea(null, [covered])).toBe(50);
  const asm = assemble(loadConfig('default'));
  expect(asm.P.airDragK).toBeCloseTo(0.5 * spec.aero.airDensity * spec.aero.dragCoeff * asm.frontalArea_mm2 * 1e-6, 12);
});

test('P14_bumper_ribs 切除質量按鏤空肋格聯集積分，前後對稱，材料密度線性，厚度變化會重新積分', () => {
  const ch = chassisParts[0];
  const front = bumperTrim(ch, 1), rear = bumperTrim(ch, -1);
  const geometry = bumperGeometry(ch, 1);
  expect(geometry.skinThickness + geometry.ribDepth).toBe(ch.bumperThickness_mm);
  expect(geometry.ribHoles.length).toBeGreaterThan(geometry.wideHoles.length);
  expect(front.mass_g).toBeGreaterThan(0);
  expect(Math.abs(front.mass_g - rear.mass_g) / front.mass_g).toBeLessThan(0.002);
  expect(Math.abs(front.com_mm.x + rear.com_mm.x)).toBeLessThan(0.1);
  const denser = bumperTrim({ ...ch, density_g_cm3: 2 * ch.density_g_cm3 }, 1);
  expect(denser.mass_g).toBeCloseTo(2 * front.mass_g, 9);
  const thicker = bumperTrim({ ...ch, bumperThickness_mm: 3.4 }, 1);
  expect(thicker.mass_g).toBeGreaterThan(front.mass_g);
});
