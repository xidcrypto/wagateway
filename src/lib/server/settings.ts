import 'server-only';

import { prisma } from './prisma';

/**
 * Pengaturan sistem (tabel `system_settings`, key snake_case).
 * Nilai DB diutamakan; bila kosong, fallback ke environment.
 */

export const SETTING_KEYS = [
  'registration_enabled',
  'smtp_host',
  'smtp_port',
  'smtp_secure',
  'smtp_user',
  'smtp_pass',
  'mail_from',
  'mail_from_name',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

const ENV_FALLBACK: Record<SettingKey, string> = {
  registration_enabled: 'SMTP_REGISTRATION_ENABLED',
  smtp_host: 'SMTP_HOST',
  smtp_port: 'SMTP_PORT',
  smtp_secure: 'SMTP_SECURE',
  smtp_user: 'SMTP_USER',
  smtp_pass: 'SMTP_PASS',
  mail_from: 'MAIL_FROM',
  mail_from_name: 'MAIL_FROM_NAME',
};

const DEFAULTS: Record<SettingKey, string> = {
  registration_enabled: 'true',
  smtp_host: '',
  smtp_port: '587',
  smtp_secure: 'false',
  smtp_user: '',
  smtp_pass: '',
  mail_from: '',
  mail_from_name: 'Pansa Gateway',
};

export async function getSetting(key: SettingKey): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row && row.value !== '') return row.value;
  } catch {
    // Tabel belum termigrasi (mis. saat boot awal): pakai env/default.
  }
  const envName = ENV_FALLBACK[key];
  const fromEnv = process.env[envName];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  return DEFAULTS[key];
}

export async function getSettings(keys: readonly SettingKey[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    out[key] = await getSetting(key);
  }
  return out;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return getSettings(SETTING_KEYS);
}

export async function isRegistrationEnabled(): Promise<boolean> {
  const raw = (await getSetting('registration_enabled')).trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}
