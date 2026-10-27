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
  | { kind: 'plate'; outline: [number, number][]; holes?: [number, number][][]; y0: number; y1: number }
  | { kind: 'profileZ'; outline: [number, number][]; holes?: [number, number][][]; z0: number; z1: number }
  | { kind: 'sweepZ'; source: Solid; halfStroke: number };

/** 組裝後一個零件實例的實體（干涉檢查的對象） */
export interface PlacedSolid {
  /** 干涉群組：tire、roller、stay、damper、sponge、ballast、stabilizer（第四階段） */
  group: string;
  slot: string;
  label: string;
  solid: Solid;
  mountingHardware?: boolean;
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
  | 'stabilizer'
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
  /** 對自身質心、車體座標軸的慣性張量（g·mm²）；未提供的零件仍採既有近似 */
  inertia_gmm2?: { xx: number; yy: number; zz: number; xy: number; xz: number; yz: number };
}

/** 傳動系轉動慣量（parts/inertia.js drivetrainInertia；第四階段） */
export interface SpinInertia {
  /** 單件繞自身軸的慣量（g·mm²）：輪子（胎＋框）、輪軸、輪軸齒輪、中間齒輪、小齒輪、電樞 */
  perItem_gmm2: { wheel: number; axle: number; spur: number; counter: number; pinion: number; armature: number };
  /** 各項換算到輪軸後（×轉速比²、×件數）的值（g·mm²） */
  reflected_gmm2: { wheels: number; axles: number; spurGears: number; counterGears: number; motor: number };
  total_gmm2: number;
  /** J_eq（kg·m²） */
  total_kgm2: number;
  /** J_eq / r²（g）：縱向運動多出來的等效質量 */
  equivalentMass_g: number;
}

/** 整車規格（asm.spec.chassis.frontRoller / rearRoller）中一端導輪的款式（iter-56：前後導輪分開選） */
export interface RollerSpec {
  id: string;
  /** 最大接觸直徑（mm） */
  diameter_mm: number;
  height_mm: number;
  /** 'plastic' | 'aluminum'（3D 材質） */
  finish: string;
  /** 疊放的接觸片（雙層導輪）；單層為 null */
  tiers: RollerTier[] | null;
  /** 錐形導輪輪廓；一般導輪為 null */
  taper: { cylinderHeight_mm: number; coneHeight_mm: number; bottomDiameter_mm: number } | null;
  /** 外環（第五階段：橡膠 O 環 / 塑膠環，環的外緣就是接觸直徑）；沒有外環為 null */
  ring: RollerRing | null;
}

/** 雙層導輪的一片接觸面（由下而上；y_mm = 相對導輪中心的高度） */
export interface RollerTier {
  diameter_mm: number;
  height_mm: number;
  y_mm: number;
  /** 第七階段（iter-76）：這片自己的牆面摩擦 / 恢復係數（沒有時用零件層級的值） */
  wallFriction?: number;
  restitution?: number;
  /** 第七階段（iter-76）：這片自己的外環（例如 15418 上層橡膠環）；沒有時無外環 */
  ring?: RollerRing;
}

/** 導輪外環（第五階段）：只影響 3D 外形；接觸直徑、摩擦、恢復係數、質量仍取零件本身的欄位 */
export interface RollerRing {
  /** 'rubber'（橡膠 O 環，圓截面）| 'plastic'（塑膠環，矩形截面） */
  material: 'rubber' | 'plastic';
  /** 環的截面厚度（徑向，mm） */
  thickness_mm: number;
  /** 環的高度（軸向，mm；O 環 = 線徑） */
  height_mm: number;
  /** 3D 顏色（0xRRGGBB） */
  color: number;
}

/** 擺好位置的一顆導輪（底盤座標，assembly.js rollerLayoutOf；asm.layout.rollers 另加 lift） */
export interface PlacedRoller {
  /** FL、FR、RL、RR、RUL、RUR */
  id: string;
  x: number;
  y: number;
  z: number;
  /** 最大接觸半徑、總高（mm） */
  r: number;
  h: number;
  tiers: { y: number; r: number; h: number }[];
  /** 所屬 slot：frontRollers 或 rearRollers */
  slot: 'frontRollers' | 'rearRollers';
  partId: string;
  finish: string;
  taper: RollerSpec['taper'];
  ring: RollerSpec['ring'];
}

/** 滑動保桿（第五階段 iter-61）：滑動板相對底盤沿車身 z（左右）1 自由度，彈簧＋預壓＋阻尼，行程端點硬止擋 */
export interface SlideSpec {
  /** 單邊行程（mm）：滑動板可從中央往左右各滑這麼多，端點為硬止擋 */
  stroke_mm: number;
  /** 彈簧常數（N/mm） */
  springK_N_per_mm: number;
  /** 預壓（N）：中央位置時彈簧已壓縮、由中央擋塊承受的力 */
  preload_N: number;
  /** 阻尼比（相對彈簧常數與滑動質量） */
  dampingRatio: number;
  /** 中央擋塊的接觸變形（mm）：預壓在這段距離內由 0 連續升到 preload_N */
  seatDeflection_mm: number;
  /** 滑動板質量（g，由外形推導） */
  plateMass_g: number;
  /** 樹脂滑軌（固定在底盤）：底盤座標的方塊 */
  rail: { xMin_mm: number; xMax_mm: number; halfZ_mm: number; y_mm: number; thickness_mm: number; density_g_cm3: number };
  railMass_g: number;
  /** 彈簧、螺絲等小五金（固定在底盤） */
  hardware_g: number;
  /** 彈簧外形（3D 用）：x 位置、內外端 |z|、線圈外徑、線徑、圈數、顏色 */
  spring: { x_mm: number; innerZ_mm: number; outerZ_mm: number; coilDiameter_mm: number; wireDiameter_mm: number; turns: number; color: number };
}

/** 組裝後的滑動保桿（asm.slider = 前、asm.rearSlider = 後，iter-64；車體座標）：滑動部分 = 滑動板＋裝在上面的導輪（前款另含穩定零件） */
export interface PlacedSlider {
  slot: 'frontStay' | 'rearStay';
  /** 裝在這塊滑動板上的導輪 slot */
  rollerSlot: 'frontRollers' | 'rearRollers';
  partId: string;
  /** 滑動部分的零件標籤（asm.parts 的 label） */
  labels: string[];
  mass_g: number;
  com_mm: Vec3;
  /** 滑動部分對自身質心的主慣性（kg·m²） */
  inertia_kgm2: Vec3;
  inertiaTensor_kgm2: { xx: number; yy: number; zz: number; xy: number; xz: number; yz: number };
  inertiaFrame: { x: number; y: number; z: number; w: number };
  stroke_mm: number;
  springK_N_per_mm: number;
  preload_N: number;
  dampingRatio: number;
  seatDeflection_mm: number;
}
