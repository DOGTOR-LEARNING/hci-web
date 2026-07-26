// 從新版題庫 CSV 產生 Next.js 用的題目資料檔（app/data/questions.ts）。
//
// 更新版 2 × 2 設計（單一階段詳解）：每題有 F0／F1 兩版詳解。
//   F0 = 一般 framing 單段詳解（正解＋推理＋預先指定的常見錯誤選項）
//   F1 = 作答連結 framing：核心推理（explanation_f1_core）＋四個選項各自的單獨敘述
//        （f1_a～f1_d），渲染時點名參與者實際選項並列出四選項。
// I1（不一致中斷）不寫在 CSV，改由 app/lib/openings.ts 演算法即時生成：先選一個
//   「非正解、也非使用者選擇」的錯誤選項再立即更正。
//
// 用法：node scripts/gen-data.mjs [csv路徑]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = resolve(__dirname, '../data/pierre_hci_questions_v2.csv');
const csvPath = process.argv[2] && !process.argv[2].startsWith('--')
  ? resolve(process.argv[2])
  : DEFAULT_CSV;

/** 簡易 RFC4180 CSV 解析：支援雙引號內的逗號、換行與跳脫 "" */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // 忽略，交由 \n 收尾
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const raw = readFileSync(csvPath, 'utf8');
const rows = parseCsv(raw).filter((r) => r.length > 1 && r.some((c) => c !== ''));
const header = rows.shift();
const col = (name) => header.indexOf(name);

const optInt = (v) => {
  const s = (v ?? '').trim();
  if (s === '') return undefined;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? undefined : n;
};
const optStr = (v) => {
  const s = (v ?? '').trim();
  return s === '' ? undefined : s;
};

const levels = new Map();
for (const r of rows) {
  const levelId = r[col('level_id')].trim();
  if (!levelId) continue;
  const f1 = [
    optStr(r[col('f1_a')]),
    optStr(r[col('f1_b')]),
    optStr(r[col('f1_c')]),
    optStr(r[col('f1_d')]),
  ];
  const hasF1 = f1.some((x) => x !== undefined);
  const question = {
    questionId: r[col('question_id')].trim(),
    pairId: r[col('pair_id')].trim(),
    knowledgePoint: r[col('knowledge_point')].trim(),
    question: r[col('question')].trim(),
    options: [
      r[col('option_a')].trim(),
      r[col('option_b')].trim(),
      r[col('option_c')].trim(),
      r[col('option_d')].trim(),
    ],
    correctIndex: parseInt(r[col('correct_index')].trim(), 10) || 0,
  };
  // 學習題專用（前／後測留空則不附加）。
  const cdi = optInt(r[col('common_distractor_index')]);
  if (cdi !== undefined) question.commonDistractorIndex = cdi;
  const f0 = optStr(r[col('explanation_f0')]);
  if (f0 !== undefined) question.explanationF0 = f0;
  const f1core = optStr(r[col('explanation_f1_core')]);
  if (f1core !== undefined) question.explanationF1Core = f1core;
  if (hasF1) question.f1Options = f1.map((x) => x ?? '');

  if (!levels.has(levelId)) levels.set(levelId, []);
  levels.get(levelId).push(question);
}

const out = {};
for (const [levelId, qs] of levels) {
  // 含詳解關卡（學習任務）：任一題帶 F0／F1 內容。
  const hasExplanations = qs.some((q) => q.explanationF0 || q.f1Options);
  out[levelId] = { hasExplanations, questions: qs };
}

const banner =
  `// 本檔由 scripts/gen-data.mjs 從 ${'data/pierre_hci_questions_v2.csv'} 自動產生，請勿手動編輯。\n` +
  `// 更新版 2 × 2 設計（單一階段詳解）：F0／F1 兩版；I1 由 app/lib/openings.ts 演算法生成。\n`;
const body =
  banner +
  `export type PierreHciQuestion = {\n` +
  `  questionId: string;\n` +
  `  pairId: string;\n` +
  `  knowledgePoint: string;\n` +
  `  question: string;\n` +
  `  options: string[];\n` +
  `  correctIndex: number;\n` +
  `  // ── 學習題（含詳解）專用；前／後測留空 ──\n` +
  `  commonDistractorIndex?: number; // F0 描述對象、I1 momentary 錯誤的優先候選\n` +
  `  explanationF0?: string;         // F0 單段詳解（一般 framing）\n` +
  `  explanationF1Core?: string;     // F1 核心推理（作答連結 framing）\n` +
  `  f1Options?: string[];           // F1 四個選項各自的單獨敘述（長度 4）\n` +
  `};\n\n` +
  `export type PierreHciLevel = {\n` +
  `  hasExplanations: boolean;\n` +
  `  questions: PierreHciQuestion[];\n` +
  `};\n\n` +
  `export const LEVELS: Record<string, PierreHciLevel> = ${JSON.stringify(out, null, 2)};\n`;

const dest = resolve(__dirname, '../app/data/questions.ts');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, body, 'utf8');

const summary = Object.entries(out)
  .map(([k, v]) => `${k}(${v.questions.length}題${v.hasExplanations ? '·含詳解' : ''})`)
  .join('  ');
console.log(`已產生 ${dest}`);
console.log(`關卡：${summary}`);
