// 人機互動實驗流水線設定（更新版研究計畫）：
// 科目、關卡對應、資格、知情同意、前後問卷、操弄檢核、揭露文案。

export const BOOK = 'Pierre HCI';

export type Subject = {
  key: string;
  chapter: string;
  preTestLevelId: string;
  learningLevelId: string;
  postTestLevelId: string;
  subjectOffset: number;
  knowledgePoints: string[];
};

// 目前只有一個科目（普通化學），流水線固定使用它。
export const SUBJECT: Subject = {
  key: 'chem',
  chapter: '普通化學',
  preTestLevelId: '900001',
  learningLevelId: '900002',
  postTestLevelId: '900003',
  subjectOffset: 0,
  knowledgePoints: [
    '粒子表示與守恆',
    '原子結構與離子',
    '分子間作用力',
    '氣體粒子行為',
    '化學平衡',
    '酸鹼與緩衝',
  ],
};

// 研究資格確認（皆需勾選才可繼續）。計畫書 §6.1：成年、能讀繁中、具化學基礎。
export const ELIGIBILITY_ITEMS = [
  '我已年滿 18 歲',
  '我能閱讀繁體中文',
  '我具高中化學或普通化學基礎',
  '我未曾參加過本研究',
  '我正在使用桌上型或筆記型電腦（非手機）完成',
  '我同意在安靜的環境下獨立完成',
];

// 資料填寫（基本資料）。key 會成為 CSV 欄位。
export type DemographicField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'single';
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

export const DEMOGRAPHIC_FIELDS: DemographicField[] = [
  { key: 'nickname', label: '暱稱或代號（方便後續聯繫，可留空）', type: 'text', placeholder: '例如：小明' },
  { key: 'age', label: '年齡', type: 'number', required: true, placeholder: '例如：20' },
  {
    key: 'chem_background',
    label: '化學學習背景',
    type: 'single',
    required: true,
    options: ['高中基礎化學', '高中選修化學', '大學普通化學（含）以上', '其他'],
  },
];

// 後續聯繫意願（可複選、可不選）。任一勾選即需填 Email。key 會成為 CSV 欄位。
export const CONTACT_INTENTS = [
  { key: 'interview_willing', label: '我有意願在後續參與約 20 分鐘的線上訪談' },
  { key: 'lottery_willing', label: '我有意願參加抽獎' },
];

export const LIKERT_LABELS = ['非常不同意', '不同意', '普通', '同意', '非常同意'];

// 前測問卷：AI 詳解信任校準（5 點量表）。
export const TRUST_ITEMS = [
  '我認為 AI 題目詳解通常是可靠的。',
  '即使 AI 的解釋很流暢，我仍會檢查其推理。',
  '當 AI 與我的理解不同時，我有能力判斷哪一方較可信。',
  '在不確定 AI 是否正確時，我會尋找更多資訊。',
];

// 後測問卷：困惑、可靠性感受、持續使用意願，以及對兩項回應特徵的偏好／可接受性／
// 負擔（計畫書 §6.4「安全性與體驗結果」）。5 點量表。
export const EXPERIENCE_ITEMS = [
  '整體而言，這些 AI 詳解讓我感到困惑。',
  '整體而言，我認為這些 AI 詳解是可靠的。',
  '我願意在未來的學習中繼續使用這類 AI 詳解。',
  '開頭先點名我剛才選的答案，對我是有幫助的。',
  '開頭先出現一個錯誤答案再立刻更正，讓我更仔細閱讀後面的詳解。',
  '這些開頭讓我覺得有負擔或被干擾。',
];

// 操弄檢核（計畫書 §6.4）：確認兩項操弄是否被感知，於正式揭露前作答。
export const MANIPULATION_SINGLE = [
  {
    key: 'mentioned_my_option',
    question: 'AI 詳解的開頭，是否曾直接提到「你剛才選的那個選項」？',
    options: ['有，曾直接提到我選的選項', '沒有', '不確定'],
  },
  {
    key: 'self_corrected',
    question: 'AI 是否曾在回答中「先講一個答案、又馬上把它更正成另一個」？',
    options: ['有，曾立刻自我更正', '沒有', '不確定'],
  },
];

export const MANIPULATION_MULTI = {
  key: 'made_me_recheck',
  question: '哪一種開頭最容易讓你想「停下來重新檢查」？（可複選）',
  options: [
    '開頭直接提到我選的選項',
    'AI 先說錯、再馬上更正',
    '只有「注意！」這類提醒',
    '都不會特別讓我重新檢查',
  ],
};

// 知情同意文案（不揭露刻意不一致，完成後再完整說明）。計畫書 §9.6：
// 明確說明蒐集作答、信心、頁面焦點、捲動，以及游標進入固定內容區域的次數與累積時間；
// 不蒐集游標座標、不錄螢幕，也不蒐集實驗頁面外的活動。
export const CONSENT_TEXT = `感謝你有興趣參與本次學習研究。請詳細閱讀以下說明：

• 所需時間：整體約需 30 分鐘，包含前測、學習任務、幾個簡短問題、後測與一份簡短問卷。
• 進行方式：請使用電腦瀏覽器完成；畫面中央會維持固定的手機比例閱讀區。
• 會記錄什麼：你的作答與信心、每個畫面與內容區域的停留時間、捲動與頁面是否在前景，以及游標「進入各固定內容區域」的次數與累積時間。
• 不會記錄什麼：不會記錄游標座標或移動軌跡、不錄製螢幕、不記錄鍵盤輸入，也不追蹤實驗頁面以外的任何活動。
• 完全自願：是否參與完全出於自願，你可以隨時退出，不需要任何理由。
• 資料如何保存：所有資料以匿名研究代碼蒐集與儲存，不連結可辨識你的個人身分，僅用於學術研究與發表。
• 不影響成績：本研究與任何正式課程成績無關。
• 為避免影響研究結果，部分研究細節會在你完成後完整說明。`;

// 事後揭露文案（全部流程結束後顯示）。計畫書 §9.5。
export const DEBRIEF_INTRO = `感謝你完成本次研究！

需要向你說明：在「學習任務」中，AI 詳解的「開頭」其實有四種版本，分別組合了兩項設計——
（1）是否先點名你剛才選的選項；（2）是否先出現一個非常短暫、明顯的錯誤答案，並在同一段話中立刻自我更正。

這些設計是本研究的核心，用來了解不同開頭如何影響你閱讀後面的詳解，而非要誤導你。
無論開頭是哪一種版本，之後接到的「完整正確詳解」都完全相同、且都是正確的。

以下列出你這次遇到「開頭曾出現短暫錯誤再更正」的題目與正確答案，供你再次核對。`;
