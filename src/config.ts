/**
 * Site-wide configuration.
 *
 * The domain appears in exactly one place: `SITE.origin`. Canonical tags, the
 * sitemap, robots.txt, JSON-LD and Open Graph tags all derive from it, so
 * pointing the site at a real domain is a one-line change here (plus the
 * matching `site:` in astro.config.mjs, which Astro requires statically).
 */

export const SITE = {
  /** No trailing slash. */
  origin: 'https://taxsums.co.uk',
  name: 'TaxSums',
  tagline: 'UK tax and money calculators that show their working',
  description:
    'Free UK tax calculators for the 2026/27 tax year. Take-home pay, stamp duty, mortgage overpayments, sole trader vs limited company and more — every figure sourced from HMRC and dated.',
  locale: 'en_GB',
  lang: 'en-GB',
  /** Shown on tool and guide pages for E-E-A-T. */
  author: {
    name: 'TaxSums editorial team',
    url: '/about/',
  },
  contactEmail: 'hello@taxsums.co.uk',
} as const;

/**
 * AdSense is not wired up yet — the site has no approved publisher account.
 *
 * `AdSlot.astro` renders a reserved, fixed-height container regardless, so
 * enabling ads later cannot shift layout (CLS stays at 0). Flip this flag and
 * set `ADSENSE_CLIENT` once approved; that also switches on the cookie consent
 * banner, which UK GDPR/PECR requires before any ad script may run.
 */
export const ADS_ENABLED = false;
export const ADSENSE_CLIENT = ''; // e.g. 'ca-pub-0000000000000000'

/** Current tax year shown by default across the site. */
export const DEFAULT_TAX_YEAR = '2026-27';

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.origin).href;
}
