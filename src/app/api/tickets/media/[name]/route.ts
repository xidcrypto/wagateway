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
 * hanya boleh melihat gambar di tiket miliknya — baik yang sudah jadi
 * pesan (supportMessage.mediaPath) MAUPUN yang masih staged/pratinjau
 * (supportStagedFile.fileName); admin boleh semua. Bukan file publik statis.
 */
export const GET = withAuth(async (req: NextRequest, ctx, routeCtx?: RouteCtx) => {
  const raw = (await routeCtx?.params)?.name;
  if (!raw) return fail('Nama file tidak valid.', 400);
  const full = supportImagePath(raw);
  if (!full) return fail('Nama file tidak valid.', 400);
  try {
    // 1) File yang sudah jadi pesan.
    const owner = await prisma.supportMessage.findFirst({
      where: { mediaPath: raw },
      select: { ticketId: true, ticket: { select: { userId: true } }, mediaMime: true },
    });
    let mime: string | null = owner?.mediaMime ?? null;
    let allowedUserId: number | null = owner ? owner.ticket.userId : null;
    // 2) File staged (pratinjau chip composer, belum dikirim).
    if (!owner) {
      const staged = await prisma.supportStagedFile.findFirst({
        where: { fileName: raw },
        select: { userId: true, ticket: { select: { userId: true } }, mime: true },
      });
      if (!staged) return fail('Gambar tidak ditemukan.', 404);
      mime = staged.mime;
      // Pemilik staged = pengunggah; admin (id 0) stage atas nama seed id 1
      // tapi tiketnya tetap milik user bersangkutan — izinkan keduanya.
      allowedUserId = staged.ticket.userId;
      const uploaderOk = staged.userId === ctx.user.id;
      const ticketOwnerOk = staged.ticket.userId === ctx.user.id;
      if (ctx.user.role !== 'admin' && !uploaderOk && !ticketOwnerOk) {
        return fail('Akses ditolak. Bukan tiket milikmu.', 403);
      }
    } else if (ctx.user.role !== 'admin' && allowedUserId !== ctx.user.id) {
      return fail('Akses ditolak. Bukan tiket milikmu.', 403);
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(full);
    } catch {
      return fail('Gambar tidak ditemukan.', 404);
    }
    const res = new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': mime ?? 'image/jpeg',
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
