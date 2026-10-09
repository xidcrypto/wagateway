import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  cancelPairing,
  managerError,
  requestPairing,
  type RouteCtx,
} from '@/lib/server/session-manager';
import {
  pairingPhoneSchema,
  parseJsonBody,
} from '@/lib/server/validators';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pairing code bawaan WhatsApp. Scan QR tidak butuh nomor,
 * tapi pairing WAJIB body `{ phone }` (format internasional tanpa nol depan).
 * Kode 8 karakter dibuat server WA, berlaku ±3 menit.
 */
const pairingSchema = z.object({
  phone: pairingPhoneSchema,
});

async function handlePairing(req: NextRequest, ctx: AuthContext, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(ctx, routeCtx);
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, pairingSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await requestPairing(auth.session.id, parsed.data.phone);
    return ok({ pairing: { code: result.code, phone: result.phone, expiresIn: result.expiresIn } });
  } catch (err) {
    return managerError('Gagal meminta pairing code.', err);
  }
}

export const POST = withRateLimit(withAuth(handlePairing), {
  scope: 'pairing',
  limit: rateLimitFromEnv('RATE_LIMIT_PAIRING', 20),
});

export const DELETE = withAuth(async (_req, ctx, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(ctx, routeCtx);
  if (!auth.ok) return auth.response;
  try {
    return ok(await cancelPairing(auth.session.id));
  } catch (err) {
    return managerError('Gagal membatalkan pairing code.', err);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
