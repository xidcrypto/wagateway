'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Select, TextInput } from '@/components/ui/Fields';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import {
  ApiError,
  createAdminUser,
  deleteAdminUser,
  forceStopSession,
  getAdminStats,
  getMe,
  listAdminSessions,
  listAdminUsers,
  patchAdminUser,
  type AdminSession,
  type AdminStats,
  type AdminUser,
} from '@/lib/client/api';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function AdminPage() {
  const [meId, setMeId] = useState<number | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', email: '', fullName: '', password: '', role: 'user' });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshAll(): Promise<void> {
    const [s, u, ss] = await Promise.all([
      getAdminStats(),
      listAdminUsers(),
      listAdminSessions(),
    ]);
    setStats(s);
    setUsers(u.users);
    setSessions(ss.sessions);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMe(), getAdminStats(), listAdminUsers(), listAdminSessions()])
      .then(([me, s, u, ss]) => {
        if (!cancelled) {
          setMeId(me.user.id);
          setStats(s);
          setUsers(u.users);
          setSessions(ss.sessions);
        }
      })
      .catch((e) => {
        if (!cancelled) toast('error', errMsg(e, 'Gagal memuat data admin.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!addForm.username.trim() || !addForm.email.trim() || !addForm.fullName.trim()) {
      toast('error', 'Username, email, dan nama lengkap wajib diisi.');
      return;
    }
    if (addForm.password.length < 6) {
      toast('error', 'Password minimal 6 karakter.');
      return;
    }
    setAdding(true);
    try {
      await createAdminUser({
        username: addForm.username.trim(),
        email: addForm.email.trim(),
        fullName: addForm.fullName.trim(),
        password: addForm.password,
        role: addForm.role === 'admin' ? 'admin' : 'user',
      });
      toast('success', 'User dibuat.');
      setAddForm({ username: '', email: '', fullName: '', password: '', role: 'user' });
      setShowAdd(false);
      await refreshAll();
    } catch (err) {
      toast('error', errMsg(err, 'Gagal membuat user.'));
    } finally {
      setAdding(false);
    }
  }

  function openEdit(u: AdminUser): void {
    setEditing(u);
    setEditRole(u.role);
    setEditActive(u.active);
    setEditPassword('');
  }

  async function handleSaveEdit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const body: { role: 'admin' | 'user'; active: boolean; password?: string } = {
        role: editRole,
        active: editActive,
      };
      if (editPassword) {
        if (editPassword.length < 6) {
          toast('error', 'Password baru minimal 6 karakter.');
          setSaving(false);
          return;
        }
        body.password = editPassword;
      }
      await patchAdminUser(editing.id, body);
      toast('success', 'User diubah.');
      setEditing(null);
      await refreshAll();
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengubah user.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteAdminUser(deleting.id);
      toast('success', 'User dihapus.');
      setDeleting(null);
      await refreshAll();
    } catch (err) {
      toast('error', errMsg(err, 'Gagal menghapus user.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleForceStop(s: AdminSession): Promise<void> {
    setBusy(true);
    try {
      await forceStopSession(s.id, false);
      toast('success', `Session "${s.label}" dihentikan (kredensial disimpan).`);
      await refreshAll();
    } catch (err) {
      toast('error', errMsg(err, 'Gagal menghentikan session.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-zinc-400">Memuat…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Admin</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Statistik sistem, kelola user, dan semua session.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <span className="flex items-center gap-1"><Plus size={16} /> User</span>
        </Button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Card title="User">
            <p className="text-2xl font-bold text-zinc-50">{stats.users.total}</p>
            <p className="text-xs text-zinc-500">
              {stats.users.admins} admin · {stats.users.regular} user
            </p>
          </Card>
          <Card title="Session">
            <p className="text-2xl font-bold text-zinc-50">{stats.sessions.total}</p>
            <p className="text-xs text-zinc-500">{stats.sessions.open} open</p>
          </Card>
          <Card title="Pesan">
            <p className="text-2xl font-bold text-zinc-50">{stats.messages.total}</p>
            <p className="text-xs text-zinc-500">
              {stats.messages.in} masuk · {stats.messages.out} keluar
            </p>
          </Card>
          <Card title="Hari ini">
            <p className="text-2xl font-bold text-zinc-50">{stats.messages.today}</p>
            <p className="text-xs text-zinc-500">pesan</p>
          </Card>
        </div>
      ) : null}

      <Card title={`User (${users.length})`}>
        <ul className="flex flex-col gap-1">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950 px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-100">
                  {u.username}
                  {meId === u.id ? <span className="text-xs text-zinc-500"> (kamu)</span> : null}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {u.email} · {u.role}{u.active ? '' : ' · nonaktif'}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <Button variant="secondary" onClick={() => openEdit(u)}>
                  <span className="flex items-center gap-1 text-xs"><Pencil size={12} /> Ubah</span>
                </Button>
                <Button variant="danger" disabled={meId === u.id} onClick={() => setDeleting(u)}>
                  <span className="flex items-center gap-1 text-xs"><Trash2 size={12} /> Hapus</span>
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Semua session (${sessions.length})`}>
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-400">Belum ada session.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950 px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-100">
                    {s.label}{s.phone ? ` · ${s.phone}` : ''}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {s.owner ? `@${s.owner.username}` : '(tanpa owner)'}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={s.status} />
                  {s.status !== 'stopped' && s.status !== 'logged_out' ? (
                    <Button variant="secondary" disabled={busy} onClick={() => void handleForceStop(s)}>
                      <span className="flex items-center gap-1 text-xs"><Square size={12} /> Stop</span>
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showAdd ? (
        <Modal title="Tambah user" onClose={() => setShowAdd(false)}>
          <form onSubmit={(e) => void handleAdd(e)} className="flex flex-col gap-3">
            <TextInput
              label="Username"
              value={addForm.username}
              onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
              maxLength={32}
              required
            />
            <TextInput
              label="Email"
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              required
            />
            <TextInput
              label="Nama lengkap"
              value={addForm.fullName}
              onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
              maxLength={255}
              required
            />
            <TextInput
              label="Password (min 6)"
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              required
            />
            <Select
              label="Role"
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </Select>
            <Button type="submit" disabled={adding}>
              {adding ? 'Membuat…' : 'Buat user'}
            </Button>
          </form>
        </Modal>
      ) : null}

      {editing ? (
        <Modal title={`Ubah ${editing.username}`} onClose={() => setEditing(null)}>
          <form onSubmit={(e) => void handleSaveEdit(e)} className="flex flex-col gap-3">
            <Select
              label="Role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value === 'admin' ? 'admin' : 'user')}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </Select>
            <Select
              label="Status"
              value={editActive ? 'active' : 'inactive'}
              onChange={(e) => setEditActive(e.target.value === 'active')}
            >
              <option value="active">aktif</option>
              <option value="inactive">nonaktif</option>
            </Select>
            <TextInput
              label="Password baru (kosongkan = tidak diubah)"
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
            />
            {meId === editing.id ? (
              <p className="text-xs text-amber-300">
                Ini akunmu sendiri: role admin tidak bisa dicabut dan akun tidak bisa dinonaktifkan.
              </p>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </form>
        </Modal>
      ) : null}

      {deleting ? (
        <Modal title="Hapus user?" onClose={() => setDeleting(null)}>
          <p className="text-sm text-zinc-300">
            Hapus <b>{deleting.username}</b> ({deleting.email})? Session miliknya tidak ikut terhapus.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)}>Batal</Button>
            <Button variant="danger" disabled={busy} onClick={() => void handleDelete()}>
              Ya, hapus
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
