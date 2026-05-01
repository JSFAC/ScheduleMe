// @ts-nocheck
import { useState } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead';
import { absoluteUrl } from '../../lib/siteMeta';

const FormFlyerPage: NextPage = () => {
  const formUrl = absoluteUrl('/form');
  const qrSrc = `https://quickchart.io/qr?text=${encodeURIComponent(formUrl)}&size=520&margin=1`;
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ScheduleMe form',
          text: 'Need help finding the right person? Start here.',
          url: formUrl,
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
        path="/flyer/form"
        robots="noindex,nofollow"
      />

      <style jsx global>{`
        @page {
          size: 4.25in 5.5in;
          margin: 0;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          .flyer-card,
          .flyer-card * {
            visibility: visible !important;
          }

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
            margin: 0 !important;
            background: white !important;
            overflow: hidden !important;
          }

          .flyer-card {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 4.25in !important;
            height: 5.22in !important;
            min-height: 5.22in !important;
            max-height: 5.22in !important;
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

          .print-hide {
            display: none !important;
          }

          .print-wordmark-hide {
            display: none !important;
          }

          .print-tight {
            padding-top: 0.5rem !important;
            padding-bottom: 0.55rem !important;
          }

          .print-headline {
            margin-top: 0 !important;
            font-size: 1.4rem !important;
            line-height: 0.92 !important;
          }

          .print-qr {
            height: 104px !important;
            width: 104px !important;
          }

          .print-box {
            padding-top: 0.8rem !important;
            padding-bottom: 0.8rem !important;
          }

          .print-steps {
            margin-top: 0.35rem !important;
            gap: 0.2rem !important;
            font-size: 0.84rem !important;
          }
        }
      `}</style>

      <main className="flyer-stage min-h-screen bg-[#f6f1e8] px-4 pt-5 pb-6 sm:px-6">
        <div className="flyer-toolbar mx-auto mb-6 w-full max-w-4xl">
          <div className="flex items-start justify-between gap-3">
            <Link href="/form" className="inline-flex items-center gap-3">
              <span className="text-[2rem] md:text-3xl font-black text-[#111827]" style={{ letterSpacing: '-0.04em' }}>
                Schedule<span style={{ color: '#0f766e' }}>Me</span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <button onClick={handleShare} className="btn-primary min-w-[6.75rem] px-6 py-2.5 text-sm">
                {shareState === 'error' ? 'Could not share' : 'Share'}
              </button>
              <Link href="/form" className="btn-secondary min-w-[6.75rem] px-6 py-2.5 text-sm">
                Open form
              </Link>
            </div>
          </div>
          <div className="mt-1">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">ScheduleMe flyer</p>
            <p className="text-sm text-neutral-600">Use this page for screenshots, AirDrop, or printing.</p>
          </div>
        </div>

        <section
          className="flyer-card mx-auto flex w-full max-w-[4.25in] flex-col overflow-hidden rounded-[28px] border border-[#d9d3c8] bg-white"
          style={{ boxShadow: '0 20px 60px rgba(15,23,42,0.12)' }}
        >
          <div className="print-tight bg-[#0f766e] px-6 py-5 text-center text-white">
            <p className="print-wordmark-hide text-[1rem] font-black leading-none text-white/92" style={{ letterSpacing: '-0.04em' }}>
              Schedule<span style={{ color: 'rgba(255,255,255,0.82)' }}>Me</span>
            </p>
            <h1 className="print-headline mt-2 text-[1.62rem] font-black leading-[0.94]" style={{ letterSpacing: '-0.06em' }}>
              Need help finding
              <br />
              the right person?
            </h1>
            <p className="print-hide mx-auto mt-3 max-w-[14.75rem] text-[0.92rem] leading-snug text-white/88">
              Haircuts first. I can also try to help with other campus services.
            </p>
          </div>

          <div className="px-6 py-4">
            <div className="print-box rounded-[22px] border border-[#d1d5db] bg-white px-4 py-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f766e]">Scan here</p>
              <div className="mx-auto mt-3 w-fit rounded-[20px] border border-[#d9d3c8] bg-white p-2 shadow-sm">
                <img src={qrSrc} alt="QR code for ScheduleMe form page" className="print-qr h-[116px] w-[116px]" />
              </div>
              <div className="mt-3 text-[#111827]" style={{ letterSpacing: '-0.05em' }}>
                <p className="text-[1.02rem] font-black leading-none">usescheduleme.com/form</p>
              </div>
              <p className="mt-3 mx-auto max-w-[13rem] text-[0.96rem] font-semibold leading-snug text-[#0f766e]">
                Better than asking around
                <br />
                and hoping for the best.
              </p>
            </div>

            <div className="print-box mt-4 rounded-[22px] border border-[#d1d5db] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f766e]">How it works</p>
              <ol className="print-steps mt-2 space-y-1.5 text-[0.92rem] leading-snug text-[#1f2937]">
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

export default FormFlyerPage;
