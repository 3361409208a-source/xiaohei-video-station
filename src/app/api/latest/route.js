import { NextResponse } from 'next/server';
import { getLatest } from '@/utils/backupService';

export async function GET() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  try {
    const response = await fetch(`${API_URL}/api/latest`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data && (data.status === 'error' || data.error)) {
      throw new Error(`API error: ${data.message || data.error}`);
    }
    return NextResponse.json(data);
  } catch (error) {
    console.warn('Fetch latest from backend failed, falling back to backup latest:', error.message);
    try {
      const data = await getLatest();
      return NextResponse.json(data);
    } catch (backupError) {
      return NextResponse.json({ error: 'Fallback latest failed' }, { status: 500 });
    }
  }
}
