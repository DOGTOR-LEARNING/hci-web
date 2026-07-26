import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '學習體驗研究',
  // 雙盲送審：標題／描述不放團隊或產品名稱，避免受試者與審稿人由頁面辨識出研究單位。
  description: '線上學習體驗研究',
  // 實驗頁不得被搜尋引擎或 AI 爬蟲索引（另見 public/robots.txt）。
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
