import type { APIRoute } from 'astro';
import { SITE } from '../config';

/**
 * Generated rather than static so the sitemap URL always matches SITE.origin.
 * A robots.txt pointing at the wrong domain is a silent, expensive mistake.
 */
export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /

Sitemap: ${SITE.origin}/sitemap-index.xml
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
