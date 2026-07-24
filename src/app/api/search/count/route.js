import { NextResponse } from 'next/server';
import { readLocalSiteConfig } from '@/utils/localConfig';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const t = searchParams.get('t');
  const class_tag = searchParams.get('class_tag');

  const backendUrl = new URL(`${API_URL}/api/search/count`);
  if (q) backendUrl.searchParams.set('q', q);
  if (t) backendUrl.searchParams.set('t', t);
  if (class_tag) backendUrl.searchParams.set('class_tag', class_tag);

  try {
    const response = await fetch(backendUrl.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      return NextResponse.json(await response.json());
    }
  } catch {
    // fall through
  }

  // 后端不可用时给出保守估计，至少保证分页 UI 可用
  const local = readLocalSiteConfig();
  void local;
  const pageSize = 36;
  const estimatedTotal = t ? 360 : 0;
  return NextResponse.json({
    total: estimatedTotal,
    total_pages: t ? Math.max(1, Math.ceil(estimatedTotal / pageSize)) : 0,
  });
}
