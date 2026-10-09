# FRONTEND.md: Tambahan Prompt Frontend (SaaS, Dark/Light, Penuh Efek)

> **Cara pakai:** ganti isi **Fase 5** di `AGENTS.md` dengan seluruh isi file ini (bagian "Prompt Fase 5") dan ganti checklist 5.1 sampai 5.11 dengan checklist di bagian "Checklist pengganti". Jangan ubah aturan global lain. Aturan ini **menimpa** kalimat "tanpa library UI berat" di Fase 5 lama.

---

## Checklist pengganti (tempel ke Bagian 1 AGENTS.md)

### Fase 5: Frontend
- [ ] 5.0 Endpoint pendukung: `GET /api/stats` (statistik user sendiri: session, status, pesan in/out/hari ini, **deret 7 hari** per hari, 10 aktivitas terakhir; admin melihat agregat semua)
- [ ] 5.1 Fondasi desain: font, token warna (light + dark), `next-themes`, Tailwind config, util `cn()`, `globals.css` (variabel, efek dasar, reduced-motion)
- [ ] 5.2 Komponen UI dasar: Button, Input, Select, Textarea, Switch, Badge, Card, Modal/Dialog, Dropdown, Tabs, Tooltip, Skeleton, EmptyState, ConfirmDialog, Toast (sonner), Avatar, Table responsif
- [ ] 5.3 Shell aplikasi: sidebar desktop (collapsible), drawer mobile + bottom bar, topbar, theme toggle, command palette (Ctrl/Cmd+K), auth guard, transisi halaman
- [ ] 5.4 Halaman login (+ efek latar)
- [ ] 5.5 Halaman dashboard (stat cards, grafik 7 hari, daftar session, aktivitas)
- [ ] 5.6 Halaman sessions (kartu session, orb status, alur QR/pairing)
- [ ] 5.7 Halaman chat
- [ ] 5.8 Halaman messages
- [ ] 5.9 Halaman groups
- [ ] 5.10 Halaman contacts
- [ ] 5.11 Halaman blast
- [ ] 5.12 Halaman admin
- [ ] 5.13 Halaman settings
- [ ] 5.14 Polish: audit aksesibilitas, reduced-motion, 360px, kontras light/dark, loading/empty/error state di semua halaman, bundle (dynamic import recharts)
- [ ] 5.15 **Verifikasi Fase 5** (build lolos, semua halaman memakai API nyata, 401 selalu ke login, tema tidak berkedip saat reload)

Catatan protokol: step yang butuh mata manusia (menilai tampilan) tandai `[~]`, tulis "MENUNGGU USER: cek tampilan <halaman>", lalu lanjut ke step berikutnya, jangan diulang-ulang.

---

## Prompt Fase 5: Frontend SaaS Premium

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
