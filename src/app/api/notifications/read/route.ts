import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const readSchema = z.object({
  // Tandai satu notifikasi (id string BigInt) atau semua bila all=true.
  id: z.string().min(1).max(32).optional(),
  all: z.boolean().optional(),
});

/** Tandai notifikasi milik sendiri sebagai dibaca (satu atau semua). */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const parsed = await parseJsonBody(req, readSchema);
  if (!parsed.ok) return parsed.response;
  const { id, all } = parsed.data;
  try {
    if (all) {
      const r = await prisma.notification.updateMany({
        where: { userId: ctx.user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return ok({ read: r.count });
    }
    if (!id) return fail('ID notifikasi wajib diisi.', 400);
    let big: bigint;
    try {
      big = BigInt(id);
    } catch {
      return fail('ID notifikasi tidak valid.', 400);
    }
    const row = await prisma.notification.findUnique({ where: { id: big } });
    if (!row || row.userId !== ctx.user.id) {
      return fail('Notifikasi tidak ditemukan.', 404);
    }
    if (!row.readAt) {
      await prisma.notification.update({ where: { id: big }, data: { readAt: new Date() } });
    }
    return ok({ read: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal menandai notifikasi.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
