// 第四階段新致敬款 A 組的車殼註冊（由 A 組 subagent 維護；index.js 只匯入這個陣列）
import { tortoiseDomeBody } from './tortoiseDome.js';
import { marlinSailBody } from './marlinSail.js';
import { owlHushBody } from './owlHush.js';

/** @typedef {import('./types').BodyDef} BodyDef */

/** @type {BodyDef[]} */
export const homageBodiesA = [tortoiseDomeBody, marlinSailBody, owlHushBody];
