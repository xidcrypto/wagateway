import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { AppProviders } from '@/components/layout/AppProviders';
import { getSiteInfo } from '@/lib/server/settings';
import { getSiteUrl } from '@/lib/server/site-url';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const DEFAULT_DESC =
  'Gateway WhatsApp multi-user — kelola session, chat, grup, dan blast.';

export async function generateMetadata(): Promise<Metadata> {
  let siteName = 'Pansa Gateway';
  let desc = DEFAULT_DESC;
  try {
    const info = await getSiteInfo();
    siteName = info.siteName;
    desc = info.siteTagline || DEFAULT_DESC;
  } catch {
    // Fallback default di atas.
  }
  const siteUrl = getSiteUrl();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: siteName,
      template: `%s · ${siteName}`,
    },
    description: desc,
    applicationName: siteName,
    keywords: [
      'gateway whatsapp',
      'whatsapp api',
      'whatsapp gateway indonesia',
      'blast whatsapp',
      'broadcast whatsapp',
      'chatbot whatsapp',
      'webhook whatsapp',
    ],
    authors: [{ name: siteName }],
    creator: siteName,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'id_ID',
      url: '/',
      siteName,
      title: siteName,
      description: desc,
    },
    twitter: {
      card: 'summary',
      title: siteName,
      description: desc,
    },
    robots: {
      index: false,
      follow: false,
    },
    icons: { icon: '/favicon.ico' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090B' },
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="id" suppressHydrationWarning className="h-full antialiased">
      <body className={`${display.variable} ${body.variable} ${mono.variable} min-h-full`}>
        <AppProviders>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--card)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              },
            }}
          />
        </AppProviders>
      </body>
    </html>
  );
}
