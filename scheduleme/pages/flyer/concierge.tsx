// @ts-nocheck
import { useState } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead';
import { absoluteUrl } from '../../lib/siteMeta';

const ConciergeFlyerPage: NextPage = () => {
  const conciergeUrl = absoluteUrl('/concierge');
  const qrSrc = `https://quickchart.io/qr?text=${encodeURIComponent(conciergeUrl)}&size=520&margin=1`;
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ScheduleMe concierge flyer',
          text: 'Need help finding the right person? Start here.',
          url: conciergeUrl,
        });
        setShareState('idle');
        return;
      }

      await navigator.clipboard.writeText(conciergeUrl);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2200);
    } catch {
      setShareState('error');
      window.setTimeout(() => setShareState('idle'), 2200);
    }
  }

  function handleDownloadPdf() {
    window.print();
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
          }

          .flyer-toolbar {
            display: none !important;
          }

          .flyer-stage {
            min-height: auto !important;
            padding: 0 !important;
            background: white !important;
          }

          .flyer-card {
            width: 4.25in !important;
            min-height: 5.5in !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <main className="flyer-stage min-h-screen bg-[#f6f1e8] px-4 py-6 sm:px-6">
        <div className="flyer-toolbar mx-auto mb-5 flex w-full max-w-4xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">ScheduleMe flyer</p>
            <p className="text-sm text-neutral-600">Print this as a quarter-sheet or save it as a PDF.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={handleShare} className="btn-secondary">
              {shareState === 'copied' ? 'Link copied' : shareState === 'error' ? 'Could not share' : 'Share flyer'}
            </button>
            <button onClick={handleDownloadPdf} className="btn-primary">
              Download PDF
            </button>
            <Link href="/concierge" className="btn-secondary">
              Open page
            </Link>
          </div>
        </div>

        <section
          className="flyer-card mx-auto flex w-full max-w-[4.25in] flex-col overflow-hidden rounded-[28px] border border-[#d9d3c8] bg-white"
          style={{ boxShadow: '0 20px 60px rgba(15,23,42,0.12)' }}
        >
          <div className="bg-[#0f766e] px-6 py-5 text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/80">ScheduleMe</p>
            <h1 className="mt-3 text-[2.2rem] font-black leading-[0.92]" style={{ letterSpacing: '-0.06em' }}>
              Need help
              <br />
              finding the
              <br />
              right person?
            </h1>
            <p className="mt-3 max-w-[15rem] text-[0.98rem] leading-snug text-white/88">
              Haircuts first, but I can also try to help with other campus services too.
            </p>
          </div>

          <div className="px-6 py-5">
            <div className="rounded-[22px] border border-[#d9d3c8] bg-[#fcfaf5] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f766e]">How it works</p>
              <ul className="mt-3 space-y-2 text-[0.96rem] leading-snug text-[#1f2937]">
                <li>1. Tell me what you need.</li>
                <li>2. I&apos;ll try to find a good fit.</li>
                <li>3. I&apos;ll follow up fast if I can help.</li>
              </ul>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <div className="rounded-[20px] border border-[#d9d3c8] bg-white p-2 shadow-sm">
                <img src={qrSrc} alt="QR code for ScheduleMe concierge page" className="h-[118px] w-[118px]" />
              </div>

              <div className="flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f766e]">Scan here</p>
                <p className="mt-2 text-[1.2rem] font-black leading-[1.02] text-[#111827]" style={{ letterSpacing: '-0.05em' }}>
                  usescheduleme.com/concierge
                </p>
                <p className="mt-2 text-[0.92rem] leading-snug text-neutral-600">
                  Send your budget, timing, and what you&apos;re looking for.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[22px] bg-[#eef8f5] px-4 py-4">
              <p className="text-[0.98rem] font-semibold leading-snug text-[#0f172a]">
                Better than asking around and hoping the referral is good.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default ConciergeFlyerPage;
