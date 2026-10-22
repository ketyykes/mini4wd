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
import { massDamperParts, brakeSpongeParts, ballastParts, brakePlateParts } from './options.js';
import { stabilizerParts } from './stabilizers.js';
import { counterShaftParts } from './counterShafts.js';

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
  ...massDamperParts,
  ...brakeSpongeParts,
  ...ballastParts,
  ...stabilizerParts,
  ...counterShaftParts,
  ...brakePlateParts,
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
 * 解析 slot 值：
 * - 字串 = 零件 id；可用 `id@安裝點` 指定安裝位置（例如 `ballast-hex-1g@front`，安裝點須在零件的 mountPoints 內，否則由規則檢查器擋下）
 * - 物件 = 以 base 零件為底覆寫欄位（id 標成 base+custom）；只覆寫 mount 時 id 不變
 * - null = 不裝（只允許選配 slot，由 assembly.js 判斷）
 * @type {(value: SlotValue, category: string) => PartBase}
 */
export const resolvePart = (value, category) => {
  let part;
  if (typeof value === 'string') {
    const [id, mount] = value.split('@');
    part = getPart(id);
    if (mount !== undefined) {
      part = { ...part, mount };
    }
  } else {
    const { base, ...over } = value;
    const keys = Object.keys(over);
    const mountOnly = keys.length === 1 && keys[0] === 'mount';
    part = { ...getPart(base), ...over, id: mountOnly ? base : `${base}+custom` };
  }
  if (part.category !== category) {
    throw new Error(`零件 ${part.id} 的類別是 ${part.category}，不能裝在 ${category}`);
  }
  if (part.mountPoints && part.mount === undefined) {
    part = { ...part, mount: part.defaultMount };
  }
  return part;
};
