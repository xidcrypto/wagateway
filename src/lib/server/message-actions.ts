import 'server-only';

import { prisma } from './prisma';

/**
 * Helper manajemen pesan (Fase 2, step 2.7).
 * - Bangun Baileys key dari baris DB + payload tersimpan.
 * - Kembalikan `{ __bytes }` (base64) menjadi Buffer untuk download/forward.
 * - Normalisasi JID tujuan (DM digit saja; grup @g.us diterima apa adanya).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValue = any;

export type ResolvedTarget = {
  row: {
    id: bigint;
    waId: string | null;
    remoteJid: string;
    direction: 'in' | 'out';
    msgType: string;
    textBody: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  key: any;
};

function bad(message: string, statusCode = 400): Error {
  return Object.assign(new Error(message), { statusCode });
}

/** Ubah `{ __bytes: base64 }` (hasil toJsonSafe) kembali menjadi Buffer. */
export function reviveBytes(value: AnyValue): AnyValue {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value)) return value.map(reviveBytes);
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === '__bytes' && typeof value.__bytes === 'string') {
      try {
        return Buffer.from(value.__bytes, 'base64');
      } catch {
        return value;
      }
    }
    const out: Record<string, AnyValue> = {};
    for (const [k, v] of Object.entries(value)) out[k] = reviveBytes(v);
    return out;
  }
  return value;
}

/** Normalisasi JID tujuan: digit → @s.whatsapp.net; grup @g.us diterima langsung. */
export function normalizeJid(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{6,15}@s\.whatsapp\.net$/.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9._=-]{1,64}@g\.us$/.test(trimmed)) return trimmed;
  const phone = trimmed.replace(/\D/g, '');
  if (phone.length >= 6 && phone.length <= 15 && !phone.startsWith('0')) {
    return `${phone}@s.whatsapp.net`;
  }
  throw bad('Tujuan harus nomor internasional tanpa awalan nol atau JID grup yang valid.');
}

/** Ambil satu baris pesan milik session; cari via id DB atau waId. */
export async function resolveTarget(
  sessionId: string,
  ref: { message_id?: string | number; wa_id?: string; remote_jid?: string },
): Promise<ResolvedTarget> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let row: any = null;
  if (ref.message_id !== undefined && ref.message_id !== null && String(ref.message_id).trim() !== '') {
    let big: bigint;
    try {
      big = BigInt(String(ref.message_id).trim());
    } catch {
      throw bad('message_id tidak valid.');
    }
    row = await prisma.message.findFirst({ where: { id: big, sessionId } });
    if (!row) throw bad('Pesan tidak ditemukan.', 404);
  } else if (ref.wa_id !== undefined && ref.wa_id !== null && String(ref.wa_id).trim() !== '') {
    const waId = String(ref.wa_id).trim();
    row = await prisma.message.findFirst({
      where: {
        sessionId,
        waId,
        ...(ref.remote_jid ? { remoteJid: String(ref.remote_jid).trim() } : {}),
      },
      orderBy: { id: 'desc' },
    });
    if (!row) throw bad('Pesan tidak ditemukan.', 404);
  } else {
    throw bad('Sertakan message_id atau wa_id.');
  }
  if (!row.waId) throw bad('Pesan tidak memiliki ID WhatsApp.');
  const storedKey = row.payload && typeof row.payload === 'object' ? row.payload.key : null;
  const key = {
    remoteJid: row.remoteJid,
    id: row.waId,
    fromMe: row.direction === 'out',
    ...(storedKey && typeof storedKey.participant === 'string'
      ? { participant: storedKey.participant }
      : {}),
  };
  return { row, key };
}

/** Bangun kembali WebMessageInfo penuh dari payload DB (bytes di-revive). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rebuildWebMessage(row: { payload: any; remoteJid: string; waId: string | null; direction: string }): any {
  const payload = row.payload;
  if (!payload || typeof payload !== 'object' || !payload.message) {
    throw bad('Payload pesan mentah tidak tersimpan untuk pesan ini.', 400);
  }
  const revived = reviveBytes({ key: payload.key, message: payload.message });
  if (!revived?.key?.id || !revived?.message) {
    throw bad('Payload pesan mentah rusak.', 400);
  }
  return revived;
}

const MEDIA_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
]);

/** Deteksi tipe media + mimetype dari WebMessageInfo yang sudah di-revive. */
export function detectMediaInfo(webMessage: AnyValue): {
  kind: string;
  mimetype: string;
  fileName: string | null;
} {
  const content = webMessage?.message;
  if (!content || typeof content !== 'object') throw bad('Pesan bukan media.', 400);
  const type = Object.keys(content)[0] as string;
  if (!type || !MEDIA_TYPES.has(type)) throw bad('Pesan bukan media yang bisa diunduh.', 400);
  const inner = content[type] ?? {};
  const mimetype =
    typeof inner.mimetype === 'string' && inner.mimetype !== ''
      ? inner.mimetype
      : type === 'stickerMessage'
        ? 'image/webp'
        : 'application/octet-stream';
  const fileName = typeof inner.fileName === 'string' ? inner.fileName : null;
  return { kind: type, mimetype, fileName };
}
