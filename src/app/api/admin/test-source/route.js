import { NextResponse } from 'next/server';

export async function POST(request) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const token = request.headers.get('x-admin-token');
  const body = await request.json();

  try {
    const response = await fetch(`${API_URL}/api/admin/test-source`, {
      method: 'POST',
      headers: { 
        'x-admin-token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ status: 'error', message: 'Proxy request failed' }, { status: 500 });
  }
}
