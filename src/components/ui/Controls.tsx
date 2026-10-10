'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '@/lib/client/cn';

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <SwitchPrimitives.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="pressable inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-muted px-0.5 transition-colors data-[state=checked]:bg-primary"
    >
      <SwitchPrimitives.Thumb className="block h-5 w-5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitives.Root>
  );
}

export function Menu({
  trigger,
  items,
  label,
}: {
  trigger: ReactNode;
  items: Array<{ label: string; danger?: boolean; onClick: () => void; disabled?: boolean }>;
  label: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild aria-label={label}>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-44 rounded-card border border-border bg-card p-1 shadow-3"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={() => item.onClick()}
              className={cn(
                'flex min-h-10 cursor-pointer items-center rounded-control px-3 text-sm outline-none hover:bg-muted focus:bg-muted disabled:opacity-50',
                item.danger ? 'text-status-failed' : 'text-foreground',
              )}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function TabList({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Tabs.Root value={value} onValueChange={onChange}>
      <Tabs.List
        aria-label="Tab"
        className="flex gap-1 overflow-x-auto rounded-control border border-border bg-card p-1"
      >
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.value}
            value={t.value}
            className="pressable min-h-9 flex-1 whitespace-nowrap rounded-[6px] px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground"
          >
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}

export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 max-w-60 rounded-control border border-border bg-card px-2.5 py-1.5 text-[13px] text-foreground shadow-2"
          >
            {text}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * Tabel responsif: tabel penuh di desktop, daftar kartu di bawah 768px.
 * `cells` berisi sel per baris; `cards` berisi tampilan kartu mobile.
 */
export function ResponsiveTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: Array<{ key: string | number; cells: ReactNode[]; card: ReactNode }>;
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <>{empty ?? null}</>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 bg-card">
              {columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="border-b border-border px-3 py-2 text-left font-semibold text-muted-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                {r.cells.map((cell, i) => (
                  <td key={i} className="tnum px-3 py-2.5 align-top text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <li
            key={r.key}
            className="rounded-card border border-border bg-card px-3 py-2.5"
          >
            {r.card}
          </li>
        ))}
      </ul>
    </>
  );
}
