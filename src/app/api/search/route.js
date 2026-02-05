import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const t = searchParams.get('t');
  const pg = searchParams.get('pg') || '1'; // 提取 pg 参数

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  // 构造转发给后端的完整 URL
  const backendUrl = new URL(`${API_URL}/api/search`);
  if (q) backendUrl.searchParams.append('q', q);
  if (t) backendUrl.searchParams.append('t', t);
  backendUrl.searchParams.append('pg', pg); // 强制转发 pg 参数

  try {
    const response = await fetch(backendUrl.toString(), { cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Proxy search failed' }, { status: 500 });
  }
}
