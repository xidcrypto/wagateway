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
import { normalizeParticipants, summarizeGroup } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Buat grup baru dengan nama + daftar nomor peserta. */
const createSchema = z.object({
  subject: z.string().min(1, 'Nama grup wajib diisi.').max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  participants: z.array(z.string().min(1).max(64)).min(1, 'Minimal 1 peserta.').max(1024),
});

async function handleCreate(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, createSchema);
  if (!parsed.ok) return parsed.response;

  const subject = (parsed.data.subject ?? parsed.data.name ?? '').trim();
  if (!subject) return fail('subject: Nama grup wajib diisi.', 400);

  try {
    const jids = normalizeParticipants(parsed.data.participants);
    const sock = await requireOpenSocket(auth.session.id);
    const meta = await sock.groupCreate(subject, jids);
    return ok({ group: summarizeGroup(meta) }, 201);
  } catch (err) {
    return managerError('Gagal membuat grup.', err);
  }
}

export const POST = withAuth(handleCreate);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
