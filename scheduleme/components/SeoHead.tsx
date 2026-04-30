import Head from 'next/head';
import { DEFAULT_OG_IMAGE, DEFAULT_TWITTER_CARD, SITE_NAME, absoluteUrl, canonicalUrl } from '../lib/siteMeta';

type JsonLdValue = Record<string, any> | Record<string, any>[];

type SeoHeadProps = {
  title: string;
  description: string;
  path?: string;
  canonical?: string;
  image?: string;
  type?: string;
  robots?: string;
  jsonLd?: JsonLdValue[];
};

export default function SeoHead({
  title,
  description,
  path = '/',
  canonical,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  robots = 'index,follow',
  jsonLd = [],
}: SeoHeadProps) {
  const pageUrl = canonical || canonicalUrl(path);
  const imageUrl = image ? absoluteUrl(image) : '';

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={pageUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={pageUrl} />
      {imageUrl ? <meta property="og:image" content={imageUrl} /> : null}
      <meta name="twitter:card" content={DEFAULT_TWITTER_CARD} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {imageUrl ? <meta name="twitter:image" content={imageUrl} /> : null}
      {jsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
    </Head>
  );
}
