// 新致敬款的車殼註冊（tortoise-dome / marlin-sail / owl-hush；index.js 只匯入這個陣列）
import { tortoiseDomeBody } from './tortoiseDome.js';
import { marlinSailBody } from './marlinSail.js';
import { owlHushBody } from './owlHush.js';

/** @typedef {import('./types').BodyDef} BodyDef */

/** @type {BodyDef[]} */
export const homageBodiesA = [tortoiseDomeBody, marlinSailBody, owlHushBody];
