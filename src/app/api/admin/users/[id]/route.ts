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

const patchUserSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  full_name: z.string().min(1).max(255).optional(),
  fullName: z.string().min(1).max(255).optional(),
  password: passwordSchema.optional(),
  phone: phoneSchema.nullable().optional(),
  avatar_url: z.string().max(65535).optional().nullable(),
  avatarUrl: z.string().max(65535).optional().nullable(),
  role: z.enum(['admin', 'user']).optional(),
  active: z.boolean().optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

async function parseId(routeCtx?: RouteCtx): Promise<number | null> {
  const raw = (await routeCtx?.params)?.id;
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export const PATCH = withAuth(async (req: NextRequest, ctx, routeCtx?: RouteCtx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const id = await parseId(routeCtx);
  if (id === null) {
    return fail('ID user tidak valid.', 400);
  }
  const parsed = await parseJsonBody(req, patchUserSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return fail('User tidak ditemukan.', 404);
  }

  const isSelf = ctx.user.id === id && ctx.user.id !== 0;
  if (isSelf) {
    if (body.role !== undefined && body.role !== 'admin') {
      return fail('Tidak boleh mencabut role admin diri sendiri.', 403);
    }
    if (body.active === false) {
      return fail('Tidak boleh menonaktifkan akun sendiri.', 403);
    }
  }

  const data: {
    username?: string;
    email?: string;
    fullName?: string;
    passwordHash?: string;
    phone?: string | null;
    avatarUrl?: string | null;
    role?: 'admin' | 'user';
    active?: boolean;
  } = {};
  if (body.username !== undefined) data.username = body.username.trim();
  if (body.email !== undefined) data.email = body.email.trim();
  const fullName = body.fullName ?? body.full_name;
  if (fullName !== undefined) {
    const trimmed = fullName.trim();
    if (!trimmed) return fail('Nama lengkap wajib diisi.', 400);
    data.fullName = trimmed;
  }
  if (body.password !== undefined) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }
  if (body.phone !== undefined) {
    data.phone = body.phone === null || body.phone === '' ? null : body.phone.trim();
  }
  const avatarUrl = body.avatarUrl !== undefined ? body.avatarUrl : body.avatar_url;
  if (avatarUrl !== undefined) {
    data.avatarUrl = avatarUrl === null || avatarUrl === '' ? null : avatarUrl;
  }
  if (body.role !== undefined) data.role = body.role;
  if (body.active !== undefined) data.active = body.active;
  if (Object.keys(data).length === 0) {
    return fail('Tidak ada field yang diubah.', 400);
  }

  try {
    const updated = await prisma.user.update({ where: { id }, data });
    return ok({ user: toPublicUser(updated) });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return fail('Username atau email sudah dipakai.', 409);
    }
    throw err;
  }
});

export const DELETE = withAuth(async (_req: NextRequest, ctx, routeCtx?: RouteCtx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const id = await parseId(routeCtx);
  if (id === null) {
    return fail('ID user tidak valid.', 400);
  }
  if (ctx.user.id === id && ctx.user.id !== 0) {
    return fail('Tidak boleh menghapus akun sendiri.', 403);
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return fail('User tidak ditemukan.', 404);
  }
  // Hapus user tidak menghapus session-nya (ownerId di-set null via SetNull).
  await prisma.user.delete({ where: { id } });
  return ok({ deleted: true });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
