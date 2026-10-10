'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const TITLES: Record<string, { title: string; desc: string }> = {
  '/admin': {
    title: 'Dashboard admin',
    desc: 'Statistik sistem: pengguna, session, pesan, dan aktivitas terakhir.',
  },
  '/admin/users': {
    title: 'Pengguna',
    desc: 'Kelola akun pengguna: tambah, ubah role, aktif/nonaktif, hapus.',
  },
  '/admin/sessions': {
    title: 'Semua session',
    desc: 'Semua session semua user, filter pemilik, paksa stop bila perlu.',
  },
  '/admin/audit': {
    title: 'Audit pesan',
    desc: 'Audit pesan lintas user dengan filter dan paginasi.',
  },
  '/admin/web': {
    title: 'Pengaturan web',
    desc: 'Nama web, pendaftaran user, SMTP, dan tes email.',
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const meta = TITLES[pathname] ?? TITLES['/admin']!;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold">{meta.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{meta.desc}</p>
      </div>
      <div className="min-w-0 flex-1" key={pathname}>
        <div className="page-enter flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
