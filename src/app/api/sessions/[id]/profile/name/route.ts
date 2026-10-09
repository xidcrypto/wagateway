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
import { assertProfileName } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ubah nama profil WA sendiri: body `{ name }` (1-25 karakter). */
const nameSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi.').max(25),
});

async function handleName(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, nameSchema);
  if (!parsed.ok) return parsed.response;

  let name: string;
  try {
    name = assertProfileName(parsed.data.name);
  } catch (err) {
    return managerError('Nama profil tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    await sock.updateProfileName(name);
    return ok({ name });
  } catch (err) {
    return managerError('Gagal mengubah nama profil.', err);
  }
}

export const POST = withAuth(handleName);
export const PUT = withAuth(handleName);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
