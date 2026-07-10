import { NextResponse } from 'next/server';

export async function POST(request) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const token = request.headers.get('x-admin-token');

  try {
    const response = await fetch(`${API_URL}/api/admin/cleanup`, {
      method: 'POST',
      headers: { 'x-admin-token': token },
      cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Cleanup failed' }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
