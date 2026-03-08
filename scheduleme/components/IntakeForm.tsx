// components/IntakeForm.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';

export interface IntakePayload { message: string; location: string; name: string; phone: string; lat?: number; lng?: number; }
export interface TriageResult {
  service_category: string; urgency: 'low' | 'medium' | 'high' | 'emergency';
  estimated_cost_range: string; suggested_next_step: string; keywords: string[]; confidence: number;
}
export interface Provider {
  id: string; name: string; service: string; location: string; rating: number;
  reviewCount: number; phone: string; badge?: string; distance_miles?: number;
  calendly_url?: string; slug?: string; from_db?: boolean;
}
export interface IntakeResponse { leadId: string; triage: TriageResult; matches: Provider[]; }
interface FormErrors { message?: string; location?: string; name?: string; phone?: string; }
type Step = 'form' | 'loading' | 'results';

const URGENCY_LABELS: Record<TriageResult['urgency'], { label: string; className: string }> = {
  low: { label: 'Low Priority', className: 'badge-low' },
  medium: { label: 'Moderate', className: 'badge-normal' },
  high: { label: 'Urgent', className: 'badge-urgent' },
  emergency: { label: '🚨 Emergency', className: 'badge-urgent' },
};

function validatePhone(phone: string): boolean { return /^[\d\s\-().+]{7,15}$/.test(phone.trim()); }

function StarRating({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} stars`} className="text-amber-400 text-sm">
      {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
      <span className="text-neutral-500 text-xs ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function IntakeForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [payload, setPayload] = useState<IntakePayload>({ message: '', location: '', name: '', phone: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<IntakeResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  function validate(): boolean {
    const e: FormErrors = {};
    if (!payload.message.trim() || payload.message.trim().length < 10) e.message = 'Please describe your issue in at least 10 characters.';
    if (!payload.location.trim()) e.location = 'Location is required.';
    if (!payload.name.trim()) e.name = 'Your name is required.';
    if (!validatePhone(payload.phone)) e.phone = 'Please enter a valid phone number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStep('loading');
    setApiError(null);

    // Try to get browser geolocation
    let lat: number | undefined, lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (_) { /* user declined or unavailable */ }

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, lat, lng }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }
      const data: IntakeResponse = await res.json();
      setResult(data);
      setStep('results');
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('form');
    }
  }

  function handleReset() {
    setStep('form'); setResult(null); setApiError(null);
    setPayload({ message: '', location: '', name: '', phone: '' }); setErrors({});
  }

  function handleBook(provider: Provider) {
    // Store in sessionStorage for the book page
    sessionStorage.setItem('scheduleme_booking_provider', JSON.stringify(provider));
    const params = new URLSearchParams({
      id: provider.id, name: provider.name, service: provider.service,
      location: provider.location, rating: String(provider.rating),
      phone: provider.phone,
      ...(provider.calendly_url ? { calendly_url: provider.calendly_url } : {}),
      ...(provider.from_db ? { from_db: 'true' } : {}),
    });
    router.push(`/book?${params.toString()}`);
  }

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6" role="status" aria-live="polite">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
          <div className="absolute inset-3 rounded-full bg-accent/10 flex items-center justify-center text-accent text-lg font-bold">AI</div>
        </div>
        <div className="text-center">
          <p className="text-neutral-800 font-semibold">Analyzing your request…</p>
          <p className="text-neutral-400 text-sm mt-1">Our AI is finding the best match for you</p>
        </div>
      </div>
    );
  }

  if (step === 'results' && result) {
    const urgencyInfo = URGENCY_LABELS[result.triage.urgency] || URGENCY_LABELS.medium;
    return (
      <div className="animate-fade-up space-y-8" aria-live="polite">
        <section>
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">AI Triage Result</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Lead ID: {result.leadId}</p>
              </div>
              <span className={urgencyInfo.className}>{urgencyInfo.label}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-neutral-400 text-xs font-medium uppercase tracking-wide mb-1">Service Category</dt>
                <dd className="text-neutral-800 font-semibold">{result.triage.service_category}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs font-medium uppercase tracking-wide mb-1">Estimated Cost</dt>
                <dd className="text-neutral-800 font-semibold">{result.triage.estimated_cost_range}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-neutral-400 text-xs font-medium uppercase tracking-wide mb-1">Suggested Next Step</dt>
                <dd className="text-neutral-700">{result.triage.suggested_next_step}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-neutral-900">Top Matches Near You</h2>
            {result.matches.some(m => (m as Provider & { from_db?: boolean }).from_db) && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Real businesses
              </span>
            )}
          </div>
          <ul className="space-y-3" role="list">
            {result.matches.map((p, idx) => (
              <li key={p.id}>
                <div className="card p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-full bg-accent-light flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-neutral-900">{p.name}</p>
                        {idx === 0 && <span className="badge bg-green-50 text-green-700">Best Match</span>}
                        {p.badge && <span className="badge bg-accent-light text-accent">{p.badge}</span>}
                        {p.distance_miles !== undefined && (
                          <span className="text-xs text-neutral-400">{p.distance_miles.toFixed(1)} mi</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">{p.service} · {p.location}</p>
                      <div className="mt-1">
                        <StarRating rating={p.rating} />
                        <span className="text-xs text-neutral-400 ml-1">({p.reviewCount} reviews)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleBook(p)}
                      className="btn-primary text-xs px-4 py-2"
                    >
                      {p.calendly_url ? 'Book Now' : 'Request'}
                    </button>
                    <a href={`tel:${p.phone}`} className="btn-secondary text-xs px-4 py-2 text-center">
                      Call
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <button onClick={handleReset} className="btn-secondary w-full" type="button">Start Over</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="Service intake form">
      {apiError && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{apiError}</div>
      )}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-neutral-700 mb-1.5">
          Describe your issue <span aria-hidden="true" className="text-accent">*</span>
        </label>
        <textarea id="message" rows={4}
          className={`form-input resize-none ${errors.message ? 'ring-2 ring-red-400 border-transparent' : ''}`}
          placeholder="e.g. My kitchen faucet has been dripping for two days and it's getting worse..."
          value={payload.message} onChange={e => setPayload({ ...payload, message: e.target.value })}
          autoFocus />
        {errors.message && <p role="alert" className="mt-1.5 text-xs text-red-600">{errors.message}</p>}
      </div>
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-neutral-700 mb-1.5">
          Your city or zip code <span aria-hidden="true" className="text-accent">*</span>
        </label>
        <input id="location" type="text"
          className={`form-input ${errors.location ? 'ring-2 ring-red-400 border-transparent' : ''}`}
          placeholder="e.g. Austin, TX or 78701"
          value={payload.location} onChange={e => setPayload({ ...payload, location: e.target.value })} />
        {errors.location && <p role="alert" className="mt-1.5 text-xs text-red-600">{errors.location}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1.5">
            Your name <span aria-hidden="true" className="text-accent">*</span>
          </label>
          <input id="name" type="text" autoComplete="name"
            className={`form-input ${errors.name ? 'ring-2 ring-red-400 border-transparent' : ''}`}
            placeholder="Jane Smith" value={payload.name}
            onChange={e => setPayload({ ...payload, name: e.target.value })} />
          {errors.name && <p role="alert" className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-neutral-700 mb-1.5">
            Phone number <span aria-hidden="true" className="text-accent">*</span>
          </label>
          <input id="phone" type="tel" autoComplete="tel"
            className={`form-input ${errors.phone ? 'ring-2 ring-red-400 border-transparent' : ''}`}
            placeholder="(555) 000-1234" value={payload.phone}
            onChange={e => setPayload({ ...payload, phone: e.target.value })} />
          {errors.phone && <p role="alert" className="mt-1.5 text-xs text-red-600">{errors.phone}</p>}
        </div>
      </div>
      <button type="submit" className="btn-primary w-full text-base py-4 shadow-lg shadow-accent/20">
        Find My Pro →
      </button>
      <p className="text-xs text-center text-neutral-400">No spam. Your info is only shared with matched providers.</p>
    </form>
  );
}
