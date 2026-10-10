import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';
import { getSiteInfo } from '@/lib/server/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { siteName, siteTagline } = await getSiteInfo();
    return {
      title: `${siteName} — Gateway WhatsApp untuk bisnismu`,
      description:
        siteTagline || 'Tautkan nomor WhatsApp, kirim pesan, kelola grup, dan blast massal dari satu dasbor.',
    };
  } catch {
    return {
      title: 'Pansa Gateway — Gateway WhatsApp untuk bisnismu',
      description:
        'Tautkan nomor WhatsApp, kirim pesan, kelola grup, dan blast massal dari satu dasbor.',
    };
  }
}

export default function Home() {
  // Catatan: redirect login→dasbor tetap ditangani halaman /login.
  // Landing ini publik; pengunjung yang belum login melihat penawaran,
  // yang sudah login cukup klik Masuk / buat akun.
  return <LandingPage />;
}
