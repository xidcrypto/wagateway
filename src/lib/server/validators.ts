import 'server-only';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail } from './response';

export const usernameSchema = z
  .string()
  .min(3, 'Username minimal 3 karakter.')
  .max(32, 'Username maksimal 32 karakter.')
  .regex(/^[A-Za-z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, dan strip.');

export const passwordSchema = z.string().min(6, 'Password minimal 6 karakter.');

export const emailSchema = z.string().email('Format email tidak valid.').max(255);

export const phoneSchema = z
  .string()
  .max(32, 'Nomor telepon maksimal 32 karakter.')
  .regex(/^[0-9+()\-\s]*$/, 'Format nomor telepon tidak valid.')
  .optional();

export const sessionIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]{1,64}$/, 'ID session tidak valid.');

/** Nomor pairing: format internasional tanpa awalan nol. */
export const pairingPhoneSchema = z
  .string()
  .regex(/^[1-9][0-9]{5,17}$/, 'Nomor harus format internasional tanpa awalan nol (misal 62812xxxxxxx).');

function ipv4Octets(host: string): number[] | null {
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n < 0 || n > 255)) return null;
  return parts;
}

/** Cek literal anti-SSRF (tanpa resolve DNS). Resolve DNS + redirect dicek saat kirim (Fase 2.2). */
function isBlockedHost(hostname: string): boolean {
  const bare = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (bare === 'localhost' || bare.endsWith('.localhost')) return true;
  if (bare === '0.0.0.0' || bare === '::' || bare === '::1') return true;
  if (bare === 'metadata.google.internal') return true;
  const v4 = ipv4Octets(bare);
  if (v4) {
    const [a, b] = v4;
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  if (bare.includes(':')) {
    if (bare.startsWith('fe80:') || bare.startsWith('fec0:')) return true;
    if (bare.startsWith('fc') || bare.startsWith('fd')) return true;
    return false;
  }
  if (bare.endsWith('.internal') || bare.endsWith('.local')) return true;
  return false;
}

/**
 * Validasi URL webhook/media tahap simpan: harus http/https dan tidak
 * menunjuk ke host internal (cek literal). Mengembalikan pesan error
 * Bahasa Indonesia, atau null bila lolos. Cek DNS + redirect dilakukan
 * saat pengiriman (dispatcher webhook / media loader, Fase 2).
 */
export function validatePublicHttpUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'URL tidak valid.';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'URL harus memakai http atau https.';
  }
  if (isBlockedHost(url.hostname)) {
    return 'URL menunjuk ke alamat internal yang tidak diizinkan.';
  }
  return null;
}

export const webhookSecretSchema = z
  .string()
  .max(191, 'Secret maksimal 191 karakter.')
  .optional();

export async function parseJsonBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: fail('Body harus berupa JSON yang valid.', 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? `${first.path.join('.')}: ` : '';
    return { ok: false, response: fail(`${where}${first?.message ?? 'Input tidak valid.'}`, 400) };
  }
  return { ok: true, data: parsed.data };
}
