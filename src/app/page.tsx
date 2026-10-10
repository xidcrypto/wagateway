import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';
import { getSiteInfo } from '@/lib/server/settings';
import { getSiteUrl } from '@/lib/server/site-url';

export const dynamic = 'force-dynamic';

const DESC =
  'Tautkan nomor WhatsApp, kirim pesan, kelola grup, dan blast massal dari satu dasbor.';

export async function generateMetadata(): Promise<Metadata> {
  let siteName = 'Pansa Gateway';
  let tagline = '';
  try {
    const info = await getSiteInfo();
    siteName = info.siteName;
    tagline = info.siteTagline;
  } catch {
    // Fallback default.
  }
  const title = `${siteName} — Gateway WhatsApp untuk bisnismu`;
  const description = tagline || DESC;
  return {
    title,
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      url: '/',
      siteName,
      title,
      description,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    // Satu-satunya halaman yang boleh terindex Google.
    robots: {
      index: true,
      follow: true,
    },
  };
}

function JsonLd({ siteName, siteUrl }: { siteName: string; siteUrl: string }) {
  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteName,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'id',
    description: DESC,
    url: siteUrl,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Apakah nomor WhatsApp saya aman?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kredensial session tersimpan di server ini, bukan di pihak ketiga.',
        },
      },
      {
        '@type': 'Question',
        name: 'Perlu HP tetap online?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tidak. Setelah ditautkan, session berjalan mandiri lewat koneksi server.',
        },
      },
      {
        '@type': 'Question',
        name: 'Harus bisa coding untuk memakai ini?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tidak. Kirim pesan, kelola grup, dan blast massal bisa dari dasbor tanpa coding.',
        },
      },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(software) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
    </>
  );
}

export default async function Home() {
  // Catatan: redirect login→dasbor tetap ditangani halaman /login.
  // Landing ini publik; pengunjung yang belum login melihat penawaran,
  // yang sudah login cukup klik Masuk / buat akun.
  let siteName = 'Pansa Gateway';
  try {
    siteName = (await getSiteInfo()).siteName;
  } catch {
    // Fallback default.
  }
  return (
    <>
      <JsonLd siteName={siteName} siteUrl={getSiteUrl()} />
      <LandingPage />
    </>
  );
}
