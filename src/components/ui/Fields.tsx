import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const INPUT_CLASS =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-emerald-500';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string };
type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string };

function Label({ text }: { text: string }) {
  return <span className="text-sm text-zinc-300">{text}</span>;
}

export function TextInput({ label, ...rest }: InputProps) {
  return (
    <label className="flex flex-col gap-1">
      {label ? <Label text={label} /> : null}
      <input className={INPUT_CLASS} {...rest} />
    </label>
  );
}

export function TextArea({ label, ...rest }: TextAreaProps) {
  return (
    <label className="flex flex-col gap-1">
      {label ? <Label text={label} /> : null}
      <textarea className={INPUT_CLASS} rows={4} {...rest} />
    </label>
  );
}

export function Select({ label, children, ...rest }: SelectProps) {
  return (
    <label className="flex flex-col gap-1">
      {label ? <Label text={label} /> : null}
      <select className={INPUT_CLASS} {...rest}>
        {children}
      </select>
    </label>
  );
}
