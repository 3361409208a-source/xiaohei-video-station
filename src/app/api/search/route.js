import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const t = searchParams.get('t');

  // 强制使用环境变量，不提供本地后备
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  if (!API_URL) {
    return NextResponse.json({
      error: 'NEXT_PUBLIC_API_URL environment variable is not set. Please configure it in Vercel settings.'
    }, { status: 500 });
  }

  const backendUrl = new URL(`${API_URL}/api/search`);
  if (q) backendUrl.searchParams.append('q', q);
  if (t) backendUrl.searchParams.append('t', t);

  try {
    const response = await fetch(backendUrl.toString());
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
