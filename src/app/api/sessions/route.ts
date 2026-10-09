import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isAdmin, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSessionSchema = z.object({
  label: z.string().min(1, 'Label wajib diisi.').max(255),
  owner_id: z.number().int().positive().optional(),
  ownerId: z.number().int().positive().optional(),
});

async function resolveOwnerId(ctxUserId: number, bodyOwnerId?: number): Promise<number | null> {
  // Admin virtual (Master API key, id 0): owner dari body, atau admin seed.
  if (ctxUserId === 0) {
    if (bodyOwnerId !== undefined) {
      const target = await prisma.user.findUnique({ where: { id: bodyOwnerId } });
      if (!target) return null;
      return target.id;
    }
    const seedAdmin = await prisma.user.findFirst({
      where: { role: 'admin' },
      orderBy: { id: 'asc' },
    });
    return seedAdmin ? seedAdmin.id : null;
  }
  return ctxUserId;
}

export const GET = withAuth(async (_req, ctx) => {
  const where = isAdmin(ctx) ? {} : { ownerId: ctx.user.id };
  const sessions = await prisma.session.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { id: true, username: true } } },
  });
  return ok({ sessions });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const parsed = await parseJsonBody(req, createSessionSchema);
  if (!parsed.ok) return parsed.response;
  const bodyOwnerId = parsed.data.ownerId ?? parsed.data.owner_id;

  // User biasa tidak boleh menentukan owner lain.
  if (!isAdmin(ctx) && bodyOwnerId !== undefined && bodyOwnerId !== ctx.user.id) {
    return fail('Tidak boleh membuat session untuk user lain.', 403);
  }

  const ownerId = await resolveOwnerId(ctx.user.id, bodyOwnerId);
  if (ctx.user.id === 0 && ownerId === null) {
    return fail('owner_id tidak valid atau tidak ada admin di database.', 400);
  }

  const created = await prisma.session.create({
    data: {
      id: randomUUID(),
      label: parsed.data.label.trim(),
      ownerId,
      status: 'connecting',
    },
  });

  // Mulai koneksi langsung agar QR/pairing tersedia.
  const { start } = await import('@/lib/server/session-manager');
  try {
    await start(created.id);
  } catch (err) {
    return fail(
      `Session dibuat, tetapi gagal memulai koneksi: ${err instanceof Error ? err.message : 'error'}`,
      201,
    );
  }
  const fresh = await prisma.session.findUnique({ where: { id: created.id } });
  return ok({ session: fresh }, 201);
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
