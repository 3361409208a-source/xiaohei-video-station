import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const t = searchParams.get('t');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
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
