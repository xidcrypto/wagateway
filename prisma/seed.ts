import 'dotenv/config';

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL belum disetel di environment');
  }

  const adapter = new PrismaMariaDb(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log(`Seed dilewati: tabel users sudah berisi ${userCount} baris.`);
      return;
    }

    const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
    const fullName = process.env.SEED_ADMIN_FULL_NAME ?? 'Administrator';
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) {
      throw new Error('SEED_ADMIN_PASSWORD belum disetel di environment');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: {
        username,
        email,
        fullName,
        passwordHash,
        apiKey: `pn-${crypto.randomBytes(16).toString('hex')}`,
        role: 'admin',
        active: true,
      },
    });

    console.log(`Seed selesai: admin "${admin.username}" (${admin.email}) dibuat.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Seed gagal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
