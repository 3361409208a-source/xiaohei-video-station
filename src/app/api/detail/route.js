import { NextResponse } from 'next/server';
import { getDetail } from '@/utils/backupService';
import { isValidDetailPayload } from '@/utils/searchHelpers';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const src = searchParams.get('src');

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  if (API_URL) {
    const backendUrl = src
      ? `${API_URL}/api/detail?id=${id}&src=${encodeURIComponent(src)}`
      : `${API_URL}/api/detail?id=${id}`;
    try {
      const response = await fetch(backendUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (!isValidDetailPayload(data)) {
        throw new Error(`API empty/error: ${data?.message || data?.error || 'null'}`);
      }
      return NextResponse.json(data);
    } catch (error) {
      console.warn('Fetch detail from backend failed, using backup service:', error.message);
    }
  }

  try {
    const data = await getDetail(id, src || undefined);
    if (!data) {
      return NextResponse.json({ error: 'Movie detail not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Fallback detail fetch failed:', error);
    return NextResponse.json({ error: 'Fetch detail failed' }, { status: 500 });
  }
}
