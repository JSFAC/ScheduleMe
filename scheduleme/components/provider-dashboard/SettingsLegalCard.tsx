import Link from 'next/link';

type SettingsLegalCardProps = {
  dashboardFieldBorder: string;
  dm: boolean;
};

export default function SettingsLegalCard({
  dashboardFieldBorder,
  dm,
}: SettingsLegalCardProps) {
  const linkStyle = {
    borderColor: dashboardFieldBorder,
    color: dm ? '#e5e7eb' : '#374151',
    background: dm ? '#17181a' : '#fff',
  };

  return (
    <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
      <h2 className="text-sm font-bold text-neutral-900 mb-2">Legal & Support</h2>
      <p className="text-xs text-neutral-400 mb-4">Review the latest policies and contact support.</p>
      <div className="grid grid-cols-1 gap-2">
        <Link href="/privacy" className="text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors" style={linkStyle}>
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors" style={linkStyle}>
          Terms of Service
        </Link>
        <Link href="/support" className="text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors" style={linkStyle}>
          Support
        </Link>
      </div>
    </div>
  );
}
