import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight } from '@/lib/server/response';
import { handleBlastAction, type BlastCtx } from '@/lib/server/blast-actions';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cancel campaign: progres tetap tersimpan, sisa pending tidak dikirim. */
export const POST = withAuth(async (req: NextRequest, ctx, routeCtx?: BlastCtx) => {
  return handleBlastAction(req, ctx, routeCtx, 'cancel');
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
