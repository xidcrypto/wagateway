import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { parseTicketId, type SupportRouteCtx } from '@/lib/server/support';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** User menutup tiketnya sendiri (tidak bisa dibuka lagi oleh user). */
export const POST = withAuth(async (_req, ctx, routeCtx?: SupportRouteCtx) => {
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId: ctx.user.id },
      select: { id: true, status: true },
    });
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    if (String(ticket.status) === 'closed') return ok({ closed: true });
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'closed' },
    });
    return ok({ closed: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal menutup tiket.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
