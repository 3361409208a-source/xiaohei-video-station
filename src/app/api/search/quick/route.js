import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = searchParams.get('limit') || '4';
  if (!q) {
    return NextResponse.json({ error: 'q required' }, { status: 400 });
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const url = `${API_URL}/api/search/quick?q=${encodeURIComponent(q)}&limit=${limit}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.warn('Quick search failed:', error.message);
    return NextResponse.json([]);
  }
}
