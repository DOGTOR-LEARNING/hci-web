import { NextRequest, NextResponse } from 'next/server';

// 伺服器端代理：完成整條流水線後，瀏覽器只打「同一支」自己的
// /api/submit-session，由這裡在 server 端補上 X-API-Key 轉發到後端
// /pierre_hci/submit_web_session（後端把整場資料整理成 CSV 附件寄到實驗信箱）。
// DOGTOR_API_KEY 不會出現在前端 JS。

export const runtime = 'nodejs';

const API_BASE =
  process.env.DOGTOR_API_BASE_URL ||
  'https://superb-backend-staging-1041765261654.asia-east1.run.app';
const API_KEY = process.env.DOGTOR_API_KEY || '';

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'invalid json' }, { status: 400 });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  try {
    const res = await fetch(`${API_BASE}/pierre_hci/submit_web_session`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: `upstream error: ${String(e)}` },
      { status: 502 },
    );
  }
}
