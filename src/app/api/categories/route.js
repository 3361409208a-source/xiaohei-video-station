import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const t = searchParams.get('t');

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    if (!t) {
        return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
    }

    // 构造转发给后端的完整 URL
    const backendUrl = new URL(`${API_URL}/api/categories`);
    backendUrl.searchParams.append('t', t);

    try {
        const response = await fetch(backendUrl.toString(), { cache: 'no-store' });
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Proxy categories failed:', error);
        return NextResponse.json({ error: 'Proxy categories failed' }, { status: 500 });
    }
}
