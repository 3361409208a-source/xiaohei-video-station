import { NextResponse } from 'next/server';

export async function GET(request) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'NOT_SET';

  return NextResponse.json({
    message: 'Test API working',
    apiUrl: API_URL,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
}
