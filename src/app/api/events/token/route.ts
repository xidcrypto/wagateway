import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { checkRateLimit, getClientIp, rateLimitFromEnv } from '@/lib/server/rate-limit';
import { issueSseToken } from '@/lib/server/sse-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Terbitkan token SSE ber-TTL pendek (±60 dtk) untuk ?token= di EventSource.
 * Browser tidak bisa set header Authorization di EventSource, jadi JWT login
 * 7-hari jangan dikirim via URL (bocor ke log/proxy/history). Token ini
 * hanya berlaku untuk GET /api/events/stream.
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ip = getClientIp(req);
  const result = checkRateLimit(`sse-token:${ip}`, rateLimitFromEnv('RATE_LIMIT_SSE_TOKEN', 60));
  if (!result.allowed) {
    return fail('Terlalu banyak permintaan token live, coba lagi nanti.', 429);
  }
  if (ctx.user.id === 0) {
    return fail('Akun API key tidak memiliki stream live.', 404);
  }
  return ok(issueSseToken(ctx.user.id), 201);
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
