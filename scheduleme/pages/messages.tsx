// @ts-nocheck
// pages/messages.tsx — Consumer messaging with booked businesses
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { SkeletonThread } from '../components/SkeletonCard';
import { useDm } from '../lib/DarkModeContext';
import Link from 'next/link';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Message { id: string; booking_id: string; sender_type: 'user' | 'business'; content: string; image_url?: string | null; message_type?: string; created_at: string; read: boolean; }
interface Thread {
  id: string; business_id?: string | null; booking_id?: string | null; booking_ids?: string[];
  service: string; status: string; created_at: string;
  businesses: { id: string; name: string; phone: string } | null;
  lastMessage: Message | null; unreadCount: number;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-400', confirmed: 'bg-blue-500', completed: 'bg-emerald-500',
  cancelled: 'bg-neutral-300', paid: 'bg-emerald-500',
};

function fmtTime(iso: string) {
  const d = new Date(iso), now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const MessagesPage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [blockedBusinesses, setBlockedBusinesses] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const supabaseRef = useRef(getSupabase());
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem('sm_threads_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setThreads(parsed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }
      setUserId(session.user.id);
      loadThreads(session.user.id);
      loadBlocks(session.user.id);
    });
  }, [router]);

  async function loadBlocks(uid: string) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/blocks?user_id=${uid}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, boolean> = {};
      for (const b of data.blocks || []) map[b.business_id] = true;
      setBlockedBusinesses(map);
    } catch {}
  }

  // Open thread from query param (e.g., from bookings page)
  useEffect(() => {
    const bookingId = typeof router.query.booking === 'string' ? router.query.booking : null;
    if (!bookingId) return;
    if (threads.length > 0) {
      const t = threads.find(t => t.id === bookingId);
      if (t) {
        openThread(t);
        return;
      }
    }
    // If thread not found yet, fetch booking thread directly
    (async () => {
      try {
        const authH = await getAuthHeaders();
        const res = await fetch(`/api/messages?booking_id=${bookingId}`, { headers: authH });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.thread) {
          setThreads(ts => {
            if (ts.find(t => t.id === data.thread.id)) return ts;
            return [data.thread, ...ts];
          });
          openThread(data.thread);
        }
      } catch {}
    })();
  }, [router.query.booking, threads]);

  // Open thread from business query (find latest booking with that business)
  useEffect(() => {
    const bookingId = typeof router.query.booking === 'string' ? router.query.booking : null;
    if (bookingId) return;
    const businessId = typeof router.query.business === 'string' ? router.query.business : null;
    if (!businessId) return;
    (async () => {
      try {
        const authH = await getAuthHeaders();
        const res = await fetch(`/api/messages?thread_business_id=${businessId}`, { headers: authH });
        if (!res.ok) {
          setThreadError('No bookings found with this business yet.');
          return;
        }
        const data = await res.json();
        if (data?.thread) {
          setThreads(ts => {
            if (ts.find(t => t.id === data.thread.id)) return ts;
            return [data.thread, ...ts];
          });
          openThread(data.thread);
        }
      } catch {}
    })();
  }, [router.query.business, router.query.booking]);

  useEffect(() => {
    const bookingId = typeof router.query.booking === 'string' ? router.query.booking : null;
    if (!bookingId && threads.length > 0 && !activeThread) {
      const lastId = typeof window !== 'undefined' ? localStorage.getItem('sm_last_thread') : null;
      if (lastId) {
        const t = threads.find(t => t.id === lastId);
        if (t) openThread(t);
      }
    }
  }, [threads, router.query.booking, activeThread]);

  async function loadThreads(uid: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/messages?user_id=${uid}`, { headers });
    if (res.ok) {
      const data = await res.json();
      const list = data.threads || [];
      setThreads(list);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('sm_threads_cache', JSON.stringify(list)); } catch {}
      }
      setThreadError('');
    } else {
      setThreadError('Unable to load messages. Please refresh.');
    }
    setLoading(false);
  }

  // Realtime subscription ref
  const realtimeChannelRef = useRef<any>(null);

  async function openThread(thread: Thread) {
    setActiveThread(thread);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sm_last_thread', thread.id);
    }
    if (activeThread?.id !== thread.id) setMessages([]);
    setThreadLoading(true);
    const authH = await getAuthHeaders();
    const target = thread.business_id ? `/api/messages?thread_business_id=${thread.business_id}` : `/api/messages?booking_id=${thread.id}`;
    let threadData = thread;
    try {
      const res = await fetch(target, { headers: authH });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        if (data?.thread) {
          threadData = { ...thread, ...data.thread };
          setActiveThread(threadData);
        }
      }
    } finally {
      setThreadLoading(false);
    }
    const bookingId = threadData.booking_id || threadData.id;
    const bookingIds = threadData.booking_ids || [bookingId];
    // Mark read
    if (thread.unreadCount > 0) {
      await Promise.all(bookingIds.map(bid =>
        fetch('/api/messages', { method: 'PATCH', headers: authH, body: JSON.stringify({ booking_id: bid, reader_type: 'user' }) })
      ));
      setThreads(ts => ts.map(t => t.id === thread.id ? { ...t, unreadCount: 0 } : t));
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    // Subscribe to realtime messages for this thread
    const supabase = supabaseRef.current;
    if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    if (bookingIds.length === 1) {
      realtimeChannelRef.current = supabase
        .channel('consumer-msg-' + bookingId)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: 'booking_id=eq.' + bookingId,
        }, (payload: any) => {
          setMessages(m => {
            if (m.find((x: any) => x.id === payload.new.id)) return m;
            return [...m, payload.new];
          });
          setThreads(ts => ts.map(t => t.id === thread.id ? { ...t, lastMessage: payload.new } : t));
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        })
        .subscribe();
    }

    // Always poll every 2s as fallback (realtime may not be enabled)
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const url = threadData.business_id ? '/api/messages?thread_business_id=' + threadData.business_id : '/api/messages?booking_id=' + bookingId;
      getAuthHeaders().then(h => fetch(url, { headers: h }))
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.messages) {
            setMessages(prev => {
              if (d.messages.length > prev.length) {
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                return d.messages;
              }
              return prev;
            });
          }
        });
    }, 2000);
  }

  async function toggleBlockBusiness(businessId: string) {
    if (!userId) return;
    const blocked = !!blockedBusinesses[businessId];
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, user_id: userId, action: blocked ? 'unblock' : 'block' }),
      });
      if (res.ok) {
        setBlockedBusinesses(m => ({ ...m, [businessId]: !blocked }));
      }
    } catch {}
  }

  async function sendMessage() {
    if (!input.trim() || !activeThread || !userId || sending || isBlocked) return;
    setSending(true);
    const content = input.trim();
    setInput('');
    let bookingId = activeThread.booking_id || (activeThread.booking_ids && activeThread.booking_ids[0]) || activeThread.id;
    if (!activeThread.booking_id && activeThread.business_id) {
      try {
        const authH = await getAuthHeaders();
        const resThread = await fetch(`/api/messages?thread_business_id=${activeThread.business_id}`, { headers: authH });
        if (resThread.ok) {
          const data = await resThread.json();
          if (data?.thread?.booking_id) {
            bookingId = data.thread.booking_id;
            setActiveThread((t: any) => t ? { ...t, ...data.thread } : t);
          }
        }
      } catch {}
    }

    const tempId = `temp-${Date.now()}`;
    const tempMsg = { id: tempId, booking_id: bookingId, sender_type: 'user', content, created_at: new Date().toISOString() };
    setMessages(m => [...m, tempMsg]);
    setThreads(ts => ts.map(t => t.id === activeThread.id ? { ...t, lastMessage: tempMsg } : t));

    const res = await fetch('/api/messages', {
      method: 'POST', headers: await getAuthHeaders(),
      body: JSON.stringify({ booking_id: bookingId, sender_type: 'user', sender_id: userId, content }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages(m => m.map(msg => msg.id === tempId ? data.message : msg));
      setThreads(ts => ts.map(t => t.id === activeThread.id ? { ...t, lastMessage: data.message } : t));
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('sm_threads_cache', JSON.stringify(threads)); } catch {}
      }
      setSendError('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } else {
      setSendError('Message failed to send. Please try again.');
      setMessages(m => m.filter(msg => msg.id !== tempId));
      setInput(content);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  async function sendImage(file: File) {
    if (!activeThread || !userId || uploadingImage || isBlocked) return;
    setUploadingImage(true);
    let bookingId = activeThread.booking_id || (activeThread.booking_ids && activeThread.booking_ids[0]) || activeThread.id;
    if (!activeThread.booking_id && activeThread.business_id) {
      try {
        const authH = await getAuthHeaders();
        const resThread = await fetch(`/api/messages?thread_business_id=${activeThread.business_id}`, { headers: authH });
        if (resThread.ok) {
          const data = await resThread.json();
          if (data?.thread?.booking_id) {
            bookingId = data.thread.booking_id;
            setActiveThread((t: any) => t ? { ...t, ...data.thread } : t);
          }
        }
      } catch {}
    }

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const authH = await getAuthHeaders();
      const up = await fetch('/api/upload-message-media', {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, file_data: base64, file_type: file.type, file_name: file.name }),
      });
      const upData = await up.json();
      if (!up.ok) { setSendError(upData.error || 'Image upload failed'); return; }

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, sender_type: 'user', content: input.trim(), image_url: upData.url }),
      });
      const data = await res.json();
      if (!res.ok) { setSendError(data.error || 'Message failed'); return; }
      setInput('');
      setMessages(m => [...m, data.message]);
      setThreads(ts => ts.map(t => t.id === activeThread.id ? { ...t, lastMessage: data.message } : t));
    } finally {
      setUploadingImage(false);
    }
  }

  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0);
  const isBlocked = !!(activeThread?.business_id && blockedBusinesses[activeThread.business_id]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Messages — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pb-20 md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#EDF5FF' }}>

        {/* Blue header */}
        <div className="border-b" style={{ background: 'linear-gradient(135deg, #007e6d 0%, #1e554c 100%)', borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="mx-auto max-w-5xl px-6 pt-7 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[2rem] font-black text-white" style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}>Messages</h1>
                <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {totalUnread > 0 ? `${totalUnread} unread message${totalUnread !== 1 ? 's' : ''}` : 'All caught up'}
                </p>
              </div>
              <Link href="/bookings" scroll={false}
                className="flex items-center gap-2 text-sm font-black px-4 py-2.5 rounded-xl"
                style={{ background: dm ? 'rgba(255,255,255,0.14)' : 'white', color: dm ? 'rgba(255,255,255,0.9)' : '#007e6d', border: '1px solid rgba(255,255,255,0.3)' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Bookings
              </Link>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-8">
          {/* Soft ambient glow for a little warmth */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 left-1/2 h-48 w-[42rem] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              opacity: dm ? 0.2 : 0.45,
              background: dm
                ? 'radial-gradient(closest-side, rgba(0,126,109,0.35), transparent 70%)'
                : 'radial-gradient(closest-side, rgba(0,126,109,0.22), transparent 70%)',
            }}
          />
          <div className="relative z-10">
          {threadError && (
            <div className="mb-4 text-xs text-red-600 font-semibold">{threadError}</div>
          )}
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonThread key={i} dm={dm} />)}
            </div>
          ) : threads.length === 0 ? (
            <div className="rounded-2xl border text-center py-16 px-6" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(10,132,255,0.08)', boxShadow: dm ? '0 12px 24px rgba(0,0,0,0.35)' : '0 18px 40px rgba(0, 73, 128, 0.08)' }}>
              <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <svg className="h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
              </div>
              <p className="font-bold mb-1" style={{ color: dm ? '#f3f4f6' : '#404040' }}>No messages yet</p>
              <p className="text-sm mb-6" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>Once you book a service, you can message the pro directly here.</p>
              <Link href="/browse" scroll={false} className="btn-primary px-6 py-2.5 text-sm">Browse professionals</Link>
            </div>
          ) : (
            <div className="flex gap-4" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>

              {/* Thread list */}
              <div className={`${activeThread ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-80 shrink-0 rounded-2xl border overflow-hidden`} style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(10,132,255,0.08)', boxShadow: dm ? '0 10px 24px rgba(0,0,0,0.35)' : '0 18px 50px rgba(0, 73, 128, 0.08)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
                  <p className="text-xs font-black uppercase tracking-[0.1em]" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#a3a3a3' }}>{threads.length} conversation{threads.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  {threads.map(t => (
                    <button key={t.id} onClick={() => openThread(t)}
                      className="w-full text-left px-4 py-3.5 border-b transition-colors" style={{ borderColor: dm ? '#111111' : '#f5f7fb', background: activeThread?.id === t.id ? (dm ? '#111111' : 'rgba(0,126,109,0.08)') : 'transparent' }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLOR[t.status] || 'bg-neutral-300'}`} />
                          <p className="text-sm font-bold truncate" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{t.businesses?.name || 'Unknown business'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.unreadCount > 0 && (
                            <span className="h-4 w-4 rounded-full bg-accent flex items-center justify-center text-[9px] font-black text-white">{t.unreadCount}</span>
                          )}
                          {t.lastMessage && <span className="text-[10px] text-neutral-400">{fmtTime(t.lastMessage.created_at)}</span>}
                        </div>
                      </div>
                      <p className="text-[11px] truncate mb-1" style={{ color: dm ? '#9ca3af' : '#737373' }}>{t.service}</p>
                      {t.lastMessage
                        ? <p className={`text-[11px] truncate ${t.unreadCount > 0 ? 'font-semibold text-neutral-700' : 'text-neutral-400'}`}>
                            {t.lastMessage.sender_type === 'user' ? 'You: ' : ''}
                            {t.lastMessage.image_url ? (t.lastMessage.content ? t.lastMessage.content : 'Photo') : t.lastMessage.content}
                          </p>
                        : <p className="text-[11px] text-neutral-300 italic">No messages yet — say hi</p>
                      }
                    </button>
                  ))}
                </div>
              </div>

              {/* Message thread */}
              {activeThread ? (
                <div className="flex-1 flex flex-col rounded-2xl border overflow-hidden" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(10,132,255,0.08)', boxShadow: dm ? '0 10px 24px rgba(0,0,0,0.35)' : '0 18px 50px rgba(0, 73, 128, 0.08)' }}>
                  {/* Thread header — booking info */}
                  <div className="px-5 py-3.5 border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setActiveThread(null)} className="sm:hidden p-1.5 rounded-lg hover:bg-neutral-100 mr-1">
                        <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                      </button>
                      <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                        <span className="text-accent font-black text-sm">{(activeThread.businesses?.name || 'B').charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{activeThread.businesses?.name || 'Business'}</p>
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[activeThread.status] || 'bg-neutral-300'}`} />
                          <p className="text-[11px] text-neutral-400 truncate">{activeThread.service}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeThread.business_id && (
                          <button
                            onClick={() => toggleBlockBusiness(activeThread.business_id!)}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-full border"
                            style={{ borderColor: isBlocked ? '#ef4444' : '#d1d5db', color: isBlocked ? '#ef4444' : '#6b7280', background: dm ? '#1f1f1f' : 'white' }}>
                            {isBlocked ? 'Unblock' : 'Block'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'none', background: dm ? 'linear-gradient(180deg, #0d0d0d 0%, #101112 100%)' : 'linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)' }}>
                    {/* Booking context card */}
                    <div className="rounded-xl border p-3.5 mb-4" style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', boxShadow: dm ? '0 6px 14px rgba(0,0,0,0.3)' : '0 10px 24px rgba(0, 73, 128, 0.06)' }}>
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400 mb-2">Booking Details</p>
                      <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#262626' }}>{activeThread.service}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[activeThread.status] || 'bg-neutral-300'}`} />
                        <span className="text-xs text-neutral-500 capitalize">{activeThread.status}</span>
                        <span className="text-neutral-200">·</span>
                        <span className="text-xs text-neutral-400">{new Date(activeThread.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {threadLoading && (
                      <div className="text-center py-6">
                        <p className="text-sm text-neutral-400">Loading conversation…</p>
                      </div>
                    )}

                    {!threadLoading && messages.length === 0 && (
                      <div className="text-center py-6">
                        <p className="text-sm text-neutral-400">No messages yet.</p>
                        <p className="text-xs text-neutral-300 mt-1">Send a message to get in touch with {activeThread.businesses?.name || 'the business'}.</p>
                      </div>
                    )}

                    {messages.map((msg, i) => {
                      const isUser = msg.sender_type === 'user';
                      const showTime = i === 0 || new Date(msg.created_at).getTime() - new Date(messages[i-1].created_at).getTime() > 300000;
                      return (
                        <div key={msg.id}>
                          {showTime && <p className="text-center text-[10px] text-neutral-400 py-1">{fmtTime(msg.created_at)}</p>}
                          <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              isUser
                                ? 'bg-accent text-white rounded-br-md'
                                : dm ? 'bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-bl-md' : 'bg-white text-neutral-800 border border-neutral-200 rounded-bl-md'
                            }`}>
                              {msg.image_url && (
                                <div className="mb-2">
                                  <img src={msg.image_url} alt="Attachment" className="rounded-xl max-h-56 object-cover border" style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb' }} />
                                </div>
                              )}
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  <div className="px-4 py-3 border-t" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                    {isBlocked && <p className="text-[11px] text-red-500 font-semibold mb-2">Messaging is blocked for this business.</p>}
                    <div className="flex items-end gap-2">
                      <label className={`shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center cursor-pointer ${uploadingImage ? 'opacity-60' : ''}`}
                        style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#e5e7eb' : '#374151' }}>
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingImage || isBlocked} onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) sendImage(f);
                          e.target.value = '';
                        }} />
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M4 5l3.5 4.5M20 5l-3.5 4.5M4 19h16M4 12h16" /></svg>
                      </label>
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder={`Message ${activeThread.businesses?.name || 'the business'}…`}
                        rows={1}
                        className="flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all leading-relaxed"
                        style={{ maxHeight: 120, background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#f3f4f6' : '#171717' }}
                        disabled={isBlocked}
                      />
                      <button onClick={sendMessage} disabled={!input.trim() || sending || isBlocked}
                        className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                        style={{ background: input.trim() ? '#007e6d' : '#e5e7eb' }}>
                        <svg className={`h-4 w-4 ${input.trim() ? 'text-white' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1.5 px-1">↵ to send · Shift+↵ for new line</p>
                    {sendError && <p className="text-[11px] text-red-500 mt-1 px-1">{sendError}</p>}
                  </div>
                </div>
              ) : (
                <div className="hidden sm:flex flex-1 items-center justify-center rounded-2xl border" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(10,132,255,0.08)', boxShadow: dm ? '0 10px 24px rgba(0,0,0,0.35)' : '0 18px 50px rgba(0, 73, 128, 0.08)' }}>
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                      <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: dm ? '#d1d5db' : '#525252' }}>Select a conversation</p>
                    <p className="text-xs mt-1" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>Choose a booking to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
};

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  };
}

export default MessagesPage;
