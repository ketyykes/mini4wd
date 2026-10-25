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
| 煞車海綿 | `sponge-1mm-strong`、`sponge-2mm-strong`、`sponge-3mm-mild` | 貼在 1.5 mm FRP 煞車板（`brakePlate`，質量另列一項）下，煞車板鎖在後導輪架 `brakeMount` 下方；接觸剛性 k = E·A/t、摩擦 μ，只在射線碰到地面 / 坡道時有力 |
| 配重 | `ballast-hex-1g`、`ballast-square-3.6g` | `mountPoints` + `@安裝點`；前 / 後鎖在保桿或導輪板下方（導輪板有 `ballastMount` 時改鎖在板面上，例如後板尾端）、中央貼在齒輪蓋頂面 |

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
   - 有厚度的實體件（牙板、鰭、尾翼、衝角、擋板、駕駛人剪影等）標 `userData.solid = true`（可附 `{ density_g_cm3 }`），質量 = 封閉網格體積（散度定理）× 密度，網格必須封閉、繞向朝外；
   - 會改變外輪廓的薄件（角、尾鰭、前翼）另標 `userData.outline = true`，P20 的輪廓 IoU 只看 `shell` 與 `outline`（「計入質量」與「計入輪廓」是兩組獨立標記）；
   - `BodyDef` 填 `style: 'homage' | 'race'`（致敬風格 / 常見比賽型）與 `theme`；
   - 材質設 `material.name`（Blender 管線靠名稱對應寫實材質，規則見 `web/export.js` 的 `categoryFromName`，例如 `paint-*`、`pc-clear-*`、`pc-smoke-*`、`lamp-*`、`plastic-*-black`、`brass-*`）。
4. 在 `src/bodies/index.js` 的 `bodies` 陣列註冊。
5. 驗證：`node scripts/score.mjs`（P08 質量範圍、P09 外框、P15 安裝點與間隙 ≥ 1 mm、P16 每款車殼各跑官方 3 圈、P20 與其他車殼的側視 / 俯視輪廓 IoU < 0.85，`src/bodies/silhouette.js`）；要支援 31 mm 大徑輪，輪拱需在底盤抬高 2.5 mm 後仍與輪胎間隙 ≥ 1 mm；`node scripts/render.mjs <iter> side,front34,top,rear34 <body-id>` 看截圖；`../render/run.sh <body-id> 128` 出 Blender 展示圖（指定組裝設定：`CONFIG=<名稱> ../render/run.sh <body-id|-> 128`）；網頁換件頁會自動列出新車殼與新零件（`node scripts/garage-shots.mjs <iter> [查詢字串]` 截圖）。

## 新增一份組裝設定
現有：`default`、`speed`（高轉速馬達）、`technical`（4:1＋19 mm 導輪）、`light`（鏤空車殼）、`race-frp`（FRP 前後導輪板＋13 mm 鋁導輪＋扭力型馬達＋3.7:1＋1 mm 煞車海綿（貼在 FRP 煞車板下）＋後板 1 g 黃銅配重）、`carbon-damper`（碳纖前板＋碳纖寬後板＋13-12 mm 雙層導輪＋後制振器＋低摩擦胎）。新設定必須合法（P18 會檢查所有 `configs/*.json`）。
複製 `configs/default.json` 改 slot，並在 `src/assembly.js` 的 `CONFIGS` 註冊名稱，之後 `loadConfig('<名稱>')` 即可使用。


## iter-88：幾何、穩健性與網頁紀錄
- `parts/bumperGeom.js` 同時提供保桿上蓋、肋格、凸台、斜撐和補強片的定義。切除質量以材料聯集扣掉保留結構後積分，不能再把凸台與板重疊的部分重複加總；上蓋 1.0 mm、肋深 1.4 mm 是推估尺寸。前後保桿按同一份鏡射定義，體積快取不包含密度，密度只影響最後換算。
- 迎風面積使用 `bodies/silhouette.js` 的 `front` 投影（z–y，0.5 mm 格點，保留鏤空），與其他零件的靜止外框投影取聯集。新車殼要正確標記 `shell` / `outline`；側視與俯視的 P20 算法維持原定義。C_d 仍為推估 0.6。
- `tests/robustness.test.js`：10 款制振器 × 12 種落地 × 可動／鎖死，以及 4 套組裝 × 8 種起跑位置／車道／SOC 組合。量測輸出在 `tmp/robustness.json`。新增制振器時要擴充 `dampers` 清單。
- 車庫的比較基準固定組裝數值；換件後顯示差值。三圈完賽依模擬跨線時間計時，排行只存在本機 `mini4wd-results-v1`，保留最快 20 筆。未完賽不記錄，禁止儲存時仍可完成模擬。之後若更改物理或賽道，須更新 `garageResults.js` 的紀錄版本，避免混比成績。
- 3D 的滑動板、導輪柱、導輪與穩定頭使用 `userData.sliderSlot`，由 `race.pose().sliders` 的實際相對位移驅動；固定滑軌不應標記。回車庫時位移歸零。

## iter-89：碰撞、慣性與重運算

- `src/bodies/collision.js` 從 `shell`／`solid` 幾何建立 12 × 32 × 48 mm 分區點雲；`sim.js` 使用各區局部方塊組成複合碰撞與內部邊緣修正。不要將裝飾貼紙納入結構；小於分區的凹陷仍是近似。區內曲率與凹陷仍是方塊近似；不得回到整車外框填實。穿牆檢查使用實際碰撞代理的外緣頂點。
- 車殼慣性用 `bodyMassProps().inertia_gmm2` 的完整中心張量；組裝輸出 `inertiaTensor_kgm2`、`inertiaFrame` 及主慣性 `inertia_kgm2`。新的剛體必須把主軸方向一併交給 Rapier；轉動動能也要先轉入主軸。
- `sweepZ` 表示滑動的完整掃掠，不能只檢查兩個端點；同一滑板上的零件需保留相同運動，不能獨立掃掠後互相比較。
- 滑動板的彈簧衝量由 `applySliderSpringImpulses` 以整個有關節系統的 `M⁻¹Q` 施加，不能只對車身和一塊板加原始剛體衝量，否則會暫時破壞共同角速度。`sliderLimits.test.js` 檢查這項關係，以及未碰牆時的預測式止擋、線動量／動能與不做位置投影。
- 重運算用 `python3 scripts/heavy.py --label <說明> -- <指令> [參數]`。`npm test`、`npm run render`、`npm run score` 與根目錄 `render/run.sh` 已接入。其他專案可使用相同腳本，並將 `MINI4WD_HEAVY_LOCK` 設為同一個絕對路徑。預設為系統暫存目錄的 `codex-heavy-compute.lock`；不要刪除這個鎖檔，核心鎖會隨持有程序結束釋放。
- `python3 scripts/heavy_test.py` 檢查跨程序互斥、失效回收、wrapper 被殺而 child 仍活著、逾時及訊號轉送。只有使用相同協定的工作才會互斥。
