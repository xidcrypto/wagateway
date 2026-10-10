import type { ReactNode } from 'react';
import { cn } from '@/lib/client/cn';

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-card border border-border bg-card p-4 shadow-1 sm:p-5',
        className,
      )}
    >
      {title || action ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h2 className="font-display text-[17px] font-semibold text-foreground">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
