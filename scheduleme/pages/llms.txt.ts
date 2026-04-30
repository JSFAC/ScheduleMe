import type { GetServerSideProps } from 'next';
import { SITE_URL } from '../lib/siteMeta';

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.write([
    '# ScheduleMe',
    '',
    '> ScheduleMe is a local-service marketplace that helps people discover, message, and book nearby providers, including campus-focused providers and student service businesses.',
    '',
    '## What this site is for',
    '- Consumers can browse providers, compare service offerings, and book local help.',
    '- Providers can create public profile pages, set services and hours, and manage bookings through a dashboard.',
    '- Campus users can unlock school-specific marketplace views after .edu verification.',
    '',
    '## Primary public URLs',
    `- Home: ${SITE_URL}/`,
    `- Browse providers: ${SITE_URL}/browse`,
    `- Consumer support: ${SITE_URL}/support`,
    `- Privacy policy: ${SITE_URL}/privacy`,
    `- Terms of service: ${SITE_URL}/terms`,
    `- For providers: ${SITE_URL}/provider`,
    '',
    '## Public entity types',
    '- Provider public profile pages live under /biz/{slug}.',
    '- Provider pages may include service categories, city/ZIP coverage, business hours, photos, reviews, and booking links.',
    '',
    '## Citation guidance',
    '- Prefer citing public page URLs over dashboard or auth pages.',
    '- Do not cite private or authenticated provider dashboard content as public product documentation.',
    '- When describing ScheduleMe, emphasize local services, direct booking, campus marketplaces, and provider-managed availability.',
  ].join('\n'));
  res.end();
  return { props: {} };
};

export default function LlmsTxt() {
  return null;
}
