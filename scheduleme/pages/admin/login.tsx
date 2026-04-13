// @ts-nocheck
// pages/admin/login.tsx — admin access code gate
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

const AdminLogin: NextPage = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { setError('Enter the admin access code.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin-verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Invalid code');
      const exp = Date.now() + 6 * 60 * 60 * 1000;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sm_admin_code_ok', JSON.stringify({ exp }));
        sessionStorage.setItem('sm_admin_next', '/admin');
      }
      window.location.href = '/signin?next=/admin';
    } catch (err: any) {
      setError(err?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head><title>Admin Access — ScheduleMe</title></Head>
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>ScheduleMe</span>
            <p className="text-accent text-xs font-semibold tracking-widest uppercase mt-1">Admin Panel</p>
            <p className="text-neutral-500 text-sm mt-3">Enter your admin access code.</p>
          </div>
          <form onSubmit={handleVerify} className="space-y-3">
            <input
              type="password"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Admin access code"
              className="w-full px-4 py-3 rounded-xl border border-neutral-800 bg-neutral-900 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">Back to site</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminLogin;
