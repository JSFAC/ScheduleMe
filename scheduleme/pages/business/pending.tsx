// @ts-nocheck
// pages/business/pending.tsx
// Shown to businesses that have applied but not yet been approved by admin

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
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
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Application Under Review</h1>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            Thank you for applying to ScheduleMe! Our team is reviewing your application.
            You'll receive an email once you've been approved and can access your business dashboard.
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
