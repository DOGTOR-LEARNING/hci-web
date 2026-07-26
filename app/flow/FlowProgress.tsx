'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

// 網頁最上方的完整流程進度列（跨瀏覽器全寬）。
// 寬螢幕：整排顯示所有步驟，並標示已完成／目前／未進行。
// 螢幕過窄放不下：只顯示目前步驟，左右各一個數字小 tab 表示「前／後」步驟數。

export type FlowStage = { key: string; label: string };

export default function FlowProgress({
  stages,
  current,
}: {
  stages: FlowStage[];
  current: number;
}) {
  const fullRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const check = () => {
      const full = fullRef.current;
      if (!full) return;
      // 整排（不換行、不縮小）是否超出可用寬度 → 過窄則切換精簡模式。
      setCompact(full.scrollWidth > full.clientWidth + 4);
    };
    check();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && fullRef.current) {
      ro = new ResizeObserver(check);
      ro.observe(fullRef.current);
    }
    window.addEventListener('resize', check);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [current, stages.length]);

  const total = stages.length;
  const before = current; // 已完成步數
  const after = total - 1 - current; // 尚未進行步數
  const cur = stages[current];

  return (
    <div className="flowbar">
      {/* 整排步驟：即使切到精簡模式仍保留於 DOM（隱藏）以便持續量測寬度 */}
      <div className={`flowbar__full ${compact ? 'is-measure' : ''}`} ref={fullRef} aria-hidden={compact}>
        {stages.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          return (
            <div key={s.key} className={`flowstep ${state}`}>
              <span className="flowstep__idx">
                {state === 'done' ? <Check size={13} /> : i + 1}
              </span>
              <span className="flowstep__label">{s.label}</span>
            </div>
          );
        })}
      </div>

      {compact ? (
        <div className="flowbar__compact">
          <span className="flowbar__side" title={`已完成 ${before} 步`}>
            ‹ {before}
          </span>
          <span className="flowbar__cur">
            <span className="flowstep__idx">{current + 1}</span>
            <span className="flowbar__curlabel">{cur?.label}</span>
            <span className="flowbar__total">
              {current + 1}/{total}
            </span>
          </span>
          <span className="flowbar__side" title={`還有 ${after} 步`}>
            {after} ›
          </span>
        </div>
      ) : null}
    </div>
  );
}
