import { NextRequest } from 'next/server';
import { generateUserApiKey, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API key per user (format `pn-` + 32 hex) untuk integrasi sistem luar
 * via header `x-api-key`. Key tampil penuh HANYA saat dibuat/rotasi;
 * GET hanya memberi tahu ada/tidaknya (tanpa nilai mentah).
 */
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  if (ctx.user.id === 0) {
    return fail('Akun API key tidak memiliki API key sendiri.', 404);
  }
  const user = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: { apiKey: true },
  });
  if (!user) {
    return fail('Belum login. Silakan login dulu.', 401);
  }
  const key = user.apiKey;
  return ok({
    hasApiKey: Boolean(key),
    // 4 karakter terakhir sebagai petunjuk (tidak membocorkan key penuh).
    hint: key ? `••••${key.slice(-4)}` : null,
  });
});

export const POST = withAuth(async (_req: NextRequest, ctx) => {
  if (ctx.user.id === 0) {
    return fail('Akun API key tidak memiliki API key sendiri.', 404);
  }
  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!user || !user.active) {
    return fail('Belum login. Silakan login dulu.', 401);
  }
  if (user.apiKey) {
    return fail('API key sudah ada. Pakai PUT untuk rotasi (ganti baru).', 409);
  }
  const apiKey = generateUserApiKey();
  await prisma.user.update({ where: { id: ctx.user.id }, data: { apiKey } });
  return ok({ apiKey, rotated: false }, 201);
});

export const PUT = withAuth(async (_req: NextRequest, ctx) => {
  if (ctx.user.id === 0) {
    return fail('Akun API key tidak memiliki API key sendiri.', 404);
  }
  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!user || !user.active) {
    return fail('Belum login. Silakan login dulu.', 401);
  }
  const apiKey = generateUserApiKey();
  await prisma.user.update({ where: { id: ctx.user.id }, data: { apiKey } });
  // Rotasi: key lama langsung mati.
  return ok({ apiKey, rotated: true });
});

export const DELETE = withAuth(async (_req: NextRequest, ctx) => {
  if (ctx.user.id === 0) {
    return fail('Akun API key tidak memiliki API key sendiri.', 404);
  }
  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!user || !user.active) {
    return fail('Belum login. Silakan login dulu.', 401);
  }
  await prisma.user.update({ where: { id: ctx.user.id }, data: { apiKey: null } });
  return ok({ deleted: true });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
