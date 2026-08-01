'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import QuizPierreHci, { type QuizFinishResult, type AnswerRecord } from '../components/QuizPierreHci';
import { LEVELS } from '../data/questions';
import { BOOK, SUBJECT, TRUST_ITEMS, EXPERIENCE_ITEMS } from '../lib/experimentConfig';
import { emptyInteraction } from '../lib/tracker';
import { isTouchOnlyDevice } from '../lib/device';
import { saveBuffer, clearBuffer, flushPartialBeacon } from '../lib/sessionBuffer';
import {
  WelcomeStep,
  EligibilityStep,
  ConsentStep,
  DemographicsStep,
  QuestionnaireStep,
  ManipulationCheckStep,
  DebriefStep,
  IntermissionStep,
  DoneStep,
  type EligibilityData,
  type ConsentData,
  type DemographicsData,
  type ManipulationData,
} from './steps';
import FlowProgress, { type FlowStage } from './FlowProgress';

type Step =
  | 'welcome'
  | 'eligibility'
  | 'consent'
  | 'demographics'
  | 'preQuestionnaire'
  | 'preIntermission'
  | 'preTest'
  | 'learnIntermission'
  | 'learning'
  | 'manipulation'
  | 'postIntermission'
  | 'postTest'
  | 'postQuestionnaire'
  | 'debrief'
  | 'done';

type PhaseResult = QuizFinishResult & {
  section: string;
  levelId: string;
  isLearning: boolean;
};

// 進度列的使用者可見階段（中場過場併入其對應測驗階段）。
const FLOW_STAGES: FlowStage[] = [
  { key: 'welcome', label: '歡迎' },
  { key: 'eligibility', label: '資格確認' },
  { key: 'consent', label: '知情同意' },
  { key: 'demographics', label: '基本資料' },
  { key: 'preQuestionnaire', label: '前問卷' },
  { key: 'preTest', label: '前測' },
  { key: 'learning', label: '學習任務' },
  { key: 'manipulation', label: '操弄檢核' },
  { key: 'postTest', label: '後測' },
  { key: 'postQuestionnaire', label: '後問卷' },
  { key: 'debrief', label: '研究說明' },
  { key: 'done', label: '完成' },
];

// 內部 Step（含中場）對應到進度列階段索引。
const STEP_TO_STAGE: Record<Step, number> = {
  welcome: 0,
  eligibility: 1,
  consent: 2,
  demographics: 3,
  preQuestionnaire: 4,
  preIntermission: 5,
  preTest: 5,
  learnIntermission: 6,
  learning: 6,
  manipulation: 7,
  postIntermission: 8,
  postTest: 8,
  postQuestionnaire: 9,
  debrief: 10,
  done: 11,
};

function genParticipantId(): string {
  const ts = Date.now().toString();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `P${ts.slice(-6)}${rand}`;
}

// 原始逐題（跨前測／學習／後測）long-format 列——基本欄位。
function mapAnswer(a: AnswerRecord) {
  return {
    question_index: a.questionIndex,
    question_id: a.questionId,
    pair_id: a.pairId,
    knowledge_point: a.knowledgePoint,
    question_text: a.questionText,
    selected_index: a.selectedIndex,
    selected_option: a.selectedOption,
    correct_index: a.correctIndex,
    correct_option: a.correctOption,
    is_correct: a.isCorrect,
    condition_code: a.conditionCode,
    framing: a.framing,
    interruption: a.interruption,
    first_i1: a.firstI1,
    i1_exposure_count: a.i1ExposureCount,
    post_first_i1: a.postFirstI1,
    confidence: a.confidence,
    answer_duration_ms: a.answerDurationMs,
    first_option_click_ms: a.firstOptionClickMs,
    option_change_count: a.optionChangeCount,
    skipped_typing: a.skippedTyping,
  };
}

export default function PierreHciFlow() {
  const [step, setStep] = useState<Step>('welcome');
  const [submitState, setSubmitState] = useState<'sending' | 'sent' | 'failed'>('sending');

  const participantId = useMemo(genParticipantId, []);
  const startedAt = useRef(new Date().toISOString());
  const sessionStart = useRef(Date.now());

  // 全程蒐集的資料，最後彙整成一次送出。
  const data = useRef<{
    eligibility?: EligibilityData;
    consent?: ConsentData;
    demographics?: DemographicsData;
    preScores?: number[];
    postScores?: number[];
    manipulation?: ManipulationData;
    pre?: PhaseResult;
    learning?: PhaseResult;
    post?: PhaseResult;
  }>({});
  const payloadRef = useRef<unknown>(null);
  const completedRef = useRef(false);
  const stepRef = useRef<Step>('welcome');

  // 裝置閘門：手機／平板（觸控且無精細指標）擋下，需用電腦。
  const [blocked, setBlocked] = useState(false);
  useEffect(() => setBlocked(isTouchOnlyDevice()), []);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const leave = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) window.history.back();
    else setStep('eligibility');
  };

  const questionnairePayload = (items: string[], scores?: number[]) =>
    (scores ?? []).map((score, i) => ({ item: items[i] ?? `item_${i + 1}`, score }));

  // 逐題配對後測：以 pair_id 對應學習試次與後測題。
  const buildTrials = () => {
    const learning = data.current.learning?.answers ?? [];
    const post = data.current.post?.answers ?? [];
    const postByPair = new Map(post.map((p) => [p.pairId, p]));
    return learning.map((a) => {
      const it = a.interaction ?? emptyInteraction();
      const paired = postByPair.get(a.pairId);
      return {
        participant_id: participantId,
        trial_id: a.questionIndex,
        item_id: a.pairId || a.questionId,
        condition_code: a.conditionCode,
        answer_correct: a.isCorrect,
        confidence: a.confidence,
        first_i1: a.firstI1,
        i1_exposure_count: a.i1ExposureCount,
        post_first_i1: a.postFirstI1,
        opening_visible_ms: it.openingVisibleMs,
        correct_explanation_visible_ms: it.correctExplanationVisibleMs,
        opening_hover_ms: it.openingHoverMs,
        opening_enter_count: it.openingEnterCount,
        explanation_hover_ms: it.explanationHoverMs,
        explanation_enter_count: it.explanationEnterCount,
        option_analysis_hover_ms: it.optionAnalysisHoverMs,
        option_analysis_enter_count: it.optionAnalysisEnterCount,
        scroll_down_count: it.scrollDownCount,
        scroll_up_count: it.scrollUpCount,
        scroll_active_ms: it.scrollActiveMs,
        max_scroll_percent: it.maxScrollPercent,
        revisit_count: it.revisitCount,
        container_leave_count: it.containerLeaveCount,
        container_outside_ms: it.containerOutsideMs,
        focus_lost_count: it.focusLostCount,
        focus_lost_ms: it.focusLostMs,
        continue_click_ms: it.continueClickMs,
        posttest_correct: paired ? paired.isCorrect : null,
        posttest_confidence: paired ? paired.confidence : null,
      };
    });
  };

  const buildPayload = () => {
    const d = data.current;
    const phases = [d.pre, d.learning, d.post].filter(Boolean) as PhaseResult[];
    return {
      session_id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${participantId}-${Date.now()}`,
      participant_id: participantId,
      user_id: participantId,
      subject: BOOK,
      chapter: SUBJECT.chapter,
      design: '2x2_within',
      started_at: startedAt.current,
      session_duration_ms: Date.now() - sessionStart.current,
      demographics: d.demographics ?? {},
      eligibility: {
        items: d.eligibility?.items ?? [],
        all_confirmed: d.eligibility?.allConfirmed ?? false,
      },
      consent: { agreed: d.consent?.agreed ?? false },
      questionnaires: [
        { phase: 'pre', answers: questionnairePayload(TRUST_ITEMS, d.preScores) },
        { phase: 'post', answers: questionnairePayload(EXPERIENCE_ITEMS, d.postScores) },
      ],
      manipulation: d.manipulation
        ? { single: d.manipulation.single, multi: d.manipulation.multi }
        : null,
      // 逐題配對的互動與後測（主要分析資料；對應 pierre_hci_trial_interaction_schema.csv）。
      trials: buildTrials(),
      phases: phases.map((p) => ({
        section: p.section,
        level_id: p.levelId,
        is_learning: p.isLearning,
        correct_count: p.correctCount,
        total_count: p.totalCount,
        stars: p.stars,
        session_duration_ms: p.sessionDurationMs,
        started_at: p.startedAt,
        answers: p.answers.map(mapAnswer),
      })),
    };
  };

  const submit = async () => {
    setSubmitState('sending');
    try {
      const res = await fetch('/api/submit-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadRef.current),
      });
      if (res.ok) clearBuffer();
      setSubmitState(res.ok ? 'sent' : 'failed');
    } catch {
      setSubmitState('failed');
    }
  };

  // 抗遺失：切到背景時寫 localStorage；真正離開頁面時把未完成資料以 beacon 送出。
  useEffect(() => {
    const hasProgress = () => {
      const d = data.current;
      return !!(d.pre || d.learning || d.post || d.preScores || d.postScores);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveBuffer(data.current);
    };
    const onPageHide = () => {
      if (completedRef.current || !hasProgress()) return;
      try {
        flushPartialBeacon({ ...buildPayload(), partial: true, last_step: stepRef.current });
      } catch {
        /* 忽略 */
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 揭露頁列出「開頭曾出現短暫錯誤再更正」的題（實際被指派到 I1 的題）。
  const inconsistentItems = () => {
    const answers = data.current.learning?.answers ?? [];
    return answers
      .filter((a) => a.interruption === 'I1')
      .map((a) => ({ questionText: a.questionText, correctOption: a.correctOption }));
  };

  const runQuiz = (
    key: 'pre' | 'learning' | 'post',
    section: string,
    levelId: string,
    isLearning: boolean,
    collectConfidence: boolean,
    next: Step,
  ) => (
    <QuizPierreHci
      key={key}
      level={LEVELS[levelId]}
      sectionTitle={section}
      isLearning={isLearning}
      experimentId={participantId}
      subjectOffset={SUBJECT.subjectOffset}
      collectConfidence={collectConfidence}
      reportToFlow
      onBack={leave}
      onCheckpoint={(answers) => {
        const prev = data.current[key];
        data.current[key] = {
          section,
          levelId,
          isLearning,
          correctCount: answers.filter((a) => a.isCorrect).length,
          totalCount: answers.length,
          stars: prev?.stars ?? 0,
          sessionDurationMs: prev?.sessionDurationMs ?? 0,
          startedAt: prev?.startedAt ?? '',
          answers,
        };
        saveBuffer(data.current);
      }}
      onFinish={(r) => {
        data.current[key] = { ...r, section, levelId, isLearning };
        saveBuffer(data.current);
        setStep(next);
      }}
    />
  );

  const renderStep = () => {
    switch (step) {
    case 'welcome':
      return <WelcomeStep onStart={() => setStep('eligibility')} />;
    case 'eligibility':
      return (
        <EligibilityStep
          onBack={() => setStep('welcome')}
          onNext={(d) => {
            data.current.eligibility = d;
            setStep('consent');
          }}
          onLeave={leave}
        />
      );
    case 'consent':
      return (
        <ConsentStep
          onBack={() => setStep('eligibility')}
          onAgree={(d) => {
            data.current.consent = d;
            setStep('demographics');
          }}
          onDecline={leave}
        />
      );
    case 'demographics':
      return (
        <DemographicsStep
          onNext={(d) => {
            data.current.demographics = d;
            setStep('preQuestionnaire');
          }}
        />
      );
    case 'preQuestionnaire':
      return (
        <QuestionnaireStep
          title="開始前：你對 AI 詳解的看法"
          items={TRUST_ITEMS}
          onSubmit={(scores) => {
            data.current.preScores = scores;
            setStep('preIntermission');
          }}
        />
      );
    case 'preIntermission':
      return (
        <IntermissionStep
          title="前測"
          desc={`先做 ${LEVELS[SUBJECT.preTestLevelId].questions.length} 題，了解你目前的基礎。這部分不會顯示詳解。`}
          onStart={() => setStep('preTest')}
        />
      );
    case 'preTest':
      return runQuiz('pre', '前測', SUBJECT.preTestLevelId, false, false, 'learnIntermission');
    case 'learnIntermission':
      return (
        <IntermissionStep
          title="學習任務"
          desc={`接下來 ${LEVELS[SUBJECT.learningLevelId].questions.length} 題。每題送出前先評估你的信心（1~5），作答後會看到 AI 詳解，請仔細閱讀後再進入下一題。`}
          onStart={() => setStep('learning')}
        />
      );
    case 'learning':
      return runQuiz('learning', '學習任務', SUBJECT.learningLevelId, true, true, 'manipulation');
    case 'manipulation':
      return (
        <ManipulationCheckStep
          onSubmit={(d) => {
            data.current.manipulation = d;
            setStep('postIntermission');
          }}
        />
      );
    case 'postIntermission':
      return (
        <IntermissionStep
          title="後測"
          desc={`最後 ${LEVELS[SUBJECT.postTestLevelId].questions.length} 題新題目，檢視學習成果。每題同樣評估信心，這部分不會顯示詳解。`}
          onStart={() => setStep('postTest')}
        />
      );
    case 'postTest':
      return runQuiz('post', '後測', SUBJECT.postTestLevelId, false, true, 'postQuestionnaire');
    case 'postQuestionnaire':
      return (
        <QuestionnaireStep
          title="用完之後：你現在的看法"
          items={EXPERIENCE_ITEMS}
          onSubmit={(scores) => {
            data.current.postScores = scores;
            // 所有資料蒐集完成：彙整並「一次」送出；標記完成，避免離開時再送 partial。
            payloadRef.current = buildPayload();
            completedRef.current = true;
            submit();
            setStep('debrief');
          }}
        />
      );
    case 'debrief':
      return <DebriefStep inconsistentItems={inconsistentItems()} onFinish={() => setStep('done')} />;
    case 'done':
      return <DoneStep submitState={submitState} onRetry={submit} />;
    }
  };

  if (blocked) {
    return (
      <div className="app-shell">
        <div className="app-shell__body">
          <div style={{ maxWidth: 360, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>💻</div>
            <h2 style={{ marginBottom: 12 }}>請改用電腦開啟</h2>
            <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              本研究需要在桌上型或筆記型電腦（有滑鼠或觸控板）上進行，
              但偵測到您目前使用的是手機或平板。請改用電腦瀏覽器開啟本頁面後再開始，謝謝您。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <FlowProgress stages={FLOW_STAGES} current={STEP_TO_STAGE[step]} />
      <div className="app-shell__body">{renderStep()}</div>
    </div>
  );
}
