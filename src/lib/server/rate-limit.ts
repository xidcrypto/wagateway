import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { applyCors, applySecurityHeaders } from './response';

const WINDOW_MS = 15 * 60 * 1000; // 15 menit untuk semua scope (lihat AGENTS.md no. 9)
const SWEEP_INTERVAL_MS = 60 * 1000;

type Bucket = { count: number; resetAt: number };

type RateLimitStore = {
  buckets: Map<string, Bucket>;
  lastSweep: number;
};

const globalForRateLimit = globalThis as unknown as {
  __pansaRateLimit?: RateLimitStore;
};

function getStore(): RateLimitStore {
  if (!globalForRateLimit.__pansaRateLimit) {
    globalForRateLimit.__pansaRateLimit = { buckets: new Map(), lastSweep: Date.now() };
  }
  return globalForRateLimit.__pansaRateLimit;
}

function sweepIfNeeded(store: RateLimitStore, now: number): void {
  if (now - store.lastSweep < SWEEP_INTERVAL_MS) return;
  store.lastSweep = now;
  for (const [key, bucket] of store.buckets) {
    if (bucket.resetAt <= now) store.buckets.delete(key);
  }
}

/** IP client. x-forwarded-for hanya dipercaya bila TRUST_PROXY=true. */
export function getClientIp(req: NextRequest): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
  }
  const realIp = req.headers.get('x-real-ip');
  if (process.env.TRUST_PROXY === 'true' && realIp) return realIp.trim();
  return 'direct';
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAfterSec: number;
};

export function checkRateLimit(key: string, limit: number, windowMs = WINDOW_MS): RateLimitResult {
  const store = getStore();
  const now = Date.now();
  sweepIfNeeded(store, now);

  const bucket = store.buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    resetAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function rateLimitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export type RateLimitOptions = {
  /** Prefix scope agar bucket login/pairing terpisah dari global. */
  scope: string;
  limit: number;
  windowMs?: number;
};

/**
 * Bungkus handler dengan rate limit per IP (in-memory Map + sweep).
 * Global default 1000/15 menit; login 10/15 menit; pairing 20/15 menit.
 */
export function withRateLimit<T extends NextRequest>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (req: T, routeCtx?: any) => Promise<Response> | Response,
  options: RateLimitOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (req: T, routeCtx?: any) => Promise<Response> {
  const windowMs = options.windowMs ?? WINDOW_MS;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: T, routeCtx?: any): Promise<Response> => {
    const ip = getClientIp(req);
    const result = checkRateLimit(`${options.scope}:${ip}`, options.limit, windowMs);
    if (!result.allowed) {
      const res = NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan, coba lagi nanti.' },
        {
          status: 429,
          headers: { 'Retry-After': String(result.resetAfterSec) },
        },
      );
      applySecurityHeaders(res);
      applyCors(req, res);
      return res;
    }
    const out = await handler(req, routeCtx);
    const res = out instanceof NextResponse ? out : new NextResponse(out.body, out);
    res.headers.set('X-RateLimit-Remaining', String(result.remaining));
    applySecurityHeaders(res);
    applyCors(req, res);
    return res;
  };
}
