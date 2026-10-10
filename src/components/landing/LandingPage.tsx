'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpenText,
  Check,
  Copy,
  KeyRound,
  Megaphone,
  MessagesSquare,
  QrCode,
  Smartphone,
  Users,
  Webhook,
} from 'lucide-react';
import { getSiteInfo } from '@/lib/client/api';
import { ThemeIconButton } from '@/components/layout/ThemeToggle';
import { Reveal } from '@/components/ui/Reveal';
import { toast } from '@/components/ui/Toast';

const FITUR = [
  {
    icon: Smartphone,
    title: 'Banyak nomor, satu dasbor',
    desc: 'Tautkan beberapa nomor WhatsApp sebagai session terpisah. Pantau status koneksinya sekilas lewat orb denyut — hijau berarti terhubung.',
  },
  {
    icon: MessagesSquare,
    title: 'Kirim 13 jenis pesan',
    desc: 'Teks, gambar, video, audio, dokumen, stiker, lokasi, kontak, polling, sampai tombol interaktif, list, dan carousel.',
  },
  {
    icon: Megaphone,
    title: 'Blast massal pakai variabel',
    desc: 'Satu template “Halo {{nama}}” terkirim personal ke ribuan nomor, dengan jeda antar-nomor, jeda, lanjut, dan pantau progres.',
  },
  {
    icon: Users,
    title: 'Kelola grup lewat API',
    desc: 'Buat grup, atur anggota dan admin, bagikan link undangan, kunci pengaturan, sampai setujui permintaan gabung.',
  },
  {
    icon: Webhook,
    title: 'Webhook real-time',
    desc: 'Pesan masuk, status terkirim/dibaca, dan perubahan koneksi diteruskan ke server-mu dengan tanda tangan HMAC.',
  },
  {
    icon: KeyRound,
    title: 'API key per pengguna',
    desc: 'Setiap akun punya API key sendiri (pn-…). Cukup satu header x-api-key untuk semua endpoint, tanpa ribet OAuth.',
  },
];

const LANGKAH = [
  {
    no: '1',
    title: 'Daftar & buat session',
    desc: 'Buat akun, lalu buat session untuk nomor WhatsApp yang mau ditautkan.',
  },
  {
    no: '2',
    title: 'Tautkan dari HP',
    desc: 'Scan QR atau masukkan kode pairing 8 karakter dari menu Perangkat Tertaut.',
  },
  {
    no: '3',
    title: 'Kirim & otomatisasi',
    desc: 'Kirim pesan dari dasbor, jalankan blast, atau sambungkan API ke aplikasimu.',
  },
];

const FAQ = [
  {
    q: 'Apakah nomor WhatsApp saya aman?',
    a: 'Kredensial session tersimpan di server ini, bukan di pihak ketiga. Stop dengan opsi logout menghapus kredensial sepenuhnya. Jangan bagikan API key ke siapa pun.',
  },
  {
    q: 'Perlu HP tetap online?',
    a: 'Tidak. Setelah ditautkan, session berjalan mandiri lewat koneksi server. HP hanya dibutuhkan saat pertama menautkan (scan QR / pairing) dan bila keluar dari HP.',
  },
  {
    q: 'Berapa nomor yang bisa ditautkan?',
    a: 'Tidak ada batas bawaan — setiap nomor menjadi satu session. Blast mendukung sampai 50.000 penerima per campaign dengan jeda antar-nomor agar terlihat wajar.',
  },
  {
    q: 'Harus bisa coding untuk memakai ini?',
    a: 'Tidak. Kirim pesan, kelola grup, dan blast massal bisa dilakukan dari dasbor tanpa coding. API + webhook tersedia bila ingin dihubungkan ke aplikasi lain.',
  },
  {
    q: 'Apakah ada dokumentasi API?',
    a: 'Ada. Setelah masuk, buka menu API Docs: 60+ endpoint WhatsApp dengan contoh curl siap salin per endpoint.',
  },
];

function LogoMark({ name }: { name: string }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary font-display text-xl font-bold text-primary-foreground">
      {name.trim().charAt(0).toUpperCase() || 'P'}
    </span>
  );
}

export function LandingPage() {
  const [siteName, setSiteName] = useState('Pansa Gateway');
  const [siteTagline, setSiteTagline] = useState(
    'Gateway WhatsApp multi-user — kelola session, chat, grup, dan blast.',
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSiteInfo()
      .then((info) => {
        if (cancelled) return;
        setSiteName(info.siteName);
        if (info.siteTagline) setSiteTagline(info.siteTagline);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const snippet = `curl -X POST -H "x-api-key: pn-ISI-API-KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"62812xxxxxxx","text":"Halo dari API!"}' \\
  "${typeof window !== 'undefined' ? window.location.origin : 'https://domain-milikmu'}/api/sessions/SESSION_ID/send/text"`;

  async function copySnippet(): Promise<void> {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast('success', 'Disalin.');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('error', 'Gagal menyalin.');
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigasi */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label={siteName}>
            <LogoMark name={siteName} />
            <span className="truncate text-base font-semibold tracking-tight">{siteName}</span>
          </Link>
          <nav aria-label="Navigasi landing" className="ml-6 hidden items-center gap-1 md:flex">
            {[
              ['Fitur', '#fitur'],
              ['Cara kerja', '#cara-kerja'],
              ['Contoh API', '#api'],
              ['FAQ', '#faq'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="pressable rounded-control px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeIconButton />
            <Link
              href="/login"
              className="pressable hidden min-h-10 items-center rounded-control px-4 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Mulai gratis
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="dot-grid border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-14 pt-12 sm:px-6 md:grid-cols-2 md:items-center md:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                <span className="orb orb-open inline-block" style={{ width: 8, height: 8 }} aria-hidden />
                Gateway WhatsApp siap produksi
              </p>
              <h1 className="font-display mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                WhatsApp untuk bisnismu, lewat satu dasbor.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{siteTagline}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="pressable inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-1 hover:bg-primary-hover"
                >
                  Buat akun gratis
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#cara-kerja"
                  className="pressable inline-flex min-h-11 items-center rounded-control border border-border bg-card px-5 text-[15px] font-semibold hover:bg-muted"
                >
                  Lihat cara kerja
                </a>
              </div>
              <ul className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
                {['Tanpa install aplikasi tambahan', 'Scan QR sekali, jalan mandiri', 'API + webhook untuk otomatisasi'].map(
                  (t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check size={15} className="shrink-0 text-status-open" />
                      {t}
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* Mock pratinjau dasbor (murni CSS, tanpa gambar) */}
            <Reveal className="w-full" aria-hidden={false}>
              <div className="rounded-panel border border-border bg-card p-0 shadow-2">
                <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-status-closed/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-status-closed/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-status-closed/40" />
                  <span className="ml-2 font-mono text-xs text-muted-foreground">dasbor / sessions</span>
                </div>
                <div className="flex flex-col gap-3 p-4" aria-hidden>
                  <div className="flex items-center gap-3 rounded-card border border-border bg-background p-3">
                    <span className="orb orb-open" style={{ width: 12, height: 12 }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">CS Toko — 62812…</p>
                      <p className="text-xs text-muted-foreground">Terhubung</p>
                    </div>
                    <span className="rounded-full bg-status-open/15 px-2.5 py-1 text-xs font-bold text-status-open">
                      open
                    </span>
                  </div>
                  <div className="rounded-card border border-border bg-background p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Pesan 7 hari terakhir</p>
                    <div className="mt-2 flex h-16 items-end gap-1.5">
                      {[35, 55, 40, 70, 52, 85, 64].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-status-qr/70"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-card border border-border bg-background p-3">
                    <div className="flex items-center justify-between text-xs">
                      <p className="font-semibold">Blast “Promo weekend”</p>
                      <p className="tnum font-mono text-muted-foreground">1.240 / 2.000</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[62%] rounded-full bg-status-open" />
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Fitur */}
        <section id="fitur" className="scroll-mt-20 border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <p className="text-sm font-semibold text-muted-foreground">Fitur utama</p>
              <h2 className="font-display mt-1 text-3xl font-bold tracking-tight">
                Semua kebutuhan WhatsApp operasional
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted-foreground">
                Dari menautkan nomor sampai blast ribuan pesan — tanpa gonta-ganti aplikasi.
              </p>
            </Reveal>
            <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FITUR.map((f, i) => (
                <Reveal as="li" key={f.title} delayMs={Math.min(i, 5) * 60}>
                  <div className="h-full rounded-card border border-border bg-card p-5 shadow-1 transition hover:-translate-y-0.5 hover:shadow-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-muted text-foreground">
                      <f.icon size={19} />
                    </span>
                    <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* Cara kerja */}
        <section id="cara-kerja" className="scroll-mt-20 border-b border-border bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <p className="text-sm font-semibold text-muted-foreground">Cara kerja</p>
              <h2 className="font-display mt-1 text-3xl font-bold tracking-tight">
                Online dalam 3 langkah
              </h2>
            </Reveal>
            <ol className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
              {LANGKAH.map((l, i) => (
                <Reveal as="li" key={l.no} delayMs={i * 80}>
                  <div className="flex h-full gap-4 rounded-card border border-border bg-background p-5 shadow-1">
                    <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                      {l.no}
                    </span>
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-semibold">
                        {l.no === '2' ? <QrCode size={16} className="text-muted-foreground" /> : null}
                        {l.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{l.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Contoh API */}
        <section id="api" className="scroll-mt-20 border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center">
            <Reveal>
              <p className="text-sm font-semibold text-muted-foreground">Untuk developer</p>
              <h2 className="font-display mt-1 text-3xl font-bold tracking-tight">
                Satu pola untuk 60+ endpoint
              </h2>
              <p className="mt-2 max-w-xl text-[15px] leading-7 text-muted-foreground">
                Satu header <code className="font-mono text-foreground">x-api-key</code> untuk
                semuanya. Respons selalu dibungkus{' '}
                <code className="font-mono text-foreground">{'{ success, data }'}</code> dengan
                pesan error Bahasa Indonesia. Dokumentasi lengkap + contoh curl tiap endpoint
                tersedia di menu API Docs setelah masuk.
              </p>
              <Link
                href="/docs"
                className="pressable mt-4 inline-flex min-h-10 items-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold hover:bg-muted"
              >
                <BookOpenText size={16} />
                Buka API Docs
              </Link>
            </Reveal>
            <Reveal delayMs={100}>
              <div className="rounded-panel border border-border bg-card p-4 shadow-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-bold text-muted-foreground">POST /send/text</p>
                  <button
                    type="button"
                    onClick={() => void copySnippet()}
                    aria-label="Salin contoh curl"
                    className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-control border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
                <pre className="tnum overflow-x-auto rounded-control bg-background p-3 font-mono text-xs leading-6">
                  {snippet}
                </pre>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-b border-border bg-card">
          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
            <Reveal>
              <p className="text-sm font-semibold text-muted-foreground">Tanya jawab</p>
              <h2 className="font-display mt-1 text-3xl font-bold tracking-tight">
                Yang sering ditanyakan
              </h2>
            </Reveal>
            <div className="mt-6 flex flex-col gap-2">
              {FAQ.map((f, i) => (
                <Reveal key={f.q} delayMs={Math.min(i, 4) * 50}>
                  <details className="group rounded-card border border-border bg-background px-4 py-3 shadow-1">
                    <summary className="notion-toggle flex cursor-pointer list-none items-center justify-between gap-3 py-1 text-[15px] font-semibold">
                      {f.q}
                      <span
                        aria-hidden
                        className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                      >
                        →
                      </span>
                    </summary>
                    <p className="pb-2 pt-1 text-sm leading-6 text-muted-foreground">{f.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <div className="stripe-accent rounded-panel bg-primary px-6 py-10 text-center text-primary-foreground sm:px-10">
                <h2 className="font-display text-3xl font-bold tracking-tight">
                  Siap menghubungkan WhatsApp bisnismu?
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-[15px] leading-7 opacity-80">
                  Daftar gratis, tautkan nomor pertamamu, dan kirim pesan pertama hari ini juga.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/register"
                    className="pressable inline-flex min-h-11 items-center gap-2 rounded-control bg-card px-5 text-[15px] font-semibold text-foreground shadow-1 hover:opacity-90"
                  >
                    Buat akun gratis
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/login"
                    className="pressable inline-flex min-h-11 items-center rounded-control border border-current px-5 text-[15px] font-semibold opacity-90 hover:opacity-100"
                  >
                    Sudah punya akun? Masuk
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span className="flex items-center gap-2">
            <LogoMark name={siteName} />
            <span className="font-semibold text-foreground">{siteName}</span>
          </span>
          <span className="tnum text-xs">Gateway WhatsApp multi-user · Session · Chat · Blast · API</span>
        </div>
      </footer>
    </div>
  );
}
