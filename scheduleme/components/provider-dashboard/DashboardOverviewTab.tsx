// @ts-nocheck

export default function DashboardOverviewTab({
  business,
  dm,
  totalEarned,
  thisMonthEarned,
  awaitingReleaseAmount,
  uniqueClients,
  completedCount,
  pendingCount,
  totalUnreadMsgs,
  campusLabel,
  publishReady,
  publishChecklist,
  publishLoading,
  bookings,
  warningBorderColor,
  warningTextColor,
  warningBgColor,
  fmt,
  activateTab,
  handlePublish,
  jumpToPublishRequirement,
  RevenueChartComponent,
  StatusBadgeComponent,
  fmtDate,
}) {
  const platformFeeLabel = business?.founder50 ? 'after 6% platform fee (Founder50)' : 'after 12% platform fee';
  const payoutSetupMissing = !business?.stripe_onboarded && !String(business?.zelle_payout_details || '').trim();
  const availabilityLabel = payoutSetupMissing || business?.availability_status === 'setup_required'
    ? 'Payout setup required'
    : business?.availability_status === 'busy'
    ? 'Busy'
    : business?.availability_status === 'closed'
      ? 'Closed'
      : 'Open';
  const availabilityTone = payoutSetupMissing || business?.availability_status === 'setup_required'
    ? { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', dot: '#f59e0b' }
    : business?.availability_status === 'busy'
    ? { bg: '#fff7ed', border: '#fdba74', text: '#c2410c', dot: '#f59e0b' }
    : business?.availability_status === 'closed'
      ? { bg: '#fff1f2', border: '#fda4af', text: '#be123c', dot: '#fb7185' }
      : { bg: '#f0fdf4', border: '#a7f3d0', text: '#0f766e', dot: '#14b8a6' };
  const overviewMetrics = [
    {
      label: 'Total Payout',
      value: fmt(totalEarned),
      sub: platformFeeLabel,
      icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: '#14b8a6',
    },
    {
      label: 'This Month',
      value: fmt(thisMonthEarned),
      sub: 'current month payout',
      icon: 'M3 3v18h18M7.5 14.25l3-3 2.25 2.25L16.5 9',
      color: '#0ea5a4',
    },
    {
      label: 'Awaiting Payout',
      value: fmt(awaitingReleaseAmount),
      sub: 'paid bookings pending release',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: '#0f766e',
    },
    {
      label: 'Clients',
      value: String(uniqueClients),
      sub: `${completedCount} jobs completed`,
      icon: 'M17 20h5v-1a4 4 0 00-5-3.87M9 20H4v-1a4 4 0 015-3.87m8-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 2a3 3 0 11-6 0 3 3 0 016 0zM6 10a3 3 0 11-6 0 3 3 0 016 0z',
      color: '#2cb39b',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-5">
        <div
          className="rounded-[28px] border p-5 sm:p-6"
          style={{
            background: dm ? '#1c1c1e' : '#ffffff',
            borderColor: dm ? '#3a3a3c' : '#ebe1d3',
            boxShadow: dm ? 'none' : '0 10px 30px rgba(32,136,122,0.05)',
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-[1.75rem] sm:text-[2rem] font-black leading-none" style={{ letterSpacing: '-0.04em', color: dm ? '#f5f5f5' : '#171717' }}>
                {business?.name || 'Your business'}
              </h2>
              <p className="mt-2 max-w-xl text-sm" style={{ color: dm ? '#a1a1aa' : '#737373' }}>
                Run your bookings, messages, services, and payouts from one place.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
                  style={{ background: availabilityTone.bg, borderColor: availabilityTone.border, color: availabilityTone.text }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: availabilityTone.dot }} />
                  Status: {availabilityLabel}
                </span>
                {business?.edu_verified && campusLabel && (
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
                    style={{ background: 'rgba(0,126,109,0.10)', borderColor: 'rgba(0,126,109,0.22)', color: '#007e6d' }}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 8.25L12 4.5l8.25 3.75L12 12 3.75 8.25z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5V14c0 1.5 2.015 3 4.5 3s4.5-1.5 4.5-3v-3.5" />
                    </svg>
                    EDU verified provider: {campusLabel}
                  </span>
                )}
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'rgba(0,126,109,0.18)', background: '#f5fbf8', color: '#0f766e' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {pendingCount} booking{pendingCount !== 1 ? 's' : ''} need attention
                  </span>
                )}
                {totalUnreadMsgs > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#d9d6fe', background: '#f5f3ff', color: '#6d28d9' }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#8b5cf6' }} />
                    {totalUnreadMsgs} unread message{totalUnreadMsgs !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => activateTab('edit')}
                  className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors w-full sm:w-auto"
                  style={{
                    borderColor: dm ? '#303236' : '#e5e7eb',
                    background: dm ? '#17181a' : '#ffffff',
                    color: dm ? '#f3f4f6' : '#374151',
                  }}
                >
                  Edit Listing
                </button>
              <button
                type="button"
                onClick={() => activateTab('bookings')}
                className="btn-primary rounded-full px-4 py-2 text-sm font-semibold text-white w-full sm:w-auto"
              >
                Open Bookings
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewMetrics.map((s) => (
            <div
              key={s.label}
              className="rounded-[24px] border p-4 sm:p-5"
              style={{
                background: dm ? '#1c1c1e' : '#ffffff',
                borderColor: dm ? '#2c2c2e' : '#ebe1d3',
                boxShadow: dm ? 'none' : '0 8px 24px rgba(15,23,42,0.04)',
              }}
            >
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center mb-4" style={{ background: dm ? 'rgba(255,255,255,0.06)' : '#f3f8f6' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: s.color }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </div>
              <p className="text-[2rem] font-black leading-none" style={{ letterSpacing: '-0.04em', color: dm ? '#f5f5f5' : '#171717' }}>{s.value}</p>
              <p className="mt-2 text-sm font-semibold" style={{ color: dm ? '#f5f5f5' : '#171717' }}>{s.label}</p>
              <p className="mt-1 text-xs" style={{ color: dm ? '#a1a1aa' : '#737373' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="rounded-[28px] border p-4 sm:p-5 overflow-hidden" style={{ background: dm ? '#1c1c1e' : '#ffffff', borderColor: dm ? '#3a3a3c' : '#ebe1d3' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold" style={{ color: dm ? '#f5f5f5' : '#171717' }}>Revenue</h2>
                <p className="mt-1 text-xs" style={{ color: dm ? '#a1a1aa' : '#737373' }}>Weekly revenue across your past 3 months.</p>
              </div>
            </div>
            <div className="mt-5">
              <RevenueChartComponent bookings={bookings} dm={dm} />
            </div>
          </div>

          <div className="provider-premium-panel rounded-[30px] border bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900">Publish Checklist</h2>
                <p className="mt-1 text-xs text-neutral-500">Finish these launch blockers to publish your provider page.</p>
              </div>
              <span
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  background: publishReady
                    ? (dm ? 'rgba(16,185,129,0.14)' : '#ecfdf5')
                    : (dm ? 'rgba(180,83,9,0.24)' : '#fff7ed'),
                  color: publishReady ? '#047857' : (dm ? '#f3ba63' : '#9a3412'),
                  border: `1px solid ${publishReady ? (dm ? 'rgba(16,185,129,0.18)' : 'transparent') : (dm ? 'rgba(217,119,6,0.28)' : 'transparent')}`,
                }}
              >
                {publishReady ? 'Ready to Publish' : 'Incomplete'}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              {[
                { key: 'coreProfile', label: 'Core profile fields', hint: 'Business name, provider name, description, city, and ZIP.' },
                { key: 'media', label: 'Photo or media uploaded', hint: 'Use real photos so the profile feels trustworthy.' },
                { key: 'services', label: 'Service and business hours', hint: 'Add your first offer and set business hours before students can book.' },
                { key: 'stripe', label: 'Setup payout', hint: 'First 3 bookings can be payed out through zelle, then stripe becomes required.' },
              ].map((item, index) => {
                const ok = !!publishChecklist?.[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => !ok && jumpToPublishRequirement(item.key)}
                    className="rounded-[24px] border px-4 py-4 text-left transition-transform hover:-translate-y-0.5 disabled:cursor-default"
                    disabled={ok}
                    style={{
                      borderColor: ok ? (dm ? 'rgba(16,185,129,0.28)' : '#b7e5ce') : warningBorderColor,
                      background: ok ? (dm ? 'rgba(16,185,129,0.10)' : '#eef9f3') : (dm ? 'rgba(217,119,6,0.10)' : '#fff6e7'),
                    }}
                    data-checklist-order={index}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold" style={{ color: ok ? (dm ? '#8ef0d7' : '#166534') : warningTextColor }}>{item.label}</p>
                        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: ok ? (dm ? '#bbf7e6' : '#3f6f58') : warningTextColor }}>{item.hint}</p>
                        {!ok && <p className="mt-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: warningTextColor }}>Open section →</p>}
                      </div>
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: ok ? (dm ? 'rgba(16,185,129,0.16)' : 'rgba(22,101,52,0.10)') : warningBgColor, color: ok ? (dm ? '#8ef0d7' : '#166534') : warningTextColor }}>
                        {ok ? 'Done' : 'Needed'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => handlePublish('publish')}
                disabled={publishLoading || !publishReady}
                className="btn-primary rounded-full px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {publishLoading ? 'Updating…' : 'Publish Profile'}
              </button>
              <button
                onClick={() => handlePublish('unpublish')}
                disabled={publishLoading || !business?.public_visibility}
                className="rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-50"
              >
                Unpublish
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: dm ? '#1c1c1e' : '#ffffff', borderColor: dm ? '#2f3034' : '#f5f5f5' }}>
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between" style={{ borderColor: dm ? '#2f3034' : '#f5f5f5' }}>
          <h2 className="text-sm font-bold" style={{ color: dm ? '#f5f5f5' : '#171717' }}>Recent Bookings</h2>
          <button onClick={() => activateTab('bookings')} className="text-xs font-semibold text-accent hover:opacity-70 transition-opacity">View all →</button>
        </div>
        {bookings.length === 0
          ? <div className="px-5 py-10 text-center text-sm" style={{ color: dm ? '#71717a' : '#a3a3a3' }}>No bookings yet.</div>
          : <div className="divide-y divide-neutral-50">
              {bookings.slice(0, 4).map((b) => (
                <div key={b.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: dm ? '#f5f5f5' : '#171717' }}>{b.profiles?.name || 'Customer'}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: dm ? '#a1a1aa' : '#a3a3a3' }}>{b.service || 'Custom Request'} · {fmtDate(b.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {b.amount_cents ? <span className="text-sm font-bold" style={{ color: dm ? '#e4e4e7' : '#404040' }}>{fmt(b.amount_cents)}</span> : null}
                    <StatusBadgeComponent status={b.status} />
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      <div className="rounded-2xl border border-neutral-100 px-5 py-4 flex items-center justify-between gap-4" style={{ background: dm ? '#1c1c1e' : 'white', borderColor: dm ? '#2f3034' : '#f5f5f5' }}>
        <div>
          <p className="text-sm font-bold" style={{ color: dm ? '#f5f5f5' : '#171717' }}>Payments and payouts</p>
          <p className="text-xs mt-0.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
            Manage automated Stripe payouts or save Zelle details for manual payouts in Settings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => activateTab('settings')}
          className="text-xs font-semibold px-3 py-2 rounded-lg border transition-colors"
          style={{
            borderColor: dm ? '#434349' : '#d4d4d8',
            color: dm ? '#f3f4f6' : '#374151',
            background: dm ? 'rgba(255,255,255,0.02)' : '#ffffff',
          }}
        >
          Open Settings
        </button>
      </div>
    </div>
  );
}
