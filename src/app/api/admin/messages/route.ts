import { requireAdmin, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Audit pesan lintas user (Fase 3, step 3.4, admin saja).
 * Filter: session_id, owner_id, direction (in/out), remote_jid, msg_type,
 * status (pending/sent/delivered/read/failed), q (cari di teks),
 * date_from/date_to (ISO), limit (default 50, maks 200), offset.
 * Urutan: terbaru dulu (id desc). Payload JSON tidak dikembalikan (hemat).
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;

  const url = new URL(req.url);
  const sessionId = (url.searchParams.get('session_id') ?? url.searchParams.get('sessionId') ?? '').trim();
  const ownerRaw = (url.searchParams.get('owner_id') ?? url.searchParams.get('ownerId') ?? '').trim();
  const direction = (url.searchParams.get('direction') ?? '').trim();
  const remoteJid = (url.searchParams.get('remote_jid') ?? url.searchParams.get('remoteJid') ?? '').trim();
  const msgType = (url.searchParams.get('msg_type') ?? url.searchParams.get('msgType') ?? '').trim();
  const status = (url.searchParams.get('status') ?? '').trim();
  const q = (url.searchParams.get('q') ?? '').trim();
  const dateFromRaw = (url.searchParams.get('date_from') ?? url.searchParams.get('dateFrom') ?? '').trim();
  const dateToRaw = (url.searchParams.get('date_to') ?? url.searchParams.get('dateTo') ?? '').trim();
  const limitRaw = Number(url.searchParams.get('limit') ?? '50');
  const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;

  if (direction !== '' && direction !== 'in' && direction !== 'out') {
    return fail('direction: Harus "in" atau "out".', 400);
  }
  const validStatus = new Set(['pending', 'sent', 'delivered', 'read', 'failed']);
  if (status !== '' && !validStatus.has(status)) {
    return fail('status: Nilai tidak valid.', 400);
  }
  let ownerId: number | undefined;
  if (ownerRaw !== '') {
    const n = Number.parseInt(ownerRaw, 10);
    if (!Number.isInteger(n) || n <= 0) {
      return fail('owner_id: Harus angka positif.', 400);
    }
    ownerId = n;
  }
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (dateFromRaw !== '') {
    const d = new Date(dateFromRaw);
    if (Number.isNaN(d.getTime())) return fail('date_from: Format tanggal tidak valid.', 400);
    dateFrom = d;
  }
  if (dateToRaw !== '') {
    const d = new Date(dateToRaw);
    if (Number.isNaN(d.getTime())) return fail('date_to: Format tanggal tidak valid.', 400);
    dateTo = d;
  }

  try {
    // owner_id diselesaikan lewat relasi session (join), bukan kolom messages.
    let sessionIds: string[] | undefined;
    if (sessionId !== '' || ownerId !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionWhere: any = {};
      if (sessionId !== '') sessionWhere.id = sessionId;
      if (ownerId !== undefined) sessionWhere.ownerId = ownerId;
      const matched = await prisma.session.findMany({
        where: sessionWhere,
        select: { id: true },
      });
      sessionIds = matched.map((s) => s.id);
      if (sessionIds.length === 0) {
        return ok({ messages: [], total: 0, limit, offset });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (sessionIds !== undefined) where.sessionId = { in: sessionIds };
    if (direction === 'in' || direction === 'out') where.direction = direction;
    if (remoteJid) where.remoteJid = remoteJid;
    if (msgType) where.msgType = msgType;
    if (status) where.status = status;
    if (q) where.textBody = { contains: q };
    if (dateFrom !== undefined || dateTo !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const range: any = {};
      if (dateFrom !== undefined) range.gte = dateFrom;
      if (dateTo !== undefined) range.lte = dateTo;
      where.createdAt = range;
    }

    const [total, rows] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          sessionId: true,
          direction: true,
          waId: true,
          remoteJid: true,
          msgType: true,
          textBody: true,
          status: true,
          createdAt: true,
          session: {
            select: {
              id: true,
              label: true,
              ownerId: true,
              owner: { select: { id: true, username: true } },
            },
          },
        },
      }),
    ]);
    return ok({ messages: rows, total, limit, offset });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil audit pesan.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
