# Track A 迭代紀錄（Three.js ＋ Rapier ＋ vitest ＋ Playwright）

> 這個檔案只放現行階段。第一到九階段（iter-00 ～ iter-127）的完整紀錄在 `ITERATION_LOG_HISTORY.md`，內容未改。
> 程式碼註解裡的「見 ITERATION_LOG iter-NN」、測試檔的「查證紀錄：ITERATION_LOG iter-NN」，iter-127 以前的都指那份檔案。

# 第十階段：神話車殼依 LG1 家族從頭重塑（2026-11-05 12:0x 起，截止 15:30）

## 第 0 輪（12:00–12:15）
- 基準：直接用 iter-127，也就是 app `e5c397b` 的結果（20/20，外觀 7.57），不重跑基準評審。
  - 16 款現行圖存到 `render/out/before-p10/`。
  - 現行神話陣容圖存到 `/tmp/mini4wd-p10/lineup-before/`。
- 評審 brief：`shared/REVIEWER_BRIEF.md` 加第十階段段落（4 個家族、逐款兩題「是 / 否」、是否算重塑）。
- 工作 brief：`/tmp/mini4wd-p10/brief.md`。

## iter-128 計畫（12:1x 派工，13:00 前交件）
| 組 | 車款 | 家族 | 重塑方向 |
| --- | --- | --- | --- |
| a | minotaur-maze | F2 | 蠻牛低頭衝撞：牛肩前擋泥板、金色新月角當前翼、收腰、迷宮回紋賽車條 |
| a | trojan-horse | F2 | 奔馳木馬：馬頸成引擎蓋脊、後腿肌肉後擋泥板、鬃毛背鰭、馬尾尾翼 |
| b | cerberus-trihead | F2 | 三犬吻：兩側前擋泥板加中央鼻錐成三個前伸量體；蛇尾做成貼身尾翼；避開 Black Saber |
| b | khepri-scarab | F2 | 聖甲蟲：分開的鞘翅後擋泥板、頭盾前分流、太陽圓盤大件；不用 V 形引擎蓋 |
| c | tanngrisnir-chariot | F1 | 低平刀鋒：山羊角往後捲成側鰭；不用雷紋與盧恩字母 |
| c | mushussu-gate | F4 | 蛇龍低伏：蛇頭鼻錐、獅爪前擋泥板、鷹爪後擋泥板、鰭刀尾 |
| d | yaga-hut | F3 | 奔跑的雞腳小屋：露輪跨步、瓦片 2 段後翼、煙流背鰭 |
| d | gundestrup-stag | F3 | 衝刺雄鹿：鹿角往後掃當翼端板；銀釜加金色浮雕帶；不畫神臉 |

- 預估：正面面積不比現行版大超過 3%；頂高 ≤ 49 mm；殼面＋實體 ≤ 第九階段基準的 1.1 倍。
- IoU 風險：
  - trojan × mantis 俯視已經是 0.843。
  - 北歐 F1 款之後會互相靠近；tanngrisnir 這輪先量。

## iter-128 結果（12:10–13:40）
- 4 組各交 2 款，合併後先修了兩對俯視 IoU：
  - trojan × tanngrisnir 0.864 → 由 tanngrisnir 收平面，降到 0.831。
  - cerberus × yaga 0.857、mushussu × yaga 0.8495 → 由 yaga 收鼻段與翼展，降到 0.830、0.825。
  - 修完後全部 35 款最大俯視 IoU 0.8425（aero-wing × mantis，原本就有的配對）。
- 評審（`shared/reviews/iter-128/REVIEW.md`）：
  - 本輪 8 / 7 / 8 / 7.5 / 7.5 / 7 / 8 = 7.57，對照 7.57。比例、炫砲度變好；辨識度、完成度變差。
  - 逐款判定：

    | 判定 | 車款 | 處理 |
    | --- | --- | --- |
    | 更炫、無差 | minotaur、trojan、cerberus | **保留** |
    | 更炫但有差 | khepri（辨識度、完成度）、tanngrisnir（辨識度、完成度） | iter-129 修 |
    | 持平或不算重塑 | mushussu、yaga、gundestrup | iter-129 修 |

  - 評審另提醒：希臘 3 款都是陶土橘配收腰，在陣容圖上像三兄弟。
- 計分 13:22–13:41：**19/20**。
  - P18_pairwise 跑到 605 s，超過 600 s 逾時；第九階段最終是 287 s，iter-126 在高負載下是 428 s。
  - 計分期間的負載：15 分鐘平均 12.6（同時有 subagent 在跑 body-check 和預覽）。
  - 計分途中誤合併了 khepri 的 iter-129 修正，所以這次分數只能當參考。
  - P16_collision_patches 76.1 s，比第九階段基準的 66.7 s 多 14%。
  - 結論：先單獨重跑 P18_pairwise，確認是負載還是新車殼變慢；不延長逾時。

## iter-129 結果與第十階段收尾（13:27–15:2x）
- 修 5 款（`shared/reviews/iter-129/REVIEW.md`）。評審本輪 8 / 7.5 / 8 / 7.5 / 7.5 / 7 / 8 = 7.64，對照 7.57。
  - 保留：
    - khepri：更炫、無差，三題皆「是」。
    - yaga：小幅更炫、無差，家族、不像擺件「是」，但重塑「否」；因為比現行版好而保留，不算完成重塑。
  - 退回 iter-127 版（app `ad9d78f`）：
    - tanngrisnir：辨識度差，羊讀不出來。
    - mushussu：持平；完成度、材質差；家族「否」。
    - gundestrup：家族「否」、重塑「否」。
- 計分：
  - iter-129（退回前）13:55–14:13：**20/20**，P16 83.2 s、P18_pairwise 323.6 s。
  - 退回後 14:42–15:09：18/20。P08_mass、P16_collision_patches 超過 120 s 逾時；同機另一個專案在跑 Playwright 和 tsc，負載 6–13。
  - 15:09–15:11 單獨重跑 P08、P16 都通過（各 95.6 s）。
  - 15:13 起再跑一次完整計分，結果見下一行。
- P16 / P18 交錯計時：
  - 14:17–14:27 那次，基準版和主線的 P16 都逾時，連沒改過的車殼也慢了一倍以上，數據作廢。
  - 14:36 重測，為了退回車殼中途停掉。
  - 所以完成條件第 5 條（不比基準慢 20%）**未確認**。
- 正面面積：神話組平均 2851.8 → 約 2840.9 mm²；有改的款最多 +2.3%（trojan）。
- 底部 / 賽道視角：為了讓最終計分趕在截止前，停掉了，保留款只有 front34、side、rear34 三視角。
- 臨時 worktree p10-a～d、p9-i118 已移除。
- 15:1x 使用者指示第十階段先暫停（要關閉 session）。15:13 起跑的完整計分在完成前停掉，沒有結果，互斥鎖已釋放。
  - 待辦和 P16 效能風險都記在 PROGRESS「第十階段結束狀態」。
  - 下次先在清閒時重量 P16 / P18 交錯計時，再繼續重塑。

# 整理：清除舊的製作紀錄（2026-11-05 18:13–21:5x，使用者要求）

## 計畫
- 使用者要求清除舊的製作紀錄、註解、文字、圖片，只留必要追溯的部分。不改任何行為。
- 預期：測試結果不受影響。整理前最後一次完整計分是 18/20，兩項是高負載逾時、單獨重跑通過。

## 改動
- **註解**：115 個程式檔（`src/`、`tests/`、`scripts/`、`web/`）拿掉輪次標籤、評審引文、舊值到新值的變化，只留做法與原因。
  - 測試檔說明容許值、期望值的註解保留理由，輪次改寫成「查證紀錄：ITERATION_LOG iter-NN」。
  - 明確的指標「見 ITERATION_LOG iter-NN」原樣保留。
- **說明字串**（第二批，使用者 19:4x 同意一起清）：46 個檔案。範圍是車殼與零件的 `src`／`theme` 欄位、6 個測試名稱、`tests/parts.test.js` 的 4 個標籤、`scripts/diag/fit_ref_camera.mjs` 的輸出標籤、設定檔的 `_readme`／`*_src`。
  - 拿掉輪次與修改歷史，留下來源、品番、實測出處與推估依據。
  - 過時的描述對齊現行程式碼，例如側制振器座改成外掛式、各款車殼的外框與零件尺寸。車殼的數值是載入車殼模組量外框核對的。
  - 測試名稱開頭的 `Pnn_` ID 沒有動。
  - 剩下的 `iter-NN` 都是指標：「見 ITERATION_LOG iter-NN」「查證紀錄」、SPEC 與 DESIGN.md 的章節標題、`renders/iter-88_*.png` 截圖檔名。
- **文件**：本檔只留現行階段，第一到九階段搬到 `ITERATION_LOG_HISTORY.md`。
- **檔案**：清空 `tmp/`；刪掉 `renders/` 沒被文件引用的 79 張；刪掉 22 個試作分支（`p9-*`、`p10-*`）。
- **git 歷史**：用 `git filter-repo` 移除 `renders/` 截圖（`README.md` 用的 2 張除外），強制推送到 GitHub。
  - commit 數不變（368），hash 全部換新，文件裡引用的 hash 已同步更新；對照表在 `.git/filter-repo/commit-map`。
  - 被文件引用的舊截圖只留在本機 `renders/`，不進 git。

## 驗證
- 註解只動到註解：逐檔比對改前改後的語法樹（忽略註解與位置資訊）和 JSDoc 標籤數量，115 個檔案全部相同。
- 文件搬移：逐行核對，原檔每一行都在主檔或歷史檔裡。
- 歷史改寫：改寫後 HEAD 的 176 個檔案和改寫前相同（扣掉移除的截圖）。
- 完整計分（18:58–19:10，負載約 2–3）：**20/20**，213 項測試全過。外觀沒有重新評審，沿用 iter-129 的 7.64，總分 88.21。
  - 耗時：`P16_collision_patches` 53.9 s、`P18_pairwise` 244.4 s、`P17_phase7_laps` 109.5 s、`P08_mass` 52.0 s。
  - 起跑擾動穿牆探針：p7-demo 最大 0.945 mm（≤ 1 mm）。
- 說明字串只動到說明字串：逐檔比對語法樹，只允許 `src`／`theme`／`_readme`／`*_src`／`*_SRC` 的字串文字與測試名稱裡的輪次標記不同。34 個 JS 檔與 10 個 JSON 檔通過；另外 2 個檔（測試標籤、診斷腳本輸出標籤）是刻意修改，逐行確認過。
- 說明字串整理後的完整計分（21:23–21:45，負載 6–9.7，同機 Chrome 佔滿一核）：**19/20**。`P16_collision_patches` 逾時（135.1 s，上限 120 s）；持鎖單獨重跑通過（整個測試檔 63.8 s）。沒有延長逾時。
  - 同一次的其他耗時：`P18_pairwise` 454.0 s、`P17_phase7_laps` 124.6 s、`P08_mass` 54.4 s；整體比 18:58 那次慢將近一倍。

## 結論
保留。行為沒有變：第一批完整計分 20/20；說明字串那批 19/20，唯一沒過的 P16 是高負載逾時，單獨重跑通過。

# 修正：死碼、過時註解、兩處造型錯誤（2026-11-05 21:5x–23:3x，使用者要求）

## 計畫
- 處理整理過程中發現、當時沒改的問題：`yagaHut.js` 的死碼、和程式碼不符的註解、沒有程式在讀的數值、兩款車殼的造型錯誤。
- 預期：除了刻意修正的兩款車殼，其他行為不變。

## 改動
- **死碼**
  - `src/bodies/yagaHut.js`：刪掉沒被呼叫的 `buildRearWing`、`buildExhaust`、`buildSmoke`、`buildFenderLeg`、`buildHenLegs`，以及只有它們在用的 `CHIMNEY_X`、`CHIMNEY_TOP`、`WING_ELEMENTS`、`wingSection`、`LEGS`、材質 `gable`／`feather`、匯入 `finPlate`，共 259 行。
  - `src/bodies/trojanHorse.js`：刪掉沒有零件使用的材質 `slip`、`slipMatte`、`bronze`、`bronze2`。
  - `src/parts/options.js`：兩個側制振器（`damper-side-square-32`、`damper-ar-side`）的 `bracket` 欄位。側裝一律走 `sideDamperAdapter`，`src/assembly.js`、`src/model.js` 讀 `bracket` 的分支執行不到，一起刪掉。
  - `config/spec.json`：`laneChangerStart_mm`、`laneChangerLength_mm` 和它的 `_src`。換道段由 `src/track.js` 的 `buildCircuit` 決定，沒有程式讀這兩個欄位。
- **造型錯誤**
  - `body-trojan-horse`：5 個舷窗只貼出 1 個。舷窗高度原本照「斜側條往上 3.4 mm」算，重塑後腰部的擋泥板頂降到 26.8 mm，其餘 4 個落在殼面之上。改成跟著橡木肩帶（腰線稜到擋泥板肩點的中線）走，`portY` 和剖面共用 `beltY`。
  - `body-mushussu-gate`：主翼前緣金線的旋轉角度公式寫反，只轉了約 9.5°，金線前後向躺在翼面上、後端凸出到 x −77.06。改成 `sg × atan2(half, 4)`，金線對到後掠前緣。車殼全長 151.06 → 150.00 mm。
- **過時註解**：21 個檔案（`src/model.js`、`src/sim.js`、`tests/parts.test.js`、17 個車殼檔、`render/showcase.py`），把和程式碼不符的數值與描述改成現況。`theme`／`src` 說明字串跟著更新 4 處。

## 驗證
- 行為快照（35 款車殼的網格、質量性質、碰撞格、預設組裝；12 組設定的組裝結果），改前改後比對：
  - `body-yaga-hut` 完全相同。
  - `body-trojan-horse`：只有網格不同，三角面 236539 → 239801（多出舷窗貼紙）；質量、外框、碰撞格、組裝不變。
  - `body-mushussu-gate`：網格、外框（後緣 −77.058 → −76.000）、質量性質、碰撞格、組裝不同；仍合法，車殼質量 15.48 g、整車 131.2 g 不變。
  - 其餘 32 款：網格、質量、碰撞、組裝都相同。
- 12 組設定的組裝結果逐欄位比對（和改動前的 commit 並排執行）：不同的只有被移除的 `laneChanger` 欄位 36 處、`bracket` 欄位 9 處、`src.bracket` 說明字串 3 處。
- 只改註解的 17 個 JS 檔與 `showcase.py`：語法樹和改前相同。
- 兩款車殼修正前後各截一組圖對照（側視、俯視），確認舷窗與金線的位置。
- 完整計分（22:25–23:13，同機另一個專案的 Playwright 整段都在跑，負載 5–14）：**18/20**。
  - P17：3 項逾時（`P17_phase7_laps` 300 s、`P17_drop_matrix damper-slim-short` 120 s、`P17_race_perturbations default` 600 s）。
  - P19：`tests/web.test.js` 的啟動步驟 240 s 逾時，12 項測試全部被跳過。
  - 持鎖單獨重跑（23:13–23:19）全部通過：`tests/web.test.js` 12/12（162 s）、`P17_phase7_laps`（135 s）、另外兩項 P17（57 s）。沒有延長逾時。
  - 同一次計分的 `P16_collision_patches` 109.4 s、`P18_pairwise` 263.8 s。
- Blender：重出 `body-trojan-horse`、`body-mushussu-gate` 的 5 視角（64 samples），重排 `lineup_myth.png`、`lineup_myth_greek.png`、`lineup_myth_others.png`、`before_after_myth_p10.png`。

## 結論
保留。除了刻意修正的兩款車殼，行為沒有變。完整計分 18/20 的兩項都是高負載逾時，單獨重跑通過。
兩款車殼的外觀有變，**還沒重新做 A/B 評審**，留到第十階段接續時一起評。
