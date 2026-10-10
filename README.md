# Pansa Gateway

Gateway WhatsApp multi-user. Satu nomor atau banyak nomor, semua dikelola
dari satu dasbor — atau langsung tembak lewat REST API.

Isinya: kirim pesan (teks, media, tombol interaktif, dll), blast massal pakai
variabel `{{nama}}`, kelola grup, webhook buat notifikasi real-time, dan API
key per user. Backend + frontend jadi satu project Next.js, database MySQL,
koneksi WA-nya pakai Baileys.

## Mulai cepat

Butuh Node.js 20+ dan MySQL 8.

```bash
git clone https://github.com/xidcrypto/wagateway.git
cd wagateway
npm ci
cp .env.example .env
```

Buka `.env`, isi yang penting dulu:

- `DATABASE_URL` — koneksi MySQL, misal `mysql://user:pass@localhost:3306/pansa_gateway`
- `JWT_SECRET` — string acak, minimal 32 karakter
- `MASTER_API_KEY` — string acak juga, ini kunci admin darurat
- `SEED_ADMIN_*` — username, email, nama, password admin pertama

Bikin string acak gampang:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Lanjut:

```bash
npm run db:deploy   # siapin tabel di database
npm run build       # build
npm run dev         # jalan di http://localhost:3000
```

Buka browser, daftar akun, login, terus ke halaman Sessions → buat session →
scan QR dari HP. Kalau statusnya udah `open`, berarti beres dan siap dipakai.

## Pengaturan di .env

Contoh lengkapnya ada di `.env.example`, tinggal copy. Yang sering ditanya:

- `SITE_URL` — isi URL publik kalau udah deploy (misal `https://domainmu.id`).
  Dipakai buat canonical + sitemap biar SEO-nya bener.
- `MAX_SESSIONS_PER_USER` — batas koneksi per user, default 2. Admin nggak kena batas ini.
- `REGISTRATION_ENABLED` — `false` kalau mau pendaftaran ditutup (cuma admin yang bisa bikin akun).
- `SMTP_*` — buat email reset password. Kalau dikosongin, fitur lupa password bales 503, nggak error aneh-aneh kok.
- `GLOBAL_WEBHOOK_URL` — webhook cadangan kalau user belum set webhook sendiri.
- `RATE_LIMIT_*` — batas request per 15 menit, defaultnya udah wajar.
- `TRUST_PROXY` — set `true` kalau di belakang nginx, biar deteksi IP-nya bener.

Nama web + tagline + SMTP juga bisa diubah lewat panel admin, nggak harus
ngutak-atik file.

## Perintah yang dipakai sehari-hari

```bash
npm run dev         # dev + hot reload
npm run build       # build produksi
npm start           # jalanin hasil build
npm run lint        # cek eslint
npm run db:migrate  # bikin migrasi baru (waktu nambah tabel)
npm run db:deploy   # jalanin migrasi di server (nggak bikin file baru)
```

## Naik ke VPS

Gue jalanin pakai PM2 1 instance (jangan cluster, koneksi WA-nya WebSocket
yang harus hidup terus di satu proses). Jangan taruh di Vercel/serverless.

```bash
npm ci
npm run db:deploy
npm run build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

nginx tinggal reverse proxy ke `127.0.0.1:3000` + pasang TLS. Jangan lupa di
`.env` produksi: `TRUST_PROXY=true` sama `SITE_URL` diisi domain asli, terus
`pm2 restart pansa-gateway`.

## Pakai dari dasbor

1. Daftar + login.
2. **Sessions** — buat session, tautkan HP (scan QR atau kode pairing).
3. **Chat** — balas chat langsung dari sini.
4. **Blast** — tulis template misal `Halo {{nama}}, ada promo nih`, tempel
   daftar nomor, atur jeda, jalanin. Bisa dijeda/dilanjutin kapan aja.
5. **Grup / Kontak / Pesan** — sesuai namanya.
6. **Pengaturan** — profil, webhook pribadi, API key (`pn-...`), ganti password.

Kalau akunmu admin, ada menu **Admin** tambahan: atur user, lihat semua
session, audit pesan, setting web + SMTP.

## Pakai dari API

Header-nya `x-api-key: pn-...` (diambil dari menu Pengaturan) atau
`Authorization: Bearer <jwt>`. Semua respons bentuknya
`{ success: true, data }`, kalau gagal `{ success: false, error: "..." }`
(pesannya Bahasa Indonesia).

```bash
# bikin session
curl -X POST -H "x-api-key: pn-ISI-API-KEY" -H "Content-Type: application/json" \
  -d '{"label":"CS-1"}' \
  https://domainmu.id/api/sessions

# kirim teks (session harus open dulu)
curl -X POST -H "x-api-key: pn-ISI-API-KEY" -H "Content-Type: application/json" \
  -d '{"to":"62812xxxxxxx","text":"Halo dari API!"}' \
  https://domainmu.id/api/sessions/SESSION_ID/send/text

# cek koneksi
curl -H "x-api-key: pn-ISI-API-KEY" \
  https://domainmu.id/api/sessions/SESSION_ID/status
```

Dokumentasi lengkap 60+ endpoint + contoh curl per endpoint ada di halaman
`/docs` (login dulu). Kode error standar: 400 validasi, 401 belum login,
403 bukan milikmu, 404 nggak ketemu, 409 session belum `open` / batas kena,
413 file kebesaran, 429 kena rate limit.

## Isi project

```
src/app/            # halaman web + REST API (folder api/)
src/components/     # komponen UI
src/lib/server/     # logika server: session-manager, blast-worker, webhook, dll
src/lib/client/     # api.ts (satu pintu ke backend), hooks
prisma/             # schema + migrasi + seed
instrumentation.ts  # jalan tiap boot: seed admin, pulihin session, lanjutin blast
ecosystem.config.cjs# config PM2
```

Aturan main: nggak ada Express/server.js sendiri, nggak ada proses Node kedua,
semua server logic di dalam Next.js (Route Handler + `lib/server`).

## Catatan

- Blast ratusan nomor sekaligus rawan kena limit WhatsApp. Kasih jeda yang
  wajar (default 3–5 detik antar nomor).
- Dasbor update pakai polling 3 detik, berhenti sendiri kalau tab disembunyiin.
- Cuma landing `/` yang diindex Google. Halaman login/dashboard/admin sengaja
  `noindex`, jadi aman.
- Lupa password butuh SMTP. Belum diisi ya fiturnya bales 503.
