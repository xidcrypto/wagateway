import 'server-only';

import type { SessionEvent } from './session-manager';

/**
 * Bus live dalam proses (Fase live-SSE).
 * Meneruskan SessionEvent ke semua subscriber SSE yang cocok (filter owner
 * dilakukan di route, di sini hanya fan-out). Disimpan di globalThis agar
 * tidak ganda saat HMR — ikut pola singleton session-manager/blast-worker.
 *
 * Catatan batas: bus ini in-memory satu proses. Deploy kita 1 instance PM2
 * fork, jadi cocok. Bila kelak multi-instance, ganti dengan Redis pub/sub.
 */

export type LiveListener = (ev: SessionEvent) => void;

type LiveBusStore = {
  listeners: Set<LiveListener>;
};

function getStore(): LiveBusStore {
  const g = globalThis as unknown as { __pansaLiveBus?: LiveBusStore };
  if (!g.__pansaLiveBus) {
    g.__pansaLiveBus = { listeners: new Set() };
  }
  return g.__pansaLiveBus;
}

/** Daftarkan pendengar (dikembalikan fungsi unsubscribe). */
export function onLiveEvent(listener: LiveListener): () => void {
  const store = getStore();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

/** Siarkan satu event ke semua subscriber SSE. Tidak pernah melempar. */
export function publishLive(ev: SessionEvent): void {
  for (const listener of getStore().listeners) {
    try {
      listener(ev);
    } catch {
      // Subscriber yang gagal tidak boleh menjatuhkan pengirim.
    }
  }
}

/** Jumlah subscriber aktif (untuk log/debug). */
export function liveSubscriberCount(): number {
  return getStore().listeners.size;
}
