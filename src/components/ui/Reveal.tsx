'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/client/cn';

/**
 * Reveal-on-scroll: membungkus blok agar muncul halus saat masuk viewport.
 * Reduced-motion: langsung terlihat (diatur di globals.css + skip observer).
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible');
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      // overflow-clip: konten yang sedang beranimasi translate tidak boleh
      // menambah lebar halaman (penyebab scroll horizontal di landing).
      className={cn('reveal overflow-clip', className)}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
