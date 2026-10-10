'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, Check, Copy, ListTree } from 'lucide-react';
import { TextInput } from '@/components/ui/Fields';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/client/cn';

type DocEndpoint = {
  method: string;
  path: string;
  title: string;
  desc: string;
  body?: string;
  query?: string;
  resp?: string;
  note?: string;
};

type DocSection = {
  id: string;
  title: string;
  intro: string;
  endpoints: DocEndpoint[];
};

const SECTIONS: DocSection[] = [
  {
    id: 'sesi',
    title: 'Sesi & koneksi',
    intro:
      'Sesi adalah satu nomor WhatsApp yang tertaut ke server. Buat sesi, tautkan lewat QR atau kode pairing sampai statusnya open, baru kirim pesan. Satu sesi cukup untuk satu nomor.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/sessions',
        title: 'Daftar sesi',
        desc: 'Menampilkan semua sesi milikmu beserta status terakhirnya.',
        resp: '{"sessions": [{"id": "…", "label": "utama", "status": "open", "phone": "62812…"}]}',
      },
      {
        method: 'POST',
        path: '/api/sessions',
        title: 'Buat sesi',
        desc: 'Membuat sesi baru dan langsung men-start-nya. Lanjut tautkan lewat QR atau pairing.',
        body: '{"label": "utama"}',
        resp: '{"session": {"id": "…", "label": "utama", "status": "connecting"}}',
        note: 'Respons 201. Salin id-nya, dipakai di semua endpoint :id.',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id',
        title: 'Detail sesi',
        desc: 'Melihat label, status, nomor, dan nama WA sebuah sesi.',
        resp: '{"session": {"id": "…", "label": "utama", "status": "open", "phone": "62812…"}}',
        note: '404 bila id tidak ada atau bukan milikmu.',
      },
      {
        method: 'PATCH',
        path: '/api/sessions/:id',
        title: 'Ubah label sesi',
        desc: 'Mengganti nama tampilan sesi di dashboard.',
        body: '{"label": "cs-toko"}',
        resp: '{"session": {"id": "…", "label": "cs-toko"}}',
      },
      {
        method: 'DELETE',
        path: '/api/sessions/:id',
        title: 'Hapus sesi',
        desc: 'Menghentikan sesi, menghapus kredensial, pesan, dan blast di dalamnya. Tidak bisa dibatalkan.',
        resp: '{"deleted": true}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/start',
        title: 'Start sesi',
        desc: 'Menyalakan ulang sesi yang berhenti (stopped/closed) tanpa menghapus kredensial.',
        resp: '{"session": {"id": "…", "status": "connecting"}}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/stop',
        title: 'Stop sesi',
        desc: 'Mematikan koneksi. logout false menyimpan kredensial (bisa start tanpa scan ulang), logout true keluar penuh dari WhatsApp.',
        body: '{"logout": false}',
        resp: '{"stopped": true}',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id/status',
        title: 'Status koneksi',
        desc: 'Sumber utama untuk tahu sesi sudah open atau belum, lengkap dengan penanda QR dan pairing yang masih aktif.',
        resp: '{"id": "…", "status": "open", "phone": "62812…", "waName": "Toko", "hasQr": false, "hasPairing": false, "live": true}',
        note: 'Status: connecting → qr | pairing → open. closed reconnect otomatis, logged_out dan stopped tidak.',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id/qr',
        title: 'Ambil QR',
        desc: 'Mengambil QR terakhir sebagai gambar PNG data URL. Scan dari WhatsApp HP: Perangkat Tertaut → Tautkan.',
        resp: '{"qr": "data:image/png;base64,…"}',
        note: 'qr null berarti QR belum tersedia atau sesi sudah open. Polling tiap 3 detik.',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/pairing',
        title: 'Minta kode pairing',
        desc: 'Alternatif tanpa scan. Masukkan kode 8 karakter yang dikembalikan ke WhatsApp HP: Perangkat Tertaut → Tautkan dengan nomor telepon.',
        body: '{"phone": "62812xxxxxxx"}',
        resp: '{"pairing": {"code": "XXXXXXXX", "phone": "62812xxxxxxx", "expiresIn": 180}}',
        note: 'Nomor format internasional tanpa 0 di depan. Kode berlaku ±3 menit, 409 bila sesi sudah open. Alias: /request-code.',
      },
      {
        method: 'DELETE',
        path: '/api/sessions/:id/pairing',
        title: 'Batalkan pairing',
        desc: 'Membatalkan kode pairing yang masih aktif.',
        resp: '{"cancelled": true}',
      },
    ],
  },
  {
    id: 'kirim',
    title: 'Kirim pesan',
    intro:
      'Semua pengiriman memakai pola yang sama: POST ke /send/nama-tipe dengan to dan isi pesan. Nomor tujuan selalu format internasional tanpa 0 (62812…, bukan 0812…). Media bisa URL publik, data URI base64, atau path lokal di server.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/sessions/:id/send/text',
        title: 'Teks',
        desc: 'Pesan teks biasa. Bisa membalas pesan lain dengan reply_to.',
        body: '{"to": "62812xxxxxxx", "text": "Halo, pesan pertama dari API."}',
        resp: '{"messageId": "123", "to": "62812xxxxxxx@s.whatsapp.net", "status": "sent"}',
        note: 'Balas pesan: tambah "reply_to": "<messageId>".',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/image',
        title: 'Gambar',
        desc: 'Mengirim gambar dengan caption opsional.',
        body: '{"to": "62812xxxxxxx", "media": "https://…/foto.jpg", "caption": "Katalog baru"}',
        resp: '{"messageId": "124", "to": "62812xxxxxxx@s.whatsapp.net", "status": "sent"}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/video',
        title: 'Video',
        desc: 'Mengirim video. Set gif true untuk tampil sebagai GIF.',
        body: '{"to": "62812xxxxxxx", "media": "https://…/demo.mp4", "caption": "Cara pakai", "gif": false}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/audio',
        title: 'Audio / voice note',
        desc: 'Mengirim file suara. Set ptt true agar tampil sebagai voice note.',
        body: '{"to": "62812xxxxxxx", "media": "https://…/sapa.mp3", "ptt": true}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/document',
        title: 'Dokumen',
        desc: 'Mengirim file (PDF, spreadsheet, dan lain-lain) dengan nama file yang rapi.',
        body: '{"to": "62812xxxxxxx", "media": "https://…/harga.pdf", "filename": "daftar-harga.pdf"}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/sticker',
        title: 'Stiker',
        desc: 'Mengirim stiker. Berkasnya wajib WebP.',
        body: '{"to": "62812xxxxxxx", "media": "https://…/oke.webp"}',
        note: 'Selain WebP ditolak 400.',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/location',
        title: 'Lokasi',
        desc: 'Mengirim titik lokasi beserta nama dan alamat (muncul sebagai pin di HP penerima).',
        body: '{"to": "62812xxxxxxx", "latitude": -6.2, "longitude": 106.8166, "name": "Toko Pusat", "address": "Jl. Merdeka No. 1"}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/contact',
        title: 'Kontak (vCard)',
        desc: 'Mengirim satu kartu kontak. Untuk banyak kontak sekaligus pakai contacts (maksimal 10).',
        body: '{"to": "62812xxxxxxx", "contact": {"displayName": "Budi", "phone": "62812xxxxxxx"}}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/poll',
        title: 'Polling',
        desc: 'Jajak pendapat pilihan tunggal, 2–12 opsi.',
        body: '{"to": "62812xxxxxxx", "question": "Pilih jadwal kirim?", "options": ["Senin", "Selasa"]}',
        note: 'Alias field: name untuk question, values untuk options.',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/buttons',
        title: 'Tombol interaktif',
        desc: 'Pesan plus tombol: balas cepat, buka link, salin teks, atau telepon. Maksimal 10 tombol, teks tombol maksimal 30 karakter. Bisa pakai header gambar via media.',
        body: '{"to": "62812xxxxxxx", "text": "Butuh bantuan?", "footer": "CS online 09–17", "buttons": [{"type": "reply", "id": "ya", "text": "Ya"}, {"type": "url", "text": "Katalog", "url": "https://…"}]}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/buttonv2',
        title: 'Balas cepat klasik',
        desc: 'Versi sederhana dari buttons: maksimal 3 tombol balas cepat (reply) saja.',
        body: '{"to": "62812xxxxxxx", "text": "Setuju?", "buttons": [{"id": "ya", "text": "Ya"}]}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/list',
        title: 'List pilihan',
        desc: 'Pesan dengan daftar pilihan section + baris. Cocok untuk menu atau katalog singkat. Maksimal 10 section.',
        body: '{"to": "62812xxxxxxx", "text": "Pilih menu:", "buttonText": "Lihat Pilihan", "sections": [{"title": "Makanan", "rows": [{"title": "Nasi goreng"}]}]}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/send/carousel',
        title: 'Carousel',
        desc: 'Kartu geser 1–10 card. Setiap card wajib punya gambar atau video plus minimal 1 tombol.',
        body: '{"to": "62812xxxxxxx", "text": "Promo minggu ini", "cards": [{"image": "https://…/a.jpg", "caption": "Paket A", "buttons": [{"id": "beli", "text": "Beli"}]}]}',
      },
    ],
  },
  {
    id: 'pesan',
    title: 'Riwayat & kelola pesan',
    intro:
      'Semua pesan keluar dan masuk tersimpan otomatis. Pakai riwayat untuk membaca ulang, percakapan untuk daftar kontak, dan aksi pesan untuk reaksi, edit, teruskan, atau unduh media.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/sessions/:id/messages/history',
        title: 'Riwayat pesan',
        desc: 'Menarik pesan terbaru dulu. Saring per kontak, arah, atau kata kunci.',
        query: '?remote_jid=62812xxxxxxx@s.whatsapp.net&direction=out&q=promo&limit=50&offset=0',
        resp: '{"messages": [{"id": "123", "direction": "out", "msgType": "text", "textBody": "…", "status": "read"}], "total": 1}',
        note: 'direction: in (masuk) atau out (keluar). limit maksimal 200.',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id/messages/conversations',
        title: 'Daftar percakapan',
        desc: 'Satu baris per kontak berisi pesan terakhir — bahan baku daftar chat.',
        query: '?limit=50&offset=0',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/messages/react',
        title: 'Beri reaksi',
        desc: 'Menempelkan emoji ke sebuah pesan.',
        body: '{"messageId": "123", "emoji": "👍"}',
        resp: '{"reacted": true}',
        note: 'Alternatif penunjuk pesan: wa_id + remote_jid. Kosongkan emoji untuk mencabut reaksi.',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/messages/read',
        title: 'Tandai dibaca',
        desc: 'Mengirim centang biru untuk pesan yang ditunjuk.',
        body: '{"messageId": "123"}',
        resp: '{"read": true}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/messages/edit',
        title: 'Edit pesan',
        desc: 'Mengubah teks pesan keluar yang sudah terkirim.',
        body: '{"messageId": "123", "text": "Harga revisi: 50 ribu"}',
        resp: '{"edited": true}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/messages/delete',
        title: 'Hapus / tarik pesan',
        desc: 'Menarik pesan terkirim sekaligus menghapus catatannya di server.',
        body: '{"messageId": "123"}',
        resp: '{"deleted": true}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/messages/forward',
        title: 'Teruskan pesan',
        desc: 'Meneruskan pesan ke nomor lain. Objek message mentah didapat dari payload pesan di riwayat atau webhook.',
        body: '{"to": "62812xxxxxxx", "message": {"key": {"id": "…"}, "message": {"conversation": "…"}}, "force": false}',
        resp: '{"messageId": "125", "to": "62812xxxxxxx@s.whatsapp.net", "status": "sent"}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/messages/download-media',
        title: 'Unduh media',
        desc: 'Mengunduh ulang isi media sebuah pesan sebagai base64 dan data URI.',
        body: '{"messageId": "124"}',
        resp: '{"mimetype": "image/jpeg", "size": 41230, "base64": "…", "dataUri": "data:image/jpeg;base64,…"}',
        note: 'Maksimal 64 MB.',
      },
    ],
  },
  {
    id: 'grup',
    title: 'Grup',
    intro:
      'Kelola grup lewat API: buat, undang, atur anggota, sampai kunci pengaturan. JID grup selalu berakhiran @g.us dan bisa disalin dari metadata.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/sessions/:id/groups',
        title: 'Daftar grup',
        desc: 'Semua grup yang diikuti sesi ini.',
        resp: '{"groups": [{"id": "120363…@g.us", "subject": "Tim Sales"}], "total": 1}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/groups/create',
        title: 'Buat grup',
        desc: 'Membuat grup baru beserta peserta awal.',
        body: '{"subject": "Tim Sales", "participants": ["62812xxxxxxx"]}',
        resp: '{"group": {"id": "120363…@g.us", "subject": "Tim Sales"}}',
        note: 'Respons 201. Peserta format internasional tanpa 0.',
      },
      {
        method: 'GET,POST',
        path: '/api/sessions/:id/groups/metadata',
        title: 'Info grup',
        desc: 'Detail grup: nama, deskripsi, pemilik, daftar anggota + status admin.',
        body: '{"jid": "120363…@g.us"}',
        query: '?jid=120363…@g.us',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/groups/name',
        title: 'Ganti nama grup',
        desc: 'Mengubah subject grup.',
        body: '{"jid": "120363…@g.us", "name": "Tim Sales 2026"}',
        resp: '{"updated": true}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/groups/description',
        title: 'Ganti deskripsi grup',
        desc: 'Mengubah deskripsi. Kosongkan untuk menghapus.',
        body: '{"jid": "120363…@g.us", "description": "Koordinasi harian"}',
        resp: '{"updated": true}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/groups/leave',
        title: 'Keluar grup',
        desc: 'Sesi ini keluar dari grup.',
        body: '{"jid": "120363…@g.us"}',
        resp: '{"left": true}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/groups/members',
        title: 'Kelola anggota',
        desc: 'Satu endpoint untuk tambah, keluarkan, jadikan admin, atau turunkan admin.',
        body: '{"jid": "120363…@g.us", "action": "add", "participants": ["62812xxxxxxx"]}',
        note: 'action: add, remove, promote, demote.',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id/groups/invite',
        title: 'Link undangan',
        desc: 'Mengambil kode dan link chat.whatsapp.com grup.',
        query: '?jid=120363…@g.us',
        resp: '{"code": "…", "link": "https://chat.whatsapp.com/…"}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/groups/revoke',
        title: 'Cabut undangan',
        desc: 'Mematikan link lama dan menerbitkan kode baru.',
        body: '{"jid": "120363…@g.us"}',
        resp: '{"code": "…", "link": "https://chat.whatsapp.com/…"}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/groups/join',
        title: 'Gabung via undangan',
        desc: 'Sesi ini gabung ke grup lewat kode atau link.',
        body: '{"code": "…"}',
        resp: '{"groupJid": "120363…@g.us"}',
        note: 'Respons 201. Kode salah/kedaluwarsa → 404 dengan pesan yang jelas.',
      },
      {
        method: 'GET,POST',
        path: '/api/sessions/:id/groups/invite-info',
        title: 'Intip undangan',
        desc: 'Melihat info grup dari kode/link tanpa ikut gabung.',
        body: '{"code": "…"}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/groups/settings',
        title: 'Pengaturan grup',
        desc: 'Mengunci siapa yang boleh kirim pesan atau ubah info grup.',
        body: '{"jid": "120363…@g.us", "setting": "announcement"}',
        note: 'setting: announcement, not_announcement, locked, unlocked.',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/groups/ephemeral',
        title: 'Pesan sementara',
        desc: 'Menyalakan timer pesan hilang otomatis di grup.',
        body: '{"jid": "120363…@g.us", "duration": 86400}',
        note: 'duration (detik): 0 mati, 86400 sehari, 604800 seminggu, 7776000 90 hari.',
      },
      {
        method: 'GET,POST',
        path: '/api/sessions/:id/groups/join-requests',
        title: 'Permintaan gabung',
        desc: 'Melihat daftar yang minta gabung (GET ?jid=), lalu setujui atau tolak (POST).',
        body: '{"jid": "120363…@g.us", "participants": ["62812…"], "action": "approve"}',
        note: 'action: approve atau reject.',
      },
    ],
  },
  {
    id: 'kontak',
    title: 'Kontak, profil & presence',
    intro:
      'Utilitas sehari-hari: cek nomor, intip profil, tampil mengetik, blokir, sampai ganti nama dan foto profil nomor yang tertaut.',
    endpoints: [
      {
        method: 'GET,POST',
        path: '/api/sessions/:id/check-number',
        title: 'Cek nomor WhatsApp',
        desc: 'Memastikan nomor terdaftar di WhatsApp sebelum dikirimi pesan. Bisa sekaligus sampai 20 nomor.',
        body: '{"number": "62812xxxxxxx"}',
        query: '?number=62812xxxxxxx',
        resp: '{"results": [{"jid": "62812xxxxxxx@s.whatsapp.net", "exists": true}]}',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id/about',
        title: 'About kontak',
        desc: 'Membaca status/about yang dipajang sebuah nomor.',
        query: '?number=62812xxxxxxx',
        resp: '{"about": {"status": "…"}}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/presence',
        title: 'Presence (mengetik…)',
        desc: 'Menampilkan status online, mengetik, atau merekam di sisi penerima.',
        body: '{"type": "composing", "to": "62812xxxxxxx"}',
        note: 'type: available, unavailable, composing, recording, paused. to opsional.',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id/profile-picture',
        title: 'Lihat foto profil',
        desc: 'Mengambil URL foto profil. Tanpa number = foto nomor sendiri.',
        query: '?number=62812xxxxxxx',
        resp: '{"url": "https://…"}',
        note: 'url null berarti kontak tidak memasang foto.',
      },
      {
        method: 'PUT',
        path: '/api/sessions/:id/profile-picture',
        title: 'Ganti foto profil',
        desc: 'Mengganti foto profil nomor yang tertaut.',
        body: '{"image": "https://…/foto.jpg"}',
        resp: '{"updated": true}',
      },
      {
        method: 'DELETE',
        path: '/api/sessions/:id/profile-picture',
        title: 'Hapus foto profil',
        desc: 'Menghapus foto profil nomor yang tertaut.',
        resp: '{"deleted": true}',
      },
      {
        method: 'POST,PUT',
        path: '/api/sessions/:id/profile/name',
        title: 'Ganti nama profil',
        desc: 'Nama tampil nomor sendiri, 1–25 karakter.',
        body: '{"name": "Toko Berkah"}',
        resp: '{"name": "Toko Berkah"}',
      },
      {
        method: 'POST,PUT',
        path: '/api/sessions/:id/profile/status',
        title: 'Ganti status profil',
        desc: 'About/status nomor sendiri, maksimal 139 karakter.',
        body: '{"status": "Buka 09–17 WIB"}',
        resp: '{"status": "Buka 09–17 WIB"}',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id/blocklist',
        title: 'Daftar blokir',
        desc: 'Semua kontak yang sedang diblokir sesi ini.',
        resp: '{"blocklist": [], "total": 0}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/block',
        title: 'Blokir kontak',
        desc: 'Memblokir nomor agar tidak bisa menghubungimu.',
        body: '{"number": "62812xxxxxxx"}',
        resp: '{"blocked": true}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/unblock',
        title: 'Buka blokir',
        desc: 'Mencabut blokir sebuah nomor.',
        body: '{"number": "62812xxxxxxx"}',
        resp: '{"blocked": false}',
      },
    ],
  },
  {
    id: 'blast',
    title: 'Blast massal',
    intro:
      'Kirim satu pesan ke banyak nomor sekaligus. Tulis template dengan {{nama}}, tempel daftar penerima, atur jeda antar nomor, lalu pantau progresnya. Campaign langsung berjalan saat dibuat dan bisa dijeda, dilanjut, atau dibatalkan kapan pun tanpa kehilangan progres.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/sessions/:id/blasts',
        title: 'Buat campaign',
        desc: 'Membuat campaign baru (langsung running). Teks boleh kosong bila ada media atau tombol. Variabel {{nama}} diisi dari data tiap penerima.',
        body: '{"label": "Promo", "text": "Halo {{nama}}!", "recipients": [{"phone": "62812xxxxxxx", "nama": "Budi"}], "delayMin": 3000, "delayMax": 5000}',
        resp: '{"blast": {"id": 1, "status": "running", "total": 1}}',
        note: 'Maksimal 50.000 penerima per campaign. delayMin/delayMax = jeda antar nomor (ms), efektif minimal 500 ms. Tambahkan mediaJson (kind image/video/audio/document/sticker + media) dan buttonsJson (mode buttons/buttonv2/list) bila perlu.',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id/blasts',
        title: 'Daftar campaign',
        desc: 'Semua campaign di sesi ini, terbaru dulu.',
        query: '?limit=50&offset=0',
      },
      {
        method: 'GET',
        path: '/api/sessions/:id/blasts/:blastId',
        title: 'Detail & progres',
        desc: 'Isi campaign plus hitungan pending, sent, dan failed.',
        resp: '{"blast": {"id": 1, "status": "running"}, "stats": {"pending": 2, "sent": 5, "failed": 0}}',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/blasts/:blastId/pause',
        title: 'Jeda campaign',
        desc: 'Menghentikan sementara. Kirim yang sudah jalan tidak diulang saat dilanjut.',
        resp: '{"blast": {"id": 1, "status": "paused"}}',
        note: 'Hanya dari running. Status lain → 409.',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/blasts/:blastId/resume',
        title: 'Lanjutkan campaign',
        desc: 'Melanjutkan dari penerima pending berikutnya.',
        resp: '{"blast": {"id": 1, "status": "running"}}',
        note: 'Hanya dari paused. Bila sesi belum open, campaign otomatis paused.',
      },
      {
        method: 'POST',
        path: '/api/sessions/:id/blasts/:blastId/cancel',
        title: 'Batalkan campaign',
        desc: 'Menghentikan permanen. Progres yang sudah terkirim tetap tercatat.',
        resp: '{"blast": {"id": 1, "status": "cancelled"}}',
      },
    ],
  },
  {
    id: 'webhook',
    title: 'Webhook (pesan masuk & status)',
    intro:
      'Webhook adalah URL di server-mu yang dipanggil otomatis setiap ada kejadian: pesan masuk, status terkirim/dibaca, QR baru, sampai sesi terputus. Atur di Pengaturan → Webhook (URL + secret), lalu verifikasi tanda tangannya di setiap request.',
    endpoints: [],
  },
];

const WEBHOOK_EVENTS: { event: string; desc: string }[] = [
  { event: 'qr', desc: 'QR baru tersedia — minta user scan ulang.' },
  { event: 'connected', desc: 'Sesi berhasil tersambung (open).' },
  { event: 'disconnected', desc: 'Koneksi putus, sistem coba sambung ulang otomatis.' },
  { event: 'logged_out', desc: 'Keluar dari HP — sesi perlu ditautkan ulang.' },
  { event: 'stopped', desc: 'Sesi dihentikan lewat API.' },
  { event: 'message', desc: 'Pesan masuk dari kontak (bukan dari diri sendiri).' },
  { event: 'message.status', desc: 'Status pesan keluar berubah: sent → delivered → read.' },
  { event: 'presence', desc: 'Perubahan presence kontak.' },
  { event: 'group', desc: 'Aktivitas grup (anggota/setting berubah).' },
  { event: 'call', desc: 'Panggilan masuk ke nomor sesi.' },
];

const METHOD_CLASS: Record<string, string> = {
  GET: 'bg-status-open/15 text-status-open',
  POST: 'bg-status-qr/15 text-status-qr',
  PUT: 'bg-status-connecting/15 text-status-connecting',
  PATCH: 'bg-status-connecting/15 text-status-connecting',
  DELETE: 'bg-status-failed/15 text-status-failed',
};

function firstMethod(m: string): string {
  return m.split(',')[0]?.trim() ?? 'GET';
}

function fillPath(path: string, query?: string): string {
  const filled = path.replace(':blastId', '1').replace(':id', 'SESSION_ID');
  return query ? `${filled}${query}` : filled;
}

function curlFor(host: string, e: DocEndpoint): string {
  const method = firstMethod(e.method);
  const url = `${host}${fillPath(e.path, method === 'GET' ? e.query : undefined)}`;
  const lines = [`curl -X ${method} -H "x-api-key: pn-ISI-API-KEY" \\`];
  if (e.body) lines.push('  -H "Content-Type: application/json" \\');
  if (e.body) lines.push(`  -d '${e.body}' \\`);
  lines.push(`  "${url}"`);
  return lines.join('\n');
}

function EndpointToggle({
  host,
  e,
  copied,
  onCopy,
  defaultOpen = false,
}: {
  host: string;
  e: DocEndpoint;
  copied: string | null;
  onCopy: (text: string, label: string) => void;
  defaultOpen?: boolean;
}) {
  const curl = curlFor(host, e);
  const curlKey = `curl ${e.method} ${e.path}`;
  return (
    <details
      className="group rounded-control border border-transparent px-2 py-1 transition hover:border-border hover:bg-card"
      open={defaultOpen || undefined}
    >
      <summary className="notion-toggle flex cursor-pointer list-none items-center gap-2.5 py-1.5">
        <span
          aria-hidden
          className="shrink-0 text-xs text-muted-foreground transition-transform group-open:rotate-90"
        >
          →
        </span>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold',
            METHOD_CLASS[firstMethod(e.method)] ?? 'bg-muted text-muted-foreground',
          )}
        >
          {e.method}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.title}</span>
          <code className="tnum block truncate font-mono text-xs text-muted-foreground">
            {e.path}
          </code>
        </span>
        <button
          type="button"
          aria-label={`Salin curl ${e.title}`}
          onClick={(ev) => {
            ev.preventDefault();
            onCopy(curl, curlKey);
          }}
          className="pressable inline-flex min-h-8 shrink-0 items-center gap-1 rounded-control border border-border px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied === curlKey ? <Check size={13} /> : <Copy size={13} />}
          {copied === curlKey ? 'Tersalin' : 'curl'}
        </button>
      </summary>
      <div className="flex flex-col gap-2 pb-2 pl-6 pr-1 pt-1">
        <p className="text-sm leading-6 text-muted-foreground">{e.desc}</p>
        {e.body ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Contoh body JSON</p>
            <pre className="tnum mt-1 overflow-x-auto rounded-control bg-muted/60 p-2.5 font-mono text-xs leading-5">
              {e.body}
            </pre>
          </div>
        ) : null}
        {e.query && firstMethod(e.method) === 'GET' ? (
          <p className="tnum break-all font-mono text-xs text-muted-foreground">
            Contoh: <span className="text-foreground">{e.query}</span>
          </p>
        ) : null}
        {e.resp ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Contoh respons data</p>
            <pre className="tnum mt-1 overflow-x-auto rounded-control bg-muted/60 p-2.5 font-mono text-xs leading-5">
              {e.resp}
            </pre>
          </div>
        ) : null}
        {e.note ? <p className="text-[13px] leading-6 text-muted-foreground">ⓘ {e.note}</p> : null}
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Contoh curl</p>
          <pre className="tnum mt-1 overflow-x-auto rounded-control bg-muted/60 p-2.5 font-mono text-xs leading-5">
            {curl}
          </pre>
        </div>
      </div>
    </details>
  );
}

export function ApiDocsContent({ host }: { host: string }) {
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [active, setActive] = useState<string>('mulai');

  const total = useMemo(() => SECTIONS.reduce((n, s) => n + s.endpoints.length, 0), []);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    const out: { section: string; e: DocEndpoint }[] = [];
    for (const s of SECTIONS) {
      for (const e of s.endpoints) {
        if (`${e.method} ${e.path} ${e.title} ${e.desc}`.toLowerCase().includes(needle)) {
          out.push({ section: s.title, e });
        }
      }
      if (s.id === 'webhook' && 'webhook'.includes(needle)) {
        out.push({
          section: s.title,
          e: {
            method: 'POST',
            path: '(URL milikmu)',
            title: 'Terima webhook',
            desc: 'Bukan endpoint gateway — ini URL di server-mu yang dipanggil gateway.',
          },
        });
      }
    }
    return out;
  }, [q]);

  async function copy(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast('success', 'Disalin.');
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast('error', 'Gagal menyalin.');
    }
  }

  function jump(id: string): void {
    setActive(id);
    setTocOpen(false);
    document.getElementById(`docs-${id}`)?.scrollIntoView({ block: 'start' });
  }

  // Tandai seksi aktif saat scroll (ala daftar isi Notion).
  useEffect(() => {
    const ids = ['mulai', 'auth', ...SECTIONS.map((s) => s.id)];
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id.replace('docs-', ''));
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const id of ids) {
      const el = document.getElementById(`docs-${id}`);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  const base = host || 'https://domain-milikmu';
  const authSnippet = `curl -H "x-api-key: pn-ISI-API-KEY" "${base}/api/sessions"`;
  const firstSnippet = `curl -X POST -H "x-api-key: pn-ISI-API-KEY" -H "Content-Type: application/json" \\
  -d '{"to":"62812xxxxxxx","text":"Halo, ini pesan pertama."}' \\
  "${base}/api/sessions/SESSION_ID/send/text"`;
  const payloadSnippet = `{
  "event": "message",
  "session": "SESSION_ID",
  "timestamp": 1728000000,
  "data": {
    "remoteJid": "62812xxxxxxx@s.whatsapp.net",
    "type": "text",
    "text": "Halo"
  }
}`;
  const verifySnippet = `const sig = req.headers['x-pansa-signature']; // "sha256=<hex>"
const expected = 'sha256=' + crypto
  .createHmac('sha256', process.env.WEBHOOK_SECRET ?? '')
  .update(rawBody, 'utf8')
  .digest('hex');
if (sig !== expected) return res.status(401).end();`;

  const tocItems: { id: string; title: string }[] = [
    { id: 'mulai', title: 'Mulai dalam 3 langkah' },
    { id: 'auth', title: 'Autentikasi & respons' },
    ...SECTIONS.map((s) => ({ id: s.id, title: s.title })),
  ];

  const toc = (
    <nav aria-label="Daftar isi dokumentasi" className="flex flex-col gap-0.5">
      {tocItems.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => jump(t.id)}
          aria-current={active === t.id ? 'true' : undefined}
          className={cn(
            'pressable rounded-control px-2.5 py-1.5 text-left text-sm transition',
            active === t.id
              ? 'bg-muted font-semibold text-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          {t.title}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="flex items-start gap-8">
      {/* Sidebar daftar isi (desktop) */}
      <aside className="sticky top-20 hidden w-56 shrink-0 lg:block">
        <p className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Daftar isi
        </p>
        {toc}
      </aside>

      {/* Dokumen sempit ala Notion */}
      <div className="mx-auto flex w-full min-w-0 max-w-[720px] flex-col gap-6">
        <div>
          <p className="text-sm text-muted-foreground">📄 Dokumentasi</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            API WhatsApp
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            Semua yang bisa dilakukan nomor WhatsApp-mu lewat HTTP: konek, kirim 13 jenis pesan,
            kelola grup, cek kontak, sampai blast massal. {total} endpoint, satu pola yang sama.
            Halaman ini hanya tampil setelah login.
          </p>
        </div>

        {/* Daftar isi (mobile): dropdown di atas dokumen */}
        <details
          className="rounded-card border border-border bg-card lg:hidden"
          open={tocOpen || undefined}
          onToggle={(e) => setTocOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="notion-toggle flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
            <ListTree size={16} className="text-muted-foreground" />
            Daftar isi
          </summary>
          <div className="border-t border-border p-2">{toc}</div>
        </details>

        <section id="docs-mulai" className="flex scroll-mt-24 flex-col gap-2">
          <h2 className="font-display text-xl font-bold">Mulai dalam 3 langkah</h2>
          <ol className="flex flex-col gap-1.5 text-sm leading-6">
            <li>
              <b>1. Ambil API key.</b>{' '}
              <span className="text-muted-foreground">
                Buka Pengaturan → API Key, buat sekali, simpan baik-baik. Setiap request cukup bawa
                header <code className="font-mono">x-api-key: pn-…</code>
              </span>
            </li>
            <li>
              <b>2. Tautkan nomor.</b>{' '}
              <span className="text-muted-foreground">
                Buat sesi, ambil QR (atau kode pairing), scan dari HP sampai statusnya{' '}
                <code className="font-mono">open</code>.
              </span>
            </li>
            <li>
              <b>3. Kirim pesan pertama.</b>{' '}
              <span className="text-muted-foreground">Pakai contoh di bawah, ganti nomor dan isi.</span>
            </li>
          </ol>
          <pre className="tnum overflow-x-auto rounded-control bg-muted/60 p-3 font-mono text-xs leading-5">
            {firstSnippet}
          </pre>
          <div>
            <button
              type="button"
              onClick={() => void copy(firstSnippet, 'Pesan pertama')}
              className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-control border border-border px-3 text-[13px] font-semibold hover:bg-muted"
            >
              {copied === 'Pesan pertama' ? <Check size={14} /> : <Copy size={14} />}{' '}
              {copied === 'Pesan pertama' ? 'Tersalin!' : 'Salin contoh'}
            </button>
          </div>
        </section>

        <section id="docs-auth" className="flex scroll-mt-24 flex-col gap-2">
          <h2 className="font-display text-xl font-bold">Autentikasi & format respons</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Satu header untuk semua endpoint. User hanya bisa menyentuh sesi miliknya (403 bila
            bukan). Semua respons dibungkus envelope: sukses{' '}
            <code className="font-mono">{'{ success: true, data }'}</code>, gagal{' '}
            <code className="font-mono">{'{ success: false, error }'}</code> berisi pesan Bahasa
            Indonesia.
          </p>
          <pre className="tnum overflow-x-auto rounded-control bg-muted/60 p-3 font-mono text-xs leading-5">
            {authSnippet}
          </pre>
          <ul className="tnum grid grid-cols-1 gap-1 text-[13px] sm:grid-cols-2">
            {[
              ['400', 'Isi body/query tidak valid.'],
              ['401', 'Tanpa header atau key salah.'],
              ['403', 'Bukan sesi milikmu.'],
              ['404', 'Sesi/pesan/grup tidak ketemu.'],
              ['409', 'Sesi belum open, atau status blast tak cocok.'],
              ['413', 'Media lewat batas ukuran.'],
              ['429', 'Kena rate limit, coba lagi nanti.'],
            ].map(([code, desc]) => (
              <li key={code} className="flex gap-2">
                <code className="w-10 shrink-0 font-mono font-bold">{code}</code>
                <span className="text-muted-foreground">{desc}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="min-w-0">
          <TextInput
            aria-label="Cari endpoint"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari: kirim gambar, polling, invite grup…"
          />
        </div>
        <p className="tnum -mt-4 text-xs text-muted-foreground" aria-live="polite">
          {matches
            ? `Menampilkan ${matches.length} hasil untuk “${q.trim()}”.`
            : `${total} endpoint dalam ${SECTIONS.length} bagian. Klik judul untuk membuka detail.`}
        </p>

        {matches ? (
          <ul className="flex flex-col gap-1">
            {matches.map(({ section, e }) => (
              <li key={`${section} ${e.method} ${e.path} ${e.title}`}>
                <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section}
                </p>
                <EndpointToggle
                  host={base}
                  e={e}
                  copied={copied}
                  onCopy={(t, l) => void copy(t, l)}
                  defaultOpen
                />
              </li>
            ))}
          </ul>
        ) : (
          SECTIONS.map((s) => (
            <section key={s.id} id={`docs-${s.id}`} className="flex scroll-mt-24 flex-col gap-1">
              <h2 className="font-display text-xl font-bold">{s.title}</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{s.intro}</p>
              {s.id === 'webhook' ? (
                <div className="flex flex-col">
                  <details className="group rounded-control border border-transparent px-2 py-1 transition hover:border-border hover:bg-card">
                    <summary className="notion-toggle flex cursor-pointer list-none items-center gap-2.5 py-1.5">
                      <span
                        aria-hidden
                        className="shrink-0 text-xs text-muted-foreground transition-transform group-open:rotate-90"
                      >
                        →
                      </span>
                      <span className="text-sm font-medium">11 event webhook</span>
                    </summary>
                    <ul className="flex flex-col gap-1 pb-2 pl-6 pr-1 pt-1 text-sm">
                      {WEBHOOK_EVENTS.map((w) => (
                        <li key={w.event} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                          <code className="w-36 shrink-0 font-mono text-[13px] font-bold">{w.event}</code>
                          <span className="leading-6 text-muted-foreground">{w.desc}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                  <details className="group rounded-control border border-transparent px-2 py-1 transition hover:border-border hover:bg-card">
                    <summary className="notion-toggle flex cursor-pointer list-none items-center gap-2.5 py-1.5">
                      <span
                        aria-hidden
                        className="shrink-0 text-xs text-muted-foreground transition-transform group-open:rotate-90"
                      >
                        →
                      </span>
                      <span className="text-sm font-medium">Contoh payload + verifikasi tanda tangan</span>
                    </summary>
                    <div className="flex flex-col gap-2 pb-2 pl-6 pr-1 pt-1">
                      <pre className="tnum overflow-x-auto rounded-control bg-muted/60 p-2.5 font-mono text-xs leading-5">
                        {payloadSnippet}
                      </pre>
                      <pre className="tnum overflow-x-auto rounded-control bg-muted/60 p-2.5 font-mono text-xs leading-5">
                        {verifySnippet}
                      </pre>
                      <p className="text-[13px] leading-6 text-muted-foreground">
                        Header: <code className="font-mono">x-pansa-event</code> (nama event) +{' '}
                        <code className="font-mono">x-pansa-signature: sha256=&lt;HMAC hex&gt;</code>.
                        Timeout 10 detik, tanpa retry — pastikan endpoint-mu merespons cepat.
                      </p>
                    </div>
                  </details>
                </div>
              ) : (
                <ul className="flex flex-col">
                  {s.endpoints.map((e) => (
                    <li key={`${e.method} ${e.path}`}>
                      <EndpointToggle
                        host={base}
                        e={e}
                        copied={copied}
                        onCopy={(t, l) => void copy(t, l)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}

        {!matches || matches.length > 0 ? null : (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <BookOpenText size={16} /> Tidak ada yang cocok. Coba kata lain, misal “gambar” atau
            “grup”.
          </p>
        )}
      </div>
    </div>
  );
}
