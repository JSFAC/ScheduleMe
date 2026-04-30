export const SITE_NAME = 'ScheduleMe';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.usescheduleme.com').replace(/\/+$/, '');
export const DEFAULT_OG_IMAGE = '/icon-512.png';
export const DEFAULT_TWITTER_CARD = 'summary';

export function absoluteUrl(path = '/') {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function canonicalUrl(path = '/') {
  const url = absoluteUrl(path);
  return url.replace(/(?<!:)\/+$/, '') || SITE_URL;
}
