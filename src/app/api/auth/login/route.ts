import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createToken, toPublicUser } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username atau email wajib diisi.').max(255).optional(),
  username: z.string().min(1).max(32).optional(),
  email: z.string().min(1).max(255).optional(),
  password: z.string().min(1, 'Password wajib diisi.'),
});

async function handleLogin(req: NextRequest): Promise<Response> {
  const parsed = await parseJsonBody(req, loginSchema);
  if (!parsed.ok) return parsed.response;
  const { identifier, username, email, password } = parsed.data;

  const loginId = (identifier ?? username ?? email ?? '').trim();
  if (!loginId) {
    return fail('Username atau email wajib diisi.', 400);
  }

  const isEmailLookup =
    (identifier !== undefined && loginId.includes('@')) ||
    (identifier === undefined && username === undefined && email !== undefined) ||
    (identifier !== undefined && email !== undefined && identifier === email) ||
    loginId.includes('@');

  const user = isEmailLookup
    ? await prisma.user.findUnique({ where: { email: loginId } })
    : await prisma.user.findUnique({ where: { username: loginId } });

  if (!user || !user.active) {
    return fail('Username/email atau password salah.', 401);
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return fail('Username/email atau password salah.', 401);
  }

  const token = createToken(user.id);
  return ok({ token, user: toPublicUser(user) });
}

export const POST = withRateLimit(handleLogin, {
  scope: 'login',
  limit: rateLimitFromEnv('RATE_LIMIT_LOGIN', 10),
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
