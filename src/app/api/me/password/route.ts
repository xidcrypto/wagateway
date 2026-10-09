import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody, passwordSchema } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const passwordChangeSchema = z.object({
  old_password: z.string().min(1, 'Password lama wajib diisi.').optional(),
  oldPassword: z.string().min(1, 'Password lama wajib diisi.').optional(),
  new_password: passwordSchema.optional(),
  newPassword: passwordSchema.optional(),
  password: passwordSchema.optional(),
});

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  if (ctx.user.id === 0) {
    return fail('Akun API key tidak bisa ganti password.', 404);
  }
  const parsed = await parseJsonBody(req, passwordChangeSchema);
  if (!parsed.ok) return parsed.response;

  const oldPassword = parsed.data.oldPassword ?? parsed.data.old_password;
  const newPassword =
    parsed.data.newPassword ?? parsed.data.new_password ?? parsed.data.password;
  if (!oldPassword) {
    return fail('Password lama wajib diisi.', 400);
  }
  if (!newPassword) {
    return fail('Password baru wajib diisi (minimal 6 karakter).', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!user || !user.active) {
    return fail('Belum login. Silakan login dulu.', 401);
  }

  const match = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!match) {
    return fail('Password lama salah.', 401);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return ok({ changed: true });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
