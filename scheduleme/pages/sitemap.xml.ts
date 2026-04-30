import type { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';
import { hasProviderPayoutSetup } from '../lib/providerPayoutStage';
import { isProviderPubliclyVisible } from '../lib/providerTrust';
import { SITE_URL } from '../lib/siteMeta';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/browse', priority: '0.9', changefreq: 'daily' },
    { path: '/provider', priority: '0.8', changefreq: 'weekly' },
    { path: '/support', priority: '0.6', changefreq: 'monthly' },
    { path: '/privacy', priority: '0.4', changefreq: 'yearly' },
    { path: '/terms', priority: '0.4', changefreq: 'yearly' },
  ];

  let providerPages: Array<{ loc: string; lastmod?: string }> = [];

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('businesses')
      .select('slug, updated_at, is_onboarded, public_visibility, approved_at, published_at, trust_status, trust_flagged, stripe_onboarded, stripe_account_id, zelle_payout_details')
      .not('slug', 'is', null);

    providerPages = (data || [])
      .filter((row: any) => isProviderPubliclyVisible(row) && hasProviderPayoutSetup(row))
      .map((row: any) => ({
        loc: `${SITE_URL}/biz/${encodeURIComponent(String(row.slug))}`,
        lastmod: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      }));
  } catch {}

  const urls: Array<{ loc: string; lastmod?: string; priority: string; changefreq: string }> = [
    ...staticPages.map((page) => ({
      loc: `${SITE_URL}${page.path}`,
      priority: page.priority,
      changefreq: page.changefreq,
    })),
    ...providerPages.map((page) => ({
      loc: page.loc,
      lastmod: page.lastmod,
      priority: '0.7',
      changefreq: 'weekly',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${escapeXml(url.lastmod)}</lastmod>` : ''}
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function SitemapXml() {
  return null;
}
