import { NextResponse } from 'next/server';

export async function GET(request) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const token = request.headers.get('x-admin-token');
  const res = await fetch(`${API_URL}/api/admin/sources`, { headers: { 'x-admin-token': token }, cache: 'no-store' });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(request) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const token = request.headers.get('x-admin-token');
  const body = await request.json();
  const res = await fetch(`${API_URL}/api/admin/sources`, {
    method: 'POST',
    headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
