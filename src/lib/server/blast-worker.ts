import 'server-only';

import { getSocket } from './session-manager';
import { recordOutgoing } from './message-recorder';
import { renderBlastTemplate } from './blast-recipients';
import { prisma } from './prisma';

/**
 * Worker blast singleton (Fase 4, step 4.2).
 * - Disimpan di `globalThis` agar tidak ganda saat HMR.
 * - Mengirim SATU PER SATU dengan delay acak antara delayMin..delayMax;
 *   minimum 500 ms walau input lebih kecil.
 * - Status tiap recipient: pending → sent/failed (+ error, sent_at).
 * - Jika session tidak `open`, campaign otomatis `paused`.
 * - Pause/resume/cancel tanpa kehilangan progres (loop cek status tiap iterasi).
 * - Saat boot, campaign `running` dilanjutkan dari recipient `pending`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySock = any;

const MIN_DELAY_MS = 500;

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
  blastText: string,
  recipient: { id: number; phone: string; vars: unknown },
): Promise<void> {
  const jid = `${recipient.phone}@s.whatsapp.net`;
  const text = renderBlastTemplate(blastText, varsToRecord(recipient.vars));
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, { text } as any)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    await recordOutgoing({
      sessionId,
      waId,
      remoteJid: jid,
      msgType: 'conversation',
      textBody: text,
      status: 'sent',
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
  for (;;) {
    const blast = await prisma.blast.findUnique({
      where: { id: blastId },
      select: { id: true, status: true, sessionId: true, textBody: true, delayMin: true, delayMax: true },
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

    const sock = getSocket(blast.sessionId);
    if (!sock) {
      await prisma.blast.update({
        where: { id: blastId },
        data: { status: 'paused', error: 'Session tidak open; campaign dijeda otomatis.' },
      });
      return;
    }
    await sendOne(sock, blast.sessionId, blast.textBody, recipient);
    await finishIfDone(blastId);

    const still = await prisma.blast.findUnique({
      where: { id: blastId },
      select: { status: true, delayMin: true, delayMax: true },
    });
    if (!still || still.status !== 'running') return;
    const more = await prisma.blastRecipient.count({
      where: { blastId, status: 'pending' },
    });
    if (more === 0) return;
    await sleep(randomDelay(still.delayMin, still.delayMax));
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
