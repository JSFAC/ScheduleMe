// components/Hero.tsx
import React from 'react';
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
  return (
    <section className="relative overflow-hidden pt-24 pb-20 md:pt-36 md:pb-32" style={{ background: dm ? '#0a0a0a' : 'white' }}>
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: dm
            ? 'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)'
            : 'linear-gradient(to right, #f5f5f5 1px, transparent 1px), linear-gradient(to bottom, #f5f5f5 1px, transparent 1px)',
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
            'radial-gradient(circle, rgba(10,132,255,0.08) 0%, transparent 70%)',
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
        <div className="mt-16 mx-auto max-w-2xl opacity-0-init animate-fade-up animate-delay-500">
          <div className="p-1 shadow-modal rounded-2xl" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid rgba(0,0,0,0.07)' }}>
            <div className="rounded-xl p-6 text-left space-y-4" style={{ background: dm ? '#0f0f0f' : '#fafafa' }}>
              {/* Mock chat bubble */}
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full flex-shrink-0" style={{ background: dm ? '#262626' : '#e5e5e5' }} />
                <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-card max-w-xs" style={{ background: dm ? '#1a1a1a' : 'white', color: dm ? '#d1d5db' : '#404040' }}>
                  My kitchen faucet is leaking and getting worse. Need someone ASAP.
                </div>
              </div>
              {/* Mock triage result */}
              <div className="flex items-start gap-3 justify-end">
                <div className="bg-accent rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white shadow-card max-w-xs">
                  <p className="font-medium mb-1">Triage complete ✓</p>
                  <p className="opacity-90 text-xs">Plumbing · Urgent · Est. $120–$200</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-accent flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                  AI
                </div>
              </div>
              {/* Mock provider cards */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {['Mike R.', 'Sarah T.', 'ProFix Co.'].map((name, i) => (
                  <div key={name} className="rounded-xl p-3 shadow-card text-center" style={{ background: dm ? '#1a1a1a' : 'white', border: dm ? '1px solid #262626' : undefined }}>
                    <div className="h-8 w-8 rounded-full mx-auto mb-2" style={{ background: dm ? '#262626' : '#f5f5f5' }} />
                    <p className="text-xs font-semibold truncate" style={{ color: dm ? '#d1d5db' : '#262626' }}>{name}</p>
                    <p className="text-xs" style={{ color: dm ? '#525252' : '#a3a3a3' }}>{'★'.repeat(5 - i)}</p>
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
