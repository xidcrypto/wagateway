import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { withAuth } from '@/lib/server/auth';
import { supportImagePath } from '@/lib/server/support-media';
import { prisma } from '@/lib/server/prisma';
import { applyCors, applySecurityHeaders, fail, handlePreflight } from '@/lib/server/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteCtx = { params: Promise<{ name: string }> };

/**
 * Sajikan lampiran gambar tiket. BERAUTH + cek kepemilikan: user biasa
 * hanya boleh melihat gambar di tiket miliknya (dilihat dari mediaPath
 * yang tercatat di DB); admin boleh semua. Bukan file publik statis.
 */
export const GET = withAuth(async (req: NextRequest, ctx, routeCtx?: RouteCtx) => {
  const raw = (await routeCtx?.params)?.name;
  if (!raw) return fail('Nama file tidak valid.', 400);
  const full = supportImagePath(raw);
  if (!full) return fail('Nama file tidak valid.', 400);
  try {
    const owner = await prisma.supportMessage.findFirst({
      where: { mediaPath: raw },
      select: { ticketId: true, ticket: { select: { userId: true } } },
    });
    if (!owner) return fail('Gambar tidak ditemukan.', 404);
    if (ctx.user.role !== 'admin' && owner.ticket.userId !== ctx.user.id) {
      return fail('Akses ditolak. Bukan tiket milikmu.', 403);
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(full);
    } catch {
      return fail('Gambar tidak ditemukan.', 404);
    }
    // MIME dari magic bytes saat upload tersimpan di DB; fallback aman.
    const row = await prisma.supportMessage.findFirst({
      where: { mediaPath: raw },
      select: { mediaMime: true },
    });
    const mime = row?.mediaMime ?? 'image/jpeg';
    const res = new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, max-age=86400',
      },
    });
    applySecurityHeaders(res);
    applyCors(req, res);
    return res;
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil gambar.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
