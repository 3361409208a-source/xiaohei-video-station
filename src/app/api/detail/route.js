import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const src = searchParams.get('src');

  // 强制使用环境变量，不提供本地后备
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  if (!API_URL) {
    return NextResponse.json({
      error: 'NEXT_PUBLIC_API_URL environment variable is not set. Please configure it in Vercel settings.'
    }, { status: 500 });
  }

  const backendUrl = new URL(`${API_URL}/api/detail?id=${id}&src=${encodeURIComponent(src)}`);

  try {
    const response = await fetch(backendUrl.toString());
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Fetch detail failed' }, { status: 500 });
  }
}
