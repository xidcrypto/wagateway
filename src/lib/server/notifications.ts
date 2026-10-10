import 'server-only';

import type { NotificationKind } from '@/generated/prisma/client';
import { prisma } from './prisma';
import { serializeBigInt } from './response';

export type NotifyInput = {
  userId: number;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
};

export type LiveNotification = {
  id: string;
  userId: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
};

/**
 * Simpan notifikasi inbox ke DB + siarkan ke bus live SSE (event 'notification').
 * Tidak pernah melempar (kegagalan hanya di-log) agar tidak menjatuhkan
 * pemanggil (session-manager, blast-worker).
 */
export async function notify(input: NotifyInput): Promise<LiveNotification | null> {
  let row;
  try {
    row = await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title.slice(0, 255),
        body: input.body ?? null,
        link: input.link ?? null,
      },
      select: {
        id: true,
        userId: true,
        kind: true,
        title: true,
        body: true,
        link: true,
        createdAt: true,
      },
    });
  } catch (err) {
    console.warn('[pansa] notifikasi gagal disimpan:', err instanceof Error ? err.message : err);
    return null;
  }
  const payload: LiveNotification = {
    id: String(serializeBigInt(row.id)),
    userId: row.userId,
    kind: String(row.kind),
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
  try {
    const g = globalThis as unknown as {
      __pansaLiveBus?: { listeners: Set<(e: unknown) => void> };
    };
    const bus = g.__pansaLiveBus;
    if (bus) {
      const ev = {
        event: 'notification',
        userId: row.userId,
        timestamp: payload.createdAt,
        data: payload,
      };
      for (const listener of bus.listeners) {
        try {
          listener(ev);
        } catch {
          // Abaikan per-subscriber.
        }
      }
    }
  } catch {
    // Gagal siar tidak masalah; DB tetap sumber kebenaran.
  }
  return payload;
}

/** Broadcast admin ke banyak user (atau semua bila userIds kosong = semua user aktif). */
export async function broadcastNotify(input: {
  userIds?: number[];
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<{ sent: number }> {
  let targets: number[];
  if (input.userIds && input.userIds.length > 0) {
    targets = [...new Set(input.userIds)];
  } else {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true },
    });
    targets = users.map((u) => u.id);
  }
  let sent = 0;
  for (const userId of targets) {
    const r = await notify({
      userId,
      kind: 'broadcast',
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
    if (r) sent += 1;
  }
  return { sent };
}

/** Hitung yang belum dibaca (untuk badge bell). */
export async function countUnread(userId: number): Promise<number> {
  try {
    return await prisma.notification.count({ where: { userId, readAt: null } });
  } catch {
    return 0;
  }
}
