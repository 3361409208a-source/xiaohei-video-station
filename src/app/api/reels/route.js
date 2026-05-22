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
      signal: AbortSignal.timeout(2500)
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn('Fetch reels from backend failed, falling back to backup reels:', error.message);
    try {
      const data = await getReels(pg);
      return NextResponse.json(data);
    } catch (backupError) {
      return NextResponse.json({ error: 'Fallback reels failed' }, { status: 500 });
    }
  }
}
