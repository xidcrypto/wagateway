import { NextRequest, NextResponse } from 'next/server';
import { authenticate, isAdmin } from '@/lib/server/auth';
import { onLiveEvent } from '@/lib/server/live-bus';
import { prisma } from '@/lib/server/prisma';
import type { SessionEvent } from '@/lib/server/session-manager';
import { applyCors, applySecurityHeaders } from '@/lib/server/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE live untuk dashboard (pengganti polling rutin).
 * - Autentikasi: Bearer JWT (header) ATAU ?token= (EventSource browser tidak
 *   bisa set header, jadi token dikirim via query — khusus JWT dashboard,
 *   API key tidak diterima di sini).
 * - Filter owner: user biasa hanya menerima event session miliknya; admin
 *   menerima semua. Blast difilter via owner blast (session owner).
 * - Heartbeat komentar tiap 25 dtk agar proxy tidak menutup koneksi idle.
 * - Tanpa retry dari server; client (EventSource) reconnect otomatis.
 */
export async function GET(req: NextRequest): Promise<Response> {
  // EventSource tidak bisa set header → terima ?token= sebagai alternatif.
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token');
  let probe = req;
  if (queryToken && !req.headers.get('authorization')) {
    probe = new NextRequest(req.url, {
      headers: { ...Object.fromEntries(req.headers.entries()), authorization: `Bearer ${queryToken}` },
    });
  }
  const ctx = await authenticate(probe);
  if (!ctx || ctx.kind !== 'jwt') {
    return new Response(JSON.stringify({ success: false, error: 'Belum login. Silakan login dulu.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const admin = isAdmin(ctx);
  const userId = ctx.user.id;

  // Cache owner session milik user (dipakai filter tiap event). Refresh
  // tiap 60 dtk agar session baru ikut terfilter tanpa reconnect.
  let owned = new Set<string>();
  let ownedAt = 0;
  async function refreshOwned(): Promise<void> {
    if (admin) return;
    const now = Date.now();
    if (now - ownedAt < 60_000 && owned.size > 0) return;
    try {
      const rows = await prisma.session.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      owned = new Set(rows.map((r) => r.id));
      ownedAt = now;
    } catch {
      // Biarkan cache lama; stream tetap jalan.
    }
  }
  await refreshOwned();

  // Blast → sessionId cache (agar blast.progress bisa difilter owner).
  const blastSession = new Map<number, string>();
  async function blastOwnerOk(blastId: number): Promise<boolean> {
    if (admin) return true;
    const cached = blastSession.get(blastId);
    if (cached) return owned.has(cached);
    try {
      const b = await prisma.blast.findUnique({
        where: { id: blastId },
        select: { sessionId: true, session: { select: { ownerId: true } } },
      });
      if (!b) return false;
      blastSession.set(blastId, b.sessionId);
      await refreshOwned();
      return b.session?.ownerId === userId;
    } catch {
      return false;
    }
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(name: string, data: unknown): void {
        try {
          controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller tertutup; cleanup di cancel().
        }
      }

      // Sapa + info koneksi (client pakai ini sebagai tanda SSE hidup).
      send('ready', { ok: true, at: new Date().toISOString() });

      unsubscribe = onLiveEvent((ev) => {
        void (async () => {
          try {
            if (isSessionEvent(ev)) {
              await refreshOwned();
              if (!admin && !owned.has(ev.sessionId)) return;
              send('session', ev);
            } else {
              // blast.progress: bentuk { event:'blast.progress', blastId, ... }
              const okOwner = await blastOwnerOk((ev as { blastId: number }).blastId);
              if (!okOwner) return;
              send('blast', ev);
            }
          } catch {
            // Abaikan; jangan jatuhkan stream.
          }
        })();
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // Abaikan; cancel() akan dipanggil runtime.
        }
      }, 25_000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  const res = new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
  applySecurityHeaders(res);
  applyCors(req, res);
  return res;
}

type LiveWireEvent =
  | SessionEvent
  | { event: 'blast.progress'; blastId: number; timestamp: string; data: unknown };

function isSessionEvent(ev: LiveWireEvent): ev is SessionEvent {
  return (ev as SessionEvent).sessionId !== undefined;
}
