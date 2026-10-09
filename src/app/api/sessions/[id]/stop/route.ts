import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  managerError,
  stop,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { parseJsonBody } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stopSchema = z.object({
  logout: z.boolean({ message: 'Field logout harus boolean.' }),
});

export const POST = withAuth(async (req: NextRequest, ctx, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(ctx, routeCtx);
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, stopSchema);
  if (!parsed.ok) return parsed.response;
  try {
    await stop(auth.session.id, parsed.data.logout);
  } catch (err) {
    return managerError('Gagal menghentikan session.', err);
  }
  if (parsed.data.logout) {
    return ok({ stopped: true, deleted: true });
  }
  const fresh = await prisma.session.findUnique({ where: { id: auth.session.id } });
  return ok({ stopped: true, session: fresh });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
