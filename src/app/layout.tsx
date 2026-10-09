import type { Metadata } from "next";
import "./globals.css";
import { getSiteInfo } from "@/lib/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { siteName, siteTagline } = await getSiteInfo();
    return {
      title: siteName,
      description: siteTagline || "Gateway WhatsApp multi-user — kelola session, chat, grup, dan blast.",
    };
  } catch {
    return {
      title: "Pansa Gateway",
      description: "Gateway WhatsApp multi-user — kelola session, chat, grup, dan blast.",
    };
  }
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased dark">
      <body className="min-h-full bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
