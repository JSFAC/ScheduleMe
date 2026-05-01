import type { FormEvent } from 'react';

import StripeEmbeddedOnboarding from './StripeEmbeddedOnboarding';

type BusinessLike = {
  stripe_onboarded?: boolean;
  stripe_account_id?: string | null;
};

type SettingsPayoutCardProps = {
  business: BusinessLike | null;
  dashboardFieldBg: string;
  dashboardFieldBorder: string;
  dangerBgColor: string;
  dangerBorderColor: string;
  dangerTextColor: string;
  editZellePayoutDetails: string;
  manualPayoutLimit: number;
  manualPayoutsRemaining: number;
  settingsError: string;
  settingsNotice: string;
  settingsSaved: boolean;
  settingsSaving: boolean;
  stripeCta: string;
  stripeConnectError: string;
  stripeLoading: boolean;
  stripeStatusMsg: string;
  stripeEmbeddedOpen: boolean;
  stripeEmbeddedMode: 'onboarding' | 'update';
  dm: boolean;
  onCloseStripeEmbedded: () => void;
  onDisconnectStripe: () => void;
  onOpenStripeFallback: (mode: 'onboarding' | 'update') => void;
  onRefreshStripeStatus: () => Promise<boolean>;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void;
  onStripeConnect: (mode: 'onboarding' | 'update') => void;
  onZelleChange: (value: string) => void;
  requestStripeClientSecret: (mode: 'onboarding' | 'update') => Promise<string>;
};

export default function SettingsPayoutCard({
  business,
  dashboardFieldBg,
  dashboardFieldBorder,
  dangerBgColor,
  dangerBorderColor,
  dangerTextColor,
  editZellePayoutDetails,
  manualPayoutLimit,
  manualPayoutsRemaining,
  settingsError,
  settingsNotice,
  settingsSaved,
  settingsSaving,
  stripeCta,
  stripeConnectError,
  stripeLoading,
  stripeStatusMsg,
  stripeEmbeddedOpen,
  stripeEmbeddedMode,
  dm,
  onCloseStripeEmbedded,
  onDisconnectStripe,
  onOpenStripeFallback,
  onRefreshStripeStatus,
  onSaveSettings,
  onStripeConnect,
  onZelleChange,
  requestStripeClientSecret,
}: SettingsPayoutCardProps) {
  const showStripeLauncher = !stripeEmbeddedOpen;

  return (
    <form onSubmit={onSaveSettings} className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
      <h2 className="text-sm font-bold text-neutral-900 mb-2">Setup Payout</h2>
      <p className="text-xs text-neutral-400 mb-4">First 3 bookings can be paid out through Zelle, then Stripe becomes required.</p>
      <div className="mb-4">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold text-neutral-500">Zelle payout details</span>
          <span className="text-[12px] text-neutral-600">
            {manualPayoutsRemaining > 0
              ? `${manualPayoutsRemaining} of ${manualPayoutLimit} Zelle payouts remaining.`
              : `All ${manualPayoutLimit} Zelle payouts have been used.`}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-2xl border" style={{ borderColor: dashboardFieldBorder, background: dashboardFieldBg }}>
            <input
              type="text"
              value={editZellePayoutDetails}
              onChange={(e) => onZelleChange(e.target.value)}
              placeholder="Email or phone tied to your Zelle"
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none"
              style={{ color: dm ? '#f3f4f6' : '#171717' }}
            />
            <button
              type="submit"
              disabled={settingsSaving}
              className="m-1 shrink-0 rounded-xl px-4 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-60"
              style={{ background: '#007e6d' }}
            >
              {settingsSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-5 text-amber-700">
          First 3 bookings can be paid out through Zelle, then Stripe becomes required.
        </p>
      </div>
      {business?.stripe_onboarded ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Automated payouts active
          </div>
          {showStripeLauncher ? (
            <button
              type="button"
              onClick={() => onStripeConnect('update')}
              disabled={stripeLoading}
              className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              Manage Stripe payout setup
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDisconnectStripe}
            className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors"
            style={{ borderColor: dangerBorderColor, color: dangerTextColor, background: dangerBgColor }}
          >
            Disconnect Stripe
          </button>
          <p className="text-[11px] text-neutral-400">Add a debit card in Stripe to enable instant payouts. New Stripe accounts may take up to 7 days for the first automated payout to arrive.</p>
          {stripeConnectError && <p className="text-[11px] text-amber-700">{stripeConnectError}</p>}
          {stripeStatusMsg && <p className="text-[11px] text-neutral-500">{stripeStatusMsg}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {showStripeLauncher ? (
            <button type="button" onClick={() => onStripeConnect('onboarding')} disabled={stripeLoading} className="btn-primary text-sm px-5 py-2.5 w-full">
              {stripeLoading ? 'Loading…' : stripeCta}
            </button>
          ) : null}
          {business?.stripe_account_id && (
            <button
              type="button"
              onClick={onDisconnectStripe}
              className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors"
              style={{ borderColor: dangerBorderColor, color: dangerTextColor, background: dangerBgColor }}
            >
              Disconnect Stripe
            </button>
          )}
          {stripeConnectError && <p className="text-[11px] text-amber-700">{stripeConnectError}</p>}
          {stripeStatusMsg && <p className="text-[11px] text-neutral-500">{stripeStatusMsg}</p>}
        </div>
      )}
      {stripeEmbeddedOpen ? (
        <StripeEmbeddedOnboarding
          dm={dm}
          mode={stripeEmbeddedMode}
          onClose={onCloseStripeEmbedded}
          onOpenHostedFallback={() => onOpenStripeFallback(stripeEmbeddedMode)}
          onRefreshStatus={onRefreshStripeStatus}
          requestClientSecret={requestStripeClientSecret}
        />
      ) : null}
      <div className="mt-4 min-h-[18px] text-xs">
        {settingsError ? <span className="text-red-500">{settingsError}</span> : null}
        {!settingsError && settingsNotice ? <span style={{ color: '#007e6d' }}>{settingsNotice}</span> : null}
        {!settingsError && !settingsNotice && settingsSaved ? <span style={{ color: '#007e6d' }}>Saved.</span> : null}
      </div>
    </form>
  );
}
