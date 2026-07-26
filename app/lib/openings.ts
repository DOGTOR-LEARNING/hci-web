// 條件化詳解產生器（更新版 2 × 2，單一階段詳解）。
//
// 詳解只有「一個階段」，分 F0／F1 兩版（authored，見 questions.ts）：
//   F0（一般 framing）：explanationF0 單段詳解，描述預先指定的常見錯誤選項。
//   F1（作答連結 framing）：explanationF1Core 核心推理 ＋ 四個選項各自的單獨敘述
//     （f1Options），渲染時點名參與者實際選擇的選項。
//
// 不一致中斷（I 因子）不寫在題庫，改由「演算法」即時生成並前置於詳解：
//   I0：以「注意！」作為醒目提示，用來平衡 I1 自我修正帶來的注意力吸引（控制單純 salience）。
//   I1：先選一個「非正解、也非使用者選擇」的錯誤選項作為 momentary 錯誤，立即在同一句
//       自我修正回正解；其自我修正本身即為注意力機制，故不另加「注意！」。

import type { Framing, Interruption } from './condition';
import type { PierreHciQuestion } from '../data/questions';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function letterOf(i: number): string {
  return LETTERS[i] ?? String(i + 1);
}

/**
 * I1 的 momentary 錯誤選項：必須「非正解、也非使用者選擇」。
 * 優先採用每題預先指定的常見干擾選項（若符合條件），否則取第一個符合的錯誤選項。
 * 回傳選項索引；理論上 4 選項恆有 ≥1 候選。
 */
export function pickI1Distractor(q: PierreHciQuestion, selectedIndex: number | null): number {
  const n = q.options.length;
  const banned = new Set<number>([q.correctIndex]);
  if (selectedIndex != null && selectedIndex >= 0) banned.add(selectedIndex);
  const cdi = q.commonDistractorIndex;
  if (cdi != null && !banned.has(cdi)) return cdi;
  for (let i = 0; i < n; i++) {
    if (!banned.has(i)) return i;
  }
  // 退路（極端情況）：任一非正解選項。
  for (let i = 0; i < n; i++) {
    if (i !== q.correctIndex) return i;
  }
  return q.correctIndex;
}

/**
 * I 因子開頭（演算法生成，屬 AI 詳解的第一段文字）。
 *   I0（無中斷）：以「注意！」作為醒目提示，平衡 I1 的注意力吸引機制（控制單純 salience）。
 *   I1（有中斷）：以一處極短、明顯且立即自我修正的錯誤開頭；其自我修正即注意力機制，不加「注意！」。
 */
export function buildInterruptionOpening(
  q: PierreHciQuestion,
  selectedIndex: number | null,
  interruption: Interruption,
): string {
  if (interruption !== 'I1') return '**注意！**';
  const correctLetter = letterOf(q.correctIndex);
  const wrongLetter = letterOf(pickI1Distractor(q, selectedIndex));
  return `這題答案為 ${wrongLetter}……等等，這與系統衝突，正確答案是 ${correctLetter}。`;
}

export type FramingBody = {
  // explanation main 區域（核心正確推理）。
  main: string;
  // option analysis 區域（僅 F1：點名參與者實際選項並說明該選項；F0 為空字串）。
  optionAnalysis: string;
};

/** 去掉本體開頭的「正確答案是 …。」句（I1 時開頭已宣告正解，避免重複兩次）。 */
function stripLeadingAnswer(text: string): string {
  return text.replace(/^\s*正確答案是[^。]*。\s*/, '');
}

/**
 * F 因子詳解本體（單一階段）。
 *   F0：直接使用 explanationF0（一般 framing，描述預先指定的常見錯誤選項）。
 *   F1（作答連結 framing）：只點名參與者「實際選擇」的那個選項，並給出該選項的
 *     單獨敘述（答對＝確認一致，答錯＝說明誤判），再接核心正確推理。不列出其他選項。
 * 當 interruption 為 I1 時，開頭的自我修正已宣告正解，故略去本體開頭的「正確答案是 X。」。
 */
export function buildFramingBody(
  q: PierreHciQuestion,
  selectedIndex: number | null,
  framing: Framing,
  interruption: Interruption,
): FramingBody {
  const correctLetter = letterOf(q.correctIndex);
  const dedup = (t: string) => (interruption === 'I1' ? stripLeadingAnswer(t) : t);

  if (framing === 'F0') {
    return { main: dedup((q.explanationF0 ?? '').trim()), optionAnalysis: '' };
  }

  // F1：核心推理（缺省時以正解句補上）。
  const core = (q.explanationF1Core ?? '').trim() || `正確答案是 ${correctLetter}。`;
  const selIdx = selectedIndex ?? -1;
  const f1 = q.f1Options ?? [];

  // 作答連結：先點名參與者實際選擇的選項，再針對「該選項」說明其正確或錯誤之處。
  let optionAnalysis = '';
  if (selIdx >= 0) {
    const clause = (f1[selIdx] ?? '').trim();
    const lead = selIdx === q.correctIndex ? `你選擇了 ${letterOf(selIdx)}，與正解一致` : `你選擇了 ${letterOf(selIdx)}`;
    optionAnalysis = clause ? `${lead}；${clause}。` : `${lead}。`;
  }

  return { main: dedup(core), optionAnalysis };
}
