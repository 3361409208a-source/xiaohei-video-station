import { NextResponse } from 'next/server';
import { searchMovies } from '@/utils/backupService';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const t = searchParams.get('t');
  const class_tag = searchParams.get('class_tag');
  const pg = searchParams.get('pg') || '1';

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  const backendUrl = new URL(`${API_URL}/api/search`);
  if (q) backendUrl.searchParams.append('q', q);
  if (t) backendUrl.searchParams.append('t', t);
  if (class_tag) backendUrl.searchParams.append('class_tag', class_tag);
  backendUrl.searchParams.append('pg', pg);

  try {
    const response = await fetch(backendUrl.toString(), { 
      cache: 'no-store',
      signal: AbortSignal.timeout(2500)
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn('Proxy search failed, falling back to backup search:', error.message);
    try {
      const data = await searchMovies(q, t, class_tag, pg);
      return NextResponse.json(data);
    } catch (backupError) {
      return NextResponse.json({ error: 'Fallback search failed' }, { status: 500 });
    }
  }
}
