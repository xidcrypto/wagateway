import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { isAnyAdminOnline } from '@/lib/server/ticket-live';
import { fail, handlePreflight, ok } from '@/lib/server/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Status online CS (ada admin yang SSE-nya tersambung) + snapshot awal.
 * Dipakai fallback bila SSE down (poll ringan) — sumber utama tetap
 * event 'ticket.presence' dari stream.
 */
export const GET = withAuth(async () => {
  try {
    return ok({ adminOnline: isAnyAdminOnline() });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil status CS.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
