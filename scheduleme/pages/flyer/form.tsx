// @ts-nocheck
import { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import SeoHead from '../../components/SeoHead';
import { absoluteUrl } from '../../lib/siteMeta';

const FormFlyerPage: NextPage = () => {
  const router = useRouter();
  const formUrl = absoluteUrl('/form');
  const qrSrc = `https://quickchart.io/qr?text=${encodeURIComponent(formUrl)}&size=520&margin=1`;
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isLeaving, setIsLeaving] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function softNavigate(href: string) {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => {
      router.push(href);
    }, 190);
  }

  async function handleShare() {
    try {
      const prefersNativeShare =
        typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 767px)').matches &&
        typeof navigator.share === 'function';

      if (prefersNativeShare) {
        await navigator.share({
          title: 'ScheduleMe flyer',
          text: 'Need help finding the right person? Start here.',
          url: formUrl,
        });
        setShareState('idle');
        return;
      }

      await navigator.clipboard.writeText(formUrl);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2200);
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
            left: 0.12in !important;
            top: 0.16in !important;
            width: 4.01in !important;
            height: 5.16in !important;
            min-height: 5.16in !important;
            max-height: 5.16in !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            break-inside: avoid !important;
            break-after: avoid-page !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }

          .print-tight {
            padding-top: 0.46rem !important;
            padding-bottom: 0.42rem !important;
          }

          .print-headline {
            margin-top: 0 !important;
            font-size: 1.04rem !important;
            line-height: 0.94 !important;
          }

          .print-subhead {
            display: block !important;
            margin-top: 0.26rem !important;
            font-size: 0.68rem !important;
            line-height: 1.18 !important;
            opacity: 0.92 !important;
          }

          .print-qr {
            height: 92px !important;
            width: 92px !important;
          }

          .print-box {
            padding-top: 0.56rem !important;
            padding-bottom: 0.56rem !important;
          }

          .print-steps {
            margin-top: 0.24rem !important;
            gap: 0.12rem !important;
            font-size: 0.77rem !important;
          }
        }
      `}</style>

      <main
        className="flyer-stage min-h-screen bg-[#f6f1e8] px-6 pt-5 pb-6 transition-[opacity,filter] duration-200 md:pt-8"
        style={{
          opacity: isLeaving ? 0.72 : isReady ? 1 : 0,
          filter: isLeaving ? 'blur(1px)' : 'blur(0px)',
        }}
      >
        <div
          className="pointer-events-none fixed inset-0 z-[60] transition-opacity duration-200"
          style={{
            opacity: isLeaving ? 1 : isReady ? 0 : 1,
            background: 'rgba(246,241,232,0.32)',
          }}
        />
        <div className="flyer-toolbar mx-auto mb-6 w-full max-w-4xl">
          <div className="flex min-h-[64px] items-center justify-between gap-3 overflow-hidden">
            <div className="min-h-[64px] min-w-0 flex-1 flex-col justify-center md:flex">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">ScheduleMe flyer</p>
              <p className="text-sm text-neutral-600">Use this page for screenshots, AirDrop, or printing.</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={handleShare}
                className="btn-primary hidden min-w-[6.75rem] px-6 py-2.5 text-sm md:inline-flex"
                style={{ boxShadow: '0 6px 14px rgba(15,118,110,0.10)' }}
              >
                {shareState === 'copied' ? 'Link copied' : shareState === 'error' ? 'Could not share' : 'Share'}
              </button>
              <button
                type="button"
                onClick={() => softNavigate('/form')}
                className="btn-secondary min-w-[6.75rem] px-5 py-2.5 text-sm"
              >
                <span className="hidden md:inline">Back to form</span>
                <span className="md:hidden">Form</span>
              </button>
            </div>
          </div>
        </div>

        <section
          className="flyer-card mx-auto flex w-full max-w-[4.25in] flex-col overflow-hidden rounded-[28px] border border-[#d9d3c8] bg-white"
          style={{ boxShadow: '0 20px 60px rgba(15,23,42,0.12)' }}
        >
          <div className="print-tight bg-[#0f766e] px-6 py-5 text-center text-white">
            <h1 className="print-headline text-[1.62rem] font-black leading-[0.94]" style={{ letterSpacing: '-0.06em' }}>
              Need help booking
              <br />
              the right person?
            </h1>
            <p className="print-subhead mx-auto mt-3 max-w-[14.75rem] text-[0.92rem] leading-snug text-white/88 print:text-[0.76rem]">
              Haircuts, photography, 3D prints, and other campus services.
            </p>
          </div>

          <div className="px-6 py-4">
            <div className="print-box rounded-[22px] border border-[#d1d5db] bg-white px-4 py-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f766e]">Scan here</p>
              <div className="mx-auto mt-3 w-fit rounded-[20px] bg-white p-1.5">
                <img src={qrSrc} alt="QR code for ScheduleMe form page" className="print-qr h-[116px] w-[116px]" />
              </div>
              <div className="mt-3 text-[#111827]" style={{ letterSpacing: '-0.05em' }}>
                <p className="text-[1.02rem] font-black leading-none">usescheduleme.com/form</p>
              </div>
              <p className="mt-3 mx-auto max-w-[13rem] text-[0.96rem] font-semibold leading-snug text-[#0f766e]">
                Better than asking around
                <br />
                for a recommendation.
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
