'use client';

import React, { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

// 裝置守門：本研究需記錄滑鼠游標在各內容區域的移動與停留（計畫書 §6.2），
// 手機／觸控裝置無游標 hover，無法蒐集主要互動資料，故一律擋下並請改用電腦瀏覽器。
//
// 判斷：需同時具備「可懸停」與「精細指標」能力。
//   (any-hover: hover) → 裝置有可 hover 的指標（滑鼠／觸控板）
//   (any-pointer: fine) → 裝置有精細指標（滑鼠／觸控板／觸控筆）
// 兩者皆滿足才放行；只有觸控（coarse、無 hover）的手機／平板會被擋下。
// 允許附滑鼠或觸控板的觸控筆電，因其仍能提供 hover 互動資料。

function detectOk(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const hover = window.matchMedia('(any-hover: hover)').matches;
  const fine = window.matchMedia('(any-pointer: fine)').matches;
  return hover && fine;
}

export default function DeviceGate({ children }: { children: React.ReactNode }) {
  // 'checking' 讓伺服器與首次客端渲染一致（避免 hydration 不匹配），掛載後再判定。
  const [status, setStatus] = useState<'checking' | 'ok' | 'blocked'>('checking');

  useEffect(() => {
    const check = () => setStatus(detectOk() ? 'ok' : 'blocked');
    check();
    const mqs = [
      window.matchMedia('(any-hover: hover)'),
      window.matchMedia('(any-pointer: fine)'),
    ];
    mqs.forEach((mq) => mq.addEventListener?.('change', check));
    return () => mqs.forEach((mq) => mq.removeEventListener?.('change', check));
  }, []);

  if (status === 'checking') return null;
  if (status === 'ok') return <>{children}</>;

  return (
    <div className="device-block">
      <div className="device-block__card">
        <div className="device-block__icon">
          <Monitor size={36} />
        </div>
        <div className="device-block__title">請用電腦瀏覽器進行</div>
        <div className="device-block__body">
          本研究需要記錄滑鼠游標在畫面各區域的移動與停留，因此無法在手機或純觸控裝置上進行。
          <br />
          請改用<strong>桌上型或筆記型電腦</strong>的瀏覽器開啟本頁面，並確認已連接滑鼠或觸控板。
        </div>
        <div className="device-block__note">
          若你正在使用電腦仍看到此畫面，請確認滑鼠／觸控板可正常使用後重新整理。
        </div>
      </div>
    </div>
  );
}
