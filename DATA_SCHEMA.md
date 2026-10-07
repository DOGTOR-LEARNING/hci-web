# Pierre HCI 實驗：題庫與報告資料設計說明

本文件說明兩件事：

1. **題庫 CSV** 的每個欄位，以及它們如何對應到實驗系統的 **2 × 2 詳解設計**（F0/F1 × I0/I1）。
2. 實驗完成後寄出的 **三份報告 CSV**（`profile` / `answers` / `trials`）各欄位的意義、單位與量測方式。

對應更新版研究計畫：`docs/CHI_2027_刻意_AI_不一致性_更新版研究計畫.md`。

---

## 〇、資料流總覽

```
data/pierre_hci_questions_v2.csv        （題庫來源，人工維護）
   │  node scripts/gen-data.mjs
   ▼
app/data/questions.ts                   （自動產生，勿手改）
   │  前端載入
   ▼
學習任務逐題渲染                          app/lib/condition.ts（指派 2×2 cell）
   ├─ I 因子開頭（演算法生成）             app/lib/openings.ts:buildInterruptionOpening
   ├─ F 因子本體（F0/F1 authored）        app/lib/openings.ts:buildFramingBody
   └─ 互動追蹤（每題一列摘要）             app/lib/tracker.ts:InteractionTracker
   │  走完流程一次送出 → /api/submit-session → 後端 /pierre_hci/submit_web_session
   ▼
Email 附件三份報告 CSV                    backend/app/routers/pierre_hci.py
   ├─ profile_{pid}.csv   單場摘要（一列）
   ├─ answers_{pid}.csv   三關逐題基本作答
   └─ trials_{pid}.csv    學習試次逐題配對互動摘要（主要分析資料）
```

> **重要**：`app/data/questions.ts` 由 `gen-data.mjs` 從 CSV 自動產生，**請勿手動編輯**；要改題目或詳解，改 CSV 後重跑 `node scripts/gen-data.mjs`。

---

## 一、題庫 CSV：`data/pierre_hci_questions_v2.csv`

一列 = 一題。共 20 列：前測 4、學習 8、後測 8。四個核心概念各有 1 道前測、2 道學習題與 2 道後測題。

| 欄位 | 說明 | 前測 900001 | 學習 900002 | 後測 900003 |
|---|---|:--:|:--:|:--:|
| `level_id` | 關卡代號：`900001` 前測／`900002` 學習任務／`900003` 後測 | ✅ | ✅ | ✅ |
| `question_id` | 該關內題號（1 起算） | ✅ | ✅ | ✅ |
| `pair_id` | 逐題配對代號（`C01`…`C08`）。**學習題與後測題以相同 pair_id 對應**，用於後測近遷移配對。前測留空 | — | ✅ | ✅ |
| `knowledge_point` | 核心概念（四類：限量反應物與粒子守恆／氫鍵與沸點／定容氣體的溫度與壓力／濃度改變後的化學平衡） | ✅ | ✅ | ✅ |
| `question` | 題幹 | ✅ | ✅ | ✅ |
| `option_a`~`option_d` | 四個選項文字（對應索引 0~3 / 字母 A~D） | ✅ | ✅ | ✅ |
| `correct_index` | 正解索引（0=A、1=B、2=C、3=D） | ✅ | ✅ | ✅ |
| `common_distractor_index` | **預先指定的常見錯誤選項**索引。F0 描述此選項；也是 I1 momentary 錯誤的優先候選 | — | ✅ | — |
| `explanation_f0` | **F0 版單段詳解**（一般 framing）：正解＋核心推理＋描述常見錯誤選項 | — | ✅ | — |
| `explanation_f1_core` | **F1 版核心推理**（作答連結 framing 的本體開頭） | — | ✅ | — |
| `f1_a`~`f1_d` | **F1 版四個選項各自的單獨敘述**（對應 A~D）。正解為確認語，其餘為誤判說明 | — | ✅ | — |

- 前測／後測只需填到 `correct_index`，其後 7 欄留空（純作答、不顯示詳解）。
- 只有學習關（900002）需要填 `common_distractor_index` 與所有詳解欄位。產生題庫時會驗證題數、概念分布及逐題配對。

---

## 二、CSV 如何對應到 2 × 2 詳解設計

### 2.1 兩個因子與四個 cell

每一道學習題會被指派到四個實驗條件（cell）之一：

| cell | Framing（F 因子，本體） | Interruption（I 因子，開頭） |
|---|---|---|
| `F0I0` | F0 一般 framing | I0 無中斷 |
| `F1I0` | F1 作答連結 framing | I0 無中斷 |
| `F0I1` | F0 一般 framing | I1 短暫錯誤＋立即自我修正 |
| `F1I1` | F1 作答連結 framing | I1 短暫錯誤＋立即自我修正 |

**每題實際顯示 = 一個「AI 詳解」區塊**，內含連續文字：`[I1 自我修正開頭（僅 I1）] → [關於你的作答（僅 F1）] → [核心正確推理]`。詳解只有一個階段，且以上內容不再各自分框，都屬於 AI 詳解的一部分。

### 2.2 F 因子（本體）← 來自 CSV authored 內容

`app/lib/openings.ts:buildFramingBody(q, selectedIndex, framing)`：

- **F0**：直接使用 `explanation_f0`。
  - 追蹤區域：整段記為 `explanation-main`；`option-analysis` 區為空（該題 option_analysis 相關欄位為 0）。
- **F1**（作答連結）：**只點名參與者「實際選擇」的那個選項**，並顯示該選項的單獨敘述，再接核心正確推理。**不會列出其他未選的選項。**
  - 「關於你的作答」區（記為 `option-analysis`）：`你選擇了 X；{f1_該選項}。`（答對顯示「與正解一致」）。
  - 「AI 詳解」區（記為 `explanation-main`）：`explanation_f1_core` 核心正確推理。
  - CSV 仍需備妥 `f1_a`~`f1_d` 四欄，因為事前不知道參與者會選哪一個；渲染時**只取其實際選項**對應的那一欄。

### 2.3 I 因子（開頭）← 演算法即時生成，不在 CSV

`app/lib/openings.ts:buildInterruptionOpening(q, selectedIndex, interruption)`：

- **I0**：以 `注意！` 作為醒目提示開頭，用來**平衡** I1 自我修正帶來的注意力吸引（控制單純 salience），之後接正確推理。
- **I1**：以自我修正作為 AI 詳解的第一句 `我剛才判斷成 {W}；重新檢查後，正確答案是 {正解}。`（其自我修正本身即注意力機制，**不再加「注意！」**）
  - `{W}` = `pickI1Distractor()` 選出的 momentary 錯誤選項，規則：
    1. **必須非正解、也非參與者當下選擇**（`≠ correct_index`、`≠ selectedIndex`）。
    2. 若 `common_distractor_index` 符合上述條件則優先採用；否則取第一個符合的錯誤選項。
  - I 因子的對照：兩水準都有一個醒目開頭（I0＝「注意！」、I1＝短暫自我修正），差別只在 I1 多了語意衝突與立即修正的內容，避免把效果誤歸因於單純被提醒注意。

### 2.4 條件指派：區塊隨機化

`app/lib/condition.ts:assignCells(count, experimentId)`：

- 以 `experimentId` 為種子（mulberry32），每 **4 題為一個區塊**，區塊內是四個 cell 的洗牌 → **「四種條件都出現過才會重複」**。8 題 = 2 個區塊，每個 cell 各出現 2 次。
- 額外保證**第一題為 I0**（保留一個未受不一致污染的基準）。
- 同時計算 carryover 標記：`firstI1`（是否本人第一次遇到 I1）、`i1ExposureCount`（累積 I1 暴露次數）、`postFirstI1`（是否位於第一次 I1 之後）。

### 2.5 完整範例（題 C01，正解 A、常見錯誤 B，假設參與者選 B）

I1 的 momentary 錯誤會避開正解 A 與參與者選的 B，因而選 **C**：

四種呈現都在同一個「AI 詳解」區塊，連續文字如下：

| cell | AI 詳解內容（連續一段） |
|---|---|
| `F0I0` | 注意！（接）explanation_f0（含「常見的錯誤選項是 B；…」） |
| `F0I1` | 我剛才判斷成 **C**；重新檢查後，正確答案是 A。（接）explanation_f0† |
| `F1I0` | 注意！（接）你選擇了 B；{f1_b 對 B 的說明}。（接）explanation_f1_core |
| `F1I1` | 我剛才判斷成 **C**；重新檢查後，正確答案是 A。（接）你選擇了 B；{f1_b}。（接）explanation_f1_core† |

> † **I1 去重**：I1 的開頭已宣告「正確答案是 X」，故本體開頭若以「正確答案是 X。」起始會被自動略去（`stripLeadingAnswer`），避免同一句出現兩次。

---

## 三、報告 CSV（Email 三份附件）

- 編碼：UTF-8 + BOM（Excel 可正確顯示中文）。
- **布林值**一律以 `1`（是）／`0`（否）表示；**未作答／不適用**為空字串。
- `{pid}` = 參與者匿名代碼（`participant_id`，形如 `P1234565678`）。
- 時間欄位單位為 **毫秒（ms）**，除非另行說明。

### 3.1 `profile_{pid}.csv`（單場摘要，僅一列）

固定欄位：

| 欄位 | 說明 |
|---|---|
| `session_id` | 本場唯一 ID（UUID） |
| `participant_id` | 匿名參與者代碼 |
| `user_id` | 同 participant_id |
| `subject` / `chapter` | 科目 / 章節（普通化學） |
| `design` | 設計標記，固定 `2x2_within` |
| `started_at` / `submitted_at` | 開始 / 送出時間（ISO 8601, UTC） |
| `session_duration_ms` | 全程總時長 |

其後為**動態欄位**（依實際內容展開）：

| 欄位樣式 | 說明 |
|---|---|
| `demographic_{key}` | 基本資料，key 為 `nickname/age/gender/education/chem_background/email` |
| `eligibility_all_confirmed` | 是否勾選全部資格條件（1/0） |
| `eligibility_items` | 資格條目原文（以 `\| ` 串接） |
| `consent_agreed` | 是否同意知情同意（1/0） |
| `q_pre_{j}_score` | 前測信任量表第 j 題分數（**1~7 Likert**，**j 由 1 起算**，見下方對應表） |
| `q_post_{j}_score` | 後測信任量表第 j 題分數（**1~7 Likert**，**j 由 1 起算**，見下方對應表） |
| `manip_{key}` | 操弄檢核單選題答案，key = `mentioned_my_option`（是否察覺開頭提到自己選項）、`self_corrected`（是否察覺 AI 自我修正）。值為所選文字 |
| `manip_made_me_recheck` | 「最容易讓我重新檢查的開頭」複選（以 `\| ` 串接） |
| `phase_{section}_correct` / `_total` / `_stars` / `_duration_ms` | 各關（前測 / 學習任務 / 後測）成績與時長 |

> **量尺**：所有信任量表題改為 **7 點 Likert**（對齊 Kunkel et al. 2019 / McKnight），只標錨點（1＝非常不同意、4＝普通、7＝非常同意）。題目定義見 `experimentConfig.TRUST_ITEMS` / `EXPERIENCE_ITEMS`。

**前測 `q_pre_{j}`（實驗前，7 題，j 由 1 起算）欄位序號 → 構念**：

| j | 構念 | 說明 |
|:-:|---|---|
| 1-2 | disposition | 對 AI 的一般信任傾向 |
| **3-5** | **trusting-beliefs 錨定** | 3=能力 competence／4=誠信 integrity／5=善意 benevolence |
| 6-7 | verify-habit（covariate） | 查證習慣 / 校準傾向 |

**後測 `q_post_{j}`（實驗後，10 題，j 由 1 起算）欄位序號 → 構念**：

| j | 構念 | 說明 |
|:-:|---|---|
| **1-3** | **trusting-beliefs 錨定** | 1=能力／2=誠信／3=善意，**與 `q_pre_3..5` 文字一字不差**，用於算 Δtrust |
| 4-6 | trusting-intentions | 4=依賴 willingness／5=採納 follow-advice／6=續用產品 |
| 7-8 | 安全性（**反向計分**） | 7=困惑／8=負擔被干擾，分析前需反向 |
| 9-10 | 操弄偏好 | 9=F 作答連結「點名我的選項」有幫助／10=I 中斷「先錯再更正」讓我更仔細 |

> **Δtrust 主分析**：`q_post_1..3 − q_pre_3..5`（逐面向對應：能力/誠信/善意）與其平均，即為「實驗前→後對 AI 詳解信任信念的變化」，是本次前後問卷優化的核心產出。錨定題定義於 `experimentConfig.TRUST_BELIEF_ANCHORS`，前後測共用同一常數，**勿只改單邊**。
>
> 註：CSV 欄位序號為 1-based（後端 `enumerate(..., start=1)`），比 `experimentConfig.ts` 陣列的 0-based 索引大 1。

### 3.2 `answers_{pid}.csv`（三關逐題基本作答，long format）

一列 = 一道題（跨前測／學習／後測）。

| 欄位 | 說明 |
|---|---|
| `participant_id` / `session_id` | 參與者 / 場次 |
| `section` | 關卡名稱（前測 / 學習任務 / 後測） |
| `level_id` | 關卡代號（900001/900002/900003） |
| `is_learning` | 是否為學習任務題（1/0） |
| `question_index` | 該關內題序（1 起算） |
| `question_id` / `pair_id` / `knowledge_point` | 題號 / 配對代號 / 知識點 |
| `question_text` | 題幹 |
| `selected_index` / `selected_option` | 參與者選擇的索引與選項文字 |
| `correct_index` / `correct_option` | 正解索引與選項文字 |
| `is_correct` | 是否答對（1/0） |
| `condition_code` | 2×2 條件（`F0I0`/`F1I0`/`F0I1`/`F1I1`）；前後測留空 |
| `framing` | F 因子（`F0`/`F1`）；前後測留空 |
| `interruption` | I 因子（`I0`/`I1`）；前後測留空 |
| `first_i1` | 是否為本人第一次遇到 I1（1/0） |
| `i1_exposure_count` | 到本題為止累積 I1 暴露次數 |
| `post_first_i1` | 是否位於第一次 I1 之後（1/0） |
| `confidence` | 送出前作答信心（1~5 Likert，點選）；前測不收集則空 |
| `answer_duration_ms` | 題目出現 → 按「確認答案」的時間 |
| `first_option_click_ms` | 題目出現 → 第一次點選項的時間 |
| `option_change_count` | 確認前改變選項的次數 |
| `skipped_typing` | 是否點題目卡片跳過打字動畫（1/0） |

### 3.3 `trials_{pid}.csv`（學習試次逐題配對互動摘要）★主要分析資料

一列 = 一道**學習題**（共 12 列）。欄位順序**與 `docs/pierre_hci_trial_interaction_schema.csv` 完全一致**（後端 `_TRIAL_HEADER` 已對齊驗證）。所有互動指標皆為「每題一列」的彙整摘要，**不含游標座標或逐點軌跡**。

**識別與條件**

| 欄位 | 說明 |
|---|---|
| `participant_id` | 匿名參與者代碼 |
| `trial_id` | 學習任務內題序（1~12） |
| `item_id` | 題目配對代號（= pair_id，`C01`…） |
| `condition_code` | 2×2 條件（`F0I0`/`F1I0`/`F0I1`/`F1I1`） |
| `answer_correct` | 本題是否答對（1/0） |
| `confidence` | 送出前作答信心（1~5 Likert，點選） |
| `first_i1` | 是否為本人第一次遇到 I1（1/0） |
| `i1_exposure_count` | 累積 I1 暴露次數（含本題；I0 題記錄先前次數） |
| `post_first_i1` | 是否位於第一次 I1 之後（1/0） |

**主要結果：active dwell（可視 × 有焦點的累計時間，ms）**

> 「active」= 該區域在捲動視窗內可見 **且** 頁面在前景 **且** 視窗有焦點；以時間戳差分累計（`app/lib/tracker.ts`）。

> AI 詳解為單一區塊，`opening`／`option-analysis`／`explanation-main` 為其內嵌的子元素（僅供追蹤，不分框）；因此 `opening_visible_ms` 是 `correct_explanation_visible_ms` 的子集合。

| 欄位 | 說明 |
|---|---|
| `opening_visible_ms` | I 因子開頭那句的 active 可視累計時間（I0＝「注意！」、I1＝自我修正句；兩者皆有） |
| `correct_explanation_visible_ms` | **整個「AI 詳解」區塊的 active 可視累計時間** ＝主要 dwell 指標 |

**區域游標停留（pointerenter / pointerleave 累計）**

| 欄位 | 說明 |
|---|---|
| `opening_hover_ms` / `opening_enter_count` | 游標停留於「I 因子開頭」（I0＝注意！／I1＝自我修正句）的累計時間 / 進入次數 |
| `explanation_hover_ms` / `explanation_enter_count` | 游標停留於「核心正確推理」文字的累計時間 / 進入次數 |
| `option_analysis_hover_ms` / `option_analysis_enter_count` | 游標停留於「關於你的作答」區（F1 針對參與者實際選項的說明）的累計時間 / 進入次數。**僅 F1 題有此區**；F0 題為 0 |

**捲動行為**

| 欄位 | 說明 |
|---|---|
| `scroll_down_count` / `scroll_up_count` | 向下 / 向上的連續捲動「動作」次數（同一動作內事件間隔 ≤ 500 ms 視為一次） |
| `scroll_active_ms` | 所有捲動動作的累計持續時間 |
| `max_scroll_percent` | 本題到達的最大捲動深度（0~100） |
| `revisit_count` | 詳解已捲離頂端後，又向上使其重新進入視窗的次數（回訪先前已讀內容） |

**分心 / 離開**

| 欄位 | 說明 |
|---|---|
| `container_leave_count` / `container_outside_ms` | 游標離開手機比例容器（`.phone`）的次數 / 累計時間 |
| `focus_lost_count` / `focus_lost_ms` | 視窗失焦或分頁隱藏的次數 / 累計時間 |
| `continue_click_ms` | 共同正確詳解首次可見 → 按「下一題」的時間 |

**逐題配對後測（以 pair_id 對應後測題）**

| 欄位 | 說明 |
|---|---|
| `posttest_correct` | 相對應知識點後測題是否答對（1/0） |
| `posttest_confidence` | 該後測題送出前信心（1~5 Likert） |

---

## 四、與研究計畫的對應與注意事項

- **主要結果**（計畫書 §6.4）：`correct_explanation_visible_ms`（行為投入）＋ `posttest_correct`（逐題配對近遷移學習）。dwell 增加**不可單獨**作為政策依據，需搭配後測不下降。
- **carryover**（§5.3, §6.3）：以 `first_i1` / `i1_exposure_count` / `post_first_i1` 分層估計初次中斷、習慣化與殘留警覺。
- **裝置限制**（§6.2）：進站時 `DeviceGate`（`app/flow/DeviceGate.tsx`）以 `(any-hover: hover)` 且 `(any-pointer: fine)` 判斷是否具備滑鼠／觸控板 hover 能力；手機／純觸控裝置一律擋下並顯示「請用電腦瀏覽器進行」，確保能蒐集游標互動資料。
- **隱私**（§9.6）：只輸出每題一列彙整摘要；**不記錄游標座標／移動軌跡、不錄螢幕、不記鍵盤、不追蹤實驗頁外活動**。
- **內容凍結**：CSV 內 F0/F1 詳解為由既有題庫改寫之版本，正式收案前應經學科專家審查並凍結（§5.5）。
- **修改題庫流程**：編輯 `data/pierre_hci_questions_v2.csv` → 執行 `node scripts/gen-data.mjs` → 重新 build。若新增／調整 `trials` 欄位，需同步更新後端 `_TRIAL_HEADER` 與 `docs/pierre_hci_trial_interaction_schema.csv`，三者欄位順序必須一致。
