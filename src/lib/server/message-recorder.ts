import 'server-only';

import { prisma } from './prisma';

/**
 * Pencatat pesan (Fase 2, step 2.3).
 * - Pesan keluar dicatat saat route kirim sukses (status awal `sent`).
 * - Status diperbarui dari event Baileys `messages.update` via `waId`
 *   (stanzaId Baileys): sent → delivered → read, atau failed.
 *
 * Mapping status Baileys (WebMessageInfo.Status):
 *   ERROR=0 → failed, PENDING=1 → pending, SERVER_ACK=2 → sent,
 *   DELIVERY_ACK=3 → delivered, READ=4 / PLAYED=5 → read.
 */

export type OutgoingStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

const BAILEYS_TO_STATUS: Record<number, OutgoingStatus> = {
  0: 'failed',
  1: 'pending',
  2: 'sent',
  3: 'delivered',
  4: 'read',
  5: 'read',
};

const RANK: Record<OutgoingStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 3,
};

export function mapBaileysStatus(raw: unknown): OutgoingStatus | null {
  if (typeof raw === 'number' && raw in BAILEYS_TO_STATUS) return BAILEYS_TO_STATUS[raw];
  if (typeof raw === 'string') {
    const s = raw.toUpperCase();
    if (s === 'ERROR') return 'failed';
    if (s === 'PENDING') return 'pending';
    if (s === 'SERVER_ACK') return 'sent';
    if (s === 'DELIVERY_ACK') return 'delivered';
    if (s === 'READ' || s === 'PLAYED') return 'read';
  }
  return null;
}

export type RecordOutgoingInput = {
  sessionId: string;
  waId: string;
  remoteJid: string;
  msgType: string;
  textBody?: string | null;
  status?: OutgoingStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
};

/** Catat pesan keluar. Mengembalikan id DB sebagai string (BigInt aman JSON). */
export async function recordOutgoing(input: RecordOutgoingInput): Promise<string> {
  const created = await prisma.message.create({
    data: {
      sessionId: input.sessionId,
      direction: 'out',
      waId: input.waId,
      remoteJid: input.remoteJid,
      msgType: input.msgType,
      textBody: input.textBody ?? null,
      status: input.status ?? 'sent',
      payload: input.payload ?? undefined,
    },
    select: { id: true },
  });
  return String(created.id);
}

/**
 * Perbarui status pesan keluar berdasarkan waId (hanya arah `out`).
 * Tidak pernah downgrade (mis. `read` tidak turun ke `delivered`).
 * `failed` bersifat terminal: setelah failed, update lain diabaikan.
 * Mengembalikan true bila ada baris yang berubah.
 */
export async function updateOutgoingStatus(
  sessionId: string,
  waId: string,
  status: OutgoingStatus,
): Promise<boolean> {
  const rows = await prisma.message.findMany({
    where: { sessionId, waId, direction: 'out' },
    select: { id: true, status: true },
  });
  if (rows.length === 0) return false;
  let changed = false;
  for (const row of rows) {
    const current = row.status as OutgoingStatus | null;
    if (current === 'failed') continue;
    const curRank = current ? RANK[current] : -1;
    if (RANK[status] < curRank && status !== 'failed') continue;
    if (current === status) continue;
    await prisma.message.update({
      where: { id: row.id },
      data: { status },
    });
    changed = true;
  }
  return changed;
}
