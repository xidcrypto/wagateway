import { NextRequest } from 'next/server';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { withRateLimit } from '@/lib/server/rate-limit';
import { getSiteInfo } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleSiteInfo(): Promise<Response> {
  const { siteName, siteTagline } = await getSiteInfo();
  return ok({ siteName, siteTagline });
}

export const GET = withRateLimit(handleSiteInfo, {
  scope: 'site-info',
  limit: 1000,
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
