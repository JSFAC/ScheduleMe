// pages/business/dashboard.tsx — ScheduleMe Business Dashboard
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useDm } from '../../lib/DarkModeContext';

import { SkeletonBookingCard, SkeletonThread } from '../../components/SkeletonCard';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type TabId = 'overview' | 'bookings' | 'messages' | 'clients' | 'calendar' | 'settings' | 'preview';

interface Booking {
  id: string; service: string; status: string; created_at: string;
  scheduled_start?: string; scheduled_end?: string;
  amount_cents: number | null; paid_at: string | null;
  profiles: { name: string; phone: string; email: string } | null;
}
interface Business {
  id: string; name: string; owner_name: string; owner_email: string;
  phone?: string; description?: string;
  stripe_account_id: string | null; stripe_onboarded: boolean;
  service_tags: string[]; address: string; rating: number | null;
  is_onboarded: boolean; website?: string; instagram?: string;
  school_domain?: string | null; edu_verified?: boolean;
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
  { id: 'preview',   label: 'Edit',   d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
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

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  };
}


// ─── Floating Action Button nav for mobile ────────────────────────────────────
function MobileFAB({ tab, setTab, pendingCount, totalUnreadMsgs, dm }: {
  tab: TabId; setTab: (t: TabId) => void;
  pendingCount: number; totalUnreadMsgs: number; dm: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 120 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, bx: 0, by: 0 });

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: pos.x, by: pos.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragging.current = true;
    if (dragging.current) {
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 56, dragStart.current.bx + dx)),
        y: Math.max(80, Math.min(window.innerHeight - 160, dragStart.current.by + dy)),
      });
    }
  }
  function onPointerUp() {
    if (!dragging.current) setOpen(o => !o);
  }

  const navItems = [
    { id: 'overview' as TabId, label: 'Overview', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5' },
    { id: 'bookings' as TabId, label: 'Bookings', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5' },
    { id: 'messages' as TabId, label: 'Messages', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
    { id: 'clients' as TabId, label: 'Clients', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z' },
    { id: 'preview' as TabId, label: 'Edit', icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'settings' as TabId, label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <div className="lg:hidden" style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}>
      {/* Dropdown menu */}
      {open && (
        <div className="absolute w-52 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: dm ? '#171717' : 'white',
            border: `1px solid ${dm ? '#262626' : '#e5e7eb'}`,
            ...(pos.y > window.innerHeight / 2 ? { bottom: '100%', marginBottom: 8 } : { top: '100%', marginTop: 8 }),
            ...(pos.x > window.innerWidth / 2 ? { right: 0 } : { left: 0 }),
            animation: 'fadeUp 0.2s ease forwards',
          }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setTab(item.id); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
              style={{ background: tab === item.id ? (dm ? 'rgba(10,132,255,0.15)' : '#EBF4FF') : 'transparent', color: tab === item.id ? '#0A84FF' : (dm ? '#d1d5db' : '#374151') }}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
              {item.id === 'bookings' && pendingCount > 0 && (
                <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-500 text-white tabular-nums min-w-[18px] text-center">{pendingCount}</span>
              )}
              {item.id === 'messages' && totalUnreadMsgs > 0 && (
                <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full bg-accent text-white">{totalUnreadMsgs}</span>
              )}
            </button>
          ))}
          <div style={{ height: 1, background: dm ? '#262626' : '#f0f0f0' }} />
          <a href="/home"
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium"
            style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
            Back to Consumer App
          </a>
        </div>
      )}

      {/* FAB button */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="h-12 w-12 rounded-2xl shadow-lg flex items-center justify-center touch-none select-none"
        style={{ background: open ? '#0A84FF' : (dm ? '#171717' : 'white'), border: open ? '1px solid #0A84FF' : `1px solid ${dm ? '#262626' : '#e5e7eb'}`, cursor: 'grab', outline: 'none', WebkitTapHighlightColor: 'transparent' }}>
        {open ? (
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: dm ? 'white' : '#374151' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
        {/* Badge for pending items */}
        {(pendingCount > 0 || totalUnreadMsgs > 0) && !open && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
            {pendingCount + totalUnreadMsgs}
          </span>
        )}
      </button>
    </div>
  );
}


// ─── Editable Preview Component ───────────────────────────────────────────────
function EditablePreview({ business, mediaImages, mediaVideo, editDesc, setEditDesc, setMediaImages, setMediaVideo, setBusiness, dm }: {
  business: any; mediaImages: string[]; mediaVideo: string;
  editDesc: string; setEditDesc: (v: string) => void;
  setMediaImages: (imgs: string[]) => void; setMediaVideo: (v: string) => void;
  setBusiness: (fn: (b: any) => any) => void; dm: boolean;
}) {
  const [tab, setTab] = useState<'card' | 'modal'>('card');
  const [editingCard, setEditingCard] = useState(false);
  const [editingModal, setEditingModal] = useState(false);
  const [imgs, setImgs] = useState(mediaImages);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [stripDragOver, setStripDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeImg, setActiveImg] = useState<string | null>(null);
  const [modalDesc, setModalDesc] = useState(editDesc);
  const [unsaved, setUnsaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setImgs(mediaImages); }, [mediaImages]);
  useEffect(() => { setActiveImg(null); }, [imgs]);

  const bg = dm ? '#1c1c1e' : 'white';
  const border = dm ? '#2c2c2e' : '#e5e7eb';
  const subtle = dm ? '#2c2c2e' : '#f2f2f7';
  const muted = dm ? '#8e8e93' : '#8e8e93';

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await getSupabase().auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  async function uploadFiles(files: File[]) {
    if (!business || files.length === 0) return;
    setUploading(true);
    const results: string[] = [];
    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      await new Promise<void>(resolve => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          try {
            const h = await getAuthHeaders();
            const res = await fetch('/api/upload-media', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ business_id: business.id, media_type: isVideo ? 'video' : 'image', file_data: base64, file_type: file.type, file_name: file.name }) });
            const data = await res.json();
            if (data.url) { if (isVideo) setMediaVideo(data.url); else results.push(data.url); }
          } finally { resolve(); }
        };
        reader.readAsDataURL(file);
      });
    }
    if (results.length > 0) { const next = [...imgs, ...results]; setImgs(next); setMediaImages(next); }
    setUploading(false);
  }

  function onDragStart(i: number) { setDragIdx(i); }
  function onDragOverImg(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const next = [...imgs]; const [m] = next.splice(dragIdx, 1); next.splice(i, 0, m);
    setImgs(next); setDragIdx(i);
  }
  async function onDragEnd() { setDragIdx(null); setMediaImages(imgs); if (business) await getSupabase().from('businesses').update({ media_urls: imgs, cover_url: imgs[0] || null }).eq('id', business.id); }
  async function removeImg(i: number) { const next = imgs.filter((_,j) => j !== i); setImgs(next); setMediaImages(next); if (business) await getSupabase().from('businesses').update({ media_urls: next, cover_url: next[0] || null }).eq('id', business.id); }
  async function saveDesc() { if (!business) return; await getSupabase().from('businesses').update({ description: editDesc }).eq('id', business.id); setBusiness((b: any) => b ? { ...b, description: editDesc } : b); }

  function switchTab(next: 'card' | 'modal') {
    const editing = tab === 'card' ? editingCard : editingModal;
    if (editing && unsaved) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    setEditingCard(false); setEditingModal(false); setUnsaved(false); setTab(next);
  }

  // ── Photo strip (shared) ───────────────────────────────────────────────────
  const photoStrip = (editing: boolean) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold" style={{ color: muted }}>Photos & Video</p>
        {imgs.length > 0 && editing && <p className="text-[10px]" style={{ color: muted }}>Drag to reorder · tap × to remove</p>}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
        onDragOver={editing ? e => { e.preventDefault(); setStripDragOver(true); } : undefined}
        onDragLeave={editing ? () => setStripDragOver(false) : undefined}
        onDrop={editing ? e => { e.preventDefault(); setStripDragOver(false); uploadFiles(Array.from(e.dataTransfer.files)); } : undefined}>
        {imgs.map((url, i) => (
          <div key={url} draggable={editing}
            onDragStart={editing ? () => onDragStart(i) : undefined}
            onDragOver={editing ? e => onDragOverImg(e, i) : undefined}
            onDragEnd={editing ? onDragEnd : undefined}
            className="relative flex-shrink-0 rounded-xl overflow-hidden"
            style={{ width: 72, height: 72, opacity: dragIdx === i ? 0.4 : 1, cursor: editing ? 'grab' : 'pointer', border: (activeImg === url || (!activeImg && i === 0)) ? '2px solid #0A84FF' : `1px solid ${border}` }}
            onClick={() => setActiveImg(url)}>
            <img src={url} alt="" className="w-full h-full object-cover" />
            {i === 0 && <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold py-0.5" style={{ background: 'rgba(10,132,255,0.85)', color: 'white' }}>COVER</div>}
            {editing && (
              <button onClick={e => { e.stopPropagation(); removeImg(i); }}
                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
        {editing && (
          <div className="flex-shrink-0 rounded-xl flex flex-col items-center justify-center cursor-pointer"
            style={{ width: 72, height: 72, border: `2px dashed ${stripDragOver ? '#0A84FF' : border}`, background: stripDragOver ? (dm ? 'rgba(10,132,255,0.1)' : '#EBF4FF') : 'transparent' }}
            onClick={() => fileInputRef.current?.click()}>
            {uploading ? <div className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" /> : (
              <><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke={muted} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              <span style={{ fontSize: 9, fontWeight: 700, color: muted }}>Add</span></>
            )}
          </div>
        )}
      </div>
      {mediaVideo && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: subtle }}>
          <svg className="h-4 w-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
          <span className="text-sm flex-1" style={{ color: dm ? '#d1d5db' : '#374151' }}>Promo video attached</span>
          {editing && <button onClick={async () => { setMediaVideo(''); if (business) await getSupabase().from('businesses').update({ video_url: null }).eq('id', business.id); }} className="text-xs font-semibold text-red-500">Remove</button>}
        </div>
      )}
    </div>
  );

  // ── Card preview ────────────────────────────────────────────────────────────
  const displayImg = activeImg || imgs[0];
  const cardPreview = (
    <div className="space-y-4">
      {/* Preview card */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: bg, borderColor: border }}>
        {/* Cover */}
        <div className="relative" style={{ height: 200, background: dm ? '#2c2c2e' : '#e5e7eb' }}>
          {displayImg ? <img src={displayImg} alt="" className="w-full h-full object-cover" /> : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm" style={{ color: muted }}>No photos yet</p>
            </div>
          )}
          <button onClick={() => setEditingCard(e => !e)}
            className="absolute top-3 right-3 flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl"
            style={{ background: editingCard ? '#0A84FF' : 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(8px)' }}>
            {editingCard ? <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Done</> : <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>Edit</>}
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h2 className="text-lg font-black" style={{ color: dm ? '#f2f2f7' : '#1c1c1e', letterSpacing: '-0.02em' }}>{business?.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: muted }}>{business?.address}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              <span className="text-sm font-bold" style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}>{business?.rating ?? '—'}</span>
            </div>
          </div>

          {/* Description — editable inline */}
          {editingCard ? (
            <textarea value={editDesc} onChange={e => { setEditDesc(e.target.value); setUnsaved(true); }} onBlur={saveDesc}
              placeholder="Tell customers about your business…" rows={3}
              className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent mb-3"
              style={{ background: subtle, borderColor: border, color: dm ? '#f2f2f7' : '#1c1c1e' }} />
          ) : editDesc ? (
            <p className="text-sm leading-relaxed mb-3" style={{ color: dm ? '#ebebf0' : '#3a3a3c' }}>{editDesc}</p>
          ) : null}

          {(business?.service_tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(business!.service_tags ?? []).map((tag: string) => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: dm ? 'rgba(10,132,255,0.15)' : '#e8f0fe', color: '#0A84FF' }}>{tag.replace(/_/g, ' ')}</span>
              ))}
            </div>
          )}

          {/* Photo strip */}
          {photoStrip(editingCard)}
        </div>
      </div>
    </div>
  );

  // ── Modal preview ───────────────────────────────────────────────────────────
  const modalPreview = (
    <div className="rounded-2xl overflow-hidden border" style={{ background: bg, borderColor: border }}>
      {/* Header image */}
      <div style={{ height: 180, background: dm ? '#2c2c2e' : '#e5e7eb', position: 'relative' }}>
        {displayImg ? <img src={displayImg} alt="" className="w-full h-full object-cover" /> : null}
        {/* Photo thumbnails */}
        {imgs.length > 1 && (
          <div className="absolute bottom-2 left-3 flex gap-1.5" style={{ maxWidth: 'calc(100% - 60px)' }}>
            {imgs.slice(0,5).map((url, i) => (
              <div key={i} className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer" style={{ width: 44, height: 32, border: `2px solid ${displayImg === url ? '#fff' : 'rgba(255,255,255,0.4)'}`, opacity: displayImg === url ? 1 : 0.6 }} onClick={() => setActiveImg(url)}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setEditingModal(e => !e)}
          className="absolute top-3 right-3 flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl"
          style={{ background: editingModal ? '#0A84FF' : 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(8px)' }}>
          {editingModal ? <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Done</> : <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>Edit</>}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Name + rating */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black" style={{ color: dm ? '#f2f2f7' : '#1c1c1e', letterSpacing: '-0.02em' }}>{business?.name}</h2>
            <p className="text-xs mt-0.5" style={{ color: muted }}>{business?.address}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-full" style={{ background: subtle }}>
            <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            <span className="text-sm font-bold" style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}>{business?.rating ?? '—'}</span>
            {(business?.review_count ?? 0) > 0 && <span className="text-xs" style={{ color: muted }}>({business.review_count})</span>}
          </div>
        </div>

        {/* Description — editable in modal edit mode */}
        {editingModal ? (
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: muted }}>Description</p>
            <textarea value={editDesc} onChange={e => { setEditDesc(e.target.value); setUnsaved(true); }} onBlur={saveDesc}
              placeholder="Tell customers about your business…" rows={3}
              className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ background: subtle, borderColor: border, color: dm ? '#f2f2f7' : '#1c1c1e' }} />
          </div>
        ) : editDesc ? <p className="text-sm leading-relaxed" style={{ color: dm ? '#ebebf0' : '#3a3a3c' }}>{editDesc}</p> : null}

        {/* Tags */}
        {(business?.service_tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(business!.service_tags ?? []).map((tag: string) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: dm ? 'rgba(10,132,255,0.15)' : '#e8f0fe', color: '#0A84FF' }}>{tag.replace(/_/g, ' ')}</span>
            ))}
          </div>
        )}

        {/* Contact info */}
        <div className="rounded-xl p-3.5 space-y-2" style={{ background: subtle }}>
          <p className="text-[10px] font-black uppercase tracking-wider mb-2.5" style={{ color: muted }}>Contact Info</p>
          {[
            { icon: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z', val: business?.phone, edit: 'phone', placeholder: '+1 (555) 000-0000' },
            { icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75', val: business?.owner_email, edit: null },
            { icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3', val: business?.website, edit: 'website', placeholder: 'https://yourwebsite.com' },
          ].map(({ icon, val, edit, placeholder }) => (
            <div key={icon} className="flex items-center gap-2.5">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#0A84FF" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
              {editingModal && edit ? (
                <input className="flex-1 text-sm bg-transparent border-b focus:outline-none focus:border-accent"
                  style={{ color: dm ? '#f2f2f7' : '#1c1c1e', borderColor: dm ? '#404040' : '#d1d5db' }}
                  defaultValue={val || ''} placeholder={placeholder}
                  onBlur={async e => { if (business) { await getSupabase().from('businesses').update({ [edit]: e.target.value }).eq('id', business.id); setBusiness((b: any) => b ? { ...b, [edit]: e.target.value } : b); } }} />
              ) : (
                <span className="text-sm" style={{ color: val ? (dm ? '#ebebf0' : '#3a3a3c') : muted }}>{val || <em>Not set</em>}</span>
              )}
            </div>
          ))}
        </div>

        {/* Photos in modal tab */}
        {photoStrip(editingModal)}

        {/* Book CTA */}
        <div className="rounded-xl py-3.5 text-center text-sm font-bold" style={{ background: 'linear-gradient(135deg,#0A84FF 0%,#0066CC 100%)', color: 'white' }}>
          Book {business?.name}
        </div>
        <p className="text-xs text-center" style={{ color: muted }}>Calendar availability and reviews appear in the live modal</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex rounded-xl p-1 gap-1" style={{ background: dm ? '#2c2c2e' : '#f2f2f7' }}>
        {(['card', 'modal'] as const).map(mode => (
          <button key={mode} onClick={() => switchTab(mode)}
            className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ background: tab === mode ? bg : 'transparent', color: tab === mode ? (dm ? '#f2f2f7' : '#1c1c1e') : muted, boxShadow: tab === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {mode === 'card' ? 'Card View' : 'Modal View'}
          </button>
        ))}
      </div>

      {tab === 'card' ? cardPreview : modalPreview}

      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={e => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
    </div>
  );
}


const BusinessDashboard: NextPage = () => {
  const router = useRouter();
  const { dm: darkMode, toggle: toggleDark } = useDm();
  const dm = darkMode;
  const VALID_TABS: TabId[] = ['overview','bookings','messages','clients','calendar','settings'];
  const [tab, setTab] = useState<TabId>('overview');

  // Read tab from URL hash on mount and on hash change
  useEffect(() => {
    function readHash() {
      const hash = window.location.hash.replace('#', '') as TabId;
      if (VALID_TABS.includes(hash)) setTab(hash);
    }
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);
  const [business, setBusiness] = useState<Business | null>(null);

  // Sync tab changes to URL hash so refresh restores position
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.replace('#','') !== tab) {
      history.replaceState(null, '', '#' + tab);
    }
  }, [tab]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [campusEduEmail, setCampusEduEmail] = useState('');
  const [campusCodeSent, setCampusCodeSent] = useState(false);
  const [campusBannerDismissed, setCampusBannerDismissed] = useState(false);
  const [bookingPrices, setBookingPrices] = useState<Record<string, string>>({});
  const [campusCode, setCampusCode] = useState('');
  const [campusVerifying, setCampusVerifying] = useState(false);
  const [campusSending, setCampusSending] = useState(false);
  const [campusVerifyError, setCampusVerifyError] = useState('');
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
  const supabaseRef = useRef(getSupabase());
  const msgPollRef2 = useRef<NodeJS.Timeout | null>(null);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editServices, setEditServices] = useState('');
  const [editHours, setEditHours] = useState<Record<string, string>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [mediaImages, setMediaImages] = useState<string[]>([]);
  const [mediaVideo, setMediaVideo] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const loadData = useCallback(async () => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/business/auth/login'); return; }
    // Check profile role first — fastest gate, no extra table query needed
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'business') {
      // Consumer account — sign out and redirect, do NOT delete their account
      await supabase.auth.signOut();
      router.replace('/business/auth/login?error=not_a_business');
      return;
    }

    const { data: biz, error: bizErr } = await supabase.from('businesses').select('*').eq('owner_email', session.user.email).maybeSingle();
    if (bizErr || !biz) {
      await supabase.auth.signOut();
      router.replace('/business/auth/login?error=not_a_business');
      return;
    }
    setBusiness(biz);
    setEditName(biz.name || ''); setEditPhone(biz.phone || ''); setEditAddress(biz.address || '');
    setEditDesc(biz.description || ''); setEditWebsite(biz.website || '');
    setEditServices((biz.service_tags || []).join(', '));
    setEditHours(biz.hours || {});
    setMediaImages(biz.media_urls || (biz.cover_url ? [biz.cover_url] : []));
    setMediaVideo(biz.video_url || null);
    // Use API to fetch bookings (bypasses RLS issues with anon key)
    const bkgRes = await fetch('/api/bookings?business_id=' + biz.id, { headers: await getAuthHeaders() });
    if (bkgRes.ok) { const bkgData = await bkgRes.json(); setBookings(bkgData.bookings || []); }
    // Pre-load message threads
    const msgsRes = await fetch('/api/messages?business_id=' + biz.id, { headers: await getAuthHeaders() });
    if (msgsRes.ok) { const md = await msgsRes.json(); setMsgThreads(md.threads || []); }
    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); if (router.query.stripe === 'success') loadData(); }, [loadData, router.query]);

  // Load + subscribe to thread list when on messages tab
  useEffect(() => {
    if (tab !== 'messages' || !business) return;
    loadThreads();
    // Poll thread list every 10s for new conversations
    const interval = setInterval(loadThreads, 10000);
    return () => clearInterval(interval);
  }, [tab, business]);

  // Realtime + polling fallback for active thread messages
  useEffect(() => {
    if (!activeMsgThread) return;
    const supabase = supabaseRef.current;
    const bookingId = activeMsgThread.id;

    // Initial load
    getAuthHeaders().then(headers =>
      fetch('/api/messages?booking_id=' + bookingId, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setThreadMessages(d.messages || []); })
    );

    // Realtime subscription
    const channel = supabase
      .channel('biz-msg-' + bookingId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'booking_id=eq.' + bookingId,
      }, (payload: any) => {
        setThreadMessages(m => {
          if (m.find((x: any) => x.id === payload.new.id)) return m;
          return [...m, payload.new];
        });
        setMsgThreads((ts: any[]) => ts.map((t: any) =>
          t.id === bookingId ? { ...t, lastMessage: payload.new } : t
        ));
        setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .subscribe();

    // Always poll every 2s as fallback (realtime may not be enabled)
    if (msgPollRef2.current) clearInterval(msgPollRef2.current);
    msgPollRef2.current = setInterval(() => {
      getAuthHeaders().then(h => fetch('/api/messages?booking_id=' + bookingId, { headers: h }))
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.messages) {
            setThreadMessages(prev => {
              // Only update if there are new messages
              if (d.messages.length > prev.length) {
                setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                return d.messages;
              }
              return prev;
            });
          }
        });
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      if (msgPollRef2.current) { clearInterval(msgPollRef2.current); msgPollRef2.current = null; }
    };
  }, [activeMsgThread?.id]);

  useEffect(() => {
    msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  async function loadThreads() {
    if (!business) return;
    const res = await fetch('/api/messages?business_id=' + business.id, { headers: await getAuthHeaders() });
    if (res.ok) { const d = await res.json(); setThreads(d.threads || []); }
  }

  async function loadThreadMessages(bookingId: string) {
    const res = await fetch('/api/messages?booking_id=' + bookingId, { headers: await getAuthHeaders() });
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

  async function handleCampusSendCode() {
    setCampusSending(true); setCampusVerifyError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/verify-edu', {
        method: 'POST',
        headers,
        body: JSON.stringify({ school_email: campusEduEmail, account_type: 'business' }),
      });
      const data = await res.json();
      if (!res.ok) { setCampusVerifyError(data.error); return; }
      setCampusCodeSent(true);
    } catch { setCampusVerifyError('Something went wrong.'); }
    finally { setCampusSending(false); }
  }

  async function handleCampusVerify() {
    setCampusVerifying(true); setCampusVerifyError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/verify-edu', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'verify', code: campusCode, account_type: 'business' }),
      });
      const data = await res.json();
      if (!res.ok) { setCampusVerifyError(data.error); return; }
      setBusiness(b => b ? { ...b, edu_verified: true } : b);
    } catch { setCampusVerifyError('Something went wrong.'); }
    finally { setCampusVerifying(false); }
  }

  async function handleSetPrice(bookingId: string, amountCents: number) {
    const supabase = getSupabase();
    await supabase.from('bookings').update({ amount_cents: amountCents }).eq('id', bookingId);
    setBookings(bs => bs.map(b => b.id === bookingId ? { ...b, amount_cents: amountCents } : b));
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
    setBusiness(b => b ? { ...b, name: editName, phone: editPhone, address: editAddress, description: editDesc, website: editWebsite, service_tags: tags, hours: editHours } : b);
    setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2500);
  }

  async function handleSignOut() { await getSupabase().auth.signOut(); router.push('/business/auth/login'); }

  // While loading, render nothing — the _app.tsx overlay covers this transition
  if (loading) return <div className="min-h-screen" style={{ background: '#0a0a0a' }} />;

  const totalEarned = bookings.filter(b => b.status === 'paid' || b.status === 'completed').reduce((s, b) => s + (b.amount_cents || 0), 0);
  const totalUnreadMsgs = msgThreads.reduce((s: number, t: any) => s + (t.unreadCount || 0), 0);
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const completedCount = bookings.filter(b => b.status === 'completed' || b.status === 'paid').length;
  const uniqueClients = new Set(bookings.map(b => b.profiles?.email).filter(Boolean)).size;
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
    if (!b.profiles?.email) return;
    const ex = clientMap.get(b.profiles.email);
    if (ex) { ex.bookingCount++; ex.totalSpent += b.amount_cents || 0; if (b.created_at > ex.lastBooking) ex.lastBooking = b.created_at; }
    else clientMap.set(b.profiles.email, { name: b.profiles.name, email: b.profiles.email, phone: b.profiles.phone, bookingCount: 1, totalSpent: b.amount_cents || 0, lastBooking: b.created_at });
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
              <button key={item.id} onClick={() => { setTab(item.id); history.replaceState(null, '', '#' + item.id); }}
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
            <Link href="/home" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              Consumer site
            </Link>
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex-1 lg:ml-60 flex flex-col min-h-screen pb-20 lg:pb-0">
          {/* Mobile topbar — just the business name */}
          <header className="lg:hidden border-b px-4 py-3 flex items-center sticky top-0 z-20"
            style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f0f0f0' }}>
            <span className="text-base font-black" style={{ letterSpacing: '-0.02em', color: dm ? '#f3f4f6' : '#171717' }}>{business?.name || 'Dashboard'}</span>
          </header>

          {/* Mobile bottom tab bar */}
          {/* Mobile FAB — floating draggable nav button */}
          <MobileFAB
            tab={tab}
            setTab={(t) => { setTab(t); history.replaceState(null, '', '#' + t); }}
            pendingCount={pendingCount}
            totalUnreadMsgs={totalUnreadMsgs}
            dm={dm}
          />

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

          {/* Campus verification banner */}
          {business?.school_domain && !business?.edu_verified && !campusBannerDismissed && (
            <div className="rounded-2xl border p-4 relative" style={{ background: dm ? 'rgba(139,92,246,0.1)' : '#f5f3ff', borderColor: dm ? 'rgba(139,92,246,0.3)' : '#ddd6fe' }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-0.5" style={{ color: dm ? '#c4b5fd' : '#6d28d9' }}>
                    Complete your campus verification
                  </p>
                  <p className="text-xs mb-3" style={{ color: dm ? '#a78bfa' : '#7c3aed' }}>
                    Verify your <strong>{business.school_domain}</strong> email to go live on the campus feed.
                    You must use an @{business.school_domain} email address.
                  </p>
                  {!campusCodeSent ? (
                    <div className="flex gap-2">
                      <input type="email" placeholder={`you@${business.school_domain}`}
                        value={campusEduEmail} onChange={e => setCampusEduEmail(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500"
                        style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#ddd6fe', color: dm ? '#f3f4f6' : '#171717' }} />
                      <button onClick={handleCampusSendCode}
                        disabled={campusSending || !campusEduEmail.endsWith(business.school_domain || '')}
                        className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                        style={{ background: '#7c3aed', color: 'white' }}>
                        {campusSending ? 'Sending…' : 'Send Code'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" placeholder="6-digit code" maxLength={6}
                        value={campusCode} onChange={e => setCampusCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="flex-1 px-3 py-2 text-sm rounded-xl border text-center tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                        style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#ddd6fe', color: dm ? '#f3f4f6' : '#171717' }} />
                      <button onClick={handleCampusVerify}
                        disabled={campusVerifying || campusCode.length !== 6}
                        className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                        style={{ background: '#7c3aed', color: 'white' }}>
                        {campusVerifying ? 'Verifying…' : 'Verify'}
                      </button>
                    </div>
                  )}
                  {campusVerifyError && <p className="text-xs text-red-500 mt-2">{campusVerifyError}</p>}
                </div>
              </div>
              <button onClick={() => setCampusBannerDismissed(true)} className="absolute top-3 right-3 h-6 w-6 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#ede9fe', color: dm ? '#a78bfa' : '#7c3aed' }}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          {business?.edu_verified && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg self-start" style={{ background: dm ? 'rgba(139,92,246,0.12)' : '#f5f3ff', border: `1px solid ${dm ? 'rgba(139,92,246,0.2)' : '#ddd6fe'}` }}>
              <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              <p className="text-xs font-semibold" style={{ color: dm ? '#c4b5fd' : '#6d28d9' }}>Campus verified · {business.school_domain}</p>
            </div>
          )}

          <main className="flex-1 px-6 py-7 max-w-5xl mx-auto w-full">
            <div className="mb-7">
              <h1 className="text-[1.5rem] font-black" style={{ letterSpacing: '-0.025em', color: dm ? '#f2f2f7' : '#1c1c1e' }}>{NAV.find(n => n.id === tab)?.label}</h1>
              {tab === 'overview' && <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>Welcome back, {business?.owner_name?.split(' ')[0] || 'there'}</p>}
              {tab === 'bookings' && <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>{bookings.length} total · {pendingCount} pending</p>}
              {tab === 'clients' && <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>{clients.length} unique clients</p>}
            {tab === 'messages' && <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>{threads.length} conversation{threads.length !== 1 ? 's' : ''}</p>}
            </div>

            {/* Dismissed campus banner — show small indicator in overview */}
            {campusBannerDismissed && business?.school_domain && !business?.edu_verified && tab === 'overview' && (
              <button onClick={() => setCampusBannerDismissed(false)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 self-start" style={{ background: dm ? 'rgba(139,92,246,0.12)' : '#f5f3ff', border: `1px solid ${dm ? 'rgba(139,92,246,0.2)' : '#ddd6fe'}` }}>
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <p className="text-xs font-semibold" style={{ color: dm ? '#c4b5fd' : '#6d28d9' }}>Campus verification pending — tap to complete</p>
              </button>
            )}

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
                    <div key={s.label} className="rounded-2xl border p-5" style={{ background: dm ? '#1c1c1e' : 'white', borderColor: dm ? '#2c2c2e' : '#f0f0f0' }}>
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3" style={{ background: dm ? 'rgba(255,255,255,0.06)' : undefined }}>
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
                              <p className="text-sm font-semibold text-neutral-900 truncate">{b.profiles?.name || 'Unknown'}</p>
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
                      {filteredBookings.map((b, i) => (
                        <div key={b.id} className="bg-white rounded-2xl border border-neutral-100 px-5 py-4">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-accent text-sm font-black">{(b.profiles?.name || '?').charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold" style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}>{b.profiles?.name || 'Unknown'}</p>
                                <p className="text-[12px] mt-0.5 line-clamp-1" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>{b.service}</p>
                              </div>
                            </div>
                            <StatusBadge status={b.status} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3" style={{ color: dm ? '#636366' : '#9ca3af' }}>
                            <span>{fmtTime(b.created_at)}</span>
                            {b.profiles?.phone && <span>{b.profiles.phone}</span>}
                            {b.profiles?.email && <span>{b.profiles.email}</span>}
                            {b.amount_cents && <span className="text-neutral-700 font-semibold">{fmt(b.amount_cents)}</span>}
                          </div>
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <div className="flex gap-2">
                              {/* Price setting — required before confirm */}
                              {b.status === 'pending' && (
                                <div className="w-full mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center rounded-xl border overflow-hidden" style={{ borderColor: dm ? '#404040' : '#e5e7eb' }}>
                                      <span className="px-2.5 text-sm font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>$</span>
                                      <input
                                        type="number" min="1" step="0.01" placeholder="Set price"
                                        className="flex-1 py-1.5 pr-2 text-sm bg-transparent focus:outline-none"
                                        style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}
                                        value={bookingPrices[b.id] ?? (b.amount_cents ? (b.amount_cents / 100).toFixed(2) : '')}
                                        onChange={e => setBookingPrices(p => ({ ...p, [b.id]: e.target.value }))}
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        const dollars = parseFloat(bookingPrices[b.id] || '0');
                                        if (dollars > 0) handleSetPrice(b.id, Math.round(dollars * 100));
                                        handleUpdateBooking(b.id, 'confirmed');
                                      }}
                                      disabled={!bookingPrices[b.id] && !b.amount_cents}
                                      className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl bg-accent text-white disabled:opacity-40">
                                      Confirm & Set Price
                                    </button>
                                  </div>
                                  <p className="text-[10px] mt-1" style={{ color: dm ? '#636366' : '#9ca3af' }}>Set the price — customer will be prompted to pay after confirmation</p>
                                </div>
                              )}
                              {b.status === 'confirmed' && (
                                <button onClick={() => handleUpdateBooking(b.id, 'completed')} className="text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">Mark Complete</button>
                              )}
                              {b.paid_at && <span className="text-xs font-bold text-emerald-600 px-2">✓ Paid {fmt(b.amount_cents || 0)}</span>}
                              <button onClick={() => handleUpdateBooking(b.id, 'cancelled')} className="text-xs font-bold px-3.5 py-2 rounded-xl ml-auto" style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: dm ? '#8e8e93' : '#6b7280' }}>Cancel</button>
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
                <div className={`${activeMsgThread ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 shrink-0 rounded-2xl border overflow-hidden`} style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
                    <p className="text-xs font-black uppercase tracking-[0.1em]" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#a3a3a3' }}>{msgThreads.length} conversation{msgThreads.length !== 1 ? 's' : ''}</p>
                    {totalUnreadMsgs > 0 && <span className="text-[10px] font-black bg-accent text-white px-2 py-0.5 rounded-full">{totalUnreadMsgs} unread</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                    {loading ? (
                    <div>
                      {Array.from({ length: 4 }).map((_, i) => <SkeletonThread key={i} dm={dm} />)}
                    </div>
                  ) : msgThreads.length === 0 ? (
                      <div className="p-6 text-center text-neutral-400 text-sm">No conversations yet.</div>
                    ) : msgThreads.map((t: any) => (
                      <button key={t.id} onClick={async () => {
                        setActiveMsgThread(t);
                        setThreadMessages([]);
                        const res = await fetch('/api/messages?booking_id=' + t.id, { headers: await getAuthHeaders() });
                        if (res.ok) { const d = await res.json(); setThreadMessages(d.messages || []); }
                        if (t.unreadCount > 0) {
                          await fetch('/api/messages', { method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ booking_id: t.id, reader_type: 'business' }) });
                          setMsgThreads((ts: any[]) => ts.map((x: any) => x.id === t.id ? { ...x, unreadCount: 0 } : x));
                        }
                        setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                      }}
                        className="w-full text-left px-4 py-3.5 border-b transition-colors" style={{ borderColor: dm ? '#1e1e1e' : '#fafafa', background: activeMsgThread?.id === t.id ? (dm ? '#1e2130' : '#eff6ff') : 'transparent' }}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                              <span className="text-accent text-[10px] font-black">{(t.profiles?.name || 'U').charAt(0).toUpperCase()}</span>
                            </div>
                            <p className="text-sm font-bold truncate" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{t.profiles?.name || 'Unknown customer'}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {t.unreadCount > 0 && <span className="h-4 w-4 rounded-full bg-accent flex items-center justify-center text-[9px] font-black text-white">{t.unreadCount}</span>}
                            {t.lastMessage && <span className="text-[10px] text-neutral-400">{new Date(t.lastMessage.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                          </div>
                        </div>
                        <p className="text-[11px] truncate mb-0.5 pl-9" style={{ color: dm ? '#9ca3af' : '#737373' }}>{t.service}</p>
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
                  <div className="flex-1 flex flex-col rounded-2xl border overflow-hidden" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                    {/* Header — customer + booking info */}
                    <div className="px-5 py-3.5 border-b" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <button onClick={() => setActiveMsgThread(null)} className="lg:hidden p-1.5 rounded-lg hover:bg-neutral-100 mr-1 shrink-0">
                            <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                          </button>
                          <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <span className="text-accent font-black text-sm">{(activeMsgThread.profiles?.name || 'U').charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{activeMsgThread.profiles?.name || 'Unknown'}</p>
                            <p className="text-[11px] text-neutral-400 truncate">{activeMsgThread.profiles?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {activeMsgThread.profiles?.phone && (
                            <a href={`tel:${activeMsgThread.profiles.phone}`} className="text-xs font-semibold text-accent bg-blue-50 px-3 py-1.5 rounded-xl border border-accent/15 hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                              {activeMsgThread.profiles.phone}
                            </a>
                          )}
                          <button onClick={() => setTab('bookings')} className="text-xs font-semibold text-neutral-500 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition-colors">
                            View booking
                          </button>
                        </div>
                      </div>
                      {/* Booking summary strip */}
                      <div className="mt-3 flex items-center gap-3 px-3 py-2 rounded-xl border" style={{ background: dm ? '#0d0d0d' : '#fafafa', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-neutral-700 truncate">{activeMsgThread.service}</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">{new Date(activeMsgThread.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <StatusBadge status={activeMsgThread.status} />
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'none', background: dm ? '#0d0d0d' : '#f8fafc' }}>
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
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isBiz ? 'bg-accent text-white rounded-br-md' : (dm ? 'bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-bl-md' : 'bg-white text-neutral-800 border border-neutral-200 rounded-bl-md')}`}>
                                {msg.content}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={msgBottomRef} />
                    </div>

                    {/* Input */}
                    <div className="px-4 py-3 border-t" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
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
                          placeholder={`Reply to ${activeMsgThread.profiles?.name || 'customer'}…`}
                          rows={1}
                          className="flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all leading-relaxed"
                          style={{ maxHeight: 100, background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#f3f4f6' : '#171717' }}
                        />
                        <button
                          disabled={!msgInput.trim() || msgSending}
                          onClick={async () => {
                            if (!msgInput.trim() || msgSending) return;
                            setMsgSending(true);
                            const content = msgInput.trim(); setMsgInput('');
                            const res = await fetch('/api/messages', {
                              method: 'POST', headers: await getAuthHeaders(),
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
                  <div className="hidden lg:flex flex-1 items-center justify-center rounded-2xl border" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                    <div className="text-center">
                      <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                        <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: dm ? '#9ca3af' : '#525252' }}>Select a conversation</p>
                      <p className="text-xs mt-1" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>Choose a customer thread to reply</p>
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
                      const cb = bookings.filter(b => b.profiles?.email === c.email);
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
                        <div key={day} title={count > 0 ? dayBookings.map(b => b.profiles?.name || 'Unknown').join(', ') : ''}
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
                                  <span className="text-accent text-xs font-black">{(b.profiles?.name || '?').charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold" style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}>{b.profiles?.name || 'Unknown'}</p>
                                  <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">{b.service}</p>
                                </div>
                              </div>
                              <StatusBadge status={b.status} />
                            </div>
                            <div className="flex items-center gap-3 pl-11 text-[10px] text-neutral-400">
                              <span>📅 {bookingDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
                              {b.profiles?.phone && <span>{b.profiles.phone}</span>}
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
            {/* SETTINGS */}
            {tab === 'preview' && (
              <EditablePreview
                business={business}
                mediaImages={mediaImages}
                mediaVideo={mediaVideo ?? ''}
                editDesc={editDesc}
                setEditDesc={setEditDesc}
                setMediaImages={setMediaImages}
                setMediaVideo={setMediaVideo}
                setBusiness={setBusiness}
                dm={dm}
              />
            )}

            {tab === 'settings' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-neutral-100 p-6">
                  <h2 className="text-sm font-bold text-neutral-900 mb-5">Edit Business Profile</h2>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    {settingsError && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{settingsError}</div>}
                    {([
                      { label: 'Business Name', v: editName, s: () => {}, ph: 'Pacific Plumbing Co.', t: 'text', disabled: true, requestChange: true },
                      { label: 'Phone', v: editPhone, s: setEditPhone, ph: '(415) 555-0192', t: 'tel' },
                      { label: 'Address / City', v: editAddress, s: setEditAddress, ph: 'San Francisco, CA', t: 'text' },
                      { label: 'Website', v: editWebsite, s: setEditWebsite, ph: 'https://...', t: 'url' },
                      { label: 'Services (comma-separated)', v: editServices, s: setEditServices, ph: 'Plumbing, Drain Cleaning', t: 'text' },
                    ] as const).map((f) => (
                      <div key={f.label}>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">{f.label}</label>
                        <input type={f.t} className="form-input" value={f.v} placeholder={f.ph} onChange={e => (f as any).disabled ? undefined : (f.s as (v: string) => void)(e.target.value)} style={(f as any).disabled ? { opacity: 0.5, cursor: 'not-allowed', background: dm ? '#1a1a1a' : '#f5f5f5' } : undefined} readOnly={(f as any).disabled} />
                      {(f as any).requestChange && (
                        <button type="button" onClick={() => {
                          const newName = prompt('Enter requested new business name:');
                          if (newName?.trim()) {
                            fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': '' }, body: JSON.stringify({ type: 'new_business_application', to: 'hello@usescheduleme.com', name: `NAME CHANGE REQUEST: ${business?.name} → ${newName}`, ownerName: business?.owner_name || '', email: business?.owner_email || '', phone: '', category: '', city: '', campusProvider: false }) }).catch(() => {});
                            alert('Request sent! We\'ll update your name within 24 hours.');
                          }
                        }} className="mt-1.5 text-xs font-semibold text-accent hover:underline">
                          Request name change →
                        </button>
                      )}
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Description</label>
                      <textarea className="form-input resize-none" rows={3} value={editDesc} placeholder="Tell customers about your business…" onChange={e => setEditDesc(e.target.value)} />
                    </div>
                    {/* Business hours */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Business Hours</label>
                      <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: dm ? '#262626' : '#e5e7eb', background: dm ? '#0d0d0d' : '#f9fafb' }}>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => (
                          <div key={day} className="flex items-center gap-3">
                            <span className="text-xs font-medium w-20 shrink-0" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{day.slice(0,3)}</span>
                            <input
                              className="flex-1 text-xs px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-accent"
                              style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }}
                              placeholder="e.g. 9:00 AM – 5:00 PM or Closed"
                              value={editHours[day] || ''}
                              onChange={e => setEditHours(h => ({ ...h, [day]: e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
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
