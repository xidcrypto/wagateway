import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-500',
  secondary: 'border border-zinc-700 text-zinc-200 hover:bg-zinc-800',
  danger: 'bg-red-700 text-white hover:bg-red-600',
  ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
