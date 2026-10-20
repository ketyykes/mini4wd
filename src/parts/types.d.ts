// 零件與組裝的共用型別（JSDoc 以 import('./types').X 引用）

/** 所有零件共有的欄位 */
export interface PartBase {
  id: string;
  category: PartCategory;
  name: string;
  /** 單件質量（g）；成組零件（例如齒輪組）為整組 */
  mass_g: number;
  /** 來源或推估依據（欄位名 → 說明） */
  src: Record<string, string>;
  [key: string]: unknown;
}

export type PartCategory =
  | 'chassis'
  | 'motor'
  | 'gear'
  | 'wheel'
  | 'bearing'
  | 'roller'
  | 'stay-front'
  | 'stay-rear'
  | 'battery'
  | 'battery-cover'
  | 'switch'
  | 'axle'
  | 'body';

/** 組裝設定的 slot 值：零件 id，或以某零件為底、覆寫部分欄位 */
export type SlotValue = string | ({ base: string } & Record<string, unknown>);

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 組裝後放在車上的一個零件實例（位置為車體座標，mm，指該實例的質心） */
export interface PlacedPart {
  slot: string;
  id: string;
  category: PartCategory;
  label: string;
  mass_g: number;
  pos: Vec3;
}
