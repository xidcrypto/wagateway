import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAdmin, toPublicUser, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  emailSchema,
  parseJsonBody,
  passwordSchema,
  phoneSchema,
  usernameSchema,
} from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  full_name: z.string().min(1, 'Nama lengkap wajib diisi.').max(255).optional(),
  fullName: z.string().min(1, 'Nama lengkap wajib diisi.').max(255).optional(),
  password: passwordSchema,
  phone: phoneSchema.nullable().optional(),
  avatar_url: z.string().max(65535).optional().nullable(),
  avatarUrl: z.string().max(65535).optional().nullable(),
  role: z.enum(['admin', 'user']).optional(),
  active: z.boolean().optional(),
});

export const GET = withAuth(async (_req, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  return ok({ users: users.map(toPublicUser) });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const parsed = await parseJsonBody(req, createUserSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const fullName = (body.fullName ?? body.full_name ?? '').trim();
  if (!fullName) {
    return fail('Nama lengkap wajib diisi.', 400);
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  try {
    const created = await prisma.user.create({
      data: {
        username: body.username.trim(),
        email: body.email.trim(),
        fullName,
        passwordHash,
        phone: body.phone === null || body.phone === '' ? null : body.phone?.trim() ?? null,
        avatarUrl: body.avatarUrl ?? body.avatar_url ?? null,
        role: body.role ?? 'user',
        active: body.active ?? true,
      },
    });
    return ok({ user: toPublicUser(created) }, 201);
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return fail('Username atau email sudah dipakai.', 409);
    }
    throw err;
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
