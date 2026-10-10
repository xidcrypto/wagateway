import type { ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/client/cn';

const buttonVariants = cva(
  'pressable inline-flex items-center justify-center gap-2 rounded-control text-sm font-semibold transition min-h-10 px-4 py-2 disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4',
  {
    variants: {
      variant: {
        primary:
          'text-white shadow-2 hover:brightness-110 bg-gradient-to-r from-primary to-gradient-to',
        secondary: 'border border-border bg-card text-foreground hover:bg-muted',
        danger: 'bg-status-failed text-white hover:brightness-110',
        ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted',
      },
      size: {
        sm: 'min-h-9 px-3 text-[13px]',
        md: 'min-h-10 px-4',
        lg: 'min-h-11 px-5 text-[15px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ variant, size, className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    />
  );
}
