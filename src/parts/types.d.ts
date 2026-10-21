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
  /** 相容性：chassisLayouts = 適用的底盤馬達配置；requires = 需要的安裝點（由底盤 / 導輪架的 features 提供） */
  compat?: PartCompat;
  /** 這個零件提供的安裝點（底盤、導輪架） */
  features?: string[];
  [key: string]: unknown;
}

export interface PartCompat {
  chassisLayouts?: string[];
  requires?: string[];
}

/** 干涉檢查用的實體形狀（底盤座標，mm） */
export type Solid =
  | { kind: 'box'; min: Vec3; max: Vec3 }
  | { kind: 'cyl'; axis: 'y' | 'z'; c: Vec3; r: number; halfLen: number }
  | { kind: 'plate'; outline: [number, number][]; y0: number; y1: number };

/** 組裝後一個零件實例的實體（干涉檢查的對象） */
export interface PlacedSolid {
  /** 干涉群組：tire、roller、stay、damper、sponge、ballast */
  group: string;
  slot: string;
  label: string;
  solid: Solid;
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
  | 'gear-cover'
  | 'hardware'
  | 'mass-damper'
  | 'brake-sponge'
  | 'ballast'
  | 'body';

/** 組裝設定的 slot 值：零件 id，或以某零件為底、覆寫部分欄位 */
export type SlotValue = string | null | ({ base: string } & Record<string, unknown>);

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
