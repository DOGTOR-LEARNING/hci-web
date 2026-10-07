'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import Markdown from './Markdown';
import { assignCells, type CellAssignment } from '../lib/condition';
import { buildInterruptionOpening, buildFramingBody } from '../lib/openings';
import { InteractionTracker, type TrialInteraction } from '../lib/tracker';
import type { PierreHciLevel, PierreHciQuestion } from '../data/questions';

// 逐題互動紀錄：涵蓋 2 × 2 條件、送出前信心（1–5）與每題彙整互動摘要。
export type AnswerRecord = {
  questionIndex: number;
  questionId: string;
  pairId: string;
  knowledgePoint: string;
  questionText: string;
  selectedIndex: number | null;
  selectedOption: string;
  correctIndex: number;
  correctOption: string;
  isCorrect: boolean;
  // ── 2 × 2 條件（前／後測留空）──
  conditionCode: string; // 'F0I0' | 'F1I0' | 'F0I1' | 'F1I1' | ''
  framing: string; // 'F0' | 'F1' | ''
  interruption: string; // 'I0' | 'I1' | ''
  firstI1: boolean;
  i1ExposureCount: number;
  postFirstI1: boolean;
  // 送出前原始作答信心（1–5；未收集則 null）。
  confidence: number | null;
  // 基本作答計時／點擊。
  answerDurationMs: number;
  firstOptionClickMs: number | null;
  optionChangeCount: number;
  skippedTyping: boolean;
  // 每題彙整互動摘要（僅學習試次；前／後測為 null）。
  interaction: TrialInteraction | null;
};

export type QuizFinishResult = {
  correctCount: number;
  totalCount: number;
  stars: number;
  sessionDurationMs: number;
  startedAt: string;
  answers: AnswerRecord[];
};

type Props = {
  level: PierreHciLevel;
  sectionTitle: string;
  /** 為「實驗」學習任務時顯示條件化開頭＋共同正確詳解並啟動互動追蹤；前／後測則為純作答。 */
  isLearning: boolean;
  experimentId: string;
  /** 版本平衡偏移。 */
  subjectOffset?: number;
  /** 是否於送出前收集 1–5 分作答信心。 */
  collectConfidence?: boolean;
  onBack?: () => void;
  onFinish?: (result: QuizFinishResult) => void | Promise<void>;
  /** 逐題回呼：每答完一題交出目前累積答案，供流程頁做 localStorage 緩衝與抗遺失。 */
  onCheckpoint?: (answers: AnswerRecord[]) => void;
  /** 流水線模式：完成時直接把結果交給流程頁，不顯示結果彈窗、不自行上傳。 */
  reportToFlow?: boolean;
};

// 送出前信心量表（1~5，點選）。
const CONFIDENCE_LABELS = ['非常不確定', '不太確定', '普通', '蠻確定', '非常確定'];

function calcStars(correct: number, total: number): number {
  const pct = Math.round((correct / total) * 100);
  if (pct >= 90) return 3;
  if (pct >= 60) return 2;
  if (pct >= 30) return 1;
  return 0;
}

type SubmitState = 'idle' | 'sending' | 'sent' | 'failed';

export default function QuizPierreHci({
  level,
  sectionTitle,
  isLearning,
  experimentId,
  subjectOffset = 0,
  collectConfidence = true,
  onBack,
  onFinish,
  onCheckpoint,
  reportToFlow = false,
}: Props) {
  const questions = level.questions;

  // 依 experiment_id 指派每題 2 × 2 cell（含 carryover 標記）。僅學習任務使用。
  const cells = useMemo<CellAssignment[]>(
    () => assignCells(questions.length, experimentId, subjectOffset),
    [questions.length, experimentId, subjectOffset],
  );

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [breakPending, setBreakPending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const thinkingRef = useRef(false);
  const thinkingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingOverlayRef = useRef<HTMLDivElement | null>(null);

  const [result, setResult] = useState<QuizFinishResult | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const answersRef = useRef<AnswerRecord[]>([]);
  const questionShownAt = useRef<number | null>(null);
  const sessionStart = useRef<number>(Date.now());
  const startedAt = useRef<string>(new Date().toISOString());

  // 當前題目的即時點擊指標（每題重置）。
  const firstClickMs = useRef<number | null>(null);
  const optionChangeCount = useRef(0);

  // 互動追蹤器（每個學習試次一個）與區域 ref。
  const trackerRef = useRef<InteractionTracker | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const explainScrollRef = useRef<HTMLDivElement | null>(null);
  const openingRef = useRef<HTMLDivElement | null>(null);
  const explanationRef = useRef<HTMLDivElement | null>(null);
  const explanationMainRef = useRef<HTMLDivElement | null>(null);
  const optionAnalysisRef = useRef<HTMLDivElement | null>(null);

  const q: PierreHciQuestion | undefined = questions[index];
  const isLast = index >= questions.length - 1;

  // 題目與選項立即顯示；休息頁不計入下一題作答時間。
  useEffect(() => {
    if (!q || breakPending) return;
    firstClickMs.current = null;
    optionChangeCount.current = 0;
    questionShownAt.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, breakPending]);

  useEffect(() => {
    if (!thinking) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    thinkingOverlayRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [thinking]);

  useEffect(() => () => {
    if (thinkingTimer.current) clearTimeout(thinkingTimer.current);
  }, []);

  // 學習試次：作答後條件化開頭＋共同正確詳解顯示時，啟動互動追蹤器。
  useEffect(() => {
    if (!isLearning || isCorrect === null) return;
    const t = new InteractionTracker();
    t.setScrollRoot(explainScrollRef.current);
    t.setContainer(phoneRef.current);
    t.registerRegion('opening', openingRef.current);
    t.registerRegion('explanation', explanationRef.current);
    t.registerRegion('explanationMain', explanationMainRef.current);
    t.registerRegion('optionAnalysis', optionAnalysisRef.current);
    trackerRef.current = t;
    const raf = requestAnimationFrame(() => t.begin());
    return () => {
      cancelAnimationFrame(raf);
      t.dispose();
      if (trackerRef.current === t) trackerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isCorrect, isLearning]);

  const handleSelect = (i: number) => {
    if (isCorrect !== null || thinkingRef.current) return;
    if (selected === null) {
      firstClickMs.current = questionShownAt.current ? Date.now() - questionShownAt.current : 0;
    } else if (i !== selected) {
      optionChangeCount.current += 1;
    }
    setSelected(i);
  };

  const confirmAnswer = () => {
    if (selected === null || !q || isCorrect !== null || thinkingRef.current) return;
    if (collectConfidence && confidence === null) return;
    const answerIsCorrect = selected === q.correctIndex;
    // 作答時長於「按下確認」的當下計算。
    const durationMs = questionShownAt.current ? Date.now() - questionShownAt.current : 0;

    if (isLearning) {
      thinkingRef.current = true;
      setThinking(true);
      thinkingTimer.current = setTimeout(() => {
        thinkingTimer.current = null;
        thinkingRef.current = false;
        setThinking(false);
        setIsCorrect(answerIsCorrect);
        if (answerIsCorrect) setCorrectCount((c) => c + 1);
      }, 1500);
    } else {
      setIsCorrect(answerIsCorrect);
      if (answerIsCorrect) setCorrectCount((c) => c + 1);
    }

    const cell = isLearning ? cells[index] : null;
    answersRef.current.push({
      questionIndex: index + 1,
      questionId: q.questionId,
      pairId: q.pairId,
      knowledgePoint: q.knowledgePoint,
      questionText: q.question,
      selectedIndex: selected,
      selectedOption: q.options[selected] ?? '',
      correctIndex: q.correctIndex,
      correctOption: q.options[q.correctIndex] ?? '',
      isCorrect: answerIsCorrect,
      conditionCode: cell?.cell ?? '',
      framing: cell?.framing ?? '',
      interruption: cell?.interruption ?? '',
      firstI1: cell?.firstI1 ?? false,
      i1ExposureCount: cell?.i1ExposureCount ?? 0,
      postFirstI1: cell?.postFirstI1 ?? false,
      confidence,
      answerDurationMs: durationMs,
      firstOptionClickMs: firstClickMs.current,
      optionChangeCount: optionChangeCount.current,
      skippedTyping: false,
      interaction: null,
    });
  };

  // 學習試次：結算互動追蹤，寫回當前 answer 紀錄。
  const captureInteraction = () => {
    const t = trackerRef.current;
    if (!t) return;
    const interaction = t.finish();
    const last = answersRef.current[answersRef.current.length - 1];
    if (last) last.interaction = interaction;
    trackerRef.current = null;
  };

  const goNext = () => {
    captureInteraction();
    onCheckpoint?.([...answersRef.current]);
    if (isLearning && questions.length === 8 && index === 3) setBreakPending(true);
    questionShownAt.current = null;
    setIndex((i) => i + 1);
    setSelected(null);
    setConfidence(null);
    setIsCorrect(null);
  };

  const finish = async () => {
    captureInteraction();
    onCheckpoint?.([...answersRef.current]);
    const r: QuizFinishResult = {
      correctCount,
      totalCount: questions.length,
      stars: calcStars(correctCount, questions.length),
      sessionDurationMs: Date.now() - sessionStart.current,
      startedAt: startedAt.current,
      answers: [...answersRef.current],
    };
    if (reportToFlow) {
      onFinish?.(r);
      return;
    }
    setResult(r);
    if (onFinish) {
      setSubmitState('sending');
      try {
        await onFinish(r);
        setSubmitState('sent');
      } catch {
        setSubmitState('failed');
      }
    }
  };

  const restart = () => {
    if (thinkingTimer.current) clearTimeout(thinkingTimer.current);
    thinkingTimer.current = null;
    thinkingRef.current = false;
    setThinking(false);
    answersRef.current = [];
    firstClickMs.current = null;
    optionChangeCount.current = 0;
    questionShownAt.current = Date.now();
    setBreakPending(false);
    trackerRef.current?.dispose();
    trackerRef.current = null;
    sessionStart.current = Date.now();
    startedAt.current = new Date().toISOString();
    setResult(null);
    setSubmitState('idle');
    setCorrectCount(0);
    setSelected(null);
    setConfidence(null);
    setIsCorrect(null);
    setIndex(0);
  };

  if (!q) return null;

  if (breakPending) {
    return (
      <div className="phone">
        <div className="appbar"><span className="appbar__title">{sectionTitle}</span></div>
        <div className="scroll break-card">
          <div className="flow-h">已完成一半</div>
          <p>你已完成 4 題學習題。可以稍作休息，準備好後再繼續剩下的 4 題。</p>
        </div>
        <div className="bottombar">
          <button className="btn btn--primary" onClick={() => setBreakPending(false)}>繼續作答</button>
        </div>
      </div>
    );
  }

  const okClass = isCorrect ? 'ok' : 'no';
  const canConfirm = selected !== null && (!collectConfidence || confidence !== null);

  const cell = isLearning ? cells[index] : null;
  const openingText =
    isLearning && cell ? buildInterruptionOpening(q, selected, cell.interruption) : '';
  const body =
    isLearning && cell
      ? buildFramingBody(q, selected, cell.framing, cell.interruption)
      : { main: '', optionAnalysis: '' };
  const explanationMain = body.main;
  const optionAnalysis = body.optionAnalysis;

  return (
    <div className="phone" ref={phoneRef}>
      {/* 頂部列 */}
      <div className="appbar">
        <button className="appbar__back" onClick={() => onBack?.()} aria-label="返回" disabled={thinking}>
          <ArrowLeft size={22} />
        </button>
        <span className="appbar__title">{sectionTitle}</span>
      </div>

      {/* 進度 */}
      <div className="progress">
        <div className="progress__row">
          <span className="progress__label">
            問題 {index + 1}/{questions.length}
          </span>
          {q.knowledgePoint ? <span className="chip">{q.knowledgePoint}</span> : null}
          <span className="progress__spacer" />
        </div>
        <div className="progress__bar">
          <div
            className="progress__fill"
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 內容 */}
      <div className="scroll">
        <div className="qcard">{q.question}</div>

        <div className="options">
          {q.options.map((opt, i) => {
            const isSel = selected === i;
            const isCorrectOption = i === q.correctIndex;
            let stateClass = '';
            if (isLearning && isCorrect !== null) {
              if (isCorrectOption) stateClass = 'correct';
              else if (isSel) stateClass = 'wrong';
            } else if (isSel) {
              stateClass = 'selected';
            }
            const mark =
              isLearning && isCorrect !== null && isCorrectOption ? (
                <CheckCircle2 size={22} />
              ) : isLearning && isCorrect !== null && isSel ? (
                <XCircle size={22} />
              ) : null;
            return (
              <button
                key={i}
                className={`option reveal ${isSel ? 'selected' : ''} ${stateClass}`}
                disabled={isCorrect !== null || thinking}
                onClick={() => handleSelect(i)}
              >
                <span className="option__badge">{String.fromCharCode(65 + i)}</span>
                <span className="option__text">{opt}</span>
                {mark ? (
                  <span className={`option__mark ${isCorrectOption ? 'ok' : 'no'}`}>{mark}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 送出前作答信心（1~5，點選），計畫書要求：送出、得知正誤前填寫 */}
        {collectConfidence && selected !== null && isCorrect === null ? (
          <div className="confidence">
            <div className="qitem__text">送出前，你有多確定這個答案？</div>
            <div className="likert">
              {CONFIDENCE_LABELS.map((lbl, j) => (
                <div
                  key={j}
                  className={`likert__opt ${confidence === j + 1 ? 'on' : ''}`}
                  onClick={() => { if (!thinkingRef.current) setConfidence(j + 1); }}
                >
                  <div className="likert__num">{j + 1}</div>
                  <div className="likert__lbl">{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* 前測／後測僅確認已記錄，避免在學習或後測前洩漏正解。 */}
      {!isLearning && isCorrect !== null ? (
        <div className="testflash">已記錄作答</div>
      ) : null}

      {/* 底部按鈕列 */}
      {isCorrect === null ? (
        <div className="bottombar">
          <button
            className="btn btn--primary"
            disabled={!canConfirm || thinking}
            onClick={confirmAnswer}
          >
            {collectConfidence && confidence === null && selected !== null
              ? '請先評估信心'
              : '確認答案'}
          </button>
        </div>
      ) : (
        <div className="bottombar">
          <button className="btn btn--primary" onClick={isLast ? finish : goNext}>
            {isLast ? '完成測驗' : '下一題'}
          </button>
        </div>
      )}

      {/* 學習試次：AI 詳解四種呈現方式（I 開頭 → 關於你的作答 → 正確推理，屬同一段連續文字） */}
      {isLearning && isCorrect !== null ? (
        <div className={`explain ${okClass}`}>
          <div className="explain__scroll" ref={explainScrollRef}>
            <div className={`explain__head ${okClass}`}>
              {isCorrect ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
              <span>{isCorrect ? '答對了！' : '答錯了！'}</span>
            </div>

            <div className="explain__region" ref={explanationRef} data-region="explanation">
              <div className="explain__title">AI 詳解</div>
              <div className="explain__flow">
                {openingText ? (
                  <div ref={openingRef} data-region="opening">
                    <Markdown text={openingText} />
                  </div>
                ) : null}
                {optionAnalysis ? (
                  <div ref={optionAnalysisRef} data-region="option-analysis">
                    <Markdown text={optionAnalysis} />
                  </div>
                ) : null}
                <div ref={explanationMainRef} data-region="explanation-main">
                  <Markdown text={explanationMain} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {thinking ? (
        <div
          className="gen-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="AI 正在思考中"
          tabIndex={-1}
          ref={thinkingOverlayRef}
          onKeyDown={(event) => event.preventDefault()}
        >
          <div className="gen-spinner" aria-hidden="true" />
          <div className="gen-text">AI 正在思考中…</div>
        </div>
      ) : null}

      {/* 結果彈窗（獨立模式，非流水線） */}
      {result ? (
        <ResultDialog result={result} submitState={submitState} onRestart={restart} />
      ) : null}
    </div>
  );
}

function ResultDialog({
  result,
  submitState,
  onRestart,
}: {
  result: QuizFinishResult;
  submitState: SubmitState;
  onRestart: () => void;
}) {
  const pct = Math.round((result.correctCount / result.totalCount) * 100);
  let msg: string;
  if (pct >= 90) msg = '太棒了！你對這個部分掌握得非常好！';
  else if (pct >= 70) msg = '做得好！你已經掌握了大部分內容。';
  else if (pct >= 50) msg = '繼續努力！你已經理解了一半的內容。';
  else msg = '需要更多練習，不要氣餒！';

  const star = (i: number, cls: string) => (
    <span className={cls}>{i < result.stars ? '★' : '☆'}</span>
  );

  const submitText: Record<SubmitState, string> = {
    idle: '',
    sending: '結果上傳中…',
    sent: '結果已上傳，感謝參與！',
    failed: '結果上傳失敗（資料已保留，可重試）',
  };

  return (
    <div className="overlay">
      <div className="dialog">
        <div className="dialog__title">測驗結果</div>
        <div className="stars">
          {star(0, 's1')}
          {star(1, 's2')}
          {star(2, 's3')}
        </div>
        <div
          className="dialog__pct"
          style={{ color: pct >= 70 ? '#16A34A' : pct >= 50 ? 'var(--accent)' : '#DC2626' }}
        >
          {pct}% 正確率
        </div>
        <div className="dialog__sub">
          {result.correctCount}/{result.totalCount} 題答對
        </div>
        <div className="dialog__msg">{msg}</div>
        {submitState !== 'idle' ? (
          <div
            className="dialog__sub"
            style={{ color: submitState === 'failed' ? '#DC2626' : 'var(--muted)', fontSize: 13 }}
          >
            {submitText[submitState]}
          </div>
        ) : null}
        <button className="dialog__btn" onClick={onRestart}>
          再測一次
        </button>
      </div>
    </div>
  );
}
