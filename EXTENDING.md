# 擴充說明：新增零件 / 車殼 / 組裝設定

座標一律是車體座標：x 向前、y 向上、z 向右，原點在前後軸中點的地面，單位 mm（SPEC 1.14）。
整車的質量、重心、慣性矩、外框、迎風面積**只**由 `src/assembly.js` 從零件資料推導，不要在別處另外寫死數值。

## 新增一個零件款式
1. 在 `src/parts/<類別>.js` 的陣列加一筆，欄位照同類別的現有零件（例如 `motors.js` 的 `motor-standard`）：
   - 必填：`id`（全專案唯一）、`category`、`name`、`mass_g`、`src`（每個數值的來源或「推估」依據，**不准捏造來源**）。
   - 類別特有欄位：馬達 `noLoadRpm_atRated` / `stallTorque_atRated_Nm` / `stallCurrent_atRated_A` / `noLoadCurrent_A`；齒輪 `ratio` 與節圓半徑；輪胎 `diameter_mm` / `width_mm` / `rimDiameter_mm` / 摩擦；導輪 `diameter_mm` / `height_mm`；導輪架 `rollerX_mm` / `rollerZ_mm` / 高度……
2. 同步更新 `SPEC.md` 1.13 零件規格表。
3. 在組裝設定（`configs/*.json`）的對應 slot 填新 id 就會生效；模型、物理、規則檢查都自動跟著換。
4. 跑 `node scripts/score.mjs` 確認 16/16；`validateAssembly()` 會擋下不合規的組合（例如 1.5 以外的齒輪比、輪徑超出 22–35 mm、130 以外的馬達）。

slot 與類別對照（`src/assembly.js` 的 `SLOTS`）：
`chassis`、`motor`、`gear`、`wheels`、`bearings`、`rollers`、`frontStay`（stay-front）、`rearStay`（stay-rear）、`battery`、`batteryCover`、`switch`、`axles`、`gearCover`、`hardware`，另外 `body` 填車殼 id。
slot 也可以填 `{ "base": "<零件 id>", ...覆寫欄位 }` 做臨時變體（測試 P11 用這個製造違規組裝）。

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
複製 `configs/default.json` 改 slot，並在 `src/assembly.js` 的 `CONFIGS` 註冊名稱，之後 `loadConfig('<名稱>')` 即可使用。
