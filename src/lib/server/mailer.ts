import 'server-only';

import nodemailer from 'nodemailer';
import { getSetting } from './settings';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
};

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const [host, portRaw, secureRaw, user, pass, from, fromName] = await Promise.all([
    getSetting('smtp_host'),
    getSetting('smtp_port'),
    getSetting('smtp_secure'),
    getSetting('smtp_user'),
    getSetting('smtp_pass'),
    getSetting('mail_from'),
    getSetting('mail_from_name'),
  ]);
  const port = Number.parseInt(portRaw, 10);
  const secure = secureRaw.trim().toLowerCase() === 'true' || port === 465;
  return {
    host: host.trim(),
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure,
    user: user.trim(),
    pass,
    from: from.trim(),
    fromName: fromName.trim() || 'Pansa Gateway',
  };
}

export function isSmtpConfigured(cfg: SmtpConfig): boolean {
  return cfg.host !== '' && cfg.from !== '';
}

/** Cek konfigurasi SMTP tanpa mengirim email (dipakai tombol "Tes" di panel admin). */
export async function verifySmtp(cfg?: SmtpConfig): Promise<void> {
  const config = cfg ?? (await getSmtpConfig());
  if (!isSmtpConfigured(config)) {
    throw new Error('SMTP belum dikonfigurasi. Isi host, from, dan kredensial dulu.');
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  await transporter.verify();
}

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(input: SendMailInput): Promise<void> {
  const config = await getSmtpConfig();
  if (!isSmtpConfigured(config)) {
    throw new Error('SMTP belum dikonfigurasi. Minta admin mengatur SMTP di panel admin.');
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  const fromAddr =
    config.fromName && !config.from.includes('<')
      ? `"${config.fromName}" <${config.from}>`
      : config.from;
  await transporter.sendMail({
    from: fromAddr,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resetCodeMail(code: string): { text: string; html: string } {
  const text =
    `Kode reset password Pansa Gateway Anda:\n\n${code}\n\n` +
    `Kode berlaku 15 menit. Abaikan email ini bila Anda tidak memintanya.`;
  const html =
    `<p>Kode reset password Pansa Gateway Anda:</p>` +
    `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;">${escapeHtml(code)}</p>` +
    `<p>Kode berlaku 15 menit. Abaikan email ini bila Anda tidak memintanya.</p>`;
  return { text, html };
}
