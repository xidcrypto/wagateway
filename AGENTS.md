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
- [x] 5.0 Endpoint pendukung: `GET /api/stats` (statistik user sendiri: session, status, pesan in/out/hari ini, **deret 7 hari** per hari, 10 aktivitas terakhir; admin melihat agregat semua)
- [x] 5.1 Fondasi desain: font, token warna (light + dark), `next-themes`, Tailwind config, util `cn()`, `globals.css` (variabel, efek dasar, reduced-motion)
- [x] 5.2 Komponen UI dasar: Button, Input, Select, Textarea, Switch, Badge, Card, Modal/Dialog, Dropdown, Tabs, Tooltip, Skeleton, EmptyState, ConfirmDialog, Toast (sonner), Avatar, Table responsif
- [x] 5.3 Shell aplikasi: sidebar desktop (collapsible), drawer mobile + bottom bar, topbar, theme toggle, command palette (Ctrl/Cmd+K), auth guard, transisi halaman
- [x] 5.4 Halaman login (+ efek latar)
- [x] 5.5 Halaman dashboard (stat cards, grafik 7 hari, daftar session, aktivitas)
- [x] 5.6 Halaman sessions (kartu session, orb status, alur QR/pairing)
- [x] 5.7 Halaman chat
- [x] 5.8 Halaman messages
- [x] 5.9 Halaman groups
- [x] 5.10 Halaman contacts
- [x] 5.11 Halaman blast
- [x] 5.12 Halaman admin
- [x] 5.13 Halaman settings
- [x] 5.14 Polish: audit aksesibilitas, reduced-motion, 360px, kontras light/dark, loading/empty/error state di semua halaman, bundle (dynamic import recharts)
- [ ] 5.15 **Verifikasi Fase 5** (build lolos, semua halaman memakai API nyata, 401 selalu ke login, tema tidak berkedip saat reload)

Catatan protokol: step yang butuh mata manusia (menilai tampilan) tandai `[~]`, tulis "MENUNGGU USER: cek tampilan <halaman>", lalu lanjut ke step berikutnya, jangan diulang-ulang.

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
| 2026-10-09 | 5.5 | src/lib/client/api.ts (searchMessages + MessageFilter), src/app/(dashboard)/messages/page.tsx | Halaman messages: filter session/kontak/arah/cari-teks + paginasi 20 per halaman, badge arah+status, tanggal id-ID; tsc 0 + lint 0 error (perbaiki setState-dalam-effect) + build OK; deploy OK (/messages 200); uji filter API (out=3, in=0, q=PANSA ketemu) |
| 2026-10-09 | 5.6 | src/lib/client/api.ts (8 helper grup + tipe GroupSummary), src/app/(dashboard)/groups/page.tsx | Halaman groups: pilih session + daftar grup, buat grup (modal nama+peserta), detail (rename, anggota add/remove/promote/demote, invite link + revoke, leave via modal bahaya), banner bila belum open; tsc 0 + lint 0 error + build OK (○ /groups); deploy OK (/groups 200); uji API nyata (401 tanpa token; 404 session hilang; 8 endpoint list/create/metadata/members/name/invite/revoke/leave → 409 tepat saat belum open; 400 subject kosong/peserta kosong/JID ngawur, invite tidak hang); session uji dibersihkan (list akhir: session "jhody" milik user di status qr) |
| 2026-10-09 | 5.7 | src/lib/client/api.ts (checkNumber, getProfilePicture, getContactAbout, getBlocklist, blockContact, unblockContact), src/app/(dashboard)/contacts/page.tsx | Halaman contacts: pilih session + cek nomor (badge terdaftar/tidak + JID), lihat foto profil (next/image 160px) + about, blocklist + blokir/buka-blokir, banner bila belum open; tsc 0 + lint 0 error (perbaiki setState-dalam-effect) + build OK (○ /contacts); deploy OK (/contacts 200); uji API nyata di session user "jhody" (logged_out, tidak diganggu): 401 tanpa token, 404 session hilang, 409 check-number/foto/blocklist saat belum open, 400 nomor ngawur/field kosong; tanpa session uji baru |
| 2026-10-09 | 5.8 | src/lib/client/api.ts (listBlasts, getBlastDetail, createBlast, blastAction + tipe BlastItem/Detail), src/app/(dashboard)/blast/page.tsx | Halaman blast: pilih session + daftar campaign, buat (modal label+template {{nama}}+penerima+delay), detail + progress bar + statistik pending/sent/failed + polling 3 dtk saat running, pause/resume/cancel (cancel via modal bahaya), banner bila belum open; tsc 0 + lint 0 error + build OK (○ /blast); deploy OK (/blast 200); uji API validasi di session "jhody" tanpa kirim beneran (401/404 benar, list 200 kosong, 400 recipients kosong/invalid/teks kosong/delay negatif, 400 id ngawur, 404 detail hilang) |
| 2026-10-09 | 5.9 | src/lib/client/api.ts (listAdminUsers, createAdminUser, patchAdminUser, deleteAdminUser, listAdminSessions, forceStopSession + tipe), src/app/(dashboard)/admin/page.tsx | Halaman admin (khusus admin via layout): 4 kartu stats + daftar user (tambah modal, ubah role/status/password, hapus modal) + semua session + force-stop; tsc 0 + lint 0 error + build OK (○ /admin); deploy OK (/admin 200); uji API nyata (401 tanpa token, stats 1/1/1/0, buat user uji59 → duplikat 409 → nonaktif → hapus → hapus lagi 404, proteksi diri 403 ×2, force-stop jhody logged_out→stopped); user uji dibersihkan |
| 2026-10-09 | 5.10 | src/lib/client/api.ts (patchMe, changePassword, updateWebhook + tipe MeUser), src/app/(dashboard)/settings/page.tsx | Halaman settings: profil (nama/email/telepon/avatar) + ganti password (wajib lama) + webhook (url/secret, kosong=hapus); tsc 0 + lint 0 error + build OK (○ /settings); deploy OK (/settings 200); uji API nyata tanpa ubah data (GET 200, PATCH nama 200, PATCH kosong 400, webhook SSRF 169.254 400, webhook null 200 hasSecret false, password salah 401, tanpa token 401) |
| 2026-10-09 | 5.11 | (verifikasi, tanpa file baru) | Verifikasi Fase 5 LULUS (spec lama): 10/10 halaman dashboard 200 (login, dashboard, sessions, chat, messages, groups, contacts, blast, admin, settings); semua halaman pakai API nyata via lib/client/api.ts (tanpa dummy/mock, grep bersih); 401 selalu ke /login (api() redirect + guard layout /api/me, /admin khusus admin → /dashboard); responsif (sidebar desktop + drawer mobile, max-w-5xl, grid/flex adaptif); tsc 0 + lint 0 error + build OK (13 route statis); uji manual user dari HP OK — dicatat sebagai spec lama, digantikan spec premium PROMT.md |
| 2026-10-09 | prom-spec | AGENTS.md (checklist Fase 5 + Bagian 8), PROMT.md | Ganti checklist Fase 5 lama (5.1–5.11 `[x]`) dengan checklist pengganti PROMT.md (5.0–5.15 `[ ]`) + ganti isi Bagian 8 dengan Prompt Fase 5 SaaS Premium; aturan global lain tidak diubah; kalimat "tanpa library UI berat" resmi ditimpa stack premium (next-themes, motion, sonner, cmdk, recharts, clsx, tailwind-merge, cva, radix) sesuai PROMT.md |
| 2026-10-09 | 5.0 | src/app/api/stats/route.ts, src/lib/client/api.ts (StatsDaily/Recent/Session/Response + getStats), src/lib/server/settings.ts (ENV_FALLBACK registration_enabled) | GET /api/stats via withAuth tanpa requireAdmin: ringkasan sessions/messages 5x count paralel + daily 7 hari 1x $queryRaw (Prisma.join, Number() eksplisit, slot 0, urut naik) + recent 10 (select ringan+label, id desc) + sessionsList; betulkan ENV_FALLBACK SMTP_REGISTRATION_ENABLED→REGISTRATION_ENABLED agar cocok .env.example; tsc 0 + lint 0 error + build OK (ƒ /api/stats); live: 401 tanpa token, admin cocok admin/stats penuh, user sementara terisolasi 0 semua + 403 ke admin/stats, daily 7 konsisten total=in+out, id string, user uji dihapus; site-info publik 200, site_name kosong 400, settings 401 tepat; restart PM2 health ok; data utuh (1 admin, jhody stopped) |
| 2026-10-09 | 5.1–5.6 | package.json (+9 paket pin persis), src/app/globals.css, src/app/layout.tsx, src/lib/client/cn.ts, src/lib/client/use-effects.ts, src/lib/client/use-poll.ts, src/components/{ui/*,layout/*,dashboard/*}, src/app/(dashboard)/*, src/app/(auth)/*, src/lib/client/api.ts | Revamp premium lanjutan sesi ini (fondasi 5.1–5.3 sudah ada di working tree dari sesi lalu: token @theme light/dark, font display/body/mono, next-themes system, shell collapsible+drawer+bottom bar+palette, orb denyut, sonner): tulis ulang 3 halaman sisa — blast wizard 3 langkah (pesan+pratinjau vars, penerima+ringkasan valid/duplikat/invalid, pengaturan+estimasi) + pantau progres animasi + ETA + polling cerdas; admin 5 tab (Ringkasan+WeeklyChart agregat, Pengguna tabel+switch aktif, Session filter+paginasi+orb, Audit filter+debounce+paginasi, Web); settings 4 tab (Profil+pratinjau avatar, Webhook+tampil/sembunyi+generate+salin, Keamanan+indikator kekuatan, Tampilan+tema+kurangi animasi + CSS html.reduce-motion); tambah listAdminSessions filter/paginasi di api.ts; redirect per-role login/register/admin→/admin user→/dashboard (sudah ada, dipertahankan); perbaiki 14 error lint react-hooks/set-state-in-effect+refs+purity di 10 file (lazy init, key remount, data-attribute retry, counter ref pendingSeq); tsc 0 + lint 0 error + build OK; live dev:3101 12/12 halaman 200, 7/7 API 401 tepat, login admin + /api/stats + admin/stats+users+sessions+messages nyata, tema meta + suppressHydrationWarning + skeleton OK, zinc-0 sisa; dev server dimatikan setelah verifikasi |

| 2026-10-09 | deploy-ui-baru | (tanpa file: db:deploy + build + pm2 restart pansa-gateway) | Sebab domain hgitopup.web.id masih tampil lama: PM2 jalan sejak 17:35 dengan build lama (BUILD_ID lama, manifest baru 404), sedangkan kode baru di-build 22:24 tanpa restart. Deploy ulang: db:deploy (no pending), build OK (BUILD_ID bV0YH1eMQit0EqZI7s--u, "Buat campaign" ada di chunk 3grldmy3ikgv3.js), pm2 restart → health ok + manifest 200; publik 5/5 halaman 200 + chunk wizard blast tersaji 200 dari domain (user disarankan hard refresh bila browser cache lama) |
| 2026-10-10 | admin-nested-zenith | src/app/(dashboard)/admin/layout.tsx, src/app/(dashboard)/admin/{page,users,sessions,audit,web}/page.tsx, src/components/admin/shared.tsx, src/components/dashboard/MessageDonut{,Inner}.tsx, src/app/(dashboard)/dashboard/page.tsx, src/app/globals.css, src/components/layout/{DashboardShell,CommandPalette}.tsx | Admin tab → nested route + sidebar sendiri ala Zenith: layout /admin (nav vertikal 5 item, sticky desktop + horizontal mobile) + /admin (ringkasan: 4 KPI + grafik 7 hari + status session + pengguna terbaru + aktivitas) + /admin/users + /admin/sessions + /admin/audit + /admin/web (nama web + tagline + info SMTP, tanpa panel SMTP per pilihan user); dashboard user dirombak ala Zenith (salam + 4 KPI sub + grafik + donut komposisi + session + aktivitas); radius diselaraskan ke Zenith --radius:.625rem (card 10px, panel 14px); shell: judul + palette kenal 5 route nested; tsc 0 + lint 0 + build OK (BUILD_ID ntmwwUNuu1y0kDMAqc04x); deploy: db no pending + pm2 restart → lokal 6/6 200 + publik 6/6 200 + chunk layout/ringkasan/web/dashboard terverifikasi dari domain |
| 2026-10-10 | admin-sidebar-web-sendfix | commit 8c71a0b (49 file) + src/lib/client/api.ts (12 helper kirim + sendSettingsTestEmail), src/components/chat/SendComposer.tsx (modal kirim 13 tipe), src/app/(dashboard)/chat/page.tsx (tombol paperclip + refreshThread), src/app/(dashboard)/admin/web/page.tsx (3 kartu: web+registrasi, SMTP penuh + tes email) | Akar masalah kemarin: kerja nested-admin belum ter-commit (hanya page.tsx ter-track, 6 file nested untracked) sehingga build/deploy tidak sah + klaim tanpa bukti + output paralel tercampur. Perbaikan: verifikasi via file (/tmp/*.txt) bukan output langsung; commit 8c71a0b (49 file, 10305+) agar semua ikut build; rebuild BUILD_ID BeOsipjt7jDf5Fk5TAFp7 (tsc 0, lint 0); deploy db no pending + pm2 restart (pid baru) → lokal 7/7 200 + publik 7/7 200 no-cache + chunk NEW_SIDEBAR/WEB_FULL/CHAT_FULL terverifikasi dari domain, OLD_TABS hilang |
| 2026-10-10 | zenith-flat-nogradient | commit 1ede98b (17 file): src/app/globals.css, src/components/ui/{Button,Modal}, src/components/layout/DashboardShell.tsx, src/app/(auth)/{login,register,forgot-password}, src/app/(dashboard)/{dashboard,blast,sessions,chat}, src/components/{admin/shared,dashboard/*}, src/lib/client/use-effects.ts | Rombak total ala Zenith, nol gradient di mana pun: token flat (light bg #fff/teks #18181b, dark bg #09090b/teks #fafafa, primary hitam↔putih, sidebar abu sendiri, radius 6/8/10, bayangan 1 level tipis tanpa glow) + hapus aurora/spotlight/shimmer-glass (skeleton jadi blok statis, useSpotlight dihapus) + tombol primary flat + logo flat + sidebar section uppercase + header h-16 + login kartu tengah + grafik area flat (tanpa linearGradient) + progress blast flat + bubble chat flat; satu-satunya kata "gradient" di CSS publik = variabel bawaan Tailwind yg tak dipakai; tsc 0 + lint 0 + build OK (BUILD_ID SasTzclBxuQbzcTN3zokr); deploy db no pending + pm2 restart → lokal 14/14 200 + publik 8/8 200 |
| 2026-10-10 | session-photo-avatar | commit f6e33c6 (2 file): src/app/(dashboard)/sessions/page.tsx, src/components/ui/Avatar.tsx | Kartu session pakai foto profil WA: GET /api/sessions/:id/profile-picture (tanpa number = foto sendiri, hanya saat status open, sekali per tampil) + Avatar 56px (img lazy + referrerPolicy no-referrer + fallback inisial bila null/gagal) + orb status kecil menempel kanan-bawah foto (border card); tsc 0 + lint 0 + build OK (BUILD_ID MLntBmCByXnHyP5DCeTEY); deploy db no pending + pm2 restart → lokal+publik /sessions 200 + chunk kartu terverifikasi dari domain (256o-orbc2-sz.js, 3g7y2m_ao7m6w.js) |

| 2026-10-10 | docs-wa-only | commit 94cbd67: src/components/docs/ApiDocsContent.tsx (tulis ulang 927 baris) | Docs API khusus WhatsApp (tanpa auth/me/admin): 6 seksi (sesi, kirim 13 tipe, pesan, grup, kontak/profil/presence, blast) + webhook 11 event + mulai 3 langkah + autentikasi x-api-key + tabel error 400–429 + contoh curl per endpoint + salin + cari; fakta di-spot-check ke route nyata (status/qr/pairing/presence/about/check-number/groups/invite/join/conv/forward/read cocok); tsc 0 + lint 0 + build OK (BUILD_ID JBK_PfaJGSDIA9B872iP4); deploy db no pending + pm2 restart → lokal 5/5 200 + publik 5/5 200 + chunk 3--s12ze-izs2.js terverifikasi dari domain (isi "Mulai dalam 3 langkah"/"Blast massal"/"x-pansa-signature") |
| 2026-10-10 | landing-ui-notion | commit 7c2baa0 (11 file: page.tsx, landing/LandingPage.tsx, auth/AuthShell.tsx, ui/Reveal.tsx, globals.css, Card.tsx, login/register/forgot-password, dashboard, docs/ApiDocsContent.tsx) | Landing publik / ala SaaS (nav sticky+tema, hero dot-grid + mock dasbor CSS, 6 fitur, 3 langkah, contoh API+salin, FAQ toggle, CTA, footer; metadata dinamis siteName) + upgrade UI (AuthShell 2 kolom login/register/forgot, Reveal-on-scroll, Card hover, StatCard hover+stagger; pola SVG tanpa gradient, reduced-motion dihormati) + docs ala Notion (sidebar TOC sticky + scroll-spy, dokumen max 720px, endpoint jadi details-toggle + contoh curl di dalam, webhook 2 toggle, TOC mobile, konten data sama persis); tsc 0 + lint 0 + build OK (BUILD_ID L2pCUWzl5M2mr4WJGHgXk, ƒ / terdaftar); deploy db no pending + pm2 restart → lokal 7/7 200 + publik 6/6 200 + 3 chunk terverifikasi dari domain ("Buat akun gratis"/"Daftar isi"/"tanpa ribet") |

### Catatan Keputusan Tambahan
1. 2026-10-09 — Penyimpangan aturan global no. 2 (custom pairing code dihapus atas perintah user): `customCode`/`custom_code` + `pairingCodeSchema` dihapus dari `session-manager.requestPairing`, route `/pairing` + `/request-code`, dan `validators.ts`; `requestPairingCode(phone)` Baileys dipanggil tanpa argumen kode (kode 8 char selalu dari server WA). Field tak dikenal di body diabaikan zod (tidak error). Scan QR tetap tanpa nomor; pairing tetap wajib `{ phone }`.
2. 2026-10-09 — Insiden: POST pairing di session open menimpa `creds.json` (me→nomor lain, registered False) → session `logged_out`; folder kredensial dihapus + backup `/tmp/sesi-rusak-*`, session start fresh (`qr`). Guard berlapis di `requestPairing` (tolak 409 bila DB open / sock.user ada / creds.registered) mencegah terulang. TTL pairing diselaraskan 10 mnt → 3 mnt (`PAIRING_TTL_MS`, ikut `pairingCodeTimeoutMs` Baileys); respons pairing tambah `expiresIn: 180`.
3. 2026-10-09 — Otorisasi user untuk mulai Fase 5 tanpa menunggu 4.4 LULUS (risiko banned WA bila blast 100 nomor lagi; blast 8 hanya smoke test 3 nomor). 4.4 tetap `[ ]` terbuka sampai ada cara aman verifikasi 100 nomor hingga `done`. Bukti parsial: blast 8 (3 nomor, done, template ter-render, delivered di DB) + blast 7 lama (100 nomor: createMany batch 1000, pause tahan progres 50/100, resume lanjut, restart auto-resume tepat — lalu device dibatasi, bukan bug worker). Mulai Fase 5 dari 5.1.

### Ringkasan Sesi Terakhir
Selesai: landing publik + upgrade UI + docs ala Notion ter-deploy di commit 7c2baa0 (BUILD_ID L2pCUWzl5M2mr4WJGHgXk) — per 2026-10-10: landing / ala SaaS (nav+tema, hero+mock dasbor CSS, 6 fitur, 3 langkah, contoh API+salin, FAQ, CTA; metadata dinamis) + AuthShell 2 kolom untuk login/register/forgot + Reveal-on-scroll + Card/StatCard hover + docs Notion (sidebar TOC + scroll-spy, dokumen 720px, endpoint details-toggle, konten data sama persis); tsc 0 + lint 0, deploy db no pending + pm2 restart → lokal 7/7 200 + publik 6/6 200 + 3 chunk terverifikasi dari domain; komitmen nol-gradient dijaga (pola pakai SVG). [~] MENUNGGU USER: cek tampilan / (landing), /login, /docs ala Notion + sisa Zenith/foto session/blast media/API key light/dark + 360px (hard refresh bila chunk lama). Masalah terbuka: SMTP produksi belum diisi (forgot-password 503); 4.4 verifikasi blast 100 nomor ditunda permanen (risiko banned); 5.15 verifikasi visual menunggu user.

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

## 8. Fase 5: Frontend SaaS Premium (menggantikan spec lama per PROMT.md; menimpa kalimat "tanpa library UI berat")

### Arah desain
Produk ini adalah **konsol operasional gateway WhatsApp**: pengguna memantau koneksi, mengirim pesan, dan menjalankan blast. Tampilannya harus terasa seperti produk SaaS modern berbayar: rapi, cepat, hidup, dan dipercaya. Satu hal yang membuatnya mudah diingat: **orb status "denyut koneksi"** (lihat bagian Signature). Sisanya tenang dan disiplin.

Hindari tampilan generik: jangan jadikan semua konten kartu identik dengan radius dan bayangan yang sama, jangan taruh label huruf kapital berjarak di atas setiap judul, jangan beri animasi masuk fade-up yang sama di setiap seksi. Hierarki harus terlihat dari ukuran, ruang, dan kontras, bukan dari dekorasi.

### Stack frontend (boleh ditambahkan, dipin versinya)
`next-themes`, `motion` (Framer Motion), `sonner`, `cmdk`, `lucide-react`, `recharts` (dynamic import), `clsx`, `tailwind-merge`, `class-variance-authority`, primitif `@radix-ui/*` (dialog, dropdown-menu, tabs, tooltip, switch, popover). Font lewat `next/font/google` (self-host saat build). Library lain di luar daftar: catat alasannya di Log.

### Token desain
Semua warna lewat CSS variable (format `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--primary`, `--ring`, dst) dan dipetakan di Tailwind. Light dan dark sama-sama dirancang penuh, bukan hasil invert.

- **Dark (default):** latar ink-navy `#0A0F1C`, permukaan `#111827`/`#162033`, border `rgba(255,255,255,.08)`, teks `#E6EAF2`, teks redup `#8B96AD`.
- **Light:** latar pearl dingin `#F5F7FB`, permukaan `#FFFFFF`, border `#E3E8F0`, teks `#0F172A`, teks redup `#5B6780`.
- **Primary:** indigo-sinyal `#5B7CFA` (hover `#7491FF`), gradient halus ke `#8B5CF6` hanya untuk CTA utama dan elemen hero.
- **Semantik status:** open/terhubung `#2DD4BF` (mint), connecting/pairing `#F5B84B` (amber), qr `#60A5FA`, closed/stopped `#94A3B8`, logged_out/gagal `#F87171`. Warna status **selalu disertai ikon atau teks**, jangan mengandalkan warna saja.
- **Tipografi:** display `Bricolage Grotesque` (judul halaman, angka besar), body `Instrument Sans`, mono `JetBrains Mono` (ID session, nomor, kode pairing, payload). Skala: 12/13/14/16/20/24/32/44. Panjang baris teks bacaan < 80 karakter. Angka di tabel dan kartu statistik memakai `tabular-nums`.
- **Radius bertingkat:** kontrol kecil 8px, kartu 14px, panel besar/modal 20px, pil/badge penuh. **Bayangan bertingkat:** tiga level, tiap level punya fungsi (kartu diam, kartu terangkat/hover, overlay). Di dark mode pakai border + glow tipis, bukan bayangan abu.
- **Spacing:** kelipatan 4px, kontainer konten max 1280px, padding halaman 16 (mobile) / 24 / 32.

### Tema (Dark / Light / System)
- `next-themes` dengan `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange` saat berganti.
- **Tanpa kedipan saat reload** (flash of wrong theme): pasang provider di root layout, `suppressHydrationWarning` di `<html>`.
- Toggle tiga pilihan (Terang, Gelap, Sistem) di topbar dan di Settings, dengan animasi ikon matahari/bulan.
- Perbarui `<meta name="theme-color">` sesuai tema. Grafik, QR, dan skeleton harus benar di kedua tema.

### Efek (katalog; terapkan dengan disiplin)
Aturan efek: hanya animasikan `transform` dan `opacity`, durasi 150 sampai 400ms, easing `cubic-bezier(.2,.8,.2,1)`, semua dimatikan atau disederhanakan saat `prefers-reduced-motion`. Gerak yang **menjawab aksi user** (buka, tutup, sukses, hapus) selalu diutamakan dibanding gerak dekoratif.

1. **Latar:** gradient mesh/aurora yang sangat halus dan statis (blur besar, opasitas rendah) di login dan hero dashboard. Tidak dianimasikan terus-menerus.
2. **Glassmorphism terukur:** topbar, drawer, dan modal memakai `backdrop-blur` + surface semi-transparan. Jangan di semua kartu.
3. **Spotlight hover:** kartu statistik dan kartu session punya cahaya yang mengikuti kursor (radial-gradient dari posisi mouse via CSS variable). Nonaktif di perangkat sentuh.
4. **Count-up angka** pada kartu statistik saat pertama tampil (sekali per muat halaman), `tabular-nums` agar lebar stabil.
5. **Shimmer skeleton** untuk semua state loading; bentuk skeleton meniru konten asli (tidak ada layar kosong atau spinner di tengah).
6. **Transisi halaman:** crossfade + geser 8px, satu orkestrasi per halaman (stagger ringan untuk blok utama saja, bukan tiap elemen).
7. **Indikator aktif sidebar:** pil highlight bergeser antar menu (`layoutId` shared).
8. **Micro-interaction:** tombol menekan (scale .97), switch dengan pegas, checkbox tercentang animasi, badge status berubah dengan transisi warna, item list masuk/keluar dengan `AnimatePresence`.
9. **Toast** (sonner) untuk semua hasil aksi, dengan kata kerja yang sama seperti tombolnya ("Simpan" menghasilkan "Tersimpan").
10. **Momen sukses:** saat session berubah menjadi `open`, tampil animasi centang + burst partikel kecil sekali (maksimal 1 detik).
11. **Command palette** `Ctrl/Cmd+K` (cmdk): lompat halaman, buat session, ganti tema, logout.
12. **Scroll:** header tabel/kolom sticky dengan bayangan muncul saat scroll, scrollbar tipis bertema.

### Signature: Orb "Denyut Koneksi"
Setiap session punya orb status bulat dengan warna semantik. Saat `open`: dua cincin riak lembut bergantian (pulse). `connecting`/`pairing`: cincin berputar. `qr`: kedip lambat. `closed`/`stopped`: statis redup. `logged_out`: statis merah dengan ikon. Orb dipakai konsisten di kartu session, sidebar (session aktif), header chat, dan tabel admin. Ukuran: 8 (inline), 12 (daftar), 56 (kartu besar). Ini satu-satunya elemen yang boleh terus bergerak tanpa dipicu user.

### Komponen dan pola wajib
- **Tabel responsif:** di desktop tabel penuh dengan sort/filter; di bawah 768px berubah menjadi daftar kartu, bukan scroll horizontal.
- **Form:** validasi inline (zod, pesan Bahasa Indonesia), tombol submit menunjukkan loading dan mencegah klik ganda, error dari server tampil di bawah field terkait.
- **Aksi destruktif** (hapus user, stop+logout, hapus session, cancel blast) selalu lewat `ConfirmDialog` yang menyebut nama objeknya.
- **Empty state** mengajak bertindak ("Belum ada session. Buat session pertamamu."), dengan ilustrasi SVG ringan dan satu tombol aksi.
- **Error state** menjelaskan apa yang terjadi dan cara memperbaikinya, ada tombol "Coba lagi". Jangan minta maaf berlebihan, jangan samar.
- **Polling cerdas:** interval 3 detik, **berhenti saat tab tidak terlihat** (`visibilitychange`) dan lanjut saat kembali; hindari render ulang jika data sama.
- **Optimistic UI** untuk kirim pesan chat (bubble muncul langsung dengan status "mengirim", lalu berubah centang atau gagal dengan tombol kirim ulang).
- **Salin ke clipboard** (ID, kode pairing, invite link) dengan umpan balik ikon berubah jadi centang.
- **Bahasa & copy:** Bahasa Indonesia, kalimat biasa (sentence case), kata kerja aktif ("Buat session", bukan "Submit"), nama istilah yang dimengerti user ("Tautkan perangkat", bukan "pairing endpoint"). Satu aksi, satu nama di seluruh alur.

### Spesifikasi per halaman
**Login:** dua kolom di desktop (kiri: nilai produk singkat + latar mesh halus; kanan: form), satu kolom di mobile. Field username/email dan password dengan tombol tampil/sembunyi, loading state, error inline, efek card masuk sekali. Toggle tema di pojok.

**Dashboard:** salam singkat + tanggal. Baris kartu statistik (session, terhubung, pesan masuk, keluar, hari ini, user untuk admin) dengan count-up dan spotlight. Grafik area 7 hari (masuk vs keluar, recharts, gradient fill, tooltip kustom, benar di dark/light). Daftar session dengan orb, label, nomor, status, aksi cepat. Panel "Aktivitas terakhir". Grid 1 kolom mobile, 2 tablet, 4 desktop.

**Sessions:** grid kartu session (orb besar, label bisa diedit inline, nomor, nama WA, status, tombol Start/Stop/Logout/Hapus lewat dropdown). Tombol "Buat session". **Alur tautkan perangkat** di modal/panel dengan tab "Scan QR" dan "Kode pairing": QR tampil dengan bingkai pemindai beranimasi (sudut + garis scan), countdown refresh QR; tab pairing: input nomor dengan format internasional, hasil kode ditampilkan besar dalam kotak mono terpisah per karakter dengan tombol salin dan instruksi 3 langkah. Polling status; saat `open` modal berubah menjadi momen sukses lalu tertutup.

**Chat:** layout tiga zona di desktop (daftar kontak, percakapan, info kontak opsional), mobile satu zona penuh dengan tombol kembali. Daftar kontak dengan pencarian, pesan terakhir, waktu, badge belum dibaca lokal. Bubble masuk/keluar berbeda, pemisah tanggal, centang status (terkirim/diterima/dibaca), auto-scroll cerdas (tidak melompat jika user sedang membaca ke atas, tampil tombol "Pesan baru"), composer auto-resize, kirim dengan Enter, Shift+Enter baris baru. Pilih session di header dengan orb.

**Messages:** toolbar filter (session, arah, rentang tanggal, kontak) + pencarian dengan debounce, tabel responsif, paginasi, panel detail payload (JSON viewer mono) di drawer samping, ekspor CSV halaman aktif.

**Groups:** daftar grup (kartu/tabel), buat grup dalam modal bertahap, halaman detail dengan tab Anggota, Pengaturan, Undangan, Permintaan gabung. Anggota: avatar, badge admin, menu aksi promote/demote/keluarkan dengan konfirmasi. Undangan: link dengan tombol salin dan revoke.

**Contacts:** cek nomor (input + hasil dengan animasi terdaftar/tidak), kartu profil (foto, about), tab Blocklist dengan tambah/buka blokir.

**Blast:** wizard 3 langkah (Pesan: template + variabel `{{nama}}` dengan pratinjau langsung; Penerima: tempel/unggah, ringkasan jumlah valid, duplikat, tidak valid; Pengaturan: delay min/max, tombol, media) lalu halaman pantau: progress bar beranimasi, hitung pending/sent/failed, tabel penerima, tombol Jeda/Lanjut/Batalkan, estimasi sisa waktu.

**Admin:** tab Ringkasan (statistik sistem), Pengguna (tabel + modal tambah/ubah, switch aktif, badge role, aksi hapus dengan konfirmasi), Session (semua session, filter pemilik, aksi Paksa stop), Audit pesan. Seluruh halaman hanya untuk admin; non-admin diarahkan ke dashboard dengan toast.

**Settings:** tab Profil (avatar dengan pratinjau URL, full_name, email, phone), Webhook (URL, secret dengan tampil/sembunyi + generate acak + salin, tombol "Kirim uji"), Keamanan (ganti password dengan verifikasi password lama + indikator kekuatan), Tampilan (tema Terang/Gelap/Sistem, kurangi animasi).

### Navigasi dan shell
Sidebar desktop (bisa dilipat ke mode ikon, ingat pilihan di localStorage), drawer mobile dengan gestur tutup, **bottom bar mobile** untuk 4 menu utama (Dashboard, Sessions, Chat, Lainnya). Topbar: judul halaman, pencarian cepat (membuka command palette), toggle tema, menu user (profil, tema, logout). Breadcrumb di halaman detail. Item "Admin" hanya muncul untuk role admin.

### Aksesibilitas dan performa (batas minimum)
- Fokus keyboard selalu terlihat (`:focus-visible` ring), semua kontrol bisa dioperasikan keyboard, dialog menjebak fokus, label dan `aria-*` pada ikon-saja, `aria-live` untuk toast dan status session.
- Kontras teks minimal WCAG AA di light dan dark. Target sentuh minimal 44px di mobile.
- `prefers-reduced-motion`: matikan efek dekoratif (aurora, spotlight, pulse orb jadi statis, count-up langsung ke angka akhir).
- Rancang dari 360px ke atas; tidak ada scroll horizontal pada body.
- `recharts`, confetti/burst, dan editor berat di-`dynamic import`. Gunakan `LazyMotion` agar bundle motion kecil. Hindari layout shift (ukuran gambar/skeleton ditetapkan). Gambar avatar lewat `<img>` dengan fallback inisial.
- Semua komponen tetap Server Component jika tidak butuh interaktivitas; `'use client'` hanya di daun pohon komponen.

### Kriteria selesai Fase 5
Tampilan konsisten di light dan dark tanpa kedipan, tiap halaman punya state loading/kosong/error yang dirancang, efek mematuhi reduced-motion, aplikasi nyaman di 360px dan di desktop lebar, seluruh data dari API nyata, dan `npm run build` lolos tanpa error TypeScript.
