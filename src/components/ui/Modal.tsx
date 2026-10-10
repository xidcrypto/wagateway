import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/client/cn';

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          aria-label={title}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-border bg-card p-4 shadow-3 sm:p-5',
            wide ? 'max-w-2xl' : 'max-w-md',
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Dialog.Title className="font-display text-lg font-semibold text-foreground">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Tutup"
                className="rounded-control p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Dialog konfirmasi destruktif yang menyebut nama objeknya. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
  busy,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="text-sm leading-6 text-foreground">{message}</div>
      <div className="mt-4 flex justify-end gap-2">
        <Dialog.Close asChild>
          <button
            type="button"
            onClick={onCancel}
            className="pressable min-h-10 rounded-control border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Batal
          </button>
        </Dialog.Close>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="pressable min-h-10 rounded-control bg-status-failed px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-55"
        >
          {busy ? 'Memproses…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
