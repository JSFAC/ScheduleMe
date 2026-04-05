// pages/business/signup.tsx — commission model signup, no plan picker
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import BusinessNav from '../../components/BusinessNav';

type Step = 'form' | 'submitting' | 'success';
interface FormData {
  businessName: string; ownerName: string; email: string; phone: string;
  serviceCategory: string; otherCategory: string; city: string; zip: string; radiusMiles: string;
  licenseNumber: string; yearsInBusiness: string; agree: boolean;
  campusProvider: boolean; schoolName: string;
}

const SERVICE_CATEGORIES = [
  'Plumbing','HVAC','Electrical','Automotive','Home Repair / Handyman',
  'Cleaning','Salon / Beauty','Landscaping','Pest Control','Moving','Painting',
  'Photography','Tutoring','Arts & Crafts','Hair & Beauty','Other'
];
const RADIUS_OPTIONS = ['5 miles','10 miles','15 miles','25 miles','50 miles','100 miles'];

const SignupPage: NextPage = () => {
  const [step, setStep] = useState<Step>('form');
  const [apiError, setApiError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaWidgetId, setCaptchaWidgetId] = useState<number | null>(null);
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    const renderCaptcha = () => {
      const hcaptcha = (window as any).hcaptcha;
      if (!hcaptcha || !captchaRef.current || captchaWidgetId !== null) return;
      const id = hcaptcha.render(captchaRef.current, {
        sitekey: siteKey,
        callback: (token: string) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
      });
      setCaptchaWidgetId(id);
    };
    if ((window as any).hcaptcha) {
      renderCaptcha();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://hcaptcha.com/1/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = renderCaptcha;
    document.body.appendChild(script);
  }, [siteKey, captchaWidgetId]);
  const [form, setForm] = useState<FormData>({
    businessName:'', ownerName:'', email:'', phone:'', serviceCategory:'', otherCategory:'',
    city:'', zip:'', radiusMiles:'25 miles', licenseNumber:'', yearsInBusiness:'', agree:false,
    campusProvider:false, schoolName:'',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function set(key: keyof FormData, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.businessName.trim()) e.businessName = 'Provider name is required.';
    if (!form.ownerName.trim()) e.ownerName = 'Your name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (!/^[\d\s\-().+]{7,20}$/.test(form.phone)) e.phone = 'Enter a valid phone number.';
    if (!form.serviceCategory) e.serviceCategory = 'Select a service category.';
    if (form.serviceCategory === 'Other' && !form.otherCategory.trim()) e.otherCategory = 'Please describe your service.';
    if (!form.city.trim()) e.city = 'Enter your city.';
    if (!form.zip.trim()) e.zip = 'Enter your ZIP code.';
    if (form.zip && !/^\d{5}(-\d{4})?$/.test(form.zip.trim())) e.zip = 'Enter a valid ZIP code.';
    if (!form.agree) e.agree = 'You must agree to the terms.';
    if (siteKey && !captchaToken) e.captcha = 'Please complete the captcha.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStep('submitting');
    setApiError(null);
    try {
      const res = await fetch('/api/business-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plan: 'commission', captchaToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setStep('success');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('form');
    }
  }

  if (step === 'submitting') return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-center" role="status" aria-live="polite">
        <div className="relative h-16 w-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        </div>
        <p className="text-white font-semibold text-lg">Submitting your application…</p>
        <p className="text-neutral-500 text-sm mt-2">Just a moment</p>
      </div>
    </div>
  );

  if (step === 'success') return (
    <>
      <Head><title>Application Submitted — ScheduleMe for Providers</title></Head>
      <BusinessNav />
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6 pt-24">
        <div className="max-w-md w-full text-center">
          <div className="h-20 w-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <svg className="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Application received!</h1>
          <p className="text-neutral-400 leading-relaxed mb-8">
            Thanks, <strong className="text-white">{form.ownerName}</strong>. We will review{' '}
            <strong className="text-white">{form.businessName}</strong> and send approval to{' '}
            <strong className="text-white">{form.email}</strong> within 24 hours.
          </p>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-left space-y-4 mb-8">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">What happens next</p>
            {[
              'We verify your license and provider details (up to 24 hrs)',
              'You receive a welcome email with your dashboard login',
              'Connect your bank account via Stripe to receive payments',
              'First job requests start arriving once your profile is live',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-neutral-300">{item}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/business/auth/login" className="btn-primary w-full justify-center">Log In to Dashboard</Link>
            <Link href="/business" className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl border border-neutral-700 text-neutral-300 text-sm font-semibold hover:bg-neutral-800 transition-colors">
              Back to Provider Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Head>
        <title>Join ScheduleMe — Create Your Provider Profile</title>
        <meta name="description" content="Join ScheduleMe as a service professional. Free to join, 12% only on completed jobs." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <BusinessNav />
      <div className="min-h-screen bg-neutral-950 pt-20 pb-20 px-4 md:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <span className="section-eyebrow mb-3 block">Provider Application</span>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ letterSpacing: '-0.02em' }}>
              Create your provider profile
            </h1>
            <p className="text-neutral-400 mb-6">Takes about 5 minutes. Free to join — we only take 12% when you get paid.</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                {
                  icon: (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  ),
                  label: 'SSL Encrypted',
                },
                { icon: '✓', label: 'Verified Platform' },
                { icon: '$0', label: 'Free to Join' },
                { icon: '12%', label: 'Only on Earnings' },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-400">
                  <span className="text-accent font-bold flex items-center">{b.icon}</span>{b.label}
                </div>
              ))}
            </div>
          </div>

          {apiError && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-6">{apiError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8 space-y-8">

              {/* Step 1: Provider Info */}
              <fieldset>
                <legend className="text-sm font-semibold text-neutral-200 mb-5 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">1</span>
                  Provider Information
                </legend>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Provider name *</label>
                    <div className="relative">
                      <input type="text" maxLength={60} className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.businessName ? 'ring-2 ring-red-400' : ''}`}
                        placeholder="Mike R. Plumbing" value={form.businessName} onChange={e => set('businessName', e.target.value)} />
                      <span className="absolute bottom-2 right-3 text-[10px] text-neutral-500">{form.businessName.length}/60</span>
                    </div>
                    {errors.businessName && <p className="mt-1 text-xs text-red-400">{errors.businessName}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">Owner / contact name *</label>
                      <div className="relative">
                        <input type="text" maxLength={60} className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.ownerName ? 'ring-2 ring-red-400' : ''}`}
                          placeholder="Mike Rodriguez" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
                        <span className="absolute bottom-2 right-3 text-[10px] text-neutral-500">{form.ownerName.length}/60</span>
                      </div>
                      {errors.ownerName && <p className="mt-1 text-xs text-red-400">{errors.ownerName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">Years in business <span className="text-xs text-neutral-600">(optional)</span></label>
                      <input type="number" min="0" max="100" className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                        placeholder="5" value={form.yearsInBusiness} onChange={e => set('yearsInBusiness', e.target.value)} />
                    </div>
                  </div>
                </div>
              </fieldset>

              <div className="h-px bg-neutral-800" />

              {/* Step 2: Contact */}
              <fieldset>
                <legend className="text-sm font-semibold text-neutral-200 mb-5 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">2</span>
                  Contact Details
                </legend>
                <p className="text-xs text-neutral-600 -mt-2 mb-4">(not publicly available for consumers)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Email *</label>
                    <div className="relative">
                      <input type="email" autoComplete="email" maxLength={200} className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.email ? 'ring-2 ring-red-400' : ''}`}
                        placeholder="mike@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
                      <span className="absolute bottom-2 right-3 text-[10px] text-neutral-500">{form.email.length}/200</span>
                    </div>
                    {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Phone *</label>
                    <div className="relative">
                      <input type="tel" autoComplete="tel" maxLength={20} className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.phone ? 'ring-2 ring-red-400' : ''}`}
                        placeholder="(512) 555-0100" value={form.phone} onChange={e => set('phone', e.target.value)} />
                      <span className="absolute bottom-2 right-3 text-[10px] text-neutral-500">{form.phone.length}/20</span>
                    </div>
                    {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
                  </div>
                </div>
              </fieldset>

              <div className="h-px bg-neutral-800" />

              {/* Step 3: Service & Location */}
              <fieldset>
                <legend className="text-sm font-semibold text-neutral-200 mb-5 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">3</span>
                  Service & Location
                </legend>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Service category *</label>
                    <select className={`form-input bg-neutral-800 border-neutral-700 text-white ${errors.serviceCategory ? 'ring-2 ring-red-400' : ''}`}
                      value={form.serviceCategory} onChange={e => set('serviceCategory', e.target.value)}>
                      <option value="" disabled className="bg-neutral-800">Select a category…</option>
                      {SERVICE_CATEGORIES.map(c => <option key={c} value={c} className="bg-neutral-800">{c}</option>)}
                    </select>
                    {errors.serviceCategory && <p className="mt-1 text-xs text-red-400">{errors.serviceCategory}</p>}
                  </div>
                  {form.serviceCategory === 'Other' && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">Describe your service *</label>
                      <div className="relative">
                        <input type="text" maxLength={60} className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.otherCategory ? 'ring-2 ring-red-400' : ''}`}
                          placeholder="e.g. Pool maintenance" value={form.otherCategory} onChange={e => set('otherCategory', e.target.value)} />
                        <span className="absolute bottom-2 right-3 text-[10px] text-neutral-500">{form.otherCategory.length}/60</span>
                      </div>
                      {errors.otherCategory && <p className="mt-1 text-xs text-red-400">{errors.otherCategory}</p>}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">City *</label>
                      <div className="relative">
                        <input type="text" maxLength={120} className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.city ? 'ring-2 ring-red-400' : ''}`}
                          placeholder="Austin, TX" value={form.city} onChange={e => set('city', e.target.value)} />
                        <span className="absolute bottom-2 right-3 text-[10px] text-neutral-500">{form.city.length}/120</span>
                      </div>
                      {errors.city && <p className="mt-1 text-xs text-red-400">{errors.city}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">ZIP code *</label>
                      <div className="relative">
                        <input type="text" maxLength={10} className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.zip ? 'ring-2 ring-red-400' : ''}`}
                          placeholder="95060" value={form.zip} onChange={e => set('zip', e.target.value)} />
                        <span className="absolute bottom-2 right-3 text-[10px] text-neutral-500">{form.zip.length}/10</span>
                      </div>
                      {errors.zip && <p className="mt-1 text-xs text-red-400">{errors.zip}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">Service radius</label>
                      <select className="form-input bg-neutral-800 border-neutral-700 text-white" value={form.radiusMiles} onChange={e => set('radiusMiles', e.target.value)}>
                        {RADIUS_OPTIONS.map(r => <option key={r} value={r} className="bg-neutral-800">{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">License number <span className="text-xs text-neutral-600">(if applicable)</span></label>
                    <input type="text" className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                      placeholder="e.g. TX-PLB-123456" value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} />
                  </div>
                </div>
              </fieldset>

              <div className="h-px bg-neutral-800" />

              {/* Campus Provider (optional) */}
              <fieldset>
                <legend className="text-sm font-semibold text-neutral-200 mb-5 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">4</span>
                  Campus Marketplace <span className="text-neutral-600 font-normal text-xs ml-1">(optional)</span>
                </legend>
                <div className="space-y-4">
                  {/* Toggle */}
                  <label className="flex items-center justify-between gap-4 cursor-pointer p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-neutral-200">I serve college students</p>
                      <p className="text-xs text-neutral-500 mt-0.5">List your services on the ScheduleMe campus feed and become eligible for Featured.</p>
                    </div>
                    <div className="relative shrink-0">
                      <input type="checkbox" className="sr-only" checked={form.campusProvider} onChange={e => set('campusProvider', e.target.checked)} />
                      <div className="w-10 h-5 rounded-full transition-colors" style={{ background: form.campusProvider ? '#007e6d' : '#404040' }} />
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: form.campusProvider ? '22px' : '2px' }} />
                    </div>
                  </label>
                  {/* School name — appears when toggled */}
                  {form.campusProvider && (
                    <div className="relative">
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">Which school?</label>
                      <input type="text" className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                        placeholder="e.g. Arizona State University"
                        maxLength={100} value={form.schoolName} onChange={e => set('schoolName', e.target.value)} />
                      <span className="absolute bottom-2 right-3 text-[10px] text-neutral-500">{form.schoolName.length}/100</span>
                      <p className="text-xs text-neutral-600 mt-1.5">We'll verify your campus affiliation after approval.</p>
                    </div>
                  )}
                </div>
              </fieldset>

              {/* Commission reminder */}
              <div className="rounded-xl bg-accent/5 border border-accent/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">How payments work</p>
                    <p className="text-sm text-neutral-400">
                      Joining is completely free. ScheduleMe takes a <strong className="text-accent">12% platform fee</strong> only when a customer pays you for a completed job. No monthly fees, no per-lead charges.
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      <strong className="text-accent">Founder50:</strong> Standard platform fee is 12%, but Founder50 members are locked into 6% forever.
                      Founder50 is assigned after approval to the first 50 providers per campus.
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      <strong className="text-accent">Featured reward:</strong> Complete 3 bookings (or get selected) and you can be featured at the top of your campus feed for 7 days.
                    </p>
                  </div>
                </div>
              </div>

              {/* Agreement */}
              <div className={`rounded-xl border p-4 ${errors.agree ? 'border-red-500/40 bg-red-500/5' : 'border-neutral-800'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-accent focus:ring-accent"
                    checked={form.agree} onChange={e => set('agree', e.target.checked)} />
                  <span className="text-sm text-neutral-400">
                    I agree to the <a href="/terms" className="text-accent hover:underline">Terms of Service</a>,{' '}
                    <a href="/privacy" className="text-accent hover:underline">Privacy Policy</a>, and the{' '}
                    <strong className="text-neutral-300">12% commission structure</strong> on completed jobs.
                  </span>
                </label>
                {errors.agree && <p className="mt-2 text-xs text-red-400 ml-7">{errors.agree}</p>}
              </div>
            </div>

            {siteKey && (
              <div className="mt-6">
                <div ref={captchaRef} />
                {errors.captcha && <p className="mt-2 text-xs text-red-400">{errors.captcha}</p>}
              </div>
            )}

            <button type="submit" className="btn-primary w-full text-base py-4 mt-6 shadow-xl shadow-accent/20">
              Submit Application →
            </button>
            <p className="text-center text-xs text-neutral-600 mt-4">
              We will verify your info and email you within 24 hours. No credit card needed.
            </p>
          </form>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
