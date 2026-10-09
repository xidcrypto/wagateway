import 'server-only';

import type { NextRequest } from 'next/server';
import { isAdmin } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, ok } from '@/lib/server/response';
import { authorizeSession, type RouteCtx } from '@/lib/server/session-manager';
import { kickBlast } from '@/lib/server/blast-worker';

export type BlastCtx = RouteCtx & { params: Promise<{ id: string; blastId: string }> };

export async function parseBlastId(routeCtx?: BlastCtx): Promise<number | null> {
  const raw = (await routeCtx?.params)?.blastId;
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

/** Guard kepemilikan blast: admin boleh semua, user hanya miliknya. */
export async function loadOwnedBlast(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  routeCtx: BlastCtx | undefined,
): Promise<
  | { ok: true; sessionId: string; blast: { id: number; status: string } }
  | { ok: false; response: Response }
> {
  const auth = await authorizeSession(ctx, routeCtx);
  if (!auth.ok) return { ok: false, response: auth.response };
  if (!isAdmin(ctx) && auth.session.ownerId !== ctx.user.id) {
    return { ok: false, response: fail('Akses ditolak. Bukan blast milikmu.', 403) };
  }
  const blastId = await parseBlastId(routeCtx);
  if (blastId === null) {
    return { ok: false, response: fail('ID blast tidak valid.', 400) };
  }
  const blast = await prisma.blast.findFirst({
    where: { id: blastId, sessionId: auth.session.id },
    select: { id: true, status: true },
  });
  if (!blast) {
    return { ok: false, response: fail('Blast tidak ditemukan.', 404) };
  }
  return { ok: true, sessionId: auth.session.id, blast };
}

export async function handleBlastAction(
  req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  routeCtx: BlastCtx | undefined,
  action: 'pause' | 'resume' | 'cancel',
): Promise<Response> {
  void req;
  const loaded = await loadOwnedBlast(ctx, routeCtx);
  if (!loaded.ok) return loaded.response;
  const { blast } = loaded;
  try {
    if (action === 'pause') {
      if (blast.status !== 'running') {
        return fail(`Tidak bisa pause: status saat ini ${blast.status}.`, 409);
      }
      const updated = await prisma.blast.update({
        where: { id: blast.id },
        data: { status: 'paused' },
        select: { id: true, status: true },
      });
      return ok({ blast: updated });
    }
    if (action === 'resume') {
      if (blast.status !== 'paused') {
        return fail(`Tidak bisa resume: status saat ini ${blast.status}.`, 409);
      }
      const updated = await prisma.blast.update({
        where: { id: blast.id },
        data: { status: 'running', error: null },
        select: { id: true, status: true },
      });
      kickBlast(blast.id);
      return ok({ blast: updated });
    }
    if (blast.status === 'done' || blast.status === 'cancelled') {
      return fail(`Tidak bisa cancel: status saat ini ${blast.status}.`, 409);
    }
    const updated = await prisma.blast.update({
      where: { id: blast.id },
      data: { status: 'cancelled', finishedAt: new Date() },
      select: { id: true, status: true },
    });
    return ok({ blast: updated });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal memproses aksi blast.', 500);
  }
}
