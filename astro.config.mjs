// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// The canonical origin lives in src/config.ts too, but Astro needs it statically
// here to generate <link rel="canonical"> and the sitemap. Keep the two in sync —
// they are asserted equal by tests/config.test.ts.
export default defineConfig({
  site: 'https://taxsums.co.uk',
  trailingSlash: 'always',
  integrations: [preact(), sitemap()],
  build: {
    // Emit /take-home-pay-calculator/index.html so trailing-slash URLs resolve
    // on any static host without redirect rules.
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
