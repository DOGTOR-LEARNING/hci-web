// 抗資料遺失緩衝：整場實驗只在最後彙整送出一次，中途關分頁／當機／斷網即全丟。
// 本模組提供 (1) localStorage 逐題／逐階段快照，(2) 離開頁面時以 sendBeacon 送「未完成」
// 資料到後端，讓中途跳出的受試者資料仍能被伺服器端收到。

const KEY = 'pierre_hci_session_buffer_v1';

export function saveBuffer(snapshot: unknown): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), snapshot }));
  } catch {
    /* 隱私模式或配額滿：忽略，不影響流程 */
  }
}

export function loadBuffer<T = unknown>(): { ts: number; snapshot: T } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { ts: number; snapshot: T }) : null;
  } catch {
    return null;
  }
}

export function clearBuffer(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 忽略 */
  }
}

// 離開頁面時送出未完成資料。sendBeacon 在 unload 期間仍能可靠送出。
export function flushPartialBeacon(payload: unknown): void {
  try {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
    const blob = new Blob([JSON.stringify(payload)], {
      type: 'application/json',
    });
    navigator.sendBeacon('/api/submit-partial', blob);
  } catch {
    /* 忽略 */
  }
}
