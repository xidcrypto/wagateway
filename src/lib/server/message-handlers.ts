import 'server-only';

import { prisma } from './prisma';
import { mapBaileysStatus, updateOutgoingStatus } from './message-recorder';

/**
 * Handler pesan masuk Baileys (Fase 2, step 2.3):
 * - Tipe pesan diekstrak dari key objek `message`.
 * - Teks diambil dari `conversation` atau caption.
 * - Respons tombol ditangkap dari berbagai format response message.
 * - `fromMe` TIDAK disimpan sebagai incoming dan tidak memicu webhook.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMsg = any;

export type ButtonResponse = {
  id: string | null;
  text: string | null;
  source: string | null;
} | null;

export type QuotedInfo = {
  stanzaId: string | null;
  participant: string | null;
  type: string | null;
  text: string | null;
} | null;

export type ParsedIncoming = {
  waId: string;
  remoteJid: string;
  participant: string | null;
  fromMe: boolean;
  msgType: string;
  textBody: string | null;
  buttonResponse: ButtonResponse;
  quoted: QuotedInfo;
  hasMedia: boolean;
  pushName: string | null;
  timestamp: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
};

export type StatusEvent = {
  waId: string;
  remoteJid: string;
  fromMe: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
};

// Tipe sistem/noise yang tidak disimpan dan tidak memicu webhook.
const NOISE_TYPES = new Set([
  'protocolMessage',
  'senderKeyDistributionMessage',
  'messageContextInfo',
  'keepInChatMessage',
]);

/** Buka wrapper ephemeral / viewOnce sampai ke isi sebenarnya. */
function unwrap(message: AnyMsg): { inner: AnyMsg; wrappedIn: string[] } {
  const wrappedIn: string[] = [];
  let inner = message;
  for (let i = 0; i < 5 && inner && typeof inner === 'object'; i += 1) {
    const keys = Object.keys(inner);
    if (keys.length !== 1) break;
    const key = keys[0] as string;
    if (key === 'ephemeralMessage' && inner.ephemeralMessage?.message) {
      wrappedIn.push(key);
      inner = inner.ephemeralMessage.message;
    } else if (
      (key === 'viewOnceMessage' || key === 'viewOnceMessageV2') &&
      (inner[key]?.message)
    ) {
      wrappedIn.push(key);
      inner = inner[key].message;
    } else if (key === 'documentWithCaptionMessage' && inner[key]?.message) {
      wrappedIn.push(key);
      inner = inner[key].message;
    } else {
      break;
    }
  }
  return { inner, wrappedIn };
}

function firstKey(obj: AnyMsg): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const keys = Object.keys(obj);
  return keys.length > 0 ? (keys[0] as string) : null;
}

/** Ambil contextInfo pertama yang ditemukan di dalam konten pesan. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findContextInfo(node: any, depth = 0): any | null {
  if (!node || typeof node !== 'object' || depth > 4) return null;
  if (node.contextInfo && typeof node.contextInfo === 'object') return node.contextInfo;
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object' && !(value instanceof Uint8Array) && !Buffer.isBuffer(value)) {
      const found = findContextInfo(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function extractText(msgType: string, content: AnyMsg, raw: AnyMsg): string | null {
  const pick = (...vals: unknown[]): string | null => {
    for (const v of vals) {
      if (typeof v === 'string' && v !== '') return v;
    }
    return null;
  };
  switch (msgType) {
    case 'conversation':
      return typeof raw.conversation === 'string' ? raw.conversation : null;
    case 'extendedTextMessage':
      return pick(content?.text);
    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
    case 'audioMessage':
      return pick(content?.caption);
    case 'buttonsResponseMessage':
      return pick(content?.selectedDisplayText);
    case 'templateButtonReplyMessage':
      return pick(content?.selectedDisplayText);
    case 'listResponseMessage':
      return pick(content?.title, content?.description);
    case 'interactiveResponseMessage':
      return pick(content?.body?.text);
    case 'pollCreationMessage':
      return pick(content?.name);
    case 'contactMessage':
      return pick(content?.displayName);
    case 'locationMessage':
      return pick(content?.name, content?.address);
    case 'liveLocationMessage':
      return pick(content?.caption);
    case 'reactionMessage':
      return pick(content?.text);
    case 'stickerMessage':
      return null;
    default:
      return pick(content?.text, content?.caption, content?.name, content?.title);
  }
}

function extractButtonResponse(msgType: string, content: AnyMsg): ButtonResponse {
  switch (msgType) {
    case 'buttonsResponseMessage':
      return {
        id: content?.selectedButtonId ?? null,
        text: content?.selectedDisplayText ?? null,
        source: 'buttonsResponseMessage',
      };
    case 'templateButtonReplyMessage':
      return {
        id: content?.selectedId ?? null,
        text: content?.selectedDisplayText ?? null,
        source: 'templateButtonReplyMessage',
      };
    case 'listResponseMessage': {
      const row = content?.singleSelectReply;
      return {
        id: row?.selectedRowId ?? null,
        text: content?.title ?? null,
        source: 'listResponseMessage',
      };
    }
    case 'interactiveResponseMessage': {
      const native = content?.nativeFlowResponseMessage;
      return {
        id: native?.name ?? content?.body?.text ?? null,
        text: content?.body?.text ?? null,
        source: 'interactiveResponseMessage',
      };
    }
    default:
      return null;
  }
}

function extractQuoted(contextInfo: AnyMsg): QuotedInfo {
  if (!contextInfo?.quotedMessage || typeof contextInfo.quotedMessage !== 'object') return null;
  const qm = contextInfo.quotedMessage;
  const { inner } = unwrap(qm);
  const qType = firstKey(inner);
  return {
    stanzaId: contextInfo.stanzaId ?? null,
    participant: contextInfo.participant ?? null,
    type: qType,
    text: qType ? extractText(qType, inner?.[qType as string], inner) : null,
  };
}

function detectHasMedia(msgType: string, content: AnyMsg): boolean {
  if (
    msgType === 'imageMessage' ||
    msgType === 'videoMessage' ||
    msgType === 'audioMessage' ||
    msgType === 'documentMessage' ||
    msgType === 'stickerMessage'
  ) {
    return Boolean(content?.url || content?.directPath || content?.mediaKey || content?.fileLength);
  }
  return false;
}

/** Ubah Uint8Array/Buffer menjadi base64 agar aman disimpan di kolom JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJsonSafe(value: any): any {
  if (value instanceof Uint8Array) {
    return { __bytes: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJsonSafe(v);
    return out;
  }
  return value;
}

/** Parse satu WebMessageInfo mentah. Null bila kosong / noise / fromMe. */
export function parseIncoming(raw: AnyMsg): ParsedIncoming | null {
  if (!raw || typeof raw !== 'object') return null;
  const key = raw.key ?? {};
  const waId = typeof key.id === 'string' ? key.id : null;
  const remoteJid = typeof key.remoteJid === 'string' ? key.remoteJid : null;
  if (!waId || !remoteJid) return null;
  const fromMe = key.fromMe === true;
  if (fromMe) return null; // Aturan 13: pesan sendiri tidak disimpan sebagai incoming.

  const message = raw.message;
  if (!message || typeof message !== 'object') return null;
  const { inner } = unwrap(message);
  const msgType = firstKey(inner);
  if (!msgType || NOISE_TYPES.has(msgType)) return null;

  const content = inner[msgType] as AnyMsg;
  const contextInfo = findContextInfo(content) ?? findContextInfo(inner);
  let ts: number | null = null;
  const rawTs = raw.messageTimestamp;
  if (typeof rawTs === 'number') ts = rawTs;
  else if (typeof rawTs === 'string' && rawTs !== '') {
    const n = Number(rawTs);
    ts = Number.isFinite(n) ? n : null;
  } else if (rawTs && typeof rawTs === 'object' && 'low' in rawTs) {
    ts = Number((rawTs as { low: number }).low) || null;
  }

  return {
    waId,
    remoteJid,
    participant: typeof key.participant === 'string' ? key.participant : null,
    fromMe: false,
    msgType,
    textBody: extractText(msgType, content, inner),
    buttonResponse: extractButtonResponse(msgType, content),
    quoted: extractQuoted(contextInfo),
    hasMedia: detectHasMedia(msgType, content),
    pushName: typeof raw.pushName === 'string' ? raw.pushName : null,
    timestamp: ts,
    payload: toJsonSafe({ key, message }),
  };
}

export type IncomingEmit = (ev: {
  event: 'message' | 'message.status';
  sessionId: string;
  timestamp: string;
  data: unknown;
}) => void;

function webhookMessageData(p: ParsedIncoming): Record<string, unknown> {
  return {
    id: p.waId,
    remoteJid: p.remoteJid,
    fromMe: false,
    type: p.msgType,
    pushName: p.pushName,
    timestamp: p.timestamp,
    text: p.textBody,
    buttonResponse: p.buttonResponse,
    quoted: p.quoted,
    hasMedia: p.hasMedia,
  };
}

/**
 * Proses event `messages.upsert`. Hanya tipe `notify` yang disimpan
 * (append = riwayat sinkronisasi, dilewati agar tidak banjir).
 * Mengembalikan jumlah pesan yang disimpan.
 */
export async function handleMessagesUpsert(
  sessionId: string,
  upsert: { messages?: AnyMsg[]; type?: string },
  emit: IncomingEmit,
): Promise<{ stored: number }> {
  if (upsert?.type && upsert.type !== 'notify') return { stored: 0 };
  const list = Array.isArray(upsert?.messages) ? (upsert.messages as AnyMsg[]) : [];
  let stored = 0;
  for (const raw of list) {
    let parsed: ParsedIncoming | null;
    try {
      parsed = parseIncoming(raw);
    } catch {
      continue;
    }
    if (!parsed) continue;
    // Dedup: abaikan bila waId sudah tercatat untuk session ini.
    try {
      const existing = await prisma.message.findFirst({
        where: { sessionId, waId: parsed.waId },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.message.create({
        data: {
          sessionId,
          direction: 'in',
          waId: parsed.waId,
          remoteJid: parsed.remoteJid,
          msgType: parsed.msgType,
          textBody: parsed.textBody,
          status: null,
          payload: parsed.payload ?? undefined,
        },
      });
      stored += 1;
    } catch {
      continue;
    }
    emit({
      event: 'message',
      sessionId,
      timestamp: new Date().toISOString(),
      data: webhookMessageData(parsed),
    });
  }
  return { stored };
}

/**
 * Proses event `messages.update` (ack status). Hanya baris `out` yang
 * diperbarui di DB; event `message.status` di-emit bila ada perubahan.
 */
export async function handleMessagesUpdate(
  sessionId: string,
  updates: Array<{ key?: AnyMsg; update?: AnyMsg }>,
  emit: IncomingEmit,
): Promise<{ updated: number }> {
  const list = Array.isArray(updates) ? updates : [];
  let updated = 0;
  for (const item of list) {
    const status = mapBaileysStatus(item?.update?.status);
    const waId = item?.key?.id;
    const remoteJid = item?.key?.remoteJid;
    const fromMe = item?.key?.fromMe === true;
    if (!status || typeof waId !== 'string' || typeof remoteJid !== 'string') continue;
    let changed = false;
    try {
      changed = await updateOutgoingStatus(sessionId, waId, status);
    } catch {
      continue;
    }
    if (!changed) continue;
    updated += 1;
    const data: StatusEvent = { waId, remoteJid, fromMe, status };
    emit({
      event: 'message.status',
      sessionId,
      timestamp: new Date().toISOString(),
      data,
    });
  }
  return { updated };
}
