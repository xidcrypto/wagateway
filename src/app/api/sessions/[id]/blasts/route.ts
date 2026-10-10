import { NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin, withAuth } from '@/lib/server/auth';
import { assertBlastDelay, parseBlastRecipients } from '@/lib/server/blast-recipients';
import { kickBlast } from '@/lib/server/blast-worker';
import { buttonInputSchema, listSectionSchema } from '@/lib/server/interactive';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { authorizeSession, type RouteCtx } from '@/lib/server/session-manager';
import { parseJsonBody } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const blastMediaSchema = z.object({
  kind: z.enum(['image', 'video', 'audio', 'document', 'sticker']),
  media: z.string().min(1, 'Media wajib diisi (URL, data URI, atau path lokal).').max(20_000_000),
  mimetype: z.string().max(127).optional().nullable(),
  filename: z.string().max(255).optional().nullable(),
  gif: z.boolean().optional(),
  ptt: z.boolean().optional(),
});

const blastButtonsSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('buttons'),
    buttons: z.array(buttonInputSchema).min(1, 'Minimal 1 tombol.').max(10, 'Maksimal 10 tombol.'),
    footer: z.string().max(1024).optional().nullable(),
    headerMedia: z.string().max(20_000_000).optional().nullable(),
  }),
  z.object({
    mode: z.literal('buttonv2'),
    buttons: z
      .array(z.object({ id: z.string().min(1).max(200), text: z.string().min(1).max(30) }))
      .min(1, 'Minimal 1 tombol.')
      .max(3, 'buttonv2 maksimal 3 tombol.'),
    footer: z.string().max(1024).optional().nullable(),
    headerMedia: z.string().max(20_000_000).optional().nullable(),
  }),
  z.object({
    mode: z.literal('list'),
    sections: z.array(listSectionSchema).min(1, 'Minimal 1 section.').max(10, 'Maksimal 10 section.'),
    title: z.string().max(60).optional().nullable(),
    buttonText: z.string().max(60).optional().nullable(),
    footer: z.string().max(1024).optional().nullable(),
  }),
]);

const createBlastSchema = z.object({
  label: z.string().min(1, 'Label wajib diisi.').max(255),
  text: z.string().max(65536).optional(),
  textBody: z.string().max(65536).optional(),
  recipients: z.unknown(),
  media: z.string().max(20_000_000).optional().nullable(),
  mediaJson: z.unknown().optional().nullable(),
  mediaKind: z.enum(['image', 'video', 'audio', 'document', 'sticker']).optional(),
  mimetype: z.string().max(127).optional().nullable(),
  filename: z.string().max(255).optional().nullable(),
  gif: z.boolean().optional(),
  ptt: z.boolean().optional(),
  buttons: z.array(z.unknown()).max(10, 'Maksimal 10 tombol.').optional(),
  buttonsJson: z.unknown().optional().nullable(),
  buttonsMode: z.enum(['buttons', 'buttonv2', 'list']).optional(),
  footer: z.string().max(1024).optional().nullable(),
  headerMedia: z.string().max(20_000_000).optional().nullable(),
  delay_min: z.number().optional(),
  delayMin: z.number().optional(),
  delay_max: z.number().optional(),
  delayMax: z.number().optional(),
});

async function ownerGuard(
  ctx: { user: { id: number } },
  sessionOwnerId: number | null,
): Promise<Response | null> {
  if (isAdmin(ctx as Parameters<typeof isAdmin>[0])) return null;
  if (sessionOwnerId !== ctx.user.id) {
    return fail('Akses ditolak. Bukan blast milikmu.', 403);
  }
  return null;
}

/**
 * Buat campaign blast (langsung berjalan, status `running`).
 * Penerima disimpan createMany per batch 1000 dalam $transaction bersama blast.
 */
export const POST = withAuth(async (req: NextRequest, ctx, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const denied = await ownerGuard(ctx, auth.session.ownerId);
  if (denied) return denied;

  const parsed = await parseJsonBody(req, createBlastSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (body.recipients === undefined || body.recipients === null) {
    return fail('recipients: Wajib diisi.', 400);
  }
  const { recipients, skipped } = parseBlastRecipients(body.recipients);
  if (recipients.length === 0) {
    return fail('recipients: Tidak ada nomor valid.', 400);
  }

  const delayMin = body.delayMin ?? body.delay_min ?? 1000;
  const delayMax = body.delayMax ?? body.delay_max ?? 3000;
  let delay: { minMs: number; maxMs: number };
  try {
    delay = assertBlastDelay(delayMin, delayMax);
  } catch (err) {
    const status =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? Number((err as { statusCode: unknown }).statusCode) || 400
        : 400;
    return fail(err instanceof Error ? err.message : 'Delay tidak valid.', status);
  }

  const textBody = (body.text ?? body.textBody ?? '').trim();

  // Komposisi opsional: teks boleh kosong bila ada media (caption kosong) —
  // tapi minimal salah satu dari teks / media / buttons wajib ada.
  let mediaJson: unknown = body.mediaJson ?? undefined;
  let buttonsJson: unknown = body.buttonsJson ?? undefined;

  // Bentuk ringkas: media string + mediaKind (+mimetype/filename/gif/ptt).
  if ((body.media ?? null) !== null && (body.media as string | null) !== undefined) {
    const raw = (body.media as string | null)?.trim() ?? '';
    if (raw && body.mediaKind) {
      const parsed = blastMediaSchema.safeParse({
        kind: body.mediaKind,
        media: raw,
        mimetype: body.mimetype ?? null,
        filename: body.filename ?? null,
        gif: body.gif,
        ptt: body.ptt,
      });
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return fail(`media: ${first?.message ?? 'Media tidak valid.'}`, 400);
      }
      mediaJson = parsed.data;
    } else if (raw && !body.mediaKind) {
      return fail('mediaKind: Wajib diisi bila memakai media (image/video/audio/document/sticker).', 400);
    }
  }
  // Bentuk penuh: mediaJson {kind, media, ...}.
  if (mediaJson !== undefined && mediaJson !== null && typeof mediaJson === 'object' && !Array.isArray(mediaJson)) {
    const m = mediaJson as Record<string, unknown>;
    if (m.kind !== undefined || m.media !== undefined) {
      const parsed = blastMediaSchema.safeParse(mediaJson);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return fail(`mediaJson: ${first?.message ?? 'Media tidak valid.'}`, 400);
      }
      mediaJson = parsed.data;
    } else {
      mediaJson = undefined;
    }
  }

  // Bentuk ringkas: buttons array + buttonsMode (default buttons).
  if (Array.isArray(body.buttons)) {
    const mode = body.buttonsMode ?? 'buttons';
    if (mode === 'list') {
      return fail('buttonsMode list wajib memakai buttonsJson berisi sections.', 400);
    }
    const packed =
      mode === 'buttonv2'
        ? { mode, buttons: body.buttons, footer: body.footer ?? null, headerMedia: body.headerMedia ?? null }
        : { mode, buttons: body.buttons, footer: body.footer ?? null, headerMedia: body.headerMedia ?? null };
    const parsed = blastButtonsSchema.safeParse(packed);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(`buttons: ${first?.message ?? 'Tombol tidak valid.'}`, 400);
    }
    buttonsJson = parsed.data;
  }
  // Bentuk penuh: buttonsJson {mode, ...}.
  if (buttonsJson !== undefined && buttonsJson !== null && typeof buttonsJson === 'object' && !Array.isArray(buttonsJson)) {
    const b = buttonsJson as Record<string, unknown>;
    if (b.mode !== undefined || b.buttons !== undefined || b.sections !== undefined) {
      const parsed = blastButtonsSchema.safeParse(buttonsJson);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return fail(`buttonsJson: ${first?.message ?? 'Tombol tidak valid.'}`, 400);
      }
      buttonsJson = parsed.data;
    } else {
      buttonsJson = undefined;
    }
  }

  if (!textBody && !mediaJson && !buttonsJson) {
    return fail('Pesan kosong: isi teks, media, atau tombol (minimal satu).', 400);
  }

  try {
    const blast = await prisma.$transaction(async (tx) => {
      const created = await tx.blast.create({
        data: {
          sessionId: auth.session.id,
          ownerId: auth.session.ownerId,
          label: body.label.trim(),
          textBody,
          mediaJson: (mediaJson as never) ?? undefined,
          buttonsJson: (buttonsJson as never) ?? undefined,
          total: recipients.length,
          delayMin: delay.minMs,
          delayMax: delay.maxMs,
          status: 'running',
          startedAt: new Date(),
        },
        select: { id: true },
      });
      for (let i = 0; i < recipients.length; i += 1000) {
        const batch = recipients.slice(i, i + 1000).map((r) => ({
          blastId: created.id,
          phone: r.phone,
          vars: r.vars as never,
          status: 'pending' as const,
        }));
        await tx.blastRecipient.createMany({ data: batch });
      }
      return created;
    });

    kickBlast(blast.id);

    const fresh = await prisma.blast.findUnique({
      where: { id: blast.id },
      select: {
        id: true,
        sessionId: true,
        label: true,
        textBody: true,
        mediaJson: true,
        buttonsJson: true,
        total: true,
        delayMin: true,
        delayMax: true,
        status: true,
        createdAt: true,
        startedAt: true,
      },
    });
    return ok({ blast: fresh, skipped }, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal membuat campaign.', 500);
  }
});

/** List campaign milik session (user biasa hanya miliknya via authorizeSession). */
export const GET = withAuth(async (req: NextRequest, ctx, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const denied = await ownerGuard(ctx, auth.session.ownerId);
  if (denied) return denied;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit') ?? '50');
  const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;

  try {
    const [total, rows] = await Promise.all([
      prisma.blast.count({ where: { sessionId: auth.session.id } }),
      prisma.blast.findMany({
        where: { sessionId: auth.session.id },
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          label: true,
          total: true,
          delayMin: true,
          delayMax: true,
          status: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          _count: { select: { recipients: true } },
        },
      }),
    ]);
    const blasts = rows;
    return ok({ blasts, total, limit, offset });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil daftar blast.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
