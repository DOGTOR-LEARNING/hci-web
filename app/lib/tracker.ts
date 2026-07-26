// 每題（正式學習試次）互動追蹤器（計畫書 §6.4「每題 CSV 互動欄位」）。
//
// 設計原則：只輸出「每題一列」的彙整摘要，不保存逐點座標或高頻事件；不錄螢幕、
// 不記鍵盤。所有 active（可視 × 有焦點）時間以時間戳差分累計；hover 以
// pointerenter／pointerleave 累計；捲動連續動作以 500 ms 間隔分組。
//
// 由 QuizPierreHci 於「條件化開頭＋共同正確詳解」面板出現時 begin()，按下一題時
// finish() 取得結果。區域元素（opening／explanation 外層／explanation 主文／option
// analysis／容器／捲動根）由元件以 ref 註冊。

export type TrialInteraction = {
  openingVisibleMs: number;
  correctExplanationVisibleMs: number;
  openingHoverMs: number;
  openingEnterCount: number;
  explanationHoverMs: number;
  explanationEnterCount: number;
  optionAnalysisHoverMs: number;
  optionAnalysisEnterCount: number;
  scrollDownCount: number;
  scrollUpCount: number;
  scrollActiveMs: number;
  maxScrollPercent: number;
  revisitCount: number;
  containerLeaveCount: number;
  containerOutsideMs: number;
  focusLostCount: number;
  focusLostMs: number;
  continueClickMs: number | null;
};

export function emptyInteraction(): TrialInteraction {
  return {
    openingVisibleMs: 0,
    correctExplanationVisibleMs: 0,
    openingHoverMs: 0,
    openingEnterCount: 0,
    explanationHoverMs: 0,
    explanationEnterCount: 0,
    optionAnalysisHoverMs: 0,
    optionAnalysisEnterCount: 0,
    scrollDownCount: 0,
    scrollUpCount: 0,
    scrollActiveMs: 0,
    maxScrollPercent: 0,
    revisitCount: 0,
    containerLeaveCount: 0,
    containerOutsideMs: 0,
    focusLostCount: 0,
    focusLostMs: 0,
    continueClickMs: null,
  };
}

const SCROLL_ACTION_GAP_MS = 500;

type RegionName = 'opening' | 'explanation' | 'explanationMain' | 'optionAnalysis';

export class InteractionTracker {
  private data = emptyInteraction();
  private running = false;

  private scrollRoot: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private regions: Partial<Record<RegionName, HTMLElement>> = {};

  private io: IntersectionObserver | null = null;
  private cleanups: Array<() => void> = [];

  // active（可視 × 有焦點）時間差分。
  private lastSampleTs = 0;
  private openingVisible = false;
  private explanationVisible = false;
  private explanationFirstVisibleTs: number | null = null;

  // 頁面前景狀態。
  private pageActive = true;
  private focusLostAt: number | null = null;

  // hover 狀態。
  private hoverStart: Partial<Record<RegionName, number>> = {};

  // 容器離開狀態。
  private outsideAt: number | null = null;

  // 捲動狀態。
  private lastScrollTop = 0;
  private scrollActionStart: number | null = null;
  private lastScrollEventTs = 0;
  private explanationPassedAbove = false;

  setScrollRoot(el: HTMLElement | null) {
    this.scrollRoot = el;
  }
  setContainer(el: HTMLElement | null) {
    this.container = el;
  }
  registerRegion(name: RegionName, el: HTMLElement | null) {
    if (el) this.regions[name] = el;
  }

  begin() {
    if (this.running) return;
    if (typeof window === 'undefined') return;
    this.running = true;
    const now = Date.now();
    this.lastSampleTs = now;
    this.pageActive = document.visibilityState === 'visible' && document.hasFocus();

    // 可視性：以捲動根為 IntersectionObserver root，觀察 opening 與 explanation 外層。
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver(
        (entries) => this.onIntersect(entries),
        { root: this.scrollRoot ?? null, threshold: 0.01 },
      );
      if (this.regions.opening) this.io.observe(this.regions.opening);
      if (this.regions.explanation) this.io.observe(this.regions.explanation);
    }

    this.addDoc('visibilitychange', () => this.onPageActiveChange());
    this.addWin('focus', () => this.onPageActiveChange());
    this.addWin('blur', () => this.onPageActiveChange());

    this.bindHover('opening');
    this.bindHover('explanationMain');
    this.bindHover('optionAnalysis');
    this.bindContainer();
    this.bindScroll();
  }

  /** 按「下一題／完成」時呼叫：結算所有累計並回傳結果。 */
  finish(): TrialInteraction {
    if (!this.running) return { ...this.data };
    const now = Date.now();
    this.sample(now);
    // 結算未關閉的 hover。
    (['opening', 'explanationMain', 'optionAnalysis'] as RegionName[]).forEach((r) =>
      this.closeHover(r, now),
    );
    // 結算未關閉的捲動動作與容器外／失焦時間。
    if (this.scrollActionStart !== null) {
      this.data.scrollActiveMs += Math.max(0, this.lastScrollEventTs - this.scrollActionStart);
      this.scrollActionStart = null;
    }
    if (this.outsideAt !== null) {
      this.data.containerOutsideMs += now - this.outsideAt;
      this.outsideAt = null;
    }
    if (this.focusLostAt !== null) {
      this.data.focusLostMs += now - this.focusLostAt;
      this.focusLostAt = null;
    }
    if (this.data.continueClickMs === null && this.explanationFirstVisibleTs !== null) {
      this.data.continueClickMs = now - this.explanationFirstVisibleTs;
    }
    this.dispose();
    return { ...this.data };
  }

  dispose() {
    this.running = false;
    if (this.io) {
      this.io.disconnect();
      this.io = null;
    }
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  // ── active 時間差分：把 lastSample→now 的時間，記給當時仍 active 的區域 ──
  private sample(now: number) {
    const elapsed = now - this.lastSampleTs;
    if (elapsed > 0) {
      if (this.openingVisible && this.pageActive) this.data.openingVisibleMs += elapsed;
      if (this.explanationVisible && this.pageActive) {
        this.data.correctExplanationVisibleMs += elapsed;
      }
    }
    this.lastSampleTs = now;
  }

  private onIntersect(entries: IntersectionObserverEntry[]) {
    const now = Date.now();
    this.sample(now);
    for (const e of entries) {
      const visible = e.isIntersecting && e.intersectionRatio > 0;
      if (e.target === this.regions.opening) this.openingVisible = visible;
      if (e.target === this.regions.explanation) {
        this.explanationVisible = visible;
        if (visible && this.explanationFirstVisibleTs === null) {
          this.explanationFirstVisibleTs = now;
        }
      }
    }
  }

  private onPageActiveChange() {
    const now = Date.now();
    this.sample(now);
    const active = document.visibilityState === 'visible' && document.hasFocus();
    if (active === this.pageActive) return;
    this.pageActive = active;
    if (!active) {
      this.data.focusLostCount += 1;
      this.focusLostAt = now;
    } else if (this.focusLostAt !== null) {
      this.data.focusLostMs += now - this.focusLostAt;
      this.focusLostAt = null;
    }
  }

  private bindHover(name: RegionName) {
    const el = this.regions[name];
    if (!el) return;
    const enter = () => {
      if (this.hoverStart[name] != null) return;
      this.hoverStart[name] = Date.now();
      if (name === 'opening') this.data.openingEnterCount += 1;
      else if (name === 'explanationMain') this.data.explanationEnterCount += 1;
      else if (name === 'optionAnalysis') this.data.optionAnalysisEnterCount += 1;
    };
    const leave = () => this.closeHover(name, Date.now());
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    this.cleanups.push(() => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    });
  }

  private closeHover(name: RegionName, now: number) {
    const start = this.hoverStart[name];
    if (start == null) return;
    const dur = now - start;
    if (name === 'opening') this.data.openingHoverMs += dur;
    else if (name === 'explanationMain') this.data.explanationHoverMs += dur;
    else if (name === 'optionAnalysis') this.data.optionAnalysisHoverMs += dur;
    this.hoverStart[name] = undefined;
  }

  private bindContainer() {
    const el = this.container;
    if (!el) return;
    const enter = () => {
      if (this.outsideAt !== null) {
        this.data.containerOutsideMs += Date.now() - this.outsideAt;
        this.outsideAt = null;
      }
    };
    const leave = () => {
      if (this.outsideAt === null) {
        this.data.containerLeaveCount += 1;
        this.outsideAt = Date.now();
      }
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    this.cleanups.push(() => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    });
  }

  private bindScroll() {
    const el = this.scrollRoot;
    if (!el) return;
    this.lastScrollTop = el.scrollTop;
    const onScroll = () => {
      const now = Date.now();
      const top = el.scrollTop;
      const max = Math.max(1, el.scrollHeight - el.clientHeight);
      const percent = Math.min(100, Math.max(0, Math.round((top / max) * 100)));
      if (percent > this.data.maxScrollPercent) this.data.maxScrollPercent = percent;

      const goingUp = top < this.lastScrollTop;
      const goingDown = top > this.lastScrollTop;

      // 連續捲動動作以 500 ms 分組；每個新動作記一次方向。
      const newAction = this.scrollActionStart === null || now - this.lastScrollEventTs > SCROLL_ACTION_GAP_MS;
      if (newAction) {
        if (this.scrollActionStart !== null) {
          this.data.scrollActiveMs += Math.max(0, this.lastScrollEventTs - this.scrollActionStart);
        }
        this.scrollActionStart = now;
        if (goingDown) this.data.scrollDownCount += 1;
        else if (goingUp) this.data.scrollUpCount += 1;
      }
      this.lastScrollEventTs = now;

      // revisit：共同正確詳解已捲離頂端後，又向上使其重新進入視窗，記一次回訪。
      const expl = this.regions.explanation;
      if (expl) {
        const relTop = expl.offsetTop - top;
        const above = relTop + expl.clientHeight < 0; // 整塊已捲過頂端
        if (above) this.explanationPassedAbove = true;
        else if (this.explanationPassedAbove && goingUp && relTop < el.clientHeight) {
          this.data.revisitCount += 1;
          this.explanationPassedAbove = false;
        }
      }
      this.lastScrollTop = top;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    this.cleanups.push(() => el.removeEventListener('scroll', onScroll));
  }

  private addDoc(type: string, fn: () => void) {
    document.addEventListener(type, fn);
    this.cleanups.push(() => document.removeEventListener(type, fn));
  }
  private addWin(type: string, fn: () => void) {
    window.addEventListener(type, fn);
    this.cleanups.push(() => window.removeEventListener(type, fn));
  }
}
