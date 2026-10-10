'use client';

export type ToastKind = 'success' | 'error' | 'info';

export function toast(kind: ToastKind, message: string): void {
  if (typeof window === 'undefined') return;
  import('sonner').then(({ toast: sonner }) => {
    if (kind === 'success') sonner.success(message);
    else if (kind === 'error') sonner.error(message);
    else sonner(message);
  });
}

/** Kompatibilitas: pembungkus lama diganti Toaster global di root layout. */
export function ToastHost({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
