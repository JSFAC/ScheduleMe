type BusinessLike = {
  owner_name?: string;
  owner_email?: string;
  campus_provider?: boolean;
  campus_school_name?: string | null;
  school_domain?: string | null;
  zelle_payout_details?: string;
  public_visibility?: boolean;
  rating?: number | null;
  edu_verified?: boolean;
  school_email?: string | null;
};

type SettingsAccountInfoCardProps = {
  dm: boolean;
  business: BusinessLike | null;
  campusLabel: string;
  dangerBgColor: string;
  dangerBorderColor: string;
  dangerTextColor: string;
  onVerifyEdu: () => void;
  onDisconnectEdu: () => void;
};

export default function SettingsAccountInfoCard({
  dm,
  business,
  campusLabel,
  dangerBgColor,
  dangerBorderColor,
  dangerTextColor,
  onVerifyEdu,
  onDisconnectEdu,
}: SettingsAccountInfoCardProps) {
  const providerType = business?.campus_provider
    ? `Campus provider${business?.campus_school_name || business?.school_domain ? ` · ${business?.campus_school_name || campusLabel || business?.school_domain}` : ''}`
    : 'Independent provider';

  return (
    <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
      <h2 className="text-sm font-bold text-neutral-900 mb-4">Account Info</h2>
      <div className="space-y-3">
        {[
          { label: 'Owner', value: business?.owner_name },
          { label: 'Email', value: business?.owner_email },
          { label: 'Provider type', value: providerType },
          { label: 'Manual payout', value: business?.zelle_payout_details || 'Not set' },
          { label: 'Status', value: business?.public_visibility ? '✓ Live on ScheduleMe' : 'Incomplete' },
          { label: 'Rating', value: business?.rating ? `${business.rating} ★` : 'No ratings yet' },
        ].map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 py-2 border-b border-neutral-50 last:border-0">
            <span className="text-xs text-neutral-400 font-medium shrink-0">{row.label}</span>
            <span className="text-sm text-neutral-700 text-right">{row.value || '—'}</span>
          </div>
        ))}
      </div>
      <p className="text-xs font-semibold text-neutral-500 mt-4">Want to affiliate with your campus?</p>
      <div className="mt-4 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={onVerifyEdu}
          className="w-full py-2.5 rounded-xl text-sm font-semibold border"
          style={{
            borderColor: dm ? 'rgba(0,126,109,0.36)' : '#007e6d',
            color: dm ? '#6fe0cd' : '#007e6d',
            background: dm ? 'rgba(0,126,109,0.10)' : '#f5fbf8',
          }}
        >
          {business?.edu_verified ? 'View EDU Verification' : 'Verify .edu Email'}
        </button>
        {Boolean((business?.school_email || '').trim() || business?.edu_verified) && (
          <button
            type="button"
            onClick={onDisconnectEdu}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: dangerBorderColor, color: dangerTextColor, background: dangerBgColor }}
          >
            Disconnect .edu Email
          </button>
        )}
      </div>
    </div>
  );
}
