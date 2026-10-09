import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  SETTING_KEYS,
  getAllSettings,
  maskSecret,
  setSetting,
  type SettingKey,
} from '@/lib/server/settings';
import { parseJsonBody } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECRET_KEYS = new Set(['smtp_pass']);

const settingsSchema = z
  .object({
    registration_enabled: z.union([z.boolean(), z.string()]).optional(),
    smtp_host: z.string().max(255).optional(),
    smtp_port: z.union([z.number(), z.string()]).optional(),
    smtp_secure: z.union([z.boolean(), z.string()]).optional(),
    smtp_user: z.string().max(255).optional(),
    // Secret: string kosong = jangan ubah nilai yang tersimpan.
    smtp_pass: z.string().max(1024).optional(),
    mail_from: z.string().max(255).optional(),
    mail_from_name: z.string().max(255).optional(),
  })
  .strict();

function normalizeValue(key: SettingKey, raw: unknown): string | null {
  if (raw === undefined) return null; // tidak disertakan = jangan ubah
  if (key === 'registration_enabled' || key === 'smtp_secure') {
    if (typeof raw === 'boolean') return raw ? 'true' : 'false';
    const s = String(raw).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on' ? 'true' : 'false';
  }
  if (key === 'smtp_port') {
    const n = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n) || n < 1 || n > 65535) {
      throw new Error('Port SMTP harus angka 1-65535.');
    }
    return String(n);
  }
  return String(raw);
}

export const GET = withAuth(async (_req, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const settings = await getAllSettings();
  // Samarkan secret agar tidak bocor ke browser.
  const masked: Record<string, string> = { ...settings };
  for (const key of SECRET_KEYS) {
    masked[key] = maskSecret(settings[key] ?? '');
  }
  const smtpConfigured = (settings.smtp_host ?? '').trim() !== '' && (settings.mail_from ?? '').trim() !== '';
  return ok({ settings: masked, smtpConfigured });
});

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const parsed = await parseJsonBody(req, settingsSchema);
  if (!parsed.ok) return parsed.response;

  // Validasi mail_from bila diisi.
  const mailFrom = parsed.data.mail_from;
  if (mailFrom !== undefined && mailFrom.trim() !== '') {
    const emailCheck = z.string().email().safeParse(mailFrom.trim());
    if (!emailCheck.success) {
      return fail('mail_from: Format email tidak valid.', 400);
    }
  }

  const updated: string[] = [];
  try {
    for (const key of SETTING_KEYS) {
      const raw = (parsed.data as Record<string, unknown>)[key];
      const value = normalizeValue(key, raw);
      if (value === null) continue; // tidak disertakan
      if (SECRET_KEYS.has(key) && value === '') continue; // secret kosong = jangan ubah
      await setSetting(key, key === 'mail_from' || key === 'smtp_host' || key === 'smtp_user' ? value.trim() : value);
      updated.push(key);
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.', 400);
  }

  const settings = await getAllSettings();
  const masked: Record<string, string> = { ...settings };
  for (const key of SECRET_KEYS) {
    masked[key] = maskSecret(settings[key] ?? '');
  }
  const smtpConfigured = (settings.smtp_host ?? '').trim() !== '' && (settings.mail_from ?? '').trim() !== '';
  return ok({ updated, settings: masked, smtpConfigured });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
