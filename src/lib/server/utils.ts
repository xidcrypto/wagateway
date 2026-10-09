import 'server-only';

/**
 * Helper utilitas kontak/profil (Fase 3, step 3.3).
 * - Normalisasi nomor → JID PN.
 * - Validasi tipe presence, aksi block, nama/status profil.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValue = any;

function bad(message: string, statusCode = 400): Error {
  return Object.assign(new Error(message), { statusCode });
}

/** Normalisasi nomor HP menjadi JID `@s.whatsapp.net`; JID penuh diterima langsung. */
export function normalizeContact(raw: string): { phone: string; jid: string } {
  const trimmed = raw.trim();
  if (/^\d{6,15}@s\.whatsapp\.net$/.test(trimmed)) {
    return { phone: trimmed.split('@')[0], jid: trimmed };
  }
  if (/^[A-Za-z0-9._=-]{1,64}@lid$/.test(trimmed)) {
    return { phone: '', jid: trimmed };
  }
  const phone = trimmed.replace(/\D/g, '');
  if (phone.length >= 6 && phone.length <= 15 && !phone.startsWith('0')) {
    return { phone, jid: `${phone}@s.whatsapp.net` };
  }
  throw bad('Nomor tidak valid. Pakai format internasional tanpa awalan nol (misal 62812xxxxxxx).');
}

/** Tipe presence yang didukung `sendPresenceUpdate`. */
const PRESENCE_TYPES = [
  'available',
  'unavailable',
  'composing',
  'recording',
  'paused',
] as const;
export type PresenceType = (typeof PRESENCE_TYPES)[number];

export function assertPresenceType(raw: string): PresenceType {
  const t = raw.trim().toLowerCase();
  if (!(PRESENCE_TYPES as readonly string[]).includes(t)) {
    throw bad('Tipe presence tidak valid. Pilih available, unavailable, composing, recording, atau paused.');
  }
  return t as PresenceType;
}

/** Validasi nama profil WA: 1-25 karakter. */
export function assertProfileName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > 25) {
    throw bad('Nama profil wajib 1-25 karakter.');
  }
  return name;
}

/** Validasi status/about WA: maks 139 karakter. */
export function assertProfileStatus(raw: string): string {
  const status = raw.trim();
  if (status.length > 139) {
    throw bad('Status profil maksimal 139 karakter.');
  }
  return status;
}

/** Aksi block: block atau unblock. */
export function assertBlockAction(raw: string): 'block' | 'unblock' {
  const a = raw.trim().toLowerCase();
  if (a === 'block') return 'block';
  if (a === 'unblock') return 'unblock';
  throw bad('Aksi tidak valid. Pilih block atau unblock.');
}

/** Ringkas entri `onWhatsApp` menjadi bentuk aman JSON. */
export function summarizeOnWhatsApp(entry: AnyValue): Record<string, unknown> {
  if (!entry || typeof entry !== 'object') return {};
  return {
    jid: typeof entry.jid === 'string' ? entry.jid : null,
    exists: Boolean(entry.exists),
    lid: typeof entry.lid === 'string' ? entry.lid : null,
  };
}

/** Ringkas entri status `fetchStatus` (USync) menjadi bentuk aman JSON. */
export function summarizeContactStatus(entry: AnyValue): Record<string, unknown> {
  if (!entry || typeof entry !== 'object') return {};
  const status = entry.status && typeof entry.status === 'object' ? entry.status : {};
  return {
    jid: typeof entry.id === 'string' ? entry.id : null,
    status:
      typeof status.status === 'string'
        ? status.status
        : typeof entry.status === 'string'
          ? entry.status
          : null,
    setAt:
      typeof status.setAt === 'number'
        ? status.setAt
        : typeof entry.setAt === 'number'
          ? entry.setAt
          : null,
  };
}
