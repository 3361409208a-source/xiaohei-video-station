'use client';

import { useEffect, useMemo, useState } from 'react';
import { pickNextNetworkIndex } from '@/utils/adFallback';

export { pickNextNetworkIndex };

/**
 * 多联盟回退广告位：按 networks 顺序尝试，失败则下一网络；最终落到 image。
 * 不做「请关闭广告拦截」弹窗。
 */
export default function AdSlot({ slotId, adsConfig }) {
  const enabled = Boolean(adsConfig?.enabled);
  const networks = useMemo(
    () => adsConfig?.slots?.[slotId]?.networks || [],
    [adsConfig, slotId]
  );

  const [index, setIndex] = useState(() => pickNextNetworkIndex(networks, 0, false));
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setIndex(pickNextNetworkIndex(networks, 0, false));
    setBlocked(false);
  }, [networks]);

  // bait 检测：被拦截时切到下一网络
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const bait = document.createElement('div');
    bait.className = 'ad-banner adsbox ad-unit';
    bait.style.cssText = 'position:absolute;top:-999px;left:-999px;width:1px;height:1px;';
    document.body.appendChild(bait);

    const timer = setTimeout(() => {
      const style = window.getComputedStyle(bait);
      const isBlocked =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        bait.offsetHeight === 0;
      document.body.removeChild(bait);
      if (isBlocked) {
        setBlocked(true);
        setIndex((prev) => {
          const next = pickNextNetworkIndex(networks, (prev < 0 ? 0 : prev) + 1, true);
          return next;
        });
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      if (bait.parentNode) bait.parentNode.removeChild(bait);
    };
  }, [enabled, networks]);

  if (!enabled || index < 0) return null;

  const network = networks[index];
  if (!network) return null;

  if (network.type === 'image') {
    const inner = (
      <div
        style={{
          width: '100%',
          minHeight: 60,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
          border: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: '0.85rem',
          overflow: 'hidden',
        }}
      >
        {network.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={network.src}
            alt={network.alt || '推广'}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onError={() =>
              setIndex((prev) => pickNextNetworkIndex(networks, prev + 1, blocked))
            }
          />
        ) : (
          <span>{network.label || '推广位'}</span>
        )}
      </div>
    );
    return network.href ? (
      <a href={network.href} target="_blank" rel="noopener noreferrer sponsored" style={{ display: 'block', margin: '12px 0' }}>
        {inner}
      </a>
    ) : (
      <div style={{ margin: '12px 0' }}>{inner}</div>
    );
  }

  if (network.type === 'html') {
    return (
      <div
        style={{ margin: '12px 0' }}
        dangerouslySetInnerHTML={{ __html: network.html }}
      />
    );
  }

  if (network.type === 'script') {
    return (
      <ScriptAd
        key={`${slotId}-${index}-${network.src}`}
        src={network.src}
        onFail={() => setIndex((prev) => pickNextNetworkIndex(networks, prev + 1, blocked))}
      />
    );
  }

  return null;
}

function ScriptAd({ src, onFail }) {
  useEffect(() => {
    if (!src) {
      onFail?.();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onerror = () => onFail?.();
    document.body.appendChild(script);
    const timer = setTimeout(() => {
      // 若脚本被拦，多数情况下 onerror 会触发；超时再兜底一次
    }, 3000);
    return () => {
      clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [src, onFail]);

  return <div style={{ margin: '12px 0', minHeight: 1 }} data-ad-script={src} />;
}
