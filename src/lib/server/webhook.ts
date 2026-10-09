import 'server-only';

import crypto from 'node:crypto';
import { prisma } from './prisma';
import { assertSafeDeliveryUrl, MediaError } from './media-loader';
import type { SessionEvent } from './session-manager';

/**
 * Dispatcher webhook (Fase 2, step 2.2) sesuai aturan global no. 5:
 * - URL: milik owner session dulu, fallback GLOBAL_WEBHOOK_URL.
 * - Validasi anti-SSRF saat disimpan (route /api/me/webhook, cek literal)
 *   DAN saat dikirim (cek literal + resolve DNS + tiap redirect, maks 3).
 * - Header: `x-pansa-signature: sha256=<HMAC-SHA256 hex body>` + `x-pansa-event`.
 * - Timeout 10 detik, fire-and-forget, tanpa retry.
 * - Payload dasar: { event, session, timestamp, data }.
 */

export const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export type WebhookTarget = {
  url: string;
  secret: string | null;
};

export type DispatchResult =
  | { delivered: false; reason: string }
  | { delivered: true; status: number };

/** Tentukan URL + secret untuk sebuah session (owner dulu, fallback global). */
export async function resolveWebhookTarget(sessionId: string): Promise<WebhookTarget | null> {
  let owner: { webhookUrl: string | null; webhookSecret: string | null } | null = null;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { owner: { select: { webhookUrl: true, webhookSecret: true } } },
    });
    owner = session?.owner ?? null;
  } catch {
    return null;
  }
  if (owner?.webhookUrl && owner.webhookUrl.trim() !== '') {
    return { url: owner.webhookUrl.trim(), secret: owner.webhookSecret ?? null };
  }
  const globalUrl = process.env.GLOBAL_WEBHOOK_URL?.trim();
  if (globalUrl) {
    return { url: globalUrl, secret: process.env.GLOBAL_WEBHOOK_SECRET?.trim() || null };
  }
  return null;
}

/** HMAC-SHA256 hex dari body (tanpa prefix), prefix ditambah saat kirim. */
export function signPayload(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

export function buildPayload(ev: SessionEvent): { body: string; event: string } {
  const payload = {
    event: ev.event,
    session: ev.sessionId,
    timestamp: ev.timestamp,
    data: ev.data ?? {},
  };
  return { body: JSON.stringify(payload), event: ev.event };
}

async function postWithGuards(startUrl: URL, body: string, event: string, secret: string | null): Promise<number> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-pansa-event': event,
  };
  if (secret) {
    headers['x-pansa-signature'] = `sha256=${signPayload(body, secret)}`;
  }

  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // Cek ulang DNS tiap hop (anti DNS-rebinding). Webhook hanya POST —
    // redirect diikuti dengan method + body yang sama (307/308 semantics).
    await assertSafeDeliveryUrl(current.toString(), 'webhook');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: 'POST',
        headers,
        body,
        signal: ctrl.signal,
        redirect: 'manual',
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new MediaError('Webhook timeout (10 detik).', 504);
      }
      throw new MediaError(
        `Webhook gagal dikirim: ${err instanceof Error ? err.message : 'kesalahan jaringan'}.`,
        502,
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      try {
        await res.arrayBuffer();
      } catch {
        // Abaikan body redirect.
      }
      if (hop >= MAX_REDIRECTS) {
        throw new MediaError('Webhook: terlalu banyak redirect (maksimal 3).', 502);
      }
      const loc = res.headers.get('location');
      if (!loc) throw new MediaError('Webhook: redirect tanpa header Location.', 502);
      let next: URL;
      try {
        next = new URL(loc, current.toString());
      } catch {
        throw new MediaError('Webhook: URL redirect tidak valid.', 502);
      }
      current = next;
      continue;
    }

    try {
      await res.arrayBuffer();
    } catch {
      // Abaikan body respons.
    }
    return res.status;
  }
  throw new MediaError('Webhook: terlalu banyak redirect (maksimal 3).', 502);
}

/**
 * Kirim satu event ke webhook. Fire-and-forget: kegagalan hanya dicatat,
 * tidak pernah melempar (agar tidak menjatuhkan session manager).
 */
export async function dispatchWebhook(ev: SessionEvent): Promise<DispatchResult> {
  let target: WebhookTarget | null;
  try {
    target = await resolveWebhookTarget(ev.sessionId);
  } catch (err) {
    console.warn('[pansa] webhook dilewati (gagal resolve target):', err instanceof Error ? err.message : err);
    return { delivered: false, reason: 'resolve-target-gagal' };
  }
  if (!target) return { delivered: false, reason: 'tanpa-target' };

  let startUrl: URL;
  try {
    startUrl = await assertSafeDeliveryUrl(target.url, 'webhook');
  } catch (err) {
    console.warn('[pansa] webhook ditolak anti-SSRF:', err instanceof Error ? err.message : err);
    return { delivered: false, reason: 'ssrf-ditolak' };
  }

  const { body, event } = buildPayload(ev);
  try {
    const status = await postWithGuards(startUrl, body, event, target.secret);
    return { delivered: true, status };
  } catch (err) {
    console.warn(
      '[pansa] webhook gagal:',
      err instanceof MediaError ? `${err.statusCode} ${err.message}` : err instanceof Error ? err.message : err,
    );
    return { delivered: false, reason: err instanceof Error ? err.message : 'gagal' };
  }
}

/** Fire-and-forget: jadwalkan pengiriman tanpa menahan pemanggil. */
export function dispatchWebhookAsync(ev: SessionEvent): void {
  void dispatchWebhook(ev);
}
