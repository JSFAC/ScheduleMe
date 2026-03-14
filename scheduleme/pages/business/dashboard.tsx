// pages/business/dashboard.tsx — ScheduleMe Business Dashboard
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useDarkMode } from '../../lib/useDarkMode';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type TabId = 'overview' | 'bookings' | 'messages' | 'clients' | 'calendar' | 'settings';

interface Booking {
  id: string; service: string; status: string; created_at: string;
  scheduled_at?: string; amount_cents: number | null; paid_at: string | null;
  notes?: string; address?: string;
  users: { name: string; phone: string; email: string } | null;
}
interface Business {
  id: string; name: string; owner_name: string; owner_email: string;
  phone?: string; description?: string;
  stripe_account_id: string | null; stripe_onboarded: boolean;
  service_tags: string[]; address: string; rating: number | null;
  is_onboarded: boolean; website?: string; instagram?: string;
}

const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  pending:         { label: 'Pending',         dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  confirmed:       { label: 'Confirmed',       dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  paid:            { label: 'Paid',            dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  payment_pending: { label: 'Pmt Pending',     dot: 'bg-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  payment_failed:  { label: 'Pmt Failed',      dot: 'bg-red-500',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  completed:       { label: 'Completed',       dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  cancelled:       { label: 'Cancelled',       dot: 'bg-neutral-400', bg: 'bg-neutral-100',text: 'text-neutral-500', border: 'border-neutral-200' },
};

const NAV: { id: TabId; label: string; d: string }[] = [
  { id: 'overview',  label: 'Overview',  d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'bookings',  label: 'Bookings',  d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id: 'messages',  label: 'Messages',  d: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
  { id: 'clients',   label: 'Clients',   d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'calendar',  label: 'Calendar',  d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'settings',  label: 'Settings',  d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

function fmt(cents: number) { return '$' + (cents / 100).toFixed(2); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtTime(d: string) { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

function RevenueChart({ bookings }: { bookings: Booking[] }) {
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (7 - i) * 7);
    const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    const earned = bookings.filter(b => (b.status === 'paid' || b.status === 'completed') && b.amount_cents)
      .filter(b => { const bd = new Date(b.created_at); return bd >= ws && bd <= we; })
      .reduce((s, b) => s + (b.amount_cents || 0), 0);
    return { label: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), earned };
  });
  const max = Math.max(...weeks.map(w => w.earned), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {weeks.map((w, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-md transition-all duration-500"
            style={{ height: Math.max((w.earned / max) * 88, w.earned > 0 ? 6 : 2) + 'px', background: w.earned > 0 ? '#0A84FF' : '#e5e7eb' }} />
          {w.earned > 0 && <span className="text-[9px] text-neutral-400 whitespace-nowrap">{w.label}</span>}
        </div>
      ))}
    </div>
  );
}

const BusinessDashboard: NextPage = () => {
  const router = useRouter();
  const { dark: darkMode, toggle: toggleDark } = useDarkMode();
  const [tab, setTab] = useState<TabId>('overview');
  const [business, setBusiness] = useState<Business | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [bkFilter, setBkFilter] = useState<'all'|'pending'|'active'|'completed'|'cancelled'>('all');

  // Messages state
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [msgDraft, setMsgDraft] = useState('');
  const msgPollRef = useRef<NodeJS.Timeout | null>(null);
  const [msgThreads, setMsgThreads] = useState<any[]>([]);
  const [activeMsgThread, setActiveMsgThread] = useState<any>(null);
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const msgBottomRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLTextAreaElement>(null);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editServices, setEditServices] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const loadData = useCallback(async () => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/business/auth/login'); return; }
    const { data: biz } = await supabase.from('businesses').select('*').eq('owner_email', session.user.email).single();
    if (!biz) { router.push('/business/auth/login'); return; }
    setBusiness(biz);
    setEditName(biz.name || ''); setEditPhone(biz.phone || ''); setEditAddress(biz.address || '');
    setEditDesc(biz.description || ''); setEditWebsite(biz.website || '');
    setEditServices((biz.service_tags || []).join(', '));
    const { data: bkgs } = await supabase.from('bookings').select('*, users(name, phone, email)').eq('business_id', biz.id).order('created_at', { ascending: false });
    setBookings(bkgs || []);
    // Pre-load message threads
    const msgsRes = await fetch('/api/messages?business_id=' + biz.id);
    if (msgsRes.ok) { const md = await msgsRes.json(); setMsgThreads(md.threads || []); }
    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); if (router.query.stripe === 'success') loadData(); }, [loadData, router.query]);

  // Load message threads when on messages tab
  useEffect(() => {
    if (tab !== 'messages' || !business) return;
    loadThreads();
  }, [tab, business]);

  // Poll active thread
  useEffect(() => {
    if (!selectedThread) return;
    loadThreadMessages(selectedThread);
    if (msgPollRef.current) clearInterval(msgPollRef.current);
    msgPollRef.current = setInterval(() => loadThreadMessages(selectedThread), 5000);
    return () => { if (msgPollRef.current) clearInterval(msgPollRef.current); };
  }, [selectedThread]);

  useEffect(() => {
    msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  async function loadThreads() {
    if (!business) return;
    const res = await fetch('/api/messages?business_id=' + business.id);
    if (res.ok) { const d = await res.json(); setThreads(d.threads || []); }
  }

  async function loadThreadMessages(bookingId: string) {
    const res = await fetch('/api/messages?booking_id=' + bookingId);
    if (res.ok) { const d = await res.json(); setThreadMessages(d.messages || []); }
  }

  async function sendBusinessMessage() {
    if (!msgDraft.trim() || !selectedThread || msgSending) return;
    setMsgSending(true);
    const text = msgDraft.trim(); setMsgDraft('');
    const res = await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: selectedThread, sender_type: 'business', content: text }),
    });
    if (res.ok) { const d = await res.json(); setThreadMessages(m => [...m, d.message]); }
    setMsgSending(false);
  }

  async function handleStripeConnect() {
    if (!business) return; setStripeLoading(true);
    try {
      const res = await fetch('/api/stripe-connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: business.id }) });
      const data = await res.json(); if (data.url) window.location.href = data.url;
    } catch { alert('Failed to connect Stripe.'); } finally { setStripeLoading(false); }
  }

  async function handleUpdateBooking(id: string, status: string) {
    await getSupabase().from('bookings').update({ status }).eq('id', id);
    setBookings(b => b.map(bk => bk.id === id ? { ...bk, status } : bk));
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault(); if (!business) return;
    setSettingsSaving(true); setSettingsError('');
    const tags = editServices.split(',').map(s => s.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
    const { error } = await getSupabase().from('businesses').update({ name: editName, phone: editPhone, address: editAddress, description: editDesc, website: editWebsite, service_tags: tags }).eq('id', business.id);
    setSettingsSaving(false);
    if (error) { setSettingsError(error.message); return; }
    setBusiness(b => b ? { ...b, name: editName, phone: editPhone, address: editAddress, description: editDesc, website: editWebsite, service_tags: tags } : b);
    setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2500);
  }

  async function handleSignOut() { await getSupabase().auth.signOut(); router.push('/business/auth/login'); }

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full border-2 border-neutral-200" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
    </div>
  );

  const totalEarned = bookings.filter(b => b.status === 'paid' || b.status === 'completed').reduce((s, b) => s + (b.amount_cents || 0), 0);
  const totalUnreadMsgs = msgThreads.reduce((s: number, t: any) => s + (t.unreadCount || 0), 0);
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const completedCount = bookings.filter(b => b.status === 'completed' || b.status === 'paid').length;
  const uniqueClients = new Set(bookings.map(b => b.users?.email).filter(Boolean)).size;
  const thisMonthEarned = bookings.filter(b => (b.status === 'paid' || b.status === 'completed') && b.amount_cents && new Date(b.created_at).getMonth() === new Date().getMonth()).reduce((s, b) => s + (b.amount_cents || 0), 0);

  const filteredBookings = bookings.filter(b => {
    if (bkFilter === 'all') return true;
    if (bkFilter === 'pending') return b.status === 'pending';
    if (bkFilter === 'active') return b.status === 'confirmed';
    if (bkFilter === 'completed') return b.status === 'completed' || b.status === 'paid';
    if (bkFilter === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const bookingDates = new Map<number, number>();
  bookings.filter(b => b.status !== 'cancelled').forEach(b => { const day = new Date(b.created_at).getDate(); bookingDates.set(day, (bookingDates.get(day) || 0) + 1); });

  const clientMap = new Map<string, { name: string; email: string; phone: string; bookingCount: number; totalSpent: number; lastBooking: string }>();
  bookings.forEach(b => {
    if (!b.users?.email) return;
    const ex = clientMap.get(b.users.email);
    if (ex) { ex.bookingCount++; ex.totalSpent += b.amount_cents || 0; if (b.created_at > ex.lastBooking) ex.lastBooking = b.created_at; }
    else clientMap.set(b.users.email, { name: b.users.name, email: b.users.email, phone: b.users.phone, bookingCount: 1, totalSpent: b.amount_cents || 0, lastBooking: b.created_at });
  });
  const clients = Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  const initials = (business?.name || 'B').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      <Head><title>{business?.name || 'Dashboard'} — ScheduleMe for Business</title></Head>
      <div className="min-h-screen flex" style={{ background: 'var(--section-bg, #f8fafc)' }}>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white border-r border-neutral-100 fixed left-0 top-0 bottom-0 z-30">
          <div className="px-5 py-5 border-b border-neutral-100">
            <Link href="/business">
              <span className="text-[17px] font-black text-neutral-900" style={{ letterSpacing: '-0.03em' }}>ScheduleMe</span>
              <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-accent mt-0.5">for Business</span>
            </Link>
          </div>
          <div className="px-4 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
                style={{ background: 'linear-gradient(135deg, #0A84FF 0%, #0055CC 100%)' }}>{initials}</div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-900 truncate">{business?.name}</p>
                <p className="text-[10px] text-neutral-400 truncate">{business?.owner_email}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV.map(item => (
              <button key={item.id} onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${tab === item.id ? 'bg-accent text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={tab === item.id ? 2.5 : 1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.d} />
                </svg>
                {item.label}
                {item.id === 'bookings' && pendingCount > 0 && (
                  <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === item.id ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'}`}>{pendingCount}</span>
                )}
                {item.id === 'messages' && totalUnreadMsgs > 0 && (
                  <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === item.id ? 'bg-white/25 text-white' : 'bg-accent/10 text-accent'}`}>{totalUnreadMsgs}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-neutral-100 space-y-1">
            {/* Dark mode toggle */}
            <button onClick={toggleDark} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  {darkMode
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  }
                </svg>
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </div>
              <div className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors"
                style={{ background: darkMode ? '#0A84FF' : '#d1d5db' }}>
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                  style={{ transform: darkMode ? 'translateX(16px)' : 'translateX(0)' }} />
              </div>
            </button>
            <Link href="/" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              Consumer site
            </Link>
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
          {/* Mobile topbar */}
          <header className="lg:hidden bg-white border-b border-neutral-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
            <span className="text-base font-black text-neutral-900" style={{ letterSpacing: '-0.02em' }}>{business?.name}</span>
            <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="p-2 rounded-lg hover:bg-neutral-50">
              <svg className="h-5 w-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileNavOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
              </svg>
            </button>
          </header>
          {mobileNavOpen && (
            <div className="lg:hidden bg-white border-b border-neutral-100 px-4 pb-4">
              <div className="flex flex-wrap gap-1.5 pt-3">
                {NAV.map(item => (
                  <button key={item.id} onClick={() => { setTab(item.id); setMobileNavOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${tab === item.id ? 'bg-accent text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                    {item.label}
                    {item.id === 'bookings' && pendingCount > 0 && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === item.id ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'}`}>{pendingCount}</span>}
                    {item.id === 'messages' && totalUnreadMsgs > 0 && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === item.id ? 'bg-white/25 text-white' : 'bg-accent/10 text-accent'}`}>{totalUnreadMsgs}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stripe banner */}
          {business && !business.stripe_onboarded && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto">
                <div className="flex items-center gap-2.5 text-sm">
                  <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <span className="text-amber-800"><strong>Connect your bank account</strong> to start receiving payments.</span>
                </div>
                <button onClick={handleStripeConnect} disabled={stripeLoading} className="shrink-0 text-sm font-bold px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                  {stripeLoading ? 'Loading…' : 'Connect Stripe →'}
                </button>
              </div>
            </div>
          )}

          <main className="flex-1 px-6 py-7 max-w-5xl mx-auto w-full">
            <div className="mb-7">
              <h1 className="text-[1.5rem] font-black text-neutral-900" style={{ letterSpacing: '-0.025em' }}>{NAV.find(n => n.id === tab)?.label}</h1>
              {tab === 'overview' && <p className="text-sm text-neutral-400 mt-0.5">Welcome back, {business?.owner_name?.split(' ')[0] || 'there'}</p>}
              {tab === 'bookings' && <p className="text-sm text-neutral-400 mt-0.5">{bookings.length} total · {pendingCount} need attention</p>}
              {tab === 'clients' && <p className="text-sm text-neutral-400 mt-0.5">{clients.length} unique clients served</p>}
            {tab === 'messages' && <p className="text-sm text-neutral-400 mt-0.5">{threads.length} conversation{threads.length !== 1 ? 's' : ''}</p>}
            </div>

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Earned', value: fmt(totalEarned), sub: 'after 12% commission', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: '#10b981', bg: 'bg-emerald-50' },
                    { label: 'This Month', value: fmt(thisMonthEarned), sub: new Date().toLocaleDateString('en-US',{month:'long'}), icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5', color: '#0A84FF', bg: 'bg-blue-50' },
                    { label: 'Pending', value: String(pendingCount), sub: 'need your action', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', color: '#f59e0b', bg: 'bg-amber-50' },
                    { label: 'Clients', value: String(uniqueClients), sub: completedCount + ' jobs completed', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', color: '#8b5cf6', bg: 'bg-violet-50' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-neutral-100 p-5">
                      <div className={`h-9 w-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: s.color }}><path strokeLinecap="round" strokeLinejoin="round" d={s.icon} /></svg>
                      </div>
                      <p className="text-2xl font-black text-neutral-900" style={{ letterSpacing: '-0.025em' }}>{s.value}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
                      <p className="text-[10px] text-neutral-300 mt-0.5">{s.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div><h2 className="text-sm font-bold text-neutral-900">Revenue</h2><p className="text-xs text-neutral-400 mt-0.5">Past 8 weeks</p></div>
                    <span className="text-xs font-semibold text-neutral-400 bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-100">After commission</span>
                  </div>
                  <RevenueChart bookings={bookings} />
                </div>

                <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-neutral-900">Recent Bookings</h2>
                    <button onClick={() => setTab('bookings')} className="text-xs font-semibold text-accent hover:opacity-70 transition-opacity">View all →</button>
                  </div>
                  {bookings.length === 0
                    ? <div className="px-5 py-10 text-center text-neutral-400 text-sm">No bookings yet.</div>
                    : <div className="divide-y divide-neutral-50">
                        {bookings.slice(0, 5).map(b => (
                          <div key={b.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 truncate">{b.users?.name || 'Unknown'}</p>
                              <p className="text-xs text-neutral-400 mt-0.5 truncate">{b.service} · {fmtDate(b.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {b.amount_cents ? <span className="text-sm font-bold text-neutral-700">{fmt(b.amount_cents)}</span> : null}
                              <StatusBadge status={b.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                  }
                </div>

                <div className="bg-white rounded-2xl border border-neutral-100 p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${business?.stripe_onboarded ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                      <svg className={`h-4 w-4 ${business?.stripe_onboarded ? 'text-emerald-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={business?.stripe_onboarded ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z'} /></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900">Payment Account</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{business?.stripe_onboarded ? 'Bank connected — payments deposit automatically.' : 'Connect your bank to receive payments.'}</p>
                    </div>
                  </div>
                  {business?.stripe_onboarded
                    ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 shrink-0">Connected ✓</span>
                    : <button onClick={handleStripeConnect} disabled={stripeLoading} className="shrink-0 btn-primary text-sm px-4 py-2">{stripeLoading ? 'Loading…' : 'Connect →'}</button>}
                </div>
              </div>
            )}

            {/* BOOKINGS */}
            {tab === 'bookings' && (
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: 'all', label: 'All (' + bookings.length + ')' },
                    { key: 'pending', label: 'Pending (' + bookings.filter(b => b.status === 'pending').length + ')' },
                    { key: 'active', label: 'Confirmed (' + bookings.filter(b => b.status === 'confirmed').length + ')' },
                    { key: 'completed', label: 'Completed (' + bookings.filter(b => b.status === 'completed' || b.status === 'paid').length + ')' },
                    { key: 'cancelled', label: 'Cancelled (' + bookings.filter(b => b.status === 'cancelled').length + ')' },
                  ] as const).map(f => (
                    <button key={f.key} onClick={() => setBkFilter(f.key)}
                      className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all border ${bkFilter === f.key ? 'bg-accent text-white border-accent shadow-sm' : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
                {filteredBookings.length === 0
                  ? <div className="bg-white rounded-2xl border border-neutral-100 py-12 text-center text-neutral-400 text-sm">No bookings in this category.</div>
                  : <div className="space-y-3">
                      {filteredBookings.map(b => (
                        <div key={b.id} className="bg-white rounded-2xl border border-neutral-100 px-5 py-4">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-accent text-sm font-black">{(b.users?.name || '?').charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-neutral-900">{b.users?.name || 'Unknown'}</p>
                                <p className="text-[12px] text-neutral-500 mt-0.5 line-clamp-1">{b.service}</p>
                              </div>
                            </div>
                            <StatusBadge status={b.status} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400 mb-3">
                            <span>📅 {fmtTime(b.created_at)}</span>
                            {b.users?.phone && <span>📞 {b.users.phone}</span>}
                            {b.users?.email && <span>✉ {b.users.email}</span>}
                            {b.amount_cents && <span className="text-neutral-700 font-semibold">{fmt(b.amount_cents)}</span>}
                            {b.address && <span>📍 {b.address}</span>}
                          </div>
                          {b.notes && (
                            <div className="bg-neutral-50 rounded-xl px-3 py-2 text-xs text-neutral-500 mb-3 leading-relaxed">
                              <span className="font-semibold text-neutral-600">Note: </span>{b.notes}
                            </div>
                          )}
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdateBooking(b.id, 'completed')} className="text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">Mark Complete</button>
                              {b.status === 'pending' && <button onClick={() => handleUpdateBooking(b.id, 'confirmed')} className="text-xs font-bold px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">Confirm</button>}
                              <button onClick={() => handleUpdateBooking(b.id, 'cancelled')} className="text-xs font-bold px-3.5 py-2 rounded-xl bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200 transition-colors ml-auto">Cancel</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}

            {/* MESSAGES */}
            {tab === 'messages' && (
              <div className="flex gap-4" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
                {/* Thread list */}
                <div className={`${activeMsgThread ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 shrink-0 bg-white rounded-2xl border border-neutral-100 overflow-hidden`}>
                  <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                    <p className="text-xs font-black text-neutral-400 uppercase tracking-[0.1em]">{msgThreads.length} conversation{msgThreads.length !== 1 ? 's' : ''}</p>
                    {totalUnreadMsgs > 0 && <span className="text-[10px] font-black bg-accent text-white px-2 py-0.5 rounded-full">{totalUnreadMsgs} unread</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                    {msgThreads.length === 0 ? (
                      <div className="p-6 text-center text-neutral-400 text-sm">No conversations yet.</div>
                    ) : msgThreads.map((t: any) => (
                      <button key={t.id} onClick={async () => {
                        setActiveMsgThread(t);
                        setThreadMessages([]);
                        const res = await fetch('/api/messages?booking_id=' + t.id);
                        if (res.ok) { const d = await res.json(); setThreadMessages(d.messages || []); }
                        if (t.unreadCount > 0) {
                          await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: t.id, reader_type: 'business' }) });
                          setMsgThreads((ts: any[]) => ts.map((x: any) => x.id === t.id ? { ...x, unreadCount: 0 } : x));
                        }
                        setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                      }}
                        className={`w-full text-left px-4 py-3.5 border-b border-neutral-50 transition-colors hover:bg-blue-50/50 ${activeMsgThread?.id === t.id ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                              <span className="text-accent text-[10px] font-black">{(t.users?.name || 'U').charAt(0).toUpperCase()}</span>
                            </div>
                            <p className="text-sm font-bold text-neutral-900 truncate">{t.users?.name || 'Unknown customer'}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {t.unreadCount > 0 && <span className="h-4 w-4 rounded-full bg-accent flex items-center justify-center text-[9px] font-black text-white">{t.unreadCount}</span>}
                            {t.lastMessage && <span className="text-[10px] text-neutral-400">{new Date(t.lastMessage.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                          </div>
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate mb-0.5 pl-9">{t.service}</p>
                        {t.lastMessage
                          ? <p className={`text-[11px] truncate pl-9 ${t.unreadCount > 0 ? 'font-semibold text-neutral-700' : 'text-neutral-400'}`}>
                              {t.lastMessage.sender_type === 'business' ? 'You: ' : ''}{t.lastMessage.content}
                            </p>
                          : <p className="text-[11px] text-neutral-300 italic pl-9">No messages yet</p>
                        }
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active thread */}
                {activeMsgThread ? (
                  <div className="flex-1 flex flex-col bg-white rounded-2xl border border-neutral-100 overflow-hidden">
                    {/* Header — customer + booking info */}
                    <div className="px-5 py-3.5 border-b border-neutral-100">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <button onClick={() => setActiveMsgThread(null)} className="lg:hidden p-1.5 rounded-lg hover:bg-neutral-100 mr-1 shrink-0">
                            <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                          </button>
                          <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <span className="text-accent font-black text-sm">{(activeMsgThread.users?.name || 'U').charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-neutral-900">{activeMsgThread.users?.name || 'Unknown'}</p>
                            <p className="text-[11px] text-neutral-400 truncate">{activeMsgThread.users?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {activeMsgThread.users?.phone && (
                            <a href={`tel:${activeMsgThread.users.phone}`} className="text-xs font-semibold text-accent bg-blue-50 px-3 py-1.5 rounded-xl border border-accent/15 hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                              {activeMsgThread.users.phone}
                            </a>
                          )}
                          <button onClick={() => setTab('bookings')} className="text-xs font-semibold text-neutral-500 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition-colors">
                            View booking
                          </button>
                        </div>
                      </div>
                      {/* Booking summary strip */}
                      <div className="mt-3 flex items-center gap-3 px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-neutral-700 truncate">{activeMsgThread.service}</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">{new Date(activeMsgThread.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <StatusBadge status={activeMsgThread.status} />
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'none', background: 'var(--section-bg, #f8fafc)' }}>
                      {threadMessages.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-sm text-neutral-400">No messages yet.</p>
                          <p className="text-xs text-neutral-300 mt-1">Send a message to start the conversation.</p>
                        </div>
                      )}
                      {threadMessages.map((msg: any, i: number) => {
                        const isBiz = msg.sender_type === 'business';
                        const showTime = i === 0 || new Date(msg.created_at).getTime() - new Date(threadMessages[i-1].created_at).getTime() > 300000;
                        return (
                          <div key={msg.id}>
                            {showTime && <p className="text-center text-[10px] text-neutral-400 py-1">{new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>}
                            <div className={`flex ${isBiz ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isBiz ? 'bg-accent text-white rounded-br-md' : 'bg-white text-neutral-800 border border-neutral-200 rounded-bl-md'}`}>
                                {msg.content}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={msgBottomRef} />
                    </div>

                    {/* Input */}
                    <div className="px-4 py-3 border-t border-neutral-100 bg-white">
                      <div className="flex items-end gap-2">
                        <textarea
                          ref={msgInputRef}
                          value={msgInput}
                          onChange={e => setMsgInput(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (!msgInput.trim() || msgSending) return;
                              setMsgSending(true);
                              const content = msgInput.trim(); setMsgInput('');
                              const res = await fetch('/api/messages', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ booking_id: activeMsgThread.id, sender_type: 'business', sender_id: business?.id, content }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setThreadMessages((m: any[]) => [...m, data.message]);
                                setMsgThreads((ts: any[]) => ts.map((t: any) => t.id === activeMsgThread.id ? { ...t, lastMessage: data.message } : t));
                                setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                              }
                              setMsgSending(false);
                              msgInputRef.current?.focus();
                            }
                          }}
                          placeholder={`Reply to ${activeMsgThread.users?.name || 'customer'}…`}
                          rows={1}
                          className="flex-1 resize-none rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all leading-relaxed"
                          style={{ maxHeight: 100 }}
                        />
                        <button
                          disabled={!msgInput.trim() || msgSending}
                          onClick={async () => {
                            if (!msgInput.trim() || msgSending) return;
                            setMsgSending(true);
                            const content = msgInput.trim(); setMsgInput('');
                            const res = await fetch('/api/messages', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ booking_id: activeMsgThread.id, sender_type: 'business', sender_id: business?.id, content }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setThreadMessages((m: any[]) => [...m, data.message]);
                              setMsgThreads((ts: any[]) => ts.map((t: any) => t.id === activeMsgThread.id ? { ...t, lastMessage: data.message } : t));
                              setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                            }
                            setMsgSending(false);
                          }}
                          className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                          style={{ background: msgInput.trim() ? '#0A84FF' : '#e5e7eb' }}>
                          <svg className={`h-4 w-4 ${msgInput.trim() ? 'text-white' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1.5 px-1">↵ to send · Shift+↵ for new line</p>
                    </div>
                  </div>
                ) : (
                  <div className="hidden lg:flex flex-1 items-center justify-center bg-white rounded-2xl border border-neutral-100">
                    <div className="text-center">
                      <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                        <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                      </div>
                      <p className="text-sm font-semibold text-neutral-600">Select a conversation</p>
                      <p className="text-xs text-neutral-400 mt-1">Choose a customer thread to reply</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CLIENTS */}
            {tab === 'clients' && (
              <div className="space-y-3">
                {clients.length === 0
                  ? <div className="bg-white rounded-2xl border border-neutral-100 py-12 text-center text-neutral-400 text-sm">No clients yet.</div>
                  : clients.map(c => {
                      const cb = bookings.filter(b => b.users?.email === c.email);
                      return (
                        <div key={c.email} className="bg-white rounded-2xl border border-neutral-100 px-5 py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                <span className="text-accent font-black text-sm">{c.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-neutral-900">{c.name}</p>
                                <p className="text-xs text-neutral-400 truncate">{c.email}</p>
                                {c.phone && <p className="text-xs text-neutral-400">{c.phone}</p>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-neutral-900">{fmt(c.totalSpent)}</p>
                              <p className="text-xs text-neutral-400">{c.bookingCount} booking{c.bookingCount !== 1 ? 's' : ''}</p>
                              <p className="text-[10px] text-neutral-300 mt-0.5">Last: {fmtDate(c.lastBooking)}</p>
                            </div>
                          </div>
                          {cb.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {cb.slice(0, 3).map(b => (
                                <span key={b.id} className="text-[10px] bg-neutral-50 border border-neutral-100 text-neutral-500 px-2 py-1 rounded-lg">
                                  {b.service.length > 32 ? b.service.slice(0, 32) + '…' : b.service}
                                </span>
                              ))}
                              {cb.length > 3 && <span className="text-[10px] text-neutral-400 py-1">+{cb.length - 3} more</span>}
                            </div>
                          )}
                        </div>
                      );
                    })
                }
              </div>
            )}

            {/* CALENDAR — compact grid left, expanded list right */}
            {tab === 'calendar' && (
              <div className="flex gap-5 items-start">
                {/* Compact calendar */}
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 shrink-0" style={{ width: 300 }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-neutral-900">{today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
                    <span className="text-xs text-neutral-400 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-100">{bookingDates.size} days</span>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="text-center text-[10px] font-bold text-neutral-400 py-0.5">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={'e'+i} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const isToday = day === today.getDate();
                      const count = bookingDates.get(day) || 0;
                      const dayBookings = bookings.filter(b => b.status !== 'cancelled' && new Date(b.created_at).getDate() === day);
                      return (
                        <div key={day} title={count > 0 ? dayBookings.map(b => b.users?.name || 'Unknown').join(', ') : ''}
                          className={`aspect-square flex flex-col items-center justify-center rounded-lg text-[11px] relative cursor-default transition-colors ${
                            isToday ? 'bg-accent text-white font-black shadow-sm' :
                            count > 0 ? 'bg-blue-50 text-blue-700 font-bold hover:bg-blue-100' :
                            'text-neutral-400 hover:bg-neutral-50'
                          }`}>
                          {day}
                          {count > 0 && !isToday && (
                            <span className="absolute bottom-0.5 flex gap-0.5">
                              {Array.from({length: Math.min(count, 3)}).map((_,di) => (
                                <span key={di} className="h-1 w-1 rounded-full bg-accent" />
                              ))}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-4 text-[10px] text-neutral-400">
                    <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-accent" />Today</div>
                    <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-blue-100" />Has bookings</div>
                  </div>
                </div>

                {/* Booking list — flex-1, scrollable */}
                <div className="flex-1 bg-white rounded-2xl border border-neutral-100 overflow-hidden" style={{ minHeight: 400 }}>
                  <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-neutral-900">All Scheduled</h2>
                    <span className="text-xs text-neutral-400">{bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length} active</span>
                  </div>
                  {bookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'paid').length === 0 ? (
                    <div className="px-5 py-10 text-center text-neutral-400 text-sm">No active bookings.</div>
                  ) : (
                    <div className="divide-y divide-neutral-50 overflow-y-auto" style={{ maxHeight: 480 }}>
                      {bookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'paid').map(b => {
                        const bookingDay = new Date(b.created_at);
                        return (
                          <div key={b.id} className="px-5 py-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-accent text-xs font-black">{(b.users?.name || '?').charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-neutral-900">{b.users?.name || 'Unknown'}</p>
                                  <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">{b.service}</p>
                                </div>
                              </div>
                              <StatusBadge status={b.status} />
                            </div>
                            <div className="flex items-center gap-3 pl-11 text-[10px] text-neutral-400">
                              <span>📅 {bookingDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
                              {b.users?.phone && <span>📞 {b.users.phone}</span>}
                              {b.address && <span>📍 {b.address.split(',')[0]}</span>}
                            </div>
                            {(b.status === 'pending' || b.status === 'confirmed') && (
                              <div className="flex gap-1.5 mt-2.5 pl-11">
                                <button onClick={() => handleUpdateBooking(b.id, 'completed')}
                                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                                  Complete
                                </button>
                                {b.status === 'pending' && (
                                  <button onClick={() => handleUpdateBooking(b.id, 'confirmed')}
                                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">
                                    Confirm
                                  </button>
                                )}
                                <button onClick={() => handleUpdateBooking(b.id, 'cancelled')}
                                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200 transition-colors ml-auto">
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MESSAGES */}
            {tab === 'messages' && (
              <div className="flex gap-4" style={{ height: 'calc(100vh - 280px)', minHeight: 480 }}>
                {/* Thread list */}
                <div className="w-80 shrink-0 flex flex-col gap-2 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  {threads.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-neutral-100 py-10 text-center text-neutral-400 text-sm">
                      No messages yet. They appear when customers message you.
                    </div>
                  ) : threads.map((t: any) => {
                    const bk = t.bookings;
                    const client = bk?.users;
                    const isSelected = selectedThread === t.booking_id;
                    return (
                      <button key={t.booking_id} onClick={() => setSelectedThread(t.booking_id)}
                        className={`w-full text-left rounded-2xl border px-4 py-3.5 transition-all ${isSelected ? 'bg-white border-accent shadow-sm ring-1 ring-accent/20' : 'bg-white border-neutral-100 hover:border-neutral-200'}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                              <span className="text-accent text-xs font-black">{(client?.name || '?').charAt(0).toUpperCase()}</span>
                            </div>
                            <p className="text-sm font-bold text-neutral-900 truncate">{client?.name || 'Unknown'}</p>
                          </div>
                          <span className="text-[9px] text-neutral-400 shrink-0 mt-0.5">{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <p className="text-xs text-neutral-500 line-clamp-1 pl-9">{bk?.service || 'Service'}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5 pl-9 line-clamp-1">{t.content}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Chat + client info panel */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {!selectedThread ? (
                    <div className="bg-white rounded-2xl border border-neutral-100 flex-1 flex items-center justify-center text-neutral-400 text-sm">
                      Select a conversation
                    </div>
                  ) : (() => {
                    const thread = threads.find((t: any) => t.booking_id === selectedThread);
                    const bk = thread?.bookings;
                    const client = bk?.users;
                    const clientBookings = bookings.filter(b => b.users?.email === client?.email);
                    const clientSpend = clientBookings.reduce((s: number, b) => s + (b.amount_cents || 0), 0);
                    return (
                      <div className="flex gap-3 flex-1 overflow-hidden">
                        {/* Chat */}
                        <div className="flex-1 bg-white rounded-2xl border border-neutral-100 flex flex-col overflow-hidden">
                          {/* Header */}
                          <div className="px-4 py-3.5 border-b border-neutral-100 flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                              <span className="text-accent font-black">{(client?.name || '?').charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-neutral-900">{client?.name || 'Unknown'}</p>
                              <p className="text-xs text-neutral-400 truncate">{bk?.service}</p>
                            </div>
                            {client?.phone && (
                              <a href={'tel:' + client.phone} className="ml-auto text-xs font-semibold text-accent hover:opacity-70 transition-opacity shrink-0">
                                📞 {client.phone}
                              </a>
                            )}
                          </div>
                          {/* Messages */}
                          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5" style={{ scrollbarWidth: 'none' }}>
                            {threadMessages.length === 0 ? (
                              <div className="flex items-center justify-center h-full text-neutral-400 text-sm">No messages yet</div>
                            ) : threadMessages.map((m: any) => (
                              <div key={m.id} className={'flex ' + (m.sender_type === 'business' ? 'justify-end' : 'justify-start')}>
                                <div className={'max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ' + (m.sender_type === 'business' ? 'bg-accent text-white rounded-br-sm' : 'bg-neutral-100 text-neutral-800 rounded-bl-sm')}>
                                  {m.content}
                                  <p className={'text-[9px] mt-1 ' + (m.sender_type === 'business' ? 'text-white/60' : 'text-neutral-400')}>
                                    {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            ))}
                            <div ref={msgBottomRef} />
                          </div>
                          {/* Input */}
                          <div className="px-4 py-3 border-t border-neutral-100">
                            <div className="flex items-end gap-2">
                              <textarea value={msgDraft} onChange={e => setMsgDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBusinessMessage(); } }}
                                placeholder="Reply to customer…" rows={1}
                                className="flex-1 resize-none rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                                style={{ maxHeight: 100 }} />
                              <button onClick={sendBusinessMessage} disabled={!msgDraft.trim() || msgSending}
                                className="shrink-0 h-10 w-10 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-accent-dark transition-colors">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Client stats sidebar */}
                        <div className="w-56 shrink-0 flex flex-col gap-3">
                          <div className="bg-white rounded-2xl border border-neutral-100 p-4">
                            <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-3">Client</p>
                            <div className="flex items-center gap-2.5 mb-3">
                              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                <span className="text-accent font-black">{(client?.name || '?').charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-neutral-900 truncate">{client?.name}</p>
                                <p className="text-[10px] text-neutral-400 truncate">{client?.email}</p>
                              </div>
                            </div>
                            <div className="space-y-2.5 pt-2 border-t border-neutral-50">
                              {[
                                { label: 'Total Jobs', value: String(clientBookings.length) },
                                { label: 'Total Spent', value: '$' + (clientSpend / 100).toFixed(2) },
                                { label: 'Phone', value: client?.phone || '—' },
                              ].map(r => (
                                <div key={r.label} className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] text-neutral-400">{r.label}</span>
                                  <span className="text-[11px] font-bold text-neutral-700">{r.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="bg-white rounded-2xl border border-neutral-100 p-4">
                            <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-3">Booking</p>
                            <div className="space-y-2">
                              {[
                                { label: 'Service', value: bk?.service },
                                { label: 'Status', value: bk?.status?.replace('_', ' ') },
                              ].map(r => (
                                <div key={r.label}>
                                  <p className="text-[9px] text-neutral-400">{r.label}</p>
                                  <p className="text-[11px] font-semibold text-neutral-700 mt-0.5 line-clamp-2">{r.value || '—'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* SETTINGS */}
            {tab === 'settings' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                  <h2 className="text-sm font-bold text-neutral-900 mb-5">Edit Business Profile</h2>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    {settingsError && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{settingsError}</div>}
                    {([
                      { label: 'Business Name', v: editName, s: setEditName, ph: 'Pacific Plumbing Co.', t: 'text' },
                      { label: 'Phone', v: editPhone, s: setEditPhone, ph: '(415) 555-0192', t: 'tel' },
                      { label: 'Address / City', v: editAddress, s: setEditAddress, ph: 'San Francisco, CA', t: 'text' },
                      { label: 'Website', v: editWebsite, s: setEditWebsite, ph: 'https://...', t: 'url' },
                      { label: 'Services (comma-separated)', v: editServices, s: setEditServices, ph: 'Plumbing, Drain Cleaning', t: 'text' },
                    ] as const).map((f) => (
                      <div key={f.label}>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">{f.label}</label>
                        <input type={f.t} className="form-input" value={f.v} placeholder={f.ph} onChange={e => (f.s as (v: string) => void)(e.target.value)} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Description</label>
                      <textarea className="form-input resize-none" rows={3} value={editDesc} placeholder="Tell customers about your business…" onChange={e => setEditDesc(e.target.value)} />
                    </div>
                    <button type="submit" disabled={settingsSaving} className="btn-primary w-full py-2.5 text-sm">
                      {settingsSaved ? '✓ Saved!' : settingsSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </form>
                </div>
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                    <h2 className="text-sm font-bold text-neutral-900 mb-4">Account Info</h2>
                    <div className="space-y-3">
                      {[
                        { label: 'Owner', value: business?.owner_name },
                        { label: 'Email', value: business?.owner_email },
                        { label: 'Status', value: business?.is_onboarded ? '✓ Active on ScheduleMe' : '⏳ Pending Review' },
                        { label: 'Rating', value: business?.rating ? business.rating + ' ★' : 'No ratings yet' },
                      ].map(r => (
                        <div key={r.label} className="flex items-start justify-between gap-4 py-2 border-b border-neutral-50 last:border-0">
                          <span className="text-xs text-neutral-400 font-medium shrink-0">{r.label}</span>
                          <span className="text-sm text-neutral-700 text-right">{r.value || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                    <h2 className="text-sm font-bold text-neutral-900 mb-2">Payment Account</h2>
                    <p className="text-xs text-neutral-400 mb-4">{business?.stripe_onboarded ? 'Connected via Stripe. Payments deposit automatically.' : 'Connect your bank account to receive payments.'}</p>
                    {business?.stripe_onboarded
                      ? <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Bank account connected</div>
                      : <button onClick={handleStripeConnect} disabled={stripeLoading} className="btn-primary text-sm px-5 py-2.5">{stripeLoading ? 'Loading…' : 'Connect Bank Account →'}</button>
                    }
                  </div>
                  <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                    <h2 className="text-sm font-bold text-neutral-900 mb-2">Session</h2>
                    <p className="text-xs text-neutral-400 mb-4">Signed in as {business?.owner_email}</p>
                    <button onClick={handleSignOut} className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors">Sign Out</button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default BusinessDashboard;
