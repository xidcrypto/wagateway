'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Copy, LogOut, Plus, RefreshCw, UserMinus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, TextArea, TextInput } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import {
  ApiError,
  createGroup,
  getGroupInvite,
  getGroupMetadata,
  leaveGroup,
  listGroups,
  listSessions,
  renameGroup,
  revokeGroupInvite,
  updateGroupMembers,
  type GroupSummary,
  type SessionItem,
} from '@/lib/client/api';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function memberLabel(p: { id: string | null; phoneNumber: string | null; admin: string | null }): string {
  return p.phoneNumber ?? p.id ?? '?';
}

function GroupDetail({
  sessionId,
  jid,
  onBack,
  onChanged,
}: {
  sessionId: string;
  jid: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const [renameInput, setRenameInput] = useState('');
  const [showLeave, setShowLeave] = useState(false);

  async function refresh(): Promise<void> {
    try {
      const r = await getGroupMetadata(sessionId, jid);
      setGroup(r.group);
      setRenameInput(r.group.subject ?? '');
    } catch (e) {
      toast('error', errMsg(e, 'Gagal memuat detail grup.'));
    }
  }

  useEffect(() => {
    let cancelled = false;
    getGroupMetadata(sessionId, jid)
      .then((r) => {
        if (!cancelled) {
          setGroup(r.group);
          setRenameInput(r.group.subject ?? '');
        }
      })
      .catch((e) => {
        if (!cancelled) toast('error', errMsg(e, 'Gagal memuat detail grup.'));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, jid]);

  function parseNumbers(raw: string): string[] {
    return raw
      .split(/[\n\r,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  async function handleMembers(action: 'add' | 'remove' | 'promote' | 'demote'): Promise<void> {
    const nums = parseNumbers(memberInput);
    if (nums.length === 0) {
      toast('error', 'Isi minimal 1 nomor.');
      return;
    }
    setBusy(true);
    try {
      const r = await updateGroupMembers(sessionId, jid, action, nums);
      const fails = r.results.filter((x) => x.status !== '200' && x.status !== 'OK' && !x.status.startsWith('2'));
      toast(
        fails.length === 0 ? 'success' : 'info',
        fails.length === 0 ? 'Anggota berhasil diupdate.' : `${r.results.length - fails.length} berhasil, ${fails.length} gagal.`,
      );
      setMemberInput('');
      await refresh();
      onChanged();
    } catch (e) {
      toast('error', errMsg(e, 'Gagal mengelola anggota.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!renameInput.trim()) {
      toast('error', 'Nama grup wajib diisi.');
      return;
    }
    setBusy(true);
    try {
      await renameGroup(sessionId, jid, renameInput.trim());
      toast('success', 'Nama grup diubah.');
      await refresh();
      onChanged();
    } catch (e2) {
      toast('error', errMsg(e2, 'Gagal mengubah nama.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(): Promise<void> {
    setBusy(true);
    try {
      const r = await getGroupInvite(sessionId, jid);
      setInvite({ code: r.code, link: r.link });
    } catch (e) {
      toast('error', errMsg(e, 'Gagal mengambil invite link.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(): Promise<void> {
    setBusy(true);
    try {
      const r = await revokeGroupInvite(sessionId, jid);
      setInvite({ code: r.code, link: r.link });
      toast('success', 'Invite link lama dicabut, link baru diterbitkan.');
    } catch (e) {
      toast('error', errMsg(e, 'Gagal revoke invite.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave(): Promise<void> {
    setBusy(true);
    try {
      await leaveGroup(sessionId, jid);
      toast('success', 'Keluar dari grup.');
      onChanged();
      onBack();
    } catch (e) {
      toast('error', errMsg(e, 'Gagal keluar dari grup.'));
    } finally {
      setBusy(false);
      setShowLeave(false);
    }
  }

  function copyLink(): void {
    if (!invite) return;
    void navigator.clipboard?.writeText(invite.link).then(
      () => toast('success', 'Link disalin.'),
      () => toast('error', 'Gagal menyalin.'),
    );
  }

  if (!group) return <p className="text-zinc-400">Memuat detail…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="secondary" onClick={onBack}>
        <span className="flex items-center gap-1"><ArrowLeft size={14} /> Kembali ke daftar</span>
      </Button>

      <Card title={group.subject ?? '(tanpa nama)'}>
        <p className="break-all text-xs text-zinc-500">{group.id}</p>
        <p className="mt-1 text-sm text-zinc-400">
          {group.size} anggota
          {group.announce ? ' · hanya admin bisa kirim' : ''}
          {group.restrict ? ' · info terkunci' : ''}
        </p>
        {group.desc ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{group.desc}</p>
        ) : null}
      </Card>

      <Card title="Ubah nama">
        <form onSubmit={(e) => void handleRename(e)} className="flex gap-2">
          <div className="min-w-0 flex-1">
            <TextInput
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              maxLength={100}
              aria-label="Nama grup baru"
            />
          </div>
          <Button type="submit" disabled={busy}>Simpan</Button>
        </form>
      </Card>

      <Card title={`Anggota (${group.participants.length})`}>
        <ul className="mb-3 flex max-h-48 flex-col gap-1 overflow-y-auto">
          {group.participants.map((p, i) => (
            <li
              key={`${p.id ?? '?'}:${i}`}
              className="flex items-center justify-between rounded-lg bg-zinc-950 px-3 py-1.5 text-sm"
            >
              <span className="text-zinc-200">{memberLabel(p)}</span>
              {p.admin ? (
                <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[11px] text-emerald-300">
                  {p.admin === 'superadmin' ? 'owner' : 'admin'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <TextArea
          label="Nomor (satu per baris / koma, format 62812…)"
          value={memberInput}
          onChange={(e) => setMemberInput(e.target.value)}
          rows={2}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void handleMembers('add')}>
            <span className="flex items-center gap-1"><UserPlus size={14} /> Tambah</span>
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void handleMembers('remove')}>
            <span className="flex items-center gap-1"><UserMinus size={14} /> Hapus</span>
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void handleMembers('promote')}>
            Promote
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void handleMembers('demote')}>
            Demote
          </Button>
        </div>
      </Card>

      <Card title="Invite link">
        {invite ? (
          <div className="flex flex-col gap-2">
            <p className="break-all rounded-lg bg-zinc-950 px-3 py-2 text-sm text-emerald-300">
              {invite.link}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={copyLink}>
                <span className="flex items-center gap-1"><Copy size={14} /> Salin</span>
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void handleRevoke()}>
                <span className="flex items-center gap-1"><RefreshCw size={14} /> Revoke & baru</span>
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" disabled={busy} onClick={() => void handleInvite()}>
            Tampilkan invite link
          </Button>
        )}
      </Card>

      <Card title="Zona bahaya">
        <Button variant="danger" onClick={() => setShowLeave(true)}>
          <span className="flex items-center gap-1"><LogOut size={14} /> Keluar dari grup</span>
        </Button>
      </Card>

      {showLeave ? (
        <Modal title="Keluar dari grup?" onClose={() => setShowLeave(false)}>
          <p className="text-sm text-zinc-300">
            Keluar dari <b>{group.subject}</b>? Kamu tidak bisa kembali tanpa invite baru.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setShowLeave(false)}>Batal</Button>
            <Button variant="danger" disabled={busy} onClick={() => void handleLeave()}>
              Ya, keluar
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export default function GroupsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [participants, setParticipants] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSessions()
      .then((r) => {
        if (!cancelled) {
          setSessions(r.sessions);
          if (r.sessions.length > 0) setSessionId(r.sessions[0].id);
          else setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast('error', e instanceof ApiError ? e.message : 'Gagal memuat session.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshGroups(): Promise<void> {
    if (!sessionId) return;
    try {
      const r = await listGroups(sessionId);
      setGroups(r.groups);
    } catch (e) {
      toast('error', errMsg(e, 'Gagal memuat grup. Session mungkin belum open.'));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    listGroups(sessionId)
      .then((r) => {
        if (!cancelled) setGroups(r.groups);
      })
      .catch((e) => {
        if (!cancelled) {
          toast('error', errMsg(e, 'Gagal memuat grup. Session mungkin belum open.'));
          setGroups([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!subject.trim()) {
      toast('error', 'Nama grup wajib diisi.');
      return;
    }
    const nums = participants
      .split(/[\n\r,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (nums.length === 0) {
      toast('error', 'Isi minimal 1 nomor peserta.');
      return;
    }
    setCreating(true);
    try {
      await createGroup(sessionId, subject.trim(), nums);
      toast('success', 'Grup dibuat.');
      setSubject('');
      setParticipants('');
      setShowCreate(false);
      await refreshGroups();
    } catch (e2) {
      toast('error', errMsg(e2, 'Gagal membuat grup.'));
    } finally {
      setCreating(false);
    }
  }

  const session = sessions.find((s) => s.id === sessionId);

  if (selected) {
    return (
      <GroupDetail
        sessionId={sessionId}
        jid={selected}
        onBack={() => setSelected('')}
        onChanged={() => void refreshGroups()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Grup</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Daftar, buat, dan kelola grup WhatsApp.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={!sessionId}>
          <span className="flex items-center gap-1"><Plus size={16} /> Buat</span>
        </Button>
      </div>

      <Select
        label="Session"
        value={sessionId}
        onChange={(e) => {
          setSessionId(e.target.value);
          setSelected('');
        }}
      >
        {sessions.length === 0 ? <option value="">Belum ada session</option> : null}
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label} ({s.status}{s.phone ? ` · ${s.phone}` : ''})
          </option>
        ))}
      </Select>

      {session && session.status !== 'open' ? (
        <p role="alert" className="rounded-lg bg-amber-950 px-3 py-2 text-sm text-amber-300">
          Session belum open (status: {session.status}). Daftar grup butuh koneksi aktif.
        </p>
      ) : null}

      {loading ? (
        <p className="text-zinc-400">Memuat…</p>
      ) : groups.length === 0 ? (
        <Card title="Belum ada grup">
          <p className="text-sm text-zinc-400">
            Session ini belum mengikuti grup mana pun, atau belum tersambung.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g, i) => (
            <li key={g.id ?? `${g.subject ?? 'grup'}-${i}`}>
              <button
                type="button"
                onClick={() => setSelected(g.id ?? '')}
                disabled={!g.id}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-left transition hover:border-zinc-700"
              >
                <p className="truncate text-sm font-medium text-zinc-100">
                  {g.subject ?? '(tanpa nama)'}
                </p>
                <p className="text-xs text-zinc-500">{g.size} anggota</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate ? (
        <Modal title="Buat grup" onClose={() => setShowCreate(false)}>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3">
            <TextInput
              label="Nama grup"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
              required
            />
            <TextArea
              label="Peserta (satu nomor per baris / koma, format 62812…)"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              required
            />
            <Button type="submit" disabled={creating}>
              {creating ? 'Membuat…' : 'Buat grup'}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
