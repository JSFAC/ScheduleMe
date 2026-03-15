// pages/campus.tsx — EDU-verified campus marketplace
import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';
import BusinessProfile from '../components/BusinessProfile';
import { mapDbBusiness } from '../lib/realBusinesses';
import type { Business } from '../lib/mockBusinesses';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const CAMPUS_CATEGORIES = ['All', 'Hair & Beauty', 'Photography', 'Tutoring', 'Cleaning', 'Moving', 'Handyman', 'Other'];

const CampusPage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [loading, setLoading] = useState(true);
  const [eduStatus, setEduStatus] = useState<'unknown' | 'unverified' | 'verified'>('unknown');
  const [schoolDomain, setSchoolDomain] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);

  // Verification flow state
  const [schoolEmail, setSchoolEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('edu_verified, school_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.edu_verified) {
        setEduStatus('verified');
        setSchoolDomain(profile.school_name);
        loadCampusBusinesses(profile.school_name);
      } else {
        setEduStatus('unverified');
      }
      setLoading(false);
    });
  }, [router]);

  async function loadCampusBusinesses(domain: string | null) {
    const supabase = getSupabase();
    // Show all edu_verified businesses, or filter by domain if available
    let query = supabase
      .from('businesses')
      .select('*')
      .eq('is_onboarded', true)
      .eq('edu_verified', true)
      .order('rating', { ascending: false })
      .limit(40);

    if (domain) query = query.eq('school_domain', domain);

    const { data } = await query;
    if (data?.length) {
      setBusinesses(data.map((b: any) => mapDbBusiness(b)));
    }
  }

  async function sendCode() {
    setSending(true); setVerifyError('');
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/verify-edu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ school_email: schoolEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setVerifyError(data.error); return; }
      setCodeSent(true);
    } catch { setVerifyError('Something went wrong. Please try again.'); }
    finally { setSending(false); }
  }

  async function verifyCode() {
    setVerifying(true); setVerifyError('');
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/verify-edu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: 'verify', code }),
      });
      const data = await res.json();
      if (!res.ok) { setVerifyError(data.error); return; }
      setEduStatus('verified');
      setSchoolDomain(data.school_domain);
      loadCampusBusinesses(data.school_domain);
    } catch { setVerifyError('Something went wrong. Please try again.'); }
    finally { setVerifying(false); }
  }

  const filtered = businesses.filter(b =>
    activeCategory === 'All' || b.category === activeCategory
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: dm ? '#0a0a0a' : '#EDF5FF' }}>
      <div className="relative h-6 w-6">
        <div className="absolute inset-0 rounded-full border-2 border-neutral-200" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
    </div>
  );

  return (
    <>
      <Head><title>Campus — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pt-[72px]" style={{ background: dm ? '#0a0a0a' : '#EDF5FF' }}>

        {/* Header */}
        <div className="border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl font-black" style={{ letterSpacing: '-0.025em', color: dm ? '#f3f4f6' : '#171717' }}>
                Campus
              </span>
              {eduStatus === 'verified' && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-accent text-white">
                  ✓ {schoolDomain || 'Verified'}
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              Verified students and campus service providers
            </p>
          </div>
        </div>

        {/* Unverified — show verification flow */}
        {eduStatus === 'unverified' && (
          <div className="max-w-md mx-auto px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
              <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
            </div>
            <h2 className="text-xl font-black mb-2" style={{ letterSpacing: '-0.025em', color: dm ? '#f3f4f6' : '#171717' }}>
              Verify your .edu email
            </h2>
            <p className="text-sm mb-8" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              Unlock your campus marketplace — service providers verified by your school community.
            </p>

            {!codeSent ? (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="you@university.edu"
                  value={schoolEmail}
                  onChange={e => setSchoolEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e7eb', color: dm ? '#f3f4f6' : '#171717' }}
                />
                {verifyError && <p className="text-xs text-red-500">{verifyError}</p>}
                <button onClick={sendCode} disabled={sending || !schoolEmail.endsWith('.edu')}
                  className="w-full py-3 rounded-xl btn-primary text-sm font-semibold disabled:opacity-50">
                  {sending ? 'Sending…' : 'Send Verification Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                  We sent a 6-digit code to <strong>{schoolEmail}</strong>
                </p>
                <input
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 rounded-xl border text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e7eb', color: dm ? '#f3f4f6' : '#171717' }}
                  maxLength={6}
                />
                {verifyError && <p className="text-xs text-red-500">{verifyError}</p>}
                <button onClick={verifyCode} disabled={verifying || code.length !== 6}
                  className="w-full py-3 rounded-xl btn-primary text-sm font-semibold disabled:opacity-50">
                  {verifying ? 'Verifying…' : 'Verify Code'}
                </button>
                <button onClick={() => { setCodeSent(false); setCode(''); setVerifyError(''); }}
                  className="w-full text-sm" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>
                  Use a different email
                </button>
              </div>
            )}
          </div>
        )}

        {/* Verified — show campus businesses */}
        {eduStatus === 'verified' && (
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-8" style={{ scrollbarWidth: 'none' }}>
              {CAMPUS_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
                  style={activeCategory === cat
                    ? { background: '#0A84FF', borderColor: '#0A84FF', color: 'white' }
                    : { background: dm ? 'rgba(10,132,255,0.15)' : '#EDF5FF', borderColor: dm ? 'rgba(10,132,255,0.3)' : 'transparent', color: dm ? '#93c5fd' : '#0A84FF' }}>
                  {cat}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🎓</p>
                <p className="font-semibold mb-2" style={{ color: dm ? '#f3f4f6' : '#171717' }}>
                  No campus providers yet
                </p>
                <p className="text-sm mb-6" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                  Be the first service provider verified for your campus.
                </p>
                <a href="/business/signup" className="btn-primary text-sm px-6 py-2.5">
                  Apply as a campus provider →
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(biz => (
                  <button key={biz.id} onClick={() => setActiveBiz(biz)}
                    className="group text-left rounded-2xl border overflow-hidden hover:-translate-y-0.5 transition-all"
                    style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
                    <div className="relative overflow-hidden" style={{ height: 180 }}>
                      <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
                        <p className="text-white text-sm font-black" style={{ letterSpacing: '-0.01em' }}>{biz.name}</p>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: dm ? 'rgba(10,132,255,0.15)' : '#EDF5FF', color: dm ? '#93c5fd' : '#0A84FF' }}>
                          {biz.category}
                        </span>
                        <div className="flex items-center gap-1">
                          <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-xs font-semibold" style={{ color: dm ? '#d1d5db' : '#404040' }}>{biz.rating}</span>
                        </div>
                      </div>
                      <p className="text-xs mt-2 line-clamp-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{biz.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default CampusPage;
