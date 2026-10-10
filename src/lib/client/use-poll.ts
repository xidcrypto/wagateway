'use client';

import { useEffect, useRef } from 'react';

/**
 * Polling cerdas: interval berhenti saat tab tidak terlihat,
 * lanjut saat kembali. Hindari render ulang bila data sama
 * (tugas pemanggil: bandingkan sebelum setState).
 */
export function useVisiblePoll(fn: () => void, intervalMs: number, active = true): void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    function tick(): void {
      if (document.visibilityState === 'visible') fnRef.current();
    }
    function start(): void {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
    }
    function stop(): void {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function onVisibility(): void {
      if (document.visibilityState === 'visible') {
        fnRef.current();
        start();
      } else {
        stop();
      }
    }

    fnRef.current();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, active]);
}
