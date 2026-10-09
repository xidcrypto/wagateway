import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight } from '@/lib/server/response';
import { handleBlastAction, type BlastCtx } from '@/lib/server/blast-actions';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Pause campaign: running → paused (tanpa kehilangan progres). */
export const POST = withAuth(async (req: NextRequest, ctx, routeCtx?: BlastCtx) => {
  return handleBlastAction(req, ctx, routeCtx, 'pause');
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
