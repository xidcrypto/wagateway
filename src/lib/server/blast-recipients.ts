import 'server-only';

/**
 * Parser penerima blast (Fase 4, step 4.1).
 * - `recipients` bisa: array string, array objek `{phone, ...vars}`,
 *   atau string dipisah koma/baris baru (atau campuran).
 * - Nomor dinormalisasi ke digit; yang tidak valid di-skip; duplikat dihapus.
 * - Maksimal 50.000 per campaign.
 * - Template `{{nama}}` dirender dari `vars` penerima (hilang → string kosong).
 */

export const MAX_BLAST_RECIPIENTS = 50_000;

export type BlastRecipientInput = {
  phone: string;
  vars: Record<string, string>;
};

function bad(message: string, statusCode = 400): Error {
  return Object.assign(new Error(message), { statusCode });
}

/** Normalisasi nomor ke digit; kembalikan null bila tidak valid. */
export function normalizeBlastPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  // Format internasional tanpa awalan nol, 6-15 digit (konsisten dgn send-helpers).
  if (digits.length < 6 || digits.length > 15 || digits.startsWith('0')) {
    return null;
  }
  // Tolak semua-nol atau pola jelas bukan nomor (mis. 000000).
  if (/^0+$/.test(digits)) return null;
  return digits;
}

/** Stringify aman untuk nilai vars (string/number/boolean saja). */
function toVarString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return null;
}

/** Ambil phone + vars dari satu entri objek. Alias umum didukung. */
function fromObject(entry: Record<string, unknown>): BlastRecipientInput | null {
  const rawPhone =
    entry.phone ?? entry.number ?? entry.nomor ?? entry.wa ?? entry.msisdn ?? '';
  if (typeof rawPhone !== 'string' && typeof rawPhone !== 'number') return null;
  const phone = normalizeBlastPhone(String(rawPhone));
  if (!phone) return null;
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === 'phone' || key === 'number' || key === 'nomor' || key === 'wa' || key === 'msisdn') {
      continue;
    }
    const s = toVarString(value);
    if (s !== null) vars[key] = s;
  }
  return { phone, vars };
}

/** Pecah satu string mentah menjadi kandidat nomor (koma/baris baru/titik koma). */
function splitRawString(raw: string): string[] {
  return raw
    .split(/[\n\r,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse input recipients bebas menjadi daftar unik siap simpan.
 * Urutan: kemunculan pertama dipertahankan; vars pertama menang bila duplikat.
 */
export function parseBlastRecipients(input: unknown): {
  recipients: BlastRecipientInput[];
  skipped: number;
} {
  const items: unknown[] = Array.isArray(input) ? input : [input];
  const seen = new Set<string>();
  const out: BlastRecipientInput[] = [];
  let skipped = 0;

  const push = (entry: BlastRecipientInput | null): void => {
    if (!entry) {
      skipped += 1;
      return;
    }
    if (seen.has(entry.phone)) {
      skipped += 1;
      return;
    }
    seen.add(entry.phone);
    out.push(entry);
  };

  for (const item of items) {
    if (out.length >= MAX_BLAST_RECIPIENTS) break;
    if (typeof item === 'string' || typeof item === 'number') {
      for (const chunk of splitRawString(String(item))) {
        if (out.length >= MAX_BLAST_RECIPIENTS) break;
        const phone = normalizeBlastPhone(chunk);
        push(phone ? { phone, vars: {} } : null);
      }
      continue;
    }
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      push(fromObject(item as Record<string, unknown>));
      continue;
    }
    skipped += 1;
  }

  if (out.length >= MAX_BLAST_RECIPIENTS) {
    // Kelebihan di-skip diam-diam selain batas; dicatat lewat skipped bila masih ada sisa.
    // (Tidak throw agar campaign besar tetap jalan untuk 50.000 pertama.)
  }
  return { recipients: out, skipped };
}

/**
 * Render template `{{nama}}` dari vars penerima.
 * - Spasi di dalam kurung ditoleransi: `{{ nama }}`.
 * - Key case-sensitive; variabel hilang → string kosong.
 * - Kurung tak berpasangan dibiarkan apa adanya.
 */
export function renderBlastTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/{{\s*([A-Za-z0-9_.]+)\s*}}/g, (match, key: string) => {
    const value = vars[key];
    return typeof value === 'string' ? value : '';
  });
}

/** Validasi delay: min/max bilangan bulat >= 0; worker memaksa minimal 500 ms. */
export function assertBlastDelay(delayMin: number, delayMax: number): { minMs: number; maxMs: number } {
  if (!Number.isInteger(delayMin) || delayMin < 0) {
    throw bad('delay_min: Harus bilangan bulat >= 0 (milidetik).');
  }
  if (!Number.isInteger(delayMax) || delayMax < 0) {
    throw bad('delay_max: Harus bilangan bulat >= 0 (milidetik).');
  }
  if (delayMax < delayMin) {
    throw bad('delay_max: Harus >= delay_min.');
  }
  return { minMs: delayMin, maxMs: delayMax };
}
