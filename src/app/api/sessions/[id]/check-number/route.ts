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
import { normalizeContact, summarizeOnWhatsApp } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cek apakah nomor terdaftar di WhatsApp. Query `?number=` atau body `{ number }` / `{ phone }`. */
const checkSchema = z.object({
  number: z.string().min(1).max(32).optional(),
  phone: z.string().min(1).max(32).optional(),
});

async function resolveNumbers(req: NextRequest): Promise<string[] | Response> {
  const url = new URL(req.url);
  const fromQuery = (
    url.searchParams.get('number') ??
    url.searchParams.get('phone') ??
    ''
  ).trim();
  if (fromQuery) return [fromQuery];
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return fail('Sertakan nomor (query param `number` atau body).', 400);
  }
  const parsed = checkSchema.safeParse(raw);
  if (Array.isArray(raw)) {
    const arr = raw.map((v) => String(v)).filter((v) => v.trim().length > 0);
    if (arr.length === 0) return fail('Sertakan nomor (query param `number` atau body).', 400);
    return arr;
  }
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message ?? 'Sertakan nomor.', 400);
  }
  const single = (parsed.data.number ?? parsed.data.phone ?? '').trim();
  if (!single) return fail('Sertakan nomor (query param `number` atau body).', 400);
  return [single];
}

async function handleCheck(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  const numbersOrRes = await resolveNumbers(req);
  if (!Array.isArray(numbersOrRes)) return numbersOrRes;

  const phones: string[] = [];
  for (const n of numbersOrRes.slice(0, 20)) {
    try {
      phones.push(normalizeContact(n).phone || normalizeContact(n).jid);
    } catch (err) {
      return managerError(`Nomor tidak valid: ${n}.`, err);
    }
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const results = await sock.onWhatsApp(...phones);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safe = Array.isArray(results) ? results.map((r: any) => summarizeOnWhatsApp(r)) : [];
    return ok({ results: safe });
  } catch (err) {
    return managerError('Gagal memeriksa nomor.', err);
  }
}

export const GET = withAuth(handleCheck);
export const POST = withAuth(handleCheck);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
