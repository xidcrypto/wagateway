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
import { extractInviteCode, summarizeGroup } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Info grup dari kode/link invite tanpa perlu menjadi anggota. */
const infoSchema = z.object({
  code: z.string().min(1).max(256).optional(),
  link: z.string().min(1).max(256).optional(),
  invite: z.string().min(1).max(256).optional(),
});

async function resolveCode(req: NextRequest): Promise<string | Response> {
  const url = new URL(req.url);
  const fromQuery = (
    url.searchParams.get('code') ??
    url.searchParams.get('link') ??
    url.searchParams.get('invite') ??
    ''
  ).trim();
  if (fromQuery) {
    try {
      return extractInviteCode(fromQuery);
    } catch (err) {
      return managerError('Kode/link invite tidak valid.', err);
    }
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return fail('Sertakan kode invite atau link grup.', 400);
  }
  const parsed = infoSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message ?? 'Sertakan kode invite atau link grup.', 400);
  }
  const codeRaw = (parsed.data.link ?? parsed.data.invite ?? parsed.data.code ?? '').trim();
  if (!codeRaw) return fail('Sertakan kode invite atau link grup.', 400);
  try {
    return extractInviteCode(codeRaw);
  } catch (err) {
    return managerError('Kode/link invite tidak valid.', err);
  }
}

async function handleInfo(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  const codeOrRes = await resolveCode(req);
  if (typeof codeOrRes !== 'string') return codeOrRes;

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const meta = await sock.groupGetInviteInfo(codeOrRes);
    return ok({ group: summarizeGroup(meta) });
  } catch (err) {
    return managerError('Gagal mengambil info invite grup.', err);
  }
}

export const GET = withAuth(handleInfo);
export const POST = withAuth(handleInfo);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
