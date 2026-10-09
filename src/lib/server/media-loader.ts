import 'server-only';

import { promises as dns } from 'node:dns';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve, sep } from 'node:path';

/**
 * Media loader (Fase 2, step 2.1) sesuai aturan global no. 11:
 * - Input boleh: URL http/https, base64 data URI, atau path lokal.
 * - Hanya http/https; tolak localhost, IP privat, loopback, link-local.
 * - Cek ulang SETELAH resolve DNS dan TIAP redirect (maks 3 redirect).
 * - Path lokal harus di dalam MEDIA_DIR (resolve + cek prefix, tolak traversal).
 * - Batas ukuran default 64 MB (MAX_MEDIA_MB).
 *
 * Output: { buffer, mimeType, size } siap dikirim via Baileys.
 */

export type LoadedMedia = {
  buffer: Buffer;
  mimeType: string;
  size: number;
  source: 'url' | 'data-uri' | 'local';
};

export class MediaError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'MediaError';
    this.statusCode = statusCode;
  }
}

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

/** Batas ukuran byte dari env MAX_MEDIA_MB (default 64 MB). */
export function maxMediaBytes(): number {
  const raw = process.env.MAX_MEDIA_MB;
  const mb = raw ? Number.parseInt(raw, 10) : 64;
  const safe = Number.isFinite(mb) && mb > 0 ? mb : 64;
  return safe * 1024 * 1024;
}

export function mediaDir(): string {
  return resolve(process.cwd(), process.env.MEDIA_DIR ?? './data/media');
}

function ipv4Blocked(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 (CGNAT), 192.0.0.0/24, 198.18.0.0/15 (benchmark), 203.0.113.0/24 dkk (TEST-NET).
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && (b === 0 || b === 18 || b === 19)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 203 && b === 0 && octets[2] === 113) return true;
  if (a === 192 && b === 88 && octets[2] === 99) return true;
  if (a === 192 && b === 175 && octets[2] === 48) return true;
  if (a === 192 && b === 31 && octets[2] === 196) return true;
  return false;
}

function ipv6Blocked(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  // fe80::/10 link-local, fc00::/7 unique-local, ::ffff:0:0/96 mapped.
  if (lower.startsWith('fe80:') || lower.startsWith('fe90:') || lower.startsWith('fea0:') || lower.startsWith('feb0:')) return true;
  if (lower.startsWith('fec0:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    const v4part = lower.slice('::ffff:'.length);
    const octets = v4part.split('.').map(Number);
    if (octets.length === 4 && octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      return ipv4Blocked(octets);
    }
    return true;
  }
  // 64:ff9b::/96 translasi, 100::/64 discard, 2001:db8::/32 dokumentasi, ::/128.
  if (lower.startsWith('64:ff9b:')) return true;
  if (lower.startsWith('0100:') || lower === '100::') return true;
  if (lower.startsWith('2001:db8:')) return true;
  if (/^::$/.test(lower)) return true;
  return false;
}

/** True bila IP literal termasuk privat/loopback/link-local/dicadangkan. */
export function isBlockedIp(ip: string): boolean {
  const bare = ip.replace(/^\[(.*)\]$/, '$1');
  const kind = isIP(bare);
  if (kind === 4) {
    const octets = bare.split('.').map(Number);
    return ipv4Blocked(octets);
  }
  if (kind === 6) return ipv6Blocked(bare);
  return false;
}

function isBlockedHostnameLiteral(hostname: string): boolean {
  const bare = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (bare === 'localhost' || bare.endsWith('.localhost')) return true;
  if (bare === '0.0.0.0' || bare === '::' || bare === '::1') return true;
  if (bare === 'metadata.google.internal') return true;
  if (bare === 'metadata.google.com') return true;
  if (bare === 'instance-data' || bare === 'instance-data-compute' || bare === 'metadata') return true;
  if (bare.endsWith('.internal') || bare.endsWith('.local') || bare.endsWith('.lan')) return true;
  if (bare.endsWith('.nip.io') || bare.endsWith('.sslip.io')) return true;
  if (isIP(bare) !== 0) return isBlockedIp(bare);
  // Heksadesimal / oktal IPv4 (mis. 0x7f.0x0.0x0.0x1) — tolak pola numerik.
  if (/^[0-9xXa-fA-F.]+$/.test(bare) && bare.includes('.')) {
    const parts = bare.split('.');
    if (parts.length === 4 && parts.every((p) => /^0[xX][0-9a-fA-F]+$|^0[0-7]*$|^[0-9]+$/.test(p))) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve hostname ke semua alamat IP lalu pastikan TIDAK ADA satu pun
 * yang internal (anti DNS-rebinding: satu IP jahat di antara yang baik
 * tetap ditolak).
 */
async function assertDnsClean(hostname: string): Promise<void> {
  const bare = hostname.replace(/^\[(.*)\]$/, '$1');
  if (isIP(bare) !== 0) {
    if (isBlockedIp(bare)) {
      throw new MediaError('URL menunjuk ke alamat internal yang tidak diizinkan.', 400);
    }
    return;
  }
  let records: string[];
  try {
    records = await dns.resolve(bare);
  } catch {
    throw new MediaError('Hostname tidak bisa di-resolve. Periksa URL media.', 400);
  }
  // Coba juga AAAA agar hostname IPv6-only ikut diperiksa.
  try {
    const v6 = await dns.resolve6(bare);
    records = [...records, ...v6];
  } catch {
    // Abaikan bila tidak ada record AAAA.
  }
  if (records.length === 0) {
    throw new MediaError('Hostname tidak memiliki alamat IP.', 400);
  }
  for (const ip of records) {
    if (isBlockedIp(ip)) {
      throw new MediaError('URL menunjuk ke alamat internal yang tidak diizinkan.', 400);
    }
  }
}

function validateUrlLiteral(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MediaError('URL media tidak valid.', 400);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new MediaError('URL media harus memakai http atau https.', 400);
  }
  if (url.username !== '' || url.password !== '') {
    throw new MediaError('URL media tidak boleh memuat kredensial.', 400);
  }
  if (isBlockedHostnameLiteral(url.hostname)) {
    throw new MediaError('URL menunjuk ke alamat internal yang tidak diizinkan.', 400);
  }
  return url;
}

async function fetchWithGuards(startUrl: URL, limit: number): Promise<{ buffer: Buffer; mimeType: string }> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // Cek ulang SETELAH resolve DNS dan TIAP redirect.
    await assertDnsClean(current.hostname);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      // redirect manual agar tiap hop bisa divalidasi ulang.
      res = await fetch(current.toString(), { signal: ctrl.signal, redirect: 'manual' });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new MediaError('Unduhan media timeout (15 detik).', 400);
      }
      throw new MediaError(`Gagal mengunduh media: ${err instanceof Error ? err.message : 'kesalahan jaringan'}.`, 400);
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      if (hop >= MAX_REDIRECTS) {
        throw new MediaError('Terlalu banyak redirect (maksimal 3).', 400);
      }
      const loc = res.headers.get('location');
      try {
        await res.arrayBuffer();
      } catch {
        // Abaikan body redirect.
      }
      if (!loc) throw new MediaError('Redirect tanpa header Location.', 400);
      let next: URL;
      try {
        next = new URL(loc, current.toString());
      } catch {
        throw new MediaError('URL redirect tidak valid.', 400);
      }
      if (next.protocol !== 'http:' && next.protocol !== 'https:') {
        throw new MediaError('Redirect ke protokol yang tidak diizinkan.', 400);
      }
      if (next.username !== '' || next.password !== '') {
        throw new MediaError('URL redirect tidak boleh memuat kredensial.', 400);
      }
      if (isBlockedHostnameLiteral(next.hostname)) {
        throw new MediaError('URL redirect menunjuk ke alamat internal yang tidak diizinkan.', 400);
      }
      current = next;
      continue;
    }

    if (!res.ok) {
      throw new MediaError(`Server media menjawab HTTP ${res.status}.`, 400);
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength !== null) {
      const len = Number.parseInt(contentLength, 10);
      if (Number.isFinite(len) && len > limit) {
        try {
          await res.arrayBuffer();
        } catch {
          // Abaikan.
        }
        throw new MediaError(
          `Media kebesaran (maksimal ${Math.round(limit / 1024 / 1024)} MB).`,
          413,
        );
      }
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = res.body?.getReader();
    if (!reader) {
      throw new MediaError('Respons media tidak memiliki body.', 400);
    }
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        try {
          await reader.cancel();
        } catch {
          // Abaikan.
        }
        throw new MediaError(
          `Media kebesaran (maksimal ${Math.round(limit / 1024 / 1024)} MB).`,
          413,
        );
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const mimeType =
      res.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
    return { buffer, mimeType };
  }
  throw new MediaError('Terlalu banyak redirect (maksimal 3).', 400);
}

const DATA_URI_RE = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/;

function loadDataUri(raw: string, limit: number): LoadedMedia {
  const m = raw.match(DATA_URI_RE);
  if (!m) throw new MediaError('Data URI tidak valid.', 400);
  const mimeType = (m[1] || 'application/octet-stream').trim();
  const isBase64 = m[2] === ';base64';
  const payload = m[3] ?? '';
  if (mimeType !== '' && !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mimeType)) {
    throw new MediaError('Tipe MIME data URI tidak valid.', 400);
  }
  let buffer: Buffer;
  try {
    buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
  } catch {
    throw new MediaError('Data URI tidak bisa di-decode.', 400);
  }
  if (buffer.byteLength === 0) throw new MediaError('Data URI kosong.', 400);
  if (buffer.byteLength > limit) {
    throw new MediaError(
      `Media kebesaran (maksimal ${Math.round(limit / 1024 / 1024)} MB).`,
      413,
    );
  }
  return { buffer, mimeType: mimeType || 'application/octet-stream', size: buffer.byteLength, source: 'data-uri' };
}

async function loadLocalFile(raw: string, limit: number): Promise<LoadedMedia> {
  const base = mediaDir();
  const resolved = resolve(base, raw);
  // Resolve + cek prefix (termasuk separator) → tolak traversal & symlink keluar.
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new MediaError('Path lokal di luar folder media yang diizinkan.', 400);
  }
  if (!existsSync(resolved)) {
    throw new MediaError('File lokal tidak ditemukan.', 400);
  }
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(resolved);
  } catch {
    throw new MediaError('File lokal tidak bisa dibaca.', 400);
  }
  if (!stat.isFile()) {
    throw new MediaError('Path lokal bukan file.', 400);
  }
  if (stat.size > limit) {
    throw new MediaError(
      `Media kebesaran (maksimal ${Math.round(limit / 1024 / 1024)} MB).`,
      413,
    );
  }
  const buffer = await readFile(resolved);
  if (buffer.byteLength > limit) {
    throw new MediaError(
      `Media kebesaran (maksimal ${Math.round(limit / 1024 / 1024)} MB).`,
      413,
    );
  }
  return { buffer, mimeType: guessMime(resolved), size: buffer.byteLength, source: 'local' };
}

function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
    case 'oga':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'opus':
      return 'audio/ogg';
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'vcf':
      return 'text/vcard';
    default:
      return 'application/octet-stream';
  }
}

export type LoadMediaInput =
  | { url: string; maxBytes?: number }
  | { dataUri: string; maxBytes?: number }
  | { path: string; maxBytes?: number }
  | { media: string; maxBytes?: number };

/**
 * Muat satu media dari URL / data URI / path lokal.
 * Bentuk generik `{ media }` menebak jenis dari prefix string.
 */
export async function loadMedia(input: LoadMediaInput): Promise<LoadedMedia> {
  const limit = input.maxBytes ?? maxMediaBytes();
  if ('url' in input) {
    const url = validateUrlLiteral(input.url);
    const { buffer, mimeType } = await fetchWithGuards(url, limit);
    return { buffer, mimeType, size: buffer.byteLength, source: 'url' };
  }
  if ('dataUri' in input) {
    return loadDataUri(input.dataUri, limit);
  }
  if ('path' in input) {
    return loadLocalFile(input.path, limit);
  }
  const raw = input.media.trim();
  if (/^data:/i.test(raw)) return loadDataUri(raw, limit);
  if (/^https?:\/\//i.test(raw)) {
    const url = validateUrlLiteral(raw);
    const { buffer, mimeType } = await fetchWithGuards(url, limit);
    return { buffer, mimeType, size: buffer.byteLength, source: 'url' };
  }
  return loadLocalFile(raw, limit);
}

/** Skema zod untuk field media di route kirim (string tunggal). */
export function isMediaString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validasi URL tahap kirim (dipakai webhook + media): parse, cek literal,
 * lalu cek DNS. Mengembalikan URL yang sudah divalidasi tahap awal.
 * Redirect per-hop tetap wajib dicek ulang oleh pemanggil.
 */
export async function assertSafeDeliveryUrl(raw: string, label: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MediaError(`URL ${label} tidak valid.`, 400);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new MediaError(`URL ${label} harus memakai http atau https.`, 400);
  }
  if (url.username !== '' || url.password !== '') {
    throw new MediaError(`URL ${label} tidak boleh memuat kredensial.`, 400);
  }
  if (isBlockedHostnameLiteral(url.hostname)) {
    throw new MediaError(`URL ${label} menunjuk ke alamat internal yang tidak diizinkan.`, 400);
  }
  try {
    await assertDnsClean(url.hostname);
  } catch (err) {
    if (err instanceof MediaError) {
      throw new MediaError(err.message.replace('media', label), err.statusCode);
    }
    throw err;
  }
  return url;
}
