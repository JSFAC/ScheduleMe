// @ts-nocheck

export default function DashboardEditTab({
  business,
  dm,
  previewEditMode,
  sendPreviewAction,
  previewKey,
  previewFrameRef,
}) {
  return (
    <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 overflow-hidden">
      <div
        className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between"
        style={{
          background: dm ? '#131415' : '#fffdfa',
          boxShadow: dm ? 'inset 0 -1px 0 rgba(255,255,255,0.05), 0 12px 28px rgba(0,0,0,0.14)' : '0 10px 26px rgba(15,23,42,0.05)',
        }}
      >
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ color: dm ? '#5eead4' : '#007e6d' }}
          >
            Edit Listing
          </p>
          <p
            className="text-sm font-bold mt-1"
            style={{ color: dm ? '#ffffff' : '#111827' }}
          >
            Live Preview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {previewEditMode ? (
            <>
              <button
                onClick={() => sendPreviewAction('cancel-edit')}
                className="text-xs font-bold px-3.5 py-2 rounded-xl border transition-colors shadow-sm"
                style={{
                  borderColor: dm ? '#6b7280' : '#c8d4ce',
                  background: dm ? '#23262a' : '#ffffff',
                  color: dm ? '#ffffff' : '#1f2937',
                  boxShadow: dm ? '0 8px 18px rgba(0,0,0,0.24)' : '0 10px 22px rgba(15, 23, 42, 0.08)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => sendPreviewAction('save-edit')}
                className="text-xs font-bold px-3.5 py-2 rounded-xl text-white transition-colors shadow-sm"
                style={{ background: '#007e6d', boxShadow: '0 14px 28px rgba(0,126,109,0.28)' }}
              >
                Save changes
              </button>
            </>
          ) : (
            <button
              onClick={() => sendPreviewAction('enter-edit')}
              className="text-xs font-bold px-3.5 py-2 rounded-xl border transition-colors shadow-sm"
              style={{ borderColor: dm ? 'rgba(94,234,212,0.34)' : 'rgba(0,126,109,0.24)', background: dm ? 'rgba(0,126,109,0.18)' : 'rgba(0,126,109,0.12)', color: dm ? '#d1fae5' : '#007e6d', boxShadow: dm ? '0 8px 18px rgba(0,0,0,0.22)' : '0 10px 22px rgba(15, 23, 42, 0.06)' }}
            >
              Edit mode
            </button>
          )}
        </div>
      </div>
      <div className="p-5" key={previewKey}>
        {business?.slug ? (
          <iframe
            ref={previewFrameRef}
            title="ScheduleMe Live Preview"
            src={`/biz/${encodeURIComponent(business.slug)}?edit=1&from=dashboard&bid=${business.id}&embedded=1&k=${previewKey}`}
            className="w-full rounded-[24px] border border-neutral-100 bg-white"
            style={{ minHeight: '82vh' }}
          />
        ) : (
          <div className="p-6 text-sm text-neutral-500">Editor unavailable until your provider slug is ready.</div>
        )}
      </div>
    </div>
  );
}
