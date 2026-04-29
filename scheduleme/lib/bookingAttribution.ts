type BookingSource = 'organic' | 'referral' | 'direct' | 'unknown';

type BrowseTouchRecord = {
  at: string;
  surface: string;
  href: string | null;
  referrer: string | null;
  source: BookingSource;
  detail: string | null;
};

type ProviderViewRecord = {
  at: string;
  surface: string;
};

export type BookingAttributionPayload = {
  booking_source?: BookingSource;
  booking_source_detail?: string | null;
  booking_source_referrer?: string | null;
  browse_started_at?: string | null;
  provider_viewed_at?: string | null;
};

const BROWSE_TOUCH_KEY = 'sm_browse_touch_v1';
const PROVIDER_VIEW_KEY = 'sm_provider_view_v1';

function canUseBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function writeJson<T>(key: string, value: T) {
  if (!canUseBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function readJson<T>(key: string): T | null {
  if (!canUseBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function hostFromUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isSearchEngineReferrer(referrer: string | null) {
  const host = hostFromUrl(referrer);
  if (!host) return false;
  return [
    'google.',
    'bing.',
    'yahoo.',
    'duckduckgo.',
    'ecosia.',
    'search.brave.',
  ].some((needle) => host.includes(needle));
}

function classifySource(href: string | null, referrer: string | null): { source: BookingSource; detail: string | null } {
  const safeHref = href || (canUseBrowser() ? window.location.href : '');
  let url: URL | null = null;
  try {
    url = safeHref ? new URL(safeHref) : null;
  } catch {
    url = null;
  }

  const params = url?.searchParams;
  const refCode = params?.get('ref') || params?.get('referral') || params?.get('invite') || params?.get('creator') || params?.get('ambassador') || params?.get('share');
  if (refCode) return { source: 'referral', detail: refCode.slice(0, 100) };

  const utmMedium = String(params?.get('utm_medium') || '').toLowerCase();
  if (['referral', 'partner', 'creator', 'ambassador', 'affiliate', 'share'].includes(utmMedium)) {
    return { source: 'referral', detail: (params?.get('utm_source') || utmMedium).slice(0, 100) };
  }

  const utmSource = String(params?.get('utm_source') || '').toLowerCase();
  if (['instagram', 'tiktok', 'facebook', 'reddit', 'snapchat', 'discord', 'groupme', 'text', 'sms'].includes(utmSource)) {
    return { source: 'referral', detail: utmSource.slice(0, 100) };
  }

  if (!referrer) return { source: 'direct', detail: null };

  const sameOrigin = (() => {
    try {
      if (!canUseBrowser()) return false;
      return new URL(referrer).origin === window.location.origin;
    } catch {
      return false;
    }
  })();

  if (sameOrigin || isSearchEngineReferrer(referrer)) {
    return { source: 'organic', detail: hostFromUrl(referrer)?.slice(0, 100) || null };
  }

  return { source: 'referral', detail: hostFromUrl(referrer)?.slice(0, 100) || null };
}

export function rememberBrowseTouch(surface: string) {
  if (!canUseBrowser()) return;
  const existing = readJson<BrowseTouchRecord>(BROWSE_TOUCH_KEY);
  if (existing?.at) return;
  const href = window.location.href;
  const referrer = document.referrer || null;
  const { source, detail } = classifySource(href, referrer);
  writeJson<BrowseTouchRecord>(BROWSE_TOUCH_KEY, {
    at: new Date().toISOString(),
    surface,
    href,
    referrer,
    source,
    detail,
  });
}

export function rememberProviderView(surface: string) {
  if (!canUseBrowser()) return;
  writeJson<ProviderViewRecord>(PROVIDER_VIEW_KEY, {
    at: new Date().toISOString(),
    surface,
  });
}

export function buildBookingAttribution(surface: string): BookingAttributionPayload {
  if (!canUseBrowser()) return {};
  const browseTouch = readJson<BrowseTouchRecord>(BROWSE_TOUCH_KEY);
  const providerView = readJson<ProviderViewRecord>(PROVIDER_VIEW_KEY);
  const href = window.location.href;
  const referrer = document.referrer || null;
  const fallback = classifySource(href, referrer);

  return {
    booking_source: browseTouch?.source || fallback.source || 'unknown',
    booking_source_detail: browseTouch?.detail || fallback.detail || surface,
    booking_source_referrer: (browseTouch?.referrer || referrer || null)?.slice(0, 500) || null,
    browse_started_at: browseTouch?.at || null,
    provider_viewed_at: providerView?.at || null,
  };
}
