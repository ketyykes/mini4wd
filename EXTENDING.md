# 擴充說明：新增零件 / 車殼 / 組裝設定

座標一律是車體座標：x 向前、y 向上、z 向右，原點在前後軸中點的地面，單位 mm（SPEC 1.14）。
整車的質量、重心、慣性矩、外框、迎風面積**只**由 `src/assembly.js` 從零件資料推導，不要在別處另外寫死數值。

## 新增一個零件款式
1. 在 `src/parts/<類別>.js` 的陣列加一筆，欄位照同類別的現有零件（例如 `motors.js` 的 `motor-standard`）：
   - 必填：`id`（全專案唯一）、`category`、`name`、`mass_g`、`src`（每個數值的來源或「推估」依據，**不准捏造來源**）。
   - 類別特有欄位：馬達 `noLoadRpm_atRated` / `stallTorque_atRated_Nm` / `stallCurrent_atRated_A` / `noLoadCurrent_A`；齒輪 `ratio` 與節圓半徑；輪胎 `diameter_mm` / `width_mm` / `rimDiameter_mm` / 摩擦；導輪 `diameter_mm` / `height_mm`；導輪架 `rollerX_mm` / `rollerZ_mm` / 高度……
2. 同步更新 `SPEC.md` 1.13 零件規格表。
3. 在組裝設定（`configs/*.json`）的對應 slot 填新 id 就會生效；模型、物理、規則檢查都自動跟著換。
4. 宣告相容性（`compat`、`features`、`mountPoints`，見下方）與實體形狀需要的尺寸；跑 `node scripts/score.mjs` 確認全部通過（P17 / P18 會自動把新零件納入兩兩組合檢查）；`validateAssembly()` 會擋下不合規的組合（`violations`，例如 1.5 以外的齒輪比、輪徑超出 22–35 mm、130 以外的馬達），車殼與輪胎 / 導輪干涉也算違規（`BODY_TIRE_CLEARANCE` / `BODY_ROLLER_CLEARANCE`，例如換 31 mm 大徑輪時現有三款車殼的輪拱會被輪胎穿進）。要支援大徑輪，需要新增輪拱較大的車殼款式。

slot 與類別對照（`src/assembly.js` 的 `SLOTS`）：
`chassis`、`motor`、`gear`、`wheels`、`bearings`、`rollers`、`frontStay`（stay-front）、`rearStay`（stay-rear）、`battery`、`batteryCover`、`switch`、`axles`、`gearCover`、`hardware`，
第三階段新增**選配 slot**（`OPTIONAL_SLOTS`，值可為 `null` = 不裝；組裝設定沒寫也視為 `null`）：`massDamper`（mass-damper）、`brakeSponge`（brake-sponge）、`ballast`（ballast）。另外 `body` 填車殼 id。

slot 值的寫法：
- 零件 id：`"motor-torque"`。
- 指定安裝點：`"ballast-hex-1g@front"`（配重的 `mountPoints` 為 `front` / `center` / `rear`；不在清單內的安裝點由 `MOUNT_COMPAT` 擋下）。也可寫 `{ "base": "ballast-hex-1g", "mount": "rear" }`（只覆寫 `mount` 時 id 不變）。
- 臨時變體：`{ "base": "<零件 id>", ...覆寫欄位 }`（id 變成 `<base>+custom`，測試 P11 用這個製造違規組裝）。制振器可用 `{ "base": "damper-rear-cylinder", "locked": true }` 表示用螺帽鎖死（當固定配重，不建可滑動剛體）。
- 網頁選單可用 `slotChoices(slot)` 取得 `{ value, label }[]`（含配重安裝點展開與「不裝」）。

### 第三階段零件一覽
| 類別 | id | 重點 |
| --- | --- | --- |
| 馬達 | `motor-standard`、`motor-torque`、`motor-high-rev`、`motor-sprint`、`motor-single-standard` | 線性模型參數由官方建議負載點解出（PARTS_RESEARCH 第 2 節、K 節）；單軸馬達裝不上本底盤（`MOTOR_CLASS`） |
| 齒輪 | `gear-3.5`、`gear-3.7`、`gear-4.0`、`gear-4.2` | `compat.chassisLayouts`；4.2:1 只適用單軸底盤（`GEAR_CHASSIS`） |
| 輪胎 | `wheel-26-lowprofile`、`wheel-31-large`、`wheel-24-narrow`、`wheel-26-lowfriction` | 低摩擦胎 μ = 0.4 |
| 導輪 | `roller-13`、`roller-13-alu`、`roller-19`、`roller-13-12-double` | 雙層導輪用 `tiers`（每片接觸面一顆碰撞球）；導輪架的導輪高度以 5 mm 單層導輪為準，較高的導輪往上長 |
| 前導輪架 | `stay-front-standard`、`stay-front-frp`、`stay-front-carbon` | 板件 `plate`（俯視外形、開孔、板底高度、厚度、密度）→ 質量 = 面積 × 厚度 × 密度；`chassisTrim` = 裝這塊板時剪掉底盤保桿導輪臂，切除幾何在 `src/parts/bumperGeom.js`（模型與質量共用），`assemble()` 從底盤本體扣除質量與重心 |
| 後導輪架 | `stay-rear-standard`、`stay-rear-frp`、`stay-rear-carbon-wide` | `upperRollerHeight_mm: null` 為單層（可裝雙層導輪）；`brakeMount`（煞車座）、`damperMount`（後制振器座） |
| 制振器 | `damper-rear-cylinder`、`damper-side-square` | 獨立 Rapier 剛體＋prismatic joint（行程 `stroke_mm` 為硬止點），下止點是單邊彈性座墊（`seatDeflection_mm`、`seatDampingRatio`） |
| 煞車海綿 | `sponge-1mm-strong`、`sponge-2mm-strong`、`sponge-3mm-mild` | 貼在後導輪架 `brakeMount` 下方；接觸剛性 k = E·A/t、摩擦 μ，只在射線碰到地面 / 坡道時有力 |
| 配重 | `ballast-hex-1g`、`ballast-square-3.6g` | `mountPoints` + `@安裝點`；前 / 後鎖在保桿或導輪板下方、中央貼在齒輪蓋頂面 |

### 相容性欄位
- 零件 `compat.chassisLayouts`：適用的底盤配置（`chassis.motorLayout`，例如 `dual-shaft`）。不符 → `GEAR_CHASSIS`。
- 零件 `compat.requires`：需要的安裝點；底盤與導輪架用 `features` 提供（`side-damper-mount`、`rear-damper-mount`、`rear-brake-mount`）。缺少 → `MOUNT_COMPAT`。
- 配重 `mountPoints` / `mount`：安裝點不在清單 → `MOUNT_COMPAT`。
- 新零件只要宣告這些欄位，`validateAssembly` 就會自動檢查；不用改規則檢查器。

### 實體干涉（間隙 < 1 mm 為違規）
`assemble()` 把零件轉成簡單實體（`src/parts/clearance.js`：方塊、圓柱、板件稜柱；制振器用整個行程掃過的範圍），兩兩算最小間隙（`asm.interference`），車殼用 `bodyMassProps(body).vertices` 的頂點對零件實體算距離。代碼依群組順序 `ballast → damper → sponge → stay → roller → tire` 組成 `<A>_<B>_CLEARANCE`，例如：
`STAY_TIRE_CLEARANCE`、`ROLLER_TIRE_CLEARANCE`、`ROLLER_ROLLER_CLEARANCE`、`DAMPER_BODY_CLEARANCE`、`DAMPER_TIRE_CLEARANCE`、`SPONGE_TIRE_CLEARANCE`、`BALLAST_SPONGE_CLEARANCE`、`BALLAST_BODY_CLEARANCE`、`STAY_BODY_CLEARANCE` 等（完整清單與中文說明：`regulation.js` 匯出的 `VIOLATION_CODES`）。
鎖在導輪板上的零件（海綿、配重、制振器）與導輪板本來就接觸，不檢查這一對。離地高度 `GROUND_CLEARANCE` 也包含導輪板、海綿、配重、制振器的最低點。

### 物理（`src/sim.js`）
零件只透過物理量影響模擬：質量 / 重心 / 慣性由零件推導；制振器是另一個剛體（車體剛體用 `asm.rigid` = 整車扣掉可滑動的制振器，兩者合計 = `asm.mass_g`）；煞車海綿是接觸力（`spongeForces`），沒碰到地面就沒有力；`carKineticEnergy(car)` 給滑行能量檢查用。

## 新增一款車殼
1. 設計：在 `shared/design/<body-id>/` 放概念圖與 `DESIGN.md`（靈感來源、prompt、尺寸表），用 `python3 -I shared/design/tools/body_sheets.py` 由尺寸表產生 `sections.json` 並自動檢查與輪胎 / 導輪 / 底盤的間隙。原創設計，不得有任何廠商商標、產品名、真實車名。
2. 把 `sections.json` 複製成 `app/src/bodies/data/<body-id>.json`。
3. 新增 `app/src/bodies/<name>.js`，匯出一個 `BodyDef`（型別見 `src/bodies/types.d.ts`），寫法參考 `wedge.js` / `skeleton.js` / `aeroWing.js`：
   - `makeLoftKit(data, { mode: 'linear' | 'smooth' })` 產生外殼曲面，再用 `buildRegion` 依塗裝 / 貼紙 / 開口的保留函式切出各區塊；
   - `mounts` 一律用 `getPart('chassis-midship').bodyMounts`（前 (52,13,0)、後 (−50,15,0)）；
   - 外殼外表面的 mesh 標 `userData.shell = true`（只標一次；內面、貼紙、燈具不標），質量 = 面積 × `wallThickness_mm` × `density_g_cm3`；
   - 材質設 `material.name`（Blender 管線靠名稱對應寫實材質）。
4. 在 `src/bodies/index.js` 的 `bodies` 陣列註冊。
5. 驗證：`node scripts/score.mjs`（P08 質量範圍、P09 外框、P15 安裝點與間隙 ≥ 1 mm、P16 跑圈會自動涵蓋新車殼）；`node scripts/render.mjs <iter> side,front34,top,rear34 <body-id>` 看截圖；`../render/run.sh <body-id> 128` 出 Blender 展示圖。

## 新增一份組裝設定
現有：`default`、`speed`（高轉速馬達）、`technical`（4:1＋19 mm 導輪）、`light`（鏤空車殼）、`race-frp`（FRP 前後導輪板＋13 mm 鋁導輪＋扭力型馬達＋3.7:1＋2 mm 煞車海綿＋中央 1 g 配重）、`carbon-damper`（碳纖前板＋碳纖寬後板＋13-12 mm 雙層導輪＋後制振器＋低摩擦胎）。新設定必須合法（P18 會檢查所有 `configs/*.json`）。
複製 `configs/default.json` 改 slot，並在 `src/assembly.js` 的 `CONFIGS` 註冊名稱，之後 `loadConfig('<名稱>')` 即可使用。
