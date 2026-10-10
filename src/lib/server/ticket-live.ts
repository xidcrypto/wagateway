import 'server-only';

/**
 * Event live khusus tiket CS (typing + presence admin + pesan baru).
 * Disebar lewat bus SSE yang sama (__pansaLiveBus); filter dilakukan
 * di route stream (hanya pihak yang berhak atas tiket itu yang terima).
 *
 * - ticket.typing: { ticketId, fromAdmin } — dikirim saat lawan mengetik,
 *   client menampilkan "… sedang mengetik" lalu hilang sendiri 5 dtk.
 * - ticket.presence: { adminOnline: boolean } — disiarkan saat admin
 *   membuka stream SSE (heartbeat), agar user tahu CS sedang online.
 * - ticket.message: { ticketId, message } — pesan baru masuk thread tanpa
 *   refetch penuh (fallback tetap ada via notifikasi + refetch).
 */

export type TicketTypingWire = {
  event: 'ticket.typing';
  ticketId: number;
  fromAdmin: boolean;
  timestamp: string;
};

export type TicketPresenceWire = {
  event: 'ticket.presence';
  adminOnline: boolean;
  timestamp: string;
};

export type TicketMessageWire = {
  event: 'ticket.message';
  ticketId: number;
  userId: number;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
};

function fanOut(ev: unknown): void {
  try {
    const g = globalThis as unknown as {
      __pansaLiveBus?: { listeners: Set<(e: unknown) => void> };
    };
    const bus = g.__pansaLiveBus;
    if (!bus) return;
    for (const listener of bus.listeners) {
      try {
        listener(ev);
      } catch {
        // Abaikan per-subscriber.
      }
    }
  } catch {
    // Gagal siar tidak masalah; DB tetap sumber kebenaran.
  }
}

/** Siarkan "lawan sedang mengetik" untuk satu tiket. */
export function publishTicketTyping(ticketId: number, fromAdmin: boolean): void {
  fanOut({
    event: 'ticket.typing',
    ticketId,
    fromAdmin,
    timestamp: new Date().toISOString(),
  } satisfies TicketTypingWire);
}

/** Siarkan status online admin (dipanggil saat stream admin tersambung). */
export function publishAdminPresence(adminOnline: boolean): void {
  fanOut({
    event: 'ticket.presence',
    adminOnline,
    timestamp: new Date().toISOString(),
  } satisfies TicketPresenceWire);
}

/** Siarkan pesan tiket baru (agar thread update tanpa refetch). */
export function publishTicketMessage(
  ticketId: number,
  userId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any,
): void {
  fanOut({
    event: 'ticket.message',
    ticketId,
    userId,
    timestamp: new Date().toISOString(),
    data: message,
  } satisfies TicketMessageWire);
}

// --- Presence admin (in-memory, 1 proses, ikut pola singleton lain) ---
// Refcount per admin: stream SSE terbuka = online. Tutup stream terakhir
// = offline. Tanpa timer/heartbeat DB — akurat selama 1 instance PM2.

type PresenceStore = {
  /** userId admin → jumlah stream SSE yang masih terbuka. */
  openStreams: Map<number, number>;
};

const globalForPresence = globalThis as unknown as {
  __pansaAdminPresence?: PresenceStore;
};

function getPresenceStore(): PresenceStore {
  if (!globalForPresence.__pansaAdminPresence) {
    globalForPresence.__pansaAdminPresence = { openStreams: new Map() };
  }
  return globalForPresence.__pansaAdminPresence;
}

/**
 * Tandai satu stream SSE admin terbuka. Mengembalikan fungsi rilis yang
 * WAJIB dipanggil saat stream ditutup. Tiap panggil-rilis menyiarkan
 * status online terbaru ke semua subscriber.
 */
export function adminConnected(adminId: number): () => void {
  try {
    const store = getPresenceStore();
    store.openStreams.set(adminId, (store.openStreams.get(adminId) ?? 0) + 1);
    publishAdminPresence(true);
  } catch {
    // Abaikan.
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      const store = getPresenceStore();
      const left = (store.openStreams.get(adminId) ?? 1) - 1;
      if (left <= 0) store.openStreams.delete(adminId);
      else store.openStreams.set(adminId, left);
      publishAdminPresence(store.openStreams.size > 0);
    } catch {
      // Abaikan.
    }
  };
}

/** True bila ada stream SSE admin yang masih terbuka. */
export function isAnyAdminOnline(): boolean {
  try {
    return getPresenceStore().openStreams.size > 0;
  } catch {
    return false;
  }
}
