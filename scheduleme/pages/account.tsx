// pages/account.tsx — Consumer account page
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import FeedbackModal from '../components/FeedbackModal';
import { SkeletonBookingCard } from '../components/SkeletonCard';
import { useDm } from '../lib/DarkModeContext';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type Tab = 'addresses' | 'notifications' | 'security' | 'settings';

interface Booking {
  id: string; service: string; status: string; created_at: string; business_name?: string;
}

// Proper toggle component
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className="relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none"
      style={{ width: '44px', height: '24px', backgroundColor: checked ? '#0A84FF' : '#d1d5db' }}>
      <span className="pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out"
        style={{ width: '20px', height: '20px', marginTop: '2px', transform: checked ? 'translateX(22px)' : 'translateX(2px)' }} />
    </button>
  );
}

// Delete confirmation modal
function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl border border-neutral-100 p-7 max-w-md w-full shadow-2xl">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-neutral-900 mb-1">Delete your account?</h2>
        <p className="text-sm text-neutral-500 mb-4">This will permanently delete your account, all your bookings, and saved data. <strong>This cannot be undone.</strong></p>
        <p className="text-sm text-neutral-600 mb-2">Type <strong>DELETE</strong> to confirm:</p>
        <input type="text" className="form-input mb-4" placeholder="DELETE" value={confirmText} onChange={e => setConfirmText(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={confirmText !== 'DELETE'}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: confirmText === 'DELETE' ? '#ef4444' : '#d1d5db' }}>
            Delete My Account
          </button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'addresses', label: 'Addresses', icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg> },
  { key: 'notifications', label: 'Notifications', icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> },
  { key: 'security', label: 'Security', icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg> },
  { key: 'settings', label: 'Profile', icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
];

const Account: NextPage = () => {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('addresses');
  const [user, setUser] = useState<any>(null);
  const { dm, toggle: toggleDark } = useDm();
  const darkMode = dm;
  const [authProvider, setAuthProvider] = useState<string>('email');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  const [addresses, setAddresses] = useState<any[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');

  const [notifPrefs, setNotifPrefs] = useState({
    bookingConfirmed: true, statusUpdates: true, newMatches: false, promotions: false,
    emailChannel: true, smsChannel: false,
  });
  const [notifSaved, setNotifSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Draft persistence — localStorage keys
  const DRAFT_PROFILE = 'sm_draft_profile';
  const DRAFT_ADDRESS = 'sm_draft_address';
  const DRAFT_PASSWORD = 'sm_draft_password';
  const [profileDraft, setProfileDraft] = useState(false); // has unsaved draft
  const [addressDraft, setAddressDraft] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/signin'); return; }
      const u = session.user;
      setUser(u);
      setName(u.user_metadata?.full_name || '');
      setPhone(u.user_metadata?.phone || '');
      setAuthProvider(u.app_metadata?.provider || 'email');
      if (u.user_metadata?.notif_prefs) setNotifPrefs(p => ({ ...p, ...u.user_metadata.notif_prefs }));
      if (u.user_metadata?.addresses) setAddresses(u.user_metadata.addresses);
      try {
        const res = await fetch(`/api/bookings?user_phone=${encodeURIComponent(u.phone || u.user_metadata?.phone || '')}`);
        if (res.ok) { const data = await res.json(); setBookings(data.bookings || []); }
      } catch {}
      // Check for in-progress drafts
      if (typeof window !== 'undefined') {
        const pd = localStorage.getItem('sm_draft_profile');
        if (pd) { try { const d = JSON.parse(pd); if (d.name || d.phone) setProfileDraft(true); } catch {} }
        const ad = localStorage.getItem('sm_draft_address');
        if (ad) { try { const d = JSON.parse(ad); if (d.street || d.label) setAddressDraft(true); } catch {} }
        const pwd = localStorage.getItem('sm_draft_password');
        if (pwd) { try { const d = JSON.parse(pwd); if (d.newPw) setPasswordDraft(true); } catch {} }
      }
      setLoading(false);
      setTimeout(() => setFadeIn(true), 50);
    });
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError('');
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ data: { full_name: name, phone } });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setSaved(true); setProfileDraft(false);
    if (typeof window !== 'undefined') localStorage.removeItem('sm_draft_profile');
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSaveNotifs(newPrefs: typeof notifPrefs) {
    setNotifPrefs(newPrefs);
    const supabase = getSupabase();
    await supabase.auth.updateUser({ data: { notif_prefs: newPrefs } });
    setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2000);
  }

  async function persistAddresses(list: any[]) {
    const supabase = getSupabase();
    await supabase.auth.updateUser({ data: { addresses: list } });
    setAddresses(list);
  }

  function addAddress() {
    if (!addrStreet) return;
    const newList = [...addresses, { id: Date.now().toString(), label: addrLabel || 'Address', address: addrStreet, city: addrCity, default: addresses.length === 0 }];
    persistAddresses(newList);
    setAddrLabel(''); setAddrStreet(''); setAddrCity(''); setShowAddressForm(false);
    setAddressDraft(false);
    if (typeof window !== 'undefined') localStorage.removeItem('sm_draft_address');
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault(); setPwError('');
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    setPwSaving(true);
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) { setPwError(error.message); return; }
    setPwSaved(true); setNewPw(''); setConfirmPw('');
    setPasswordDraft(false);
    if (typeof window !== 'undefined') localStorage.removeItem('sm_draft_password');
    setTimeout(() => { setPwSaved(false); setShowPasswordForm(false); }, 2500);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const supabase = getSupabase();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch('/api/delete-account', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      await supabase.auth.signOut();
      router.push('/?deleted=1');
    } catch (err) {
      setDeleting(false);
      alert(err instanceof Error ? err.message : 'Failed to delete account.');
    }
  }

  function handleSignOut() {
    const supabase = getSupabase();
    supabase.auth.signOut().then(() => router.push('/'));
  }

  function restoreProfileDraft() {
    if (typeof window === 'undefined') return;
    try {
      const d = JSON.parse(localStorage.getItem('sm_draft_profile') || '{}');
      if (d.name) setName(d.name);
      if (d.phone) setPhone(d.phone);
    } catch {}
    setProfileDraft(false);
  }
  function restoreAddressDraft() {
    if (typeof window === 'undefined') return;
    try {
      const d = JSON.parse(localStorage.getItem('sm_draft_address') || '{}');
      if (d.label) setAddrLabel(d.label);
      if (d.street) setAddrStreet(d.street);
      if (d.city) setAddrCity(d.city);
      setShowAddressForm(true);
    } catch {}
    setAddressDraft(false);
  }
  function restorePasswordDraft() {
    if (typeof window === 'undefined') return;
    try {
      const d = JSON.parse(localStorage.getItem('sm_draft_password') || '{}');
      if (d.newPw) setNewPw(d.newPw);
      setShowPasswordForm(true);
    } catch {}
    setPasswordDraft(false);
  }
  function dismissDraft(key: string, setter: (v: boolean) => void) {
    if (typeof window !== 'undefined') localStorage.removeItem(key);
    setter(false);
  }

  if (loading) return (
    <>
      <Nav />
      <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center">
        <div className="relative h-6 w-6">
          <div className="absolute inset-0 rounded-full border-2 border-neutral-200" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        </div>
      </div>
    </>
  );

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  const isGoogleAuth = authProvider === 'google';

  return (
    <>
      <Head>
        <title>My Account — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav />

      {showDeleteModal && <DeleteModal onConfirm={handleDeleteAccount} onCancel={() => setShowDeleteModal(false)} />}

      <style>{`
        @keyframes tabIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .tab-panel { animation: tabIn 0.22s ease both; }
      `}</style>

      <div className="min-h-screen bg-neutral-50 pt-[72px]"
        style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.4s ease' }}>

        {/* Premium header — sm-panel */}
        <div className={`${dm ? 'bg-[#0d0d0d]' : 'sm-panel'} border-b`} style={{ borderColor: dm ? '#262626' : 'rgba(0,0,0,0.06)' }}>
          <div className="sm-glow" style={{ width: 500, height: 350, top: -175, right: '-5%' }} />
          <div className="relative mx-auto max-w-5xl px-6 pt-8 pb-6 flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Avatar */}
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-lg font-black flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#0A84FF 0%,#0055CC 100%)' }}>
                {initials}
              </div>
              <div className="min-w-0">
                <span className="sm-eyebrow mb-1 block">My Account</span>
                <h1 className="text-xl font-black text-neutral-900 truncate" style={{ letterSpacing: '-0.025em' }}>{displayName}</h1>
                <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {memberSince && <p className="text-xs text-neutral-400 hidden sm:block">Since {memberSince}</p>}
              {/* Desktop: show New Request button */}
              <Link href="/browse" scroll={false} className="btn-primary text-sm px-4 py-2 hidden sm:inline-flex">
                + New Request
              </Link>
              {/* Mobile: show a menu dropdown with nav options */}
              <div className="relative sm:hidden">
                <button onClick={() => setShowNavMenu(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl border transition-all"
                  style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb', color: dm ? '#f3f4f6' : '#171717' }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                  Menu
                </button>
                {showNavMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl shadow-xl overflow-hidden z-50"
                    style={{ background: dm ? '#171717' : 'white', border: `1px solid ${dm ? '#262626' : '#e5e7eb'}` }}>
                    <Link href="/browse" scroll={false} onClick={() => setShowNavMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/5"
                      style={{ color: dm ? '#f3f4f6' : '#171717' }}>
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      New Request
                    </Link>
                    <div style={{ height: 1, background: dm ? '#262626' : '#f0f0f0' }} />
                    <Link href="/business/dashboard" scroll={false} onClick={() => setShowNavMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/5"
                      style={{ color: dm ? '#f3f4f6' : '#171717' }}>
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                      </svg>
                      Business Dashboard
                    </Link>
                    <Link href="/" scroll={false} onClick={() => setShowNavMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/5"
                      style={{ color: dm ? '#f3f4f6' : '#171717' }}>
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
                      </svg>
                      Landing Page
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 py-7 space-y-5"
          style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.4s ease' }}>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length, icon: 'M4.5 12.75l6 6 9-13.5', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Saved Addresses', value: addresses.length, icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z', color: 'text-accent', bg: 'bg-blue-50' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <svg className={`h-4 w-4 ${s.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-black text-neutral-900" style={{ letterSpacing: '-0.02em' }}>{s.value}</p>
                  <p className="text-xs text-neutral-400 mt-0">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Draft restore banners */}
          {(tab === 'settings' && profileDraft) && (
            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                <p className="text-sm font-semibold text-amber-800">You have unsaved profile changes — continue where you left off?</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={restoreProfileDraft} className="text-xs font-black text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">Restore</button>
                <button onClick={() => dismissDraft('sm_draft_profile', setProfileDraft)} className="text-xs text-amber-500 hover:text-amber-700 px-2 py-1.5">Dismiss</button>
              </div>
            </div>
          )}
          {(tab === 'addresses' && addressDraft) && (
            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                <p className="text-sm font-semibold text-amber-800">You have an unfinished address — continue where you left off?</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={restoreAddressDraft} className="text-xs font-black text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">Restore</button>
                <button onClick={() => dismissDraft('sm_draft_address', setAddressDraft)} className="text-xs text-amber-500 hover:text-amber-700 px-2 py-1.5">Dismiss</button>
              </div>
            </div>
          )}
          {(tab === 'security' && passwordDraft) && (
            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                <p className="text-sm font-semibold text-amber-800">You started changing your password — continue where you left off?</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={restorePasswordDraft} className="text-xs font-black text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">Restore</button>
                <button onClick={() => dismissDraft('sm_draft_password', setPasswordDraft)} className="text-xs text-amber-500 hover:text-amber-700 px-2 py-1.5">Dismiss</button>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-1.5 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-[14px] text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                  tab === t.key
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── ADDRESSES ── */}
          {tab === 'addresses' && (
            <div className="tab-panel space-y-3">
              {addresses.length === 0 && !showAddressForm && (
                <div className="bg-white rounded-2xl border border-neutral-100 p-10 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="h-6 w-6 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <p className="font-bold text-neutral-700 mb-1">No saved addresses</p>
                  <p className="text-neutral-400 text-sm mb-5">Save your home or office for faster booking.</p>
                  <button onClick={() => setShowAddressForm(true)} className="btn-primary text-sm px-5 py-2">Add Address</button>
                </div>
              )}

              {addresses.map(addr => (
                <div key={addr.id} className="bg-white rounded-2xl border border-neutral-100 px-5 py-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: dm ? '#0d1f35' : '#eff6ff' }}>
                    <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-neutral-900 text-sm">{addr.label}</p>
                      {addr.default && <span className="text-[10px] px-2 py-0.5 rounded-full text-accent font-bold uppercase tracking-wide" style={{ background: dm ? '#0d1f35' : '#eff6ff' }}>Default</span>}
                    </div>
                    <p className="text-sm text-neutral-500">{addr.address}</p>
                    {addr.city && <p className="text-sm text-neutral-400">{addr.city}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {!addr.default && (
                      <button onClick={() => persistAddresses(addresses.map(a => ({ ...a, default: a.id === addr.id })))}
                        className="text-xs text-neutral-400 hover:text-accent transition-colors">Set default</button>
                    )}
                    <button onClick={() => persistAddresses(addresses.filter(a => a.id !== addr.id))}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                  </div>
                </div>
              ))}

              {showAddressForm ? (
                <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                  <h3 className="font-bold text-neutral-900 mb-4" style={{ letterSpacing: '-0.01em' }}>Add Address</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Label</label>
                      <input type="text" className="form-input" placeholder="Home, Office, etc." value={addrLabel} onChange={e => { setAddrLabel(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_address', JSON.stringify({ label: e.target.value, street: addrStreet, city: addrCity })); }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Street Address</label>
                      <input type="text" className="form-input" placeholder="123 Main St" value={addrStreet} onChange={e => { setAddrStreet(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_address', JSON.stringify({ label: addrLabel, street: e.target.value, city: addrCity })); }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">City, State ZIP</label>
                      <input type="text" className="form-input" placeholder="Austin, TX 78701" value={addrCity} onChange={e => { setAddrCity(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_address', JSON.stringify({ label: addrLabel, street: addrStreet, city: e.target.value })); }} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={addAddress} className="btn-primary text-sm px-5 py-2">Save</button>
                      <button onClick={() => setShowAddressForm(false)} className="text-sm text-neutral-400 hover:text-neutral-700 px-4 py-2">Cancel</button>
                    </div>
                  </div>
                </div>
              ) : addresses.length > 0 && (
                <button onClick={() => setShowAddressForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-accent hover:text-accent transition-colors text-sm font-medium">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Another Address
                </button>
              )}
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === 'notifications' && (
            <div className="tab-panel space-y-3">
              <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="sm-eyebrow mb-2 block">Activity</span>
                    <h2 className="font-bold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>Alert Preferences</h2>
                  </div>
                  {notifSaved && <span className="text-xs text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full">✓ Saved</span>}
                </div>
                <p className="text-sm text-neutral-400 mb-5 mt-1">Choose what you want to be notified about.</p>
                <div className="space-y-5">
                  {([
                    { key: 'bookingConfirmed', label: 'Booking confirmations', desc: 'When a business confirms your request' },
                    { key: 'statusUpdates', label: 'Status updates', desc: 'When your booking status changes' },
                    { key: 'newMatches', label: 'New pro matches', desc: 'When new pros become available near you' },
                    { key: 'promotions', label: 'Offers & promotions', desc: 'Occasional deals from local businesses' },
                  ] as const).map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-6">
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">{item.label}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{item.desc}</p>
                      </div>
                      <Toggle label={item.label} checked={notifPrefs[item.key]}
                        onChange={() => handleSaveNotifs({ ...notifPrefs, [item.key]: !notifPrefs[item.key] })} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                <span className="sm-eyebrow mb-2 block">Channels</span>
                <h2 className="font-bold text-neutral-900 mb-1" style={{ letterSpacing: '-0.01em' }}>Delivery Method</h2>
                <p className="text-sm text-neutral-400 mb-5 mt-1">How you'd like to receive notifications.</p>
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">Email</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{user?.email}</p>
                    </div>
                    <Toggle label="Email" checked={notifPrefs.emailChannel}
                      onChange={() => handleSaveNotifs({ ...notifPrefs, emailChannel: !notifPrefs.emailChannel })} />
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">Text (SMS)</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {phone ? phone : (
                          <button onClick={() => setTab('settings')} className="text-accent hover:underline">Add phone in Profile →</button>
                        )}
                      </p>
                    </div>
                    <Toggle label="SMS" checked={notifPrefs.smsChannel}
                      onChange={() => handleSaveNotifs({ ...notifPrefs, smsChannel: !notifPrefs.smsChannel })} />
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-neutral-100">
                  <p className="text-xs text-neutral-400">Email and SMS delivery is coming soon. Your preferences are saved and will activate automatically.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── SECURITY ── */}
          {tab === 'security' && (
            <div className="tab-panel space-y-3">
              {isGoogleAuth ? (
                <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                  <span className="sm-eyebrow mb-2 block">Authentication</span>
                  <h2 className="font-bold text-neutral-900 mb-3" style={{ letterSpacing: '-0.01em' }}>Password</h2>
                  <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: dm ? '#0d1f35' : '#eff6ff', border: dm ? '1px solid rgba(59,130,246,0.3)' : '1px solid #dbeafe' }}>
                    <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <div>
                      <p className="text-sm font-bold" style={{ color: dm ? '#bfdbfe' : '#1e3a8a' }}>Signed in with Google</p>
                      <p className="text-sm mt-0.5" style={{ color: dm ? '#93c5fd' : '#1d4ed8' }}>Password management is handled through your Google account.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                  <span className="sm-eyebrow mb-2 block">Authentication</span>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="font-bold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>Password</h2>
                    {!showPasswordForm && (
                      <button onClick={() => setShowPasswordForm(true)} className="text-sm font-semibold text-accent">Change →</button>
                    )}
                  </div>
                  <p className="text-sm text-neutral-400 mt-1">Keep your account secure with a strong password.</p>
                  {showPasswordForm && (
                    <form onSubmit={handleChangePassword} className="mt-5 space-y-3">
                      {pwError && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{pwError}</div>}
                      {pwSaved && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">✓ Password updated.</div>}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">New Password</label>
                        <input type="password" required className="form-input" placeholder="At least 8 characters" value={newPw} onChange={e => { setNewPw(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_password', JSON.stringify({ newPw: e.target.value })); }} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Confirm Password</label>
                        <input type="password" required className="form-input" placeholder="••••••••" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="submit" disabled={pwSaving} className="btn-primary text-sm px-5 py-2.5">
                          {pwSaving ? 'Updating…' : 'Update Password'}
                        </button>
                        <button type="button" onClick={() => { setShowPasswordForm(false); setPwError(''); }} className="text-sm text-neutral-400 hover:text-neutral-700 px-4 py-2">Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                <span className="sm-eyebrow mb-2 block">Sign-in</span>
                <h2 className="font-bold text-neutral-900 mb-4" style={{ letterSpacing: '-0.01em' }}>Connected Method</h2>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                  {isGoogleAuth ? (
                    <>
                      <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">Google</p>
                        <p className="text-xs text-neutral-400">{user?.email}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">Email & Password</p>
                        <p className="text-xs text-neutral-400">{user?.email}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PROFILE SETTINGS ── */}
          {tab === 'settings' && (
            <div className="tab-panel grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                <span className="sm-eyebrow mb-2 block">Personal</span>
                <h2 className="font-bold text-neutral-900 mb-5" style={{ letterSpacing: '-0.01em' }}>Your Info</h2>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {saveError && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{saveError}</div>}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Full name</label>
                    <input type="text" className="form-input" value={name} onChange={e => { setName(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_profile', JSON.stringify({ name: e.target.value, phone })); }} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Email address</label>
                    <input type="email" className="form-input bg-neutral-50 cursor-not-allowed" value={user?.email || ''} disabled />
                    <p className="text-xs text-neutral-400 mt-1">{isGoogleAuth ? 'Managed by Google.' : 'Contact support to change.'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Phone number</label>
                    <input type="tel" className="form-input" value={phone} onChange={e => { setPhone(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_profile', JSON.stringify({ name, phone: e.target.value })); }} placeholder="(555) 000-1234" />
                    <p className="text-xs text-neutral-400 mt-1">Used for SMS and matching with local pros.</p>
                  </div>
                  <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm">
                    {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </form>
              </div>

              <div className="space-y-3">
                <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                  <span className="sm-eyebrow mb-2 block">Preferences</span>
                  <h2 className="font-bold text-neutral-900 mb-4" style={{ letterSpacing: '-0.01em' }}>Service Settings</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Preferred contact</label>
                      <select className="form-input"><option>Text message</option><option>Phone call</option><option>Email</option></select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Service radius</label>
                      <select className="form-input">
                        <option>Within 5 miles</option><option>Within 10 miles</option>
                        <option>Within 25 miles</option><option>Any distance</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                  <span className="sm-eyebrow mb-2 block">Account</span>
                  <h2 className="font-bold text-neutral-900 mb-4" style={{ letterSpacing: '-0.01em' }}>Manage</h2>
                  <div className="space-y-2">
                    {/* Dark mode toggle */}
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-neutral-200">
                      <div className="flex items-center gap-2.5">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          {darkMode
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                          }
                        </svg>
                        <span className="text-sm font-medium text-neutral-700">Dark Mode</span>
                      </div>
                      <button onClick={toggleDark}
                        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
                        style={{ background: darkMode ? '#0A84FF' : '#d1d5db' }}>
                        <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                          style={{ transform: darkMode ? 'translateX(20px)' : 'translateX(0px)' }} />
                      </button>
                    </div>
                    <button onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors">
                      <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                      Sign Out
                    </button>
                    <div className="pt-3 border-t border-neutral-100 mt-2">
                      <p className="text-xs text-neutral-400 mb-2 uppercase tracking-wide font-semibold">Danger Zone</p>
                      <button onClick={() => setShowDeleteModal(true)}
                        className="w-full text-left text-sm text-red-500 hover:text-red-700 transition-colors px-4 py-2.5 rounded-xl hover:bg-red-50">
                        Delete my account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default Account;
