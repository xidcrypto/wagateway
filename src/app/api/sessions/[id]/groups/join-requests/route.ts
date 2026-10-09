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
  assertJoinRequestAction,
  normalizeParticipants,
  resolveGroupParticipantJids,
} from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Permintaan gabung grup (join-requests).
 * GET `?jid=...` = daftar permintaan.
 * POST `{ jid, participants, action: approve|reject }` = setujui/tolak.
 */
const actionSchema = z.object({
  jid: z.string().min(1, 'JID grup wajib diisi.').max(128),
  participants: z.array(z.string().min(1).max(64)).min(1, 'Minimal 1 peserta.').max(1024),
  action: z.string().min(1, 'Aksi wajib diisi.').max(16),
});

async function handleList(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const raw = (url.searchParams.get('jid') ?? url.searchParams.get('groupJid') ?? '').trim();
  if (!raw) return fail('Sertakan jid grup (query param `jid`).', 400);
  let jid: string;
  try {
    jid = assertGroupJid(raw);
  } catch (err) {
    return managerError('JID grup tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const requests = await sock.groupRequestParticipantsList(jid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safe = Array.isArray(requests) ? requests.map((r: any) => ({
      jid: typeof r?.jid === 'string' ? r.jid : null,
      requestMethod: typeof r?.request_method === 'string' ? r.request_method : null,
      requestTime: r?.request_time != null ? Number(r.request_time) : null,
    })) : [];
    return ok({ jid, requests: safe });
  } catch (err) {
    return managerError('Gagal mengambil daftar permintaan gabung.', err);
  }
}

async function handleAction(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, actionSchema);
  if (!parsed.ok) return parsed.response;

  let jid: string;
  try {
    jid = assertGroupJid(parsed.data.jid);
  } catch (err) {
    return managerError('JID grup tidak valid.', err);
  }
  let action: 'approve' | 'reject';
  try {
    action = assertJoinRequestAction(parsed.data.action);
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
    let meta;
    try {
      meta = await sock.groupMetadata(jid);
    } catch {
      return fail('Grup tidak ditemukan.', 404);
    }
    const resolved = resolveGroupParticipantJids(meta, jids);
    const results = await sock.groupRequestParticipantsUpdate(jid, resolved, action);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safe = Array.isArray(results) ? results.map((r: any) => ({
      jid: typeof r?.jid === 'string' ? r.jid : null,
      status: typeof r?.status === 'string' ? r.status : String(r?.status ?? ''),
    })) : [];
    return ok({ jid, action, results: safe });
  } catch (err) {
    return managerError('Gagal memproses permintaan gabung.', err);
  }
}

export const GET = withAuth(handleList);
export const POST = withAuth(handleAction);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
