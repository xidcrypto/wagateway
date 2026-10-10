import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/server/site-url';

/**
 * Crawler hanya boleh menyentuh landing + aset publik.
 * Semua halaman aplikasi (/login, /register, /dashboard, /admin, /api, …)
 * dilarang terindex.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/favicon.ico'],
        disallow: [
          '/login',
          '/register',
          '/forgot-password',
          '/dashboard',
          '/sessions',
          '/chat',
          '/messages',
          '/groups',
          '/contacts',
          '/blast',
          '/docs',
          '/settings',
          '/admin',
          '/api',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
