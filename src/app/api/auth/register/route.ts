import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createToken, generateUserApiKey, toPublicUser } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { isRegistrationEnabled } from '@/lib/server/settings';
import {
  emailSchema,
  parseJsonBody,
  passwordSchema,
  phoneSchema,
  usernameSchema,
} from '@/lib/server/validators';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().min(1, 'Nama lengkap wajib diisi.').max(255).optional(),
  fullName: z.string().min(1, 'Nama lengkap wajib diisi.').max(255).optional(),
  phone: phoneSchema.nullable().optional(),
});

async function handleRegister(req: NextRequest): Promise<Response> {
  if (!(await isRegistrationEnabled())) {
    return fail('Pendaftaran akun baru sedang dinonaktifkan oleh admin.', 403);
  }

  const parsed = await parseJsonBody(req, registerSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const fullName = (body.fullName ?? body.full_name ?? '').trim();
  if (!fullName) {
    return fail('Nama lengkap wajib diisi.', 400);
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  try {
    const apiKey = generateUserApiKey();
    const created = await prisma.user.create({
      data: {
        username: body.username.trim(),
        email: body.email.trim(),
        fullName,
        passwordHash,
        phone: body.phone === null || body.phone === '' ? null : body.phone?.trim() ?? null,
        apiKey,
        // Pendaftar publik selalu role user dan aktif.
        role: 'user',
        active: true,
      },
    });
    const token = createToken(created.id);
    return ok({ token, user: toPublicUser(created), apiKey }, 201);
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return fail('Username atau email sudah dipakai.', 409);
    }
    throw err;
  }
}

export const POST = withRateLimit(handleRegister, {
  scope: 'register',
  limit: rateLimitFromEnv('RATE_LIMIT_REGISTER', 20),
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
