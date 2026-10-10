import 'server-only';

import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import type { Session } from '@/generated/prisma/client';
import { isAdmin } from './auth';
import type { AuthContext } from './auth';
import { prisma } from './prisma';
import { fail } from './response';

// Tipe longgar untuk Baileys (paket tidak menyediakan tipe TS penuh).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySock = any;

export type SessionEventName =
  | 'qr'
  | 'connected'
  | 'disconnected'
  | 'logged_out'
  | 'stopped'
  | 'message'
  | 'message.status'
  | 'presence'
  | 'group'
  | 'call';

export type SessionEvent = {
  event: SessionEventName;
  sessionId: string;
  timestamp: string;
  data: unknown;
};

type EventListener = (ev: SessionEvent) => void;

type LiveSession = {
  sock: AnySock | null;
  status: string;
  qrPng: string | null;
  qrRaw: string | null;
  pairingCode: string | null;
  pairingPhone: string | null;
  pairingExpiresAt: number | null;
  reconnectTimer: NodeJS.Timeout | null;
  cleanupTimer: NodeJS.Timeout | null;
  /** Waktu hapus otomatis (ISO) untuk session logged_out; null bila tidak dijadwalkan. */
  cleanupDeleteAt: string | null;
  stopping: boolean;
  starting: boolean;
};

const RECONNECT_DELAY_MS = 5000;
const RESTORE_GAP_MS = 1000;
// TTL kode pairing mengikuti default Baileys `pairingCodeTimeoutMs: 180000` (3 menit).
// QR pertama 60 detik lalu rotasi tiap 20 detik (diatur Baileys, bukan kita).
const PAIRING_TTL_MS = 3 * 60 * 1000;
/**
 * Session logged_out (keluar dari HP) dihapus otomatis setelah jeda ini
 * (default 5 menit, bisa diubah via env LOGGED_OUT_RETENTION_MS).
 * HANYA logged_out — status stopped (stop manual) tidak ikut dihapus.
 * Sebelum dihapus, owner diberi notifikasi inbox + countdown di UI.
 */
function loggedOutRetentionMs(): number {
  const raw = Number(process.env.LOGGED_OUT_RETENTION_MS ?? String(5 * 60 * 1000));
  if (!Number.isFinite(raw) || raw < 60_000) return 5 * 60 * 1000;
  return Math.floor(raw);
}
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

type ManagerStore = {
  sessions: Map<string, LiveSession>;
  listeners: Set<EventListener>;
};

const globalForManager = globalThis as unknown as {
  __pansaSessionManager?: ManagerStore;
};

function getStore(): ManagerStore {
  if (!globalForManager.__pansaSessionManager) {
    globalForManager.__pansaSessionManager = { sessions: new Map(), listeners: new Set() };
  }
  return globalForManager.__pansaSessionManager;
}

/** Daftarkan pendengar event session (dipakai dispatcher webhook Fase 2.2). */
export function onSessionEvent(listener: EventListener): () => void {
  const store = getStore();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function emit(ev: SessionEvent): void {
  for (const listener of getStore().listeners) {
    try {
      listener(ev);
    } catch {
      // Pendengar tidak boleh menjatuhkan manager.
    }
  }
  // Teruskan ke bus live SSE (dashboard real-time). Import dinamis agar tidak
  // ada siklus import dengan live-bus; kegagalan tidak boleh mengganggu emit.
  try {
    const g = globalThis as unknown as {
      __pansaLiveBus?: { listeners: Set<(e: SessionEvent) => void> };
    };
    const bus = g.__pansaLiveBus;
    if (bus) {
      for (const listener of bus.listeners) {
        try {
          listener(ev);
        } catch {
          // Abaikan.
        }
      }
    }
  } catch {
    // Abaikan.
  }
}

function sessionsDir(): string {
  return resolve(process.cwd(), process.env.SESSIONS_DIR ?? './data/sessions');
}

export function sessionFolder(sessionId: string): string {
  return join(sessionsDir(), sessionId);
}

export function assertValidSessionId(sessionId: string): void {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new Error('ID session tidak valid.');
  }
}

export type RouteCtx = { params: Promise<{ id: string }> };

/** Ambil id dari params async route + validasi format. */
export async function parseSessionId(routeCtx?: RouteCtx): Promise<string | null> {
  const raw = (await routeCtx?.params)?.id;
  if (!raw || !SESSION_ID_RE.test(raw)) return null;
  return raw;
}

/**
 * Guard kepemilikan session: admin boleh semua, user biasa hanya miliknya.
 * Mengembalikan record bila boleh, atau respons error (401/403/404/400) bila tidak.
 */
export async function authorizeSession(
  ctx: AuthContext,
  routeCtx?: RouteCtx,
): Promise<{ ok: true; session: Session } | { ok: false; response: NextResponse }> {
  const sessionId = await parseSessionId(routeCtx);
  if (!sessionId) {
    return { ok: false, response: fail('ID session tidak valid.', 400) as NextResponse };
  }
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return { ok: false, response: fail('Session tidak ditemukan.', 404) as NextResponse };
  }
  if (!isAdmin(ctx) && session.ownerId !== ctx.user.id) {
    return { ok: false, response: fail('Akses ditolak. Bukan session milikmu.', 403) as NextResponse };
  }
  return { ok: true, session };
}

/**
 * Ambil status HTTP dari error apa pun:
 * 1. err.statusCode langsung (error internal kita),
 * 2. err.output.statusCode (Boom standar),
 * 3. err.data numerik (Boom dari assertNodeErrorFree Baileys, mis. {data: 400}).
 */
export function httpStatusFromError(err: unknown, fallback = 500): number {
  if (typeof err === 'object' && err !== null) {
    const direct = (err as { statusCode?: unknown }).statusCode;
    if (typeof direct === 'number' && direct >= 400 && direct < 600) return direct;
    const viaOutput = (err as { output?: { statusCode?: unknown } }).output?.statusCode;
    // Abaikan 500 default Boom bila ada data numerik yang lebih spesifik.
    const data = (err as { data?: unknown }).data;
    if (typeof data === 'number' && data >= 400 && data < 600) return data;
    if (typeof viaOutput === 'number' && viaOutput >= 400 && viaOutput < 600) {
      // Jangan pakai 500 default bila pesan menunjukkan penolakan klien yang dikenal.
      if (viaOutput !== 500) return viaOutput;
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (/bad-request|not-allowed|forbidden|unauthorized|gone|conflict/.test(msg)) return 400;
      return viaOutput;
    }
  }
  return fallback;
}

/** Terjemahkan error server WA / Boom ke Bahasa Indonesia. */
export function translateWaError(err: unknown, fallbackMessage: string): string {
  if (!(err instanceof Error)) return fallbackMessage;
  const msg = err.message.toLowerCase();
  if (msg.includes('rate-overlimit') || msg.includes('rate limit') || msg.includes('too many')) {
    return 'Terlalu banyak permintaan pairing ke WhatsApp. Tunggu beberapa menit lalu coba lagi.';
  }
  if (msg.includes('not-allowed') || msg.includes('not allowed')) {
    return 'Nomor ini tidak mengizinkan pairing lewat kode. Aktifkan dulu di WhatsApp atau pakai scan QR.';
  }
  if (msg.includes('bad-request') || msg.includes('bad request')) {
    return 'Permintaan pairing ditolak server WhatsApp. Periksa nomornya lalu coba lagi.';
  }
  if (msg.includes('connection closed') || msg.includes('connection terminated')) {
    return 'Koneksi WhatsApp terputus. Jalankan start dulu lalu coba lagi.';
  }
  if (msg.includes('timed out') || msg.includes('never answered')) {
    return 'Server WhatsApp tidak menjawab. Coba lagi sebentar lagi.';
  }
  return err.message || fallbackMessage;
}

/** Bungkus error manager menjadi respons HTTP (pakai statusCode bila ada). */
export function managerError(message: string, err: unknown, fallback = 500): NextResponse {
  const statusCode = httpStatusFromError(err, fallback);
  const detail = translateWaError(err, message);
  return fail(detail, statusCode) as NextResponse;
}

function getLive(sessionId: string): LiveSession {
  const store = getStore();
  let live = store.sessions.get(sessionId);
  if (!live) {
    live = {
      sock: null,
      status: 'connecting',
      qrPng: null,
      qrRaw: null,
      pairingCode: null,
      pairingPhone: null,
      pairingExpiresAt: null,
      reconnectTimer: null,
      cleanupTimer: null,
      cleanupDeleteAt: null,
      stopping: false,
      starting: false,
    };
    store.sessions.set(sessionId, live);
  }
  return live;
}

async function setDbStatus(
  sessionId: string,
  status: 'connecting' | 'qr' | 'pairing' | 'open' | 'closed' | 'logged_out' | 'stopped',
  extra?: { phone?: string | null; waName?: string | null },
): Promise<void> {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status,
        ...(extra?.phone !== undefined ? { phone: extra.phone } : {}),
        ...(extra?.waName !== undefined ? { waName: extra.waName } : {}),
      },
    });
  } catch {
    // Record mungkin sudah dihapus (DELETE session); abaikan.
  }
  const live = getStore().sessions.get(sessionId);
  if (live) live.status = status;
}

function clearReconnect(live: LiveSession): void {
  if (live.reconnectTimer) {
    clearTimeout(live.reconnectTimer);
    live.reconnectTimer = null;
  }
}

function scheduleReconnect(sessionId: string): void {
  const live = getLive(sessionId);
  clearReconnect(live);
  if (live.stopping) return;
  live.reconnectTimer = setTimeout(() => {
    live.reconnectTimer = null;
    void start(sessionId).catch(() => {
      // Gagal start saat reconnect: biarkan status closed, coba lagi manual.
    });
  }, RECONNECT_DELAY_MS);
  const timer = live.reconnectTimer;
  if (timer && typeof timer.unref === 'function') timer.unref();
}

/**
 * Hapus permanen satu session: stop koneksi + hapus pesan + record
 * (cascade blast) + folder kredensial. Dipakai DELETE manual dan
 * cleanup logged_out otomatis. Status stopped TIDAK pernah masuk sini.
 */
export async function deleteSessionRecord(sessionId: string): Promise<boolean> {
  assertValidSessionId(sessionId);
  const live = getStore().sessions.get(sessionId);
  if (live) {
    live.stopping = true;
    clearReconnect(live);
    if (live.cleanupTimer) {
      clearTimeout(live.cleanupTimer);
      live.cleanupTimer = null;
    }
    live.cleanupDeleteAt = null;
    const sock = live.sock;
    live.sock = null;
    if (sock) {
      try {
        sock.end?.(undefined);
      } catch {
        // Abaikan.
      }
      try {
        sock.ev?.removeAllListeners?.('connection.update');
        sock.ev?.removeAllListeners?.('creds.update');
      } catch {
        // Abaikan.
      }
    }
  }
  let existed = false;
  try {
    const rec = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    existed = rec !== null;
  } catch {
    existed = false;
  }
  try {
    await prisma.message.deleteMany({ where: { sessionId } });
  } catch {
    // Abaikan.
  }
  try {
    await prisma.session.delete({ where: { id: sessionId } });
  } catch {
    // Sudah tidak ada.
  }
  try {
    await rm(sessionFolder(sessionId), { recursive: true, force: true });
  } catch {
    // Abaikan bila folder tidak ada.
  }
  getStore().sessions.delete(sessionId);
  return existed;
}

/**
 * Jadwalkan hapus otomatis untuk session logged_out (keluar dari HP).
 * Alur: notifikasi "akan dihapus dalam 5 menit" → setelah jeda, cek ulang
 * status DB: bila masih logged_out → hapus permanen + notifikasi "dihapus";
 * bila sudah hidup lagi (start/scan ulang) → batal, tidak jadi hapus.
 * Status stopped (stop manual) TIDAK dijadwalkan — hanya logged_out.
 */
export async function scheduleLoggedOutCleanup(sessionId: string): Promise<void> {
  const live = getLive(sessionId);
  if (live.cleanupTimer) {
    clearTimeout(live.cleanupTimer);
    live.cleanupTimer = null;
  }
  live.cleanupDeleteAt = null;
  const waitMs = loggedOutRetentionMs();
  // Ambil info session untuk notifikasi (label + owner).
  let label = sessionId;
  let ownerId: number | null = null;
  try {
    const rec = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { label: true, ownerId: true },
    });
    if (rec) {
      label = rec.label;
      ownerId = rec.ownerId;
    }
  } catch {
    // Lanjut tanpa label.
  }
  const deleteAt = new Date(Date.now() + waitMs).toISOString();
  if (ownerId !== null) {
    try {
      const { notify } = await import('./notifications');
      await notify({
        userId: ownerId,
        kind: 'session_logged_out',
        title: `Session "${label}" keluar dari WhatsApp`,
        body: `Keluar dari HP. Session akan dihapus otomatis dalam 5 menit bila tidak ditautkan ulang. Tautkan lagi dari halaman Sessions untuk membatalkan.`,
        link: '/sessions',
      });
    } catch {
      // Notifikasi gagal tidak boleh menggagalkan jadwal.
    }
  }
  emit({
    event: 'logged_out',
    sessionId,
    timestamp: new Date().toISOString(),
    data: { reason: 'logout', deleteAt, retentionMs: waitMs },
  } as SessionEvent);
  live.cleanupDeleteAt = deleteAt;
  live.cleanupTimer = setTimeout(() => {
    live.cleanupTimer = null;
    live.cleanupDeleteAt = null;
    void (async () => {
      // Cek ulang: batal bila status sudah bukan logged_out (user start ulang).
      let current: { status: string; label: string; ownerId: number | null } | null = null;
      try {
        current = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { status: true, label: true, ownerId: true },
        });
      } catch {
        return;
      }
      if (!current || current.status !== 'logged_out') return;
      const gone = await deleteSessionRecord(sessionId);
      if (!gone) return;
      emit({ event: 'stopped', sessionId, timestamp: new Date().toISOString(), data: { logout: true, auto: true } });
      if (current.ownerId !== null) {
        try {
          const { notify } = await import('./notifications');
          await notify({
            userId: current.ownerId,
            kind: 'session_deleted',
            title: `Session "${current.label}" dihapus otomatis`,
            body: 'Session yang keluar dari WhatsApp dan tidak ditautkan ulang dalam 5 menit telah dihapus beserta riwayat pesannya. Buat session baru bila masih dibutuhkan.',
            link: '/sessions',
          });
        } catch {
          // Abaikan.
        }
      }
    })();
  }, waitMs);
  if (typeof live.cleanupTimer.unref === 'function') live.cleanupTimer.unref();
}

/** Mulai (atau mulai ulang) koneksi WA untuk sebuah session. */
export async function start(sessionId: string): Promise<{ status: string }> {
  assertValidSessionId(sessionId);
  const live = getLive(sessionId);
  if (live.starting) return { status: live.status };
  if (live.sock) {
    try {
      live.sock.ev?.removeAllListeners?.('connection.update');
      live.sock.ev?.removeAllListeners?.('creds.update');
    } catch {
      // Abaikan.
    }
    live.sock = null;
  }
  live.starting = true;
  live.stopping = false;
  clearReconnect(live);
  // User menautkan ulang (start manual): batalkan jadwal hapus logged_out.
  if (live.cleanupTimer) {
    clearTimeout(live.cleanupTimer);
    live.cleanupTimer = null;
  }
  live.cleanupDeleteAt = null;
  live.qrPng = null;
  live.qrRaw = null;

  try {
    await setDbStatus(sessionId, 'connecting');

    const folder = sessionFolder(sessionId);
    await mkdir(folder, { recursive: true });

    const baileys = (await import('@rexxhayanasi/elaina-baileys')) as unknown as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >;
    const { state, saveCreds } = await baileys.useMultiFileAuthState(folder);
    let version: [number, number, number] | undefined;
    try {
      const fetched = await baileys.fetchLatestBaileysVersion?.();
      if (Array.isArray(fetched?.version)) version = fetched.version;
    } catch {
      version = undefined;
    }

    const sock: AnySock = baileys.makeWASocket({
      auth: { creds: state.creds, keys: baileys.makeCacheableSignalKeyStore?.(state.keys, undefined) ?? state.keys },
      ...(version ? { version } : {}),
      browser: ['Pansa Gateway', 'Chrome', '1.0'],
      printQRInTerminal: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: false,
      // logger sengaja tidak diset: pakai default Baileys (pino).
      // Mengirim logger: undefined menimpa default dan crash (logger.warn).
    });

    live.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update: Record<string, unknown>) => {
      void handleConnectionUpdate(sessionId, update);
    });

    // Handler pesan masuk + update status (Fase 2.3). Fire-and-forget agar
    // tidak menahan loop event Baileys; kegagalan hanya di-log di modul.
    sock.ev.on('messages.upsert', (upsert: Record<string, unknown>) => {
      void (async () => {
        try {
          const { handleMessagesUpsert } = await import('./message-handlers');
          await handleMessagesUpsert(
            sessionId,
            upsert as { messages?: unknown[]; type?: string },
            (ev) => emit(ev),
          );
        } catch {
          // Abaikan: satu pesan rusak tidak boleh menjatuhkan koneksi.
        }
      })();
    });

    sock.ev.on('messages.update', (updates: unknown) => {
      void (async () => {
        try {
          const { handleMessagesUpdate } = await import('./message-handlers');
          await handleMessagesUpdate(
            sessionId,
            (Array.isArray(updates) ? updates : []) as Array<{ key?: unknown; update?: unknown }>,
            (ev) => emit(ev),
          );
        } catch {
          // Abaikan.
        }
      })();
    });

    // Event grup → webhook sebagai event `group` (aturan Fase 3).
    // Fire-and-forget; payload dibiarkan apa adanya (dispatcher yang stringify).
    const emitGroup = (kind: string, data: unknown): void => {
      emit({
        event: 'group',
        sessionId,
        timestamp: new Date().toISOString(),
        data: { kind, update: data ?? null },
      });
    };
    sock.ev.on('groups.upsert', (updates: unknown) => emitGroup('upsert', updates));
    sock.ev.on('groups.update', (updates: unknown) => emitGroup('update', updates));
    sock.ev.on('group-participants.update', (updates: unknown) =>
      emitGroup('participants', updates),
    );

    return { status: 'connecting' };
  } finally {
    live.starting = false;
  }
}

async function handleConnectionUpdate(
  sessionId: string,
  update: Record<string, unknown>,
): Promise<void> {
  const live = getLive(sessionId);
  const timestamp = new Date().toISOString();

  if (typeof update.qr === 'string' && update.qr) {
    live.qrRaw = update.qr;
    try {
      live.qrPng = await QRCode.toDataURL(update.qr, { width: 320, margin: 1 });
    } catch {
      live.qrPng = null;
    }
    await setDbStatus(sessionId, 'qr');
    emit({ event: 'qr', sessionId, timestamp, data: { hasQr: live.qrPng !== null } });
    return;
  }

  const connection = update.connection as string | undefined;
  if (connection === 'open') {
    clearReconnect(live);
    live.qrPng = null;
    live.qrRaw = null;
    live.pairingCode = null;
    live.pairingPhone = null;
    live.pairingExpiresAt = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const me = (live.sock?.user ?? live.sock?.authState?.creds?.me ?? null) as any;
    const phone: string | null =
      typeof me?.id === 'string' ? me.id.split('@')[0].split(':')[0] : null;
    const waName: string | null = typeof me?.name === 'string' ? me.name : null;
    await setDbStatus(sessionId, 'open', { phone, waName });
    emit({ event: 'connected', sessionId, timestamp, data: { phone, waName } });
    // Notifikasi inbox ke owner (session tersambung).
    void (async () => {
      try {
        const rec = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { label: true, ownerId: true },
        });
        if (rec?.ownerId) {
          const { notify } = await import('./notifications');
          await notify({
            userId: rec.ownerId,
            kind: 'session_connected',
            title: `Session "${rec.label}" terhubung`,
            body: phone ? `Nomor ${phone} berhasil ditautkan.` : 'Perangkat berhasil ditautkan.',
            link: '/sessions',
          });
        }
      } catch {
        // Abaikan.
      }
    })();
    return;
  }

  if (connection === 'close') {
    const lastDisconnect = update.lastDisconnect as
      | { error?: { output?: { statusCode?: number }; message?: string } }
      | undefined;
    const err = lastDisconnect?.error;
    const code = err?.output?.statusCode;

    const baileys = (await import('@rexxhayanasi/elaina-baileys')) as unknown as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >;
    const loggedOutCode = baileys.DisconnectReason?.loggedOut;
    if (code === loggedOutCode || code === 401) {
      live.sock = null;
      await setDbStatus(sessionId, 'logged_out');
      emit({ event: 'logged_out', sessionId, timestamp, data: { reason: err?.message ?? 'logout' } });
      // Jadwalkan hapus otomatis setelah jeda (batal bila session hidup lagi).
      void scheduleLoggedOutCleanup(sessionId);
      return;
    }

    if (live.stopping) {
      live.sock = null;
      return;
    }

    live.sock = null;
    await setDbStatus(sessionId, 'closed');
    emit({ event: 'disconnected', sessionId, timestamp, data: { reason: err?.message ?? 'closed' } });
    scheduleReconnect(sessionId);
  }
}

/**
 * Minta pairing code bawaan WhatsApp untuk nomor tertentu.
 * Hanya butuh `phone` (format internasional tanpa nol depan);
 * kode 8 karakter dibuat oleh server WA, berlaku ±3 menit.
 * Hanya satu kode aktif per session.
 * DILARANG untuk session yang sudah open/terdaftar: requestPairingCode Baileys
 * menimpa creds.json dan merusak session yang sudah tersambung.
 * Guard berlapis (status DB + sock.user + creds.registered) karena status DB
 * bisa basi: session open yang baru restart tetap terdaftar walau DB belum
 * sempat update.
 */
export async function requestPairing(
  sessionId: string,
  phone: string,
): Promise<{ code: string; phone: string; expiresIn: number }> {
  assertValidSessionId(sessionId);
  const record = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!record) {
    throw Object.assign(new Error('Session tidak ditemukan.'), { statusCode: 404 });
  }
  if (record.status === 'open') {
    throw Object.assign(
      new Error('Session sudah tersambung. Pairing code hanya untuk session baru yang belum terdaftar.'),
      { statusCode: 409 },
    );
  }
  const live = getLive(sessionId);
  // Guard anti-rusak: session yang socket-nya sudah punya identitas WA
  // (sock.user ada) berarti sudah terdaftar. requestPairingCode Baileys
  // menimpa creds.json di disk dan akan merusak session tersebut,
  // apa pun status DB-nya. Tolak 409 sebelum menyentuh Baileys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sockUser = live.sock?.user as any;
  const credsRegistered = live.sock?.authState?.creds?.registered === true;
  if (sockUser?.id || credsRegistered) {
    throw Object.assign(
      new Error('Session ini sudah terdaftar di WhatsApp. Pairing code hanya untuk session baru yang belum terdaftar.'),
      { statusCode: 409 },
    );
  }
  if (!live.sock) {
    throw Object.assign(new Error('Session belum dimulai. Jalankan start dulu.'), { statusCode: 409 });
  }
  const now = Date.now();
  if (live.pairingCode && live.pairingExpiresAt && live.pairingExpiresAt > now) {
    throw Object.assign(new Error('Sudah ada kode pairing aktif. Batalkan dulu sebelum minta baru.'), {
      statusCode: 409,
    });
  }
  try {
    const code: string = await live.sock.requestPairingCode(phone);
    live.pairingCode = code;
    live.pairingPhone = phone;
    live.pairingExpiresAt = now + PAIRING_TTL_MS;
    await setDbStatus(sessionId, 'pairing');
    return { code, phone, expiresIn: Math.round(PAIRING_TTL_MS / 1000) };
  } catch (err: unknown) {
    // Pending ganda: Boom bisa menaruh 409 di statusCode, output.statusCode, atau data.
    const boom = err as {
      statusCode?: unknown;
      output?: { statusCode?: unknown };
      data?: unknown;
      message?: string;
    };
    if (boom?.statusCode === 409 || boom?.output?.statusCode === 409 || boom?.data === 409) {
      live.pairingCode = live.pairingCode ?? 'active';
      live.pairingExpiresAt = now + 60 * 1000;
      throw Object.assign(
        new Error('Sudah ada kode pairing aktif. Batalkan dulu sebelum minta baru.'),
        { statusCode: 409 },
      );
    }
    throw err instanceof Error ? err : new Error('Gagal meminta pairing code.');
  }
}

/** Batalkan pairing code aktif. */
export async function cancelPairing(sessionId: string): Promise<{ cancelled: boolean }> {
  assertValidSessionId(sessionId);
  const live = getLive(sessionId);
  let wasPending = false;
  try {
    wasPending = Boolean(live.sock?.cancelPairingCode?.());
  } catch {
    wasPending = false;
  }
  const hadLocal = live.pairingCode !== null;
  live.pairingCode = null;
  live.pairingPhone = null;
  live.pairingExpiresAt = null;
  const active = await prisma.session.findUnique({ where: { id: sessionId } });
  if (active && active.status === 'pairing') {
    await setDbStatus(sessionId, 'connecting');
  }
  return { cancelled: wasPending || hadLocal };
}

/**
 * Hentikan session.
 * logout=false → stopped, kredensial disimpan (bisa start tanpa scan).
 *   TIDAK dihapus otomatis (hanya logged_out yang auto-hapus).
 * logout=true → logout dari WA + hapus kredensial + hapus record + pesan.
 */
export async function stop(sessionId: string, logout: boolean): Promise<{ stopped: boolean }> {
  assertValidSessionId(sessionId);

  if (logout) {
    await deleteSessionRecord(sessionId);
    emit({ event: 'stopped', sessionId, timestamp: new Date().toISOString(), data: { logout } });
    return { stopped: true };
  }

  const live = getLive(sessionId);
  live.stopping = true;
  clearReconnect(live);

  const sock = live.sock;
  live.sock = null;
  if (sock) {
    try {
      if (logout) {
        await sock.logout?.();
      } else {
        sock.end?.(undefined);
      }
    } catch {
      try {
        sock.end?.(undefined);
      } catch {
        // Abaikan.
      }
    }
    try {
      sock.ev?.removeAllListeners?.('connection.update');
      sock.ev?.removeAllListeners?.('creds.update');
    } catch {
      // Abaikan.
    }
  }

  live.qrPng = null;
  live.qrRaw = null;
  live.pairingCode = null;
  live.pairingPhone = null;
  live.pairingExpiresAt = null;

  const timestamp = new Date().toISOString();
  // logout=true sudah ditangani deleteSessionRecord di atas (return awal).
  await setDbStatus(sessionId, 'stopped');
  emit({ event: 'stopped', sessionId, timestamp, data: { logout } });
  return { stopped: true };
}

/** Status live + status DB untuk sebuah session. */
export async function getStatus(sessionId: string): Promise<{
  id: string;
  status: string;
  phone: string | null;
  waName: string | null;
  hasQr: boolean;
  hasPairing: boolean;
  live: boolean;
  /** ISO waktu hapus otomatis; hanya diisi bila logged_out + terjadwal. */
  deleteAt: string | null;
}> {
  assertValidSessionId(sessionId);
  const live = getLive(sessionId);
  const record = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!record) {
    throw Object.assign(new Error('Session tidak ditemukan.'), { statusCode: 404 });
  }
  const now = Date.now();
  const pairingActive =
    live.pairingCode !== null && live.pairingExpiresAt !== null && live.pairingExpiresAt > now;
  return {
    id: record.id,
    status: record.status,
    phone: record.phone,
    waName: record.waName,
    hasQr: live.qrPng !== null,
    hasPairing: pairingActive,
    live: live.sock !== null,
    deleteAt: record.status === 'logged_out' ? live.cleanupDeleteAt : null,
  };
}

/** QR terakhir sebagai PNG data URL (atau null bila belum ada). */
export function getQr(sessionId: string): { qr: string | null } {
  assertValidSessionId(sessionId);
  return { qr: getLive(sessionId).qrPng };
}

/** Socket live untuk dipakai route kirim (Fase 2+). Null bila tidak tersambung. */
export function getSocket(sessionId: string): AnySock | null {
  assertValidSessionId(sessionId);
  return getLive(sessionId).sock;
}

/** Cek folder kredensial masih ada di disk. */
export function hasCredentials(sessionId: string): boolean {
  assertValidSessionId(sessionId);
  const folder = sessionFolder(sessionId);
  if (!existsSync(folder)) return false;
  return existsSync(join(folder, 'creds.json'));
}

/**
 * Restore saat boot: start ulang bertahap (jeda 1 detik) semua session
 * yang statusnya selain logged_out/stopped. Session logged_out TIDAK
 * di-start ulang — malah dijadwalkan hapus otomatis (retensi 5 menit)
 * agar tidak menumpuk, lengkap dengan notifikasi ke owner.
 */
export async function restoreAll(): Promise<{ restored: number; skipped: number }> {
  let restored = 0;
  let skipped = 0;
  let sessions: Array<{ id: string }> = [];
  try {
    sessions = await prisma.session.findMany({
      where: { status: { notIn: ['logged_out', 'stopped'] } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
  } catch {
    return { restored: 0, skipped: 0 };
  }
  for (const s of sessions) {
    try {
      assertValidSessionId(s.id);
    } catch {
      skipped += 1;
      continue;
    }
    try {
      await start(s.id);
      restored += 1;
    } catch {
      skipped += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, RESTORE_GAP_MS));
  }
  // Sweeper: session yang sudah logged_out sebelum restart ikut dijadwalkan
  // hapus otomatis (notifikasi terkirim dari scheduleLoggedOutCleanup).
  try {
    const leftovers = await prisma.session.findMany({
      where: { status: 'logged_out' },
      select: { id: true },
    });
    for (const s of leftovers) {
      try {
        assertValidSessionId(s.id);
      } catch {
        continue;
      }
      try {
        await scheduleLoggedOutCleanup(s.id);
      } catch {
        // Abaikan per-session.
      }
    }
  } catch {
    // DB bermasalah; abaikan.
  }
  return { restored, skipped };
}

/** Hentikan semua koneksi (dipakai saat shutdown bila diperlukan). */
export async function stopAll(logout: boolean): Promise<void> {
  const ids = [...getStore().sessions.keys()];
  for (const id of ids) {
    try {
      await stop(id, logout);
    } catch {
      // Abaikan per-session.
    }
  }
}
