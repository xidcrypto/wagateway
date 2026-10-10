import { NextRequest } from 'next/server';
import { isAdmin, withAuth } from '@/lib/server/auth';
import { parseTicketId, type SupportRouteCtx } from '@/lib/server/support';
import { publishTicketTyping } from '@/lib/server/ticket-live';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sinyal "sedang mengetik" untuk satu tiket. Ringan: tanpa tulis DB,
 * hanya fan-out SSE ke pihak tiket itu. Client wajib debounce (maks
 * ~1 kirim per 3 dtk); server juga dibatasi rate-limit 30/15 mnt.
 */
async function handleTyping(
  _req: NextRequest,
  ctx: Parameters<Parameters<typeof withAuth>[0]>[1],
  routeCtx?: SupportRouteCtx,
): Promise<Response> {
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  try {
    if (isAdmin(ctx)) {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!ticket) return fail('Tiket tidak ditemukan.', 404);
      publishTicketTyping(id, true);
    } else {
      const ticket = await prisma.supportTicket.findFirst({
        where: { id, userId: ctx.user.id },
        select: { id: true },
      });
      if (!ticket) return fail('Tiket tidak ditemukan.', 404);
      publishTicketTyping(id, false);
    }
    return ok({ typing: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengirim sinyal mengetik.', 500);
  }
}

export const POST = withRateLimit(withAuth(handleTyping), {
  scope: 'ticket-typing',
  limit: rateLimitFromEnv('RATE_LIMIT_TICKET_TYPING', 30),
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
