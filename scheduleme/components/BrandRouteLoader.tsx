import React from 'react';

type BrandRouteLoaderProps = {
  audience?: 'consumer' | 'provider';
  message?: string;
};

export default function BrandRouteLoader({
  audience = 'consumer',
  message,
}: BrandRouteLoaderProps) {
  const isProvider = audience === 'provider';
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden px-6"
      style={{ background: isProvider ? '#0a0a0a' : '#ffffff' }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            isProvider
              ? 'linear-gradient(to right,rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.02) 1px,transparent 1px)'
              : 'linear-gradient(to right,rgba(0,0,0,0.03) 1px,transparent 1px),linear-gradient(to bottom,rgba(0,0,0,0.03) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative text-center">
        <p
          style={{
            fontSize: '1.75rem',
            fontWeight: 900,
            color: isProvider ? '#fff' : '#0a0a0a',
            letterSpacing: '-0.03em',
            marginBottom: 4,
          }}
        >
          ScheduleMe
        </p>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#0F766E',
            marginBottom: message ? 20 : 20,
          }}
        >
          {isProvider ? 'for Providers' : 'for Everyone'}
        </p>
        <div className="flex justify-center">
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: '2px solid rgba(15,118,110,0.25)',
              borderTopColor: '#0F766E',
              animation: 'spin 0.7s linear infinite',
            }}
          />
        </div>
        {message ? (
          <p
            className="text-sm mt-5"
            style={{ color: isProvider ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,10,0.62)' }}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
