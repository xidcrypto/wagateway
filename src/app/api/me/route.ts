import { NextRequest } from 'next/server';
import { z } from 'zod';
import { toPublicUser, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  emailSchema,
  parseJsonBody,
  phoneSchema,
} from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchMeSchema = z.object({
  full_name: z.string().min(1, 'Nama lengkap wajib diisi.').max(255).optional(),
  fullName: z.string().min(1, 'Nama lengkap wajib diisi.').max(255).optional(),
  email: emailSchema.optional(),
  phone: z.string().max(32, 'Nomor telepon maksimal 32 karakter.').optional().nullable(),
  avatar_url: z.string().max(65535).optional().nullable(),
  avatarUrl: z.string().max(65535).optional().nullable(),
});

export const GET = withAuth(async (_req, ctx) => {
  if (ctx.user.id === 0) {
    return fail('Akun API key tidak memiliki profil.', 404);
  }
  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!user || !user.active) {
    return fail('Belum login. Silakan login dulu.', 401);
  }
  return ok({ user: toPublicUser(user) });
});

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  if (ctx.user.id === 0) {
    return fail('Akun API key tidak memiliki profil.', 404);
  }
  const parsed = await parseJsonBody(req, patchMeSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const fullName = body.fullName ?? body.full_name;
  const avatarUrl = body.avatarUrl !== undefined ? body.avatarUrl : body.avatar_url;

  const data: {
    fullName?: string;
    email?: string;
    phone?: string | null;
    avatarUrl?: string | null;
  } = {};
  if (fullName !== undefined) data.fullName = fullName.trim();
  if (body.email !== undefined) data.email = body.email.trim();
  if (body.phone !== undefined) {
    data.phone = body.phone === null || body.phone === '' ? null : body.phone.trim();
    if (data.phone !== null) {
      const check = phoneSchema.safeParse(data.phone);
      if (!check.success) {
        return fail(check.error.issues[0]?.message ?? 'Nomor telepon tidak valid.', 400);
      }
    }
  }
  if (avatarUrl !== undefined) {
    data.avatarUrl = avatarUrl === null || avatarUrl === '' ? null : avatarUrl;
  }
  if (Object.keys(data).length === 0) {
    return fail('Tidak ada field yang diubah.', 400);
  }
  if (data.fullName !== undefined && data.fullName.length === 0) {
    return fail('Nama lengkap wajib diisi.', 400);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: ctx.user.id },
      data,
    });
    return ok({ user: toPublicUser(updated) });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return fail('Email sudah dipakai akun lain.', 409);
    }
    throw err;
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
