import React from 'react';

type BrandRouteLoaderProps = {
  audience?: 'consumer' | 'provider';
  message?: string;
};

export default function BrandRouteLoader({
  audience = 'consumer',
  message,
}: BrandRouteLoaderProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden px-6"
      style={{ background: '#07090d' }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right,rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.03) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative text-center">
        <p className="text-5xl font-black tracking-[-0.03em] text-white">ScheduleMe</p>
        {audience === 'provider' ? (
          <p className="text-xs font-bold uppercase tracking-[0.28em] mt-2" style={{ color: '#0F766E' }}>
            FOR PROVIDERS
          </p>
        ) : null}
        <div className="mt-8 flex justify-center">
          <div className="h-7 w-7 rounded-full border-[3px] border-accent/30 border-t-accent animate-spin" />
        </div>
        {message ? (
          <p className="text-sm mt-5" style={{ color: 'rgba(255,255,255,0.72)' }}>
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
