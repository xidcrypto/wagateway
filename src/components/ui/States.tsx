import type { ReactNode } from 'react';
import { cn } from '@/lib/client/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Memuat">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === rows - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border bg-card px-4 py-10 text-center">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
        <circle cx="28" cy="28" r="24" stroke="var(--primary)" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 5" />
        <circle cx="28" cy="28" r="9" fill="var(--primary)" fillOpacity="0.2" />
        <circle cx="28" cy="28" r="4" fill="var(--primary)" />
      </svg>
      <p className="font-display text-base font-semibold text-foreground">{title}</p>
      {hint ? <p className="max-w-md text-sm leading-6 text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  hint,
  onRetry,
}: {
  message: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-1 rounded-card border border-status-failed/40 bg-status-failed/10 px-4 py-3"
    >
      <p className="text-sm font-semibold text-foreground">{message}</p>
      {hint ? <p className="text-[13px] leading-5 text-muted-foreground">{hint}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="pressable mt-1 min-h-9 rounded-control border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-muted"
        >
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}
