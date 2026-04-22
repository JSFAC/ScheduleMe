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
        <div className="mt-16 mx-auto max-w-2xl opacity-0-init animate-fade-up animate-delay-500">
          <div className="p-1 shadow-modal rounded-2xl" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid rgba(0,0,0,0.07)' }}>
            <div className="rounded-2xl text-left space-y-3 p-5" style={{ background: dm ? '#0f0f0f' : '#f5f5f7', border: dm ? '1px solid #1c1c1e' : '1px solid rgba(0,0,0,0.06)' }}>
              {/* User message */}
              <div className="flex items-end gap-2.5 justify-end">
                <div className="js-hero-pop rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-white max-w-[220px]" style={{ background: '#0F766E' }}>
                  <p className="leading-snug">My kitchen faucet won't stop dripping. Getting worse every day.</p>
                </div>
                <div className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#0F766E,#0B5C56)' }}>J</div>
              </div>
              {/* System match result */}
              <div className="flex items-end gap-2.5">
                <div className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: dm ? '#1c1c1e' : 'white', border: dm ? '1px solid #2c2c2e' : '1px solid #e5e5e5' }}>
                  <svg className="h-3.5 w-3.5" style={{ color: '#0F766E' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                </div>
                <div className="js-hero-pop rounded-2xl rounded-bl-sm px-4 py-3 text-sm max-w-[240px] space-y-2" style={{ background: dm ? '#1c1c1e' : 'white', border: dm ? '1px solid #2c2c2e' : '1px solid #e5e5e5', color: dm ? '#f2f2f7' : '#171717' }}>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    <p className="text-xs font-semibold" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>3 pros available near you</p>
                  </div>
                  <div className="space-y-1.5">
                    {[{ name: 'Mike R.', tag: 'Plumbing', rating: '4.9', time: '~30 min' }, { name: 'Sarah K.', tag: 'Plumbing', rating: '4.8', time: '~1 hr' }].map((pro,i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={{ background: dm ? '#2c2c2e' : '#f5f5f7' }}>
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
              </div>
              {/* Matched provider cards */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[{label:'Verified Pro',color:'#0F766E'},{label:'Top Rated',color:'#0F766E'},{label:'Nearby',color:'#0F766E'}].map((item) => (
                  <div key={item.label} className="js-hero-pop rounded-xl p-3 shadow-card text-center transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-default" style={{ background: dm ? '#1a1a1a' : 'white', border: dm ? '1px solid #262626' : undefined }}>
                    <div className="h-8 w-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold" style={{ background: item.color }}>✓</div>
                    <p className="text-xs font-semibold truncate" style={{ color: dm ? '#d1d5db' : '#262626' }}>{item.label}</p>
                    <p className="text-xs" style={{ color: dm ? '#525252' : '#a3a3a3' }}>★★★★★</p>
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
