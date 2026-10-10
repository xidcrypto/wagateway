# Pansa Gateway

Gateway WhatsApp multi-user: tautkan beberapa nomor WhatsApp, kirim pesan
(13 jenis), kelola grup, jalankan blast massal, terima webhook — semua dari
satu dasbor atau lewat REST API. Satu project Next.js (App Router), database
MySQL via Prisma, koneksi WA via Baileys (WebSocket hidup terus, 1 instance
PM2, bukan serverless).

## Fitur

- **Sessions** — banyak nomor, satu dasbor. Tautkan via scan QR atau kode
  pairing 8 karakter. Maksimal **2 koneksi aktif per user** (admin bebas).
- **Kirim pesan** — teks, gambar, video, audio, dokumen, stiker, lokasi,
  kontak (vCard), polling, tombol, list, carousel, balas cepat.
- **Blast massal** — wizard 3 langkah (pesan + variabel `{{nama}}`, penerima,
  pengaturan), jeda antar-nomor (min efektif 500 ms), jeda/lanjut/batal tanpa
  hilang progres, lanjut otomatis setelah restart.
- **Grup** — buat, anggota (add/remove/promote/demote), invite link, join,
  kunci pengaturan, pesan sementara, persetujuan gabung.
- **Webhook** — pesan masuk, status terkirim/dibaca, perubahan koneksi,
  diteruskan ke URL-mu dengan signature HMAC (`x-pansa-signature`).
- **API key per user** (`pn-…`, header `x-api-key`) + JWT untuk dasbor.
- **Dasbor** — statistik, grafik 7 hari, chat, audit pesan, panel admin,
  tema terang/gelap, responsif 360px ke atas.

## Syarat

- Node.js 20+ (produksi jalan di Node 24)
- MySQL 8 (database + user sudah dibuat)
- PM2 + nginx bila deploy ke VPS (lihat bawah)

## Instalasi lokal

```bash
git clone https://github.com/xidcrypto/wagateway.git
cd wagateway
npm ci
cp .env.example .env
# lalu isi .env (minimal JWT_SECRET, MASTER_API_KEY, DATABASE_URL, SEED_ADMIN_*)
npm run db:deploy    # jalankan migrasi Prisma
npm run build        # prisma generate + next build
npm run dev          # mode dev di http://localhost:3000
# atau produksi lokal:
npm start            # next start (butuh build dulu)
```

Buka `http://localhost:3000` → daftar akun / login → buat session → scan QR
dari HP (Perangkat Tertaut) → status `open`.

## Konfigurasi (.env)

Salin dari `.env.example`. Yang penting:

| Variabel | Wajib | Keterangan |
|---|---|---|
| `SITE_URL` | Produksi | URL publik kanonis, mis. `https://domain-milikmu` (untuk canonical, sitemap, OG) |
| `PORT` | Ya | Port Next.js (`3000`) |
| `JWT_SECRET` | Ya | Secret JWT, minimal 32 karakter acak |
| `MASTER_API_KEY` | Ya | Kunci admin virtual (header `x-api-key`), minimal 32 karakter acak |
| `DATABASE_URL` | Ya | `mysql://user:pass@host:3306/nama_db` |
| `SEED_ADMIN_*` | Ya | Akun admin awal (dibuat otomatis bila tabel users kosong) |
| `SESSIONS_DIR` / `MEDIA_DIR` | Ya | Folder kredensial + media (`./data/...`) |
| `MAX_MEDIA_MB` | Tidak | Batas media, default `64` |
| `MAX_SESSIONS_PER_USER` | Tidak | Batas koneksi per user, default `2` (admin bebas) |
| `CORS_ORIGINS` | Ya | Daftar origin dipisah koma |
| `TRUST_PROXY` | Produksi | `true` bila di belakang nginx (agar IP rate-limit benar) |
| `RATE_LIMIT_*` | Tidak | Global/login/pairing/register/forgot/reset (default di `.env.example`) |
| `SITE_NAME` / `SITE_TAGLINE` | Tidak | Bisa juga diubah via panel admin (DB diutamakan) |
| `REGISTRATION_ENABLED` | Tidak | `true`/`false` pendaftaran publik (bisa via admin) |
| `SMTP_*` / `MAIL_FROM_*` | Opsional | Bila kosong, lupa-password menjawab 503 |
| `GLOBAL_WEBHOOK_URL` (+`_SECRET`) | Opsional | Fallback webhook bila user tidak set sendiri |

Generate secret acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server (HMR) |
| `npm run build` | `prisma generate && next build` |
| `npm start` | Jalankan hasil build (`next start`) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Buat + terapkan migrasi (dev) |
| `npm run db:deploy` | Terapkan migrasi (produksi, tanpa buat file baru) |
| `npm run db:seed` | Seed manual bila perlu |

Urutan deploy: `npm ci` → `npm run db:deploy` → `npm run build` → PM2 start/restart.

## Deploy VPS (PM2 + nginx)

```bash
npm ci
npm run db:deploy
npm run build
pm2 start ecosystem.config.cjs   # 1 instance, fork, next start
pm2 save && pm2 startup          # hidup lagi setelah reboot
```

nginx: reverse proxy ke `127.0.0.1:3000` + TLS (mis. Let's Encrypt).
Set `TRUST_PROXY=true` dan `SITE_URL=https://domain-milikmu` di `.env`,
lalu `pm2 restart pansa-gateway`.

> Jangan deploy ke serverless (Vercel dsb): koneksi WebSocket Baileys harus
> hidup terus dalam satu proses.

## Cara pakai (dasbor)

1. Buka `/register` → buat akun → login.
2. **Sessions** → Buat session → tab **Scan QR** / **Kode pairing** →
   tautkan dari HP → status `open` (maks 2 aktif per user).
3. **Chat** — pilih session + kontak, kirim dan balas langsung.
4. **Blast** — wizard: tulis template (`Halo {{nama}}…`), tempel nomor
   penerima, atur jeda → Buat & jalankan → pantau progres.
5. **API Docs** (`/docs`, setelah login) — 60+ endpoint + contoh curl.
6. **Pengaturan** — profil, webhook pribadi, API key (`pn-…`), ganti password.

Khusus admin: menu **Admin** (pengguna, semua session, audit pesan, web/SMTP).

## Cara pakai (API)

Autentikasi: header `x-api-key: pn-…` (API key user, dari menu Pengaturan)
atau `Authorization: Bearer <JWT>`. Respons selalu
`{ success: true, data }` / `{ success: false, error: "…" }` (Bahasa Indonesia).

```bash
# buat session (user biasa: milik sendiri; admin/master: boleh owner_id)
curl -X POST -H "x-api-key: pn-ISI-API-KEY" -H "Content-Type: application/json" \
  -d '{"label":"CS-1"}' \
  https://domain-milikmu/api/sessions

# kirim teks (session harus open, kalau belum: 409)
curl -X POST -H "x-api-key: pn-ISI-API-KEY" -H "Content-Type: application/json" \
  -d '{"to":"62812xxxxxxx","text":"Halo dari API!"}' \
  https://domain-milikmu/api/sessions/SESSION_ID/send/text

# cek status koneksi
curl -H "x-api-key: pn-ISI-API-KEY" \
  https://domain-milikmu/api/sessions/SESSION_ID/status
```

Detail tiap endpoint (parameter, contoh body, kode error 400/401/403/404/409/
413/429): buka `/docs` setelah login, atau baca route di `src/app/api/`.

## Struktur project

```
src/app/            # halaman (landing, auth, dashboard) + REST API (api/**)
src/app/api/        # Route Handlers: auth, me, sessions, admin, stats, health
src/components/    # UI: landing, auth, layout, chat, docs, dashboard, ui
src/lib/server/     # prisma, auth, session-manager, blast-worker, webhook,
                    # media-loader, validators, response, site-url, settings
src/lib/client/     # api.ts terpusat, hooks (polling, count-up, efek)
prisma/             # schema + migrations + seed.ts
instrumentation.ts  # boot: seed admin, restore session, resume blast
ecosystem.config.cjs# PM2 (1 instance fork)
```

Aturan keras: tanpa Express/server.js custom, tanpa proses Node kedua,
tanpa `output: export`, tanpa Edge middleware untuk auth.

## SEO

Hanya landing `/` yang boleh terindex Google (canonical, keywords, Open Graph
`id_ID`, JSON-LD `SoftwareApplication` + `FAQPage`). Login/register + seluruh
area aplikasi `noindex`; `robots.txt` melarang `/login`, `/dashboard`,
`/admin`, `/api`, dsb; `sitemap.xml` hanya berisi `/`. Isi `SITE_URL` di
produksi agar canonical/sitemap benar.

## Batasan yang diketahui

- SMTP kosong → lupa-password 503 (isi `SMTP_*` dulu).
- Blast 100+ nomor sekaligus berisiko dibatasi WhatsApp — pakai jeda wajar.
- Real-time dasbor = polling 3 detik (berhenti saat tab disembunyikan).
