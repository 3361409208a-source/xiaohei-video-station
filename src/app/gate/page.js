'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import './gate.css';

function GateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('本站已开启邀请访问，请输入邀请码后继续浏览');

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.invite?.message) setInviteMessage(data.invite.message);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/invite/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        router.replace(next);
        return;
      }
      setError(data.message || '邀请码无效，请检查后重试');
    } catch {
      setError('验证失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gate-page">
      <div className="gate-card">
        <Link href="/" className="gate-logo">
          <img src="/logo.png" alt="logo" width={48} height={48} />
          <span>小黑搜影</span>
        </Link>
        <h1>邀请码访问</h1>
        <p className="gate-desc">{inviteMessage}</p>
        <form onSubmit={handleSubmit} className="gate-form">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="请输入邀请码"
            className="gate-input"
            autoComplete="off"
            autoFocus
          />
          {error && <p className="gate-error">{error}</p>}
          <button type="submit" className="gate-btn" disabled={loading || !code.trim()}>
            {loading ? '验证中...' : '进入站点'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function GatePage() {
  return (
    <Suspense fallback={<div className="gate-page"><div className="gate-card">加载中...</div></div>}>
      <GateForm />
    </Suspense>
  );
}
