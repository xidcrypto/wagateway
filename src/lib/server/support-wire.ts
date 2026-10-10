import 'server-only';

/**
 * Bentuk wire pesan tiket (dipakai semua route tiket + event SSE).
 * Satu definisi agar user/admin/SSE selalu konsisten.
 */

export type SupportMessageWire = {
  id: string;
  fromAdmin: boolean;
  body: string;
  mediaUrl: string | null;
  mediaMime: string | null;
  createdAt: string;
  sender: { id: number; username: string; fullName: string } | null;
};

export type WireMessageRow = {
  id: bigint;
  fromAdmin: boolean;
  body: string;
  mediaPath: string | null;
  mediaMime: string | null;
  createdAt: Date;
  sender: { id: number; username: string; fullName: string } | null;
};

export function toMessageWire(m: WireMessageRow): SupportMessageWire {
  return {
    id: String(m.id),
    fromAdmin: m.fromAdmin,
    body: m.body,
    mediaUrl: m.mediaPath ? `/api/tickets/media/${m.mediaPath}` : null,
    mediaMime: m.mediaMime,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
    sender: m.sender
      ? { id: m.sender.id, username: m.sender.username, fullName: m.sender.fullName }
      : null,
  };
}
