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
import {
  assertGroupJid,
  assertParticipantAction,
  normalizeParticipants,
  resolveGroupParticipantJids,
} from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Kelola anggota grup: add, remove, promote, demote. */
const membersSchema = z.object({
  jid: z.string().min(1, 'JID grup wajib diisi.').max(128),
  participants: z.array(z.string().min(1).max(64)).min(1, 'Minimal 1 peserta.').max(1024),
  action: z.string().min(1, 'Aksi wajib diisi.').max(16),
});

async function handleMembers(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, membersSchema);
  if (!parsed.ok) return parsed.response;

  let jid: string;
  try {
    jid = assertGroupJid(parsed.data.jid);
  } catch (err) {
    return managerError('JID grup tidak valid.', err);
  }
  let action: string;
  try {
    action = assertParticipantAction(parsed.data.action);
  } catch (err) {
    return managerError('Aksi tidak valid.', err);
  }
  let jids: string[];
  try {
    jids = normalizeParticipants(parsed.data.participants);
  } catch (err) {
    return managerError('Daftar peserta tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    // Grup baru memakai addressing LID: resolve dulu ke id aktual peserta.
    let meta;
    try {
      meta = await sock.groupMetadata(jid);
    } catch {
      return fail('Grup tidak ditemukan.', 404);
    }
    const resolved = resolveGroupParticipantJids(meta, jids);
    const results = await sock.groupParticipantsUpdate(jid, resolved, action);
    const safe = Array.isArray(results)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? results.map((r: any) => ({
          jid: typeof r?.jid === 'string' ? r.jid : null,
          status: typeof r?.status === 'string' ? r.status : String(r?.status ?? ''),
        }))
      : [];
    return ok({ jid, action, results: safe });
  } catch (err) {
    return managerError('Gagal mengelola anggota grup.', err);
  }
}

export const POST = withAuth(handleMembers);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
