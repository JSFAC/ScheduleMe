import ProviderSwitch from './ProviderSwitch';

type SettingsAppearanceCardProps = {
  dm: boolean;
  dashboardFieldBorder: string;
  toggleDarkMode: () => void;
};

export default function SettingsAppearanceCard({
  dm,
  dashboardFieldBorder,
  toggleDarkMode,
}: SettingsAppearanceCardProps) {
  return (
    <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
      <h2 className="text-sm font-bold text-neutral-900 mb-2">Appearance</h2>
      <p className="text-xs text-neutral-500 mb-4">Choose how the provider dashboard looks on this device.</p>
      <button
        type="button"
        onClick={toggleDarkMode}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-colors"
        style={{ borderColor: dashboardFieldBorder, background: dm ? '#17181a' : '#fff' }}
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-neutral-900">{dm ? 'Dark mode on' : 'Light mode on'}</p>
          <p className="text-[11px] text-neutral-500 mt-1">You can change this anytime from Settings.</p>
        </div>
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: dm ? '#0f766e' : '#525252' }}>
            {dm ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            )}
          </svg>
          <ProviderSwitch checked={dm} onChange={() => toggleDarkMode()} dm={dm} />
        </div>
      </button>
    </div>
  );
}
