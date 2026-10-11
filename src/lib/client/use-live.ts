'use client';

import { useEffect, useRef, useState } from 'react';
import { getToken, issueSseToken } from './api';

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
 *   sseOnly: false,               // true = SSE MURNI: watchdog tidak pernah
 *                                 // memanggil onPoll (tidak ada request
 *                                 // berulang); hanya update `connected` +
 *                                 // reconnect otomatis EventSource.
 *   enabled: true,
 * });
 * // live.connected: true bila SSE tersambung (sembunyikan polling manual)
 * // live.reconnect: paksa reconnect (mis. setelah ganti session)
 * ```
 *
 * - EventSource ke /api/events/stream?token= (browser tak bisa set header).
 *   Token di URL adalah token SSE ber-TTL ±60 dtk (POST /api/events/token),
 *   BUKAN JWT login 7-hari — jendela bocor ke log/proxy/history jadi kecil.
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

export type LiveTicketTypingEvent = {
  event: 'ticket.typing';
  ticketId: number;
  fromAdmin: boolean;
  timestamp: string;
};

export type LiveTicketPresenceEvent = {
  event: 'ticket.presence';
  adminOnline: boolean;
  timestamp: string;
};

export type LiveTicketMessageEvent = {
  event: 'ticket.message';
  ticketId: number;
  userId: number;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
};

export function useLiveEvents(opts: {
  onSession?: (ev: LiveSessionEvent) => void;
  onBlast?: (ev: LiveBlastEvent) => void;
  onNotification?: (ev: LiveNotificationEvent) => void;
  onTicketTyping?: (ev: LiveTicketTypingEvent) => void;
  onTicketPresence?: (ev: LiveTicketPresenceEvent) => void;
  onTicketMessage?: (ev: LiveTicketMessageEvent) => void;
  onPoll?: () => void;
  fallbackMs?: number;
  pollMs?: number;
  sseOnly?: boolean;
  enabled?: boolean;
}): { connected: boolean; reconnect: () => void } {
  const { onSession, onBlast, onNotification, onTicketTyping, onTicketPresence, onTicketMessage, onPoll, fallbackMs = 8000, pollMs = 5000, sseOnly = false, enabled = true } = opts;
  const [connected, setConnected] = useState(false);
  const [seq, setSeq] = useState(0);
  const cbRef = useRef({ onSession, onBlast, onNotification, onTicketTyping, onTicketPresence, onTicketMessage, onPoll });
  useEffect(() => {
    cbRef.current = { onSession, onBlast, onNotification, onTicketTyping, onTicketPresence, onTicketMessage, onPoll };
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
      // Tukar JWT → token SSE TTL pendek dulu (async); JWT tak pernah ke URL.
      void (async () => {
        if (stopped) return;
        let sseToken = '';
        try {
          const r = await issueSseToken();
          if (stopped) return;
          sseToken = r.token;
        } catch {
          // Gagal terbitkan (mis. offline sesaat): biarkan watchdog menandai
          // down; EventSource retry berikutnya mencoba lagi.
          return;
        }
        if (stopped) return;
        openSource(sseToken);
      })();
    }

    function openSource(sseToken: string): void {
      if (stopped) return;
      try {
        es?.close();
      } catch {
        // Abaikan.
      }
      const source = new EventSource(`/api/events/stream?token=${encodeURIComponent(sseToken)}`);
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
      source.addEventListener('ticket.typing', (e) => {
        markAlive();
        try {
          cbRef.current.onTicketTyping?.(JSON.parse((e as MessageEvent).data) as LiveTicketTypingEvent);
        } catch {
          // Abaikan.
        }
      });
      source.addEventListener('ticket.presence', (e) => {
        markAlive();
        try {
          cbRef.current.onTicketPresence?.(JSON.parse((e as MessageEvent).data) as LiveTicketPresenceEvent);
        } catch {
          // Abaikan.
        }
      });
      source.addEventListener('ticket.message', (e) => {
        markAlive();
        try {
          cbRef.current.onTicketMessage?.(JSON.parse((e as MessageEvent).data) as LiveTicketMessageEvent);
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

    // Watchdog: SSE dianggap down bila sunyi > fallbackMs.
    // Mode sseOnly: TIDAK pernah memanggil onPoll (nol request berulang);
    // hanya tandai disconnected + coba sambung ulang bila tertutup.
    // EventSource sendiri retry otomatis; reconnect manual via `reconnect()`.
    const watch = window.setInterval(() => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') return;
      const silent = Date.now() - lastMsg;
      if (silent > fallbackMs) {
        setAlive(false);
        if (sseOnly) {
          if (!es || es.readyState === EventSource.CLOSED) connect();
          return;
        }
        try {
          cbRef.current.onPoll?.();
        } catch {
          // Abaikan.
        }
      }
    }, sseOnly ? fallbackMs : pollMs);

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
  }, [enabled, seq, fallbackMs, pollMs, sseOnly]);

  return { connected, reconnect: () => setSeq((s) => s + 1) };
}
