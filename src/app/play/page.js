'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * 遗留 /play?id=&src=&url= 入口：跳转到统一的 /movie/{title}-{id} 播放页
 */
function PlayRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const src = searchParams.get('src');
  const url = searchParams.get('url');

  useEffect(() => {
    if (!id || !src) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    (async () => {
      let title = '影片';
      try {
        const res = await fetch(`/api/detail?id=${id}&src=${encodeURIComponent(src)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.title) title = data.title;
        }
      } catch {
        // ignore，用占位标题
      }
      if (cancelled) return;
      const qs = new URLSearchParams({ src });
      if (url) qs.set('url', url);
      router.replace(`/movie/${encodeURIComponent(`${title}-${id}`)}?${qs.toString()}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, src, url, router]);

  return (
    <div style={{ color: '#ccc', padding: 24, background: '#000', minHeight: '100vh' }}>
      正在跳转到播放页…
    </div>
  );
}

export default function Play() {
  return (
    <Suspense fallback={<div style={{ color: '#ccc', padding: 24 }}>加载中…</div>}>
      <PlayRedirect />
    </Suspense>
  );
}
