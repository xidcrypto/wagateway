'use client';

import { useMemo, useState } from 'react';
import { BookOpenText, Copy, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Fields';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/client/cn';

export type ApiEndpoint = {
  method: string;
  path: string;
  desc: string;
  auth: 'login' | 'admin' | 'publik';
  body?: string;
  notes?: string;
};

const ENDPOINTS: ApiEndpoint[] = [
  { method: 'GET', path: '/api/health', desc: 'Cek status server.', auth: 'publik' },
  { method: 'GET', path: '/api/site-info', desc: 'Nama web + tagline + status registrasi.', auth: 'publik' },
  { method: 'POST', path: '/api/auth/login', desc: 'Login username/email + password → token JWT.', auth: 'publik', body: '{"identifier":"admin","password":"••••••"}' },
  { method: 'POST', path: '/api/auth/register', desc: 'Daftar akun (bila registrasi dibuka admin).', auth: 'publik', body: '{"username":"…","email":"…","password":"…","fullName":"…"}' },
  { method: 'POST', path: '/api/auth/forgot-password', desc: 'Minta kode reset 6 digit via email.', auth: 'publik', body: '{"email":"…"}' },
  { method: 'POST', path: '/api/auth/reset-password', desc: 'Tukar kode + password baru.', auth: 'publik', body: '{"email":"…","code":"123456","password":"…"}' },
  { method: 'GET', path: '/api/stats', desc: 'Statistik milik sendiri + deret 7 hari + aktivitas.', auth: 'login' },
  { method: 'GET', path: '/api/me', desc: 'Profil sendiri (termasuk status API key).', auth: 'login' },
  { method: 'PATCH', path: '/api/me', desc: 'Ubah profil (nama, email, telepon, avatar).', auth: 'login', body: '{"fullName":"…"}' },
  { method: 'PUT', path: '/api/me/password', desc: 'Ganti password (wajib password lama).', auth: 'login', body: '{"oldPassword":"…","newPassword":"…"}' },
  { method: 'PUT', path: '/api/me/webhook', desc: 'Set/hapus webhook URL + secret.', auth: 'login', body: '{"url":"https://…","secret":"…"}' },
  { method: 'GET', path: '/api/me/api-key', desc: 'Status API key (tanpa nilai mentah).', auth: 'login' },
  { method: 'POST', path: '/api/me/api-key', desc: 'Buat API key baru (409 bila sudah ada).', auth: 'login' },
  { method: 'PUT', path: '/api/me/api-key', desc: 'Rotasi API key (lama langsung mati).', auth: 'login' },
  { method: 'DELETE', path: '/api/me/api-key', desc: 'Hapus API key.', auth: 'login' },
  { method: 'GET', path: '/api/sessions', desc: 'Daftar session milik sendiri (admin: semua).', auth: 'login' },
  { method: 'POST', path: '/api/sessions', desc: 'Buat session (auto-start QR).', auth: 'login', body: '{"label":"utama"}' },
  { method: 'GET', path: '/api/sessions/:id', desc: 'Detail session.', auth: 'login' },
  { method: 'PATCH', path: '/api/sessions/:id', desc: 'Ubah label session.', auth: 'login', body: '{"label":"baru"}' },
  { method: 'DELETE', path: '/api/sessions/:id', desc: 'Hapus session (= stop + hapus kredensial + pesan).', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/start', desc: 'Start session.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/stop', desc: 'Stop (logout true = hapus kredensial).', auth: 'login', body: '{"logout":false}' },
  { method: 'GET', path: '/api/sessions/:id/status', desc: 'Status + nomor + nama WA.', auth: 'login' },
  { method: 'GET', path: '/api/sessions/:id/qr', desc: 'QR data URL PNG (untuk scan).', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/pairing', desc: 'Minta kode pairing 8 char (wajib phone).', auth: 'login', body: '{"phone":"62812…"}' },
  { method: 'DELETE', path: '/api/sessions/:id/pairing', desc: 'Batalkan pairing.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/send/text', desc: 'Kirim teks (409 bila belum open).', auth: 'login', body: '{"to":"62812…","text":"Halo"}' },
  { method: 'POST', path: '/api/sessions/:id/send/image', desc: 'Kirim gambar + caption opsional.', auth: 'login', body: '{"to":"62812…","media":"https://…","caption":"…"}' },
  { method: 'POST', path: '/api/sessions/:id/send/video', desc: 'Kirim video (gif opsional).', auth: 'login', body: '{"to":"62812…","media":"https://…","gif":false}' },
  { method: 'POST', path: '/api/sessions/:id/send/audio', desc: 'Kirim audio (ptt = voice note).', auth: 'login', body: '{"to":"62812…","media":"https://…","ptt":false}' },
  { method: 'POST', path: '/api/sessions/:id/send/document', desc: 'Kirim dokumen + nama file.', auth: 'login', body: '{"to":"62812…","media":"https://…","filename":"dok.pdf"}' },
  { method: 'POST', path: '/api/sessions/:id/send/sticker', desc: 'Kirim stiker (wajib webp).', auth: 'login', body: '{"to":"62812…","media":"https://…"}' },
  { method: 'POST', path: '/api/sessions/:id/send/location', desc: 'Kirim lokasi + nama + alamat.', auth: 'login', body: '{"to":"62812…","latitude":-6.2,"longitude":106.8}' },
  { method: 'POST', path: '/api/sessions/:id/send/contact', desc: 'Kirim kontak vCard.', auth: 'login', body: '{"to":"62812…","contact":{"displayName":"Budi"}}' },
  { method: 'POST', path: '/api/sessions/:id/send/poll', desc: 'Kirim polling (2–12 opsi).', auth: 'login', body: '{"to":"62812…","question":"…?","options":["A","B"]}' },
  { method: 'POST', path: '/api/sessions/:id/send/buttons', desc: 'Tombol interaktif (maks 10 + header gambar).', auth: 'login', body: '{"to":"62812…","text":"…","buttons":[{"type":"reply","id":"ya","text":"Ya"}]}' },
  { method: 'POST', path: '/api/sessions/:id/send/buttonv2', desc: 'Balas cepat klasik (maks 3 reply).', auth: 'login', body: '{"to":"62812…","text":"…","buttons":[{"id":"ya","text":"Ya"}]}' },
  { method: 'POST', path: '/api/sessions/:id/send/list', desc: 'List sections + rows (maks 10 section).', auth: 'login', body: '{"to":"62812…","text":"…","sections":[{"title":"Menu","rows":[{"title":"Nasi"}]}]}' },
  { method: 'POST', path: '/api/sessions/:id/send/carousel', desc: 'Carousel 1–10 card (tiap card wajib gambar/video).', auth: 'login', body: '{"to":"62812…","cards":[{"image":"https://…","buttons":[{"id":"b","text":"Beli"}]}]}' },
  { method: 'GET', path: '/api/sessions/:id/messages/history', desc: 'Riwayat pesan (filter remote_jid/direction/q).', auth: 'login' },
  { method: 'GET', path: '/api/sessions/:id/messages/conversations', desc: 'Daftar kontak + pesan terakhir.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/messages/react', desc: 'Beri reaksi emoji.', auth: 'login', body: '{"messageId":"…","emoji":"👍"}' },
  { method: 'POST', path: '/api/sessions/:id/messages/read', desc: 'Tandai dibaca.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/messages/edit', desc: 'Edit pesan teks keluar.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/messages/delete', desc: 'Hapus/tarik pesan.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/messages/forward', desc: 'Teruskan pesan (wajib objek mentah).', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/messages/download-media', desc: 'Unduh media (base64/data URI).', auth: 'login' },
  { method: 'GET', path: '/api/sessions/:id/groups', desc: 'Daftar grup.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/groups/create', desc: 'Buat grup + peserta.', auth: 'login', body: '{"subject":"…","participants":["62812…"]}' },
  { method: 'GET,POST', path: '/api/sessions/:id/groups/metadata', desc: 'Metadata grup.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/groups/name', desc: 'Ubah nama grup.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/groups/description', desc: 'Ubah deskripsi grup.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/groups/leave', desc: 'Keluar grup.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/groups/members', desc: 'Anggota add/remove/promote/demote.', auth: 'login', body: '{"action":"add","participants":["62812…"]}' },
  { method: 'GET', path: '/api/sessions/:id/groups/invite', desc: 'Ambil kode + link undangan.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/groups/revoke', desc: 'Cabut undangan (kode baru).', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/groups/join', desc: 'Gabung via kode/link.', auth: 'login', body: '{"code":"…"}' },
  { method: 'GET,POST', path: '/api/sessions/:id/groups/invite-info', desc: 'Info undangan tanpa gabung.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/groups/settings', desc: 'Pengaturan grup (announcement/locked).', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/groups/ephemeral', desc: 'Pesan sementara (durasi detik).', auth: 'login' },
  { method: 'GET,POST', path: '/api/sessions/:id/groups/join-requests', desc: 'List/approve/reject permintaan gabung.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/presence', desc: 'Set presence (available/composing/…).', auth: 'login', body: '{"presence":"available"}' },
  { method: 'GET,POST', path: '/api/sessions/:id/check-number', desc: 'Cek nomor terdaftar WA (maks 20).', auth: 'login', body: '{"number":"62812…"}' },
  { method: 'GET,PUT,DELETE', path: '/api/sessions/:id/profile-picture', desc: 'Foto profil (GET tanpa number = milik sendiri).', auth: 'login' },
  { method: 'GET', path: '/api/sessions/:id/about', desc: 'Status/about kontak.', auth: 'login' },
  { method: 'GET', path: '/api/sessions/:id/blocklist', desc: 'Daftar blokir.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/block', desc: 'Blokir kontak.', auth: 'login', body: '{"number":"62812…"}' },
  { method: 'POST', path: '/api/sessions/:id/unblock', desc: 'Buka blokir kontak.', auth: 'login', body: '{"number":"62812…"}' },
  { method: 'POST,PUT', path: '/api/sessions/:id/profile/name', desc: 'Ubah nama profil (1–25).', auth: 'login', body: '{"name":"…"}' },
  { method: 'POST,PUT', path: '/api/sessions/:id/profile/status', desc: 'Ubah status profil (maks 139).', auth: 'login', body: '{"status":"…"}' },
  { method: 'POST', path: '/api/sessions/:id/blasts', desc: 'Buat campaign blast (teks/media/tombol opsional, jeda antar nomor).', auth: 'login', body: '{"label":"…","text":"Halo {{nama}}","recipients":"62812…","delayMin":3000,"delayMax":5000,"mediaJson":{"kind":"image","media":"https://…"},"buttonsJson":{"mode":"buttons","buttons":[…]}}' },
  { method: 'GET', path: '/api/sessions/:id/blasts?limit=&offset=', desc: 'List campaign.', auth: 'login' },
  { method: 'GET', path: '/api/sessions/:id/blasts/:blastId', desc: 'Detail + statistik pending/sent/failed.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/blasts/:blastId/pause', desc: 'Jeda campaign.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/blasts/:blastId/resume', desc: 'Lanjutkan campaign.', auth: 'login' },
  { method: 'POST', path: '/api/sessions/:id/blasts/:blastId/cancel', desc: 'Batalkan campaign.', auth: 'login' },
  { method: 'GET', path: '/api/admin/stats', desc: 'Statistik sistem (user/session/pesan).', auth: 'admin' },
  { method: 'GET', path: '/api/admin/users', desc: 'Daftar semua user.', auth: 'admin' },
  { method: 'POST', path: '/api/admin/users', desc: 'Buat user (dapat apiKey).', auth: 'admin', body: '{"username":"…","email":"…","password":"…","fullName":"…"}' },
  { method: 'PATCH', path: '/api/admin/users/:id', desc: 'Ubah user (role/aktif/password).', auth: 'admin' },
  { method: 'DELETE', path: '/api/admin/users/:id', desc: 'Hapus user (session ikut terlepas).', auth: 'admin' },
  { method: 'GET', path: '/api/admin/sessions', desc: 'Semua session semua user.', auth: 'admin' },
  { method: 'POST', path: '/api/admin/sessions/:id/force-stop', desc: 'Paksa stop session lintas user.', auth: 'admin', body: '{"logout":false}' },
  { method: 'GET', path: '/api/admin/messages', desc: 'Audit pesan lintas user + filter.', auth: 'admin' },
  { method: 'GET,PUT', path: '/api/admin/settings', desc: 'Pengaturan web + SMTP + registrasi.', auth: 'admin' },
  { method: 'POST', path: '/api/admin/settings/test', desc: 'Kirim email tes SMTP.', auth: 'admin', body: '{"to":"email@…"}' },
];

const METHOD_CLASS: Record<string, string> = {
  GET: 'bg-status-open/15 text-status-open',
  POST: 'bg-status-qr/15 text-status-qr',
  PUT: 'bg-status-connecting/15 text-status-connecting',
  PATCH: 'bg-status-connecting/15 text-status-connecting',
  DELETE: 'bg-status-failed/15 text-status-failed',
};

function baseMethod(m: string): string {
  return m.split(',')[0];
}

export function ApiDocsContent({ host }: { host: string }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'semua' | 'login' | 'admin' | 'publik'>('semua');
  const [copied, setCopied] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ENDPOINTS.filter((e) => {
      if (filter !== 'semua' && e.auth !== filter) return false;
      if (!needle) return true;
      return `${e.method} ${e.path} ${e.desc}`.toLowerCase().includes(needle);
    });
  }, [q, filter]);

  async function copy(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast('success', `${label} disalin.`);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast('error', 'Gagal menyalin.');
    }
  }

  const curlAuth = `# JWT (login dulu):\n#   curl -H "Authorization: Bearer PANSA_TOKEN" ${host}/api/me\n# API key per user (tab API Key di Pengaturan):\n#   curl -H "x-api-key: pn-..." ${host}/api/me\n# Master key (admin virtual, dari env server):\n#   curl -H "x-api-key: MASTER..." ${host}/api/admin/stats`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold">API Docs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ENDPOINTS.length} endpoint REST. Semua respons memakai envelope{' '}
          <code className="font-mono">{'{ success, data }'}</code> (sukses) /{' '}
          <code className="font-mono">{'{ success: false, error }'}</code> (gagal). Halaman ini
          hanya bisa diakses setelah login.
        </p>
      </div>

      <Card title="Cara autentikasi">
        <p className="text-sm leading-6 text-muted-foreground">
          Tiga cara (pilih satu): Bearer JWT dari login, <b>x-api-key per user</b> (format{' '}
          <code className="font-mono">pn-…</code>, dibuat di Pengaturan → API Key), atau master key
          admin virtual. User biasa hanya akses data miliknya (403 bila bukan); endpoint{' '}
          <code className="font-mono">/api/admin/*</code> khusus admin.
        </p>
        <pre className="tnum mt-2 overflow-x-auto rounded-control bg-background p-3 font-mono text-xs leading-5">
          {curlAuth}
        </pre>
        <button
          type="button"
          onClick={() => void copy(curlAuth, 'Contoh curl')}
          className="pressable mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-control border border-border px-3 text-[13px] font-semibold hover:bg-muted"
        >
          <Copy size={14} /> {copied === 'Contoh curl' ? 'Tersalin!' : 'Salin contoh'}
        </button>
      </Card>

      <Card title="Kirim pesan cepat">
        <p className="text-sm leading-6 text-muted-foreground">
          Contoh kirim teks ke satu nomor (ganti SESSION_ID). Semua tipe kirim balas{' '}
          <code className="font-mono">{'{ messageId, to, status }'}</code> dan 409 bila session belum{' '}
          <code className="font-mono">open</code>.
        </p>
        <pre className="tnum mt-2 overflow-x-auto rounded-control bg-background p-3 font-mono text-xs leading-5">
{`curl -X POST -H "x-api-key: pn-..." -H "Content-Type: application/json" \\
  -d '{"to":"62812…","text":"Halo dari API"}' \\
  ${host}/api/sessions/SESSION_ID/send/text`}
        </pre>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <TextInput
            aria-label="Cari endpoint"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari: blast, kirim, grup…"
          />
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Filter akses">
          {(['semua', 'login', 'admin', 'publik'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'pressable min-h-9 rounded-full border px-3 text-[13px] font-medium',
                filter === f
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f === 'semua' ? 'Semua' : f}
            </button>
          ))}
        </div>
      </div>

      <p className="tnum text-xs text-muted-foreground" aria-live="polite">
        Menampilkan {list.length} dari {ENDPOINTS.length} endpoint
        {q.trim() ? ` untuk “${q.trim()}”` : ''}.
      </p>

      <ul className="flex flex-col gap-2">
        {list.map((e) => (
          <li key={`${e.method} ${e.path}`} className="rounded-card border border-border bg-card p-3 shadow-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-control px-2 py-0.5 font-mono text-xs font-bold',
                  METHOD_CLASS[baseMethod(e.method)] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {e.method}
              </span>
              <code className="tnum min-w-0 flex-1 break-all font-mono text-[13px] font-semibold">
                {e.path}
              </code>
              <StatusBadge status={e.auth === 'publik' ? 'publik' : e.auth} />
              <button
                type="button"
                aria-label={`Salin ${e.method} ${e.path}`}
                onClick={() => void copy(`${e.method} ${host}${e.path}`, `${e.method} ${e.path}`)}
                className="pressable rounded-control p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy size={14} />
              </button>
            </div>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{e.desc}</p>
            {e.body ? (
              <pre className="tnum mt-1.5 overflow-x-auto rounded-control bg-background p-2.5 font-mono text-xs leading-5">
                {e.body}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>

      {list.length === 0 ? (
        <Card>
          <p className="flex items-center gap-2 py-4 text-center text-sm text-muted-foreground">
            <BookOpenText size={16} /> Tidak ada endpoint yang cocok. Ubah kata kunci atau filter.
          </p>
          <p className="hidden items-center gap-2 text-sm text-muted-foreground">
            <Search size={14} /> Coba kata lain.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
