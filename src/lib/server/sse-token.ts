import 'server-only';

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const SSE_TOKEN_TTL_MS = 60_000; // 1 menit: cukup untuk membuka stream.
const SSE_TOKEN_SKEW_MS = 30_000; // toleransi jam saat verifikasi.

type SseTokenPayload = {
  /** id user pemilik stream. */
  sub: number;
  /** tujuan token (hanya 'sse'). */
  aud: 'sse';
  /** diterbitkan pada (ms epoch). */
  iatMs: number;
  /** kedaluwarsa (ms epoch). */
  expMs: number;
  /** nonce acak anti-replay lintas penerbitan. */
  jti: string;
};

function sseSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET belum disetel di environment');
  // Domain terpisah dari JWT login via aud + prefix berbeda.
  return `sse:${secret}`;
}

function b64urlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function b64urlDecode<T>(raw: string): T | null {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/**
 * Terbitkan token SSE sekali-pakai ber-TTL pendek (±1 menit).
 * Token ini HANYA berlaku untuk GET /api/events/stream via ?token=,
 * bukan JWT login 7-hari — jadi bila bocor ke log/proxy, jendelanya kecil.
 */
export function issueSseToken(userId: number): { token: string; expiresIn: number } {
  const now = Date.now();
  const payload: SseTokenPayload = {
    sub: userId,
    aud: 'sse',
    iatMs: now,
    expMs: now + SSE_TOKEN_TTL_MS,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const body = b64urlEncode(payload);
  const sig = crypto.createHmac('sha256', sseSecret()).update(body).digest('base64url');
  return { token: `${body}.${sig}`, expiresIn: Math.round(SSE_TOKEN_TTL_MS / 1000) };
}

/** Verifikasi token SSE; kembalikan id user bila valid, null bila tidak. */
export function verifySseToken(token: string): number | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', sseSecret()).update(body).digest();
  let got: Buffer;
  try {
    got = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  const payload = b64urlDecode<SseTokenPayload>(body);
  if (!payload || payload.aud !== 'sse') return null;
  if (!Number.isInteger(payload.sub) || payload.sub <= 0) return null;
  const now = Date.now();
  if (payload.expMs < now - SSE_TOKEN_SKEW_MS) return null; // kedaluwarsa.
  if (payload.iatMs > now + SSE_TOKEN_SKEW_MS) return null; // dari masa depan.
  return payload.sub;
}

/** Payload JWT login versi ringan (tanpa verifikasi signature di sini). */
export function decodeJwtSub(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as { id?: unknown } | null;
    if (decoded && typeof decoded.id === 'number' && Number.isInteger(decoded.id) && decoded.id > 0) {
      return decoded.id;
    }
    return null;
  } catch {
    return null;
  }
}
