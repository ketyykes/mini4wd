// 第三階段：車殼造型差異（P20，定義見 SPEC.md 第 2 部分）
// - 至少 6 款車殼：致敬《爆走兄弟》風格（style 'homage'）≥ 3、常見比賽車殼型式（style 'race'）≥ 3
// - 任兩款的側視 / 俯視輪廓 IoU 都低於門檻（量法見 src/bodies/silhouette.js：外形三角形投影、0.5 mm 光柵化、填滿輪廓、同安裝點座標）
// - 至少 2 款與 31 mm 大徑輪（wheel-31-large）組裝合法
import { describe, test, expect } from 'vitest';
import { listBodies } from '../src/bodies/index.js';
import { bodyIoU } from '../src/bodies/silhouette.js';
import { assemble, loadConfig } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';

/** @type {number} 輪廓 IoU 門檻（GOAL 建議 0.85；SPEC 若修改門檻須同步此常數，不可為了讓相似款通過而放寬） */
const IOU_MAX = 0.85;

describe('第三階段：車殼造型差異（P20）', () => {
  test('P20_body_variety 至少 6 款（致敬 ≥ 3、比賽型 ≥ 3）、任兩款側視 / 俯視輪廓 IoU < 門檻、至少 2 款可裝 31 mm 輪胎', () => {
    const bodies = listBodies();
    const homage = bodies.filter((b) => b.style === 'homage');
    const race = bodies.filter((b) => b.style === 'race');
    console.log(`[P20] 車殼 ${bodies.length} 款：致敬 ${homage.map((b) => b.id).join(', ')}；比賽型 ${race.map((b) => b.id).join(', ')}`);
    expect(bodies.length).toBeGreaterThanOrEqual(6);
    expect(homage.length).toBeGreaterThanOrEqual(3);
    expect(race.length).toBeGreaterThanOrEqual(3);

    let worstSide = 0;
    let worstTop = 0;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const r = bodyIoU(bodies[i], bodies[j]);
        console.log(`[P20] IoU ${bodies[i].id} × ${bodies[j].id}：側視 ${r.side.toFixed(3)}、俯視 ${r.top.toFixed(3)}`);
        worstSide = Math.max(worstSide, r.side);
        worstTop = Math.max(worstTop, r.top);
        expect(r.side, `${bodies[i].id} × ${bodies[j].id} 側視輪廓太像`).toBeLessThan(IOU_MAX);
        expect(r.top, `${bodies[i].id} × ${bodies[j].id} 俯視輪廓太像`).toBeLessThan(IOU_MAX);
      }
    }
    console.log(`[P20] 最大 IoU：側視 ${worstSide.toFixed(3)}、俯視 ${worstTop.toFixed(3)}（門檻 ${IOU_MAX}）`);

    const bigWheelOk = bodies.filter((b) => {
      const asm = assemble({ ...loadConfig('default'), body: b.id, wheels: 'wheel-31-large' });
      const v = validateAssembly(asm);
      console.log(`[P20] ${b.id} + wheel-31-large：${v.ok ? '合法' : `不合法（${v.violations.map((x) => x.code).join(', ')}）`}，車殼–輪胎間隙 ${asm.fit.tire_mm.toFixed(2)} mm`);
      return v.ok;
    });
    expect(bigWheelOk.length).toBeGreaterThanOrEqual(2);
  }, 300000);
});
