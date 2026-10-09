import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  managerError,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { requireOpenSocket } from '@/lib/server/send-helpers';
import { parseJsonBody } from '@/lib/server/validators';
import {
  detectMediaInfo,
  rebuildWebMessage,
  resolveTarget,
} from '@/lib/server/message-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024;

/** Unduh media pesan. Hasil: base64 + data URI. */
const downloadSchema = z.object({
  message_id: z.union([z.string(), z.number()]).optional(),
  messageId: z.union([z.string(), z.number()]).optional(),
  wa_id: z.string().max(255).optional(),
  waId: z.string().max(255).optional(),
  remote_jid: z.string().max(128).optional(),
  remoteJid: z.string().max(128).optional(),
});

async function handleDownload(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, downloadSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { row } = await resolveTarget(auth.session.id, {
      message_id: parsed.data.message_id ?? parsed.data.messageId,
      wa_id: parsed.data.wa_id ?? parsed.data.waId,
      remote_jid: parsed.data.remote_jid ?? parsed.data.remoteJid,
    });
    const sock = await requireOpenSocket(auth.session.id);

    const webMessage = rebuildWebMessage(row);
    const media = detectMediaInfo(webMessage);
    const baileys = (await import('@rexxhayanasi/elaina-baileys')) as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      downloadMediaMessage: (...args: any[]) => Promise<Buffer>;
    };
    if (typeof baileys.downloadMediaMessage !== 'function') {
      return fail('Library tidak mendukung unduhan media.', 500);
    }
    const buffer = await baileys.downloadMediaMessage(webMessage, 'buffer', {}, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: (sock as any)?.logger,
      reuploadRequest: async (msg: unknown) => sock.updateMediaMessage(msg),
    });
    if (!Buffer.isBuffer(buffer)) {
      return fail('Unduhan media gagal (hasil bukan buffer).', 500);
    }
    if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
      return fail('Media kebesaran (maksimal 64 MB).', 413);
    }
    const base64 = buffer.toString('base64');
    return ok({
      mimetype: media.mimetype,
      mediaType: media.kind,
      filename: media.fileName,
      size: buffer.byteLength,
      base64,
      dataUri: `data:${media.mimetype};base64,${base64}`,
    });
  } catch (err) {
    return managerError('Gagal mengunduh media.', err);
  }
}

export const POST = withAuth(handleDownload);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
