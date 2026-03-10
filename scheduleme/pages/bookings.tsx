// pages/bookings.tsx — Consumer intake form with cinematic login animation
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Nav from '../components/Nav';
import IntakeForm from '../components/IntakeForm';
import { createClient } from '@supabase/supabase-js';
import { maybeSendWelcomeEmail } from '../lib/sendWelcome';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const Bookings: NextPage = () => {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'welcome' | 'transitioning' | 'done'>('loading');
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [fadeIn, setFadeIn] = useState(false);
  const [isNewAccount, setIsNewAccount] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const fullName =
          session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';
        const firstName = fullName.split(' ')[0];
        const initials = fullName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        // Check Supabase flag — only show welcome if they haven't seen it yet
        const { data: userRow } = await supabase
          .from('users')
          .select('has_seen_welcome')
          .eq('id', session.user.id)
          .maybeSingle();

        const isFirstVisit = userRow !== null && userRow.has_seen_welcome === false;

        if (!isFirstVisit) {
          router.replace('/account');
          return;
        }

        // Mark as seen immediately so refreshing doesn't replay it
        await supabase
          .from('users')
          .update({ has_seen_welcome: true })
          .eq('id', session.user.id);

        setIsNewAccount(true);
        setUserName(firstName);
        setUserInitials(initials);
        setPhase('welcome');

        // Send welcome email once — now Supabase-gated not localStorage-gated
        if (session.user.email) {
          maybeSendWelcomeEmail(session.user.email, fullName);
        }

        // Sequence: hold for 2.4s, then transition out over 0.7s
        setTimeout(() => {
          setPhase('transitioning');
          setTimeout(() => {
            setPhase('done');
            setFadeIn(true);
          }, 700);
        }, 2400);
      } else {
        setPhase('done');
        setTimeout(() => setFadeIn(true), 60);
      }
    });
  }, [router.query]);

  const showOverlay = phase === 'welcome' || phase === 'transitioning';
  const overlayFadingOut = phase === 'transitioning';

  return (
    <>
      <Head>
        <title>Find Your Pro — ScheduleMe</title>
        <meta name="description" content="Describe your service issue and get instantly matched with vetted local professionals." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style>{`
        @keyframes avatarPop {
          0%   { opacity: 0; transform: scale(0.5) translateY(16px); }
          60%  { transform: scale(1.08) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes textSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes subtitleFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ringPulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          70%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 40; opacity: 0; }
          to   { stroke-dashoffset: 0;  opacity: 1; }
        }
        @keyframes overlayOut {
          0%   { opacity: 1; transform: scale(1); }
          50%  { opacity: 0.8; transform: scale(1.02); }
          100% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes progressBar {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .welcome-overlay {
          animation: overlayIn 0.35s ease forwards;
        }
        .welcome-overlay.out {
          animation: overlayOut 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .avatar-pop {
          animation: avatarPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
        }
        .ring-pulse {
          animation: ringPulse 1.6s ease-out 0.5s infinite;
        }
        .text-slide {
          animation: textSlideUp 0.45s ease 0.55s both;
        }
        .subtitle-fade {
          animation: subtitleFade 0.4s ease 0.9s both;
        }
        .check-draw {
          stroke-dasharray: 40;
          animation: checkDraw 0.35s ease 0.4s both;
        }
        .progress-bar {
          animation: progressBar 2.2s cubic-bezier(0.4, 0, 0.2, 1) 1.1s both;
        }
      `}</style>

      {/* Cinematic Welcome Overlay */}
      {showOverlay && (
        <div
          className={`welcome-overlay fixed inset-0 z-[200] flex items-center justify-center ${overlayFadingOut ? 'out' : ''}`}
          style={{ background: 'linear-gradient(160deg, #f8faff 0%, #eef2ff 50%, #f8faff 100%)' }}
        >
          {/* Subtle dot grid */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />

          <div className="relative flex flex-col items-center text-center px-8" style={{ zIndex: 1 }}>
            {/* Avatar with pulse ring */}
            <div className="relative mb-8">
              <div
                className="ring-pulse absolute inset-0 rounded-full"
                style={{ background: 'rgba(59,130,246,0.2)' }}
              />
              <div
                className="avatar-pop relative h-24 w-24 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  boxShadow: '0 20px 60px rgba(59,130,246,0.35), 0 8px 20px rgba(59,130,246,0.2)',
                }}
              >
                {userInitials}
                {/* Green check badge */}
                <div
                  className="absolute -bottom-1.5 -right-1.5 h-9 w-9 rounded-full bg-white flex items-center justify-center"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="#22c55e" />
                    <path
                      className="check-draw"
                      d="M7.5 12.5l3 3 6-6"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Welcome text */}
            <h1
              className="text-slide font-black mb-2"
              style={{
                fontSize: 'clamp(28px, 5vw, 44px)',
                letterSpacing: '-0.03em',
                color: '#0f172a',
                lineHeight: 1.1,
              }}
            >
              Welcome, {userName}! 👋
            </h1>

            <p
              className="subtitle-fade text-base"
              style={{ color: '#64748b', marginTop: '8px' }}
            >
              You're signed in. Let's find you the right pro.
            </p>

            {/* Progress bar */}
            <div
              className="subtitle-fade mt-8 rounded-full overflow-hidden"
              style={{ width: '140px', height: '3px', background: '#e2e8f0' }}
            >
              <div
                className="progress-bar h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }}
              />
            </div>
          </div>
        </div>
      )}

      <Nav />

      <main
        className="bg-neutral-50"
        style={{
          minHeight: '100dvh',
          paddingTop: '72px',
          display: 'flex',
          flexDirection: 'column',
          opacity: fadeIn ? 1 : 0,
          transition: 'opacity 0.5s ease',
          animation: fadeIn ? 'pageIn 0.5s ease both' : 'none',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem 1.5rem' }}>
          <div className="mx-auto w-full" style={{ maxWidth: '560px' }}>
            <div className="text-center mb-10">
              <span className="section-eyebrow mb-3 block">AI-Powered Triage</span>
              <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
                Describe your issue
              </h1>
              <p className="text-neutral-500 leading-relaxed">
                Tell us what's wrong in plain language — our AI will identify the service type,
                urgency, and match you with the best local pros.
              </p>
            </div>
            <IntakeForm />
          </div>
        </div>
      </main>
    </>
  );
};

export default Bookings;
