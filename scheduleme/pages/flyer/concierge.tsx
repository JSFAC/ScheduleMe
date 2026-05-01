// @ts-nocheck
import type { NextPage } from 'next';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead';
import { absoluteUrl } from '../../lib/siteMeta';

const ConciergeFlyerPage: NextPage = () => {
  const conciergeUrl = absoluteUrl('/concierge');
  const qrSrc = `https://quickchart.io/qr?text=${encodeURIComponent(conciergeUrl)}&size=240`;

  return (
    <>
      <SeoHead
        title="Concierge Flyer — ScheduleMe"
        description="Print-friendly flyer for ScheduleMe Concierge."
        path="/flyer/concierge"
        robots="noindex,nofollow"
      />
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .flyer-toolbar {
            display: none !important;
          }

          .flyer-shell {
            padding: 0 !important;
          }

          .flyer-card {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            min-height: 100vh !important;
          }
        }
      `}</style>

      <main className="min-h-screen bg-[#f4efe6] py-8 px-4 flyer-shell">
        <div className="flyer-toolbar mx-auto max-w-5xl mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e] mb-1">ScheduleMe Concierge Flyer</p>
            <p className="text-sm text-neutral-600">Use this page for screenshots, AirDrop, or printing.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => window.print()} className="btn-primary">
              Print flyer
            </button>
            <Link href="/concierge" className="btn-secondary">
              Open concierge page
            </Link>
          </div>
        </div>

        <section
          className="flyer-card mx-auto max-w-5xl rounded-[40px] border border-neutral-200 bg-white overflow-hidden"
          style={{ boxShadow: '0 28px 70px rgba(15,23,42,0.14)' }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.02fr_0.98fr] min-h-[920px]">
            <div className="relative px-8 py-10 md:px-12 md:py-12 bg-[#0d1312] text-white overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                  maskImage: 'radial-gradient(ellipse 95% 88% at 20% 0%, black 40%, transparent 100%)',
                }}
              />
              <div
                aria-hidden="true"
                className="absolute -right-24 -top-24 h-72 w-72 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(15,118,110,0.42) 0%, transparent 70%)' }}
              />

              <div className="relative z-[1]">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#78d4c2] mb-4">ScheduleMe Concierge</p>
                <h1 className="text-[3.1rem] md:text-[4.2rem] font-black leading-[0.9]" style={{ letterSpacing: '-0.06em' }}>
                  Better
                  <br />
                  campus
                  <br />
                  service
                  <br />
                  matches.
                </h1>
                <p className="mt-5 max-w-md text-base md:text-lg leading-relaxed text-white/78">
                  Need a barber, photographer, tutor, or another trusted campus service? Tell ScheduleMe what you need and we&apos;ll help route the request.
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    'Start with a request, not an empty marketplace',
                    'We handle the matching manually',
                    'Free for students in the beta',
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-3 text-sm md:text-base text-white/86">
                      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-white text-[11px] font-black">✓</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-10 rounded-[28px] border border-white/12 bg-white/6 p-5 backdrop-blur-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#78d4c2] mb-3">Slogan</p>
                  <p className="text-2xl md:text-3xl font-black leading-tight text-white" style={{ letterSpacing: '-0.04em' }}>
                    “When I need help finding someone,
                    <br />
                    I go to ScheduleMe.”
                  </p>
                </div>
              </div>
            </div>

            <div className="px-8 py-10 md:px-12 md:py-12 bg-[#f8f5ee] flex flex-col justify-center">
              <div className="rounded-[28px] border border-[#d8d1c4] bg-white p-7 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0f766e] mb-3">Scan to request</p>
                <div className="mx-auto mb-5 h-[240px] w-[240px] rounded-[24px] border border-[#d8d1c4] bg-white p-3">
                  <img src={qrSrc} alt="QR code for ScheduleMe concierge page" className="h-full w-full object-contain" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-[#111827]" style={{ letterSpacing: '-0.05em' }}>
                  usescheduleme.com/concierge
                </h2>
                <p className="mt-4 text-base leading-relaxed text-neutral-600">
                  Tell us what you need, your budget, and your timing. We&apos;ll help from there.
                </p>
              </div>

              <div className="mt-6 rounded-[24px] border border-[#d8d1c4] bg-white p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0f766e] mb-3">Keep it simple</p>
                <ul className="space-y-2 text-sm leading-relaxed text-neutral-700">
                  <li>• barber</li>
                  <li>• photography</li>
                  <li>• tutoring</li>
                  <li>• other trusted campus services</li>
                </ul>
              </div>

              <div className="mt-6 rounded-[28px] border border-dashed border-[#0f766e] bg-[#e9f7f3] px-5 py-6">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0f766e] mb-2">Beta</p>
                <p className="text-xl md:text-2xl font-black leading-tight text-[#0f172a]" style={{ letterSpacing: '-0.04em' }}>
                  Manual matching now.
                  <br />
                  Better marketplace later.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default ConciergeFlyerPage;
