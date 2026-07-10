import { NextResponse } from 'next/server';

export async function GET(request) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '10';

  try {
    const response = await fetch(`${API_URL}/api/trends?limit=${limit}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch trends' }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
  }
}
