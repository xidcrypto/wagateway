import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

/**
 * Mengonversi BigInt menjadi string secara rekursif agar aman di-JSON.stringify.
 * Prisma memakai BigInt untuk messages.id; tanpa ini respons akan error.
 */
export function serializeBigInt<T>(value: T): T {
  if (typeof value === 'bigint') {
    return String(value) as unknown as T;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeBigInt(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serializeBigInt(item);
    }
    return out as unknown as T;
  }
  return value;
}

export function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return res;
}

function allowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Menempelkan header CORS bila Origin request ada di daftar izin. */
export function applyCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get('origin');
  if (!origin) return res;
  if (allowedOrigins().includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-api-key',
    );
    res.headers.set('Access-Control-Max-Age', '86400');
  }
  return res;
}

/**
 * Jawaban preflight OPTIONS. Kembalikan respons ini langsung bila tidak null.
 * Dipakai di tiap route yang dibungkus withAuth/withRateLimit? Tidak — cukup
 * panggil di handler OPTIONS tiap route yang butuh CORS lintas origin.
 */
export function handlePreflight(req: NextRequest): NextResponse | null {
  if (req.method !== 'OPTIONS') return null;
  const res = new NextResponse(null, { status: 204 });
  applySecurityHeaders(res);
  applyCors(req, res);
  return res;
}

/** Respons sukses: { success: true, data }. */
export function ok<T>(data: T, status = 200): NextResponse {
  const res = NextResponse.json(
    { success: true, data: serializeBigInt(data) },
    { status },
  );
  return applySecurityHeaders(res);
}

/** Respons gagal: { success: false, error }. */
export function fail(message: string, status = 400): NextResponse {
  const res = NextResponse.json({ success: false, error: message }, { status });
  return applySecurityHeaders(res);
}
