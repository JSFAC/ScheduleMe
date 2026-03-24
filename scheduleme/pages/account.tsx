// @ts-nocheck
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
  { key: 'settings', label: 'Profile', icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
  { key: 'addresses', label: 'Addresses', icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg> },
  { key: 'notifications', label: 'Notifications', icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> },
  { key: 'security', label: 'Security', icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg> },
];

const Account: NextPage = () => {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('settings');
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

  // ── FIX: these must be at the top level, NOT after an early return ──
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowNavMenu(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const DRAFT_PROFILE = 'sm_draft_profile';
  const DRAFT_ADDRESS = 'sm_draft_address';
  const DRAFT_PASSWORD = 'sm_draft_password';
  const [profileDraft, setProfileDraft] = useState(false);
  const [eduVerified, setEduVerified] = useState<boolean | null>(null);
  const [eduEmail, setEduEmail] = useState('');
  const [eduCode, setEduCode] = useState('');
  const [eduStep, setEduStep] = useState<'email'|'code'|'done'>('email');
  const [eduLoading, setEduLoading] = useState(false);
  const [eduError, setEduError] = useState('');
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
      // Load edu verified status
      const sb2 = getSupabase();
      sb2.from('profiles').select('edu_verified,school_email').eq('id', u.id).maybeSingle().then(({data}) => {
        setEduVerified(data?.edu_verified ?? false);
        if (data?.school_email) setEduEmail(data.school_email);
      });
      if (u.user_metadata?.notif_prefs) setNotifPrefs(p => ({ ...p, ...u.user_metadata.notif_prefs }));
      if (u.user_metadata?.addresses) setAddresses(u.user_metadata.addresses);
      try {
        const res = await fetch(`/api/bookings?user_phone=${encodeURIComponent(u.phone || u.user_metadata?.phone || '')}`);
        if (res.ok) { const data = await res.json(); setBookings(data.bookings || []); }
      } catch {}
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

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    setAvatarUploading(true);
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${session.user.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) { alert('Upload failed: ' + upErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);
      setAvatarUrl(publicUrl);
    } finally { setAvatarUploading(false); }
  }

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: dm ? '#0a0a0a' : '#f9fafb' }}>
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

  const cardBg = dm ? '#1c1c1e' : 'white';
  const cardBorder = dm ? '#2c2c2e' : '#f3f4f6';
  const textPrimary = dm ? '#f2f2f7' : '#111827';
  const textSecondary = dm ? '#8e8e93' : '#6b7280';
  const textMuted = dm ? '#6b7280' : '#9ca3af';
  const inputBg = dm ? '#2c2c2e' : 'white';
  const inputBorder = dm ? '#3a3a3c' : '#e5e7eb';
  const pageBg = dm ? '#0a0a0a' : '#f9fafb';

  return (
    <>
      <Head>
        <title>My Account — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <Nav />

      {showDeleteModal && <DeleteModal onConfirm={handleDeleteAccount} onCancel={() => setShowDeleteModal(false)} />}

      <style>{`
        @keyframes tabIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .tab-panel { animation: tabIn 0.22s ease both; }
        .form-input { width: 100%; padding: 10px 14px; border-radius: 12px; font-size: 14px; outline: none; border: 1.5px solid ${inputBorder}; background: ${inputBg}; color: ${textPrimary}; }
        .form-input:focus { border-color: #0A84FF; }
        .form-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; background: #0A84FF; color: white; font-weight: 700; font-size: 14px; padding: 10px 20px; border-radius: 12px; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .sm-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${textMuted}; }
      `}</style>

      <div className="min-h-screen pb-24 md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: pageBg, opacity: fadeIn ? 1 : 0, transition: 'opacity 0.4s ease' }}>

        {/* Header */}
        <div className="border-b" style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : 'rgba(0,0,0,0.06)' }}>
          <div className="relative mx-auto max-w-5xl px-6 pt-5 pb-5 flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <label className="relative h-14 w-14 rounded-2xl flex-shrink-0 cursor-pointer group overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#0A84FF 0%,#0055CC 100%)' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="flex items-center justify-center w-full h-full text-white text-lg font-black">{initials}</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {avatarUploading
                    ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  }
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ''; }} />
              </label>
              <div className="min-w-0">
                <span className="sm-eyebrow mb-1 block">My Account</span>
                <h1 className="text-xl font-black truncate" style={{ letterSpacing: '-0.025em', color: textPrimary }}>{displayName}</h1>
                <p className="text-xs truncate" style={{ color: textMuted }}>{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {memberSince && <p className="text-xs hidden sm:block" style={{ color: textMuted }}>Since {memberSince}</p>}
              <Link href="/browse" scroll={false} className="btn-primary text-sm px-4 py-2 hidden sm:inline-flex">
                + New Request
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 py-7 space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length, icon: 'M4.5 12.75l6 6 9-13.5', color: '#16a34a', bg: dm ? 'rgba(22,163,74,0.15)' : '#f0fdf4' },
              { label: 'Saved Addresses', value: addresses.length, icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z', color: '#0A84FF', bg: dm ? 'rgba(10,132,255,0.15)' : '#eff6ff' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                  <svg className="h-4 w-4" style={{ color: s.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-black" style={{ letterSpacing: '-0.02em', color: textPrimary }}>{s.value}</p>
                  <p className="text-xs" style={{ color: textMuted }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Draft restore banners */}
          {(tab === 'settings' && profileDraft) && (
            <div className="flex items-center justify-between gap-3 rounded-2xl px-5 py-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <p className="text-sm font-semibold text-amber-800">You have unsaved profile changes — continue where you left off?</p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={restoreProfileDraft} className="text-xs font-black text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">Restore</button>
                <button onClick={() => dismissDraft('sm_draft_profile', setProfileDraft)} className="text-xs text-amber-500 hover:text-amber-700 px-2 py-1.5">Dismiss</button>
              </div>
            </div>
          )}
          {(tab === 'addresses' && addressDraft) && (
            <div className="flex items-center justify-between gap-3 rounded-2xl px-5 py-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <p className="text-sm font-semibold text-amber-800">You have an unfinished address — continue where you left off?</p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={restoreAddressDraft} className="text-xs font-black text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">Restore</button>
                <button onClick={() => dismissDraft('sm_draft_address', setAddressDraft)} className="text-xs text-amber-500 hover:text-amber-700 px-2 py-1.5">Dismiss</button>
              </div>
            </div>
          )}
          {(tab === 'security' && passwordDraft) && (
            <div className="flex items-center justify-between gap-3 rounded-2xl px-5 py-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <p className="text-sm font-semibold text-amber-800">You started changing your password — continue where you left off?</p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={restorePasswordDraft} className="text-xs font-black text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">Restore</button>
                <button onClick={() => dismissDraft('sm_draft_password', setPasswordDraft)} className="text-xs text-amber-500 hover:text-amber-700 px-2 py-1.5">Dismiss</button>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="rounded-2xl border p-1.5 flex gap-1 overflow-x-auto" style={{ background: cardBg, borderColor: cardBorder, scrollbarWidth: 'none' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-[14px] text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0"
                style={tab === t.key
                  ? { background: '#0A84FF', color: 'white' }
                  : { color: textSecondary, background: 'transparent' }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── ADDRESSES ── */}
          {tab === 'addresses' && (
            <div className="tab-panel space-y-3">
              {addresses.length === 0 && !showAddressForm && (
                <div className="rounded-2xl border p-10 text-center" style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: dm ? '#2c2c2e' : '#f3f4f6' }}>
                    <svg className="h-6 w-6" style={{ color: textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <p className="font-bold mb-1" style={{ color: textPrimary }}>No saved addresses</p>
                  <p className="text-sm mb-5" style={{ color: textMuted }}>Save your home or office for faster booking.</p>
                  <button onClick={() => setShowAddressForm(true)} className="btn-primary text-sm px-5 py-2">Add Address</button>
                </div>
              )}
              {addresses.map(addr => (
                <div key={addr.id} className="rounded-2xl border px-5 py-4 flex items-center gap-4" style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: dm ? '#0d1f35' : '#eff6ff' }}>
                    <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm" style={{ color: textPrimary }}>{addr.label}</p>
                      {addr.default && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide" style={{ background: dm ? '#0d1f35' : '#eff6ff', color: '#0A84FF' }}>Default</span>}
                    </div>
                    <p className="text-sm" style={{ color: textSecondary }}>{addr.address}</p>
                    {addr.city && <p className="text-sm" style={{ color: textMuted }}>{addr.city}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {!addr.default && (
                      <button onClick={() => persistAddresses(addresses.map(a => ({ ...a, default: a.id === addr.id })))}
                        className="text-xs hover:text-accent transition-colors" style={{ color: textMuted }}>Set default</button>
                    )}
                    <button onClick={() => persistAddresses(addresses.filter(a => a.id !== addr.id))}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                  </div>
                </div>
              ))}
              {showAddressForm ? (
                <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                  <h3 className="font-bold mb-4" style={{ letterSpacing: '-0.01em', color: textPrimary }}>Add Address</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>Label</label>
                      <input type="text" className="form-input" placeholder="Home, Office, etc." value={addrLabel} onChange={e => { setAddrLabel(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_address', JSON.stringify({ label: e.target.value, street: addrStreet, city: addrCity })); }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>Street Address</label>
                      <input type="text" className="form-input" placeholder="123 Main St" value={addrStreet} onChange={e => { setAddrStreet(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_address', JSON.stringify({ label: addrLabel, street: e.target.value, city: addrCity })); }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>City, State ZIP</label>
                      <input type="text" className="form-input" placeholder="Austin, TX 78701" value={addrCity} onChange={e => { setAddrCity(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_address', JSON.stringify({ label: addrLabel, street: addrStreet, city: e.target.value })); }} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={addAddress} className="btn-primary text-sm px-5 py-2">Save</button>
                      <button onClick={() => setShowAddressForm(false)} className="text-sm px-4 py-2 transition-colors" style={{ color: textMuted }}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : addresses.length > 0 && (
                <button onClick={() => setShowAddressForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                  style={{ borderColor: dm ? '#3a3a3c' : '#e5e7eb', color: textMuted }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Another Address
                </button>
              )}
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === 'notifications' && (
            <div className="tab-panel space-y-3">
              <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="sm-eyebrow mb-2 block">Activity</span>
                    <h2 className="font-bold" style={{ letterSpacing: '-0.01em', color: textPrimary }}>Alert Preferences</h2>
                  </div>
                  {notifSaved && <span className="text-xs text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full">✓ Saved</span>}
                </div>
                <p className="text-sm mb-5 mt-1" style={{ color: textMuted }}>Choose what you want to be notified about.</p>
                <div className="space-y-5">
                  {([
                    { key: 'bookingConfirmed', label: 'Booking confirmations', desc: 'When a business confirms your request' },
                    { key: 'statusUpdates', label: 'Status updates', desc: 'When your booking status changes' },
                    { key: 'newMatches', label: 'New pro matches', desc: 'When new pros become available near you' },
                    { key: 'promotions', label: 'Offers & promotions', desc: 'Occasional deals from local businesses' },
                  ] as const).map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-6">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: textPrimary }}>{item.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: textMuted }}>{item.desc}</p>
                      </div>
                      <Toggle label={item.label} checked={notifPrefs[item.key]}
                        onChange={() => handleSaveNotifs({ ...notifPrefs, [item.key]: !notifPrefs[item.key] })} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                <span className="sm-eyebrow mb-2 block">Channels</span>
                <h2 className="font-bold mb-1" style={{ letterSpacing: '-0.01em', color: textPrimary }}>Delivery Method</h2>
                <p className="text-sm mb-5 mt-1" style={{ color: textMuted }}>How you'd like to receive notifications.</p>
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: textPrimary }}>Email</p>
                      <p className="text-xs mt-0.5" style={{ color: textMuted }}>{user?.email}</p>
                    </div>
                    <Toggle label="Email" checked={notifPrefs.emailChannel}
                      onChange={() => handleSaveNotifs({ ...notifPrefs, emailChannel: !notifPrefs.emailChannel })} />
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: textPrimary }}>Text (SMS)</p>
                      <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                        {phone ? phone : (
                          <button onClick={() => setTab('settings')} className="text-accent hover:underline">Add phone in Profile →</button>
                        )}
                      </p>
                    </div>
                    <Toggle label="SMS" checked={notifPrefs.smsChannel}
                      onChange={() => handleSaveNotifs({ ...notifPrefs, smsChannel: !notifPrefs.smsChannel })} />
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t" style={{ borderColor: cardBorder }}>
                  <p className="text-xs" style={{ color: textMuted }}>Email and SMS delivery is coming soon. Your preferences are saved and will activate automatically.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── SECURITY ── */}
          {tab === 'security' && (
            <div className="tab-panel space-y-3">
              {isGoogleAuth ? (
                <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                  <span className="sm-eyebrow mb-2 block">Authentication</span>
                  <h2 className="font-bold mb-3" style={{ letterSpacing: '-0.01em', color: textPrimary }}>Password</h2>
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
                <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                  <span className="sm-eyebrow mb-2 block">Authentication</span>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="font-bold" style={{ letterSpacing: '-0.01em', color: textPrimary }}>Password</h2>
                    {!showPasswordForm && (
                      <button onClick={() => setShowPasswordForm(true)} className="text-sm font-semibold text-accent">Change →</button>
                    )}
                  </div>
                  <p className="text-sm mt-1" style={{ color: textMuted }}>Keep your account secure with a strong password.</p>
                  {showPasswordForm && (
                    <form onSubmit={handleChangePassword} className="mt-5 space-y-3">
                      {pwError && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{pwError}</div>}
                      {pwSaved && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">✓ Password updated.</div>}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>New Password</label>
                        <input type="password" required className="form-input" placeholder="At least 8 characters" value={newPw} onChange={e => { setNewPw(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_password', JSON.stringify({ newPw: e.target.value })); }} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>Confirm Password</label>
                        <input type="password" required className="form-input" placeholder="••••••••" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="submit" disabled={pwSaving} className="btn-primary text-sm px-5 py-2.5">
                          {pwSaving ? 'Updating…' : 'Update Password'}
                        </button>
                        <button type="button" onClick={() => { setShowPasswordForm(false); setPwError(''); }} className="text-sm px-4 py-2 transition-colors" style={{ color: textMuted }}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
              <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                <span className="sm-eyebrow mb-2 block">Sign-in</span>
                <h2 className="font-bold mb-4" style={{ letterSpacing: '-0.01em', color: textPrimary }}>Connected Method</h2>
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: dm ? '#2c2c2e' : '#f9fafb', border: `1px solid ${cardBorder}` }}>
                  {isGoogleAuth ? (
                    <>
                      <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: textPrimary }}>Google</p>
                        <p className="text-xs" style={{ color: textMuted }}>{user?.email}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 flex-shrink-0" style={{ color: textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: textPrimary }}>Email & Password</p>
                        <p className="text-xs" style={{ color: textMuted }}>{user?.email}</p>
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
              <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                <span className="sm-eyebrow mb-2 block">Personal</span>
                <h2 className="font-bold mb-5" style={{ letterSpacing: '-0.01em', color: textPrimary }}>Your Info</h2>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {saveError && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{saveError}</div>}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>Full name</label>
                    <input type="text" className="form-input" value={name} onChange={e => { setName(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_profile', JSON.stringify({ name: e.target.value, phone })); }} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>Email address</label>
                    <input type="email" className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed', background: inputBg, borderColor: inputBorder, color: textPrimary }} />
                    <p className="text-xs mt-1" style={{ color: textMuted }}>{isGoogleAuth ? 'Managed by Google.' : 'Contact support to change.'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>Phone number</label>
                    <input type="tel" className="form-input" value={phone} onChange={e => { setPhone(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('sm_draft_profile', JSON.stringify({ name, phone: e.target.value })); }} placeholder="(555) 000-1234" />
                    <p className="text-xs mt-1" style={{ color: textMuted }}>Used for SMS and matching with local pros.</p>
                  </div>
                  <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm">
                    {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </form>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                  <span className="sm-eyebrow mb-2 block">Preferences</span>
                  <h2 className="font-bold mb-4" style={{ letterSpacing: '-0.01em', color: textPrimary }}>Service Settings</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>Preferred contact</label>
                      <select className="form-input" style={{ background: inputBg, color: textPrimary, borderColor: inputBorder }}>
                        <option>Text message</option><option>Phone call</option><option>Email</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: textMuted }}>Service radius</label>
                      <select className="form-input" style={{ background: inputBg, color: textPrimary, borderColor: inputBorder }}>
                        <option>Within 5 miles</option><option>Within 10 miles</option>
                        <option>Within 25 miles</option><option>Any distance</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                  <span className="sm-eyebrow mb-2 block">Campus</span>
                  <h2 className="font-bold mb-1" style={{ letterSpacing: '-0.01em', color: textPrimary }}>EDU Verification</h2>
                  {eduVerified === true ? (
                    <div className="flex items-center gap-3 mt-3 p-3 rounded-xl" style={{ background: dm ? 'rgba(52,211,153,0.12)' : '#f0fdf4', border: dm ? '1px solid rgba(52,211,153,0.25)' : '1px solid #bbf7d0' }}>
                      <span className="flex items-center justify-center h-6 w-6 rounded-full flex-shrink-0" style={{background:'#dcfce7'}}><svg className="h-3.5 w-3.5" style={{color:'#16a34a'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: dm ? '#6ee7b7' : '#15803d' }}>EDU Verified</p>
                        <p className="text-xs mt-0.5" style={{ color: textMuted }}>{eduEmail}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs" style={{ color: textMuted }}>Link your .edu email to unlock campus features on the home page.</p>
                      {eduStep === 'email' && (
                        <>
                          <input type="email" value={eduEmail} onChange={e => setEduEmail(e.target.value)} placeholder="you@school.edu" className="form-input" style={{ background: inputBg, color: textPrimary, borderColor: inputBorder }} />
                          {eduError && <p className="text-xs text-red-500">{eduError}</p>}
                          <button disabled={!eduEmail.endsWith('.edu') || eduLoading} onClick={async () => { setEduLoading(true); setEduError(''); try { const sb = getSupabase(); const {data:{session}} = await sb.auth.getSession(); const res = await fetch('/api/verify-edu', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session?.access_token}, body: JSON.stringify({school_email: eduEmail, account_type:'consumer'}) }); const d = await res.json(); if (!res.ok) { setEduError(d.error||'Failed'); } else { setEduStep('code'); } } catch(e) { setEduError('Network error'); } finally { setEduLoading(false); } }} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: eduEmail.endsWith('.edu') ? '#0A84FF' : (dm?'#2c2c2e':'#e5e7eb'), color: eduEmail.endsWith('.edu')?'white':(dm?'#6b7280':'#9ca3af') }}>{eduLoading ? 'Sending…' : 'Send Verification Code'}</button>
                        </>
                      )}
                      {eduStep === 'code' && (
                        <>
                          <p className="text-xs" style={{ color: textMuted }}>Enter the 6-digit code sent to {eduEmail}</p>
                          <input type="text" value={eduCode} onChange={e => setEduCode(e.target.value)} placeholder="123456" maxLength={6} className="form-input text-center text-xl font-bold tracking-[0.2em]" style={{ background: inputBg, color: textPrimary, borderColor: inputBorder }} />
                          {eduError && <p className="text-xs text-red-500">{eduError}</p>}
                          <button disabled={eduCode.length !== 6 || eduLoading} onClick={async () => { setEduLoading(true); setEduError(''); try { const sb = getSupabase(); const {data:{session}} = await sb.auth.getSession(); const res = await fetch('/api/verify-edu', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session?.access_token}, body: JSON.stringify({action:'verify', code: eduCode, account_type:'consumer'}) }); const d = await res.json(); if (!res.ok) { setEduError(d.error||'Wrong code'); } else { setEduVerified(true); setEduStep('done'); } } catch(e) { setEduError('Network error'); } finally { setEduLoading(false); } }} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: eduCode.length===6?'#0A84FF':(dm?'#2c2c2e':'#e5e7eb'), color: eduCode.length===6?'white':(dm?'#6b7280':'#9ca3af') }}>{eduLoading?'Verifying…':'Verify Code'}</button>
                          <button onClick={() => { setEduStep('email'); setEduCode(''); setEduError(''); }} className="w-full text-xs text-center" style={{ color: textMuted }}>← Use a different email</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <span className="sm-eyebrow mb-2 block">Account</span>
                  <h2 className="font-bold mb-4" style={{ letterSpacing: '-0.01em', color: textPrimary }}>Manage</h2>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border" style={{ borderColor: cardBorder }}>
                      <div className="flex items-center gap-2.5">
                        <svg className="h-4 w-4" style={{ color: textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          {darkMode
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                          }
                        </svg>
                        <span className="text-sm font-medium" style={{ color: textPrimary }}>Dark Mode</span>
                      </div>
                      <button onClick={toggleDark}
                        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
                        style={{ background: darkMode ? '#0A84FF' : '#d1d5db' }}>
                        <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                          style={{ transform: darkMode ? 'translateX(20px)' : 'translateX(0px)' }} />
                      </button>
                    </div>
                    <button onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors"
                      style={{ borderColor: cardBorder, color: textPrimary, background: 'transparent' }}>
                      <svg className="h-4 w-4" style={{ color: textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                      Sign Out
                    </button>
                    <div className="pt-3 border-t mt-2" style={{ borderColor: cardBorder }}>
                      <p className="text-xs mb-2 uppercase tracking-wide font-semibold" style={{ color: textMuted }}>Danger Zone</p>
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
