# TaxSums

Twelve UK tax calculators for the 2026/27 tax year. Static, zero server cost, no
tracking, monetised by AdSense.

The hard part of a tax calculator is not building it — it is being correct and
staying correct through every Budget. The whole architecture is built around
that one idea.

## Quick start

```bash
npm install
npm run dev          # dev server
npm run verify       # build + full test suite — run this before deploying
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on :4321 |
| `npm run build` | Static build to `dist/` |
| `npm run preview` | Serve the built site |
| `npm test` | 131 tests: calculation engine + built-site integrity |
| `npm run typecheck` | `astro check` |
| `npm run verify` | Build then test — the pre-deploy gate |

## Deployment

**Live at https://taxsums.co.uk** — Cloudflare Workers Static Assets, project
`taxsums`.

```bash
npm run deploy      # verify (build + 136 tests), then ship
```

Config lives in `wrangler.jsonc`: the apex is attached as a custom domain,
`html_handling: auto-trailing-slash` matches Astro's directory output, and
unmatched routes serve the real 404 page with a 404 status.

Caching is set in `public/_headers`. Note that Cloudflare header rules are
**additive, not override** — two matching patterns merge into one
comma-separated header, and browsers honour the most restrictive value. That is
why no `Cache-Control` appears under `/*`; each one is declared exactly once, on
the narrowest pattern that needs it.

## Deploying to a VPS

The site is static, so a VPS only has to build it and serve a folder. Three
options, simplest first.

### Option 1 — Docker (nothing to install but Docker)

```bash
git clone https://github.com/Mbella19/TaxSums.git
cd TaxSums
docker compose up -d --build
```

That builds the site, runs the tests, and serves it through Caddy with
automatic Let's Encrypt HTTPS. Point your domain's A record at the server
first, and make sure ports 80 and 443 are open — Caddy needs both to obtain a
certificate.

### Option 2 — Node plus Caddy

```bash
# once, on a fresh box
sudo apt update && sudo apt install -y caddy git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

sudo mkdir -p /var/www/taxsums && sudo chown "$USER" /var/www/taxsums
git clone https://github.com/Mbella19/TaxSums.git /var/www/taxsums/repo
cd /var/www/taxsums/repo

sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

./deploy-vps.sh
```

Every deploy after that is one command:

```bash
cd /var/www/taxsums/repo && ./deploy-vps.sh
```

`deploy-vps.sh` pulls, installs from the lockfile, **builds and runs all 136
tests, and only swaps the new build into place if they pass**. A failed build
leaves the live site untouched. The previous build is kept at
`/var/www/taxsums/.dist-previous`, so rolling back is one `mv`.

### Option 3 — any other web server

```bash
npm ci && npm run build
```

Then serve `dist/` with nginx, Apache or anything else. Two things to configure:

- **Trailing slashes.** Pages build to `<route>/index.html`, and every canonical
  tag uses a trailing slash. Serve `/foo/` from `/foo/index.html` and redirect
  `/foo` → `/foo/`.
- **Caching.** `/_astro/*` is content-hashed and can be `immutable` for a year.
  HTML must revalidate, or a Budget update sits behind a stale page.

`Caddyfile` is the reference implementation of both.

### Which host should I use?

It is already live on **Cloudflare Workers** (`npm run deploy`), which is free,
globally distributed and needs no server maintenance. A VPS is only worth it if
you specifically want to own the box — the files above exist so that choice
stays open.

## Continuous integration

`.github/workflows/ci.yml` runs typecheck, build and the full test suite on
every push and pull request, and uploads the built `dist/` as an artifact.

## Still to do

1. **www redirect** — only the apex is attached. Add a Redirect Rule in the
   Cloudflare dashboard (`www.taxsums.co.uk/*` → `https://taxsums.co.uk/$1`,
   301) so the two hostnames never serve duplicate content.
2. **Search Console + Bing Webmaster Tools** — verify the domain and submit
   `/sitemap-index.xml`.
3. **AdSense** — apply only once there is real traffic. Then set
   `ADS_ENABLED = true` and `ADSENSE_CLIENT` in `src/config.ts` and add slot IDs
   to the `AdSlot` usages. Slots already reserve their height, so switching them
   on cannot shift layout.

## Architecture

```
src/
  config.ts                 domain, brand, ADS_ENABLED — the only place these live
  data/
    types.ts                the TaxYear contract every year must satisfy
    tax-years/2026-27.ts    every rate, with source URL and verification date
    site.ts                 tools, categories, guides — nav and links derive from this
  lib/                      pure calculation functions, no DOM, fully tested
  components/calculators/   Preact islands (client:load)
  layouts/                  canonical, OG and JSON-LD generated, never hand-written
  pages/
tests/                      Vitest — engine correctness + built-site integrity
```

Two rules make the rest work:

- **`src/lib/*` is pure.** `(inputs, taxYear) => result`. No framework imports,
  so the maths is testable in isolation and a rounding bug can only live in one
  place.
- **Only the calculator widget is an island.** Every explanation, rate table,
  worked example and FAQ is server-rendered static HTML, so Google indexes the
  content without executing JavaScript.

## Updating for a Budget

This is the whole point of the design and should take under an hour.

1. Copy `src/data/tax-years/2026-27.ts` to the new year and update the figures.
   TypeScript will not compile if you miss a field.
2. Update each `sources` entry's `verifiedOn` date as you check it.
3. Register the year in `src/data/tax-years/index.ts` and point
   `CURRENT_TAX_YEAR` at it.
4. Add a dated entry to `src/pages/changelog.astro`.
5. `npm run verify`. Expect test failures where rates genuinely changed —
   update the expected values only after confirming against the primary source.

Never hard-code a rate in a calculator or a page. Every figure on the site reads
from the tax year data, which is why `/rates/` can list them all with sources.

## Correctness

Verified against published figures for 2026/27:

| Salary | Income tax | NI | Take-home |
| --- | --- | --- | --- |
| £30,000 | £3,486 | £1,394 | £25,120 |
| £60,000 | £11,432 | £3,211 | £45,357 |
| £120,000 | £39,432 | £4,411 | £76,157 |
| £150,000 | £53,703 | £5,011 | £91,286 |

The test suite encodes the boundaries most often got wrong: the personal
allowance taper and its 60% marginal rate, the additional rate band measured on
taxable income (not gross), the SDLT first-time buyer cliff at £500,001, the
26.5% effective marginal corporation tax rate, and stacked student loan plans.

## Measured

- Lighthouse 100 / 100 / 100 / 100 on performance, accessibility, best
  practices and SEO
- CLS 0, FCP 1.2s, LCP 1.7s
- 32.5 KB gzipped JavaScript for all twelve calculators; 3.2 KB CSS
- Zero external requests — no fonts, no CDNs, no analytics
- No horizontal scroll at 320px on any page

## Notes

- Rates verified 7 August 2026, reflecting the Autumn Budget of 26 November 2025.
- Calculations run entirely in the browser. Nothing typed into a calculator is
  ever sent anywhere.
- Inputs serialise to the query string, so results are shareable and linkable.
