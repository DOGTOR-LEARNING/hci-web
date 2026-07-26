# pierre-hci-web

Dogtor 人機互動實驗（Pierre HCI）的 **獨立 Next.js 14 網頁版**，以 App 的
`quiz_page_pierre_hci.dart` 與 `pierre_hci_flow_page.dart` 為原型復刻成一條完整的
**引導式流水線**。UI/UX 對齊 App（橙色系、手機版式、打字機動畫、兩階段詳解），
**以手機檢視為主**。整個資料夾可獨立搬移，嵌入到其他網站的一個頁面。

## 執行

```bash
npm install
npm run dev      # http://localhost:3100
npm run build    # 產生正式版
```

## 流水線步驟

進入頁即為流水線（`app/flow/PierreHciFlow.tsx`），依序：

0. **歡迎／研究介紹** — 受試者一進來看到：需時約 30 分鐘、我們是誰、在做什麼研究、為何請你參與、接下來會做哪些步驟、自願與匿名。
1. **資格確認** — 5 項全勾才能繼續。
2. **知情同意** — 閱讀說明 + 3 題理解確認（正解 是／是／否，全對才能繼續，防一路狂按）。
3. **資料填寫** — 暱稱、年齡、性別、學歷、化學背景、Email（部分必填）。
4. **開始前的小問卷** — 4 題信任量表（5 點）。
5. **前測** — 過場「開始」→ 純作答（不顯示詳解）。
6. **學習任務** — 過場 → 每題**送出前先填 1~5 分作答信心**（計畫書 §6.4）→ 作答後顯示「AI 說明」（第一階段，依條件 A/B/C）與「完整正確詳解」（第二階段，共用，**一律顯示**）。
7. **不一致察覺** — 開放題 + 勾選有問題題目 + 歸因單選 + 是否進一步查證。
8. **後測** — 過場 → 純作答。
9. **結束前的小問卷** — 同前 4 題。→ **此時一次送出全部資料**。
10. **事後揭露** — 列出實際被指派到「刻意不一致」的題目與正確答案。
11. **完成** — 顯示上傳狀態（失敗可重試）。

中途以左上返回鍵離開一律回起點，不保存進度（對照 App）。
答對題一律顯示一般正確詳解（不操弄）。

### 與更新版計畫書（CHI_2027）的對齊狀態

已依更新版補上：**每題送出前 1~5 分作答信心**、**第二階段（完整正確詳解）一律顯示**（不再藏在按鈕後）。

尚未實作（如需再依計畫書 §5 補）：第一階段改為「短暫中斷訊息」而非整段詳解、
「繼續／回報內容問題」按鈕與更正前問題回報指標、C 條件操作後的即時更正訊息、
答錯後動態平衡指派（目前為依題序 mod 3 預先指派）、C 條件 ≥2 錯誤簡述版本、
操作練習題、基線問卷擴充、任務後單一察覺檢核題、實驗後困惑/信任/續用量表。

## 結構

- `app/page.tsx` — 渲染流水線。
- `app/flow/PierreHciFlow.tsx` — 流程狀態機，累積全程資料、最後一次送出。
- `app/flow/steps.tsx` — 各非測驗步驟畫面（歡迎介紹／資格／同意／資料／問卷／察覺／揭露／過場／完成）。圖示使用 `lucide-react`。
- `app/components/QuizPierreHci.tsx` — 核心作答元件（打字機、選項、詳解面板）。`reportToFlow` 為流水線模式。
- `app/components/Markdown.tsx` — 詳解用輕量 Markdown（無第三方相依）。
- `app/lib/condition.ts` — 詳解條件（A 正確／B 注意力／C 刻意不一致）對抗平衡指派。
- `app/lib/experimentConfig.ts` — 資格／同意／資料欄位／問卷／歸因／揭露等文案設定（對照 App config）。
- `app/data/questions.ts` — 題庫資料（**已內嵌**）。
- `app/api/submit-session/route.ts` — server 端代理（補 X-API-Key 轉發後端）。
- `app/globals.css` — 對齊 App 語意化色票的樣式。

## 完成流水線 → 一支 API → CSV 寄信

走完整條流水線（後問卷送出）時，只呼叫 **一支** API，把整場資料寄一封信到實驗信箱：

```
瀏覽器 → (POST /api/submit-session, 同一支)
        → Next.js server route（補上 X-API-Key）
        → 後端 POST /pierre_hci/submit_web_session
        → 背景寄「一封信＋兩份 CSV 附件」到 PIERRE_HCI_RESULT_EMAIL
```

- API key 只在 **server 端** 使用，不會出現在前端 JS。
- 資格確認、資料填寫、知情同意理解確認、前後問卷、不一致察覺、三關逐題數據 **全部**包含在信裡。

### 兩份 CSV

**`profile_{pid}.csv`**（該場單列摘要，便於多位參與者合併）：
`session_id, participant_id, user_id, subject, chapter, started_at, submitted_at,
session_duration_ms,` + `demographic_*`（資料填寫每欄）+ `eligibility_all_confirmed,
eligibility_items,` + `consent_i_answer/consent_i_correct,` + `q_pre_i_score/q_post_i_score,`
+ `detection_attribution/verified/problem_question_ids/unreasonable_text,` + 每關
`phase_{關卡}_correct/total/stars/duration_ms`。

**`answers_{pid}.csv`**（三關逐題 long format，含送出前信心＋各種點擊＋停留）：
`participant_id, session_id, section, level_id, is_learning, question_index,
question_id, pair_id, knowledge_point, question_text, selected_index,
selected_option, correct_index, correct_option, is_correct, explanation_version,
condition, confidence（送出前 1~5 信心）,` **時間類** `answer_duration_ms（出現→確認）,
first_option_click_ms（出現→首次點選）, explanation_dwell_ms（詳解面板總停留）,`
**點擊類** `option_change_count（確認前改答次數）, explanation_open_count（詳解展開次數）,
clicked_understood, skipped_typing`。

布林以 1/0 表示，CSV 為 UTF-8+BOM（Excel 可正確開中文）。

### 環境變數（見 `.env.example`，複製成 `.env.local`）

- `DOGTOR_API_BASE_URL` — 後端位置，預設 staging；正式收資料改成 production。
- `DOGTOR_API_KEY` — 後端 `APIKeyMiddleware` 金鑰（`/pierre_hci/*` 非公開路徑，正式環境通常必填）。
- 收件信箱由 **後端** 的 `PIERRE_HCI_RESULT_EMAIL` 決定（預設 b12705058@g.ntu.edu.tw），
  寄信需後端設好 `RESEND_API_KEY`。

> 後端端點 `/pierre_hci/submit_web_session` 位於 `backend/app/routers/pierre_hci.py`，
> **需先部署後端**（push `main` 觸發 Cloud Build 部署 staging）才會回 200；未部署前會回 404。

## 重新產生題庫資料

```bash
npm run gen:data     # 讀本資料夾 data/pierre_hci_questions.csv → app/data/questions.ts
```

搬移資料夾後仍可自足重新產生；執行時題目已內嵌，不需要 CSV。若要同步 App 端更新，
把最新 CSV 覆蓋到 `data/pierre_hci_questions.csv` 再跑 `npm run gen:data`。

## 嵌入外層網站

若外層也是 App Router 專案，把 `app/` 內容搬過去即可（含 `app/api/submit-session`）。
若外層不是 Next.js，可改由 `PierreHciFlow` 的 `submit()` 直接上傳或以 `postMessage` 回傳給父頁——
但直接從瀏覽器打後端需自行處理 API key 外流與 CORS 問題，建議維持 server route 代理。
