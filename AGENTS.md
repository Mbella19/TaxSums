## What this project is

TaxSums — twelve UK tax calculators for the 2026/27 tax year. Static Astro
site with Preact islands, monetised by AdSense. See `README.md` for the full
picture.

## Rules that matter here

**Never hard-code a tax rate.** Every figure comes from
`src/data/tax-years/<year>.ts` via `CURRENT_TAX_YEAR`. Pages and calculators
read from it; they never restate a number. This is what makes a Budget update a
data change rather than a hunt through the codebase, and it is why `/rates/` can
list every figure with its source.

**Keep `src/lib/*` pure.** Calculation functions are `(inputs, taxYear) =>
result` with no DOM or framework imports. Tests target them directly.

**Only the calculator widget is an island.** Explanations, rate tables, worked
examples and FAQs must be server-rendered static HTML so Google indexes them
without executing JavaScript. If you find yourself rendering prose inside a
`.tsx` island, move it to the `.astro` page.

**Add tests when touching the engine.** Expected values come from HMRC worked
examples or published figures — never from our own output. If a test fails after
a rate change, confirm against the primary source before updating it.

**Run `npm run verify` before saying anything works.** It builds and runs all
131 tests, including built-site checks for broken internal links, duplicate
titles, missing canonicals and accidental `noindex`.

**Ads:** `ADS_ENABLED` in `src/config.ts` is deliberately `false` until an
AdSense account is approved. `AdSlot.astro` reserves height regardless, so CLS
stays 0 either way. Keep ad slots away from inputs and results.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
