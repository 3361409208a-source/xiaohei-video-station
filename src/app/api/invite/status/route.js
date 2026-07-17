import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/invite/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
