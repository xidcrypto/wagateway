export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { prisma } = await import('./src/lib/server/prisma');
  const bcrypt = (await import('bcryptjs')).default;

  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
      const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
      const fullName = process.env.SEED_ADMIN_FULL_NAME ?? 'Administrator';
      const password = process.env.SEED_ADMIN_PASSWORD;
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.create({
          data: { username, email, fullName, passwordHash, role: 'admin', active: true },
        });
        console.log('[pansa] seed admin dibuat saat boot.');
      } else {
        console.warn('[pansa] tabel users kosong tapi SEED_ADMIN_PASSWORD tidak disetel; seed dilewati.');
      }
    }
  } catch (err) {
    // DB mungkin belum termigrasi (db:deploy dijalankan sebelum build/start).
    console.warn(
      '[pansa] seed admin saat boot dilewati:',
      err instanceof Error ? err.message : err,
    );
  }

  try {
    const { restoreAll } = await import('./src/lib/server/session-manager');
    const { restored, skipped } = await restoreAll();
    if (restored > 0 || skipped > 0) {
      console.log(`[pansa] restore session: ${restored} dipulihkan, ${skipped} dilewati.`);
    }
  } catch (err) {
    console.warn(
      '[pansa] restore session dilewati:',
      err instanceof Error ? err.message : err,
    );
  }

  // Dispatcher webhook (Fase 2.2): sadap event session manager, kirim
  // fire-and-forget. Flag globalThis agar tidak ganda saat HMR.
  try {
    const flag = globalThis as unknown as { __pansaWebhookListener?: boolean };
    if (!flag.__pansaWebhookListener) {
      flag.__pansaWebhookListener = true;
      const { onSessionEvent } = await import('./src/lib/server/session-manager');
      const { dispatchWebhookAsync } = await import('./src/lib/server/webhook');
      onSessionEvent((ev) => dispatchWebhookAsync(ev));
    }
  } catch (err) {
    console.warn(
      '[pansa] webhook listener dilewati:',
      err instanceof Error ? err.message : err,
    );
  }

  // Resume blast running (Fase 4.2): lanjutkan dari recipient pending.
  try {
    const { resumeRunningBlasts } = await import('./src/lib/server/blast-worker');
    const { resumed } = await resumeRunningBlasts();
    if (resumed > 0) {
      console.log(`[pansa] resume blast: ${resumed} campaign dilanjutkan.`);
    }
  } catch (err) {
    console.warn(
      '[pansa] resume blast dilewati:',
      err instanceof Error ? err.message : err,
    );
  }
}
