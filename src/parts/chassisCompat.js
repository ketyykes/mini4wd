// B14：零件 ↔ 底盤相容表。只列「只能裝在某些底盤」的零件；沒列的零件兩款底盤都能裝
// 依據：shared/reference/VZ_RESEARCH.md 第 3 節（官方商品頁「シャーシ一覧」逐頁抽取，[C]）。
// 馬達單／雙軸（MOTOR_CLASS）、齒輪組（GEAR_CHASSIS）、側制振器座（MOUNT_COMPAT）另有檢查，不重複列在這裡

/** @type {Record<string, { chassis: string[], src: string }>} */
export const CHASSIS_ONLY = {
  'battery-cover-standard': { chassis: ['chassis-midship'], src: 'MA 一體式底盤的底面電池蓋（[NAO] 1.6 g），VZ 用電池扣（battery-cover-vz）' },
  'gear-cover-standard': { chassis: ['chassis-midship'], src: 'MA 馬達＋前後齒輪固定蓋（[NAO] 5.5 g），VZ 只有後方齒輪蓋（gear-cover-vz）' },
  'stay-rear-standard': { chassis: ['chassis-midship'], src: 'MA 一體後保桿上的上下雙層導輪架；VZ 的後導輪架是螺絲固定的分件（stay-rear-vz，[VZ 2.4]）' },
  'stay-front-slide-soft': { chassis: ['chassis-midship'], src: '[VZ 3.1] 15469 前寬滑動保桿：一覽不含 VZ（說明「MA､ARシャーシのフロントに装着可能」）' },
  'stay-front-slide-hard': { chassis: ['chassis-midship'], src: '[VZ 3.1] 15469 前寬滑動保桿：一覽不含 VZ' },
  'stay-front-slide-hard-carbon': { chassis: ['chassis-midship'], src: '[VZ 3.1] 15469 前寬滑動保桿（碳纖板 15548 本身含 VZ，但滑軌 15469 不含）' },
  'brake-rubber': { chassis: ['chassis-midship'], src: '[VZ 3.1] 15413 橡膠煞車組：一覽不含 VZ' },
  'switch-gold-terminal': { chassis: ['chassis-midship'], src: '[VZ 3.1] 15360 MS 金端子、15421 Super II 金端子：一覽不含 VZ' },
  'gear-shaft-ptfe': { chassis: ['chassis-midship'], src: '[VZ 3.1] 15390 含氟塗層齒輪軸：一覽不含 VZ（VZ 沒有 PRO 式中間齒輪軸）' },
  'damper-side-square-32': { chassis: ['chassis-midship'], src: '[VZ 3.1] 15490 MA 側制振器組：一覽不含 VZ（VZ 的側制振器座給 15459 AR 側制振器用）' },
  'counter-bearing-520': { chassis: ['chassis-midship'], src: '[VZ 3.1] 15347 PRO 齒輪培林組：一覽不含 VZ' },
  'battery-cover-vz': { chassis: ['chassis-vz'], src: 'VZ 底盤附屬的電池扣' },
  'gear-cover-vz': { chassis: ['chassis-vz'], src: 'VZ 底盤附屬的後齒輪蓋' },
  'stay-rear-vz': { chassis: ['chassis-vz'], src: 'VZ 底盤附屬的後導輪架（螺絲固定）' },
};
