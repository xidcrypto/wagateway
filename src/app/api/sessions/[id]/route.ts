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

const patchLabelSchema = z.object({
  label: z.string().min(1, 'Label wajib diisi.').max(255),
});

export const GET = withAuth(async (_req, ctx, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(ctx, routeCtx);
  if (!auth.ok) return auth.response;
  const session = await prisma.session.findUnique({
    where: { id: auth.session.id },
    include: { owner: { select: { id: true, username: true } } },
  });
  return ok({ session });
});

export const PATCH = withAuth(async (req: NextRequest, ctx, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(ctx, routeCtx);
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, patchLabelSchema);
  if (!parsed.ok) return parsed.response;
  const updated = await prisma.session.update({
    where: { id: auth.session.id },
    data: { label: parsed.data.label.trim() },
  });
  return ok({ session: updated });
});

export const DELETE = withAuth(async (_req, ctx, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(ctx, routeCtx);
  if (!auth.ok) return auth.response;
  // DELETE session = stop logout true + hapus pesan terkait (di dalam stop()).
  try {
    await stop(auth.session.id, true);
  } catch (err) {
    return managerError('Gagal menghapus session.', err);
  }
  return ok({ deleted: true });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
