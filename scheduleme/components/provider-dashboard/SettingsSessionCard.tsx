type SettingsSessionCardProps = {
  dashboardFieldBorder: string;
  dangerBgColor: string;
  dangerBorderColor: string;
  dangerTextColor: string;
  email?: string;
  dm: boolean;
  onDeleteAccount: () => void;
  onSignOut: () => void;
};

export default function SettingsSessionCard({
  dashboardFieldBorder,
  dangerBgColor,
  dangerBorderColor,
  dangerTextColor,
  email,
  dm,
  onDeleteAccount,
  onSignOut,
}: SettingsSessionCardProps) {
  return (
    <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
      <h2 className="text-sm font-bold text-neutral-900 mb-2">Session</h2>
      <p className="text-xs text-neutral-400 mb-4">Signed in as {email}</p>
      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={onSignOut}
          className="text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors"
          style={{ borderColor: dashboardFieldBorder, color: dm ? '#e5e7eb' : '#525252', background: dm ? '#17181a' : '#fff' }}
        >
          Sign Out
        </button>
        <button
          type="button"
          onClick={onDeleteAccount}
          className="text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors"
          style={{ borderColor: dangerBorderColor, color: dangerTextColor, background: dangerBgColor }}
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
