import { NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin, withAuth } from '@/lib/server/auth';
import { assertBlastDelay, parseBlastRecipients } from '@/lib/server/blast-recipients';
import { kickBlast } from '@/lib/server/blast-worker';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { authorizeSession, type RouteCtx } from '@/lib/server/session-manager';
import { parseJsonBody } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBlastSchema = z.object({
  label: z.string().min(1, 'Label wajib diisi.').max(255),
  text: z.string().min(1, 'Teks wajib diisi.').max(65536).optional(),
  textBody: z.string().min(1).max(65536).optional(),
  recipients: z.unknown(),
  media: z.string().max(20_000_000).optional().nullable(),
  mediaJson: z.unknown().optional().nullable(),
  buttons: z.array(z.unknown()).max(10, 'Maksimal 10 tombol.').optional(),
  buttonsJson: z.unknown().optional().nullable(),
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
  if (!textBody) {
    return fail('text: Teks wajib diisi.', 400);
  }

  try {
    const blast = await prisma.$transaction(async (tx) => {
      const created = await tx.blast.create({
        data: {
          sessionId: auth.session.id,
          ownerId: auth.session.ownerId,
          label: body.label.trim(),
          textBody,
          mediaJson: body.media !== undefined && body.media !== null
            ? ({ media: body.media } as never)
            : (body.mediaJson as never) ?? undefined,
          buttonsJson: (
            Array.isArray(body.buttons) ? { buttons: body.buttons } : body.buttonsJson
          ) as never ?? undefined,
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
