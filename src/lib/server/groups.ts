import 'server-only';

/**
 * Helper grup inti (Fase 3, step 3.1).
 * - Validasi JID grup, normalisasi nomor peserta → JID PN.
 * - Ringkas metadata Baileys (BigInt-aman, tanpa field biner).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValue = any;

function bad(message: string, statusCode = 400): Error {
  return Object.assign(new Error(message), { statusCode });
}

const GROUP_JID_RE = /^[A-Za-z0-9._=-]{1,64}@g\.us$/;

/** Validasi JID grup `@g.us`. */
export function assertGroupJid(raw: string): string {
  const jid = raw.trim();
  if (!GROUP_JID_RE.test(jid)) {
    throw bad('JID grup tidak valid (contoh: 62812xxxx-1234567890@g.us).');
  }
  return jid;
}

/** Normalisasi satu nomor peserta menjadi JID `@s.whatsapp.net`; JID penuh diterima langsung. */
export function normalizeParticipant(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{6,15}@s\.whatsapp\.net$/.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9._=-]{1,64}@(s\.whatsapp\.net|lid)$/.test(trimmed)) return trimmed;
  const phone = trimmed.replace(/\D/g, '');
  if (phone.length >= 6 && phone.length <= 15 && !phone.startsWith('0')) {
    return `${phone}@s.whatsapp.net`;
  }
  throw bad(`Nomor peserta tidak valid: ${raw}. Pakai format internasional tanpa awalan nol.`);
}

/** Normalisasi daftar peserta: digit saja, duplikat dibuang, minimal 1. */
export function normalizeParticipants(list: string[]): string[] {
  if (!Array.isArray(list) || list.length === 0) {
    throw bad('Daftar peserta wajib diisi (minimal 1 nomor).');
  }
  const mapped = list.map((p) => normalizeParticipant(String(p)));
  return [...new Set(mapped)];
}

/** Ringkas metadata grup Baileys menjadi bentuk aman JSON. */
export function summarizeGroup(meta: AnyValue): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {};
  const participants = Array.isArray(meta.participants)
    ? meta.participants.map((p: AnyValue) => ({
      id: typeof p?.id === 'string' ? p.id : null,
      phoneNumber: typeof p?.phoneNumber === 'string' ? p.phoneNumber : null,
      admin: typeof p?.admin === 'string' ? p.admin : null,
    }))
    : [];
  return {
    id: typeof meta.id === 'string' ? meta.id : null,
    subject: typeof meta.subject === 'string' ? meta.subject : null,
    desc: typeof meta.desc === 'string' ? meta.desc : null,
    owner: typeof meta.owner === 'string' ? meta.owner : null,
    creation: typeof meta.creation === 'number' ? meta.creation : null,
    size: typeof meta.size === 'number' ? meta.size : participants.length,
    restrict: Boolean(meta.restrict),
    announce: Boolean(meta.announce),
    joinApprovalMode: Boolean(meta.joinApprovalMode),
    memberAddMode: Boolean(meta.memberAddMode),
    ephemeralDuration: typeof meta.ephemeralDuration === 'number' ? meta.ephemeralDuration : null,
    participants,
  };
}

/** Durasi ephemeral valid WA (detik): 0=mati, 86400=24 jam, 604800=7 hari, 7776000=90 hari. */
export const EPHEMERAL_DURATIONS = [0, 86400, 604800, 7776000] as const;

export function assertEphemeralDuration(raw: number): number {
  const allowed: number[] = [...EPHEMERAL_DURATIONS];
  if (!allowed.includes(raw)) {
    throw bad('Durasi ephemeral tidak valid. Pilih 0 (mati), 86400, 604800, atau 7776000 detik.');
  }
  return raw;
}

/** Kode invite grup: alfanumerik, biasanya 20-24 karakter. */
const INVITE_CODE_RE = /^[A-Za-z0-9]{10,32}$/;

export function assertInviteCode(raw: string): string {
  const code = raw.trim();
  if (!INVITE_CODE_RE.test(code)) {
    throw bad('Kode invite tidak valid.');
  }
  return code;
}

/** Ekstrak kode dari link invite `chat.whatsapp.com/<kode>` atau terima kode mentah. */
export function extractInviteCode(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,32})/i);
  if (m) return m[1];
  if (trimmed.includes('/') || trimmed.includes(' ')) {
    throw bad('Link invite tidak valid (contoh: https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv).');
  }
  return assertInviteCode(trimmed);
}

/** Setting grup yang didukung `groupSettingUpdate`: `announcement` (hanya admin kirim) atau `locked` (hanya admin ubah info). Pasangannya `not_announcement` / `unlocked`. */
const GROUP_SETTINGS = ['announcement', 'not_announcement', 'locked', 'unlocked'] as const;
export type GroupSetting = (typeof GROUP_SETTINGS)[number];

export function assertGroupSetting(raw: string): GroupSetting {
  const s = raw.trim();
  if (!(GROUP_SETTINGS as readonly string[]).includes(s)) {
    throw bad('Setting tidak valid. Pilih announcement, not_announcement, locked, atau unlocked.');
  }
  return s as GroupSetting;
}

/** Aksi peserta grup: add, remove, promote, demote. */
const PARTICIPANT_ACTIONS = ['add', 'remove', 'promote', 'demote'] as const;
export type ParticipantAction = (typeof PARTICIPANT_ACTIONS)[number];

export function assertParticipantAction(raw: string): ParticipantAction {
  const a = raw.trim().toLowerCase();
  if (!(PARTICIPANT_ACTIONS as readonly string[]).includes(a)) {
    throw bad('Aksi tidak valid. Pilih add, remove, promote, atau demote.');
  }
  return a as ParticipantAction;
}

/** Aksi join-request: approve atau reject (dipetakan ke `approve`/`reject` Baileys). */
export function assertJoinRequestAction(raw: string): 'approve' | 'reject' {
  const a = raw.trim().toLowerCase();
  if (a === 'approve') return 'approve';
  if (a === 'reject') return 'reject';
  throw bad('Aksi tidak valid. Pilih approve atau reject.');
}

/** Ambil digit dari JID (`id@server`) atau nomor mentah. */
export function digitsOfJid(jid: string): string {
  const at = jid.indexOf('@');
  const local = at >= 0 ? jid.slice(0, at) : jid;
  return local.replace(/\D/g, '');
}

/**
 * Petakan digit → id aktual peserta dari metadata grup.
 * Grup baru memakai addressing LID: peserta tercatat sebagai `@lid`
 * dengan `phoneNumber` PN terpisah, dan operasi anggota wajib memakai LID.
 */
export function buildParticipantJidMap(meta: AnyValue): Map<string, string> {
  const map = new Map<string, string>();
  const list = Array.isArray(meta?.participants) ? meta.participants : [];
  for (const p of list) {
    const id = typeof p?.id === 'string' ? p.id : '';
    if (!id) continue;
    const pn = typeof p?.phoneNumber === 'string' ? p.phoneNumber : '';
    const dPn = digitsOfJid(pn);
    if (dPn) map.set(dPn, id);
    const dId = digitsOfJid(id);
    if (dId) map.set(dId, id);
  }
  return map;
}

/** Resolve daftar JID peserta ke bentuk aktual di grup (LID bila grup memakai LID). Tak dikenal → apa adanya (untuk aksi add). */
export function resolveGroupParticipantJids(meta: AnyValue, jids: string[]): string[] {
  const map = buildParticipantJidMap(meta);
  return jids.map((j) => map.get(digitsOfJid(j)) ?? j);
}
