import type { GetServerSideProps } from 'next';
import { SITE_URL } from '../lib/siteMeta';

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.write([
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /provider/dashboard',
    'Disallow: /business/dashboard',
    'Disallow: /api',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `Host: ${SITE_URL.replace(/^https?:\/\//, '')}`,
  ].join('\n'));
  res.end();
  return { props: {} };
};

export default function RobotsTxt() {
  return null;
}
