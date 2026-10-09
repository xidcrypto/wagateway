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
import { assertGroupJid, assertGroupSetting } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ubah setting grup.
 * `setting`: announcement (hanya admin kirim pesan), not_announcement,
 * locked (hanya admin ubah info), unlocked.
 */
const settingsSchema = z.object({
  jid: z.string().min(1, 'JID grup wajib diisi.').max(128),
  setting: z.string().min(1, 'Setting wajib diisi.').max(32),
});

async function handleSettings(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, settingsSchema);
  if (!parsed.ok) return parsed.response;

  let jid: string;
  try {
    jid = assertGroupJid(parsed.data.jid);
  } catch (err) {
    return managerError('JID grup tidak valid.', err);
  }
  let setting: string;
  try {
    setting = assertGroupSetting(parsed.data.setting);
  } catch (err) {
    return managerError('Setting tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    // Pastikan grup ada dulu (query ke JID tak dikenal tidak dijawab server WA → hang).
    try {
      await sock.groupMetadata(jid);
    } catch {
      return fail('Grup tidak ditemukan.', 404);
    }
    await sock.groupSettingUpdate(jid, setting);
    return ok({ jid, setting });
  } catch (err) {
    return managerError('Gagal mengubah setting grup.', err);
  }
}

export const POST = withAuth(handleSettings);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
