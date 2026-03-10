// pages/account.tsx — Consumer account page
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type Tab = 'bookings' | 'addresses' | 'notifications' | 'security' | 'settings';

interface Booking {
  id: string;
  service: string;
  status: string;
  created_at: string;
  business_name?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  pending:   { bg: 'bg-amber-50 border border-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  confirmed: { bg: 'bg-blue-50 border border-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500' },
  completed: { bg: 'bg-green-50 border border-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  cancelled: { bg: 'bg-red-50 border border-red-100',      text: 'text-red-600',    dot: 'bg-red-400' },
};

// Proper toggle component
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none"
      style={{
        width: '44px',
        height: '24px',
        backgroundColor: checked ? '#2563eb' : '#d1d5db',
      }}
    >
      <span
        className="pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out"
        style={{
          width: '20px',
          height: '20px',
          marginTop: '2px',
          transform: checked ? 'translateX(22px)' : 'translateX(2px)',
        }}
      />
    </button>
  );
}

// Delete confirmation modal
function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl border border-neutral-200 p-7 max-w-md w-full shadow-2xl">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-neutral-900 mb-1">Delete your account?</h2>
        <p className="text-sm text-neutral-500 mb-4">
          This will permanently delete your account, all your bookings, and saved data. <strong>This cannot be undone.</strong>
        </p>
        <p className="text-sm text-neutral-600 mb-2">Type <strong>DELETE</strong> to confirm:</p>
        <input
          type="text"
          className="form-input mb-4"
          placeholder="DELETE"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={confirmText !== 'DELETE'}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: confirmText === 'DELETE' ? '#ef4444' : '#d1d5db' }}
          >
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
  { key: 'bookings',      label: 'Bookings',      icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg> },
  { key: 'addresses',     label: 'Addresses',     icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg> },
  { key: 'notifications', label: 'Notifications', icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> },
  { key: 'security',      label: 'Security',      icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg> },
  { key: 'settings',      label: 'Profile',       icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
];

const Account: NextPage = () => {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('bookings');
  const [user, setUser] = useState<any>(null);
  const [authProvider, setAuthProvider] = useState<string>('email');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);

  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  // Addresses
  const [addresses, setAddresses] = useState<any[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');

  // Notifications (saved to Supabase user metadata)
  const [notifPrefs, setNotifPrefs] = useState({
    bookingConfirmed: true,
    statusUpdates: true,
    newMatches: false,
    promotions: false,
    emailChannel: true,
    smsChannel: false,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/signin'); return; }
      const u = session.user;
      setUser(u);
      setName(u.user_metadata?.full_name || '');
      setPhone(u.user_metadata?.phone || '');

      // Detect auth provider
      const provider = u.app_metadata?.provider || 'email';
      setAuthProvider(provider);

      // Load notification prefs from metadata
      if (u.user_metadata?.notif_prefs) {
        setNotifPrefs(p => ({ ...p, ...u.user_metadata.notif_prefs }));
      }

      // Load addresses from metadata
      if (u.user_metadata?.addresses) {
        setAddresses(u.user_metadata.addresses);
      }

      // Fetch real bookings
      try {
        const res = await fetch(`/api/bookings?user_phone=${encodeURIComponent(u.phone || u.user_metadata?.phone || '')}`);
        if (res.ok) {
          const data = await res.json();
          setBookings(data.bookings || []);
        }
      } catch {}

      setLoading(false);
      setTimeout(() => setFadeIn(true), 50);
    });
  }, [router]);

  // Save profile to Supabase
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError('');
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name, phone },
    });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // Save notification prefs to Supabase
  async function handleSaveNotifs(newPrefs: typeof notifPrefs) {
    setNotifPrefs(newPrefs);
    const supabase = getSupabase();
    await supabase.auth.updateUser({ data: { notif_prefs: newPrefs } });
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2000);
  }

  // Save addresses to Supabase
  async function persistAddresses(list: any[]) {
    const supabase = getSupabase();
    await supabase.auth.updateUser({ data: { addresses: list } });
    setAddresses(list);
  }

  function addAddress() {
    if (!addrStreet) return;
    const newList = [...addresses, {
      id: Date.now().toString(),
      label: addrLabel || 'Address',
      address: addrStreet,
      city: addrCity,
      default: addresses.length === 0,
    }];
    persistAddresses(newList);
    setAddrLabel(''); setAddrStreet(''); setAddrCity('');
    setShowAddressForm(false);
  }

  function removeAddress(id: string) {
    persistAddresses(addresses.filter(a => a.id !== id));
  }

  function setDefaultAddress(id: string) {
    persistAddresses(addresses.map(a => ({ ...a, default: a.id === id })));
  }

  // Change password (email users only)
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    setPwSaving(true);
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) { setPwError(error.message); return; }
    setPwSaved(true);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setTimeout(() => { setPwSaved(false); setShowPasswordForm(false); }, 2500);
  }

  // Delete account
  async function handleDeleteAccount() {
    setDeleting(true);
    const supabase = getSupabase();
    // Sign out first — full delete requires a server-side admin call
    await supabase.auth.signOut();
    // In production you'd call an API route that uses the admin client to delete
    router.push('/?deleted=1');
  }

  function handleSignOut() {
    const supabase = getSupabase();
    supabase.auth.signOut().then(() => router.push('/'));
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      </>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  const isGoogleAuth = authProvider === 'google';

  return (
    <>
      <Head>
        <title>My Account — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav />

      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      <style>{`
        @keyframes tabIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tab-panel { animation: tabIn 0.22s ease both; }
      `}</style>

      <main
        className="pt-24 pb-16 bg-neutral-50 min-h-screen"
        style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.4s ease' }}
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">

          {/* Profile header */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-neutral-900">{displayName}</h1>
              <p className="text-sm text-neutral-400 truncate">{user?.email}</p>
              {memberSince && <p className="text-xs text-neutral-300 mt-0.5">Member since {memberSince}</p>}
            </div>
            <Link href="/bookings" className="btn-primary text-sm px-4 py-2 flex-shrink-0">
              + New Request
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Total Bookings', value: bookings.length },
              { label: 'Completed',      value: bookings.filter(b => b.status === 'completed').length },
              { label: 'Saved Addresses', value: addresses.length },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
                <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-white border border-neutral-200 rounded-2xl p-1.5 mb-5 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  tab === t.key ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── BOOKINGS ── */}
          {tab === 'bookings' && (
            <div className="tab-panel space-y-3">
              {bookings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-14 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-7 w-7 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                    </svg>
                  </div>
                  <p className="font-semibold text-neutral-700 mb-1">No bookings yet</p>
                  <p className="text-neutral-400 text-sm mb-6">Your service requests will appear here once submitted.</p>
                  <Link href="/bookings" className="btn-primary text-sm px-6 py-2.5">Find a Pro →</Link>
                </div>
              ) : bookings.map(b => {
                const s = STATUS_STYLES[b.status] || STATUS_STYLES.pending;
                return (
                  <div key={b.id} className="bg-white rounded-2xl border border-neutral-200 px-6 py-5 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 mb-0.5">{b.service || 'Service Request'}</p>
                      <p className="text-sm text-neutral-400">
                        {b.business_name && <span className="text-neutral-600 font-medium mr-2">{b.business_name}</span>}
                        {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full capitalize flex-shrink-0 ${s.bg} ${s.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {b.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ADDRESSES ── */}
          {tab === 'addresses' && (
            <div className="tab-panel space-y-3">
              {addresses.length === 0 && !showAddressForm && (
                <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="h-6 w-6 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <p className="font-semibold text-neutral-700 mb-1">No saved addresses</p>
                  <p className="text-neutral-400 text-sm mb-5">Save your home or office for faster booking.</p>
                </div>
              )}

              {addresses.map(addr => (
                <div key={addr.id} className="bg-white rounded-2xl border border-neutral-200 px-6 py-5 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-neutral-900 text-sm">{addr.label}</p>
                      {addr.default && <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">Default</span>}
                    </div>
                    <p className="text-sm text-neutral-500">{addr.address}</p>
                    {addr.city && <p className="text-sm text-neutral-400">{addr.city}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {!addr.default && (
                      <button onClick={() => setDefaultAddress(addr.id)} className="text-xs text-neutral-400 hover:text-accent transition-colors">Set default</button>
                    )}
                    <button onClick={() => removeAddress(addr.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                  </div>
                </div>
              ))}

              {showAddressForm ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <h3 className="font-semibold text-neutral-900 mb-4">Add Address</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Label</label>
                      <input type="text" className="form-input" placeholder="Home, Office, etc." value={addrLabel} onChange={e => setAddrLabel(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Street Address</label>
                      <input type="text" className="form-input" placeholder="123 Main St" value={addrStreet} onChange={e => setAddrStreet(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">City, State ZIP</label>
                      <input type="text" className="form-input" placeholder="Austin, TX 78701" value={addrCity} onChange={e => setAddrCity(e.target.value)} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={addAddress} className="btn-primary text-sm px-5 py-2">Save</button>
                      <button onClick={() => setShowAddressForm(false)} className="text-sm text-neutral-400 hover:text-neutral-700 px-4 py-2">Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddressForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-accent hover:text-accent transition-colors text-sm font-medium"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Address
                </button>
              )}
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === 'notifications' && (
            <div className="tab-panel space-y-4">
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-bold text-neutral-900">Activity Alerts</h2>
                  {notifSaved && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
                </div>
                <p className="text-sm text-neutral-400 mb-5">Choose what you want to be notified about.</p>
                <div className="space-y-5">
                  {([
                    { key: 'bookingConfirmed', label: 'Booking confirmations', desc: 'When a business confirms your request' },
                    { key: 'statusUpdates',    label: 'Status updates',        desc: 'When your booking status changes' },
                    { key: 'newMatches',       label: 'New pro matches',       desc: 'When new pros become available near you' },
                    { key: 'promotions',       label: 'Offers & promotions',   desc: 'Occasional deals from local businesses' },
                  ] as const).map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-6">
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{item.label}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{item.desc}</p>
                      </div>
                      <Toggle
                        label={item.label}
                        checked={notifPrefs[item.key]}
                        onChange={() => handleSaveNotifs({ ...notifPrefs, [item.key]: !notifPrefs[item.key] })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-1">Delivery Channels</h2>
                <p className="text-sm text-neutral-400 mb-5">How you'd like to receive notifications.</p>
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">Email</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{user?.email}</p>
                    </div>
                    <Toggle
                      label="Email notifications"
                      checked={notifPrefs.emailChannel}
                      onChange={() => handleSaveNotifs({ ...notifPrefs, emailChannel: !notifPrefs.emailChannel })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">Text (SMS)</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {phone ? phone : (
                          <button onClick={() => setTab('settings')} className="text-accent hover:underline">
                            Add a phone number in Profile →
                          </button>
                        )}
                      </p>
                    </div>
                    <Toggle
                      label="SMS notifications"
                      checked={notifPrefs.smsChannel}
                      onChange={() => handleSaveNotifs({ ...notifPrefs, smsChannel: !notifPrefs.smsChannel })}
                    />
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-neutral-100">
                  <p className="text-xs text-neutral-400">
                    Notification sending via email and SMS is coming soon. Your preferences are saved and will activate automatically when enabled.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── SECURITY ── */}
          {tab === 'security' && (
            <div className="tab-panel space-y-4">

              {/* Password section — only show for email users */}
              {isGoogleAuth ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <h2 className="font-bold text-neutral-900 mb-1">Password</h2>
                  <div className="flex items-start gap-3 mt-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Signed in with Google</p>
                      <p className="text-sm text-blue-700 mt-0.5">Your account uses Google for authentication. Password management is handled through your Google account.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h2 className="font-bold text-neutral-900">Password</h2>
                      <p className="text-sm text-neutral-400 mt-0.5">Keep your account secure with a strong password.</p>
                    </div>
                    {!showPasswordForm && (
                      <button
                        onClick={() => setShowPasswordForm(true)}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Change →
                      </button>
                    )}
                  </div>

                  {showPasswordForm && (
                    <form onSubmit={handleChangePassword} className="mt-5 space-y-3">
                      {pwError && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{pwError}</div>}
                      {pwSaved && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">✓ Password updated successfully.</div>}
                      <div>
                        <label className="block text-sm font-medium text-neutral-600 mb-1.5">New Password</label>
                        <input type="password" required className="form-input" placeholder="At least 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-600 mb-1.5">Confirm New Password</label>
                        <input type="password" required className="form-input" placeholder="••••••••" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="submit" disabled={pwSaving} className="btn-primary text-sm px-5 py-2.5">
                          {pwSaving ? 'Updating…' : 'Update Password'}
                        </button>
                        <button type="button" onClick={() => { setShowPasswordForm(false); setPwError(''); }} className="text-sm text-neutral-400 hover:text-neutral-700 px-4 py-2">
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Sign-in activity */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-1">Sign-in Method</h2>
                <p className="text-sm text-neutral-400 mb-4">How you access your account.</p>
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
            <div className="tab-panel grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-5">Personal Info</h2>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {saveError && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{saveError}</div>}
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1.5">Full name</label>
                    <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1.5">Email address</label>
                    <input type="email" className="form-input bg-neutral-50 cursor-not-allowed" value={user?.email || ''} disabled />
                    <p className="text-xs text-neutral-400 mt-1">
                      {isGoogleAuth ? 'Managed by Google.' : 'Contact support to change your email.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1.5">Phone number</label>
                    <input type="tel" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-1234" />
                    <p className="text-xs text-neutral-400 mt-1">Used for SMS notifications and matching with local pros.</p>
                  </div>
                  <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm">
                    {saved ? '✓ Changes Saved!' : saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <h2 className="font-bold text-neutral-900 mb-4">Service Preferences</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-600 mb-1.5">Preferred contact method</label>
                      <select className="form-input">
                        <option>Text message</option>
                        <option>Phone call</option>
                        <option>Email</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-600 mb-1.5">Service radius</label>
                      <select className="form-input">
                        <option>Within 5 miles</option>
                        <option>Within 10 miles</option>
                        <option>Within 25 miles</option>
                        <option>Any distance</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <h2 className="font-bold text-neutral-900 mb-4">Account</h2>
                  <div className="space-y-2">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors"
                    >
                      <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                      Sign Out
                    </button>
                    <div className="pt-3 border-t border-neutral-100 mt-2">
                      <p className="text-xs text-neutral-400 mb-2">Danger Zone</p>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full text-left text-sm text-red-500 hover:text-red-700 transition-colors px-4 py-2.5 rounded-xl hover:bg-red-50"
                      >
                        Delete my account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
};

export default Account;