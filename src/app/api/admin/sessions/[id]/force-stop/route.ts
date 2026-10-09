import { requireAdmin, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  assertValidSessionId,
  managerError,
  stop,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/server/validators';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const forceStopSchema = z.object({
  logout: z.boolean().optional(),
});

/**
 * Paksa hentikan session milik user mana pun (Fase 3, step 3.4, admin saja).
 * Body opsional `{ logout }` (default false = kredensial disimpan, bisa start lagi).
 */
export const POST = withAuth(async (req: NextRequest, ctx, routeCtx?: RouteCtx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;

  const rawId = (await routeCtx?.params)?.id ?? '';
  try {
    assertValidSessionId(rawId);
  } catch {
    return fail('ID session tidak valid.', 400);
  }
  const session = await prisma.session.findUnique({ where: { id: rawId } });
  if (!session) {
    return fail('Session tidak ditemukan.', 404);
  }

  let logout = false;
  try {
    const parsed = await parseJsonBody(req, forceStopSchema);
    if (parsed.ok) logout = parsed.data.logout ?? false;
  } catch {
    logout = false;
  }

  try {
    await stop(rawId, logout);
  } catch (err) {
    return managerError('Gagal menghentikan session.', err);
  }
  if (logout) {
    return ok({ stopped: true, deleted: true, id: rawId });
  }
  const fresh = await prisma.session.findUnique({ where: { id: rawId } });
  return ok({ stopped: true, session: fresh });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
