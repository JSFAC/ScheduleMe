// pages/business/signup.tsx — connects to Supabase via /api/business-signup
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import BusinessNav from '../../components/BusinessNav';

type Step = 'form' | 'submitting' | 'success';
interface FormData {
  businessName: string; ownerName: string; email: string; phone: string;
  serviceCategory: string; otherCategory: string; city: string; radiusMiles: string;
  licenseNumber: string; yearsInBusiness: string; plan: 'starter' | 'pro';
  calendlyUrl: string; agree: boolean;
}

const SERVICE_CATEGORIES = ['Plumbing','HVAC','Electrical','Automotive','Home Repair / Handyman','Cleaning','Salon / Beauty','Landscaping','Pest Control','Other'];
const RADIUS_OPTIONS = ['5 miles','10 miles','15 miles','25 miles','50 miles','100 miles'];

const SignupPage: NextPage = () => {
  const [step, setStep] = useState<Step>('form');
  const [apiError, setApiError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    businessName:'', ownerName:'', email:'', phone:'', serviceCategory:'', otherCategory:'',
    city:'', radiusMiles:'25 miles', licenseNumber:'', yearsInBusiness:'',
    plan:'starter', calendlyUrl:'', agree:false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function set(key: keyof FormData, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.businessName.trim()) e.businessName = 'Business name is required.';
    if (!form.ownerName.trim()) e.ownerName = 'Your name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (!/^[\d\s\-().+]{7,20}$/.test(form.phone)) e.phone = 'Enter a valid phone number.';
    if (!form.serviceCategory) e.serviceCategory = 'Select a service category.';
    if (form.serviceCategory === 'Other' && !form.otherCategory.trim()) e.otherCategory = 'Please describe your service.';
    if (!form.city.trim()) e.city = 'Enter your city or zip code.';
    if (!form.agree) e.agree = 'You must agree to the terms.';
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
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setStep('success');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('form');
    }
  }

  if (step === 'submitting') {
    return (
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
  }

  if (step === 'success') {
    return (
      <>
        <Head><title>Application Submitted — ScheduleMe for Business</title></Head>
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
              Thanks, <strong className="text-white">{form.ownerName}</strong>. We&apos;ll review <strong className="text-white">{form.businessName}</strong> and send approval + onboarding details to <strong className="text-white">{form.email}</strong> within 24 hours.
            </p>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-left space-y-3 mb-8">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4">What happens next</p>
              {['License & background verification (up to 24 hrs)','Welcome email with dashboard access link','First leads start arriving once profile is live'].map((item, i) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-neutral-300">{item}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/auth/login" className="btn-primary w-full justify-center">Log In to Dashboard</Link>
              <Link href="/business" className="btn-secondary w-full justify-center border-neutral-700 bg-neutral-800 text-neutral-200 hover:bg-neutral-700">Back to Business Home</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Join ScheduleMe — Create Your Business Profile</title>
        <meta name="description" content="Sign up as a service professional on ScheduleMe." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <BusinessNav />
      <div className="min-h-screen bg-neutral-950 pt-28 pb-20 px-6">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-10">
            <span className="section-eyebrow mb-3 block">Business Signup</span>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Create your business profile</h1>
            <p className="text-neutral-400">Takes about 5 minutes. No credit card required to start.</p>
          </div>

          {/* Plan picker */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { key: 'starter' as const, label: 'Starter', price: 'Free', sub: '+ $8/lead', tag: '' },
              { key: 'pro' as const, label: 'Pro', price: '$79/mo', sub: 'Unlimited leads', tag: 'Most Popular' },
            ].map(plan => (
              <button key={plan.key} type="button" onClick={() => set('plan', plan.key)}
                className={`rounded-2xl border p-5 text-left transition-all ${form.plan === plan.key ? 'border-accent bg-accent/10 ring-2 ring-accent/40' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'}`}
                aria-pressed={form.plan === plan.key}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-semibold text-neutral-300 uppercase tracking-widest">{plan.label}</p>
                  {plan.tag && <span className="badge bg-accent text-white text-[10px]">{plan.tag}</span>}
                </div>
                <p className="text-2xl font-black text-white" style={{ letterSpacing: '-0.02em' }}>{plan.price}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{plan.sub}</p>
              </button>
            ))}
          </div>

          {apiError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-6">{apiError}</div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8 space-y-6">
              {/* Business info */}
              <fieldset>
                <legend className="text-sm font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">1</span>
                  Business Information
                </legend>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Business name *</label>
                    <input type="text" className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.businessName ? 'ring-2 ring-red-400' : ''}`}
                      placeholder="Mike R. Plumbing" value={form.businessName} onChange={e => set('businessName', e.target.value)} />
                    {errors.businessName && <p className="mt-1 text-xs text-red-400">{errors.businessName}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">Your name *</label>
                      <input type="text" className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.ownerName ? 'ring-2 ring-red-400' : ''}`}
                        placeholder="Mike Rodriguez" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
                      {errors.ownerName && <p className="mt-1 text-xs text-red-400">{errors.ownerName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">Years in business</label>
                      <input type="number" min="0" max="100" className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                        placeholder="5" value={form.yearsInBusiness} onChange={e => set('yearsInBusiness', e.target.value)} />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Contact */}
              <fieldset>
                <legend className="text-sm font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">2</span>
                  Contact Details
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Email *</label>
                    <input type="email" autoComplete="email" className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.email ? 'ring-2 ring-red-400' : ''}`}
                      placeholder="mike@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
                    {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Phone *</label>
                    <input type="tel" autoComplete="tel" className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.phone ? 'ring-2 ring-red-400' : ''}`}
                      placeholder="(512) 555-0100" value={form.phone} onChange={e => set('phone', e.target.value)} />
                    {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
                  </div>
                </div>
              </fieldset>

              {/* Service & Location */}
              <fieldset>
                <legend className="text-sm font-semibold text-neutral-200 mb-4 flex items-center gap-2">
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
                      <input type="text" className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.otherCategory ? 'ring-2 ring-red-400' : ''}`}
                        placeholder="e.g. Pool maintenance" value={form.otherCategory} onChange={e => set('otherCategory', e.target.value)} />
                      {errors.otherCategory && <p className="mt-1 text-xs text-red-400">{errors.otherCategory}</p>}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-400 mb-1.5">Primary city / zip *</label>
                      <input type="text" className={`form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 ${errors.city ? 'ring-2 ring-red-400' : ''}`}
                        placeholder="Austin, TX or 78701" value={form.city} onChange={e => set('city', e.target.value)} />
                      {errors.city && <p className="mt-1 text-xs text-red-400">{errors.city}</p>}
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

              {/* Calendly — optional */}
              <fieldset>
                <legend className="text-sm font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">4</span>
                  Online Booking <span className="text-neutral-600 font-normal text-xs">(optional)</span>
                </legend>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">Calendly URL</label>
                  <input type="url" className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                    placeholder="https://calendly.com/your-name" value={form.calendlyUrl} onChange={e => set('calendlyUrl', e.target.value)} />
                  <p className="text-xs text-neutral-600 mt-1.5">If provided, customers can book directly from their match results.</p>
                </div>
              </fieldset>

              {/* Agreement */}
              <div className={`rounded-xl border p-4 ${errors.agree ? 'border-red-500/40 bg-red-500/5' : 'border-neutral-800'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-accent focus:ring-accent"
                    checked={form.agree} onChange={e => set('agree', e.target.checked)} />
                  <span className="text-sm text-neutral-400">
                    I agree to the <a href="/terms" className="text-accent hover:underline">Terms of Service</a> and <a href="/privacy" className="text-accent hover:underline">Privacy Policy</a>.
                  </span>
                </label>
                {errors.agree && <p className="mt-2 text-xs text-red-400 ml-7">{errors.agree}</p>}
              </div>
            </div>

            <button type="submit" className="btn-primary w-full text-base py-4 mt-6 shadow-xl shadow-accent/20">
              Submit Application →
            </button>
            <p className="text-center text-xs text-neutral-600 mt-4">
              We&apos;ll verify your info and email you within 24 hours.
            </p>
          </form>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
