import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { recordOutgoing } from '@/lib/server/message-recorder';
import {
  authorizeSession,
  managerError,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { normalizeTarget, requireOpenSocket } from '@/lib/server/send-helpers';
import { parseJsonBody } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Kirim kontak (vCard). Mendukung satu kontak (object) atau banyak (array).
 * Setiap kontak minimal punya displayName + salah satu: phone, vcard penuh,
 * atau BOT-style { displayName, phone }.
 */
const oneContact = z.object({
  displayName: z.string().min(1, 'Nama kontak wajib diisi.').max(255).optional(),
  display_name: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(32).optional(),
  vcard: z.string().max(8192).optional(),
});

const contactSchema = z.object({
  to: z.string().min(1, 'Nomor tujuan wajib diisi.').max(32),
  contact: oneContact.optional(),
  contacts: z.array(oneContact).min(1, 'Minimal 1 kontak.').max(10, 'Maksimal 10 kontak.').optional(),
});

type ContactInput = z.infer<typeof oneContact>;

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

function buildVcard(c: ContactInput, index: number): { displayName: string; vcard: string } {
  const displayName = (c.displayName ?? c.display_name ?? c.name ?? '').trim() || `Kontak ${index + 1}`;
  if (c.vcard && c.vcard.includes('BEGIN:VCARD')) {
    return { displayName, vcard: c.vcard };
  }
  const phone = c.phone ? digitsOnly(c.phone) : '';
  const waId = phone !== '' ? `${phone}@s.whatsapp.net` : '';
  const vcard =
    'BEGIN:VCARD\n' +
    'VERSION:3.0\n' +
    `FN:${displayName}\n` +
    (phone !== '' ? `TEL;type=CELL;type=VOICE;waid=${phone}:${phone}\n` : '') +
    'END:VCARD';
  return { displayName, vcard: waId ? vcard : vcard };
}

async function handleSendContact(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, contactSchema);
  if (!parsed.ok) return parsed.response;

  const list: ContactInput[] = parsed.data.contacts ?? (parsed.data.contact ? [parsed.data.contact] : []);
  if (list.length === 0) {
    return fail('Sertakan contact atau contacts (minimal 1 kontak).', 400);
  }

  try {
    const { jid } = normalizeTarget(parsed.data.to);
    const sock = await requireOpenSocket(auth.session.id);

    const built = list.map((c, i) => buildVcard(c, i));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any = {
      contacts: {
        displayName: built[0]?.displayName ?? 'Kontak',
        contacts: built.map((b) => ({ displayName: b.displayName, vcard: b.vcard })),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, content)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    const names = built.map((b) => b.displayName).join(', ');
    const messageId = await recordOutgoing({
      sessionId: auth.session.id,
      waId,
      remoteJid: jid,
      msgType: built.length > 1 ? 'contactsArrayMessage' : 'contactMessage',
      textBody: names,
      status: 'sent',
    });
    return ok({ messageId, to: jid, status: 'sent' });
  } catch (err) {
    return managerError('Gagal mengirim kontak.', err);
  }
}

export const POST = withAuth(handleSendContact);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
