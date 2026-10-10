import 'server-only';

/**
 * URL publik kanonis situs (untuk metadata, canonical, sitemap, robots).
 * Prioritas: SITE_URL → origin https pertama di CORS_ORIGINS → localhost.
 */
export function getSiteUrl(): string {
  const fromEnv = (process.env.SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const cors = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const https = cors.find((o) => o.startsWith('https://'));
  if (https) return https.replace(/\/+$/, '');
  const first = cors[0];
  if (first) return first.replace(/\/+$/, '');
  return 'http://localhost:3000';
}
