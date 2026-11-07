// 車殼模組型別
import type { Group } from 'three';
import type { Vec3 } from '../parts/types';

export interface BodyMount extends Vec3 {
  id: string;
}

/** 神話體系代號（清單與中文名稱見 mythSeries.js） */
export type MythSeries =
  | 'greek'
  | 'roman'
  | 'norse'
  | 'egyptian'
  | 'mesopotamian'
  | 'celtic'
  | 'slavic'
  | 'finnish'
  | 'japanese'
  | 'chinese'
  | 'hindu'
  | 'mesoamerican'
  | 'polynesian';

export interface BodyDef {
  id: string;
  category: 'body';
  /** 'homage' = 致敬《爆走兄弟》風格；'race' = 常見比賽車殼型式；'myth' = 神話主題（GOAL「車殼」、SPEC P20） */
  style: 'homage' | 'race' | 'myth';
  /** 一句話主題 */
  theme: string;
  /** 上線的階段（新致敬款為 4；P20 只把 phase 4 的 homage 算成新致敬款） */
  phase?: number;
  /** 車頂型態（P20：新致敬款兩兩比較用） */
  roof?: 'closed' | 'canopy' | 'open-cockpit' | 'clear' | 'skeleton';
  /** 尾翼型式（P20：新致敬款兩兩比較用，例如 'none'、'twin-fin'、'forked'、'grille'、'high-wing'、'duck-tail'） */
  wing?: string;
  /** 致敬哪一部作品（P20）：'lg1' = 第一部、'lg2' = 續作 WGP；只有 style 'homage' 需要 */
  homageSeries?: 'lg1' | 'lg2';
  /** 比賽車殼型態代號（P20，定義見 shared/reference/BODY_RACE_RESEARCH.md）；只有 style 'race' 需要 */
  raceType?: string;
  /** 神話體系（P20）；只有 style 'myth' 需要 */
  mythSeries?: MythSeries;
  /** 神話主題代號（P20，神話組內不可重複），例如 'trojan-horse'、'sleipnir'；只有 style 'myth' 需要 */
  mythTheme?: string;
  /** 車身型態代號（P20：同組兩兩比較、每組至少 3 種），例如 'full-cowl'、'wedge'、'open-wheel' */
  form?: string;
  name: string;
  /** 'ABS' | 'PC' 等，決定密度 */
  material: string;
  density_g_cm3: number;
  /** 殼壁厚（mm）；質量 = 結構殼面積 × 壁厚 × 密度 */
  wallThickness_mm: number;
  /** 車殼安裝點（底盤座標，必須和底盤的 bodyMounts 對齊） */
  mounts: BodyMount[];
  /** 建模：回傳名為 'body' 的群組；結構殼的子群組標 userData.shell = true */
  build: (mats: Record<string, unknown>) => Group;
  src: Record<string, string>;
}

/** 由幾何算出的車殼質量性質（底盤座標） */
export interface BodyMassProps {
  shellArea_mm2: number;
  mass_g: number;
  /** 殼面部分（面積 × 壁厚 × 密度） */
  shellMass_g: number;
  /** 實體件部分（封閉體積 × 密度，userData.solid） */
  solidMass_g: number;
  solidVolume_mm3: number;
  com_mm: Vec3;
  /** Full central inertia tensor, including products of inertia (g·mm²). */
  inertia_gmm2: { xx: number; yy: number; zz: number; xy: number; xz: number; yz: number };
  bbox_mm: { min: Vec3; max: Vec3 };
  /** 車殼所有頂點（底盤座標，xyz 交錯） */
  vertices: Float32Array;
}
