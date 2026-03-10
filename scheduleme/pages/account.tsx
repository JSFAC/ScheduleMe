// pages/account.tsx — Full consumer account page with all essential tabs
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type Tab = 'bookings' | 'addresses' | 'payments' | 'notifications' | 'security' | 'settings';

interface Booking {
  id: string;
  service: string;
  status: string;
  created_at: string;
  business_name?: string;
  scheduled_time?: string;
}

const TABS: { key: Tab; label: string; icon: JSX.Element }[] = [
  {
    key: 'bookings', label: 'Bookings',
    icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  },
  {
    key: 'addresses', label: 'Addresses',
    icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  },
  {
    key: 'payments', label: 'Payment',
    icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
  },
  {
    key: 'notifications', label: 'Notifications',
    icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
  },
  {
    key: 'security', label: 'Security',
    icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
  },
  {
    key: 'settings', label: 'Profile',
    icon: <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  pending:   { bg: 'bg-amber-50 border-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  confirmed: { bg: 'bg-blue-50 border-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500' },
  completed: { bg: 'bg-green-50 border-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  cancelled: { bg: 'bg-red-50 border-red-100',      text: 'text-red-600',    dot: 'bg-red-400' },
};

// Mock saved addresses
const MOCK_ADDRESSES = [
  { id: '1', label: 'Home', address: '2847 Ocean View Dr', city: 'Santa Cruz, CA 95062', default: true },
  { id: '2', label: 'Office', address: '110 Cooper St, Suite 300', city: 'Santa Cruz, CA 95060', default: false },
];

// Mock payment methods
const MOCK_CARDS = [
  { id: '1', brand: 'Visa', last4: '4242', exp: '08/27', default: true },
  { id: '2', brand: 'Mastercard', last4: '8888', exp: '03/26', default: false },
];

// Toggle component
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-5 w-9 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-accent' : 'bg-neutral-200'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

const Account: NextPage = () => {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('bookings');
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    bookingConfirmed: true,
    statusUpdates: true,
    newMatches: false,
    promotions: false,
    sms: true,
    email: true,
    push: false,
  });
  // Address modal
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addresses, setAddresses] = useState(MOCK_ADDRESSES);
  // Card modal
  const [showCardForm, setShowCardForm] = useState(false);
  const [cards, setCards] = useState(MOCK_CARDS);

  useEffect(() => {
    // Check for tab in URL
    if (router.query.tab && TABS.find(t => t.key === router.query.tab)) {
      setTab(router.query.tab as Tab);
    }
  }, [router.query.tab]);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/signin'); return; }
      setUser(session.user);
      setName(session.user.user_metadata?.full_name || '');
      setPhone(session.user.user_metadata?.phone || '');

      try {
        const res = await fetch(`/api/bookings?user_phone=${encodeURIComponent(session.user.phone || '')}`);
        if (res.ok) {
          const data = await res.json();
          setBookings(data.bookings || []);
        }
      } catch {}

      setLoading(false);
      setTimeout(() => setFadeIn(true), 50);
    });
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = getSupabase();
    await supabase.auth.updateUser({ data: { full_name: name, phone } });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  return (
    <>
      <Head>
        <title>My Account — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav />

      <style>{`
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tab-content { animation: tabFadeIn 0.25s ease both; }
      `}</style>

      <main
        className="pt-24 pb-16 bg-neutral-50 min-h-screen"
        style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.4s ease' }}
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">

          {/* Profile Header Card */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-neutral-900 leading-tight">{displayName}</h1>
              <p className="text-neutral-400 text-sm truncate">{user?.email}</p>
              {memberSince && <p className="text-neutral-300 text-xs mt-0.5">Member since {memberSince}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/bookings"
                className="btn-primary text-sm px-4 py-2"
              >
                + New Request
              </Link>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total Bookings', value: bookings.length || '0' },
              { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length || '0' },
              { label: 'Saved Addresses', value: addresses.length },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-white border border-neutral-200 rounded-2xl p-1.5 mb-5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  tab === t.key
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* ── BOOKINGS TAB ── */}
          {tab === 'bookings' && (
            <div key="bookings" className="tab-content space-y-3">
              {bookings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-14 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-7 w-7 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                    </svg>
                  </div>
                  <p className="font-semibold text-neutral-700 mb-1">No bookings yet</p>
                  <p className="text-neutral-400 text-sm mb-6">Your service requests will show up here once you submit one.</p>
                  <Link href="/bookings" className="btn-primary text-sm px-6 py-2.5">Find a Pro →</Link>
                </div>
              ) : (
                <>
                  {/* Filter row */}
                  <div className="flex gap-2 flex-wrap">
                    {['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'].map(f => (
                      <button key={f} className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors">
                        {f}
                      </button>
                    ))}
                  </div>
                  {bookings.map((b) => {
                    const s = STATUS_STYLES[b.status] || STATUS_STYLES.pending;
                    return (
                      <div key={b.id} className="bg-white rounded-2xl border border-neutral-200 px-6 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-neutral-900 mb-0.5">{b.service || 'Service Request'}</p>
                            <p className="text-sm text-neutral-400">
                              {b.business_name && <span className="text-neutral-600 font-medium mr-2">{b.business_name}</span>}
                              {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize flex-shrink-0 ${s.bg} ${s.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {b.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── ADDRESSES TAB ── */}
          {tab === 'addresses' && (
            <div key="addresses" className="tab-content space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="bg-white rounded-2xl border border-neutral-200 px-6 py-5 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-neutral-900 text-sm">{addr.label}</p>
                      {addr.default && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium">Default</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500">{addr.address}</p>
                    <p className="text-sm text-neutral-400">{addr.city}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!addr.default && (
                      <button
                        onClick={() => setAddresses(prev => prev.map(a => ({ ...a, default: a.id === addr.id })))}
                        className="text-xs text-neutral-400 hover:text-accent transition-colors"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => setAddresses(prev => prev.filter(a => a.id !== addr.id))}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {showAddressForm ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <h3 className="font-semibold text-neutral-900 mb-4">Add New Address</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Label (e.g. Home, Office)</label>
                      <input type="text" className="form-input" placeholder="Home" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Street Address</label>
                      <input type="text" className="form-input" placeholder="123 Main St" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">City, State ZIP</label>
                      <input type="text" className="form-input" placeholder="Austin, TX 78701" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setAddresses(prev => [...prev, { id: Date.now().toString(), label: 'New Address', address: '123 Main St', city: 'Austin, TX', default: false }]);
                          setShowAddressForm(false);
                        }}
                        className="btn-primary text-sm px-5 py-2"
                      >
                        Save Address
                      </button>
                      <button onClick={() => setShowAddressForm(false)} className="text-sm text-neutral-400 hover:text-neutral-700 px-4 py-2">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddressForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-accent hover:text-accent transition-colors text-sm font-medium"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Address
                </button>
              )}
            </div>
          )}

          {/* ── PAYMENTS TAB ── */}
          {tab === 'payments' && (
            <div key="payments" className="tab-content space-y-3">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-start gap-3">
                <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-blue-800">ScheduleMe is free for users</p>
                  <p className="text-sm text-blue-600 mt-0.5">Payment methods are used for premium same-day services when available in your area.</p>
                </div>
              </div>

              {cards.map((card) => (
                <div key={card.id} className="bg-white rounded-2xl border border-neutral-200 px-6 py-5 flex items-center gap-4">
                  <div className="h-10 w-14 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{card.brand}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-neutral-900 text-sm">•••• {card.last4}</p>
                      {card.default && <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium">Default</span>}
                    </div>
                    <p className="text-xs text-neutral-400">Expires {card.exp}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!card.default && (
                      <button onClick={() => setCards(prev => prev.map(c => ({ ...c, default: c.id === card.id })))}
                        className="text-xs text-neutral-400 hover:text-accent transition-colors">
                        Set default
                      </button>
                    )}
                    <button onClick={() => setCards(prev => prev.filter(c => c.id !== card.id))}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors">
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {showCardForm ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <h3 className="font-semibold text-neutral-900 mb-4">Add Payment Method</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Card Number</label>
                      <input type="text" className="form-input" placeholder="1234 5678 9012 3456" maxLength={19} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Expiry</label>
                        <input type="text" className="form-input" placeholder="MM/YY" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">CVV</label>
                        <input type="text" className="form-input" placeholder="•••" maxLength={4} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Name on Card</label>
                      <input type="text" className="form-input" placeholder="Jane Smith" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setCards(prev => [...prev, { id: Date.now().toString(), brand: 'Visa', last4: '0000', exp: '12/28', default: false }]);
                          setShowCardForm(false);
                        }}
                        className="btn-primary text-sm px-5 py-2"
                      >
                        Add Card
                      </button>
                      <button onClick={() => setShowCardForm(false)} className="text-sm text-neutral-400 hover:text-neutral-700 px-4 py-2">Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCardForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-accent hover:text-accent transition-colors text-sm font-medium"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Payment Method
                </button>
              )}
            </div>
          )}

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === 'notifications' && (
            <div key="notifications" className="tab-content space-y-4">
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-1">Activity Alerts</h2>
                <p className="text-sm text-neutral-400 mb-5">Choose what you want to be notified about.</p>
                <div className="space-y-4">
                  {([
                    { key: 'bookingConfirmed', label: 'Booking confirmations', desc: 'When a business confirms your request' },
                    { key: 'statusUpdates',    label: 'Status updates',        desc: 'When your booking status changes' },
                    { key: 'newMatches',       label: 'New pro matches',       desc: 'When new pros become available in your area' },
                    { key: 'promotions',       label: 'Offers & promotions',   desc: 'Occasional deals from local businesses' },
                  ] as const).map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{item.label}</p>
                        <p className="text-xs text-neutral-400">{item.desc}</p>
                      </div>
                      <Toggle
                        checked={notifPrefs[item.key]}
                        onChange={() => setNotifPrefs(p => ({ ...p, [item.key]: !p[item.key] }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-1">Delivery Channels</h2>
                <p className="text-sm text-neutral-400 mb-5">How you'd like to receive notifications.</p>
                <div className="space-y-4">
                  {([
                    { key: 'email', label: 'Email',           desc: user?.email || 'Your email address', icon: '✉️' },
                    { key: 'sms',   label: 'Text (SMS)',       desc: phone || 'Add a phone number in Profile', icon: '💬' },
                    { key: 'push',  label: 'Push notifications', desc: 'Browser & mobile push', icon: '🔔' },
                  ] as const).map(ch => (
                    <div key={ch.key} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{ch.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-neutral-800">{ch.label}</p>
                          <p className="text-xs text-neutral-400 truncate max-w-[220px]">{ch.desc}</p>
                        </div>
                      </div>
                      <Toggle
                        checked={notifPrefs[ch.key]}
                        onChange={() => setNotifPrefs(p => ({ ...p, [ch.key]: !p[ch.key] }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {tab === 'security' && (
            <div key="security" className="tab-content space-y-4">
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-1">Password</h2>
                <p className="text-sm text-neutral-400 mb-5">Keep your account secure with a strong password.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1.5">Current Password</label>
                    <input type="password" className="form-input" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1.5">New Password</label>
                    <input type="password" className="form-input" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1.5">Confirm New Password</label>
                    <input type="password" className="form-input" placeholder="••••••••" />
                  </div>
                  <button className="btn-primary text-sm px-5 py-2.5 mt-1">Update Password</button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-1">Sign-in Activity</h2>
                <p className="text-sm text-neutral-400 mb-5">Recent devices and sessions.</p>
                <div className="space-y-3">
                  {[
                    { device: 'MacBook Pro — Chrome', location: 'Santa Cruz, CA', time: 'Active now', current: true },
                    { device: 'iPhone — Safari',       location: 'Santa Cruz, CA', time: '2 hours ago',   current: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-50 last:border-0">
                      <div className="h-9 w-9 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
                        <svg className="h-4.5 w-4.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          {s.device.includes('iPhone')
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 15h3" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                          }
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-800">{s.device}</p>
                        <p className="text-xs text-neutral-400">{s.location} · {s.time}</p>
                      </div>
                      {s.current ? (
                        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-lg flex-shrink-0">Current</span>
                      ) : (
                        <button className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0">Revoke</button>
                      )}
                    </div>
                  ))}
                </div>
                <button className="mt-3 text-sm text-red-400 hover:text-red-600 transition-colors">
                  Sign out all other sessions
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-1">Two-Factor Authentication</h2>
                <p className="text-sm text-neutral-400 mb-5">Add an extra layer of security to your account.</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-700">Authenticator App</p>
                    <p className="text-xs text-neutral-400">Use Google Authenticator or similar</p>
                  </div>
                  <button className="text-sm font-medium text-accent hover:underline">Enable →</button>
                </div>
              </div>
            </div>
          )}

          {/* ── PROFILE SETTINGS TAB ── */}
          {tab === 'settings' && (
            <div key="settings" className="tab-content grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-5">Personal Info</h2>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1.5">Full name</label>
                    <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1.5">Email address</label>
                    <input type="email" className="form-input bg-neutral-50 cursor-not-allowed" value={user?.email || ''} disabled />
                    <p className="text-xs text-neutral-400 mt-1">Email cannot be changed here. Contact support.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1.5">Phone number</label>
                    <input type="tel" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-1234" />
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
                  <h2 className="font-bold text-neutral-900 mb-4">Account Actions</h2>
                  <div className="space-y-3">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors"
                    >
                      <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                      Sign Out
                    </button>
                    <div className="pt-2 border-t border-neutral-100">
                      <p className="text-xs text-neutral-400 mb-2">Danger Zone</p>
                      <button className="w-full text-left text-sm text-red-500 hover:text-red-700 transition-colors px-4 py-2.5 rounded-xl hover:bg-red-50">
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
