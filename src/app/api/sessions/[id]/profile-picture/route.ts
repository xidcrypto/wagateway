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
import { loadMedia, maxMediaBytes } from '@/lib/server/media-loader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Foto profil kontak.
 * GET `?number=` = ambil URL foto (milik sendiri bila tanpa number).
 * PUT `{ image }` = ganti foto sendiri (URL/data URI/path lokal via media loader).
 * DELETE = hapus foto sendiri.
 */
const putSchema = z.object({
  image: z.string().min(1, 'Gambar wajib diisi.').max(20_000_000),
});

async function resolveJidOrSelf(req: NextRequest, meJid: string): Promise<string | Response> {
  const url = new URL(req.url);
  const raw = (
    url.searchParams.get('number') ??
    url.searchParams.get('phone') ??
    url.searchParams.get('jid') ??
    ''
  ).trim();
  if (!raw) return meJid;
  const digits = raw.replace(/\D/g, '');
  if (raw.includes('@')) return raw.trim();
  if (digits.length >= 6 && digits.length <= 15 && !digits.startsWith('0')) {
    return `${digits}@s.whatsapp.net`;
  }
  return fail('Nomor tidak valid. Pakai format internasional tanpa awalan nol.', 400);
}

async function handleGet(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const meJid = sock.user?.id ?? '';
    const targetOrRes = await resolveJidOrSelf(req, meJid);
    if (typeof targetOrRes !== 'string') return targetOrRes;
    const url = await sock.profilePictureUrl(targetOrRes, 'image').catch(() => null);
    return ok({ jid: targetOrRes, url: typeof url === 'string' ? url : null });
  } catch (err) {
    return managerError('Gagal mengambil foto profil.', err);
  }
}

async function handlePut(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return fail('Body JSON tidak valid.', 400);
  }
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(`image: ${first?.message ?? 'Gambar wajib diisi.'}`, 400);
  }

  try {
    const media = await loadMedia({ media: parsed.data.image });
    if (!media.mimeType.startsWith('image/')) {
      return fail('Foto profil harus berupa gambar.', 400);
    }
    if (media.buffer.length > maxMediaBytes()) {
      return fail(`Gambar melebihi batas ${maxMediaBytes() / 1024 / 1024} MB.`, 413);
    }
    const sock = await requireOpenSocket(auth.session.id);
    const meJid = sock.user?.id;
    if (!meJid) return fail('Session belum tersambung.', 409);
    await sock.updateProfilePicture(meJid, media.buffer);
    return ok({ updated: true });
  } catch (err) {
    const status =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? Number((err as { statusCode: unknown }).statusCode) || 500
        : 500;
    if (status === 400 || status === 413) {
      return fail(err instanceof Error ? err.message : 'Gambar tidak valid.', status);
    }
    return managerError('Gagal mengganti foto profil.', err);
  }
}

async function handleDelete(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const meJid = sock.user?.id;
    if (!meJid) return fail('Session belum tersambung.', 409);
    await sock.removeProfilePicture(meJid);
    return ok({ deleted: true });
  } catch (err) {
    return managerError('Gagal menghapus foto profil.', err);
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
