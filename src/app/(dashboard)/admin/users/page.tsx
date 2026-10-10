'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Select, TextInput } from '@/components/ui/Fields';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { ResponsiveTable, Switch } from '@/components/ui/Controls';
import { errMsg, formatDateTime } from '@/components/admin/shared';
import { toast } from '@/components/ui/Toast';
import {
  createAdminUser,
  deleteAdminUser,
  getMe,
  listAdminUsers,
  patchAdminUser,
  type AdminUser,
} from '@/lib/client/api';

export default function AdminUsersPage() {
  const [meId, setMeId] = useState<number | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState('');
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

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMe(), listAdminUsers()])
      .then(([me, u]) => {
        if (cancelled) return;
        setMeId(me.user.id);
        setUsers(u.users);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, 'Gagal memuat pengguna.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q),
    );
  }, [users, userQuery]);

  async function refreshUsers(): Promise<void> {
    const u = await listAdminUsers();
    setUsers(u.users);
  }

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
      await refreshUsers();
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
      await refreshUsers();
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengubah user.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(u: AdminUser, active: boolean): Promise<void> {
    if (meId === u.id && !active) {
      toast('error', 'Akun sendiri tidak bisa dinonaktifkan.');
      return;
    }
    try {
      await patchAdminUser(u.id, { active });
      toast('success', active ? 'User diaktifkan.' : 'User dinonaktifkan.');
      await refreshUsers();
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengubah status user.'));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteAdminUser(deleting.id);
      toast('success', 'User dihapus.');
      setDeleting(null);
      await refreshUsers();
    } catch (err) {
      toast('error', errMsg(err, 'Gagal menghapus user.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-label="Memuat pengguna">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <ErrorState
        message="Gagal memuat pengguna."
        hint={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={`Pengguna (${users.length})`}
        action={
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={15} /> Tambah
          </Button>
        }
      >
        <div className="mb-3 flex max-w-72 items-center gap-2">
          <Search size={15} className="shrink-0 text-muted-foreground" />
          <TextInput
            aria-label="Cari pengguna"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Cari username, email, nama…"
          />
        </div>
        <ResponsiveTable
          columns={['Pengguna', 'Role', 'Aktif', 'Dibuat', 'Aksi']}
          rows={filteredUsers.map((u) => ({
            key: u.id,
            cells: [
              <span key="u" className="flex items-center gap-2.5">
                <Avatar name={u.fullName || u.username} size={32} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {u.username}
                    {meId === u.id ? <span className="text-xs text-muted-foreground"> (kamu)</span> : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                </span>
              </span>,
              <StatusBadge key="r" status={u.role} />,
              <Switch
                key="a"
                checked={u.active}
                label={u.active ? `Nonaktifkan ${u.username}` : `Aktifkan ${u.username}`}
                onChange={(v) => void handleToggleActive(u, v)}
              />,
              <span key="c" className="tnum text-xs text-muted-foreground">{formatDateTime(u.createdAt)}</span>,
              <span key="x" className="flex gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => openEdit(u)}>
                  <Pencil size={13} /> Ubah
                </Button>
                <Button variant="danger" size="sm" disabled={meId === u.id} onClick={() => setDeleting(u)}>
                  <Trash2 size={13} /> Hapus
                </Button>
              </span>,
            ],
            card: (
              <div className="flex items-center gap-2.5">
                <Avatar name={u.fullName || u.username} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {u.username}
                    {meId === u.id ? <span className="text-xs text-muted-foreground"> (kamu)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <p className="mt-1 flex items-center gap-2">
                    <StatusBadge status={u.role} />
                    <span className="text-xs text-muted-foreground">{u.active ? 'aktif' : 'nonaktif'}</span>
                  </p>
                </div>
                <Switch
                  checked={u.active}
                  label={u.active ? `Nonaktifkan ${u.username}` : `Aktifkan ${u.username}`}
                  onChange={(v) => void handleToggleActive(u, v)}
                />
                <Button variant="secondary" size="sm" onClick={() => openEdit(u)} aria-label={`Ubah ${u.username}`}>
                  <Pencil size={13} />
                </Button>
              </div>
            ),
          }))}
          empty={
            <EmptyState
              title={userQuery ? 'Tidak ada pengguna yang cocok' : 'Belum ada pengguna'}
              hint={userQuery ? 'Ubah kata kunci pencarian.' : 'Tambah pengguna pertama dengan tombol di atas.'}
            />
          }
        />
      </Card>

      {showAdd ? (
        <Modal title="Tambah pengguna" onClose={() => setShowAdd(false)}>
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
            <div className="flex items-center justify-between gap-2 rounded-control border border-border bg-background px-3 py-2.5">
              <span className="text-sm">Akun aktif</span>
              <Switch
                checked={editActive}
                label={`Status aktif ${editing.username}`}
                onChange={setEditActive}
              />
            </div>
            <TextInput
              label="Password baru (kosongkan = tidak diubah)"
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
            />
            {meId === editing.id ? (
              <p className="rounded-control border border-status-connecting/40 bg-status-connecting/10 px-3 py-2 text-xs leading-5">
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
        <ConfirmDialog
          title="Hapus user?"
          message={
            <span>
              Hapus <b>{deleting.username}</b> ({deleting.email})? Session miliknya tidak ikut terhapus.
            </span>
          }
          confirmLabel="Ya, hapus"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  );
}
