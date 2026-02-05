import { NextResponse } from 'next/server';

export async function POST(request) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const token = request.headers.get('x-admin-token');

  try {
    const response = await fetch(`${API_URL}/api/admin/trigger-collector`, {
      method: 'POST',
      headers: { 'x-admin-token': token },
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: 'Auth failed' }, { status: response.status });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to trigger collector' }, { status: 500 });
  }
}
