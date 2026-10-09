import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  managerError,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { requireOpenSocket } from '@/lib/server/send-helpers';
import { parseJsonBody } from '@/lib/server/validators';
import { assertGroupJid } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ubah deskripsi grup (string kosong = hapus deskripsi). */
const descSchema = z.object({
  jid: z.string().min(1, 'JID grup wajib diisi.').max(128),
  description: z.string().max(2048).optional().nullable(),
  desc: z.string().max(2048).optional().nullable(),
});

async function handleDesc(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, descSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const jid = assertGroupJid(parsed.data.jid);
    const description = parsed.data.description ?? parsed.data.desc ?? '';
    const sock = await requireOpenSocket(auth.session.id);
    await sock.groupUpdateDescription(jid, description);
    return ok({ updated: true, jid });
  } catch (err) {
    return managerError('Gagal mengubah deskripsi grup.', err);
  }
}

export const POST = withAuth(handleDesc);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
