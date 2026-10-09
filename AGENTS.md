# AGENTS.md: Pansa Gateway

Dokumen ini adalah satu-satunya sumber instruksi untuk proyek **Pansa Gateway**. Isinya: protokol kerja agent, checklist progres, aturan global, dan prompt per fase.

## 0. Protokol Kerja Agent (WAJIB, baca setiap awal sesi)

1. **Baca seluruh file ini dulu**, terutama Bagian 1 (Checklist Progres) dan Bagian 2 (Log Progres), sebelum menulis kode apa pun.
2. **Jangan mengulang pekerjaan.** Step yang sudah dicentang `[x]` dianggap selesai. Jangan menulis ulang, mengganti nama, atau membuat ulang file dari step tersebut. Jika perlu mengubahnya (bug atau dependensi step baru), buka file yang ada, ubah seperlunya, dan catat di Log.
3. **Kerjakan berurutan.** Ambil step pertama yang belum dicentang. Jangan melompat ke fase berikutnya sebelum step "Verifikasi" fase saat ini lulus.
4. **Cek kondisi nyata sebelum mulai step.** Jika ada file yang seharusnya dibuat step ini tapi sudah ada di disk (misal sesi sebelumnya terputus di tengah), lanjutkan dari yang ada, jangan buat ulang.
5. **Setelah menyelesaikan satu step**, langsung perbarui file ini:
   - ubah `[ ]` menjadi `[x]` pada step tersebut,
   - tambah satu baris di Bagian 2 (Log): `YYYY-MM-DD | step | file dibuat/diubah | catatan keputusan atau penyimpangan`.
   Jangan menunda pembaruan ke akhir fase.
6. **Aturan global (Bagian 3) tidak boleh diubah sendiri.** Jika menemukan konflik atau celah, catat di "Catatan Keputusan Tambahan" di Bagian 2 dan ambil keputusan paling konservatif, atau tanyakan ke user.
7. **Output selalu file lengkap dan runnable**, bukan potongan. Jangan menyisakan `TODO` atau placeholder tanpa mencatatnya di Log.
8. Jangan menginstal library di luar stack yang ditetapkan tanpa mencatat alasannya di Log.
9. Di akhir tiap sesi, tulis ringkasan satu paragraf di Log: apa yang selesai, apa step berikutnya, dan masalah yang belum beres.

## 1. Checklist Progres

### Fase 1: Fondasi
- [x] 1.1 Inisialisasi project: `package.json` (versi dipin), `next.config.ts`, Tailwind, `tsconfig`, `ecosystem.config.cjs`, `.env.example`
- [x] 1.2 Prisma: `schema.prisma`, migrasi awal, `lib/server/prisma.ts` (singleton), `prisma/seed.ts`
- [x] 1.3 Helper server: respons standar (termasuk konversi BigInt), validator zod, rate limiter, security headers, CORS, `withAuth`, `withRateLimit`
- [x] 1.4 Route auth dan user: login, `/api/me` (GET/PATCH), password, webhook, `/api/admin/users` (+ `:id`)
- [x] 1.5 Session manager singleton (start, reconnect 5 detik, QR, pairing, stop, restore) + `instrumentation.ts`
- [x] 1.6 Route session: CRUD, start, stop, qr, status, pairing (POST/DELETE)
- [x] 1.7 Frontend minimal: `lib/client/api.ts`, halaman login, placeholder dashboard
- [x] 1.8 **Verifikasi Fase 1** (login, buat session, scan/pairing sampai `open`, restart server lalu session pulih)

### Fase 2: Kirim Pesan + Webhook
- [x] 2.1 Media loader dengan keamanan penuh (SSRF, path traversal, batas ukuran)
- [x] 2.2 Dispatcher webhook (HMAC, validasi URL anti-SSRF, timeout 10 detik)
- [x] 2.3 Pencatat pesan keluar, handler pesan masuk, pembaruan `messages.status`
- [x] 2.4 Route kirim dasar: text, image, video, audio, document, sticker
- [x] 2.5 Route kirim: location, contact (vCard), poll
- [x] 2.6 Route kirim interaktif: buttons, list, carousel, buttonv2
- [x] 2.7 Route manajemen pesan: react, delete, edit, forward, read, history, conversations, download-media
- [x] 2.8 **Verifikasi Fase 2**

### Fase 3: Grup, Utilitas, Admin
- [x] 3.1 Grup inti: list, buat, metadata, nama, deskripsi, keluar
- [x] 3.2 Grup lanjutan: anggota, invite, revoke, join, invite-info, settings, ephemeral, join-requests
- [x] 3.3 Utilitas: presence, check-number, foto profil, about, blocklist, block/unblock, profil nama/status, alias pairing
- [x] 3.4 Admin: stats, semua session, force-stop, audit pesan
- [x] 3.5 **Verifikasi Fase 3**

### Fase 4: Blast
- [x] 4.1 Parser penerima, normalisasi, render template `{{var}}`
- [x] 4.2 Worker blast singleton (delay acak min 500 ms, pause/resume/cancel, resume saat boot)
- [x] 4.3 Route blast: buat, list, detail, pause, resume, cancel
- [ ] 4.4 **Verifikasi Fase 4**

### Fase 5: Frontend
- [x] 5.1 Layout dashboard (sidebar/drawer), auth guard, komponen reusable, tema gelap
- [x] 5.2 Halaman dashboard
- [x] 5.3 Halaman sessions
- [x] 5.4 Halaman chat
- [ ] 5.5 Halaman messages
- [ ] 5.6 Halaman groups
- [ ] 5.7 Halaman contacts
- [ ] 5.8 Halaman blast
- [ ] 5.9 Halaman admin
- [ ] 5.10 Halaman settings
- [ ] 5.11 **Verifikasi Fase 5** (semua halaman memakai API nyata, nyaman di 360px, 401 selalu ke login)

## 2. Log Progres (agent menambah baris di sini)

Format: `tanggal | step | file dibuat/diubah | catatan`

| Tanggal | Step | File | Catatan |
|---|---|---|---|
| 2026-10-09 | 1.1 | package.json, next.config.ts, ecosystem.config.cjs, .env.example | Inisialisasi pin versi stabil (next 16.4.0, prisma 7.10.0, baileys 1.4.3); tsc clean; pertahankan layout src/app |
| 2026-10-09 | 1.2 | prisma/schema.prisma, prisma/migrations/20261009072339_init, src/lib/server/prisma.ts, prisma/seed.ts | Skema final sesuai blok global (output client ke src/generated/prisma); migrasi init applied; install @prisma/adapter-mariadb 7.10.0 + dotenv 18.0.6 (wajib adapter di Prisma 7, dicatat sbg kebutuhan stack); grant CREATE/DROP ke pansa_app untuk shadow DB; seed admin OK |
| 2026-10-09 | 1.3 | src/lib/server/response.ts, rate-limit.ts, auth.ts, validators.ts, prisma.ts | Helper respons (BigInt→string), rate limit in-memory per IP + TRUST_PROXY, withAuth JWT+API key timingSafeEqual + reload user, CORS, security headers, validator zod; prisma.ts diubah lazy-Proxy agar import tidak throw saat build; smoke 24 kasus OK |
| 2026-10-09 | 1.4 | src/app/api/health, auth/login, me, me/password, me/webhook, admin/users(+[id])/route.ts | Login username/email + rate limit 10/15 mnt, /api/me GET/PATCH (409 email duplikat), PUT password wajib lama, PUT webhook validasi anti-SSRF literal, admin CRUD + proteksi diri; wrapper withAuth/withRateLimit diteruskan routeCtx (params async); toPublicUser + validatePublicHttpUrl ditambah ke file step 1.3; smoke 28 kasus OK via dev server |
| 2026-10-09 | 1.5 | src/lib/server/session-manager.ts, instrumentation.ts | Manager singleton globalThis (start/reconnect 5 dtk, QR PNG data URL, pairing/custom 8 char, stop logout true/false, restore jeda 1 dtk); bug logger:undefined crash diperbaiki; live QR muncul ~2 dtk; smoke unit+live OK |
| 2026-10-09 | 1.6 | src/app/api/sessions(+[id] CRUD/start/stop/qr/status/pairing)/route.ts | List milik sendiri (admin semua), buat auto-start QR, guard 403, UUID owner (API key→admin seed), DELETE=stop logout; pairing rate limit 20/15 mnt; perbaiki managerError baca Boom output.statusCode+data + pesan ID; smoke lifecycle+guard+rate limit OK via dev server |
| 2026-10-09 | 1.7 | src/lib/client/api.ts, src/app/(auth)/login/page.tsx, src/app/(dashboard)/dashboard/page.tsx | API client terpusat (Bearer pansatoken, buka envelope, 401→/login), halaman login ID + placeholder dashboard daftar session; /login & /dashboard 200, tsc+lint bersih |
| 2026-10-09 | auth-plus | prisma/schema.prisma, prisma/migrations/20261009084502_auth_settings + 20261009084531_fix_code_hash_column, src/lib/server/settings.ts, src/lib/server/mailer.ts | Model PasswordReset (kode 6 digit sha256, TTL 15 mnt, used) + SystemSetting (key/value); migrasi applied; grant ALTER/INDEX/REFERENCES ON *.* ke pansa_app agar shadow DB bisa replay migrasi awal (P3006/P3018); install nodemailer 6.9.14 + @types 6.4.17 (pin persis, dicatat sbg kebutuhan kirim email) + serverExternalPackages |
| 2026-10-09 | auth-plus | src/app/api/auth/register, forgot-password, reset-password/route.ts | Register publik (role selalu user, 409 duplikat, 403 bila dimatikan, rate limit register 20/15 mnt); forgot kirim kode 6 digit via SMTP (resend 60 dtk, 503 bila SMTP kosong, pesan generik anti-enumerasi); reset tukar kode+password baru (transaksi, kode hangus sekali pakai); smoke e2e OK (register→login→reset→login baru, reuse ditolak) |
| 2026-10-09 | auth-plus | src/app/api/admin/settings(/test)/route.ts, src/app/(auth)/register + forgot-password/page.tsx, login/page.tsx, .env.example | Admin GET/PUT settings (smtp_*, mail_from_*, registration_enabled; secret disamarkan ••••+4digit, port divalidasi, mail_from email); POST /test kirim email tes; UI register + lupa password 2 langkah + link di login; /login /register /forgot-password 200; tsc+lint+build bersih; user/session uji dihapus |
| 2026-10-09 | deploy-publik | ecosystem.config.cjs, .env, /etc/nginx/sites-available/pansa-gateway, src/app/page.tsx | Akses publik via https://hgitopup.web.id: nginx 1.18 reverse proxy → 127.0.0.1:3000 + TLS Let's Encrypt (auto-renew, HTTP redirect 301); PM2 pansa-gateway 1 instance fork online + startup systemd; .env produksi (CORS https domain, TRUST_PROXY=true); / redirect ke /login; verifikasi eksternal OK (health, login 200, session restore 1) |
| 2026-10-09 | 1.8 | src/app/api/sessions(+[id] QR/status)/route.ts, public/scan.html (sementara) | Verifikasi Fase 1 LULUS: login admin via https://hgitopup.web.id, buat session verify-18, scan QR dari HP → status `open` (6288989494927/PANSA STR), restart PM2 → restore 1 dipulihkan + `opened connection to WA`, status tetap `open` tanpa scan ulang |
| 2026-10-09 | 2.1 | src/lib/server/media-loader.ts | Media loader (URL/data URI/path lokal): tolak SSRF literal+DNS+redirect (maks 3, cek tiap hop, termasuk wildcard-DNS nip.io/sslip.io + heksadesimal-IP + suffix berbahaya), tolak traversal (resolve+prefix), 413 bila >MAX_MEDIA_MB, fetch manual-redirect + timeout 15 dtk; uji 28 kasus lolos, tsc+lint bersih |
| 2026-10-09 | 2.2 | src/lib/server/webhook.ts, src/lib/server/media-loader.ts (assertSafeDeliveryUrl), instrumentation.ts, src/app/api/me/webhook/route.ts, .env.example | Dispatcher webhook (URL owner dulu fallback GLOBAL_WEBHOOK_URL(+SECRET); HMAC sha256= + x-pansa-event; anti-SSRF saat kirim + tiap redirect maks 3; timeout 10 dtk; fire-and-forget tanpa retry; listener via onSessionEvent flag globalThis); uji 11 kasus + timeout pas 10 dtk + live stopped/connected via publik (signature HMAC VALID, session tetap open); perbaiki bug PUT /api/me/webhook: secret/url null kini terhapus (pick alias, bukan ??); webhook uji dibersihkan |
| 2026-10-09 | 2.3 | src/lib/server/message-recorder.ts, src/lib/server/message-handlers.ts, src/lib/server/session-manager.ts (listener messages.upsert/update), src/lib/server/send-helpers.ts, src/app/api/sessions/[id]/send/text/route.ts | Pencatat keluar (status awal sent, id string aman BigInt) + update status by waId (naik saja, failed terminal, no-downgrade); handler masuk (unwrap ephemeral/viewOnce, teks dari conversation/caption, buttonResponse 4 format, quoted, fromMe+noise dilewati, payload JSON-safe, dedup waId, append dilewati); uji parser 21/21 + recorder 14/14; live via publik (kirim teks ke 6283129635860 tercatat sent→delivered→read, 2 balasan "Halo" tersimpan direction in, event message+message.status terkirim; pesan uji + webhook dibersihkan) |
| 2026-10-09 | 2.4 | src/app/api/sessions/[id]/send/{image,video,audio,document,sticker}/route.ts, data/media/uji-24.* | Kirim dasar lengkap (text sudah di 2.3): image/video(gifPlayback)/audio(ptt)/document/document/sticker(webp-only), semua via media loader + recordOutgoing + 409 bila belum open; live 6/6 ke 6283129635860 tercatat delivered; penolakan benar (tipe salah, bukan-webp, SSRF 169.254, 403 non-pemilik, 409 belum open); user+session+pesan uji dibersihkan |
| 2026-10-09 | 2.5 | src/app/api/sessions/[id]/send/{location,contact,poll}/route.ts | Kirim location (lat/long divalidasi, nama+alamat), contact (vCard 3.0 single/array maks 10), poll single choice (selectableCount 1, 2-12 opsi); live 3/3 ke 6283129635860 tercatat delivered; penolakan benar (lat invalid, 1 opsi, kontak kosong); pesan uji dibersihkan |
| 2026-10-09 | 2.6 | src/lib/server/interactive.ts, src/app/api/sessions/[id]/send/{buttons,list,carousel,buttonv2}/route.ts | Kirim interaktif: buttons nativeFlow (reply/url/copy/call, header gambar opsional), list klasik (sections+rows, rowId otomatis), carousel (1-10 card, tiap card wajib gambar/video via media loader), buttonv2 quick-reply klasik (maks 3, reply saja); live 4/4 ke 6283129635860 tercatat (buttons+list read); penolakan benar (buttons kosong, buttonv2 4 tombol, buttonv2 url, card tanpa media, sections kosong); payload DB tanpa buffer media; pesan uji dibersihkan |
| 2026-10-09 | 2.7 | src/lib/server/message-actions.ts, src/app/api/sessions/[id]/messages/{react,delete,edit,forward,read,history,conversations,download-media}/route.ts | Manajemen pesan: react (emoji), delete (revoke + hapus DB), edit (teks out + update DB), forward (wajib objek mentah, revive bytes, dicatat), read (readMessages), history (filter remote_jid/direction/q/limit/offset), conversations ($queryRaw group remoteJid + pesan terakhir), download-media (base64+data URI via downloadMediaMessage, reupload via updateMediaMessage); live penuh ke 6283129635860 (kirim 21 → react → read → edit → forward 22 → delete 21+22); unit helper 8/8; penolakan benar (emoji kosong, pesan hilang, teks kosong, forward invalid, outgoing tanpa payload, direction salah, 403 non-pemilik, 401 tanpa token); user+pesan uji dibersihkan |
| 2026-10-09 | 2.8 | (verifikasi, tanpa file baru) | Verifikasi Fase 2 LULUS: PM2 online + session open + tsc bersih; SSRF ditolak media loader (169.254, localhost, traversal) + validasi webhook (169.254, localhost); webhook E2E via webhook.site (set URL+secret, kirim teks→message.status HMAC VALID, balasan HP "Uji 2.8"→tersimpan in id 25 + event message HMAC VALID, delivered/read susulan VALID); re-verifikasi kirim (teks 23 + image 24 → delivered di DB); pesan uji + webhook uji dibersihkan (0 sisa) |
| 2026-10-09 | 3.1 | src/lib/server/groups.ts, src/lib/server/session-manager.ts (wiring event group), src/app/api/sessions/[id]/groups/{route,create,metadata,name,description,leave}/route.ts | Grup inti: list (groupFetchAllParticipating), buat (subject+peserta dinormalisasi), metadata (query/body jid), rename, deskripsi, leave; event Baileys groups.upsert/update + group-participants.update diteruskan sebagai webhook event `group`; live penuh (buat 120363412044688462@g.us 2 peserta → metadata → rename → deskripsi → list 1 → leave → list 0); unit helper 8/8; penolakan benar (jid salah, peserta kosong/salah, 403 non-pemilik, 401 tanpa token); grup uji + user uji dibersihkan |
| 2026-10-09 | 3.2 | src/lib/server/groups.ts (assertEphemeralDuration, extractInviteCode, assertGroupSetting, assertParticipantAction, assertJoinRequestAction, resolveGroupParticipantJids), src/app/api/sessions/[id]/groups/{members,invite,revoke,join,invite-info,settings,ephemeral,join-requests}/route.ts | Grup lanjutan: anggota add/remove/promote/demote (resolve PN→LID aktual via metadata), invite (kode+link), revoke (kode baru), join (kode/link, 404 jelas bila invalid), invite-info (tanpa jadi anggota), settings (announcement/not_announcement/locked/unlocked), ephemeral (0/86400/604800/7776000), join-requests list+approve/reject; semua route cek groupMetadata dulu → 404 jelas (query ke JID tak dikenal tidak dijawab WA → hang); live (buat 3 grup uji → invite/info/revoke locked/unlocked ephemeral announcement pair → leave semua, list 0); invite grup yang pesertanya keluar di-flag WA (gone, dicatat); unit 20+6; penolakan benar (aksi/setting/durasi/kode ngawur 400, fake jid 404, join invalid 404, 403 non-pemilik, 401 tanpa token); grup uji + user uji dibersihkan |
| 2026-10-09 | 3.3 | src/lib/server/utils.ts, src/app/api/sessions/[id]/{presence,check-number,profile-picture,about,blocklist,block,unblock,profile/name,profile/status,request-code}/route.ts | Utilitas: presence (available/unavailable/composing/recording/paused, to opsional), check-number (query/body/array maks 20), profile-picture GET (sendiri+kontak)/PUT (media loader, wajib image)/DELETE, about (fetchStatus), blocklist GET, block/unblock, profile/name (1-25) + profile/status (maks 139), alias request-code identik pairing (guard 409 bila open + TTL 3 mnt); live session open 6288989494927 (presence available+composing, check-number exists:true, foto self/kontak null, about kosong, block→blocklist 1 LID→unblock→0, name PANSA Uji→PANSA STR, status "Uji 3.3 OK", SSRF PUT ditolak, 401/400 benar, DELETE request-code {cancelled:false}); unit utils 19/19; tsc 0 + lint 0 error; status profil uji "Uji 3.3 OK" tertinggal (WA tolak kosong/spasi, bukan bug) |
| 2026-10-09 | 3.4 | src/app/api/admin/stats/route.ts, src/app/api/admin/sessions/route.ts (+[id]/force-stop), src/app/api/admin/messages/route.ts | Admin: stats (users total/admin/regular, sessions total/open, messages total/in/out/today), sessions semua user (filter status/owner_id, limit maks 200+offset), force-stop lintas user (body logout opsional default false, 404 bila hilang), messages audit lintas user (filter session_id/owner_id via join/direction/remote_jid/msg_type/status/q/date_from_to, tanpa payload, limit maks 200); live (stats 1/1/1/0, sessions filter owner 13, force-stop qr→stopped→logout:true deleted, audit teks 26 out delivered + filter owner, 401/403/400/404 benar); build+restart OK session utama restore open; tsc 0 + lint 0 error; user+session+pesan uji dibersihkan (0 pesan, 1 session open) |
| 2026-10-09 | 3.5 | (verifikasi, tanpa file baru) | Verifikasi Fase 3 LULUS: statis 28 route (runtime nodejs + force-dynamic + withAuth semua; requireOpenSocket di semua route butuh koneksi; GET murni validasi manual; semua via ok/fail); tsc 0 + lint 0 error + build OK (28 route terdaftar); PM2 online + session utama restore open; smoke grup (buat→metadata→settings locked/unlocked→revoke→leave→list 0, invite pertama timeout tapi revoke valid) + utilitas (presence/check-number/about/blocklist/foto) + admin (stats/sessions/messages) + guard (401/403/400/404 benar); user+grup uji dibersihkan (0 grup, 0 pesan, 1 session open) |
| 2026-10-09 | 4.1 | src/lib/server/blast-recipients.ts | Parser penerima (array string/objek/string koma-baris-campuran, alias phone/number/nomor/wa/msisdn), normalisasi digit 6-15 tanpa nol depan, skip invalid, dedup (vars pertama menang), maks 50.000; render template `{{var}}` (spasi ditoleransi, hilang→kosong, case-sensitive); assertBlastDelay; unit 23/23 (ekspektasi skip string-kosong dibetulkan: '' → 0 kandidat) |
| 2026-10-09 | 4.2 | src/lib/server/blast-worker.ts, instrumentation.ts | Worker singleton globalThis (satu-per-satu via findFirst pending asc, delay acak min..max dipaksa ≥500 ms — terbukti 590 ms, kirim teks render + recordOutgoing, recipient sent/failed+error+sent_at); session tidak open → auto-paused; pause/resume/cancel cek status tiap iterasi tanpa hilang progres; resume boot via instrumentation (log "resume blast: 1"); boot-test: running→(restart)→paused→resume→done 3/3 |
| 2026-10-09 | 4.3 | src/lib/server/blast-actions.ts, src/app/api/sessions/[id]/blasts/route.ts (+[blastId]/pause/resume/cancel) | Route blast: buat (transaksi blast+createMany batch 1000, langsung running+kick, buttons maks 10, delay default 1000/3000) + list (paginasi) + detail (stats pending/sent/failed) + pause/resume/cancel (guard 409 per status); user biasa hanya miliknya; live (buat 2 penerima done + template ter-render delivered, pause tahan progres→resume done 3/3, cancel simpan progres 1/2, guard 401/403/400/404/409 benar); tsc 0 + lint 0 error + build OK; blast+pesan+user uji dibersihkan (0 sisa) |
| 2026-10-09 | sesi-baru | public/scan.html, (DELETE /api/sessions/0fb1c4d0..., POST /api/sessions label=utama) | Atas perintah user: session lama 0fb1c4d0 (qr, blast 7 paused 50/100) dihapus via DELETE (= stop logout true + hapus pesan + hapus folder kredensial + cascade blast/recipients); session baru 5ed8793d label "utama" dibuat + discan nomor baru → open 6283129635860; blasts session baru kosong (0), blast 7 lama 404 ikut terhapus, folder data/sessions hanya berisi session baru; scan.html diberi pesan diagnostik (belum login / 401 token / 404-403 session hilang) agar QR kosong bisa didiagnosis |
| 2026-10-09 | 5.1 | src/app/layout.tsx, src/app/globals.css, src/app/(dashboard)/layout.tsx, src/components/layout/DashboardShell.tsx, src/components/ui/{Button,Card,Fields,Toast,Modal,StatusBadge}.tsx | Infrastruktur dashboard: root layout id + tema gelap tetap (dark, zinc-950), sidebar desktop 240px + drawer mobile + topbar, auth guard (/api/me, 401→/login, /admin khusus admin), 9 item nav, Toast host global, komponen reusable terpusat; tsc 0 + lint 0 error + build OK; deploy PM2 restart OK (health ok, logged_out dilewati restore, blast 8 done utuh); /login+/dashboard 200, halaman isi 5.2–5.10 masih 404 sesuai rencana |
| 2026-10-09 | 5.2 | src/lib/client/api.ts (getAdminStats, countSessionMessages), src/app/(dashboard)/dashboard/page.tsx | Halaman dashboard: kartu statistik (admin: session/total-open + pesan in/out/hari ini + pengguna dari /api/admin/stats; user biasa: session miliknya + agregat in/out via history limit=1 per session) + daftar session + link ke /sessions; tsc 0 + lint 0 error + build OK; deploy OK (/login+/dashboard 200, kartu cocok angka API: 1 user, 1 session logged_out, 3 out hari ini dari blast 8) |
| 2026-10-09 | 5.3 | src/lib/client/api.ts (create/update/delete/status/qr/start/stop/pairing), src/app/(dashboard)/sessions/page.tsx | Halaman sessions: buat session, QR sebagai gambar, pairing code (input nomor + tampilkan kode + batalkan), polling status+QR 3 dtk berhenti saat open, ubah label, stop/logout-hapus via modal konfirmasi; tsc 0 + lint 0 error (perbaiki TS2367 + setState-dalam-effect) + build OK; deploy OK (/sessions 200); uji live penuh via API (buat→qr 7642 char→label→stop→start→hapus, list akhir tinggal utama); session+pesan uji dibersihkan |
| 2026-10-09 | 5.4 | src/lib/client/api.ts (listConversations, getHistory, sendText), src/app/(dashboard)/chat/page.tsx | Halaman chat: pilih session + kontak (dari conversations), chat baru via nomor, riwayat bubble in/out + centang status, kirim teks, polling 3 dtk, peringatan bila session belum open, layout 2 kolom desktop + 1 kolom mobile; tsc 0 + lint 0 error (perbaiki setState-dalam-effect ×2 + prefer-const) + build OK; deploy OK (/chat 200); uji API (conversations 3 kontak blast 8, history benar, kirim teks 409 tepat saat logged_out) |

### Catatan Keputusan Tambahan
1. 2026-10-09 — Penyimpangan aturan global no. 2 (custom pairing code dihapus atas perintah user): `customCode`/`custom_code` + `pairingCodeSchema` dihapus dari `session-manager.requestPairing`, route `/pairing` + `/request-code`, dan `validators.ts`; `requestPairingCode(phone)` Baileys dipanggil tanpa argumen kode (kode 8 char selalu dari server WA). Field tak dikenal di body diabaikan zod (tidak error). Scan QR tetap tanpa nomor; pairing tetap wajib `{ phone }`.
2. 2026-10-09 — Insiden: POST pairing di session open menimpa `creds.json` (me→nomor lain, registered False) → session `logged_out`; folder kredensial dihapus + backup `/tmp/sesi-rusak-*`, session start fresh (`qr`). Guard berlapis di `requestPairing` (tolak 409 bila DB open / sock.user ada / creds.registered) mencegah terulang. TTL pairing diselaraskan 10 mnt → 3 mnt (`PAIRING_TTL_MS`, ikut `pairingCodeTimeoutMs` Baileys); respons pairing tambah `expiresIn: 180`.
3. 2026-10-09 — Otorisasi user untuk mulai Fase 5 tanpa menunggu 4.4 LULUS (risiko banned WA bila blast 100 nomor lagi; blast 8 hanya smoke test 3 nomor). 4.4 tetap `[ ]` terbuka sampai ada cara aman verifikasi 100 nomor hingga `done`. Bukti parsial: blast 8 (3 nomor, done, template ter-render, delivered di DB) + blast 7 lama (100 nomor: createMany batch 1000, pause tahan progres 50/100, resume lanjut, restart auto-resume tepat — lalu device dibatasi, bukan bug worker). Mulai Fase 5 dari 5.1.

### Ringkasan Sesi Terakhir
Selesai: Fase 2 Kirim Pesan + Webhook LULUS penuh (PM2 online, session verify-18 open 6288989494927; 13 tipe kirim + 8 route manajemen live OK ke 6283129635860; SSRF ditolak media loader + validasi webhook; webhook E2E via webhook.site HMAC VALID untuk message.status + message masuk "Uji 2.8"; status DB sent→delivered→read; pesan + webhook uji dibersihkan, 0 sisa). Step berikutnya: Fase 3 step 3.1 (grup inti). Masalah terbuka: SMTP produksi belum diisi (forgot-password 503 sampai dikonfigurasi); log PM2 memuat error non-fatal "Server Reference ID did not match" yang tidak mengganggu layanan.

---

## 3. Aturan Global (tetap)




**Proyek:** Pansa Gateway, gateway WhatsApp multi-user. **Satu project Next.js saja** (App Router, TypeScript): backend REST API sebagai Route Handlers, frontend dashboard sebagai halaman React, satu `package.json`, satu deployment.

### Aturan "Full Next.js" (wajib)
- **Dilarang:** Express, Fastify, Koa, `server.js` custom, project backend terpisah, atau proses Node kedua. Semua server logic hidup di dalam Next.js (Route Handlers + modul `lib/server` + `instrumentation.ts`).
- Next.js versi terbaru yang stabil (15 atau lebih baru), versi dipin persis. Di Route Handler dinamis, `params` bersifat async: `{ params }: { params: Promise<{ id: string }> }` lalu `await params`.
- Frontend: React Server Components untuk layout dan halaman statis, `'use client'` hanya untuk halaman interaktif (polling, form, modal). Styling **Tailwind CSS**, ikon `lucide-react`. Tanpa library UI berat.
- Semua modul server diawali `import 'server-only'` agar tidak bocor ke bundle client.
- Dijalankan dengan `next build` lalu `next start` (PM2, **1 instance, tanpa cluster**). Dilarang `output: 'export'`. Dilarang untuk serverless (Vercel dsb) karena koneksi WebSocket Baileys harus hidup terus.
- Script `package.json`: `dev`, `build` (`prisma generate && next build`), `start`, `lint`, `db:generate`, `db:migrate` (`prisma migrate dev`), `db:deploy` (`prisma migrate deploy`), `db:seed`. Sertakan `ecosystem.config.cjs` untuk PM2. Urutan deploy: `npm ci` → `npm run db:deploy` → `npm run build` → PM2 start.

### Struktur folder
```
app/
  layout.tsx, globals.css
  (auth)/login/page.tsx
  (dashboard)/layout.tsx          # sidebar desktop + drawer mobile + auth guard
  (dashboard)/dashboard/page.tsx
  (dashboard)/sessions/page.tsx
  (dashboard)/chat/page.tsx
  (dashboard)/messages/page.tsx
  (dashboard)/groups/page.tsx
  (dashboard)/contacts/page.tsx
  (dashboard)/blast/page.tsx
  (dashboard)/admin/page.tsx
  (dashboard)/settings/page.tsx
  api/**/route.ts                 # semua endpoint REST
components/                       # komponen UI reusable
lib/server/                       # prisma.ts, auth, rate-limit, response, session-manager,
                                  # media-loader, webhook, blast-worker, validators
lib/client/                       # api.ts (API client terpusat), auth.ts, hooks
prisma/schema.prisma
prisma/migrations/                 # dihasilkan `prisma migrate`
prisma/seed.ts
instrumentation.ts                # boot hook
next.config.ts
ecosystem.config.cjs
.env.example
```

### Stack tetap
- Library WA: `@rexxhayanasi/elaina-baileys`, versi dipin persis (tanpa `^`). Paket pihak ketiga: audit sebelum dipakai.
- Database: **MySQL 8 via Prisma ORM** (`prisma` + `@prisma/client`, versi stabil terbaru dipin persis; ikuti konvensi generator/config versi tersebut). `DATABASE_URL` dari env.
- Migrasi: **Prisma Migrate** (`prisma/migrations`), dijalankan lewat `prisma migrate deploy` saat deploy, **bukan** dari kode aplikasi. Seed lewat `prisma/seed.ts`.
- `PrismaClient` dibuat sekali di `lib/server/prisma.ts` dan disimpan di `globalThis` (cegah koneksi ganda saat HMR). Gunakan `$transaction` untuk operasi multi-tabel. `$queryRaw` hanya untuk agregasi yang sulit lewat Prisma (misal daftar percakapan).
- Auth: `jsonwebtoken`, `bcryptjs`. Validasi: `zod`.

### Aturan teknis server di Next.js
- Semua `route.ts`: `export const runtime = 'nodejs'` dan `export const dynamic = 'force-dynamic'`.
- `next.config.ts`: `serverExternalPackages` berisi baileys, `@prisma/client`, `prisma`, `bcryptjs`, dan `sharp`/`canvas` bila dipakai.
- Singleton (session manager, PrismaClient, blast worker, rate limiter) disimpan di `globalThis` agar tidak ganda saat HMR.
- Jangan pakai Edge middleware untuk auth/rate limit. Lakukan di helper yang dibungkus tiap handler (`withAuth`, `withRateLimit`). Auth guard halaman dilakukan di client (cek token di `(dashboard)/layout.tsx`), karena token ada di localStorage.
- Boot hook lewat `instrumentation.ts` (`register()`, hanya jika `process.env.NEXT_RUNTIME === 'nodejs'`, import dinamis): seed admin bila tabel `users` kosong, restore session, resume blast. (Migrasi sudah dijalankan sebelumnya lewat `db:deploy`.)

### Konvensi
- Respons sukses `{ success: true, data }`. Error `{ success: false, error: "<pesan Bahasa Indonesia>" }`.
- Status: 400 validasi, 401 belum login, 403 bukan pemilik/admin, 404 tidak ditemukan, 409 konflik (session belum `open`), 413 media kebesaran, 429 rate limit.
- Pesan ke user dan UI dalam Bahasa Indonesia. Nama kolom/route dalam bahasa Inggris.
- Output: file lengkap dan runnable per file (bukan potongan), plus `.env.example`.

### Skema database final (`prisma/schema.prisma`, provider mysql, utf8mb4)
Nama tabel/kolom di MySQL tetap snake_case lewat `@@map` / `@map`; field Prisma camelCase.

```prisma
enum Role { admin user }
enum SessionStatus { connecting qr pairing open closed logged_out stopped }
enum Direction { in out }
enum MessageStatus { pending sent delivered read failed }
enum BlastStatus { queued running paused done cancelled failed }
enum RecipientStatus { pending sent failed }

model User {
  id            Int      @id @default(autoincrement())
  username      String   @unique @db.VarChar(32)
  email         String   @unique @db.VarChar(255)
  fullName      String   @map("full_name") @db.VarChar(255)
  passwordHash  String   @map("password_hash")
  phone         String?  @db.VarChar(32)
  avatarUrl     String?  @map("avatar_url") @db.Text
  role          Role     @default(user)
  active        Boolean  @default(true)
  webhookUrl    String?  @map("webhook_url") @db.Text
  webhookSecret String?  @map("webhook_secret")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  sessions      Session[]
  @@map("users")
}

model Session {
  id        String        @id @db.Char(36)           // UUID v4
  ownerId   Int?          @map("owner_id")
  owner     User?         @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  label     String        @db.VarChar(255)
  status    SessionStatus @default(connecting)
  phone     String?       @db.VarChar(32)
  waName    String?       @map("wa_name")
  createdAt DateTime      @default(now()) @map("created_at")
  updatedAt DateTime      @updatedAt @map("updated_at")
  messages  Message[]
  blasts    Blast[]
  @@map("sessions")
}

model Message {
  id         BigInt         @id @default(autoincrement())
  sessionId  String         @map("session_id") @db.Char(36)
  session    Session        @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  direction  Direction
  waId       String?        @map("wa_id")
  remoteJid  String         @map("remote_jid")
  msgType    String         @map("msg_type")
  textBody   String?        @map("text_body") @db.Text
  status     MessageStatus?
  payload    Json?
  createdAt  DateTime       @default(now()) @map("created_at")
  @@index([sessionId, remoteJid, createdAt])
  @@index([sessionId, waId])
  @@map("messages")
}

model Blast {
  id          Int         @id @default(autoincrement())
  sessionId   String      @map("session_id") @db.Char(36)
  session     Session     @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  ownerId     Int?        @map("owner_id")
  label       String
  textBody    String      @map("text_body") @db.Text
  mediaJson   Json?       @map("media_json")
  buttonsJson Json?       @map("buttons_json")
  total       Int         @default(0)
  delayMin    Int         @map("delay_min")
  delayMax    Int         @map("delay_max")
  status      BlastStatus @default(queued)
  error       String?     @db.Text
  createdAt   DateTime    @default(now()) @map("created_at")
  startedAt   DateTime?   @map("started_at")
  finishedAt  DateTime?   @map("finished_at")
  recipients  BlastRecipient[]
  @@map("blasts")
}

model BlastRecipient {
  id      Int             @id @default(autoincrement())
  blastId Int             @map("blast_id")
  blast   Blast           @relation(fields: [blastId], references: [id], onDelete: Cascade)
  phone   String          @db.VarChar(32)
  vars    Json?
  status  RecipientStatus @default(pending)
  error   String?         @db.Text
  sentAt  DateTime?       @map("sent_at")
  @@index([blastId, status])
  @@map("blast_recipients")
}
```

Catatan: `Direction.in` dan `Direction.out` adalah kata reserved di sebagian bahasa, tetapi valid sebagai nama enum Prisma. Jika generator menolak, pakai `incoming`/`outgoing` dengan `@map("in")`/`@map("out")`.

### Keputusan final (sebelumnya ambigu)
1. **Master API key** (`x-api-key`, dibandingkan dengan `crypto.timingSafeEqual`) = admin virtual (id 0, tidak ada di DB). Saat membuat session dengan API key, body wajib memuat `owner_id` (user yang ada); jika kosong, pakai admin seed.
2. **Pairing code:** kode bawaan WA ditampilkan apa adanya (8 karakter). Custom code: **tepat 8 karakter [A-Za-z0-9]**. Hanya satu kode aktif per session; permintaan baru ditolak 409 sampai dibatalkan atau kedaluwarsa.
3. **Status session:** `connecting → qr|pairing → open`. Putus biasa → `closed` lalu reconnect otomatis 5 detik. Logout dari HP → `logged_out`, tanpa reconnect. Stop `logout:false` → `stopped` (kredensial disimpan, bisa start tanpa scan). Stop `logout:true` → hapus kredensial + record. `DELETE` session = stop logout true + hapus pesan terkait.
4. **Restore saat boot:** semua session dengan status selain `logged_out`/`stopped` di-start ulang bertahap (jeda 1 detik antar session). Blast `running` dilanjutkan dari recipient `pending`.
5. **Webhook:** `webhook_secret` dipakai menandatangani body: header `x-pansa-signature: sha256=<HMAC-SHA256 hex>`, plus `x-pansa-event`. URL webhook divalidasi dengan aturan anti-SSRF yang sama seperti media (cek saat disimpan **dan** saat dikirim). Timeout 10 detik, fire-and-forget, tanpa retry. URL: milik owner session dulu, fallback `GLOBAL_WEBHOOK_URL`.
6. **Event `message.status`** memperbarui kolom `messages.status` lalu dikirim ke webhook.
7. **Real-time di dashboard = polling** (chat 3 detik, status session 3 detik). Tanpa SSE/WebSocket.
8. **Daftar kontak untuk chat** diambil dari tabel `messages` (group per `remoteJid` + pesan terakhir, via `groupBy` atau `$queryRaw`), bukan dari store Baileys.
9. **Rate limit:** in-memory (Map + sweep), per IP. Global 1000/15 menit, **login 10/15 menit**, pairing 20/15 menit. IP diambil dari `x-forwarded-for` hanya jika `TRUST_PROXY=true`.
10. **Token JWT disimpan di localStorage** (key `pansa_token`). API client terpusat: sisipkan Bearer, redirect ke `/login` saat 401.
11. **Keamanan media:** hanya http/https; tolak localhost, IP privat, loopback, link-local (cek ulang setelah resolve DNS **dan** tiap redirect, maksimal 3 redirect); path lokal harus di dalam `MEDIA_DIR` (resolve + cek prefix, tolak traversal); batas default 64 MB. Input boleh URL, base64 data URI, atau path lokal.
12. **ID session** divalidasi `^[A-Za-z0-9_-]{1,64}$` sebelum dipakai sebagai nama folder `SESSIONS_DIR/<id>`.
13. Pesan dari diri sendiri (`fromMe`) tidak disimpan sebagai incoming dan tidak memicu webhook.
14. **BigInt:** `messages.id` bertipe BigInt dan tidak bisa di-`JSON.stringify`. Semua respons wajib mengonversi BigInt menjadi string lewat helper respons standar.

### Env wajib (`.env.example`)
PORT, JWT_SECRET, JWT_EXPIRES_IN=7d, MASTER_API_KEY, DATABASE_URL (mysql://user:pass@host:3306/pansa_gateway), SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL, SEED_ADMIN_FULL_NAME, SEED_ADMIN_PASSWORD, GLOBAL_WEBHOOK_URL, SESSIONS_DIR, MEDIA_DIR, MAX_MEDIA_MB=64, CORS_ORIGINS, TRUST_PROXY, RATE_LIMIT_GLOBAL, RATE_LIMIT_LOGIN, RATE_LIMIT_PAIRING.


---

## 4. Fase 1: Fondasi


### Tugas
Semua dalam satu project Next.js (lihat aturan Full Next.js di blok global). Buat: `package.json`, `next.config.ts`, `tailwind` config, `ecosystem.config.cjs`, `prisma/seed.ts`, struktur folder, `prisma/schema.prisma` (semua model di blok global) + migrasi awal + `lib/server/prisma.ts` (singleton), seed admin saat `users` kosong (username, email, full_name dari env), helper respons standar, `withAuth` (JWT + API key; muat ulang user dari DB tiap request; tolak user nonaktif), `withRateLimit`, security headers, CORS, validasi zod, `instrumentation.ts`, dan session manager singleton (start, reconnect 5 detik, QR data URL PNG, pairing code, stop, restore saat boot).

### Route
Setiap path di bawah adalah satu file `app/api/.../route.ts` (Route Handler Next.js) dengan export `GET`/`POST`/`PATCH`/`PUT`/`DELETE` sesuai method.

| Method | Path | Akses |
|---|---|---|
| GET | /api/health | publik |
| POST | /api/auth/login | publik (username atau email + password) |
| GET | /api/me | login |
| PATCH | /api/me | full_name, email, phone, avatar_url |
| PUT | /api/me/password | wajib password lama |
| PUT | /api/me/webhook | url + secret |
| GET, POST | /api/admin/users | admin |
| PATCH, DELETE | /api/admin/users/:id | admin |
| GET, POST | /api/sessions | list milik sendiri (admin: semua) / buat |
| GET, PATCH, DELETE | /api/sessions/:id | detail / ubah label / hapus |
| POST | /api/sessions/:id/start | |
| POST | /api/sessions/:id/stop | body `{logout: boolean}` |
| GET | /api/sessions/:id/qr | |
| GET | /api/sessions/:id/status | |
| POST | /api/sessions/:id/pairing | body `{phone, customCode?}` |
| DELETE | /api/sessions/:id/pairing | batalkan |

### Aturan
- User biasa hanya akses session miliknya (403 jika bukan), admin akses semua.
- Username 3 sampai 32 karakter `[A-Za-z0-9._-]`, password minimal 6, bcrypt.
- Buat user: email wajib, valid, dan unik; full_name wajib; phone dan avatar_url opsional.
- Admin tidak boleh mencabut role admin dirinya, menonaktifkan dirinya, atau menghapus dirinya. Hapus user tidak menghapus session-nya.
- Token JWT berisi user id, masa berlaku default 7 hari.
- Nomor pairing format internasional tanpa awalan nol.

### Frontend minimal di fase ini
Halaman `app/(auth)/login/page.tsx` dan `lib/client/api.ts` (API client terpusat) agar login bisa diuji dari browser, plus halaman placeholder `/dashboard`.

### Kriteria selesai
Bisa login, buat session, scan QR atau pairing, status berubah menjadi `open`, lalu setelah server di-restart session pulih sendiri.


---

## 5. Fase 2: Kirim Pesan + Webhook


### Tugas
Semua endpoint adalah Route Handler Next.js (`app/api/sessions/[id]/send/<tipe>/route.ts`, dst). Akses data lewat Prisma. Logika dipisah ke `lib/server` (media-loader, webhook, message-recorder, message-handlers), route hanya validasi + panggil modul.

Buat modul media loader (aturan keamanan no. 11), pencatat pesan keluar/masuk ke tabel `messages`, dispatcher webhook (aturan no. 5), handler pesan masuk, dan pembaruan `messages.status`.

Handler pesan masuk:
- Tipe pesan diekstrak dari key objek `message`.
- Teks diambil dari `conversation` atau caption.
- Respons tombol ditangkap dari berbagai format response message.
- Pesan `fromMe` tidak disimpan sebagai incoming dan tidak memicu webhook.

### Route kirim
Semua `POST /api/sessions/:id/send/<tipe>`, membalas `{messageId, to, status}`, dan **409 jika session belum `open`**. Setiap pesan keluar dicatat ke `messages`.

| Tipe | Catatan |
|---|---|
| text | reply opsional |
| image | |
| video | opsi gif |
| audio | opsi voice note |
| document | |
| sticker | |
| location | |
| contact | format vCard |
| poll | single choice |
| buttons | reply, url, copy, call |
| list | sections dengan rows |
| carousel | cards wajib ada gambar atau video |
| buttonv2 | quick reply klasik |

### Manajemen pesan
Di `/api/sessions/:id/messages/...`:
- `POST react` (emoji)
- `POST delete`
- `POST edit` (teks)
- `POST forward` (wajib menyertakan objek pesan mentah dari client)
- `POST read`
- `GET history` (filter remote_jid, direction, q, limit, offset)
- `GET conversations` (daftar kontak + pesan terakhir dari tabel messages)
- `POST download-media` (hasil base64 atau data URI)

### Event webhook
`qr`, `connected`, `disconnected`, `logged_out`, `message`, `message.status`, `presence`, `group`, `call`, `stopped`.

Payload dasar: `{ event, session, timestamp, data }`. Untuk `message`, `data` berisi: id, remoteJid, fromMe, type, pushName, timestamp, text, buttonResponse, quoted, hasMedia.

### Kriteria selesai
Semua 12 tipe kirim bekerja, pesan masuk tersimpan dan terkirim ke webhook dengan header signature yang valid, status pesan ter-update, URL internal ditolak oleh media loader dan validasi webhook.


---

## 6. Fase 3: Grup, Utilitas, Admin


Semua endpoint adalah Route Handler Next.js di `app/api/...`, logika di `lib/server/groups.ts` dan `lib/server/utils.ts`.

### Grup
Di `/api/sessions/:id/groups/...`:
- list grup, buat grup, metadata
- ubah nama, ubah deskripsi, keluar grup
- anggota: add, remove, promote, demote
- invite: ambil code dan link, revoke
- join via kode atau link, invite-info
- settings grup
- ephemeral (pesan sementara dengan durasi tertentu)
- join-requests: list, approve, reject

### Utilitas
Di `/api/sessions/:id/...`:
- `presence`
- `check-number` (cek terdaftar di WhatsApp)
- `profile-picture`: GET (milik sendiri dan kontak), PUT (ganti), DELETE (hapus)
- `about` (status kontak)
- `blocklist` (GET), `block`, `unblock`
- `profile/name`, `profile/status`
- alias pairing code

### Admin
- `GET /api/admin/stats`: jumlah user, session, session open, total pesan in/out, pesan hari ini
- `GET /api/admin/sessions`: semua session semua user
- `POST /api/admin/sessions/:id/force-stop`
- `GET /api/admin/messages`: audit lintas user, filter dan paginasi

### Aturan
- Semua endpoint session tetap memeriksa kepemilikan (admin boleh semua).
- Semua endpoint yang butuh koneksi mengembalikan 409 jika session belum `open`.
- Event grup diteruskan ke webhook sebagai event `group`.

### Kriteria selesai
Semua endpoint di atas terdaftar, tervalidasi zod, dan mengikuti format respons standar.


---

## 7. Fase 4: Blast (Broadcast Massal)


Worker blast adalah modul singleton di `lib/server/blast-worker.ts` (disimpan di `globalThis`, di-resume dari `instrumentation.ts`), bukan proses terpisah dan bukan cron eksternal.

### Route
Di `/api/sessions/:id/blasts`:
- `POST` buat campaign (langsung berjalan, status `running`)
- `GET` list campaign
- `GET /:blastId` detail + statistik recipient (pending, sent, failed)
- `POST /:blastId/pause`
- `POST /:blastId/resume`
- `POST /:blastId/cancel`

### Input buat campaign
`label`, `text` (template), `recipients`, `media` (opsional), `buttons` (opsional, maksimal 10), `delay_min`, `delay_max`.

### Aturan
- Simpan penerima dengan `createMany` per batch 1000 baris di dalam `$transaction` bersama pembuatan blast.
- Ambil recipient berikutnya dengan `findFirst({ where: { blastId, status: 'pending' }, orderBy: { id: 'asc' } })`.
- `recipients` bisa array string, array objek (`{phone, ...vars}`), atau string dipisah koma/baris baru.
- Nomor dinormalisasi ke digit, yang tidak valid di-skip, duplikat dihapus, **maksimal 50.000** per campaign.
- Template mendukung variabel `{{nama}}` yang dirender dari `vars` penerima (variabel hilang menjadi string kosong).
- Worker background singleton, mengirim **satu per satu** dengan delay acak antara `delay_min` dan `delay_max`; **minimum 500 ms walau input lebih kecil**.
- Status tiap recipient dicatat `pending`, `sent`, atau `failed` beserta error dan `sent_at`.
- Jika session tidak `open`, campaign otomatis `paused`.
- Pause, resume, cancel berlaku tanpa kehilangan progres.
- Saat boot, campaign `running` dilanjutkan dari recipient `pending`.
- Media memakai media loader yang sama (aturan keamanan no. 11).
- User biasa hanya akses blast miliknya.

### Kriteria selesai
Campaign 100 nomor dengan variabel berjalan sampai `done`, bisa di-pause dan resume, dan tetap lanjut setelah server di-restart.


---

## 8. Fase 5: Frontend Dashboard


### Prinsip
Semua halaman adalah React di App Router (`app/(dashboard)/.../page.tsx`), bukan SPA terpisah. Layout, sidebar, dan komponen statis sebagai Server Component; halaman interaktif memakai `'use client'`. Styling Tailwind CSS, ikon `lucide-react`. Tanpa library lain untuk state selain React hooks (boleh `swr` untuk polling).

Tema gelap, mobile-first, responsif penuh: sidebar di desktop, drawer di mobile. Semua teks Bahasa Indonesia. Satu project dan satu deployment dengan backend.

### Infrastruktur
- **API client terpusat** (`lib/api.ts`): otomatis menyertakan `Authorization: Bearer <token>`, membuka envelope `{success, data}`, melempar error dengan pesan dari server, dan redirect ke `/login` saat 401.
- Token disimpan di localStorage (`pansa_token`).
- **Auth guard** di semua halaman: tanpa token diarahkan ke `/login`; halaman `/admin` hanya untuk role admin.
- Layout dengan sidebar/drawer, komponen reusable (kartu, tabel, modal, toast).

### Halaman
1. **/login**: form username atau email + password, simpan token, redirect ke dashboard.
2. **/dashboard**: kartu statistik (jumlah session, status koneksi, total pesan masuk, keluar, hari ini, jumlah user khusus admin) + daftar session milik user.
3. **/sessions**: buat session, tampilkan QR sebagai gambar, minta pairing code dengan input nomor HP lalu tampilkan kodenya, polling status tiap 3 detik, ubah label, stop atau logout.
4. **/chat**: pilih session, pilih kontak (dari endpoint `conversations`), riwayat percakapan, kirim teks, polling 3 detik.
5. **/messages**: riwayat masuk dan keluar per session dengan filter (arah, kontak) dan pencarian.
6. **/groups**: daftar grup, buat grup, detail, kelola anggota (tambah, hapus, promote, demote), lihat dan revoke invite link.
7. **/contacts**: cek nomor terdaftar WhatsApp, lihat foto profil dan status about, lihat dan kelola blocklist.
8. **/blast**: buat campaign (template, penerima, delay), pantau progres, pause, resume, cancel.
9. **/admin** (admin saja): statistik sistem, daftar user dengan tambah, ubah, hapus (email, full_name, phone, role, active), daftar semua session semua user dengan aksi paksa stop.
10. **/settings**: ubah profil (full_name, email, phone, avatar_url), atur webhook url dan webhook secret, ganti password dengan verifikasi password lama.

### Kriteria selesai
Semua halaman terhubung ke API nyata (bukan data dummy), nyaman dipakai di layar 360px, dan 401 selalu mengarahkan ke login.
