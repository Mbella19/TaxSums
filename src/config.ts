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
 * AdSense.
 *
 * Three states, and the middle one matters:
 *
 *  - `ADS_ENABLED = false` — no script, and each zone renders a labelled
 *    placeholder so ad placement stays visible while developing.
 *  - `ADS_ENABLED = true`, no slot IDs — the script loads site-wide (which is
 *    what site verification and review require) but no zone renders anything.
 *    Empty grey boxes reading "970x250 responsive" would read as a half-built
 *    site to whoever reviews it.
 *  - `ADS_ENABLED = true` with slot IDs — real units.
 *
 * Consent is handled by Google's own certified CMP, configured under Privacy
 * and messaging in the AdSense console — not by a banner in this repo. Since
 * January 2024 Google requires a certified CMP for UK and EEA traffic, and a
 * hand-rolled banner does not qualify.
 */
export const ADS_ENABLED = true;
export const ADSENSE_CLIENT = 'ca-pub-5145566567335944';

/**
 * Number of unit tests behind the calculation engine, quoted on /about/ and
 * /methodology/ as evidence the maths is checked.
 *
 * It lives here for the same reason no page restates a tax rate: both pages had
 * drifted to "112" while the suite had grown to 139, which is a stale accuracy
 * claim on a site whose entire pitch is not being stale. `site-integrity`
 * asserts this matches the real suite size, so it fails rather than rots.
 */
export const TEST_COUNT = 141;

/** Current tax year shown by default across the site. */
export const DEFAULT_TAX_YEAR = '2026-27';

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.origin).href;
}
