import 'server-only';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaAdapter?: PrismaMariaDb;
};

function getAdapter(): PrismaMariaDb {
  if (!globalForPrisma.prismaAdapter) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL belum disetel di environment');
    }
    globalForPrisma.prismaAdapter = new PrismaMariaDb(url);
  }
  return globalForPrisma.prismaAdapter;
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ adapter: getAdapter() });
  }
  return globalForPrisma.prisma;
}

/**
 * Singleton PrismaClient (disimpan di globalThis, anti ganda saat HMR).
 * Dibuat malas (lazy) lewat Proxy agar import modul ini tidak throw saat
 * DATABASE_URL belum ada — mis. waktu `next build` collect route.
 * Pemakaian tetap sama: `prisma.user.findMany()`.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrisma();
    const value = Reflect.get(client as unknown as object, prop, client);
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

export default prisma;
