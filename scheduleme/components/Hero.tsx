// components/Hero.tsx
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useDm } from '../lib/DarkModeContext';

interface HeroProps {
  eyebrow: string;
  headline: string;
  subheadline: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
  trustLine: string;
}

export default function Hero({
  eyebrow,
  headline,
  subheadline,
  ctaPrimary,
  ctaSecondary,
  trustLine,
}: HeroProps) {
  const { dm } = useDm();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const hasStartedSequenceRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const typingIntervalRef = useRef<number | null>(null);
  const sequenceCompleteRef = useRef(false);
  const [typedCount, setTypedCount] = useState(0);
  const [messageShellVisible, setMessageShellVisible] = useState(false);
  const [messageState, setMessageState] = useState<'typing' | 'ready' | 'sent'>('typing');
  const [matchState, setMatchState] = useState<'idle' | 'loading' | 'transition' | 'done'>('idle');
  const [visibleStudents, setVisibleStudents] = useState(0);
  const [badgeStages, setBadgeStages] = useState([0, 0, 0]);
  const [showViewAll, setShowViewAll] = useState(false);

  const HERO_MESSAGE = "Need a fade + lineup before Friday night. Near campus if possible.";
  const STUDENT_MATCHES = [
    { name: 'Camila R.', tag: 'Student barber', rating: '4.9', time: '~20 min' },
    { name: 'Jordan K.', tag: 'Campus fade specialist', rating: '4.8', time: '~35 min' },
  ];
  const BADGES = [{ label: 'Verified Pro' }, { label: 'Top Rated' }, { label: 'Nearby' }];

  const typedMessage = HERO_MESSAGE.slice(0, typedCount);
  const isTyping = typedCount > 0 && typedCount < HERO_MESSAGE.length;
  const hasTyped = typedCount >= HERO_MESSAGE.length;
  const showMessageShell = messageShellVisible;
  const showMatchShell = matchState !== 'idle';
  const messageTargetHeight =
    typedCount >= 56 ? 116 : typedCount >= 36 ? 88 : typedCount >= 22 ? 60 : 40;
  const matchSummaryLabel =
    matchState === 'done' ? '2 student barbers near you' : 'Matching you with student barbers...';

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;

    const clearAll = () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      if (typingIntervalRef.current != null) {
        window.clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };

    const completeOffscreen = () => {
      if (sequenceCompleteRef.current) return;
      clearAll();
      sequenceCompleteRef.current = true;
      setTypedCount(HERO_MESSAGE.length);
      setMessageShellVisible(true);
      setMessageState('sent');
      setMatchState('done');
      setVisibleStudents(STUDENT_MATCHES.length);
      setShowViewAll(true);
      setBadgeStages([3, 3, 3]);
    };

    const startSequence = () => {
      clearAll();
      sequenceCompleteRef.current = false;
      setTypedCount(0);
      setMessageShellVisible(false);
      setMessageState('typing');
      setMatchState('idle');
      setVisibleStudents(0);
      setBadgeStages([0, 0, 0]);
      setShowViewAll(false);

      timersRef.current.push(window.setTimeout(() => setMessageShellVisible(true), 130));
      timersRef.current.push(window.setTimeout(() => {
        typingIntervalRef.current = window.setInterval(() => {
        setTypedCount((prev) => {
          if (prev >= HERO_MESSAGE.length) {
            if (typingIntervalRef.current != null) window.clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
            setMessageState('ready');
            timersRef.current.push(window.setTimeout(() => setMessageState('sent'), 560));
            timersRef.current.push(window.setTimeout(() => setMatchState('loading'), 820));
            timersRef.current.push(window.setTimeout(() => setMatchState('transition'), 2100));
            timersRef.current.push(window.setTimeout(() => setMatchState('done'), 2820));
            timersRef.current.push(window.setTimeout(() => setVisibleStudents(1), 3100));
            timersRef.current.push(window.setTimeout(() => setVisibleStudents(2), 3460));
            timersRef.current.push(window.setTimeout(() => setShowViewAll(true), 3840));

            BADGES.forEach((_, idx) => {
              const base = 3980 + idx * 320;
              timersRef.current.push(window.setTimeout(() => setBadgeStages((cur) => cur.map((v, i) => (i === idx ? 1 : v))), base));
              timersRef.current.push(window.setTimeout(() => setBadgeStages((cur) => cur.map((v, i) => (i === idx ? 2 : v))), base + 220));
              timersRef.current.push(window.setTimeout(() => setBadgeStages((cur) => cur.map((v, i) => (i === idx ? 3 : v))), base + 430));
            });
            timersRef.current.push(window.setTimeout(() => { sequenceCompleteRef.current = true; }, 5200));
            return prev;
          }
          return prev + 1;
        });
        }, 48);
      }, 240));
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio > 0.45 && !hasStartedSequenceRef.current) {
            hasStartedSequenceRef.current = true;
            timersRef.current.push(window.setTimeout(startSequence, 420));
          }
          if (entry.intersectionRatio === 0 && hasStartedSequenceRef.current && !sequenceCompleteRef.current) {
            completeOffscreen();
          }
        });
      },
      { threshold: [0, 0.45] }
    );

    io.observe(node);
    return () => {
      io.disconnect();
      clearAll();
    };
  }, []);

  return (
    <section
      className="relative overflow-hidden pb-20 md:pt-36 md:pb-32 md:min-h-[1240px]"
      style={{ background: dm ? '#0a0a0a' : 'white', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 7.5rem)' }}
    >
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: dm
            ? 'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)'
            : 'linear-gradient(to right, #e4e4e7 1px, transparent 1px), linear-gradient(to bottom, #e4e4e7 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
        }}
      />

      {/* Accent glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(15,118,110,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 mb-6 opacity-0-init animate-fade-in">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot"
          />
          <span className="section-eyebrow">{eyebrow}</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6 opacity-0-init animate-fade-up animate-delay-100 whitespace-pre-line leading-none" style={{ color: dm ? 'white' : '#171717' }}>
          {headline}
        </h1>

        {/* Subheadline */}
        <p className="mx-auto max-w-xl text-lg md:text-xl mb-10 opacity-0-init animate-fade-up animate-delay-200 leading-relaxed" style={{ color: dm ? '#a3a3a3' : '#737373' }}>
          {subheadline}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10 opacity-0-init animate-fade-up animate-delay-300">
          <Link href={ctaPrimary.href} className="btn-primary text-base px-8 py-4 shadow-lg shadow-accent/20">
            {ctaPrimary.label}
          </Link>
          <Link href={ctaSecondary.href} className="text-base px-8 py-4 rounded-xl font-semibold inline-flex items-center justify-center transition-colors" style={{ background: dm ? 'transparent' : 'white', border: dm ? '1px solid #404040' : '1px solid #e5e5e5', color: dm ? '#d1d5db' : '#262626' }}>
            {ctaSecondary.label}
          </Link>
        </div>

        {/* Trust line */}
        <p className="text-sm opacity-0-init animate-fade-in animate-delay-400" style={{ color: dm ? '#525252' : '#a3a3a3' }}>
          {trustLine}
        </p>

        {/* Mock UI preview */}
        <div ref={previewRef} className="js-hero-shell mt-16 mx-auto max-w-2xl min-h-[470px] opacity-0-init animate-fade-up animate-delay-500">
          <div className="p-1 shadow-modal rounded-2xl" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid rgba(0,0,0,0.07)' }}>
            <div className="rounded-2xl text-left space-y-3 p-5" style={{ minHeight: 360, background: dm ? '#0f0f0f' : '#f5f5f7', border: dm ? '1px solid #1c1c1e' : '1px solid rgba(0,0,0,0.06)' }}>
              {/* User message */}
              <div className="flex items-end gap-2.5 justify-end">
                <div
                  className="js-hero-pop rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-white max-w-[300px]"
                  style={{
                    background: '#0F766E',
                    minHeight: 38,
                    maxHeight: showMessageShell ? messageTargetHeight : 38,
                    overflow: 'hidden',
                    opacity: showMessageShell ? 1 : 0,
                    transition: 'opacity 860ms ease, transform 1120ms cubic-bezier(0.22, 1.2, 0.36, 1), box-shadow 900ms cubic-bezier(0.22, 1.2, 0.36, 1), max-height 360ms cubic-bezier(0.22, 1.14, 0.36, 1)',
                    transform: showMessageShell
                      ? messageState === 'sent'
                        ? 'translateY(-2px)'
                        : 'translateY(0)'
                      : 'translateY(16px)',
                    boxShadow: messageState === 'sent' ? '0 12px 30px rgba(15,118,110,0.28)' : 'none',
                  }}
                >
                  <p className="leading-snug">
                    {typedMessage}
                    {isTyping && <span className="inline-block ml-[1px] h-[1.05em] w-[2px] align-middle bg-white/90 animate-pulse" />}
                  </p>
                </div>
                <div
                  className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white transition-all duration-700"
                  style={{
                    background: 'linear-gradient(135deg,#0F766E,#0B5C56)',
                    transform: showMessageShell ? 'translateY(0)' : 'translateY(10px)',
                    opacity: showMessageShell ? (messageState === 'sent' ? 1 : 0.74) : 0,
                  }}
                >
                  J
                </div>
              </div>
              <div
                className="pr-0.5 mt-0.5 flex justify-end min-h-[14px]"
                style={{
                  opacity: hasTyped ? 1 : 0,
                  transform: hasTyped ? 'translateY(0)' : 'translateY(6px)',
                  transition: 'opacity 640ms ease, transform 760ms cubic-bezier(0.22, 1.14, 0.36, 1)',
                }}
              >
                <p
                  className="text-[10px] font-semibold"
                  style={{
                    color: dm ? '#6b7280' : '#9ca3af',
                    opacity: messageState === 'sent' ? 1 : 0.88,
                    transform: messageState === 'sent' ? 'translateY(0)' : 'translateY(2px)',
                    transition: 'opacity 560ms ease, transform 700ms cubic-bezier(0.22, 1.14, 0.36, 1)',
                  }}
                >
                  {messageState === 'sent' ? 'Sent' : 'Ready to send'}
                </p>
              </div>
              {/* System match result */}
              <div className="flex items-end gap-2.5">
                <div
                  className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{
                    background: dm ? '#1c1c1e' : 'white',
                    border: dm ? '1px solid #2c2c2e' : '1px solid #e5e5e5',
                    opacity: showMatchShell ? 1 : 0,
                    transform: showMatchShell ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 760ms ease, transform 920ms cubic-bezier(0.22, 1.14, 0.36, 1)',
                  }}
                >
                  <svg className="h-3.5 w-3.5" style={{ color: '#0F766E' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                </div>
                <div className="js-hero-pop rounded-2xl rounded-bl-sm px-4 py-3 text-sm max-w-[280px] space-y-2" style={{ background: dm ? '#1c1c1e' : 'white', border: dm ? '1px solid #2c2c2e' : '1px solid #e5e5e5', color: dm ? '#f2f2f7' : '#171717', opacity: showMatchShell ? 1 : 0, transform: showMatchShell ? 'translateY(0)' : 'translateY(14px)', maxHeight: showMatchShell ? (matchState === 'done' ? 210 : 92) : 0, overflow: 'hidden', transition: 'opacity 900ms cubic-bezier(0.22, 1.14, 0.36, 1), transform 980ms cubic-bezier(0.22, 1.14, 0.36, 1), max-height 960ms cubic-bezier(0.22, 1.14, 0.36, 1)' }}>
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${matchState === 'loading' || matchState === 'transition' ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`} />
                    <p className="text-xs font-semibold" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>
                      {matchSummaryLabel}
                    </p>
                  </div>
                  <div
                    style={{
                      maxHeight: matchState === 'loading' || matchState === 'transition' ? 40 : 0,
                      opacity: matchState === 'loading' || matchState === 'transition' ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'max-height 620ms cubic-bezier(0.22, 1.14, 0.36, 1), opacity 520ms ease',
                    }}
                  >
                    <div className="px-3 py-2 rounded-xl text-[11px] font-medium" style={{ background: dm ? '#2c2c2e' : '#f5f5f7', color: dm ? '#cbd5e1' : '#475569' }}>
                      Finding students nearby
                      <span className="ml-1 inline-flex gap-0.5 align-middle">
                        <span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '120ms' }} />
                        <span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '240ms' }} />
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      maxHeight: matchState === 'done' ? 132 : 0,
                      opacity: matchState === 'done' ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'max-height 860ms cubic-bezier(0.22, 1.14, 0.36, 1), opacity 520ms ease',
                    }}
                  >
                    <div className="space-y-1.5 pt-0.5">
                      {STUDENT_MATCHES.map((pro, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
                          style={{
                            background: dm ? '#2c2c2e' : '#f5f5f7',
                            opacity: visibleStudents > i ? 1 : 0,
                            transform: visibleStudents > i ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
                            transition: `opacity 700ms cubic-bezier(0.22, 1.14, 0.36, 1) ${i * 120}ms, transform 780ms cubic-bezier(0.22, 1.14, 0.36, 1) ${i * 120}ms`,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: '#0F766E' }}>{pro.name[0]}</div>
                            <div>
                              <p className="text-xs font-semibold leading-none" style={{ color: dm ? '#f2f2f7' : '#171717' }}>{pro.name}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>{pro.tag}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold" style={{ color: '#0F766E' }}>★ {pro.rating}</p>
                            <p className="text-[10px]" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>{pro.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] font-semibold underline underline-offset-2 mt-1 min-h-[16px]"
                    style={{
                      color: dm ? '#9ca3af' : '#4b5563',
                      opacity: showViewAll ? 1 : 0,
                      transform: showViewAll ? 'translateY(0)' : 'translateY(4px)',
                      visibility: showViewAll ? 'visible' : 'hidden',
                      transition: 'opacity 580ms ease, transform 720ms cubic-bezier(0.22, 1.2, 0.36, 1)',
                    }}
                  >
                    View all
                  </button>
                </div>
              </div>
              {/* Matched provider cards */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {BADGES.map((item, idx) => (
                  <div key={item.label} className="js-hero-pop rounded-xl p-3 shadow-card text-center transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-default" style={{ background: dm ? '#1a1a1a' : 'white', border: dm ? '1px solid #262626' : undefined, opacity: badgeStages[idx] > 0 ? 1 : 0, transform: badgeStages[idx] > 0 ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.95)', transition: 'opacity 760ms cubic-bezier(0.22, 1.14, 0.36, 1), transform 900ms cubic-bezier(0.22, 1.14, 0.36, 1)' }}>
                    <div className={`h-8 w-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold ${badgeStages[idx] >= 1 ? 'hero-badge-check-reveal' : ''}`} style={{ background: '#0F766E', transition: 'transform 760ms cubic-bezier(0.22, 1.14, 0.36, 1)', transform: badgeStages[idx] >= 1 ? 'scale(1)' : 'scale(0.82)' }}>✓</div>
                    <p className="text-xs font-semibold truncate transition-all duration-500" style={{ color: dm ? '#d1d5db' : '#262626', opacity: badgeStages[idx] >= 2 ? 1 : 0, transform: badgeStages[idx] >= 2 ? 'translateY(0)' : 'translateY(6px)' }}>{item.label}</p>
                    <p className="text-xs transition-all duration-500" style={{ color: dm ? '#525252' : '#a3a3a3', opacity: badgeStages[idx] >= 3 ? 1 : 0, transform: badgeStages[idx] >= 3 ? 'translateY(0)' : 'translateY(4px)' }}>
                      {Array.from({ length: 5 }).map((_, sIdx) => (
                        <span key={sIdx} className={`inline-block hero-badge-star ${badgeStages[idx] >= 3 ? 'hero-badge-star-visible' : ''}`} style={{ animationDelay: `${sIdx * 120}ms` }}>★</span>
                      ))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
