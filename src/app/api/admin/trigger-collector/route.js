import { NextResponse } from 'next/server';

export async function POST() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${API_URL}/api/admin/trigger-collector`, {
      method: 'POST',
      cache: 'no-store'
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to trigger collector' }, { status: 500 });
  }
}
