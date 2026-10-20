// 零件目錄：依 id 查零件，或解析組裝設定的 slot 值（id 或 { base, ...覆寫 }）
import { chassisParts } from './chassis.js';
import { motorParts } from './motors.js';
import { gearParts } from './gears.js';
import { wheelParts } from './wheels.js';
import { bearingParts } from './bearings.js';
import { rollerParts } from './rollers.js';
import { stayParts } from './stays.js';
import { batteryParts } from './batteries.js';
import { miscParts } from './misc.js';

/** @typedef {import('./types').PartBase} PartBase */
/** @typedef {import('./types').SlotValue} SlotValue */

/** @type {PartBase[]} */
export const allParts = [
  ...chassisParts,
  ...motorParts,
  ...gearParts,
  ...wheelParts,
  ...bearingParts,
  ...rollerParts,
  ...stayParts,
  ...batteryParts,
  ...miscParts,
];

/** @type {Map<string, PartBase>} */
const byId = new Map(allParts.map((p) => [p.id, p]));

/** @type {(id: string) => PartBase} */
export const getPart = (id) => {
  const p = byId.get(id);
  if (!p) {
    throw new Error(`未知的零件 id：${id}`);
  }
  return p;
};

/** @type {(category: string) => PartBase[]} */
export const listParts = (category) => allParts.filter((p) => p.category === category);

/**
 * 解析 slot 值：字串 = 零件 id；物件 = 以 base 零件為底覆寫欄位（id 標成 base+custom）
 * @type {(value: SlotValue, category: string) => PartBase}
 */
export const resolvePart = (value, category) => {
  let part;
  if (typeof value === 'string') {
    part = getPart(value);
  } else {
    const { base, ...over } = value;
    part = { ...getPart(base), ...over, id: `${base}+custom` };
  }
  if (part.category !== category) {
    throw new Error(`零件 ${part.id} 的類別是 ${part.category}，不能裝在 ${category}`);
  }
  return part;
};
