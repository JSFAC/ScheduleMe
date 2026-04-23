// @ts-nocheck
// pages/messages.tsx — Consumer messaging with booked businesses
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { SkeletonThread } from '../components/SkeletonCard';
import { useDm } from '../lib/DarkModeContext';
import Link from 'next/link';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!url || !key) return null;
  return createClient(url, key);
}

interface Message {
  id: string;
  booking_id: string;
  sender_type: 'user' | 'business';
  content: string;
  created_at: string;
  read: boolean;
  image_url?: string | null;
  message_type?: 'text' | 'image' | 'video' | string | null;
}
interface Thread {
  id: string; service: string; status: string; created_at: string;
  businesses: { id: string; name: string; phone: string } | null;
  lastMessage: Message | null; unreadCount: number;
  business_id?: string | null;
  booking_id?: string | null;
  booking_ids?: string[];
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-400', confirmed: 'bg-accent-light0', completed: 'bg-emerald-500',
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
  const [eduGateMessage, setEduGateMessage] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ urls: string[]; index: number } | null>(null);
  const [blockedByUser, setBlockedByUser] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef<any>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const authHeadersRef = useRef<HeadersInit>({ 'Content-Type': 'application/json' });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabaseRef.current = supabase;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/signin?next=/messages&shell=app'); return; }
      setUserId(session.user.id);
      authHeadersRef.current = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      };
      loadThreads(session.user.id);
    });
  }, [router]);

  // Open thread from query param (e.g., from bookings page)
  useEffect(() => {
    if (router.query.booking && threads.length > 0) {
      const bookingId = String(router.query.booking);
      const t = threads.find(t =>
        t.id === bookingId ||
        t.booking_id === bookingId ||
        (Array.isArray(t.booking_ids) && t.booking_ids.includes(bookingId))
      );
      if (t) openThread(t);
    }
  }, [router.query.booking, threads]);

  useEffect(() => {
    if (!gallery) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGallery(null);
      if (e.key === 'ArrowLeft') {
        setGallery((prev) => prev ? { ...prev, index: (prev.index - 1 + prev.urls.length) % prev.urls.length } : prev);
      }
      if (e.key === 'ArrowRight') {
        setGallery((prev) => prev ? { ...prev, index: (prev.index + 1) % prev.urls.length } : prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gallery]);

  useEffect(() => {
    if (!actionsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-thread-actions]')) setActionsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [actionsOpen]);

  async function loadThreads(uid: string) {
    const res = await fetch(`/api/messages?user_id=${uid}`, { headers: authHeadersRef.current });
    if (res.ok) { const data = await res.json(); setThreads(data.threads || []); }
    setLoading(false);
  }

  // Realtime subscription ref
  const realtimeChannelRef = useRef<any>(null);

  async function openThread(thread: Thread) {
    setActiveThread(thread);
    setMessages([]);
    setEduGateMessage(null);
    setActionsOpen(false);
    const authH = authHeadersRef.current;
    const threadQuery = thread.business_id
      ? `/api/messages?thread_business_id=${thread.business_id}`
      : `/api/messages?booking_id=${thread.booking_id || thread.id}`;
    const res = await fetch(threadQuery, { headers: authH });
    if (res.ok) { const data = await res.json(); setMessages(data.messages || []); }
    // Mark read
    if (thread.unreadCount > 0) {
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: authH,
        body: JSON.stringify({ booking_id: thread.booking_id || thread.id, reader_type: 'user' }),
      });
      setThreads(ts => ts.map(t => t.id === thread.id ? { ...t, unreadCount: 0 } : t));
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    loadBlockState(thread);
    // Subscribe to realtime messages for this thread
    const supabase = supabaseRef.current;
    if (realtimeChannelRef.current && supabase) supabase.removeChannel(realtimeChannelRef.current);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    const bookingId = thread.booking_id || thread.id;

    if (supabase) {
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
    }

    // Always poll every 2s as fallback (realtime may not be enabled)
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const pollUrl = thread.business_id
        ? `/api/messages?thread_business_id=${thread.business_id}`
        : `/api/messages?booking_id=${bookingId}`;
      fetch(pollUrl, { headers: authH })
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
    if (!input.trim() || !activeThread || !userId || sending || blockedByUser) return;
    setSending(true);
    const content = input.trim();
    setInput('');
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: authHeadersRef.current,
      body: JSON.stringify({ booking_id: activeThread.booking_id || activeThread.id, sender_type: 'user', sender_id: userId, content }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages(m => [...m, data.message]);
      setThreads(ts => ts.map(t => t.id === activeThread.id ? { ...t, lastMessage: data.message } : t));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      setEduGateMessage(null);
    } else {
      const data = await res.json().catch(() => ({}));
      if (data?.code === 'edu_verification_required' || data?.code === 'campus_match_required') {
        setEduGateMessage(data.error || 'Verify your .edu email to continue messaging this provider.');
      }
    }
    setSending(false);
    inputRef.current?.focus();
  }

  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0);
  const mobileThreadOpen = !!activeThread;
  const lockPageScroll = !loading && threads.length > 0;
  async function loadBlockState(thread: Thread | null) {
    if (!thread?.business_id || !userId) {
      setBlockedByUser(false);
      return;
    }
    try {
      const res = await fetch(`/api/blocks?user_id=${userId}`, { headers: authHeadersRef.current });
      if (!res.ok) {
        setBlockedByUser(false);
        return;
      }
      const data = await res.json();
      const isBlocked = (data.blocks || []).some((b: any) => b.business_id === thread.business_id);
      setBlockedByUser(!!isBlocked);
    } catch {
      setBlockedByUser(false);
    }
  }

  async function updateBlock(action: 'block' | 'unblock') {
    if (!activeThread?.business_id || !userId) return false;
    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: authHeadersRef.current,
        body: JSON.stringify({
          business_id: activeThread.business_id,
          user_id: userId,
          action,
        }),
      });
      if (!res.ok) return false;
      const blocked = action === 'block';
      setBlockedByUser(blocked);
      if (blocked) setInput('');
      return true;
    } catch {
      return false;
    }
  }

  async function reportAndBlock() {
    if (!activeThread?.business_id || !userId || actionBusy) return;
    setActionBusy(true);
    try {
      await fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'User report submitted from messages thread',
          severity: 'warning',
          route: '/messages',
          component: 'MessagesPage',
          payload: {
            reporter_user_id: userId,
            business_id: activeThread.business_id,
            business_name: activeThread.businesses?.name || null,
            booking_id: activeThread.booking_id || activeThread.id,
            thread_id: activeThread.id,
          },
        }),
      }).catch(() => null);
      await updateBlock('block');
    } finally {
      setActionBusy(false);
      setActionsOpen(false);
    }
  }

  const messageBlocks = useMemo(() => {
    const blocks: Array<
      | { kind: 'single'; msg: Message; ts: string }
      | { kind: 'media'; items: Message[]; sender: Message['sender_type']; ts: string }
    > = [];
    for (let i = 0; i < messages.length; i += 1) {
      const current = messages[i];
      const mediaLike = !!current.image_url || current.message_type === 'image' || current.message_type === 'video';
      if (!mediaLike) {
        blocks.push({ kind: 'single', msg: current, ts: current.created_at });
        continue;
      }
      const group: Message[] = [current];
      for (let j = i + 1; j < messages.length; j += 1) {
        const next = messages[j];
        const nextMediaLike = !!next.image_url || next.message_type === 'image' || next.message_type === 'video';
        const closeInTime = Math.abs(new Date(next.created_at).getTime() - new Date(group[group.length - 1].created_at).getTime()) < 10 * 60 * 1000;
        if (!nextMediaLike || next.sender_type !== current.sender_type || !closeInTime) break;
        group.push(next);
        i = j;
      }
      if (group.length > 1) {
        blocks.push({ kind: 'media', items: group, sender: current.sender_type, ts: group[0].created_at });
      } else {
        blocks.push({ kind: 'single', msg: current, ts: current.created_at });
      }
    }
    return blocks;
  }, [messages]);
  const galleryCurrent = gallery ? gallery.urls[gallery.index] : null;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Messages — ScheduleMe</title></Head>
      <Nav />
      <div
        className={`${lockPageScroll ? 'h-[calc(100dvh-env(safe-area-inset-top,0px))]' : 'min-h-screen'} pb-[calc(88px+env(safe-area-inset-bottom,0px))] md:pb-0`}
        style={{
          paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))',
          background: dm ? '#0a0a0a' : '#F4EFE6',
          overflow: lockPageScroll ? 'hidden' : 'visible',
          height: lockPageScroll ? 'calc(100dvh - env(safe-area-inset-top, 0px))' : undefined,
        }}
      >

        <div className={`${mobileThreadOpen ? 'hidden sm:block' : 'block'} border-b`} style={{ background: 'linear-gradient(145deg,#0F766E 0%, #156F68 100%)', borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-5 pb-4 sm:pt-7 sm:pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[2rem] font-black text-white" style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}>Messages</h1>
                <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {totalUnread > 0 ? `${totalUnread} unread message${totalUnread !== 1 ? 's' : ''}` : 'All caught up'}
                </p>
              </div>
              <Link href="/bookings" scroll={false}
                className="flex items-center gap-2 text-sm font-black px-4 py-2.5 rounded-xl"
                style={{ background: dm ? 'rgba(255,255,255,0.14)' : 'white', color: dm ? 'rgba(255,255,255,0.9)' : '#0F766E' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Bookings
              </Link>
            </div>
          </div>
        </div>

        <div className={`mx-auto max-w-5xl px-4 sm:px-6 ${mobileThreadOpen ? 'py-2 sm:py-6' : 'py-4 sm:py-6'} ${lockPageScroll ? 'h-full' : ''}`}>
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonThread key={i} dm={dm} />)}
            </div>
          ) : threads.length === 0 ? (
            <div className="rounded-2xl border text-center py-16 px-6" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(15,118,110,0.08)' }}>
              <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <svg className="h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
              </div>
              <p className="font-bold mb-1" style={{ color: dm ? '#f3f4f6' : '#404040' }}>No messages yet</p>
              <p className="text-sm mb-6" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>Once you book a service, you can message the pro directly here.</p>
              <Link href="/browse" scroll={false} className="btn-primary px-6 py-2.5 text-sm">Browse professionals</Link>
            </div>
          ) : (
            <div
              className="flex gap-3 sm:gap-4 sm:min-h-[500px]"
              style={{
                height: lockPageScroll
                  ? (mobileThreadOpen
                      ? 'calc(100dvh - (48px + env(safe-area-inset-top,0px) + 114px + env(safe-area-inset-bottom,0px)))'
                      : 'calc(100dvh - (48px + env(safe-area-inset-top,0px) + 250px + env(safe-area-inset-bottom,0px)))')
                  : undefined,
                minHeight: mobileThreadOpen ? 0 : 300,
                maxHeight: lockPageScroll ? '100%' : undefined,
              }}
            >

              {/* Thread list */}
              <div className={`${activeThread ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-80 shrink-0 rounded-2xl border overflow-hidden`} style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(15,118,110,0.08)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
                  <p className="text-xs font-black uppercase tracking-[0.1em]" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#a3a3a3' }}>{threads.length} conversation{threads.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex-1 overflow-y-auto pb-[calc(112px+env(safe-area-inset-bottom,0px))] sm:pb-0" style={{ scrollbarWidth: 'none' }}>
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
                <div className="relative flex-1 flex flex-col rounded-2xl border overflow-hidden" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(15,118,110,0.08)' }}>
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
                      <div className="relative shrink-0" ref={actionsRef} data-thread-actions>
                        <button
                          onClick={() => setActionsOpen((v) => !v)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center"
                          style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d1d5db' : '#4b5563' }}
                          aria-label="Conversation actions"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6h.01M12 12h.01M12 18h.01" />
                          </svg>
                        </button>
                        {actionsOpen && (
                          <div
                            className="absolute right-0 top-full mt-2 w-44 rounded-xl border shadow-lg overflow-hidden z-50"
                            style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}
                          >
                            <button
                              onClick={async () => {
                                if (actionBusy) return;
                                setActionBusy(true);
                                await updateBlock(blockedByUser ? 'unblock' : 'block');
                                setActionBusy(false);
                                setActionsOpen(false);
                              }}
                              disabled={actionBusy}
                              className="w-full text-left px-3.5 py-2.5 text-xs font-semibold transition-colors hover:bg-accent/10 disabled:opacity-50"
                              style={{ color: blockedByUser ? '#0F766E' : (dm ? '#fca5a5' : '#b91c1c') }}
                            >
                              {blockedByUser ? 'Unblock business' : 'Block business'}
                            </button>
                            <button
                              onClick={reportAndBlock}
                              disabled={actionBusy}
                              className="w-full text-left px-3.5 py-2.5 text-xs font-semibold transition-colors hover:bg-accent/10 disabled:opacity-50"
                              style={{ color: dm ? '#fca5a5' : '#b91c1c' }}
                            >
                              Report and block
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pinned latest booking indicator */}
                  <div className="px-4 py-2.5 border-b" style={{ background: dm ? '#121212' : '#f8fafc', borderColor: dm ? '#262626' : '#e5e7eb' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">Latest Booking</p>
                        <p className="text-xs font-semibold truncate mt-0.5" style={{ color: dm ? '#e5e7eb' : '#1f2937' }}>{activeThread.service}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[activeThread.status] || 'bg-neutral-300'}`} />
                        <span className="text-[11px] text-neutral-500 capitalize">{activeThread.status}</span>
                        <span className="text-[11px] text-neutral-400">
                          {new Date(activeThread.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'none', background: dm ? '#0d0d0d' : '#f8fafc' }}>
                    {messages.length === 0 && (
                      <div className="text-center py-6">
                        <p className="text-sm text-neutral-400">No messages yet.</p>
                        <p className="text-xs text-neutral-300 mt-1">Send a message to get in touch with {activeThread.businesses?.name || 'the business'}.</p>
                      </div>
                    )}

                    {messageBlocks.map((block, i) => {
                      const ts = block.ts;
                      const previousTs = i > 0 ? messageBlocks[i - 1].ts : null;
                      const showTime = i === 0 || (previousTs ? new Date(ts).getTime() - new Date(previousTs).getTime() > 300000 : false);
                      const isUser = block.kind === 'media'
                        ? block.sender === 'user'
                        : block.msg.sender_type === 'user';
                      return (
                        <div key={block.kind === 'media' ? `${block.items[0]?.id}-group` : block.msg.id}>
                          {showTime && <p className="text-center text-[10px] text-neutral-400 py-1">{fmtTime(ts)}</p>}
                          <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            {block.kind === 'media' ? (
                              <div className={`max-w-[78%] rounded-2xl p-2 ${isUser ? 'bg-accent rounded-br-md' : (dm ? 'bg-neutral-800 border border-neutral-700 rounded-bl-md' : 'bg-white border border-neutral-200 rounded-bl-md')}`}>
                                <div>
                                  {(() => {
                                    const mediaItems = block.items.filter((m) => !!m.image_url);
                                    const urls = mediaItems.map((m) => m.image_url).filter(Boolean) as string[];
                                    const previewItems = mediaItems.slice(0, 3);
                                    return (
                                      <button
                                        onClick={() => { if (urls.length > 0) setGallery({ urls, index: 0 }); }}
                                        className="block text-left"
                                      >
                                        <div className="relative w-[200px] sm:w-[240px] h-[118px] sm:h-[132px]">
                                          {previewItems.map((item, stackIndex) => {
                                            const remaining = previewItems.length - stackIndex - 1;
                                            const offset = remaining * 16;
                                            return (
                                              <div
                                                key={item.id}
                                                className="absolute top-0 overflow-hidden rounded-xl border"
                                                style={{
                                                  right: `${offset}px`,
                                                  width: '170px',
                                                  height: '100%',
                                                  zIndex: stackIndex + 1,
                                                  borderColor: dm ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
                                                  boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
                                                  background: dm ? '#0d0d0d' : '#f3f4f6',
                                                }}
                                              >
                                                {item.message_type === 'video' ? (
                                                  <div className="h-full flex items-center justify-center text-xs font-semibold" style={{ color: isUser ? 'white' : (dm ? '#d1d5db' : '#374151') }}>
                                                    Video
                                                  </div>
                                                ) : (
                                                  <img src={item.image_url || ''} alt="Shared media" className="w-full h-full object-cover" />
                                                )}
                                              </div>
                                            );
                                          })}
                                          {block.items.length > 1 && (
                                            <div
                                              className="absolute bottom-2 right-2 h-6 min-w-6 px-2 rounded-full text-[10px] font-black flex items-center justify-center"
                                              style={{ background: 'rgba(0,0,0,0.72)', color: 'white' }}
                                            >
                                              +{block.items.length - 1}
                                            </div>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                isUser
                                  ? 'bg-accent text-white rounded-br-md'
                                  : dm ? 'bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-bl-md' : 'bg-white text-neutral-800 border border-neutral-200 rounded-bl-md'
                              }`}>
                                {block.msg.content}
                                {!!block.msg.image_url && (
                                  <button
                                    onClick={() => setGallery({ urls: [block.msg.image_url as string], index: 0 })}
                                    className="block mt-2 text-left"
                                  >
                                    <img src={block.msg.image_url} alt="Shared media" className="w-full max-w-[220px] rounded-xl object-cover" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  <div className="px-4 py-3 border-t" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                    {eduGateMessage && (
                      <div className="mb-2 rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-2"
                        style={{ borderColor: '#f59e0b', background: dm ? 'rgba(245,158,11,0.12)' : '#fff7ed', color: dm ? '#fbbf24' : '#9a3412' }}>
                        <span>{eduGateMessage}</span>
                        <button
                          className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold"
                          style={{ background: '#0F766E', color: 'white' }}
                          onClick={() => router.push('/account')}
                        >
                          Verify
                        </button>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder={blockedByUser ? 'You blocked this business. Unblock to send messages.' : `Message ${activeThread.businesses?.name || 'the business'}…`}
                        rows={1}
                        className="flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all leading-relaxed"
                        style={{ maxHeight: 120, background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#f3f4f6' : '#171717' }}
                        disabled={blockedByUser}
                      />
                      <button onClick={sendMessage} disabled={!input.trim() || sending || blockedByUser}
                        className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                        style={{ background: input.trim() ? '#0F766E' : '#e5e7eb' }}>
                        <svg className={`h-4 w-4 ${input.trim() ? 'text-white' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1.5 px-1">{blockedByUser ? 'Messaging disabled for this conversation.' : '↵ to send · Shift+↵ for new line'}</p>
                  </div>
                  {gallery && galleryCurrent && (
                    <div
                      className="absolute inset-0 z-50 flex items-center justify-center p-4"
                      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' }}
                      onClick={() => setGallery(null)}
                    >
                      <div
                        className="relative w-full max-w-3xl rounded-2xl overflow-hidden"
                        style={{ background: dm ? '#111111' : 'white', border: dm ? '1px solid #262626' : '1px solid #e5e7eb' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <img src={galleryCurrent} alt="Media preview" className="w-full max-h-[68vh] object-contain bg-black" />
                        <div className="flex items-center justify-between px-3 py-2.5" style={{ background: dm ? '#171717' : '#f8fafc' }}>
                          <p className="text-xs font-semibold" style={{ color: dm ? '#d1d5db' : '#374151' }}>
                            {gallery.index + 1} / {gallery.urls.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setGallery((prev) => prev ? { ...prev, index: (prev.index - 1 + prev.urls.length) % prev.urls.length } : prev)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center"
                              style={{ background: dm ? '#262626' : '#e5e7eb' }}
                              aria-label="Previous image"
                            >
                              <svg className="h-4 w-4" style={{ color: dm ? '#f3f4f6' : '#374151' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setGallery((prev) => prev ? { ...prev, index: (prev.index + 1) % prev.urls.length } : prev)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center"
                              style={{ background: dm ? '#262626' : '#e5e7eb' }}
                              aria-label="Next image"
                            >
                              <svg className="h-4 w-4" style={{ color: dm ? '#f3f4f6' : '#374151' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setGallery(null)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center"
                              style={{ background: dm ? '#262626' : '#e5e7eb' }}
                              aria-label="Close gallery"
                            >
                              <svg className="h-4 w-4" style={{ color: dm ? '#f3f4f6' : '#374151' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex flex-1 items-center justify-center rounded-2xl border" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(15,118,110,0.08)' }}>
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

export default MessagesPage;
