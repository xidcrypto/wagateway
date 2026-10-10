import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/client/cn';

const INPUT_CLASS =
  'w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-55';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string };
type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string };
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string };

function Label({ text }: { text: string }) {
  return <span className="text-sm font-medium text-foreground">{text}</span>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="text-[13px] text-status-failed">
      {message}
    </span>
  );
}

export function TextInput({ label, error, className, ...rest }: InputProps) {
  return (
    <label className="flex flex-col gap-1">
      {label ? <Label text={label} /> : null}
      <input
        className={cn(INPUT_CLASS, error && 'border-status-failed focus:border-status-failed', className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      <FieldError message={error} />
    </label>
  );
}

export function TextArea({ label, error, className, ...rest }: TextAreaProps) {
  return (
    <label className="flex flex-col gap-1">
      {label ? <Label text={label} /> : null}
      <textarea
        className={cn(INPUT_CLASS, 'min-h-20', error && 'border-status-failed', className)}
        rows={4}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      <FieldError message={error} />
    </label>
  );
}

export function Select({ label, error, className, children, ...rest }: SelectProps) {
  return (
    <label className="flex flex-col gap-1">
      {label ? <Label text={label} /> : null}
      <select
        className={cn(INPUT_CLASS, error && 'border-status-failed', className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
      <FieldError message={error} />
    </label>
  );
}
