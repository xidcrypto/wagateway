'use client';

import { useEffect, useRef, useState } from 'react';
import { getToken } from './api';

/**
 * SSE live + fallback polling (pengganti polling rutin).
 *
 * Cara pakai:
 * ```ts
 * const live = useLiveEvents({
 *   onSession: (ev) => { ... },   // qr/connected/disconnected/logged_out/stopped/message/message.status/presence/group/call
 *   onBlast: (ev) => { ... },     // blast.progress
 *   fallbackMs: 8000,              // bila SSE mati > ini, anggap down
 *   pollMs: 5000,                 // interval fallback saat SSE down
 *   onPoll: () => { ... },        // dipanggil tiap pollMs saat SSE down
 *   enabled: true,
 * });
 * // live.connected: true bila SSE tersambung (sembunyikan polling manual)
 * // live.reconnect: paksa reconnect (mis. setelah ganti session)
 * ```
 *
 * - EventSource ke /api/events/stream?token= (browser tak bisa set header).
 * - Auto-reconnect bawaan EventSource (retry tiap ~3 dtk bila putus).
 * - Heartbeat server tiap 25 dtk; watchdog client: bila tidak ada pesan
 *   (termasuk ping) selama fallbackMs → connected=false → pemanggil jalanin
 *   polling manual via onPoll tiap pollMs.
 * - Berhenti saat tab disembunyikan (hemat baterai/DB), lanjut saat kembali.
 */
export type LiveSessionEvent = {
  event: string;
  sessionId: string;
  timestamp: string;
  data: unknown;
};

export type LiveBlastEvent = {
  event: 'blast.progress';
  blastId: number;
  timestamp: string;
  data: {
    sent: number;
    failed: number;
    pending: number;
    status?: string;
    finished?: boolean;
  };
};

export type LiveNotificationEvent = {
  event: 'notification';
  userId: number;
  timestamp: string;
  data: {
    id: string;
    userId: number;
    kind: string;
    title: string;
    body: string | null;
    link: string | null;
    createdAt: string;
  };
};

export function useLiveEvents(opts: {
  onSession?: (ev: LiveSessionEvent) => void;
  onBlast?: (ev: LiveBlastEvent) => void;
  onNotification?: (ev: LiveNotificationEvent) => void;
  onPoll?: () => void;
  fallbackMs?: number;
  pollMs?: number;
  enabled?: boolean;
}): { connected: boolean; reconnect: () => void } {
  const { onSession, onBlast, onNotification, onPoll, fallbackMs = 8000, pollMs = 5000, enabled = true } = opts;
  const [connected, setConnected] = useState(false);
  const [seq, setSeq] = useState(0);
  const cbRef = useRef({ onSession, onBlast, onNotification, onPoll });
  useEffect(() => {
    cbRef.current = { onSession, onBlast, onNotification, onPoll };
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const token = getToken();
    if (!token) return;
    let es: EventSource | null = null;
    let lastMsg = Date.now();
    let stopped = false;
    let alive = false;

    function setAlive(v: boolean): void {
      if (alive === v) return;
      alive = v;
      setConnected(v);
    }

    function markAlive(): void {
      lastMsg = Date.now();
      setAlive(true);
    }

    function connect(): void {
      if (stopped) return;
      try {
        es?.close();
      } catch {
        // Abaikan.
      }
      const tokenParam = token ?? '';
      const source = new EventSource(`/api/events/stream?token=${encodeURIComponent(tokenParam)}`);
      es = source;
      source.addEventListener('ready', () => markAlive());
      source.addEventListener('session', (e) => {
        markAlive();
        try {
          cbRef.current.onSession?.(JSON.parse((e as MessageEvent).data) as LiveSessionEvent);
        } catch {
          // Payload rusak; abaikan.
        }
      });
      source.addEventListener('blast', (e) => {
        markAlive();
        try {
          cbRef.current.onBlast?.(JSON.parse((e as MessageEvent).data) as LiveBlastEvent);
        } catch {
          // Abaikan.
        }
      });
      source.addEventListener('notification', (e) => {
        markAlive();
        try {
          cbRef.current.onNotification?.(JSON.parse((e as MessageEvent).data) as LiveNotificationEvent);
        } catch {
          // Abaikan.
        }
      });
      source.onmessage = () => markAlive();
      source.onerror = () => {
        // EventSource retry otomatis; watchdog di bawah yang menentukan down.
      };
    }

    function onVis(): void {
      if (document.visibilityState === 'visible' && !stopped) {
        lastMsg = Date.now();
        if (!es || es.readyState === EventSource.CLOSED) connect();
      }
    }

    connect();
    document.addEventListener('visibilitychange', onVis);

    // Watchdog: SSE dianggap down bila sunyi > fallbackMs → fallback polling.
    const watch = window.setInterval(() => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') return;
      const silent = Date.now() - lastMsg;
      if (silent > fallbackMs) {
        setAlive(false);
        try {
          cbRef.current.onPoll?.();
        } catch {
          // Abaikan.
        }
      }
    }, pollMs);

    return () => {
      stopped = true;
      window.clearInterval(watch);
      document.removeEventListener('visibilitychange', onVis);
      try {
        es?.close();
      } catch {
        // Abaikan.
      }
      setAlive(false);
    };
    // seq: pemicu reconnect manual. Sengaja tidak depend on callback.
  }, [enabled, seq, fallbackMs, pollMs]);

  return { connected, reconnect: () => setSeq((s) => s + 1) };
}
