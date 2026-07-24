import { NextResponse } from 'next/server';
import { getReels } from '@/utils/backupService';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pg = searchParams.get('pg') || '1';

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  const backendUrl = new URL(`${API_URL}/api/reels`);
  backendUrl.searchParams.append('pg', pg);

  try {
    const response = await fetch(backendUrl.toString(), { 
      cache: 'no-store',
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data && (data.status === 'error' || data.error)) {
      throw new Error(`API error: ${data.message || data.error}`);
    }
    const resp = NextResponse.json(data);
    resp.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return resp;
  } catch (error) {
    console.warn('Fetch reels from backend failed, falling back to backup reels:', error.message);
    try {
      const data = await getReels(pg);
      const resp = NextResponse.json(data);
      resp.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
      return resp;
    } catch (backupError) {
      return NextResponse.json({ error: 'Fallback reels failed' }, { status: 500 });
    }
  }
}
