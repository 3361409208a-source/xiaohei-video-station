'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { mapToMajorCategory } from '@/utils/categoryRules';

export default function Recommendations({ category, currentId, limit = 8 }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!category) return;
    const major = mapToMajorCategory(category);
    let cancelled = false;

    fetch(`/api/search?t=${encodeURIComponent(major)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const filtered = data
          .filter((m) => String(m.vod_id || m.id) !== String(currentId))
          .slice(0, limit);
        setItems(filtered);
      })
      .catch(() => setItems([]));

    return () => {
      cancelled = true;
    };
  }, [category, currentId, limit]);

  if (!items.length) return null;

  return (
    <div className="recommendations-box" style={{ marginTop: '20px' }}>
      <div className="sidebar-title">猜你喜欢</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
        }}
      >
        {items.map((item) => {
          const itemId = item.vod_id || item.id;
          const src = item.source_name || item.source || '默认';
          const href = `/movie/${encodeURIComponent(`${item.title}-${itemId}`)}?src=${encodeURIComponent(src)}`;
          return (
            <Link
              key={`${itemId}-${src}`}
              href={href}
              style={{
                textDecoration: 'none',
                color: '#ccc',
                background: '#1a1a1a',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #333',
              }}
            >
              <div
                style={{
                  aspectRatio: '2/3',
                  background: '#111',
                  backgroundImage: item.poster ? `url(${item.poster})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div
                style={{
                  padding: '6px 8px',
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.title}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
