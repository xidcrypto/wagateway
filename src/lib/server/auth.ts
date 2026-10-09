import 'server-only';

import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { User } from '@/generated/prisma/client';
import { prisma } from './prisma';
import { applyCors, applySecurityHeaders, fail } from './response';

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  active: boolean;
};

export type AuthContext =
  | { kind: 'jwt'; user: AuthUser }
  | { kind: 'apiKey'; user: AuthUser };

const jwtPayloadSchema = z.object({
  id: z.number().int().positive(),
});

function signJwt(userId: number): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET belum disetel di environment');
  return jwt.sign({ id: userId }, secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });
}

export function createToken(userId: number): string {
  return signJwt(userId);
}

export function verifyToken(token: string): number | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET belum disetel di environment');
  try {
    const decoded = jwt.verify(token, secret);
    const parsed = jwtPayloadSchema.safeParse(decoded);
    if (!parsed.success) return null;
    return parsed.data.id;
  } catch {
    return null;
  }
}

/** Admin virtual id 0 (tidak ada di DB) untuk Master API key. */
export function virtualAdmin(): AuthUser {
  return { id: 0, username: 'master-api-key', email: '', role: 'admin', active: true };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function loadUserById(id: number): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    active: user.active,
  };
}

/** Ambil identitas dari Bearer JWT atau x-api-key (timingSafeEqual). */
export async function authenticate(req: NextRequest): Promise<AuthContext | null> {
  const apiKey = req.headers.get('x-api-key');
  const masterKey = process.env.MASTER_API_KEY;
  if (apiKey && masterKey && timingSafeEqualHex(apiKey, masterKey)) {
    return { kind: 'apiKey', user: virtualAdmin() };
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) {
      const userId = verifyToken(token);
      if (userId !== null) {
        const user = await loadUserById(userId);
        if (user) return { kind: 'jwt', user };
      }
    }
  }
  return null;
}

export function isAdmin(ctx: AuthContext): boolean {
  return ctx.user.role === 'admin';
}

export type PublicUser = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  active: boolean;
  webhookUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** User aman untuk respons API: tanpa passwordHash dan webhookSecret. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    active: user.active,
    webhookUrl: user.webhookUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Session milik user sendiri, atau semua bila admin (id 0 = admin virtual). */
export async function canAccessSession(
  ctx: AuthContext,
  sessionOwnerId: number | null,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  if (sessionOwnerId === null) return false;
  return sessionOwnerId === ctx.user.id;
}

export type AuthedHandler<T extends NextRequest = NextRequest> = (
  req: T,
  ctx: AuthContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  routeCtx?: any,
) => Promise<Response> | Response;

/**
 * Wajib login (JWT valid + user aktif di DB, atau Master API key).
 * User dimuat ulang dari DB tiap request; yang nonaktif ditolak 401.
 * routeCtx (berisi params async) diteruskan apa adanya ke handler.
 */
export function withAuth<T extends NextRequest = NextRequest>(
  handler: AuthedHandler<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (req: T, routeCtx?: any) => Promise<Response> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: T, routeCtx?: any): Promise<Response> => {
    const ctx = await authenticate(req as NextRequest);
    if (!ctx) {
      const res = fail('Belum login. Silakan login dulu.', 401) as NextResponse;
      applyCors(req as NextRequest, res);
      return res;
    }
    const out = await handler(req, ctx, routeCtx);
    const res = out instanceof NextResponse ? out : new NextResponse(out.body, out);
    applySecurityHeaders(res);
    applyCors(req as NextRequest, res);
    return res;
  };
}

/** Wajib role admin (termasuk admin virtual Master API key). */
export function requireAdmin(ctx: AuthContext): NextResponse | null {
  if (!isAdmin(ctx)) {
    return fail('Akses ditolak. Hanya admin yang boleh.', 403) as NextResponse;
  }
  return null;
}
