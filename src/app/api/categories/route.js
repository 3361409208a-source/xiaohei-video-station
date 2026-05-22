import { NextResponse } from 'next/server';
import { getCategories } from '@/utils/backupService';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const t = searchParams.get('t');

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    if (!t) {
        return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
    }

    const backendUrl = new URL(`${API_URL}/api/categories`);
    backendUrl.searchParams.append('t', t);

    try {
        const response = await fetch(backendUrl.toString(), { 
            cache: 'no-store',
            signal: AbortSignal.timeout(1500)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data && (data.status === 'error' || data.error)) {
            throw new Error(`API error: ${data.message || data.error}`);
        }
        return NextResponse.json(data);
    } catch (error) {
        console.warn('Proxy categories failed, falling back to backup categories:', error.message);
        try {
            const data = getCategories(t);
            return NextResponse.json(data);
        } catch (backupError) {
            return NextResponse.json({ error: 'Fallback categories failed' }, { status: 500 });
        }
    }
}
