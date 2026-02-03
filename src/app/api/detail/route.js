import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const src = searchParams.get('src');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const backendUrl = new URL(`${API_URL}/api/detail?id=${id}&src=${encodeURIComponent(src)}`);

  try {
    const response = await fetch(backendUrl.toString());
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Fetch detail failed' }, { status: 500 });
  }
}
