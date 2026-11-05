// 新致敬款的車殼註冊（gazelle-leap / halo-orbit / dartfrog-hop；index.js 只匯入這個陣列）
import { gazelleLeapBody } from './gazelleLeap.js';
import { haloOrbitBody } from './haloOrbit.js';
import { dartfrogHopBody } from './dartfrogHop.js';

/** @typedef {import('./types').BodyDef} BodyDef */

/** @type {BodyDef[]} */
export const homageBodiesB = [gazelleLeapBody, haloOrbitBody, dartfrogHopBody];
