import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, withAuth } from '@/lib/server/auth';
import { broadcastNotify } from '@/lib/server/notifications';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const broadcastSchema = z.object({
  title: z.string().min(1, 'Judul wajib diisi.').max(255),
  body: z.string().max(2000).optional().nullable(),
  link: z.string().max(512).optional().nullable(),
  // Kosong = semua user aktif. Isi = hanya user id tersebut.
  userIds: z.array(z.number().int().positive()).max(500).optional(),
});

/**
 * Broadcast admin: kirim notifikasi inbox ke semua user aktif atau
 * user tertentu (mis. info update, maintenance, pengumuman).
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const parsed = await parseJsonBody(req, broadcastSchema);
  if (!parsed.ok) return parsed.response;
  const { title, body, link, userIds } = parsed.data;
  try {
    // Validasi target bila disebut eksplisit (abaikan id yang tidak ada).
    let targets: number[] | undefined;
    if (userIds && userIds.length > 0) {
      const rows = await prisma.user.findMany({
        where: { id: { in: userIds }, active: true },
        select: { id: true },
      });
      targets = rows.map((r) => r.id);
      if (targets.length === 0) {
        return fail('Tidak ada user aktif pada daftar tujuan.', 400);
      }
    }
    const result = await broadcastNotify({
      userIds: targets,
      title: title.trim(),
      body: body?.trim() || null,
      link: link?.trim() || null,
    });
    return ok({ sent: result.sent }, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengirim broadcast.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
