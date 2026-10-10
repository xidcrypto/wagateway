import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/server/site-url';

/** Sitemap hanya berisi halaman publik yang boleh terindex: landing. */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
