// 車殼模組型別
import type { Group } from 'three';
import type { Vec3 } from '../parts/types';

export interface BodyMount extends Vec3 {
  id: string;
}

export interface BodyDef {
  id: string;
  category: 'body';
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
  com_mm: Vec3;
  bbox_mm: { min: Vec3; max: Vec3 };
  /** 車殼所有頂點（底盤座標，xyz 交錯） */
  vertices: Float32Array;
}
