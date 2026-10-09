import type { NextRequest } from 'next/server';
import { isAdmin, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { Prisma } from '@/generated/prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DayRow = {
  day: Date | string;
  direction: string;
  total: bigint;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Kunci tanggal lokal yyyy-mm-dd (zona server, konsisten dengan admin/stats). */
function toLocalDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    return '';
  }
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

/**
 * Statistik dashboard untuk user yang login (Fase 5, step 5.0).
 * - User biasa: hanya session miliknya (difilter via ownerId / sessionId).
 * - Admin (termasuk admin virtual Master API key): agregat semua.
 * - daily: deret 7 hari terakhir (termasuk hari ini), tiap hari { date, in, out, total }.
 * - recent: 10 pesan terakhir (ringan, tanpa payload).
 * - sessionsList: daftar session dalam scope (hemat 1 request di dashboard).
 */
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const admin = isAdmin(ctx);

  let ownedIds: string[] = [];
  if (!admin) {
    const owned = await prisma.session.findMany({
      where: { ownerId: ctx.user.id },
      select: { id: true },
    });
    ownedIds = owned.map((s) => s.id);
    if (ownedIds.length === 0) {
      return ok({
        sessions: { total: 0, open: 0 },
        messages: { total: 0, in: 0, out: 0, today: 0 },
        daily: buildEmptyDaily(),
        recent: [],
        sessionsList: [],
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionScope: any = admin ? {} : { ownerId: ctx.user.id };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgScope: any = admin ? {} : { sessionId: { in: ownedIds } };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const start7 = new Date(startOfDay);
  start7.setDate(start7.getDate() - 6);

  try {
    const [totalSessions, openSessions, inCount, outCount, todayCount, dayRows, recent, sessionsList] =
      await Promise.all([
        prisma.session.count({ where: sessionScope }),
        prisma.session.count({ where: { ...sessionScope, status: 'open' } }),
        prisma.message.count({ where: { ...msgScope, direction: 'in' } }),
        prisma.message.count({ where: { ...msgScope, direction: 'out' } }),
        prisma.message.count({ where: { ...msgScope, createdAt: { gte: startOfDay } } }),
        admin
          ? prisma.$queryRaw<DayRow[]>`
              SELECT DATE(created_at) AS day, direction, COUNT(*) AS total
              FROM messages
              WHERE created_at >= ${start7}
              GROUP BY day, direction`
          : prisma.$queryRaw<DayRow[]>`
              SELECT DATE(created_at) AS day, direction, COUNT(*) AS total
              FROM messages
              WHERE created_at >= ${start7} AND session_id IN (${Prisma.join(ownedIds)})
              GROUP BY day, direction`,
        prisma.message.findMany({
          where: msgScope,
          orderBy: { id: 'desc' },
          take: 10,
          select: {
            id: true,
            sessionId: true,
            direction: true,
            remoteJid: true,
            msgType: true,
            textBody: true,
            status: true,
            createdAt: true,
            session: { select: { id: true, label: true } },
          },
        }),
        prisma.session.findMany({
          where: sessionScope,
          orderBy: { createdAt: 'desc' },
          select: { id: true, label: true, status: true, phone: true, waName: true },
        }),
      ]);

    return ok({
      sessions: { total: totalSessions, open: openSessions },
      messages: {
        total: inCount + outCount,
        in: inCount,
        out: outCount,
        today: todayCount,
      },
      daily: mergeDaily(startOfDay, dayRows),
      recent,
      sessionsList,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil statistik.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}

function buildEmptyDaily(): Array<{ date: string; in: number; out: number; total: number }> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return mergeDaily(startOfDay, []);
}

function mergeDaily(
  startOfDay: Date,
  rows: DayRow[],
): Array<{ date: string; in: number; out: number; total: number }> {
  const slots = new Map<string, { in: number; out: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfDay);
    d.setDate(d.getDate() - i);
    slots.set(toLocalDateKey(d), { in: 0, out: 0 });
  }
  for (const row of rows) {
    const key = toLocalDateKey(row.day);
    const slot = slots.get(key);
    if (!slot) continue;
    const n = Number(row.total);
    if (!Number.isFinite(n) || n < 0) continue;
    if (row.direction === 'in') slot.in += n;
    else if (row.direction === 'out') slot.out += n;
  }
  return [...slots.entries()].map(([date, v]) => ({
    date,
    in: v.in,
    out: v.out,
    total: v.in + v.out,
  }));
}
