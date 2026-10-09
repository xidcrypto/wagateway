import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';
import { sendMail } from '@/lib/server/mailer';
import { getSiteInfo } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const testSchema = z
  .object({
    to: z.string().email('Format email tujuan tidak valid.').max(255),
  })
  .strict();

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const parsed = await parseJsonBody(req, testSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { siteName } = await getSiteInfo();
    await sendMail({
      to: parsed.data.to,
      subject: `Tes SMTP ${siteName}`,
      text: `Ini email tes dari ${siteName}. Konfigurasi SMTP berfungsi.`,
      html: `<p>Ini email tes dari ${siteName}. Konfigurasi SMTP berfungsi.</p>`,
    });
  } catch (err) {
    return fail(`Gagal mengirim email tes: ${err instanceof Error ? err.message : 'kesalahan tak dikenal'}`, 503);
  }
  return ok({ sent: true, message: 'Email tes terkirim.' });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
