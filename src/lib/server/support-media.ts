import 'server-only';

import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/server/prisma';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Batas lampiran gambar tiket. Default 10 MB, bisa diubah via env
 * SUPPORT_IMAGE_MAX_MB (mis. 5 / 20). Server tetap final — client hanya
 * cerminan untuk validasi awal.
 */
export function supportImageMaxBytes(): number {
  const raw = Number(process.env.SUPPORT_IMAGE_MAX_MB ?? '10');
  if (!Number.isFinite(raw) || raw < 1 || raw > 64) return 10 * 1024 * 1024;
  return Math.floor(raw) * 1024 * 1024;
}

/** Label batas untuk pesan error (mis. "10 MB"). */
export function supportImageMaxLabel(): string {
  const mb = Math.round(supportImageMaxBytes() / 1024 / 1024);
  return `${mb} MB`;
}

const ALLOWED: Array<{ mime: string; ext: string }> = [
  { mime: 'image/jpeg', ext: 'jpg' },
  { mime: 'image/png', ext: 'png' },
  { mime: 'image/webp', ext: 'webp' },
  { mime: 'image/gif', ext: 'gif' },
];

/**
 * Tebak tipe gambar dari magic bytes (bukan ekstensi/nama file — itu bisa
 * dipalsukan). Mengembalikan { mime, ext } atau null bila bukan gambar
 * yang diizinkan.
 */
export function sniffImage(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ALLOWED[0]!;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return ALLOWED[1]!;
  }
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return ALLOWED[2]!;
  }
  // GIF: GIF87a / GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return ALLOWED[3]!;
  }
  return null;
}

function supportDir(): string {
  return resolve(process.cwd(), process.env.MEDIA_DIR ?? './data/media', 'support');
}

/**
 * Simpan buffer gambar terverifikasi ke data/media/support/<acak>.<ext>.
 * Nama file selalu acak (tanpa nama asli user) agar tak bisa ditebak /
 * ditumpuk. Mengembalikan nama file (bukan path penuh).
 */
export async function saveSupportImage(buffer: Buffer, ext: string): Promise<string> {
  const dir = supportDir();
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}${randomBytes(8).toString('hex')}.${ext}`;
  // Nama acak hex murni — join tetap aman (tanpa .. / slash dari user).
  await writeFile(join(dir, name), buffer);
  return name;
}

/** Path absolut file lampiran; null bila nama tidak valid (cegah traversal). */
export function supportImagePath(name: string): string | null {
  if (!/^[a-z0-9]{1,64}\.(jpg|png|webp|gif)$/.test(name)) return null;
  const full = join(supportDir(), name);
  // Kunci di dalam dir support (resolve + prefix, pola media-loader).
  if (!resolve(full).startsWith(`${supportDir()}/`)) return null;
  return full;
}

/** Hapus file fisik lampiran (tak melempar bila sudah hilang). */
export async function deleteSupportImage(name: string): Promise<void> {
  const full = supportImagePath(name);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    // Sudah hilang / tak bisa dihapus; DB tetap sumber kebenaran.
  }
}

/** Umur staged file sebelum dianggap kedaluwarsa (1 jam). */
export const STAGED_FILE_TTL_MS = 60 * 60 * 1000;

/** Hapus semua staged file yang kedaluwarsa di DB + disk. */
export async function cleanExpiredStagedFiles(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STAGED_FILE_TTL_MS);
    const expired = await prisma.supportStagedFile.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, fileName: true },
    });
    for (const e of expired) {
      await deleteSupportImage(e.fileName);
      await prisma.supportStagedFile.delete({ where: { id: e.id } }).catch(() => {});
    }
  } catch (err) {
    console.error('Error cleaning expired staged files:', err);
  }
}

export function allowedImageMimes(): string[] {
  return ALLOWED.map((a) => a.mime);
}
