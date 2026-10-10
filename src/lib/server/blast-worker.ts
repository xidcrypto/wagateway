import 'server-only';

import { getSocket } from './session-manager';
import { recordOutgoing } from './message-recorder';
import { renderBlastTemplate } from './blast-recipients';
import { normalizeButton, toBaileysButton, type ButtonInput } from './interactive';
import { loadMedia } from './media-loader';
import { prisma } from './prisma';

/**
 * Worker blast singleton (Fase 4, step 4.2; komposisi media/buttons 2026-10-10).
 * - Disimpan di `globalThis` agar tidak ganda saat HMR.
 * - Mengirim SATU PER SATU; jeda acak delayMin..delayMax diukur dari MULAI
 *   kirim ke nomor sebelumnya (elapsed-aware), minimum 500 ms walau input
 *   lebih kecil. Jadi delay 3000–5000 ms = jeda antar nomor yang konsisten,
 *   bukan jeda setelah pengiriman selesai.
 * - Komposisi per penerima: teks (render {{var}}) + media opsional
 *   (image/video/audio/document/sticker) + tombol opsional (buttons/buttonv2/list).
 * - Status tiap recipient: pending → sent/failed (+ error, sent_at).
 * - Jika session tidak `open`, campaign otomatis `paused`.
 * - Pause/resume/cancel tanpa kehilangan progres (loop cek status tiap iterasi).
 * - Saat boot, campaign `running` dilanjutkan dari recipient `pending`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySock = any;

const MIN_DELAY_MS = 500;

export type BlastMediaKind = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export type BlastMedia = {
  kind: BlastMediaKind;
  media: string;
  mimetype?: string | null;
  filename?: string | null;
  gif?: boolean;
  ptt?: boolean;
};

export type BlastButtons =
  | { mode: 'buttons'; buttons: ButtonInput[]; footer?: string | null; headerMedia?: string | null }
  | { mode: 'buttonv2'; buttons: Array<{ id: string; text: string }>; footer?: string | null; headerMedia?: string | null }
  | {
      mode: 'list';
      sections: Array<{ title?: string; rows: Array<{ title: string; description?: string }> }>;
      title?: string | null;
      buttonText?: string | null;
      footer?: string | null;
    };

export type BlastComposition = {
  media: BlastMedia | null;
  buttons: BlastButtons | null;
};

function readComposition(blast: { mediaJson: unknown; buttonsJson: unknown }): BlastComposition {
  let media: BlastMedia | null = null;
  let buttons: BlastButtons | null = null;
  const mj = blast.mediaJson as Record<string, unknown> | null;
  if (mj && typeof mj === 'object') {
    const kind = mj.kind;
    const src = mj.media;
    if ((kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'document' || kind === 'sticker') && typeof src === 'string' && src) {
      media = {
        kind,
        media: src,
        mimetype: typeof mj.mimetype === 'string' ? mj.mimetype : null,
        filename: typeof mj.filename === 'string' ? mj.filename : null,
        gif: mj.gif === true,
        ptt: mj.ptt === true,
      };
    }
  }
  const bj = blast.buttonsJson as Record<string, unknown> | null;
  if (bj && typeof bj === 'object') {
    if (bj.mode === 'buttons' && Array.isArray(bj.buttons)) {
      buttons = {
        mode: 'buttons',
        buttons: bj.buttons as ButtonInput[],
        footer: typeof bj.footer === 'string' ? bj.footer : null,
        headerMedia: typeof bj.headerMedia === 'string' ? bj.headerMedia : null,
      };
    } else if (bj.mode === 'buttonv2' && Array.isArray(bj.buttons)) {
      buttons = {
        mode: 'buttonv2',
        buttons: (bj.buttons as Array<{ id?: unknown; text?: unknown }>)
          .filter((b) => typeof b?.id === 'string' && typeof b?.text === 'string')
          .map((b) => ({ id: b.id as string, text: b.text as string })),
        footer: typeof bj.footer === 'string' ? bj.footer : null,
        headerMedia: typeof bj.headerMedia === 'string' ? bj.headerMedia : null,
      };
    } else if (bj.mode === 'list' && Array.isArray(bj.sections)) {
      buttons = {
        mode: 'list',
        sections: bj.sections as BlastButtons extends { mode: 'list'; sections: infer S } ? S : never,
        title: typeof bj.title === 'string' ? bj.title : null,
        buttonText: typeof bj.buttonText === 'string' ? bj.buttonText : null,
        footer: typeof bj.footer === 'string' ? bj.footer : null,
      };
    }
  }
  return { media, buttons };
}

type WorkerStore = {
  running: Map<number, Promise<void>>;
};

const globalForBlast = globalThis as unknown as {
  __pansaBlastWorker?: WorkerStore;
};

function getStore(): WorkerStore {
  if (!globalForBlast.__pansaBlastWorker) {
    globalForBlast.__pansaBlastWorker = { running: new Map() };
  }
  return globalForBlast.__pansaBlastWorker;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs: number, maxMs: number): number {
  const lo = Math.max(0, Math.floor(minMs));
  const hi = Math.max(lo, Math.floor(maxMs));
  const picked = lo === hi ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));
  return Math.max(MIN_DELAY_MS, picked);
}

async function isSessionOpen(sessionId: string): Promise<boolean> {
  const record = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });
  if (!record || record.status !== 'open') return false;
  return getSocket(sessionId) !== null;
}

async function nextPending(blastId: number): Promise<{
  id: number;
  phone: string;
  vars: unknown;
} | null> {
  const row = await prisma.blastRecipient.findFirst({
    where: { blastId, status: 'pending' },
    orderBy: { id: 'asc' },
    select: { id: true, phone: true, vars: true },
  });
  return row;
}

function varsToRecord(vars: unknown): Record<string, string> {
  if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

async function sendOne(
  sock: AnySock,
  sessionId: string,
  blast: { textBody: string; mediaJson: unknown; buttonsJson: unknown },
  recipient: { id: number; phone: string; vars: unknown },
): Promise<void> {
  const jid = `${recipient.phone}@s.whatsapp.net`;
  const vars = varsToRecord(recipient.vars);
  const text = renderBlastTemplate(blast.textBody, vars);
  const { media, buttons } = readComposition(blast);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any = {};
  let msgType = 'conversation';
  let payload: Record<string, unknown> | undefined;
  try {
    if (media && buttons) {
      // Komposisi media+tombol: hanya buttons native yang dukung header gambar.
      if (buttons.mode !== 'buttons') {
        throw Object.assign(
          new Error('Media hanya bisa digabung dengan tombol mode "buttons".'),
          { statusCode: 400 },
        );
      }
      const nativeFlow = buttons.buttons.map((b, i) =>
        toBaileysButton(normalizeButton(b as ButtonInput, i)),
      );
      const loaded = await loadMedia({ media: media.media });
      const mimeType = media.mimetype?.trim() || loaded.mimeType;
      if (!mimeType.startsWith('image/')) {
        throw Object.assign(
          new Error(`Header blast hanya mendukung gambar (terdeteksi: ${loaded.mimeType}).`),
          { statusCode: 400 },
        );
      }
      content.image = loaded.buffer;
      content.mimetype = mimeType;
      content.caption = text;
      content.nativeFlow = nativeFlow;
      if (buttons.footer) content.footer = buttons.footer;
      msgType = 'interactiveMessage';
      payload = { mediaKind: 'image', hasMedia: true, buttons: buttons.buttons };
    } else if (media) {
      const loaded = await loadMedia({ media: media.media });
      const mimeType = media.mimetype?.trim() || loaded.mimeType;
      if (media.kind === 'image') {
        if (!mimeType.startsWith('image/')) throw mediaMismatch('gambar', loaded.mimeType);
        content.image = loaded.buffer;
        content.mimetype = mimeType;
        if (text) content.caption = text;
        msgType = 'imageMessage';
      } else if (media.kind === 'video') {
        const asGif = media.gif === true;
        if (!mimeType.startsWith('video/') && !(asGif && mimeType.startsWith('image/'))) {
          throw mediaMismatch('video', loaded.mimeType);
        }
        content.video = loaded.buffer;
        content.mimetype = mimeType;
        if (text) content.caption = text;
        if (asGif) content.gifPlayback = true;
        if (media.filename) content.fileName = media.filename;
        msgType = 'videoMessage';
      } else if (media.kind === 'audio') {
        content.audio = loaded.buffer;
        content.mimetype = mimeType;
        if (media.ptt === true) content.ptt = true;
        msgType = 'audioMessage';
      } else if (media.kind === 'document') {
        content.document = loaded.buffer;
        content.mimetype = mimeType;
        content.fileName = media.filename || 'dokumen';
        if (text) content.caption = text;
        msgType = 'documentMessage';
      } else {
        if (!mimeType.startsWith('image/webp')) {
          throw Object.assign(
            new Error(`Stiker harus berformat webp (terdeteksi: ${loaded.mimeType}).`),
            { statusCode: 400 },
          );
        }
        content.sticker = loaded.buffer;
        msgType = 'stickerMessage';
      }
      payload = { mediaKind: media.kind, hasMedia: true };
    } else if (buttons) {
      if (buttons.mode === 'buttons') {
        const nativeFlow = buttons.buttons.map((b, i) =>
          toBaileysButton(normalizeButton(b as ButtonInput, i)),
        );
        content.nativeFlow = nativeFlow;
        if (buttons.headerMedia) {
          const { loadImageHeader } = await import('./interactive');
          const header = await loadImageHeader(renderBlastTemplate(buttons.headerMedia, vars));
          content.image = header.image;
          content.mimetype = header.mimetype;
          content.caption = text;
        } else {
          content.text = text;
        }
        if (buttons.footer) content.footer = buttons.footer;
        msgType = 'interactiveMessage';
        payload = { buttons: buttons.buttons, hasMedia: Boolean(buttons.headerMedia) };
      } else if (buttons.mode === 'buttonv2') {
        if (buttons.buttons.length === 0 || buttons.buttons.length > 3) {
          throw Object.assign(new Error('buttonv2 maksimal 3 tombol reply.'), { statusCode: 400 });
        }
        content.templateButtons = buttons.buttons
          .map((b) => toBaileysButton(normalizeButton({ type: 'reply', id: b.id, text: b.text }, 0)));
        if (buttons.headerMedia) {
          const { loadImageHeader } = await import('./interactive');
          const header = await loadImageHeader(renderBlastTemplate(buttons.headerMedia, vars));
          content.image = header.image;
          content.mimetype = header.mimetype;
          content.caption = text;
        } else {
          content.text = text;
        }
        if (buttons.footer) content.footer = buttons.footer;
        msgType = 'buttonsMessage';
        payload = { buttons: buttons.buttons, hasMedia: Boolean(buttons.headerMedia) };
      } else {
        const { buildListSections } = await import('./interactive');
        const rendered = buttons.sections.map((s) => ({
          title: s.title ? renderBlastTemplate(s.title, vars) : undefined,
          rows: s.rows.map((r) => ({
            title: renderBlastTemplate(r.title, vars),
            ...(r.description ? { description: renderBlastTemplate(r.description, vars) } : {}),
          })),
        }));
        const sections = buildListSections(rendered as never);
        content.text = text;
        content.buttonText = buttons.buttonText || 'Lihat Pilihan';
        content.sections = sections;
        if (buttons.title) content.title = renderBlastTemplate(buttons.title, vars);
        if (buttons.footer) content.footer = renderBlastTemplate(buttons.footer, vars);
        msgType = 'listMessage';
        payload = { sections, title: buttons.title ?? null };
      }
    } else {
      content.text = text;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, content as any)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    await recordOutgoing({
      sessionId,
      waId,
      remoteJid: jid,
      msgType,
      textBody: text || null,
      status: 'sent',
      payload,
    });
    await prisma.blastRecipient.update({
      where: { id: recipient.id },
      data: { status: 'sent', sentAt: new Date(), error: null },
    });
  } catch (err) {
    await prisma.blastRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'failed',
        sentAt: new Date(),
        error: err instanceof Error ? err.message.slice(0, 1000) : 'Gagal mengirim.',
      },
    });
  }
}

function mediaMismatch(kind: string, detected: string): Error {
  return Object.assign(
    new Error(`Tipe media tidak cocok untuk ${kind} (terdeteksi: ${detected}).`),
    { statusCode: 400 },
  );
}

async function finishIfDone(blastId: number): Promise<void> {
  const pending = await prisma.blastRecipient.count({
    where: { blastId, status: 'pending' },
  });
  if (pending > 0) return;
  const failed = await prisma.blastRecipient.count({
    where: { blastId, status: 'failed' },
  });
  await prisma.blast.update({
    where: { id: blastId },
    data: {
      status: failed > 0 ? 'failed' : 'done',
      finishedAt: new Date(),
      error: failed > 0 ? `${failed} penerima gagal.` : null,
    },
  });
}

async function runLoop(blastId: number): Promise<void> {
  // Jeda diukur dari MULAI kirim nomor sebelumnya (start-to-start,
  // elapsed-aware): delay 3000–5000 ms berarti tiap nomor MULAI dikirim
  // dengan jeda 3–5 dtk, walau pengiriman (upload media/ack) butuh waktu.
  // Nomor pertama langsung dikirim tanpa jeda; jeda berlaku sebelum
  // nomor ke-2 dan seterusnya.
  let lastStart = 0;
  let targetWait = 0;
  for (;;) {
    const blast = await prisma.blast.findUnique({
      where: { id: blastId },
      select: { id: true, status: true, sessionId: true, textBody: true, mediaJson: true, buttonsJson: true, delayMin: true, delayMax: true },
    });
    if (!blast) return;
    if (blast.status === 'paused') return;
    if (blast.status === 'cancelled' || blast.status === 'done' || blast.status === 'failed') return;

    // Session tidak open → otomatis paused (tanpa kehilangan progres).
    if (!(await isSessionOpen(blast.sessionId))) {
      await prisma.blast.update({
        where: { id: blastId },
        data: { status: 'paused', error: 'Session tidak open; campaign dijeda otomatis.' },
      });
      return;
    }

    const recipient = await nextPending(blastId);
    if (!recipient) {
      await finishIfDone(blastId);
      return;
    }

    // Tunggu sisa jeda SEBELUM kirim nomor ini (kecuali nomor pertama).
    // Cek pause/cancel tiap 250 ms agar jeda panjang tetap responsif.
    if (targetWait > 0) {
      const waited = Date.now() - lastStart;
      let remain = targetWait - waited;
      while (remain > 0) {
        await sleep(Math.min(250, remain));
        const cur = await prisma.blast.findUnique({
          where: { id: blastId },
          select: { status: true },
        });
        if (!cur || cur.status !== 'running') return;
        remain = targetWait - (Date.now() - lastStart);
      }
    }

    const sock = getSocket(blast.sessionId);
    if (!sock) {
      await prisma.blast.update({
        where: { id: blastId },
        data: { status: 'paused', error: 'Session tidak open; campaign dijeda otomatis.' },
      });
      return;
    }
    lastStart = Date.now();
    targetWait = randomDelay(blast.delayMin, blast.delayMax);
    await sendOne(sock, blast.sessionId, blast, recipient);
    await finishIfDone(blastId);
  }
}

/** Jadwalkan worker untuk satu blast (idempotent per blastId). */
export function kickBlast(blastId: number): void {
  const store = getStore();
  if (store.running.has(blastId)) return;
  const p = runLoop(blastId).finally(() => {
    store.running.delete(blastId);
  });
  store.running.set(blastId, p);
}

/** Apakah worker sedang berjalan untuk blastId. */
export function isBlastRunning(blastId: number): boolean {
  return getStore().running.has(blastId);
}

/**
 * Resume saat boot: semua blast `running` dilanjutkan dari recipient `pending`.
 * Blast yang session-nya tidak open akan otomatis paused oleh loop.
 */
export async function resumeRunningBlasts(): Promise<{ resumed: number }> {
  let rows: Array<{ id: number }> = [];
  try {
    rows = await prisma.blast.findMany({
      where: { status: 'running' },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
  } catch {
    return { resumed: 0 };
  }
  for (const r of rows) {
    kickBlast(r.id);
  }
  return { resumed: rows.length };
}
