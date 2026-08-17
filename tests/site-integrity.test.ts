import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, GUIDES, TOOLS, toolBySlug } from '../src/data/site';
import { SITE, ADS_ENABLED, ADSENSE_CLIENT, TEST_COUNT } from '../src/config';

/**
 * Checks the built site rather than the source.
 *
 * These are the SEO mistakes that are invisible in development and expensive in
 * production: a broken internal link, a duplicate title, a missing canonical, an
 * accidental noindex. Run `npm run build` before `npm test` for these to be
 * meaningful — they skip if dist/ is absent.
 */

const DIST = join(process.cwd(), 'dist');

function distExists(): boolean {
  try {
    return statSync(DIST).isDirectory();
  } catch {
    return false;
  }
}

function htmlFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(path, found);
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

/**
 * dist/foo/index.html -> /foo/
 *
 * 404.html is the exception: Astro emits it at the root and hosts serve it for
 * unmatched paths, so its canonical is /404/ rather than /404.html.
 */
function urlFor(file: string): string {
  const relative = file.slice(DIST.length).replace(/\\/g, '/');
  if (relative === '/404.html') return '/404/';
  return relative.replace(/\/index\.html$/, '/').replace(/^$/, '/');
}

const describeBuilt = distExists() ? describe : describe.skip;

describeBuilt('built site', () => {
  const files = htmlFiles(DIST);
  const pages = files.map((file) => ({
    file,
    url: urlFor(file),
    html: readFileSync(file, 'utf8'),
  }));
  const urls = new Set(pages.map((p) => p.url));

  it('builds a page for every tool, category and guide', () => {
    for (const tool of TOOLS) expect(urls, `missing tool ${tool.slug}`).toContain(`/${tool.slug}/`);
    for (const category of CATEGORIES) expect(urls).toContain(`/${category.slug}/`);
    for (const guide of GUIDES) expect(urls).toContain(`/guides/${guide.slug}/`);
    expect(urls).toContain('/');
  });

  it('builds the trust and policy pages', () => {
    for (const path of [
      '/about/',
      '/methodology/',
      '/rates/',
      '/changelog/',
      '/privacy/',
      '/terms/',
      '/disclaimer/',
      '/contact/',
      '/guides/',
    ]) {
      expect(urls, `missing ${path}`).toContain(path);
    }
  });

  it('gives every page exactly one H1', () => {
    for (const page of pages) {
      const count = (page.html.match(/<h1[\s>]/g) ?? []).length;
      expect(count, `${page.url} has ${count} H1 elements`).toBe(1);
    }
  });

  it('gives every page a unique title', () => {
    const titles = new Map<string, string>();
    for (const page of pages) {
      const match = page.html.match(/<title>([^<]*)<\/title>/);
      expect(match, `${page.url} has no title`).toBeTruthy();
      const title = match![1]!;
      expect(title.length, `${page.url} has an empty title`).toBeGreaterThan(10);
      const existing = titles.get(title);
      expect(existing, `${page.url} duplicates the title of ${existing}`).toBeUndefined();
      titles.set(title, page.url);
    }
  });

  it('gives every page a meta description of a sensible length', () => {
    for (const page of pages) {
      const match = page.html.match(/<meta name="description" content="([^"]*)"/);
      expect(match, `${page.url} has no meta description`).toBeTruthy();
      expect(match![1]!.length, `${page.url} description too short`).toBeGreaterThan(50);
    }
  });

  it('gives every page a canonical URL on the configured origin', () => {
    for (const page of pages) {
      const match = page.html.match(/<link rel="canonical" href="([^"]*)"/);
      expect(match, `${page.url} has no canonical`).toBeTruthy();
      expect(match![1]).toBe(`${SITE.origin}${page.url}`);
    }
  });

  it('does not accidentally noindex anything except the 404 page', () => {
    for (const page of pages) {
      if (page.url === '/404/') continue;
      expect(page.html, `${page.url} is noindexed`).not.toMatch(/name="robots"[^>]*noindex/);
    }
  });

  it('has no broken internal links', () => {
    const broken: string[] = [];
    for (const page of pages) {
      const hrefs = [...page.html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]!);
      for (const href of hrefs) {
        /*
         * Assets are not pages, but they still have to exist. A preloaded font
         * that 404s is worse than a broken page link — it fails silently, and
         * the only symptom is that headings render in the fallback serif.
         */
        if (/\.(css|js|svg|ico|png|jpg|xml|txt|webmanifest|woff2?|ttf)$/.test(href)) {
          if (!statSync(join(DIST, href), { throwIfNoEntry: false })?.isFile()) {
            broken.push(`${page.url} -> ${href} (asset missing from dist/)`);
          }
          continue;
        }
        if (!urls.has(href)) broken.push(`${page.url} -> ${href}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('renders calculator explanations as static HTML, not JavaScript', () => {
    // The whole point of the island architecture: Google must see the content
    // without executing anything.
    const takeHome = pages.find((p) => p.url === '/take-home-pay-calculator/')!;
    expect(takeHome.html).toContain('How your take-home pay is worked out');
    expect(takeHome.html).toContain('Which student loan plan am I on?');
    expect(takeHome.html).toContain('Personal allowance');
  });

  it('emits structured data on tool pages', () => {
    const tool = pages.find((p) => p.url === '/stamp-duty-calculator/')!;
    expect(tool.html).toContain('"@type":"WebApplication"');
    expect(tool.html).toContain('"@type":"BreadcrumbList"');
    expect(tool.html).toContain('"@type":"FAQPage"');
  });

  /*
   * These assertions are driven off the config rather than hard-coded, because
   * the site passes through three ad states — off, approved-but-no-slots, and
   * live — and the first version of this test froze the first of those in place
   * and failed the moment a publisher ID was added.
   */
  it('loads the ad script on every page once ads are enabled, and none before', () => {
    for (const page of pages) {
      const hasScript = page.html.includes('adsbygoogle.js');
      if (ADS_ENABLED && ADSENSE_CLIENT) {
        // Site-wide, including pages that carry no units: verification and
        // policy review expect the tag everywhere.
        expect(hasScript, `${page.url} is missing the ad script`).toBe(true);
        expect(page.html).toContain(ADSENSE_CLIENT);
      } else {
        expect(hasScript, `${page.url} loads an ad script while ads are off`).toBe(false);
      }
    }
  });

  it('never places an ad unit inside a calculator', () => {
    // The placement rule the whole ad layout is built around: nothing that can
    // be mistaken for part of a calculation, and nothing a mistap can reach
    // from an input.
    for (const tool of TOOLS) {
      const page = pages.find((p) => p.url === `/${tool.slug}/`)!;
      const card = page.html.match(/<div class="calc">[\s\S]*?<div class="tool-body">/);
      if (!card) continue;
      expect(card[0], `${tool.slug} has an ad inside the calculator card`).not.toMatch(
        /class="ad(-slot|-anchor| )/,
      );
    }
  });

  it('keeps ad units off the trust pages', () => {
    // Someone reading these is deciding whether to believe the numbers.
    for (const url of ['/about/', '/methodology/', '/privacy/', '/terms/', '/disclaimer/', '/contact/']) {
      const page = pages.find((p) => p.url === url)!;
      expect(page.html, `${url} renders an ad unit`).not.toMatch(/class="ad" aria-label/);
    }
  });

  /*
   * The privacy policy is the page an AdSense reviewer reads most carefully, and
   * it is the easiest one to leave lying. Its "Third parties" section stated
   * flatly that the site loaded no external scripts; enabling ads added
   * googlesyndication.com to every page and turned that sentence into a false
   * statement that survived a deploy. Assert the disclosure tracks the flag.
   */
  it('discloses the ad script on the privacy page whenever ads are enabled', () => {
    const privacy = pages.find((p) => p.url === '/privacy/')!;
    if (ADS_ENABLED && ADSENSE_CLIENT) {
      expect(privacy.html, 'privacy page does not name AdSense').toMatch(/AdSense/);
      expect(privacy.html, 'privacy page does not disclose the script host').toMatch(
        /googlesyndication\.com/,
      );
      expect(
        privacy.html,
        'privacy page still claims the site loads no external scripts',
      ).not.toMatch(/loads no external/);
    } else {
      expect(privacy.html).toMatch(/loads no external/);
    }
  });

  it('ships an ads.txt matching the configured publisher', () => {
    if (!ADS_ENABLED || !ADSENSE_CLIENT) return;
    const adsTxt = readFileSync(join(DIST, 'ads.txt'), 'utf8');
    // ads.txt uses the bare publisher ID, without the ca- prefix the script uses.
    const publisherId = ADSENSE_CLIENT.replace(/^ca-/, '');
    expect(adsTxt).toMatch(new RegExp(`^google\\.com,\\s*${publisherId},\\s*DIRECT`, 'm'));
  });

  it('points robots.txt at the sitemap on the configured origin', () => {
    const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE.origin}/sitemap-index.xml`);
  });

  it('links every tool to its related tools with real anchors', () => {
    for (const tool of TOOLS) {
      const page = pages.find((p) => p.url === `/${tool.slug}/`)!;
      for (const relatedSlug of tool.related) {
        const related = toolBySlug(relatedSlug);
        expect(
          page.html,
          `${tool.slug} does not link to ${related.slug}`,
        ).toContain(`href="/${related.slug}/"`);
      }
    }
  });

  it('keeps the client bundle small', () => {
    const scripts = htmlFiles(join(DIST, '_astro')).length;
    void scripts;
    const jsFiles = readdirSync(join(DIST, '_astro')).filter((f) => f.endsWith('.js'));
    const totalBytes = jsFiles.reduce(
      (sum, file) => sum + statSync(join(DIST, '_astro', file)).size,
      0,
    );
    // Preact plus every calculator. Well under the weight of a React app.
    expect(totalBytes).toBeLessThan(120_000);
  });
});

describe('published claims about ourselves', () => {
  /*
   * /about/ and /methodology/ both quote the size of this suite as evidence the
   * maths is checked. Both had drifted to 112 while the suite grew to 139 — a
   * stale accuracy claim on a site that sells not being stale. Counting `it(`
   * matches the runner's own total because every test here is a plain `it`; if
   * that ever stops being true this fails loudly, which is the point.
   */
  it('quotes a test count that matches the real suite', () => {
    const dir = join(process.cwd(), 'tests');
    const actual = readdirSync(dir)
      .filter((f) => f.endsWith('.test.ts'))
      .reduce(
        (sum, f) => sum + (readFileSync(join(dir, f), 'utf8').match(/^\s*it\(/gm) ?? []).length,
        0,
      );
    expect(TEST_COUNT, `TEST_COUNT is ${TEST_COUNT} but the suite has ${actual} tests`).toBe(actual);
  });
});

describe('site data', () => {
  it('has no duplicate slugs', () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('points every tool at a real category', () => {
    for (const tool of TOOLS) {
      expect(CATEGORIES.some((c) => c.slug === tool.category), tool.slug).toBe(true);
    }
  });

  it('gives every tool two to five related tools, never itself', () => {
    for (const tool of TOOLS) {
      expect(tool.related.length, tool.slug).toBeGreaterThanOrEqual(2);
      expect(tool.related.length, tool.slug).toBeLessThanOrEqual(5);
      expect(tool.related, tool.slug).not.toContain(tool.slug);
      for (const slug of tool.related) expect(() => toolBySlug(slug)).not.toThrow();
    }
  });

  it('keeps titles and descriptions within search result limits', () => {
    for (const tool of TOOLS) {
      // Titles beyond ~60 characters get truncated in results; we allow some
      // slack because Google measures pixels, not characters.
      expect(tool.title.length, `${tool.slug} title`).toBeLessThan(75);
      expect(tool.metaDescription.length, `${tool.slug} description`).toBeLessThan(200);
      expect(tool.metaDescription.length, `${tool.slug} description`).toBeGreaterThan(80);
    }
  });

  it('gives every guide a real tool to link to', () => {
    for (const guide of GUIDES) {
      expect(guide.relatedTools.length, guide.slug).toBeGreaterThan(0);
      for (const slug of guide.relatedTools) expect(() => toolBySlug(slug)).not.toThrow();
    }
  });
});
