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
import { assertProfileStatus } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ubah status/about WA sendiri: body `{ status }` (maks 139 karakter). */
const statusSchema = z.object({
  status: z.string().max(139).optional(),
  about: z.string().max(139).optional(),
});

async function handleStatus(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, statusSchema);
  if (!parsed.ok) return parsed.response;

  const raw = (parsed.data.status ?? parsed.data.about ?? '').trim();
  let status: string;
  try {
    status = assertProfileStatus(raw);
  } catch (err) {
    return managerError('Status profil tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    await sock.updateProfileStatus(status);
    return ok({ status });
  } catch (err) {
    return managerError('Gagal mengubah status profil.', err);
  }
}

export const POST = withAuth(handleStatus);
export const PUT = withAuth(handleStatus);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
