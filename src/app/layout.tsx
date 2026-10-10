import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { AppProviders } from '@/components/layout/AppProviders';
import { getSiteInfo } from '@/lib/server/settings';

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

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { siteName, siteTagline } = await getSiteInfo();
    return {
      title: siteName,
      description: siteTagline || 'Gateway WhatsApp multi-user — kelola session, chat, grup, dan blast.',
    };
  } catch {
    return {
      title: 'Pansa Gateway',
      description: 'Gateway WhatsApp multi-user — kelola session, chat, grup, dan blast.',
    };
  }
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="id" suppressHydrationWarning className="h-full antialiased">
      <head>
        <meta name="theme-color" content="#0A0F1C" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#F5F7FB" media="(prefers-color-scheme: light)" />
      </head>
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
