import 'server-only';

import type { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { fail } from './response';
import { getSocket } from './session-manager';

/**
 * Helper route kirim (Fase 2, step 2.4+).
 * - Pastikan session `open` (409 bila belum) — aturan Fase 2.
 * - Normalisasi tujuan: digit saja → JID `@s.whatsapp.net`.
 */

export function normalizeTarget(to: string): { phone: string; jid: string } {
  const phone = to.replace(/\D/g, '');
  if (phone.length < 6 || phone.length > 15 || phone.startsWith('0')) {
    throw Object.assign(
      new Error('Nomor tujuan harus format internasional tanpa awalan nol (misal 62812xxxxxxx).'),
      { statusCode: 400 },
    );
  }
  return { phone, jid: `${phone}@s.whatsapp.net` };
}

/** Guard 409 bila session belum open; mengembalikan socket live. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireOpenSocket(sessionId: string): Promise<any> {
  const record = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!record) {
    throw Object.assign(new Error('Session tidak ditemukan.'), { statusCode: 404 });
  }
  const sock = getSocket(sessionId);
  if (!sock || record.status !== 'open') {
    throw Object.assign(new Error('Session belum tersambung (belum open).'), { statusCode: 409 });
  }
  return sock;
}

export function sendError(message: string, err: unknown, fallback = 500): NextResponse {
  const statusCode =
    typeof err === 'object' && err !== null && 'statusCode' in err
      ? Number((err as { statusCode: unknown }).statusCode) || fallback
      : fallback;
  return fail(err instanceof Error ? err.message : message, statusCode) as NextResponse;
}
