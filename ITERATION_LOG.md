# Track A 迭代紀錄（Three.js ＋ Rapier ＋ vitest ＋ Playwright）

## iter-00（開始 2026-10-20 00:00:49 / 結束 2026-10-20 00:26:14，TZ=Asia/Taipei date）

### 探索
- 首輪，沒有前一輪結果。讀 GOAL.md、CLAUDE.md、SPEC.md、shared/TRACK_BRIEF.md。
- 進行中 SPEC.md 第 1 部分完成查證（主 agent 通知）：參考車款改為 Chevalier（MA 底盤），以 1.12「建議預設參數」為準；P08 改為「含電池與馬達 ≥ 90 g ＋ 與 1.12 總重 118 g 誤差 ≤ 10%」。設定檔已整份改寫對應。
- 參考圖：`shared/reference/ref_ma-chassis_tamiya.jpg`（雙軸馬達置中、兩端小齒輪→中間齒輪→輪軸齒輪、6 顆導輪）、`ref_chevalier-ma_side-high_tamiya.jpg`。

### 規劃（iter-00 = 建立整條管線）
1. 專案初始化：`package.json`（three 0.186、@dimforge/rapier3d-compat 0.21、vite 8、vitest 5、playwright 1.64）。
2. 單一設定檔 `config/spec.json`（每個數值附 `*_src`：SPEC 小節或「推估＋依據」），模型與物理共用；`src/carLayout.js` 給出零件座標，Three.js 與 Rapier 都從這裡取。
3. 物理：Rapier 賽道（3 線道、牆、換道段）、車體剛體、射線輪、球形導輪；動力鏈 NiMH 電池 → 線性 DC 馬達 → 齒輪 → 輪；培林 / 塑膠軸承不同摩擦。
4. 測試 P01–P10 全部寫出且可跑；Playwright 截 5 張圖。
- 預期效果：管線完整、P01–P10 可產出逐項數值。

### 執行
- 檔案：
  - `config/spec.json`：唯一規格檔（SPEC 1.12 預設值；推估值附依據）。
  - `src/spec.js`（衍生 SI 參數）、`src/powertrain.js`（電池／馬達／阻力／解析理論極速）、`src/track.js`（中心線、車道、牆線三角網格）、`src/carLayout.js`、`src/sim.js`（Rapier）、`src/model.js`（Three.js 車＋賽道）。
  - `web/index.html`、`web/main.js`（依 `?view=` 擺相機）、`scripts/render.mjs`（vite 伺服器＋Playwright 截圖）。
  - `tests/physics.test.js`（P01–P10，每項一個 test，名稱含 ID）。
- 動力鏈：`I = (Voc − Ke·ω)/(Rm + Rb)`、`τ = Kt·I`，Ke = 3 V / 1288 rad/s、Rm = 3 V / 2.1 A、Kt = 3.53 mN·m / 2.1 A，等價於 SPEC 1.12 的 `τ_stall(V)·(1 − ω/ω0(V))`（V 為端電壓）。電池 OCV 用 SPEC 1.3 分段表、內阻 2×40 mΩ、容量 950 mAh。阻力：C_rr·m·g ＋ 軸承 μ·N·(r_shaft/r_wheel)（培林 0.003 / 塑膠 0.20）＋ 空氣 ½ρC_dAv²（直接施加在剛體）。
- 賽道：橢圓（直線 1.7 m ×2、中線半徑 0.51 m 的 180° 彎 ×2，內 / 中 / 外線道 0.385 / 0.51 / 0.635 m）、車道 115 mm、牆高 50 mm、牆厚 10 mm（外牆往外加厚到 20 mm 防穿隧）。換道段：直線上 0.45–1.25 m 的平滑 S 形斜牆，內、中線道各往外移一個車道；外側線道的 80 mm 立體橋 iter-00 只做外觀（無碰撞）。
- 過程中遇到並解決的 Rapier 問題（都留在 Rapier 內解決，沒有換引擎）：
  1. **WASM 在 Node 載入**：`@dimforge/rapier3d-compat` 直接 `await RAPIER.init()` 就能在 Node / vitest 跑，無問題。
  2. **`DynamicRayCastVehicleController` 側向摩擦在小慣性矩下幾乎失效**：車體慣性矩 ~1e-4 kg·m² 時側向衝量只有應有值的約 1/1000（側滑 0.5 m/s 的車 0.1 s 只減到 0.487 m/s；把慣性矩放大 1000 倍就恢復正常），推測內部用 inv_inertia 而非 sqrt 計算雅可比。改為**自寫射線輪**：每步 `castRay` 找地面 → 彈簧阻尼法向力（靜態壓縮 0.3 mm）→ 滑移角 tanh 側向力＋摩擦圓 → `addForceAtPoint`，由 Rapier 積分。
  3. **`world.lengthUnit` 會限制最大速度**：設 0.01 時速度被卡在 4.000 m/s（無外力測試確認），改為 0.1。
  4. **牆用多個方塊時，導輪在接縫處撞到下一塊的端面（ghost collision）**，車速瞬間掉 0.6 m/s。改為**每條牆線一個三角網格**（`TriMeshFlags.FIX_INTERNAL_EDGES`），並把內側牆＋兩條分隔牆在換道段首尾相接成一條「螺旋」牆線，消除所有內部端面。
  5. **圓柱導輪對 trimesh 接觸會卡死**（彎道入口速度掉到 0、車身楔在車道中）；把導輪碰撞體改為同半徑的**球**（接觸點在赤道、牆面垂直，幾何等效），單圈時間從卡住 / 4.5 s 變 2.65 s。
- 導輪摩擦組合規則設為 Min，讓導輪–牆等效摩擦真的是 SPEC 的 0.05（Rapier 預設是平均）。

### 驗證（P01–P10 逐項；`npx vitest run`，10/10 通過）
| ID | 結果 | 關鍵數值 |
| --- | --- | --- |
| P01 | pass | v0 = 4.465 m/s（Voc 2.80 V 無載）、理論極速 4.200 m/s、模擬穩定極速 4.198 m/s，誤差 0.04%（容許 < 10%） |
| P02 | pass | 4 h 連續行駛積分（1 s 步長）：放電 411.6 mAh，端電壓 2.791 → 2.470 V，下降 11.5%，單調不增 |
| P03 | pass | 滿電 4.198 m/s（2.791 V）> SOC 20% 3.530 m/s（2.352 V） |
| P04 | pass | 初速 3 m/s 斷電滑行：培林 19.41 m、塑膠 11.82 m，比值 1.643（需 ≥ 1.2） |
| P05 | pass | 彎道中外側導輪接觸（距離 ≤ 0.5 mm）比例 100% |
| P06 | pass（餘裕小） | 幾何最大超出牆面 0.902 mm、接觸最大穿透 0.986 mm（上限 1 mm） |
| P07 | pass | 單圈 6.60 m 跑完，2.653 s，最高 3.60 m/s，最小 up.y = 1.000，車體 y −0.05 ~ 0.49 mm |
| P08 | pass | Rapier 剛體質量 118.00 g（不含電池 80 g＋電池 38 g），與 SPEC 1.12 的 118 g 誤差 0% |
| P09 | pass | Three.js 外框 157.2 × 98.2 × 36.8 mm（上限 165 × 105 × 70） |
| P10 | pass | 換道前車道 0 → 換道後車道 1，出口速度 2.74 m/s，未翻覆 |

物理分數：**10/10**。

注意事項 / 誠實揭露：
- P01 誤差很小，原因是理論解與模擬共用同一套縱向力公式；模擬的差異只來自 Rapier 積分、射線輪接觸與輪胎力（直線上幾乎無側滑）。這符合 SPEC 定義（速度由物理引擎跑出），但 P01 目前不太能檢出模型錯誤。
- P02 / 穩態電流只有約 0.11 A：依 SPEC 1.12 的線性馬達模型「忽略 I0」，穩態時只需克服滾阻＋空阻。真車行駛電流約 1–2 A（SPEC 1.4 的 Tamiya 建議負載電流），所以 4 h 才放 412 mAh 不符真實耗電速率。之後可考慮把 I0 加入馬達模型（會同時影響 P01 理論值）。
- P04 敏感度：`config/spec.json` 的 `motor.coastMotorDrag` 預設 false（依 SPEC 1.12 忽略 I0）。若改為 true（斷電時馬達內部摩擦 Kt·I0 經齒輪放大計入），實測比值降為 **1.156（會 fail）**：培林 4.73 m、塑膠 4.09 m。這是模型假設，不是調參；已列為下一輪待討論。
- P06 餘裕只有 0.014 mm：接觸穿透來自彎道高側向力下的求解器柔性。下一輪可增加 solver 迭代或降低步長確認。
- 換道段是「地面斜向導牆」簡化版；SPEC 1.10 的真實構造是外側線道爬 80 mm 橋越過另兩條。目前只模擬內 → 中線道換道；橋只做外觀。

截圖：`renders/iter-00_side.png`、`iter-00_top.png`、`iter-00_front34.png`、`iter-00_bottom.png`、`iter-00_track.png`（1600×900，Playwright 無頭 Chromium）。

### 迭代決策（保留 / revert，理由）
- 保留：首輪基準，無上一輪可比較。物理 10/10。
- 已知外觀弱點（下一輪候選）：車殼放樣曲面有波紋、條紋為頂點色所以邊緣鋸齒、座艙只是一塊深色區域、前保桿／底盤細節（MA 一體式底盤的側框與開孔）偏簡單、底面缺少齒輪蓋／馬達蓋細節；賽道視角的牆面陰影偏平。

### 生圖紀錄
- 無，使用程序化材質（MeshPhysicalMaterial＋頂點色條紋）。

### 下一輪建議
1. 外觀：車殼改為以參考照片輪廓（Chevalier 側視／俯視）定義的截面放樣，條紋改用 CanvasTexture（或生圖貼紙），座艙做成獨立玻璃件。
2. 物理：P06 加大餘裕（solver 迭代、dt 0.5 ms 試驗）；評估把 I0 納入馬達模型（P02 耗電速率更真實；P04 可能因此 fail，需要主 agent 決定 SPEC 是否計入斷電時馬達摩擦）。
3. 換道段改為真正的立體橋（外側線道 → 內側線道），P10 改測橋。
