'use client';

import { useEffect, useState } from 'react';

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
