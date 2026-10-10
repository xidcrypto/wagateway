'use client';

import { useState, type FormEvent } from 'react';
import {
  BarChart3,
  Contact,
  FileText,
  Image as ImageIcon,
  List as ListIcon,
  MapPin,
  MessageSquareReply,
  Mic,
  Plus,
  SquareStack,
  Sticker,
  Video,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextArea, TextInput } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/client/cn';
import {
  ApiError,
  sendAudio,
  sendButtonV2,
  sendButtons,
  sendCarousel,
  sendContact,
  sendDocument,
  sendImage,
  sendList,
  sendLocation,
  sendPoll,
  sendSticker,
  sendVideo,
  type SendButton,
  type SendCarouselCard,
  type SendListSection,
} from '@/lib/client/api';

type Kind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'poll'
  | 'buttons'
  | 'buttonv2'
  | 'list'
  | 'carousel';

const KINDS: Array<{ value: Kind; label: string; icon: React.ReactNode; hint: string }> = [
  { value: 'text', label: 'Teks', icon: <MessageSquareReply size={16} />, hint: 'Pesan teks biasa.' },
  { value: 'image', label: 'Gambar', icon: <ImageIcon size={16} />, hint: 'URL / data URI / path lokal + caption.' },
  { value: 'video', label: 'Video', icon: <Video size={16} />, hint: 'Bisa dikirim sebagai GIF.' },
  { value: 'audio', label: 'Audio', icon: <Mic size={16} />, hint: 'Bisa sebagai voice note.' },
  { value: 'document', label: 'Dokumen', icon: <FileText size={16} />, hint: 'File + nama file.' },
  { value: 'sticker', label: 'Stiker', icon: <Sticker size={16} />, hint: 'Wajib format webp.' },
  { value: 'location', label: 'Lokasi', icon: <MapPin size={16} />, hint: 'Latitude + longitude.' },
  { value: 'contact', label: 'Kontak', icon: <Contact size={16} />, hint: 'vCard nama + nomor.' },
  { value: 'poll', label: 'Polling', icon: <BarChart3 size={16} />, hint: 'Pertanyaan + 2–12 opsi.' },
  { value: 'buttons', label: 'Tombol', icon: <Plus size={16} />, hint: 'Reply/url/copy/call, maks 10, header gambar opsional.' },
  { value: 'buttonv2', label: 'Balas cepat', icon: <MessageSquareReply size={16} />, hint: 'Quick reply klasik, maks 3 tombol reply.' },
  { value: 'list', label: 'List', icon: <ListIcon size={16} />, hint: 'Sections + rows, maks 10 section.' },
  { value: 'carousel', label: 'Carousel', icon: <SquareStack size={16} />, hint: '1–10 card, tiap card wajib gambar/video.' },
];

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Gagal mengirim.';
}

type ButtonDraft = { kind: 'reply' | 'url' | 'copy' | 'call'; id: string; text: string; value: string };

function toSendButton(b: ButtonDraft): SendButton {
  if (b.kind === 'reply') return { type: 'reply', id: b.id.trim(), text: b.text.trim() };
  if (b.kind === 'url') return { type: 'url', text: b.text.trim(), url: b.value.trim() };
  if (b.kind === 'copy') return { type: 'copy', text: b.text.trim(), copy: b.value.trim() };
  return { type: 'call', text: b.text.trim(), call: b.value.trim() };
}

function ButtonEditor({
  buttons,
  max,
  replyOnly,
  onChange,
}: {
  buttons: ButtonDraft[];
  max: number;
  replyOnly?: boolean;
  onChange: (b: ButtonDraft[]) => void;
}) {
  function update(i: number, patch: Partial<ButtonDraft>): void {
    onChange(buttons.map((b, bi) => (bi === i ? { ...b, ...patch } : b)));
  }
  return (
    <div className="flex flex-col gap-2">
      {buttons.map((b, i) => (
        <div key={i} className="rounded-control border border-border bg-background p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Tombol {i + 1}</span>
            <button
              type="button"
              aria-label={`Hapus tombol ${i + 1}`}
              onClick={() => onChange(buttons.filter((_, bi) => bi !== i))}
              className="pressable rounded-control p-1.5 text-muted-foreground hover:bg-muted hover:text-status-failed"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {replyOnly ? null : (
              <Select
                label="Jenis"
                value={b.kind}
                onChange={(e) => update(i, { kind: e.target.value as ButtonDraft['kind'] })}
              >
                <option value="reply">Balas (reply)</option>
                <option value="url">Tautan (url)</option>
                <option value="copy">Salin (copy)</option>
                <option value="call">Telepon (call)</option>
              </Select>
            )}
            <TextInput
              label="Teks tombol (maks 30)"
              value={b.text}
              onChange={(e) => update(i, { text: e.target.value })}
              maxLength={30}
              required
            />
          </div>
          {b.kind === 'reply' ? (
            <div className="mt-2">
              <TextInput
                label="ID tombol"
                value={b.id}
                onChange={(e) => update(i, { id: e.target.value })}
                maxLength={200}
                required
              />
            </div>
          ) : (
            <div className="mt-2">
              <TextInput
                label={b.kind === 'url' ? 'URL' : b.kind === 'copy' ? 'Teks yang disalin' : 'Nomor (format internasional)'}
                value={b.value}
                onChange={(e) => update(i, { value: e.target.value })}
                maxLength={b.kind === 'url' ? 2048 : b.kind === 'copy' ? 1024 : 32}
                required
              />
            </div>
          )}
        </div>
      ))}
      {buttons.length < max ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...buttons, { kind: 'reply', id: '', text: '', value: '' }])}
        >
          <Plus size={14} /> Tambah tombol ({buttons.length}/{max})
        </Button>
      ) : null}
    </div>
  );
}

export function SendCustomModal({
  sessionId,
  remoteJid,
  sessionOpen,
  open,
  onClose,
  onSent,
}: {
  sessionId: string;
  remoteJid: string;
  sessionOpen: boolean;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [kind, setKind] = useState<Kind>('text');
  const [text, setText] = useState('');
  const [media, setMedia] = useState('');
  const [caption, setCaption] = useState('');
  const [filename, setFilename] = useState('');
  const [asGif, setAsGif] = useState(false);
  const [asPtt, setAsPtt] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locName, setLocName] = useState('');
  const [locAddr, setLocAddr] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState('');
  const [footer, setFooter] = useState('');
  const [headerMedia, setHeaderMedia] = useState('');
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
  const [listTitle, setListTitle] = useState('');
  const [listButtonText, setListButtonText] = useState('');
  const [listRaw, setListRaw] = useState('');
  const [carouselRaw, setCarouselRaw] = useState('');
  const [sending, setSending] = useState(false);
  const active = KINDS.find((k) => k.value === kind)!;
  const ready = Boolean(sessionId && remoteJid);

  function resetCustom(): void {
    setMedia('');
    setCaption('');
    setFilename('');
    setAsGif(false);
    setAsPtt(false);
    setLat('');
    setLng('');
    setLocName('');
    setLocAddr('');
    setContactName('');
    setContactPhone('');
    setPollQ('');
    setPollOpts('');
    setFooter('');
    setHeaderMedia('');
    setButtons([]);
    setListTitle('');
    setListButtonText('');
    setListRaw('');
    setCarouselRaw('');
  }

  function parseListSections(): SendListSection[] {
    // Format per baris: Judul Section | Judul baris 1 ; Judul baris 2
    // Contoh:
    //   Menu | Nasi goreng ; Mie goreng
    //   Minum | Es teh ; Kopi
    const sections: SendListSection[] = [];
    for (const line of listRaw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const [titlePart, ...rest] = t.split('|');
      const rowsPart = rest.join('|').trim();
      const rows = rowsPart
        .split(';')
        .map((r) => r.trim())
        .filter(Boolean)
        .map((title) => ({ title }));
      if (rows.length === 0) throw new Error(`Baris "${t}" tidak punya baris (pakai pemisah ";" ).`);
      sections.push({ title: (titlePart ?? '').trim(), rows });
    }
    if (sections.length === 0) throw new Error('Isi minimal 1 section.');
    return sections;
  }

  function parseCarouselCards(): SendCarouselCard[] {
    // Format JSON array, contoh:
    //   [{"image":"https://…","caption":"Promo","buttons":[{"id":"beli","text":"Beli"}]}]
    const raw = carouselRaw.trim();
    if (!raw) throw new Error('Isi JSON cards dulu.');
    let arr: unknown;
    try {
      arr = JSON.parse(raw);
    } catch {
      throw new Error('JSON cards tidak valid.');
    }
    if (!Array.isArray(arr) || arr.length === 0 || arr.length > 10) {
      throw new Error('Cards harus array 1–10 item.');
    }
    return arr as SendCarouselCard[];
  }

  function validateButtons(list: ButtonDraft[], max: number, replyOnly?: boolean): SendButton[] {
    if (list.length === 0) throw new Error('Tambah minimal 1 tombol.');
    if (list.length > max) throw new Error(`Maksimal ${max} tombol.`);
    return list.map((b, i) => {
      if (!b.text.trim()) throw new Error(`Tombol ${i + 1}: teks wajib diisi.`);
      if (b.kind === 'reply' || replyOnly) {
        if (!b.id.trim()) throw new Error(`Tombol ${i + 1}: ID wajib diisi.`);
      } else if (!b.value.trim()) {
        throw new Error(`Tombol ${i + 1}: nilai wajib diisi.`);
      }
      if (replyOnly) return { type: 'reply' as const, id: b.id.trim(), text: b.text.trim() };
      return toSendButton(b);
    });
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!ready || sending) return;
    if (!sessionOpen) {
      toast('error', 'Session belum terhubung. Sambungkan dulu dari halaman Sessions.');
      return;
    }
    setSending(true);
    try {
      const to = remoteJid;
      switch (kind) {
        case 'text': {
          if (!text.trim()) throw new Error('Teks wajib diisi.');
          const { sendText } = await import('@/lib/client/api');
          await sendText(sessionId, to, text.trim());
          setText('');
          break;
        }
        case 'image': {
          if (!media.trim()) throw new Error('Media gambar wajib diisi.');
          await sendImage(sessionId, to, media.trim(), caption.trim() || undefined);
          break;
        }
        case 'video': {
          if (!media.trim()) throw new Error('Media video wajib diisi.');
          await sendVideo(sessionId, to, media.trim(), caption.trim() || undefined, asGif || undefined);
          break;
        }
        case 'audio': {
          if (!media.trim()) throw new Error('Media audio wajib diisi.');
          await sendAudio(sessionId, to, media.trim(), asPtt || undefined);
          break;
        }
        case 'document': {
          if (!media.trim()) throw new Error('Media dokumen wajib diisi.');
          await sendDocument(sessionId, to, media.trim(), caption.trim() || undefined, filename.trim() || undefined);
          break;
        }
        case 'sticker': {
          if (!media.trim()) throw new Error('Media stiker (webp) wajib diisi.');
          await sendSticker(sessionId, to, media.trim());
          break;
        }
        case 'location': {
          const la = Number(lat.trim().replace(',', '.'));
          const ln = Number(lng.trim().replace(',', '.'));
          if (!Number.isFinite(la) || la < -90 || la > 90) throw new Error('Latitude harus -90 sampai 90.');
          if (!Number.isFinite(ln) || ln < -180 || ln > 180) throw new Error('Longitude harus -180 sampai 180.');
          await sendLocation(sessionId, to, la, ln, locName.trim() || undefined, locAddr.trim() || undefined);
          break;
        }
        case 'contact': {
          if (!contactName.trim()) throw new Error('Nama kontak wajib diisi.');
          await sendContact(sessionId, to, contactName.trim(), contactPhone.trim() || undefined);
          break;
        }
        case 'poll': {
          const opts = pollOpts.split('\n').map((o) => o.trim()).filter(Boolean);
          if (!pollQ.trim()) throw new Error('Pertanyaan polling wajib diisi.');
          if (opts.length < 2) throw new Error('Minimal 2 opsi (satu per baris).');
          if (opts.length > 12) throw new Error('Maksimal 12 opsi.');
          await sendPoll(sessionId, to, pollQ.trim(), opts);
          break;
        }
        case 'buttons': {
          if (!text.trim()) throw new Error('Teks wajib diisi.');
          const btns = validateButtons(buttons, 10);
          await sendButtons(sessionId, to, text.trim(), btns, footer.trim() || undefined, headerMedia.trim() || undefined);
          break;
        }
        case 'buttonv2': {
          if (!text.trim()) throw new Error('Teks wajib diisi.');
          const btns = validateButtons(buttons, 3, true);
          await sendButtonV2(
            sessionId,
            to,
            text.trim(),
            btns.map((b) => ({ id: (b.id ?? '').trim(), text: (b.text ?? '').trim() })),
            footer.trim() || undefined,
            headerMedia.trim() || undefined,
          );
          break;
        }
        case 'list': {
          if (!text.trim()) throw new Error('Teks wajib diisi.');
          const sections = parseListSections();
          await sendList(
            sessionId,
            to,
            text.trim(),
            sections,
            listTitle.trim() || undefined,
            listButtonText.trim() || undefined,
            footer.trim() || undefined,
          );
          break;
        }
        case 'carousel': {
          const cards = parseCarouselCards();
          await sendCarousel(sessionId, to, cards, text.trim() || undefined, footer.trim() || undefined);
          break;
        }
      }
      toast('success', 'Terkirim.');
      resetCustom();
      onClose();
      onSent();
    } catch (err) {
      toast('error', errMsg(err));
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <Modal title="Kirim pesan" onClose={onClose} wide>
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  aria-pressed={kind === k.value}
                  className={cn(
                    'pressable flex min-h-11 flex-col items-start gap-1 rounded-control border px-2.5 py-2 text-left',
                    kind === k.value
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                    {k.icon} {k.label}
                  </span>
                  <span className="text-[11px] leading-4">{k.hint}</span>
                </button>
              ))}
            </div>

            {(kind === 'text' || kind === 'buttons' || kind === 'buttonv2' || kind === 'list' || kind === 'carousel') && kind !== 'carousel' ? (
              <TextArea
                label={kind === 'text' ? 'Pesan' : 'Teks pesan'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
            ) : null}
            {kind === 'carousel' ? (
              <TextArea label="Teks pendamping (opsional)" value={text} onChange={(e) => setText(e.target.value)} />
            ) : null}

            {kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'document' || kind === 'sticker' ? (
              <>
                <TextInput
                  label="Media (URL https, data URI, atau path lokal di server)"
                  value={media}
                  onChange={(e) => setMedia(e.target.value)}
                  placeholder="https://… / data:… / /path/lokal"
                  required
                />
                {kind === 'image' || kind === 'video' || kind === 'document' ? (
                  <TextInput label="Caption (opsional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
                ) : null}
                {kind === 'document' ? (
                  <TextInput label="Nama file (opsional)" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="dokumen.pdf" />
                ) : null}
                {kind === 'video' ? (
                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <input type="checkbox" checked={asGif} onChange={(e) => setAsGif(e.target.checked)} className="h-4 w-4 accent-primary" />
                    Kirim sebagai GIF
                  </label>
                ) : null}
                {kind === 'audio' ? (
                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <input type="checkbox" checked={asPtt} onChange={(e) => setAsPtt(e.target.checked)} className="h-4 w-4 accent-primary" />
                    Voice note
                  </label>
                ) : null}
                {kind === 'sticker' ? (
                  <p className="text-xs leading-5 text-muted-foreground">Stiker WhatsApp wajib format webp.</p>
                ) : null}
              </>
            ) : null}

            {kind === 'location' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextInput label="Latitude (-90…90)" value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" required placeholder="-6.2" />
                <TextInput label="Longitude (-180…180)" value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" required placeholder="106.8" />
                <TextInput label="Nama tempat (opsional)" value={locName} onChange={(e) => setLocName(e.target.value)} />
                <TextInput label="Alamat (opsional)" value={locAddr} onChange={(e) => setLocAddr(e.target.value)} />
              </div>
            ) : null}

            {kind === 'contact' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextInput label="Nama kontak" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
                <TextInput label="Nomor (opsional)" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" placeholder="62812…" />
              </div>
            ) : null}

            {kind === 'poll' ? (
              <>
                <TextInput label="Pertanyaan" value={pollQ} onChange={(e) => setPollQ(e.target.value)} required />
                <TextArea label="Opsi (satu per baris, 2–12)" value={pollOpts} onChange={(e) => setPollOpts(e.target.value)} required placeholder={'Pilihan A\nPilihan B'} />
              </>
            ) : null}

            {kind === 'buttons' || kind === 'buttonv2' ? (
              <>
                <ButtonEditor buttons={buttons} max={kind === 'buttons' ? 10 : 3} replyOnly={kind === 'buttonv2'} onChange={setButtons} />
                <TextInput label="Footer (opsional)" value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={1024} />
                <TextInput label="Header gambar (opsional, URL/data URI/path)" value={headerMedia} onChange={(e) => setHeaderMedia(e.target.value)} />
              </>
            ) : null}

            {kind === 'list' ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextInput label="Judul (opsional)" value={listTitle} onChange={(e) => setListTitle(e.target.value)} maxLength={60} />
                  <TextInput label="Teks tombol (opsional)" value={listButtonText} onChange={(e) => setListButtonText(e.target.value)} maxLength={60} placeholder="Lihat Pilihan" />
                </div>
                <TextArea
                  label="Section (satu section per baris: Judul | baris 1 ; baris 2)"
                  value={listRaw}
                  onChange={(e) => setListRaw(e.target.value)}
                  required
                  placeholder={'Menu | Nasi goreng ; Mie goreng\nMinum | Es teh ; Kopi'}
                />
                <TextInput label="Footer (opsional)" value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={1024} />
              </>
            ) : null}

            {kind === 'carousel' ? (
              <>
                <TextArea
                  label="Cards (JSON array 1–10, tiap card: image/video + caption + buttons)"
                  value={carouselRaw}
                  onChange={(e) => setCarouselRaw(e.target.value)}
                  required
                  placeholder='[{"image":"https://…","caption":"Promo","buttons":[{"id":"beli","text":"Beli"}]}]'
                />
                <TextInput label="Footer (opsional)" value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={1024} />
              </>
            ) : null}

            <Button type="submit" disabled={sending || !ready}>
              {sending ? 'Mengirim…' : `Kirim ${active.label}`}
            </Button>
            {!sessionOpen ? (
              <p className="text-xs leading-5 text-status-connecting">
                Session belum terhubung — kirim akan ditolak server. Sambungkan dulu dari halaman Sessions.
              </p>
            ) : null}
      </form>
    </Modal>
  );
}
