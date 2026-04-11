// @ts-nocheck
// pages/business/pending.tsx
// Shown to businesses that have applied but not yet been approved by admin

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';

function getSupabase() {
  return getSupabaseClient();
}

function PendingIcon() {
  return (
    <svg className="h-11 w-11 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v5m0 8v5m0-13a4 4 0 014 4c0 .97-.35 1.85-.94 2.53L12 18l-3.06-3.47A3.99 3.99 0 018 12a4 4 0 014-4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v2.75" />
    </svg>
  );
}

export default function BusinessPending() {
  const router = useRouter();

  useEffect(() => {
    // If somehow an approved business lands here, redirect to dashboard
    getSupabase().auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/business/auth/login'); return; }
      const { data: biz } = await getSupabase().from('businesses').select('is_onboarded').eq('owner_email', session.user.email).maybeSingle();
      if (biz?.is_onboarded) router.replace('/business/dashboard');
    });
  }, []);

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    router.replace('/business/auth/login');
  }

  return (
    <>
      <Head>
        <title>Application Under Review — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#f9fafb' }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-neutral-100 p-10 text-center">
          <div className="mb-4 flex justify-center">
            <PendingIcon />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Application Under Review</h1>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            Thank you for applying to ScheduleMe! Our team is reviewing your application.
            You'll receive an email once you've been approved and can access your provider dashboard.
          </p>
          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-blue-800 text-sm font-semibold mb-1">What happens next?</p>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• We review your application within 1–2 business days</li>
              <li>• You'll get an email when approved</li>
              <li>• Then you can log in and set up your profile</li>
            </ul>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-neutral-500 border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
