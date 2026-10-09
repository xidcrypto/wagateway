import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { prisma } from '@/lib/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConversationRow = {
  id: bigint;
  remote_jid: string;
  direction: string;
  msg_type: string;
  text_body: string | null;
  status: string | null;
  created_at: Date;
  total: bigint;
};

/**
 * Daftar percakapan: group per remoteJid + pesan terakhir,
 * langsung dari tabel messages (aturan global no. 8) via $queryRaw.
 */
export const GET = withAuth(async (req: NextRequest, ctx: unknown, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit') ?? '50');
  const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;

  try {
    const rows = await prisma.$queryRaw<ConversationRow[]>`
      SELECT m1.id, m1.remote_jid, m1.direction, m1.msg_type, m1.text_body,
             m1.status, m1.created_at,
             (SELECT COUNT(*) FROM messages m2
               WHERE m2.session_id = ${auth.session.id}
                 AND m2.remote_jid = m1.remote_jid) AS total
      FROM messages m1
      INNER JOIN (
        SELECT remote_jid, MAX(id) AS max_id
        FROM messages
        WHERE session_id = ${auth.session.id}
        GROUP BY remote_jid
      ) t ON t.max_id = m1.id
      ORDER BY m1.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(DISTINCT remote_jid) AS total
      FROM messages
      WHERE session_id = ${auth.session.id}
    `;
    return ok({
      conversations: rows.map((r) => ({
        remoteJid: r.remote_jid,
        lastMessage: {
          id: r.id,
          direction: r.direction,
          msgType: r.msg_type,
          textBody: r.text_body,
          status: r.status,
          createdAt: r.created_at,
        },
        total: r.total,
      })),
      total: totalRows[0]?.total ?? BigInt(0),
      limit,
      offset,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil daftar percakapan.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
