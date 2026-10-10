import 'server-only';

import { prisma } from './prisma';
import { notify } from './notifications';

export const TICKET_STATUSES = ['open', 'answered', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type SupportRouteCtx = { params: Promise<{ id: string }> };

/** Ambil id tiket integer dari params async route. */
export async function parseTicketId(routeCtx?: SupportRouteCtx): Promise<number | null> {
  const raw = (await routeCtx?.params)?.id;
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

/** Potongan teks untuk notifikasi (maks 140 char, satu baris). */
export function excerpt(text: string, max = 140): string {
  const one = text.replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1)}…`;
}

function ticketLinkForAdmin(ticketId: number): string {
  return `/admin/tickets?id=${ticketId}`;
}

function ticketLinkForUser(ticketId: number): string {
  return `/cs?id=${ticketId}`;
}

/**
 * Beri tahu semua admin aktif bila user membuat / membalas tiket.
 * Tidak pernah melempar (notify sudah aman).
 */
export async function notifyAdminsTicket(input: {
  ticketId: number;
  subject: string;
  actorName: string;
  reply?: boolean;
}): Promise<void> {
  let admins: Array<{ id: number }>;
  try {
    admins = await prisma.user.findMany({
      where: { role: 'admin', active: true },
      select: { id: true },
    });
  } catch {
    return;
  }
  if (admins.length === 0) return;
  const title = input.reply
    ? `Balasan baru tiket #${input.ticketId} dari ${input.actorName}`
    : `Tiket baru #${input.ticketId} dari ${input.actorName}`;
  for (const a of admins) {
    await notify({
      userId: a.id,
      kind: 'ticket_new',
      title,
      body: excerpt(`${input.subject}`),
      link: ticketLinkForAdmin(input.ticketId),
    });
  }
}

/** Beri tahu pemilik tiket bila admin membalas / mengubah status. */
export async function notifyUserTicket(input: {
  userId: number;
  ticketId: number;
  subject: string;
  adminName: string;
  closed?: boolean;
  reopened?: boolean;
}): Promise<void> {
  let title: string;
  if (input.closed) {
    title = `Tiket #${input.ticketId} ditutup oleh CS`;
  } else if (input.reopened) {
    title = `Tiket #${input.ticketId} dibuka kembali`;
  } else {
    title = `CS membalas tiket #${input.ticketId}`;
  }
  await notify({
    userId: input.userId,
    kind: 'ticket_reply',
    title,
    body: excerpt(input.subject),
    link: ticketLinkForUser(input.ticketId),
  });
}
