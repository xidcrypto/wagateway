import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { emailSchema, parseJsonBody, passwordSchema } from '@/lib/server/validators';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resetSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Kode harus 6 digit angka.'),
  password: passwordSchema,
});

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex');
}

async function handleReset(req: NextRequest): Promise<Response> {
  const parsed = await parseJsonBody(req, resetSchema);
  if (!parsed.ok) return parsed.response;
  const email = parsed.data.email.trim().toLowerCase();

  // Samakan pesan gagal agar kode tidak bisa di-bruteforce via perbedaan respons.
  const invalid = () => fail('Kode salah, kedaluwarsa, atau email tidak dikenal.', 400);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return invalid();
  }

  const record = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      codeHash: hashCode(parsed.data.code),
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { id: 'desc' },
  });
  if (!record) {
    return invalid();
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { used: true } }),
    // Sekalian hanguskan kode lain user ini agar tidak bisa dipakai ulang.
    prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    }),
  ]);

  return ok({ reset: true, message: 'Password berhasil diubah. Silakan login.' });
}

export const POST = withRateLimit(handleReset, {
  scope: 'reset',
  limit: rateLimitFromEnv('RATE_LIMIT_RESET', 10),
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
