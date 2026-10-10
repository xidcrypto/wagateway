import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, withAuth, type AuthContext } from '@/lib/server/auth';
import {
  notifyUserTicket,
  parseTicketId,
  TICKET_STATUSES,
  type SupportRouteCtx,
} from '@/lib/server/support';
import { toMessageWire, type WireMessageRow } from '@/lib/server/support-wire';
import { publishTicketMessage } from '@/lib/server/ticket-live';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const replySchema = z.object({
  message: z.string().max(2000, 'Pesan maksimal 2000 karakter.').optional().default(''),
  // Terima null (client kirim null bila tanpa gambar) + undefined.
  stagedId: z.number().int().positive().nullish(),
});

const statusSchema = z.object({
  status: z.enum(TICKET_STATUSES, { message: 'Status harus open, answered, atau closed.' }),
});

function toDetail(t: {
  id: number;
  userId: number;
  subject: string;
  status: unknown;
  userLastReadAt: Date | null;
  adminLastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: number; username: string; fullName: string };
  messages: WireMessageRow[];
}) {
  return {
    id: t.id,
    userId: t.userId,
    subject: t.subject,
    status: String(t.status),
    // Sisi admin: peerReadAt = kapan USER terakhir membaca (centang biru
    // pesan CS); myReadAt = kapan SAYA (admin) terakhir membaca.
    peerReadAt: t.userLastReadAt ? t.userLastReadAt.toISOString() : null,
    myReadAt: t.adminLastReadAt ? t.adminLastReadAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    user: { id: t.user.id, username: t.user.username, fullName: t.user.fullName },
    messages: t.messages.map(toMessageWire),
  };
}

/** Detail tiket siapa pun (admin); buka = tandai sudah dibaca admin. */
export const GET = withAuth(async (_req, ctx, routeCtx?: SupportRouteCtx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, fullName: true } },
        messages: {
          orderBy: { id: 'asc' },
          take: 500,
          include: { sender: { select: { id: true, username: true, fullName: true } } },
        },
      },
    });
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    await prisma.supportTicket.update({
      where: { id },
      data: { adminLastReadAt: new Date() },
    });
    return ok({
      ticket: toDetail({
        ...ticket,
        userLastReadAt: ticket.userLastReadAt,
        adminLastReadAt: new Date(),
      }),
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil tiket.', 500);
  }
});

async function handleReply(
  req: NextRequest,
  ctx: AuthContext,
  routeCtx?: SupportRouteCtx,
): Promise<Response> {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  const parsed = await parseJsonBody(req, replySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data.message.trim();
  const stagedId = parsed.data.stagedId ?? null;
  if (!body && stagedId === null) return fail('Pesan wajib diisi.', 400);
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, userId: true, subject: true, status: true },
    });
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    // Tiket yang sudah ditutup bersifat permanen — tidak bisa dibuka lagi
    // oleh siapa pun (termasuk admin). Buat tiket baru bila masih butuh.
    if (String(ticket.status) === 'closed') {
      return fail('Tiket sudah ditutup permanen dan tidak bisa dibuka lagi.', 409);
    }
    // Klaim staged milik admin ini di tiket ini (sekali pakai).
    // Admin virtual (id 0) menyimpan staged atas nama admin seed id 1 —
    // samakan dengan handleStage (userId: id===0 ? 1).
    let staged: { id: number; fileName: string; mime: string } | null = null;
    if (stagedId !== null) {
      staged = await prisma.supportStagedFile.findFirst({
        where: {
          id: stagedId,
          ticketId: id,
          userId: ctx.user.id === 0 ? 1 : ctx.user.id,
        },
        select: { id: true, fileName: true, mime: true },
      });
      if (!staged) {
        return fail('File lampiran tidak ditemukan atau sudah dipakai. Unggah ulang.', 400);
      }
    }
    const created = await prisma.$transaction(async (tx) => {
      const msg = await tx.supportMessage.create({
        data: {
          ticketId: id,
          senderId: ctx.user.id === 0 ? null : ctx.user.id,
          fromAdmin: true,
          body,
          mediaPath: staged ? staged.fileName : null,
          mediaMime: staged ? staged.mime : null,
        },
        include: { sender: { select: { id: true, username: true, fullName: true } } },
      });
      if (staged) {
        await tx.supportStagedFile.delete({ where: { id: staged.id } }).catch(() => {});
      }
      await tx.supportTicket.update({
        where: { id },
        data: { status: 'answered', adminLastReadAt: new Date() },
      });
      return msg;
    });
    publishTicketMessage(id, ticket.userId, toMessageWire(created));
    await notifyUserTicket({
      userId: ticket.userId,
      ticketId: id,
      subject: ticket.subject,
      adminName: ctx.user.username,
    });
    return ok({ replied: true, message: toMessageWire(created) }, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal membalas tiket.', 500);
  }
}

/** Admin membalas tiket (otomatis jadi answered; tiket closed ditolak 409 permanen). */
export const POST = withRateLimit(withAuth(handleReply), {
  scope: 'ticket',
  limit: rateLimitFromEnv('RATE_LIMIT_TICKET', 30),
});

async function handleStatus(
  req: NextRequest,
  ctx: AuthContext,
  routeCtx?: SupportRouteCtx,
): Promise<Response> {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  const parsed = await parseJsonBody(req, statusSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, userId: true, subject: true, status: true },
    });
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    const next = parsed.data.status;
    if (String(ticket.status) === next) {
      return ok({ ticket: { id: ticket.id, status: String(ticket.status) } });
    }
    // Tiket closed permanen: tidak bisa diubah ke open/answered lagi.
    if (String(ticket.status) === 'closed') {
      return fail('Tiket sudah ditutup permanen dan tidak bisa dibuka lagi.', 409);
    }
    await prisma.supportTicket.update({ where: { id }, data: { status: next } });
    // Beri tahu user hanya saat tiket ditutup (answered sudah ter-cover balasan).
    if (next === 'closed') {
      await notifyUserTicket({
        userId: ticket.userId,
        ticketId: id,
        subject: ticket.subject,
        adminName: ctx.user.username,
        closed: true,
      });
    }
    return ok({ ticket: { id, status: next } });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengubah status tiket.', 500);
  }
}

/** Admin ubah status manual (open/answered/closed). */
export const PATCH = withAuth(handleStatus);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
