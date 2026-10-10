'use client';

import { useEffect, useRef, useState } from 'react';

/** Count-up saat nilai berubah; reduced-motion langsung ke angka akhir. */
export function useCountUp(target: number, durationMs = 900): number {
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [value, setValue] = useState(() => (reduceMotion ? target : 0));

  // Count-up sekali per nilai target: animasi rAF, setValue hanya dari
  // callback frame (async). Sengaja tidak memakai done-ref agar target yang
  // berubah (data polling) ikut teranimasi ulang.
  useEffect(() => {
    if (reduceMotion) return;
    let raf = 0;
    const start = performance.now();
    const from = 0;
    function frame(now: number): void {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduceMotion]);

  if (reduceMotion) return target;
  return value;
}

/** Spotlight hover: set --mx/--my dari posisi kursor. */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent): void {
      const rect = el!.getBoundingClientRect();
      el!.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      el!.style.setProperty('--my', `${e.clientY - rect.top}px`);
    }
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);
  return ref;
}
