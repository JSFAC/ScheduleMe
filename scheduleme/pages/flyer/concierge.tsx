// @ts-nocheck
import { useState } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead';
import { absoluteUrl } from '../../lib/siteMeta';

const ConciergeFlyerPage: NextPage = () => {
  const conciergeUrl = absoluteUrl('/form');
  const qrSrc = `https://quickchart.io/qr?text=${encodeURIComponent(conciergeUrl)}&size=520&margin=1`;
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ScheduleMe form',
          text: 'Need help finding the right person? Start here.',
          url: conciergeUrl,
        });
        setShareState('idle');
        return;
      }

      window.print();
    } catch {
      setShareState('error');
      window.setTimeout(() => setShareState('idle'), 2200);
    }
  }

  return (
    <>
      <SeoHead
        title="Concierge Flyer — ScheduleMe"
        description="Simple print-friendly flyer for ScheduleMe Concierge."
        path="/flyer/concierge"
        robots="noindex,nofollow"
      />

      <style jsx global>{`
        @page {
          size: 4.25in 5.5in;
          margin: 0;
        }

        @media print {
          html,
          body {
            background: white !important;
            width: 4.25in;
            height: 5.5in;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .flyer-toolbar {
            display: none !important;
          }

          .flyer-stage {
            min-height: 5.5in !important;
            height: 5.5in !important;
            padding: 0 !important;
            background: white !important;
            overflow: hidden !important;
          }

          .flyer-card {
            width: 4.25in !important;
            height: 5.5in !important;
            min-height: 5.5in !important;
            max-height: 5.5in !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            overflow: hidden !important;
            break-inside: avoid !important;
            break-after: avoid-page !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>

      <main className="flyer-stage min-h-screen bg-[#f6f1e8] px-4 py-6 sm:px-6">
        <div className="flyer-toolbar mx-auto mb-5 flex w-full max-w-4xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">ScheduleMe flyer</p>
            <p className="text-sm text-neutral-600">Use this page for screenshots, AirDrop, or printing.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={handleShare} className="btn-primary">
              {shareState === 'error' ? 'Could not share' : 'Share'}
            </button>
            <Link href="/form" className="btn-secondary">
              Open form
            </Link>
          </div>
        </div>

        <section
          className="flyer-card mx-auto flex w-full max-w-[4.25in] flex-col overflow-hidden rounded-[28px] border border-[#d9d3c8] bg-white"
          style={{ boxShadow: '0 20px 60px rgba(15,23,42,0.12)' }}
        >
          <div className="bg-[#0f766e] px-6 py-5 text-center text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/80">ScheduleMe</p>
            <h1 className="mt-3 text-[2rem] font-black leading-[0.94]" style={{ letterSpacing: '-0.06em' }}>
              Need help finding
              <br />
              the right person?
            </h1>
            <p className="mx-auto mt-3 max-w-[14.75rem] text-[0.92rem] leading-snug text-white/88">
              Haircuts first. I can also try to help with other campus services.
            </p>
          </div>

          <div className="px-6 py-4">
            <div className="rounded-[22px] border border-[#d9d3c8] bg-[#fcfaf5] px-4 py-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f766e]">Scan here</p>
              <div className="mx-auto mt-3 w-fit rounded-[20px] border border-[#d9d3c8] bg-white p-2 shadow-sm">
                <img src={qrSrc} alt="QR code for ScheduleMe concierge page" className="h-[116px] w-[116px]" />
              </div>
              <div className="mt-3 text-[#111827]" style={{ letterSpacing: '-0.05em' }}>
                <p className="text-[1.02rem] font-black leading-none">usescheduleme.com/form</p>
              </div>
              <p className="mt-3 text-[0.96rem] font-semibold leading-snug text-[#0f172a]">
                Better than asking around and hoping it works out.
              </p>
            </div>

            <div className="mt-4 rounded-[22px] border border-[#d9d3c8] bg-[#fcfaf5] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f766e]">How it works</p>
              <ol className="mt-2 space-y-1.5 text-[0.92rem] leading-snug text-[#1f2937]">
                <li>1. Tell me what you need.</li>
                <li>2. I&apos;ll try to find a good fit.</li>
                <li>3. I&apos;ll follow up fast if I can help.</li>
              </ol>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default ConciergeFlyerPage;
