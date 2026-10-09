'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

let pushToast: ((kind: ToastKind, message: string) => void) | null = null;

/** Panggil dari mana saja untuk menampilkan toast. */
export function toast(kind: ToastKind, message: string): void {
  pushToast?.(kind, message);
}

const KIND_CLASS: Record<ToastKind, string> = {
  success: 'border-emerald-800 bg-emerald-950 text-emerald-200',
  error: 'border-red-800 bg-red-950 text-red-200',
  info: 'border-zinc-700 bg-zinc-900 text-zinc-200',
};

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 1;
    pushToast = (kind, message) => {
      const id = nextId++;
      setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto flex w-full max-w-sm flex-col gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${KIND_CLASS[t.kind]}`}
          >
            <span>{t.message}</span>
            <button
              type="button"
              aria-label="Tutup"
              className="rounded p-0.5 hover:bg-black/20"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
