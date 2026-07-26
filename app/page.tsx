import PierreHciFlow from './flow/PierreHciFlow';
import DeviceGate from './flow/DeviceGate';

// 人機互動實驗（更新版 2 × 2 組內設計）：完整引導式流水線
// 資格確認 → 知情同意 → 資料填寫 → 前問卷（信任量表）→ 前測(6) → 學習任務(12)
// → 操弄檢核 → 後測(12) → 後問卷（體驗量表）→ 事後揭露 → 完成
// （最後一次送出，寄一封含 profile / answers / trials 三份 CSV 的信）。
// DeviceGate：手機／純觸控裝置無滑鼠 hover，擋下並請改用電腦瀏覽器。
export default function Page() {
  return (
    <DeviceGate>
      <PierreHciFlow />
    </DeviceGate>
  );
}
