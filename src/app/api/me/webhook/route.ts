import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  parseJsonBody,
  validatePublicHttpUrl,
  webhookSecretSchema,
} from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const webhookSchema = z.object({
  url: z.string().max(65535).optional().nullable(),
  webhook_url: z.string().max(65535).optional().nullable(),
  webhookUrl: z.string().max(65535).optional().nullable(),
  secret: webhookSecretSchema.nullable().optional(),
  webhook_secret: webhookSecretSchema.nullable().optional(),
  webhookSecret: webhookSecretSchema.nullable().optional(),
});

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  if (ctx.user.id === 0) {
    return fail('Akun API key tidak memiliki webhook.', 404);
  }
  const parsed = await parseJsonBody(req, webhookSchema);
  if (!parsed.ok) return parsed.response;

  // Ambil alias pertama yang disertakan (undefined = tidak disertakan, jangan ubah).
  const pick = (...vals: Array<string | null | undefined>): string | null | undefined => {
    for (const v of vals) {
      if (v !== undefined) return v;
    }
    return undefined;
  };
  const rawUrl = pick(parsed.data.url, parsed.data.webhook_url, parsed.data.webhookUrl);
  const rawSecret = pick(parsed.data.secret, parsed.data.webhook_secret, parsed.data.webhookSecret);

  const webhookUrlUpdate =
    rawUrl === undefined ? {} : { webhookUrl: rawUrl === null || rawUrl === '' ? null : rawUrl.trim() };
  if (webhookUrlUpdate.webhookUrl) {
    const blocked = validatePublicHttpUrl(webhookUrlUpdate.webhookUrl);
    if (blocked) return fail(blocked, 400);
  }
  const webhookSecret =
    rawSecret === undefined ? undefined : rawSecret === null || rawSecret === '' ? null : rawSecret;

  const updated = await prisma.user.update({
    where: { id: ctx.user.id },
    data: { ...webhookUrlUpdate, ...(webhookSecret !== undefined ? { webhookSecret } : {}) },
  });
  return ok({ webhookUrl: updated.webhookUrl, hasSecret: updated.webhookSecret !== null });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
