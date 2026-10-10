import 'dotenv/config';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

function newKey(): string {
  return `pn-${crypto.randomBytes(16).toString('hex')}`;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL belum disetel');
  const adapter = new PrismaMariaDb(databaseUrl);
  const prisma = new PrismaClient({ adapter });
  try {
    const users = await prisma.user.findMany({
      where: { apiKey: null },
      select: { id: true, username: true },
    });
    console.log(`User tanpa api_key: ${users.length}`);
    for (const u of users) {
      let key = newKey();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await prisma.user.update({ where: { id: u.id }, data: { apiKey: key } });
          console.log(`OK user ${u.id} (${u.username})`);
          break;
        } catch (err) {
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code: unknown }).code === 'P2002' &&
            attempt < 4
          ) {
            key = newKey();
            continue;
          }
          throw err;
        }
      }
    }
    // Pastikan admin seed punya password bila env tersedia (tidak diubah bila sudah ada user).
    void bcrypt;
    console.log('Backfill selesai.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Backfill gagal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
