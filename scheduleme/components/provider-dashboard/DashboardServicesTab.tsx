// @ts-nocheck

import ProviderSwitch from './ProviderSwitch';

export default function DashboardServicesTab(props) {
  const {
    dm,
    business,
    dashboardFieldBg,
    dashboardFieldBorder,
    svcName,
    setSvcName,
    svcDesc,
    setSvcDesc,
    svcPrice,
    setSvcPrice,
    svcDuration,
    setSvcDuration,
    svcRequiresTime,
    setSvcRequiresTime,
    svcError,
    svcSaving,
    handleAddService,
    svcLoading,
    services,
    handleUpdateService,
    handleDeleteService,
    editAvailability,
    setEditAvailability,
    HOURS_DAYS,
    editHours,
    parseDayHoursConfig,
    PROVIDER_TIME_OPTIONS,
    getTimeIndex,
    toggleDayOpen,
    toggleDaySpecificHours,
    setDayTime,
    handleSaveHours,
    settingsSaving,
    handleCustomRequiresTime,
    digitsToDollars,
    onlyDigits,
  } = props;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
      <div className="space-y-5">
        <div className="provider-premium-panel rounded-[30px] p-6" style={{ background: dm ? '#1c1c1e' : 'white', border: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
          <h3 className="font-bold text-base mb-4" style={{ color: dm ? '#f2f2f7' : '#111' }}>Add Service</h3>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <input value={svcName} maxLength={60} onChange={e => setSvcName(e.target.value)} placeholder="Service name (e.g. Haircut, Oil Change)" className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: dm ? '#2c2c2e' : '#ffffff', color: dm ? '#f2f2f7' : '#111', border: '1px solid ' + (dm ? '#3c3c3e' : '#e5e7eb') }} />
              <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: dm ? '#9ca3af' : '#9ca3af' }}>{svcName.length}/60</span>
            </div>
            <div className="relative">
              <textarea value={svcDesc} maxLength={300} onChange={e => setSvcDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none" style={{ background: dm ? '#2c2c2e' : '#ffffff', color: dm ? '#f2f2f7' : '#111', border: '1px solid ' + (dm ? '#3c3c3e' : '#e5e7eb') }} />
              <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: dm ? '#9ca3af' : '#9ca3af' }}>{svcDesc.length}/300</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Price ($)</label>
                <div className="flex items-center rounded-2xl border px-3 py-3" style={{ background: dm ? '#2c2c2e' : '#ffffff', color: dm ? '#f2f2f7' : '#111', border: '1px solid ' + (dm ? '#3c3c3e' : '#e5e7eb') }}>
                  <span className="text-sm font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={digitsToDollars(svcPrice)}
                    onChange={e => setSvcPrice(onlyDigits(e.target.value))}
                    placeholder="0.00"
                    className="flex-1 ml-2 text-sm outline-none bg-transparent"
                    style={{ color: dm ? '#f2f2f7' : '#111' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Duration (min)</label>
                <div className="flex items-center overflow-hidden rounded-2xl border" style={{ background: dashboardFieldBg, color: dm ? '#f2f2f7' : '#111', border: '1px solid ' + dashboardFieldBorder }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={svcDuration}
                    onChange={e => setSvcDuration(String(Math.max(5, Number((e.target.value || '').replace(/[^\d]/g, '') || 0) || 5)))}
                    placeholder="60"
                    className="h-[50px] flex-1 bg-transparent px-3 text-center text-sm outline-none"
                    style={{ color: dm ? '#f2f2f7' : '#111' }}
                  />
                </div>
              </div>
            </div>
            <label className="flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-semibold" style={{ borderColor: dm ? '#2c2c2e' : '#cfe7de', color: dm ? '#e5e7eb' : '#0f766e', background: dm ? '#17181a' : '#f5fbf8' }}>
              Requires exact time
              <ProviderSwitch checked={svcRequiresTime} onChange={setSvcRequiresTime} dm={dm} />
            </label>
            {svcError && <p className="text-red-500 text-sm">{svcError}</p>}
            <button onClick={handleAddService} disabled={svcSaving} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: svcSaving ? '#9ca3af' : '#007e6d' }}>{svcSaving ? 'Adding...' : '+ Add Service'}</button>
          </div>
        </div>
        <div className="provider-premium-panel rounded-[30px] overflow-hidden self-start" style={{ background: dm ? '#1c1c1e' : 'white', border: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
            <h3 className="font-bold text-base" style={{ color: dm ? '#f2f2f7' : '#111' }}>Your Services ({services.length})</h3>
          </div>
          {svcLoading ? <div className="p-6 text-center text-sm" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>Loading...</div>
          : services.length === 0 ? <div className="p-6 text-center text-sm" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>No services yet — add your first one above</div>
          : <div>{services.map(svc => (
              <div key={svc.id} className="px-5 py-4 flex items-center justify-between gap-3 provider-service-row" style={{ borderBottom: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: dm ? '#f2f2f7' : '#111' }}>{svc.name}</p>
                  {svc.description && <p className="text-xs mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>{svc.description}</p>}
                  <p className="text-xs mt-1" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>
                    {svc.duration_min} min · {svc.requires_time === false ? 'No exact time' : 'Exact time'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-[15px]" style={{ color: '#007e6d' }}>{'$'}{(svc.price_cents/100).toFixed(2)}</span>
                  <button
                    onClick={() => handleUpdateService(svc.id, { requires_time: svc.requires_time === false ? true : false })}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-full border"
                    style={{ borderColor: dm ? '#2c2c2e' : '#cfe7de', color: dm ? '#e5e7eb' : '#0f766e', background: dm ? '#17181a' : '#f5fbf8' }}
                    title={svc.requires_time === false ? 'Enable exact time' : 'Disable exact time'}
                  >
                    {svc.requires_time === false ? 'Enable time' : 'No time'}
                  </button>
                  <button onClick={() => handleDeleteService(svc.id)} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ color: '#ef4444' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}</div>}
        </div>
      </div>
      <div className="space-y-5">
        <div className="provider-premium-panel rounded-[30px] p-6" style={{ background: dm ? '#1c1c1e' : 'white', border: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
          <h3 className="font-bold text-base mb-4" style={{ color: dm ? '#f2f2f7' : '#111' }}>Availability</h3>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { key: 'open', label: 'Open', activeBg: '#007e6d', activeColor: '#fff', border: dm ? 'rgba(45,212,191,0.26)' : '#bfe5db', color: '#0f766e' },
              { key: 'busy', label: 'Busy', activeBg: dm ? 'rgba(217,119,6,0.16)' : '#fff7ed', activeColor: dm ? '#e8b468' : '#b45309', border: dm ? 'rgba(217,119,6,0.32)' : '#f4d9c7', color: dm ? '#e8b468' : '#b45309' },
              { key: 'closed', label: 'Closed', activeBg: dm ? 'rgba(239,68,68,0.16)' : '#fff7f7', activeColor: dm ? '#fca5a5' : '#b42318', border: dm ? 'rgba(248,113,113,0.30)' : '#f3d0d0', color: dm ? '#fca5a5' : '#b42318' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setEditAvailability(option.key)}
                className="rounded-full border px-3 py-2 text-sm font-semibold transition-colors"
                style={editAvailability === option.key
                  ? { background: option.activeBg, borderColor: option.border, color: option.activeColor }
                  : { background: dm ? '#17181a' : '#fff', borderColor: dm ? '#303236' : '#e5e7eb', color: dm ? '#d4d4d8' : '#4b5563' }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <h4 className="font-semibold text-sm mb-3" style={{ color: dm ? '#f2f2f7' : '#111' }}>Business Hours</h4>
          <div className="space-y-2">
            {HOURS_DAYS.map((day) => {
              const config = parseDayHoursConfig(editHours[day] || '');
              const availableEndTimes = PROVIDER_TIME_OPTIONS.filter((option) => option.value > getTimeIndex(config.start));
              return (
                <div key={day} className="rounded-[22px] border px-4 py-3" style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#111' : '#fff' }}>
                  <div className="flex items-center gap-3">
                    <div className="min-w-[96px] text-sm font-medium" style={{ color: dm ? '#f2f2f7' : '#111' }}>{day}</div>
                    <div className="flex-1 text-xs" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                      {config.enabled ? (config.useSpecificHours ? `${config.start} - ${config.end}` : 'Available all day') : 'Closed'}
                    </div>
                    <ProviderSwitch checked={config.enabled} onChange={(next) => toggleDayOpen(day, next)} dm={dm} />
                  </div>
                  {config.enabled && (
                    <div className="mt-4 rounded-2xl border px-4 py-4" style={{ borderColor: dm ? '#2c2c2e' : '#ebedf0', background: dm ? '#17181a' : '#f9fafb' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold" style={{ color: dm ? '#f2f2f7' : '#111' }}>Use specific availability hours</p>
                          <p className="text-[11px] mt-1" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                            Turn this on if you only want bookings during set hours.
                          </p>
                        </div>
                        <ProviderSwitch checked={config.useSpecificHours} onChange={(next) => toggleDaySpecificHours(day, next)} dm={dm} size="sm" />
                      </div>
                      {config.useSpecificHours && (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Start</label>
                            <select
                              value={config.start}
                              onChange={(e) => setDayTime(day, 'start', e.target.value)}
                              className="w-full rounded-2xl px-3 py-3 text-sm outline-none"
                              style={{ background: dashboardFieldBg, color: dm ? '#f2f2f7' : '#111', border: `1px solid ${dashboardFieldBorder}` }}
                            >
                              {PROVIDER_TIME_OPTIONS.slice(0, -1).map((option) => (
                                <option key={`${day}-start-${option.value}`} value={option.label}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>End</label>
                            <select
                              value={config.end}
                              onChange={(e) => setDayTime(day, 'end', e.target.value)}
                              className="w-full rounded-2xl px-3 py-3 text-sm outline-none"
                              style={{ background: dashboardFieldBg, color: dm ? '#f2f2f7' : '#111', border: `1px solid ${dashboardFieldBorder}` }}
                            >
                              {availableEndTimes.map((option) => (
                                <option key={`${day}-end-${option.value}`} value={option.label}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleSaveHours}
            disabled={settingsSaving}
            className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white"
            style={{ background: settingsSaving ? '#9ca3af' : '#007e6d' }}
          >
            {settingsSaving ? 'Saving…' : 'Save Hours'}
          </button>
        </div>
        <div className="provider-premium-panel rounded-[30px] p-6" style={{ background: dm ? '#1c1c1e' : 'white', border: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
          <h3 className="font-bold text-base mb-2" style={{ color: dm ? '#f2f2f7' : '#111' }}>Custom Request Scheduling</h3>
          <p className="text-xs mb-3" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Choose whether custom requests need an exact time or just a due date.</p>
          <label className="flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-semibold" style={{ borderColor: dm ? '#2c2c2e' : '#cfe7de', color: dm ? '#e5e7eb' : '#0f766e', background: dm ? '#111' : '#f5fbf8' }}>
            Requires exact time
            <ProviderSwitch checked={business?.custom_requires_time !== false} onChange={handleCustomRequiresTime} dm={dm} />
          </label>
        </div>
      </div>
    </div>
  );
}
