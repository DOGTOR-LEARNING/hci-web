'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  FlaskConical,
  ListChecks,
  ShieldCheck,
  Users,
  ClipboardCheck,
  FileText,
  UserRound,
  Gauge,
  Search,
  Info,
  Play,
  PartyPopper,
  Gift,
  type LucideIcon,
} from 'lucide-react';
import {
  ELIGIBILITY_ITEMS,
  CONSENT_TEXT,
  DEMOGRAPHIC_FIELDS,
  CONTACT_INTENTS,
  LIKERT_LABELS,
  MANIPULATION_SINGLE,
  MANIPULATION_MULTI,
  DEBRIEF_INTRO,
} from '../lib/experimentConfig';

// 流水線中的各「非測驗」步驟畫面。皆為純 UI＋callback，狀態由流程頁掌控。

export function FlowShell({
  title,
  onBack,
  children,
  footer,
}: {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="phone">
      <div className="appbar">
        {onBack ? (
          <button className="appbar__back" onClick={onBack} aria-label="返回">
            <ArrowLeft size={22} />
          </button>
        ) : null}
        <span className="appbar__title" style={{ paddingLeft: onBack ? 0 : 12 }}>
          {title}
        </span>
      </div>
      <div className="scroll">{children}</div>
      {footer ? <div className="flow-footer">{footer}</div> : null}
    </div>
  );
}

function StepHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <>
      <div className="flow-h-row">
        <Icon className="flow-h-row__icon" size={24} />
        <div className="flow-h">{title}</div>
      </div>
      {subtitle ? <div className="flow-sub">{subtitle}</div> : null}
    </>
  );
}

function Checkbox({ on }: { on: boolean }) {
  return <span className={`checkbox ${on ? 'on' : ''}`}>{on ? <Check size={15} /> : null}</span>;
}

// ── 歡迎／研究介紹 ─────────────────────────────────────────────────────────
export function WelcomeStep({ onStart }: { onStart: () => void }) {
  const rows: { icon: LucideIcon; title: string; desc: string }[] = [
    { icon: Clock, title: '預計約 20–30 分鐘', desc: '實際時間依閱讀速度而異；請在安靜環境一次完成。' },
    {
      icon: FlaskConical,
      title: '化學題目與解題說明',
      desc: '你會作答化學選擇題，並閱讀部分題目的解題說明。',
    },
    {
      icon: ListChecks,
      title: '你會依序完成',
      desc: '資格確認、基本資料、簡短問卷、前測 4 題、學習 8 題、後測 8 題。',
    },
    {
      icon: ShieldCheck,
      title: '完全自願、匿名',
      desc: '資料以匿名方式蒐集，僅用於學術研究，你可以隨時退出，且不影響任何成績。',
    },
  ];
  return (
    <FlowShell
      title="人機互動實驗"
      footer={
        <button className="btn-block" onClick={onStart}>
          開始 <ArrowRight size={18} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
        </button>
      }
    >
      <div className="welcome-hero">
        <div className="welcome-kicker">國立臺灣大學資訊管理學系・學習研究</div>
        <div className="welcome-title">化學題目與解題說明研究</div>
        <div className="welcome-lead">
          開始前，請先了解研究流程；稍後會說明你將看到的解題文字。
        </div>
      </div>

      <div className="info-list">
        {rows.map((r, i) => (
          <div className="info-row" key={i}>
            <div className="info-row__icon">
              <r.icon size={20} />
            </div>
            <div className="info-row__body">
              <div className="info-row__title">{r.title}</div>
              <div className="info-row__desc">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="reward-card">
        <div className="reward-card__icon"><Gift size={20} /></div>
        <div className="reward-card__body">
          <div className="reward-card__title">完成後可選擇參加抽獎</div>
          <div className="reward-card__desc">
            獎項為 <strong>500 元超商電子禮券</strong>，共抽出 <strong>3 名</strong>；
            得獎者將以 Email 通知。
          </div>
          <div className="reward-card__note">
            （記得在稍後的「基本資料」頁勾選抽獎意願並留下 Email，才能參加抽獎。）
          </div>
        </div>
      </div>

      <div className="note-card">
        <div className="note-card__head">
          <Users size={16} />
          我們是誰、為什麼找你
        </div>
        <div className="note-card__body">
          我們是<strong>國立臺灣大學資訊管理學系</strong>的學生，研究「人與 AI 互動」。
          我們想了解人在作答後如何閱讀解題說明，以及不同呈現方式是否影響理解。
          你的作答與閱讀行為能幫助我們改善學習系統的回饋方式。
        </div>
      </div>
    </FlowShell>
  );
}

// ── 前問卷前的中性說明；不透露詳解開頭的實驗條件 ──────────────────────────
export function ExplanationIntroStep({ onNext }: { onNext: () => void }) {
  return (
    <FlowShell
      title="研究說明"
      footer={<button className="btn-block" onClick={onNext}>了解，開始填問卷</button>}
    >
      <StepHeading icon={FileText} title="什麼是這裡的 AI 詳解？" />
      <p className="flow-sub">
        作答後，學習系統可能顯示一段由 AI 協助撰寫、事先檢查的解題文字，
        說明正確答案與判斷理由。本研究把這種文字稱為「AI 詳解」。
      </p>
      <div className="example-card">
        <div className="example-card__label">與正式題目無關的例子</div>
        <p>題目：月亮會自行發光嗎？</p>
        <p>解題說明：不會。月亮看起來發亮，是因為它反射了太陽光。</p>
      </div>
      <p className="flow-sub">
        接下來請依你目前的預期，回答對這類詳解的看法；完成題目後，
        我們會再詢問你的實際感受。問卷沒有標準答案。
      </p>
    </FlowShell>
  );
}

// ── 資格確認 ──────────────────────────────────────────────────────────────
export type EligibilityData = { items: string[]; allConfirmed: boolean };

export function EligibilityStep({
  onNext,
  onLeave,
  onBack,
}: {
  onNext: (data: EligibilityData) => void;
  onLeave: () => void;
  onBack?: () => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(ELIGIBILITY_ITEMS.map(() => false));
  const all = checked.every(Boolean);
  return (
    <FlowShell
      title="人機互動實驗"
      onBack={onBack ?? onLeave}
      footer={
        <>
          <button
            className="btn-block"
            disabled={!all}
            onClick={() => onNext({ items: ELIGIBILITY_ITEMS, allConfirmed: all })}
          >
            我符合資格，繼續
          </button>
          <button className="btn-text" onClick={onLeave}>
            我不符合資格／暫不參與
          </button>
        </>
      }
    >
      <StepHeading
        icon={ClipboardCheck}
        title="研究資格確認"
        subtitle="請確認你符合以下所有條件，才能參與本研究。"
      />
      <div className="check-all-row">
        <button
          type="button"
          className="btn-check-all"
          onClick={() => setChecked(ELIGIBILITY_ITEMS.map(() => !all))}
        >
          <Check size={15} />
          {all ? '取消全部' : '一鍵全部確認'}
        </button>
      </div>
      {ELIGIBILITY_ITEMS.map((item, i) => (
        <div
          key={i}
          className="checkitem"
          onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
        >
          <Checkbox on={checked[i]} />
          <span>{item}</span>
        </div>
      ))}
    </FlowShell>
  );
}

// ── 知情同意 ──────────────────────────────────────────────────────────────
export type ConsentData = {
  agreed: boolean;
};

export function ConsentStep({
  onAgree,
  onDecline,
  onBack,
}: {
  onAgree: (data: ConsentData) => void;
  onDecline: () => void;
  onBack?: () => void;
}) {
  return (
    <FlowShell
      title="人機互動實驗"
      onBack={onBack ?? onDecline}
      footer={
        <>
          <button className="btn-block" onClick={() => onAgree({ agreed: true })}>
            我已閱讀並理解，同意參與
          </button>
          <button className="btn-text" onClick={onDecline}>
            暫不參與
          </button>
        </>
      }
    >
      <StepHeading icon={FileText} title="電子知情同意" />
      <div className="flow-body">{CONSENT_TEXT}</div>
    </FlowShell>
  );
}

// ── 資料填寫（基本資料）──────────────────────────────────────────────────
export type DemographicsData = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DemographicsStep({ onNext }: { onNext: (data: DemographicsData) => void }) {
  const [values, setValues] = useState<DemographicsData>({});
  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const toggleIntent = (k: string) => set(k, values[k] === '1' ? '0' : '1');

  const anyIntent = CONTACT_INTENTS.some((it) => values[it.key] === '1');
  const emailVal = (values.email ?? '').trim();
  const emailValid = EMAIL_RE.test(emailVal);
  const emailInvalid = anyIntent && emailVal !== '' && !emailValid;

  const fieldsOk = DEMOGRAPHIC_FIELDS.every(
    (f) => !f.required || (values[f.key] ?? '').trim() !== '',
  );
  const complete = fieldsOk && (!anyIntent || emailValid);

  const submit = () => {
    const data: DemographicsData = { ...values };
    // 意願欄位固定輸出 1/0，方便統計。
    CONTACT_INTENTS.forEach((it) => {
      data[it.key] = values[it.key] === '1' ? '1' : '0';
    });
    // 未勾選任何意願則不保留 Email。
    if (!anyIntent) data.email = '';
    onNext(data);
  };

  return (
    <FlowShell
      title="人機互動實驗"
      footer={
        <button className="btn-block" disabled={!complete} onClick={submit}>
          下一步
        </button>
      }
    >
      <StepHeading
        icon={UserRound}
        title="基本資料"
        subtitle="這些資料僅供研究分析與後續聯繫之用，會以匿名方式處理。"
      />
      {DEMOGRAPHIC_FIELDS.map((f) => (
        <div className="field" key={f.key}>
          <label className="field__label">
            {f.label}
            {f.required ? ' *' : ''}
          </label>
          {f.type === 'single' ? (
            <div>
              {f.options!.map((opt) => (
                <div
                  key={opt}
                  className={`radio ${values[f.key] === opt ? 'on' : ''}`}
                  onClick={() => set(f.key, opt)}
                >
                  <span className="radio__dot" />
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          ) : (
            <input
              className="input"
              type={f.type === 'number' ? 'number' : 'text'}
              inputMode={f.type === 'number' ? 'numeric' : undefined}
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
            />
          )}
        </div>
      ))}

      {/* 後續聯繫意願（可複選、可不選）。任一勾選才需填 Email。 */}
      <div className="field">
        <label className="field__label">後續聯繫意願（可複選，可不選）</label>
        {CONTACT_INTENTS.map((it) => (
          <div key={it.key} className="checkitem" onClick={() => toggleIntent(it.key)}>
            <Checkbox on={values[it.key] === '1'} />
            <span>{it.label}</span>
          </div>
        ))}
      </div>

      {anyIntent ? (
        <div className="field">
          <label className="field__label">聯絡 Email *</label>
          <input
            className="input"
            type="email"
            inputMode="email"
            placeholder="name@example.com"
            value={values.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
          />
          {emailInvalid ? <div className="hint-error">請輸入有效的 Email</div> : null}
        </div>
      ) : null}
    </FlowShell>
  );
}

// ── 問卷（前測信任量表／後測體驗量表，題目由外部傳入）──────────────────────
export function QuestionnaireStep({
  title,
  items,
  onSubmit,
}: {
  title: string;
  items: string[];
  onSubmit: (scores: number[]) => void;
}) {
  const [scores, setScores] = useState<(number | null)[]>(items.map(() => null));
  const all = scores.every((s) => s !== null);
  return (
    <FlowShell
      title="人機互動實驗"
      footer={
        <button
          className="btn-block"
          disabled={!all}
          onClick={() => onSubmit(scores.map((s) => s as number))}
        >
          送出
        </button>
      }
    >
      <StepHeading icon={Gauge} title={title} subtitle="請依你的真實想法作答，沒有標準答案。" />
      {items.map((item, i) => (
        <div className="qitem" key={i}>
          <div className="qitem__text">
            {i + 1}. {item}
          </div>
          <div className="likert">
            {LIKERT_LABELS.map((lbl, j) => (
              <div
                key={j}
                className={`likert__opt ${scores[i] === j + 1 ? 'on' : ''}`}
                onClick={() => setScores((s) => s.map((v, k) => (k === i ? j + 1 : v)))}
              >
                <div className="likert__num">{j + 1}</div>
                <div className="likert__lbl">{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </FlowShell>
  );
}

// ── 操弄檢核（計畫書 §6.4）：確認兩項操弄是否被感知 ──────────────────────────
export type ManipulationData = {
  single: Record<string, string>; // 檢核題 key → 選項
  multi: string[]; // 「最容易讓我重新檢查的開頭」複選
};

export function ManipulationCheckStep({
  onSubmit,
}: {
  onSubmit: (data: ManipulationData) => void;
}) {
  const [single, setSingle] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState<Set<string>>(new Set());
  const canSubmit = MANIPULATION_SINGLE.every((q) => single[q.key]);

  const toggleMulti = (opt: string) =>
    setMulti((s) => {
      const next = new Set(s);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      return next;
    });

  return (
    <FlowShell
      title="人機互動實驗"
      footer={
        <button
          className="btn-block"
          disabled={!canSubmit}
          onClick={() => onSubmit({ single, multi: [...multi] })}
        >
          送出
        </button>
      }
    >
      <StepHeading
        icon={Search}
        title="回顧剛才的 AI 開頭"
        subtitle="以下幾個問題只想了解你的印象，沒有標準答案。"
      />

      {MANIPULATION_SINGLE.map((q, qi) => (
        <div key={q.key}>
          <div className="flow-block">
            {qi + 1}. {q.question}
          </div>
          {q.options.map((opt) => (
            <div
              key={opt}
              className={`radio ${single[q.key] === opt ? 'on' : ''}`}
              onClick={() => setSingle((s) => ({ ...s, [q.key]: opt }))}
            >
              <span className="radio__dot" />
              <span>{opt}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="flow-block">
        {MANIPULATION_SINGLE.length + 1}. {MANIPULATION_MULTI.question}
      </div>
      {MANIPULATION_MULTI.options.map((opt) => (
        <div key={opt} className="checkitem" onClick={() => toggleMulti(opt)}>
          <Checkbox on={multi.has(opt)} />
          <span>{opt}</span>
        </div>
      ))}
    </FlowShell>
  );
}

// ── 事後揭露 ────────────────────────────────────────────────────────────────
export function DebriefStep({
  inconsistentItems,
  onFinish,
}: {
  inconsistentItems: { questionText: string; correctOption: string }[];
  onFinish: () => void;
}) {
  return (
    <FlowShell
      title="人機互動實驗"
      footer={
        <button className="btn-block" onClick={onFinish}>
          我了解了，完成
        </button>
      }
    >
      <StepHeading icon={Info} title="研究揭露與更正" />
      <div className="flow-body">{DEBRIEF_INTRO}</div>
      <div style={{ height: 16 }} />
      {inconsistentItems.length === 0 ? (
        <div className="flow-sub">（本次作答的開頭都沒有出現「短暫錯誤再更正」的版本。）</div>
      ) : (
        inconsistentItems.map((q, i) => (
          <div className="disclose-card" key={i}>
            <div className="disclose-card__q">
              {i + 1}. {q.questionText}
            </div>
            <div className="disclose-card__a">
              <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              正確答案：{q.correctOption}
            </div>
          </div>
        ))
      )}
    </FlowShell>
  );
}

// ── 過場與完成 ──────────────────────────────────────────────────────────────
export function IntermissionStep({
  title,
  desc,
  onStart,
}: {
  title: string;
  desc: string;
  onStart: () => void;
}) {
  return (
    <div className="phone">
      <div className="appbar">
        <span className="appbar__title" style={{ paddingLeft: 12 }}>
          人機互動實驗
        </span>
      </div>
      <div className="center-pad">
        <div className="hero-badge" style={{ margin: '0 auto 16px' }}>
          <Play size={32} />
        </div>
        <div className="flow-h">{title}</div>
        <div className="flow-body">{desc}</div>
        <button className="btn-block" onClick={onStart}>
          開始
        </button>
      </div>
    </div>
  );
}

export function DoneStep({
  submitState,
  onRetry,
}: {
  submitState: 'sending' | 'sent' | 'failed';
  onRetry: () => void;
}) {
  const text = {
    sending: '結果上傳中…',
    sent: '你的作答已送出，研究人員將另行與你聯繫後續（如簡短訪談）。',
    failed: '結果上傳失敗，請點下方重試。',
  }[submitState];
  return (
    <div className="phone">
      <div className="appbar">
        <span className="appbar__title" style={{ paddingLeft: 12 }}>
          人機互動實驗
        </span>
      </div>
      <div className="center-pad">
        <div className="hero-badge" style={{ margin: '0 auto 16px' }}>
          <PartyPopper size={34} />
        </div>
        <div className="flow-h">全部完成，謝謝你！</div>
        <div className="flow-body">{text}</div>
        {submitState === 'failed' ? (
          <button className="btn-block" onClick={onRetry}>
            重試上傳
          </button>
        ) : null}
      </div>
    </div>
  );
}
