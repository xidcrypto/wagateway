import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { emailSchema, parseJsonBody } from '@/lib/server/validators';
import { getSmtpConfig, isSmtpConfigured, resetCodeMail, sendMail } from '@/lib/server/mailer';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const forgotSchema = z.object({
  email: emailSchema,
});

const CODE_TTL_MS = 15 * 60 * 1000; // 15 menit
const CODE_RESEND_MS = 60 * 1000; // kirim ulang minimal jeda 60 detik

function makeCode(): string {
  // 6 digit, tanpa awalan nol yang hilang (100000-999999).
  return String(crypto.randomInt(100_000, 1_000_000));
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex');
}

async function handleForgot(req: NextRequest): Promise<Response> {
  const parsed = await parseJsonBody(req, forgotSchema);
  if (!parsed.ok) return parsed.response;
  const email = parsed.data.email.trim().toLowerCase();

  // Selalu balas sukses agar tidak membocorkan email terdaftar atau tidak.
  const genericOk = () =>
    ok({ sent: true, message: 'Bila email terdaftar, kode reset sudah dikirim.' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return genericOk();
  }

  // Batasi spam: tolak bila ada kode aktif yang dibuat < 60 detik lalu.
  const recent = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      used: false,
      createdAt: { gte: new Date(Date.now() - CODE_RESEND_MS) },
    },
    orderBy: { id: 'desc' },
  });
  if (recent) {
    return fail('Kode baru saja dikirim. Tunggu sekitar 1 menit sebelum minta lagi.', 429);
  }

  const smtp = await getSmtpConfig();
  if (!isSmtpConfigured(smtp)) {
    return fail('Layanan email belum dikonfigurasi. Hubungi admin untuk mengatur SMTP.', 503);
  }

  const code = makeCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // Batalkan kode lama yang belum dipakai agar hanya satu yang valid.
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });
  await prisma.passwordReset.create({
    data: { userId: user.id, codeHash: hashCode(code), expiresAt, used: false },
  });

  try {
    const body = resetCodeMail(code);
    await sendMail({
      to: user.email,
      subject: 'Kode reset password Pansa Gateway',
      text: body.text,
      html: body.html,
    });
  } catch (err) {
    // Email gagal: tandai kode tidak valid agar tidak menggantung.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false, expiresAt },
      data: { used: true },
    });
    return fail(
      `Gagal mengirim email: ${err instanceof Error ? err.message : 'kesalahan tak dikenal'}`,
      503,
    );
  }

  return genericOk();
}

export const POST = withRateLimit(handleForgot, {
  scope: 'forgot',
  limit: rateLimitFromEnv('RATE_LIMIT_FORGOT', 10),
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
