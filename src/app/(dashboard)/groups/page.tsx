'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextArea, TextInput } from '@/components/ui/Fields';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar, CopyButton } from '@/components/ui/Avatar';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { Menu, TabList } from '@/components/ui/Controls';
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
  const [tab, setTab] = useState<'anggota' | 'pengaturan' | 'undangan' | 'bahaya'>('anggota');
  const [kickTarget, setKickTarget] = useState<string | null>(null);

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

  async function handleSingle(action: 'promote' | 'demote', target: string): Promise<void> {
    setBusy(true);
    try {
      await updateGroupMembers(sessionId, jid, action, [target]);
      toast('success', action === 'promote' ? `${target} dijadikan admin.` : `Admin ${target} dicabut.`);
      await refresh();
      onChanged();
    } catch (e) {
      toast('error', errMsg(e, 'Gagal mengubah peran anggota.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleKick(): Promise<void> {
    if (!kickTarget) return;
    setBusy(true);
    try {
      await updateGroupMembers(sessionId, jid, 'remove', [kickTarget]);
      toast('success', `${kickTarget} dikeluarkan.`);
      setKickTarget(null);
      await refresh();
      onChanged();
    } catch (e) {
      toast('error', errMsg(e, 'Gagal mengeluarkan anggota.'));
    } finally {
      setBusy(false);
    }
  }

  if (!group) {
    return (
      <div className="flex flex-col gap-2" aria-label="Memuat detail grup">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="secondary" onClick={onBack} className="self-start">
        <ArrowLeft size={14} /> Kembali ke daftar
      </Button>

      <div className="rounded-card border border-border bg-card p-4 shadow-1 sm:p-5">
        <div className="flex items-start gap-3">
          <Avatar name={group.subject ?? 'Grup'} size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display truncate text-xl font-bold">{group.subject ?? '(tanpa nama)'}</h2>
            <p className="break-all font-mono text-xs text-muted-foreground">{group.id}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              {group.size} anggota
              {group.announce ? <StatusBadge status="announce" /> : null}
              {group.restrict ? <StatusBadge status="locked" /> : null}
            </p>
          </div>
        </div>
        {group.desc ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{group.desc}</p>
        ) : null}
      </div>

      <TabList
        tabs={[
          { value: 'anggota', label: `Anggota (${group.participants.length})` },
          { value: 'pengaturan', label: 'Pengaturan' },
          { value: 'undangan', label: 'Undangan' },
          { value: 'bahaya', label: 'Keluar' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as 'anggota' | 'pengaturan' | 'undangan' | 'bahaya')}
      />

      {tab === 'anggota' ? (
        <div className="rounded-card border border-border bg-card p-4 shadow-1">
          <ul className="mb-3 flex max-h-64 flex-col gap-1 overflow-y-auto">
            {group.participants.map((p, i) => {
              const label = memberLabel(p);
              return (
                <li
                  key={`${p.id ?? '?'}:${i}`}
                  className="flex items-center gap-2.5 rounded-control bg-background px-3 py-2 text-sm"
                >
                  <Avatar name={label} size={32} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{label}</span>
                  {p.admin ? (
                    <StatusBadge status={p.admin === 'superadmin' ? 'owner' : 'admin'} />
                  ) : null}
                  <Menu
                    label={`Aksi ${label}`}
                    trigger={
                      <span className="pressable inline-flex min-h-9 min-w-9 items-center justify-center rounded-control border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                        ⋯
                      </span>
                    }
                    items={[
                      { label: 'Jadikan admin', onClick: () => void handleSingle('promote', label) },
                      { label: 'Cabut admin', onClick: () => void handleSingle('demote', label) },
                      { label: 'Keluarkan', danger: true, onClick: () => setKickTarget(label) },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
          <TextArea
            label="Nomor (satu per baris / koma, format 62812…)"
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value)}
            rows={2}
          />
          <div className="mt-2">
            <Button variant="secondary" disabled={busy} onClick={() => void handleMembers('add')}>
              Tambah anggota
            </Button>
          </div>
        </div>
      ) : null}

      {tab === 'pengaturan' ? (
        <div className="rounded-card border border-border bg-card p-4 shadow-1">
          <form onSubmit={(e) => void handleRename(e)} className="flex flex-col gap-3">
            <TextInput
              label="Nama grup"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              maxLength={100}
            />
            <div>
              <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan nama'}</Button>
            </div>
          </form>
        </div>
      ) : null}

      {tab === 'undangan' ? (
        <div className="rounded-card border border-border bg-card p-4 shadow-1">
          {invite ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 break-all rounded-control bg-background px-3 py-2 font-mono text-[13px] text-primary">
                  {invite.link}
                </p>
                <CopyButton text={invite.link} label="Invite link" />
              </div>
              <div>
                <Button variant="secondary" disabled={busy} onClick={() => void handleRevoke()}>
                  Cabut & terbitkan baru
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={() => void handleInvite()}>
              {busy ? 'Memuat…' : 'Tampilkan invite link'}
            </Button>
          )}
        </div>
      ) : null}

      {tab === 'bahaya' ? (
        <div className="rounded-card border border-status-failed/40 bg-status-failed/5 p-4">
          <p className="text-sm leading-6">
            Keluar dari <b>{group.subject}</b>? Kamu tidak bisa kembali tanpa invite baru.
          </p>
          <div className="mt-3">
            <Button variant="danger" onClick={() => setShowLeave(true)}>
              Keluar dari grup
            </Button>
          </div>
        </div>
      ) : null}

      {kickTarget ? (
        <ConfirmDialog
          title={`Keluarkan ${kickTarget}?`}
          message={
            <>
              <b>{kickTarget}</b> akan dikeluarkan dari grup <b>{group.subject}</b>.
            </>
          }
          confirmLabel="Ya, keluarkan"
          busy={busy}
          onCancel={() => setKickTarget(null)}
          onConfirm={() => void handleKick()}
        />
      ) : null}

      {showLeave ? (
        <ConfirmDialog
          title={`Keluar dari "${group.subject}"?`}
          message="Kamu tidak bisa kembali tanpa invite baru."
          confirmLabel="Ya, keluar"
          busy={busy}
          onCancel={() => setShowLeave(false)}
          onConfirm={() => void handleLeave()}
        />
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Grup</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Daftar, buat, dan kelola grup WhatsApp.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={!sessionId}>
          <Plus size={16} /> Buat grup
        </Button>
      </div>

      <div className="max-w-64">
        <Select
          aria-label="Session"
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
      </div>

      {session && session.status !== 'open' ? (
        <p role="alert" className="rounded-control border border-status-connecting/40 bg-status-connecting/10 px-3 py-2 text-sm">
          Session belum terhubung (status: {session.status}). Daftar grup butuh koneksi aktif.
        </p>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2" aria-label="Memuat grup">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Belum ada grup"
          hint="Session ini belum mengikuti grup mana pun, atau belum tersambung."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {groups.map((g, i) => (
            <li key={g.id ?? `${g.subject ?? 'grup'}-${i}`}>
              <button
                type="button"
                onClick={() => setSelected(g.id ?? '')}
                disabled={!g.id}
                className="pressable flex w-full items-center gap-3 rounded-card border border-border bg-card px-3 py-2.5 text-left shadow-1 hover:border-primary/50"
              >
                <Avatar name={g.subject ?? 'Grup'} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {g.subject ?? '(tanpa nama)'}
                  </span>
                  <span className="block text-xs text-muted-foreground">{g.size} anggota</span>
                </span>
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
