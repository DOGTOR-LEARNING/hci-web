// 裝置偵測：本實驗需要滑鼠／觸控板等精細指標與桌機版面，故限定電腦。
// 判斷「觸控且沒有精細指標」為手機／平板，予以擋下；觸控筆電（同時有精細指標）放行，
// 因為它仍能提供本研究所需的游標互動訊號。

export function isTouchOnlyDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator;
  const hasTouch =
    (nav.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
  const mm = window.matchMedia?.bind(window);
  const coarse = mm ? mm('(pointer: coarse)').matches : false;
  const fine = mm ? mm('(pointer: fine)').matches : false;
  // 有觸控、主要指標為粗略（手指），且沒有精細指標（滑鼠／觸控板）→ 視為手機／平板。
  return hasTouch && coarse && !fine;
}
