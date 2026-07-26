// 人機互動實驗：2 × 2 組內因子詳解「條件」指派（受限隨機、版本平衡）。
// 對照更新版研究計畫 §5：兩項可操弄的 AI 詳解開頭微特徵，皆於參與者內操弄。
//   因子一 Answer-contingent framing：F0＝一般 framing（描述預先指定的常見錯誤選項）
//                                     F1＝作答連結 framing（點名參與者實際選項）
//   因子二 不一致中斷：              I0＝無中斷（僅「注意！」提示）
//                                     I1＝短暫、刻意且立即自我修正的不一致
// 四個 cell：F0I0、F1I0、F0I1、F1I1。每位參與者 12 題各接觸三次。
// 第二階段（共同正確詳解）四條件逐字相同，見 app/lib/openings.ts。

export const CELLS = ['F0I0', 'F1I0', 'F0I1', 'F1I1'] as const;
export type Cell = (typeof CELLS)[number];

export type Framing = 'F0' | 'F1';
export type Interruption = 'I0' | 'I1';

export function framingOf(cell: Cell): Framing {
  return cell.startsWith('F1') ? 'F1' : 'F0';
}
export function interruptionOf(cell: Cell): Interruption {
  return cell.endsWith('I1') ? 'I1' : 'I0';
}
export function isI1(cell: Cell): boolean {
  return interruptionOf(cell) === 'I1';
}

// 逐題條件指派結果（含全組內設計所需的 carryover 標記）。
export type CellAssignment = {
  cell: Cell;
  framing: Framing;
  interruption: Interruption;
  // 這是否為本參與者「第一次」遇到 I1（計畫書 §5.3：初次中斷估計）。
  firstI1: boolean;
  // 到本題為止（含本題）累積遇到的 I1 次數。I0 題記錄「先前」已暴露的 I1 次數。
  i1ExposureCount: number;
  // 本題是否發生於第一次 I1 之後（用於估計 carryover / 殘留警覺）。
  postFirstI1: boolean;
};

/** 從 experiment_id（形如 P123456789）取穩定數值種子；無法解析時退回字元碼總和。 */
function numericSeed(experimentId: string): number {
  if (!experimentId) return 0;
  const m = experimentId.match(/(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n)) return n;
  }
  let sum = 0;
  for (const c of experimentId) sum += c.charCodeAt(0);
  return sum;
}

/** mulberry32：以整數種子產生可重現的偽亂數序列。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 以給定亂數函式對陣列做 Fisher–Yates 洗牌（原地）。 */
function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 依 experiment_id 做「區塊隨機化」逐題指派 cell（更新版計畫）：
 * 每 4 題為一個區塊，區塊內是四個 cell 的洗牌，因此「四種都出現過才會重複」。
 * 為保留一個未受不一致污染的基準，額外保證第一題為 I0（若首區塊首題為 I1 則與該
 * 區塊第一個 I0 互換）。並計算 firstI1／累積暴露／postFirstI1 等 carryover 標記。
 */
export function assignCells(
  count: number,
  experimentId: string,
  subjectOffset = 0,
): CellAssignment[] {
  const rand = mulberry32(numericSeed(experimentId) + subjectOffset * 2654435761);
  const seq: Cell[] = [];
  while (seq.length < count) {
    seq.push(...shuffle([...CELLS], rand));
  }
  seq.length = count;

  // 保證第一題為 I0（在首區塊內互換，維持區塊平衡）。
  if (count > 0 && isI1(seq[0])) {
    const swapAt = seq.slice(0, Math.min(4, count)).findIndex((c) => !isI1(c));
    if (swapAt > 0) [seq[0], seq[swapAt]] = [seq[swapAt], seq[0]];
  }

  let firstI1Pos = -1;
  for (let i = 0; i < count; i++) {
    if (isI1(seq[i])) {
      firstI1Pos = i;
      break;
    }
  }

  let cumulativeI1 = 0;
  const out: CellAssignment[] = [];
  for (let i = 0; i < count; i++) {
    const cell = seq[i];
    const thisIsI1 = isI1(cell);
    const exposureBefore = cumulativeI1;
    if (thisIsI1) cumulativeI1 += 1;
    out.push({
      cell,
      framing: framingOf(cell),
      interruption: interruptionOf(cell),
      firstI1: thisIsI1 && i === firstI1Pos,
      i1ExposureCount: thisIsI1 ? cumulativeI1 : exposureBefore,
      postFirstI1: firstI1Pos >= 0 && i > firstI1Pos,
    });
  }
  return out;
}
