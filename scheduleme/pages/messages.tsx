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

interface Message { id: string; booking_id: string; sender_type: 'user' | 'business'; content: string; created_at: string; read: boolean; }
interface Thread {
  id: string; service: string; status: string; created_at: string;
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
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const supabaseRef = useRef(getSupabase());
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }
      setUserId(session.user.id);
      loadThreads(session.user.id);
    });
  }, [router]);

  // Open thread from query param (e.g., from bookings page)
  useEffect(() => {
    if (router.query.booking && threads.length > 0) {
      const t = threads.find(t => t.id === router.query.booking);
      if (t) openThread(t);
    }
  }, [router.query.booking, threads]);

  async function loadThreads(uid: string) {
    const res = await fetch(`/api/messages?user_id=${uid}`);
    if (res.ok) { const data = await res.json(); setThreads(data.threads || []); }
    setLoading(false);
  }

  // Realtime subscription ref
  const realtimeChannelRef = useRef<any>(null);

  async function openThread(thread: Thread) {
    setActiveThread(thread);
    setMessages([]);
    const authH = await getAuthHeaders();
    const res = await fetch(`/api/messages?booking_id=${thread.id}`, { headers: authH });
    if (res.ok) { const data = await res.json(); setMessages(data.messages || []); }
    // Mark read
    if (thread.unreadCount > 0) {
      await fetch('/api/messages', { method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ booking_id: thread.id, reader_type: 'user' }) });
      setThreads(ts => ts.map(t => t.id === thread.id ? { ...t, unreadCount: 0 } : t));
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    // Subscribe to realtime messages for this thread
    const supabase = supabaseRef.current;
    if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    const bookingId = thread.id;

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
        setThreads(ts => ts.map(t => t.id === bookingId ? { ...t, lastMessage: payload.new } : t));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .subscribe();

    // Always poll every 2s as fallback (realtime may not be enabled)
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetch('/api/messages?booking_id=' + bookingId)
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

  async function sendMessage() {
    if (!input.trim() || !activeThread || !userId || sending) return;
    setSending(true);
    const content = input.trim();
    setInput('');
    const res = await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: activeThread.id, sender_type: 'user', sender_id: userId, content }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages(m => [...m, data.message]);
      setThreads(ts => ts.map(t => t.id === activeThread.id ? { ...t, lastMessage: data.message } : t));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0);

  return (
    <>
      <Head><title>Messages — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pt-[72px]" style={{ background: dm ? '#0a0a0a' : '#EDF5FF' }}>

        {/* Blue header */}
        <div className="border-b" style={{ background: '#3b82f6', borderColor: 'rgba(0,0,0,0.08)' }}>
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
                style={{ background: dm ? 'rgba(255,255,255,0.14)' : 'white', color: dm ? 'rgba(255,255,255,0.9)' : '#0A84FF' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Bookings
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="relative h-7 w-7"><div className="absolute inset-0 rounded-full border-2 border-neutral-200" /><div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" /></div>
            </div>
          ) : threads.length === 0 ? (
            <div className="rounded-2xl border text-center py-16 px-6" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(10,132,255,0.08)' }}>
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
              <div className={`${activeThread ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-80 shrink-0 rounded-2xl border overflow-hidden`} style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(10,132,255,0.08)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
                  <p className="text-xs font-black uppercase tracking-[0.1em]" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#a3a3a3' }}>{threads.length} conversation{threads.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  {threads.map(t => (
                    <button key={t.id} onClick={() => openThread(t)}
                      className="w-full text-left px-4 py-3.5 border-b transition-colors" style={{ borderColor: dm ? '#111111' : '#fafafa', background: activeThread?.id === t.id ? (dm ? '#111111' : '#eff6ff') : 'transparent' }}>
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
                            {t.lastMessage.sender_type === 'user' ? 'You: ' : ''}{t.lastMessage.content}
                          </p>
                        : <p className="text-[11px] text-neutral-300 italic">No messages yet — say hi</p>
                      }
                    </button>
                  ))}
                </div>
              </div>

              {/* Message thread */}
              {activeThread ? (
                <div className="flex-1 flex flex-col rounded-2xl border overflow-hidden" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(10,132,255,0.08)' }}>
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
                      {activeThread.businesses?.phone && (
                        <a href={`tel:${activeThread.businesses.phone}`}
                          className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-accent bg-blue-50 px-3 py-1.5 rounded-xl border border-accent/15 hover:bg-blue-100 transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                          Call
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'none', background: dm ? '#0d0d0d' : '#f8fafc' }}>
                    {/* Booking context card */}
                    <div className="rounded-xl border p-3.5 mb-4" style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5' }}>
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400 mb-2">Booking Details</p>
                      <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#262626' }}>{activeThread.service}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[activeThread.status] || 'bg-neutral-300'}`} />
                        <span className="text-xs text-neutral-500 capitalize">{activeThread.status}</span>
                        <span className="text-neutral-200">·</span>
                        <span className="text-xs text-neutral-400">{new Date(activeThread.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {messages.length === 0 && (
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
                    <div className="flex items-end gap-2">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder={`Message ${activeThread.businesses?.name || 'the business'}…`}
                        rows={1}
                        className="flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all leading-relaxed"
                        style={{ maxHeight: 120, background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#f3f4f6' : '#171717' }}
                      />
                      <button onClick={sendMessage} disabled={!input.trim() || sending}
                        className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                        style={{ background: input.trim() ? '#0A84FF' : '#e5e7eb' }}>
                        <svg className={`h-4 w-4 ${input.trim() ? 'text-white' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1.5 px-1">↵ to send · Shift+↵ for new line</p>
                  </div>
                </div>
              ) : (
                <div className="hidden sm:flex flex-1 items-center justify-center rounded-2xl border" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(10,132,255,0.08)' }}>
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
