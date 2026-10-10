import { NextRequest } from 'next/server';
import { isAdmin, withAuth } from '@/lib/server/auth';
import { deleteSupportImage } from '@/lib/server/support-media';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteCtx = { params: Promise<{ stagedId: string }> };

async function parseStagedId(routeCtx?: RouteCtx): Promise<number | null> {
  const raw = (await routeCtx?.params)?.stagedId;
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

/**
 * Hapus file staged (tombol X di pratinjau): hapus baris DB + file fisik
 * di server. Hanya pemilik staged (atau admin) yang boleh. Idempoten:
 * staged yang sudah dipakai / hilang tetap { deleted: true }.
 */
export const DELETE = withAuth(async (_req, ctx, routeCtx?: RouteCtx) => {
  const stagedId = await parseStagedId(routeCtx);
  if (stagedId === null) return fail('ID file tidak valid.', 400);
  try {
    const row = await prisma.supportStagedFile.findUnique({
      where: { id: stagedId },
      select: { id: true, userId: true, fileName: true },
    });
    if (!row) return ok({ deleted: true });
    const admin = isAdmin(ctx);
    if (!admin && row.userId !== ctx.user.id) {
      return fail('Akses ditolak. Bukan file milikmu.', 403);
    }
    await prisma.supportStagedFile.delete({ where: { id: stagedId } }).catch(() => {});
    await deleteSupportImage(row.fileName);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal menghapus file.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
