// API client terpusat untuk Pansa Gateway (dipakai semua halaman).
// - Token JWT di localStorage dengan key `pansa_token`.
// - Otomatis menyertakan `Authorization: Bearer <token>`.
// - Membuka envelope `{ success, data }` dan melempar ApiError berisi pesan server.
// - Redirect ke `/login` saat 401 (token kedaluwarsa / belum login).

export const TOKEN_KEY = 'pansa_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Abaikan bila storage tidak tersedia.
  }
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== '/login') {
    // Modul biasa (bukan komponen), jadi pakai location API langsung.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/login');
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: string };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError('Tidak bisa menghubungi server. Periksa koneksi.', 0);
  }

  if (res.status === 401) {
    redirectToLogin();
    let message = 'Belum login. Silakan login dulu.';
    try {
      const body = (await res.json()) as ApiEnvelope<unknown>;
      if (!body.success && body.error) message = body.error;
    } catch {
      // Pakai pesan default.
    }
    throw new ApiError(message, 401);
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(`Respons server tidak valid (HTTP ${res.status}).`, res.status);
  }

  if (!body.success) {
    throw new ApiError(body.error || 'Terjadi kesalahan.', res.status);
  }
  return body.data;
}

export type LoginResult = {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    fullName: string;
    role: 'admin' | 'user';
  };
};

export function login(identifier: string, password: string): Promise<LoginResult> {
  return api<LoginResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
};

export function register(input: RegisterInput): Promise<LoginResult> {
  return api<LoginResult>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function forgotPassword(email: string): Promise<{ sent: boolean; message: string }> {
  return api<{ sent: boolean; message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<{ reset: boolean; message: string }> {
  return api<{ reset: boolean; message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
}

export type MeResult = {
  user: {
    id: number;
    username: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: 'admin' | 'user';
  };
};

export function getMe(): Promise<MeResult> {
  return api<MeResult>('/api/me');
}

export type SiteInfo = {
  siteName: string;
  siteTagline: string;
};

const DEFAULT_SITE_INFO: SiteInfo = {
  siteName: 'Pansa Gateway',
  siteTagline: '',
};

let siteInfoCache: SiteInfo | null = null;

/** Info branding publik (tanpa login). Hasil di-cache per sesi browser. */
export async function getSiteInfo(): Promise<SiteInfo> {
  if (siteInfoCache) return siteInfoCache;
  try {
    const data = await api<SiteInfo>('/api/site-info');
    siteInfoCache = {
      siteName: data.siteName?.trim() || DEFAULT_SITE_INFO.siteName,
      siteTagline: data.siteTagline ?? '',
    };
  } catch {
    siteInfoCache = { ...DEFAULT_SITE_INFO };
  }
  return siteInfoCache;
}

export function clearSiteInfoCache(): void {
  siteInfoCache = null;
}

export type AdminSettings = Record<string, string>;

export function getAdminSettings(): Promise<{ settings: AdminSettings; smtpConfigured: boolean }> {
  return api<{ settings: AdminSettings; smtpConfigured: boolean }>('/api/admin/settings');
}

export function updateAdminSettings(
  body: Partial<{
    site_name: string;
    site_tagline: string;
    registration_enabled: boolean;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_user: string;
    smtp_pass: string;
    mail_from: string;
    mail_from_name: string;
  }>,
): Promise<{ updated: string[]; settings: AdminSettings; smtpConfigured: boolean }> {
  return api('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export type SessionItem = {
  id: string;
  label: string;
  status: string;
  phone: string | null;
  ownerId: number | null;
};

export function listSessions(): Promise<{ sessions: SessionItem[] }> {
  return api<{ sessions: SessionItem[] }>('/api/sessions');
}

export type AdminStats = {
  users: { total: number; admins: number; regular: number };
  sessions: { total: number; open: number };
  messages: { total: number; in: number; out: number; today: number };
};

export function getAdminStats(): Promise<AdminStats> {
  return api<AdminStats>('/api/admin/stats');
}

export type StatsDaily = {
  date: string;
  in: number;
  out: number;
  total: number;
};

export type StatsRecent = {
  id: string;
  sessionId: string;
  direction: 'in' | 'out';
  remoteJid: string;
  msgType: string;
  textBody: string | null;
  status: string | null;
  createdAt: string;
  session: { id: string; label: string } | null;
};

export type StatsSession = {
  id: string;
  label: string;
  status: string;
  phone: string | null;
  waName: string | null;
};

export type StatsResponse = {
  sessions: { total: number; open: number };
  messages: { total: number; in: number; out: number; today: number };
  daily: StatsDaily[];
  recent: StatsRecent[];
  sessionsList: StatsSession[];
};

/** Statistik dashboard user sendiri (admin: agregat semua). */
export function getStats(): Promise<StatsResponse> {
  return api<StatsResponse>('/api/stats');
}

export type HistoryMessage = {
  id: string;
  direction: 'in' | 'out';
  waId: string | null;
  remoteJid: string;
  msgType: string;
  textBody: string | null;
  status: string | null;
  createdAt: string;
};

/** Total pesan per session (limit=1, ambil `total` saja). */
export async function countSessionMessages(
  sessionId: string,
  direction?: 'in' | 'out',
): Promise<number> {
  const q = direction ? `?direction=${direction}&limit=1` : '?limit=1';
  const data = await api<{ messages: HistoryMessage[]; total: number }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages/history${q}`,
  );
  return data.total;
}

export type SessionDetail = SessionItem & {
  createdAt: string;
  updatedAt: string;
};

export function createSession(label: string): Promise<{ session: SessionDetail }> {
  return api<{ session: SessionDetail }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export function updateSessionLabel(
  sessionId: string,
  label: string,
): Promise<{ session: SessionDetail }> {
  return api<{ session: SessionDetail }>(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'PATCH', body: JSON.stringify({ label }) },
  );
}

export function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
  );
}

export type SessionStatus = {
  id: string;
  status: string;
  phone: string | null;
  waName: string | null;
  hasQr: boolean;
  hasPairing: boolean;
  live: boolean;
  /** ISO waktu hapus otomatis; hanya diisi bila logged_out + terjadwal. */
  deleteAt: string | null;
};

export function getSessionStatus(sessionId: string): Promise<SessionStatus> {
  return api<SessionStatus>(
    `/api/sessions/${encodeURIComponent(sessionId)}/status`,
  );
}

export function getSessionQr(sessionId: string): Promise<{ qr: string | null }> {
  return api<{ qr: string | null }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/qr`,
  );
}

export function startSession(
  sessionId: string,
): Promise<{ session?: SessionDetail; stopped?: boolean }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/start`, {
    method: 'POST',
  });
}

export function stopSession(
  sessionId: string,
  logout: boolean,
): Promise<{ stopped: boolean; deleted?: boolean; session?: SessionDetail }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
    body: JSON.stringify({ logout }),
  });
}

export function requestPairingCode(
  sessionId: string,
  phone: string,
): Promise<{ pairing: { code: string; phone: string; expiresIn: number } }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/pairing`, {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export function cancelPairingCode(
  sessionId: string,
): Promise<{ cancelled: boolean }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/pairing`, {
    method: 'DELETE',
  });
}

export type ConversationItem = {
  remoteJid: string;
  lastMessage: {
    id: string;
    direction: 'in' | 'out';
    msgType: string;
    textBody: string | null;
    status: string | null;
    createdAt: string;
  };
  total: string;
};

export function listConversations(
  sessionId: string,
  limit = 50,
): Promise<{ conversations: ConversationItem[]; total: string }> {
  return api(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages/conversations?limit=${limit}`,
  );
}

export function getHistory(
  sessionId: string,
  remoteJid: string,
  limit = 50,
): Promise<{ messages: HistoryMessage[]; total: number }> {
  const q = `?remote_jid=${encodeURIComponent(remoteJid)}&limit=${limit}`;
  return api(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages/history${q}`,
  );
}

export function sendText(
  sessionId: string,
  to: string,
  text: string,
): Promise<{ messageId: string; to: string; status: string }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/send/text`, {
    method: 'POST',
    body: JSON.stringify({ to, text }),
  });
}

export type SendResult = { messageId: string; to: string; status: string };

function postSend(
  sessionId: string,
  kind: string,
  body: Record<string, unknown>,
): Promise<SendResult> {
  return api<SendResult>(`/api/sessions/${encodeURIComponent(sessionId)}/send/${kind}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type SendButton = {
  type?: 'reply' | 'url' | 'copy' | 'call';
  id?: string;
  text?: string;
  url?: string;
  copy?: string;
  call?: string;
};

/** Kirim gambar (media: URL, data URI, atau path lokal di server). */
export function sendImage(
  sessionId: string,
  to: string,
  media: string,
  caption?: string,
): Promise<SendResult> {
  return postSend(sessionId, 'image', { to, media, caption: caption || undefined });
}

/** Kirim video (gif: true untuk GIF). */
export function sendVideo(
  sessionId: string,
  to: string,
  media: string,
  caption?: string,
  gif?: boolean,
): Promise<SendResult> {
  return postSend(sessionId, 'video', {
    to,
    media,
    caption: caption || undefined,
    gif: gif || undefined,
  });
}

/** Kirim audio (ptt: true untuk voice note). */
export function sendAudio(
  sessionId: string,
  to: string,
  media: string,
  ptt?: boolean,
): Promise<SendResult> {
  return postSend(sessionId, 'audio', { to, media, ptt: ptt || undefined });
}

/** Kirim dokumen (wajib webp untuk stiker). */
export function sendDocument(
  sessionId: string,
  to: string,
  media: string,
  caption?: string,
  filename?: string,
): Promise<SendResult> {
  return postSend(sessionId, 'document', {
    to,
    media,
    caption: caption || undefined,
    filename: filename || undefined,
  });
}

/** Kirim stiker (media wajib image/webp). */
export function sendSticker(sessionId: string, to: string, media: string): Promise<SendResult> {
  return postSend(sessionId, 'sticker', { to, media });
}

/** Kirim lokasi. */
export function sendLocation(
  sessionId: string,
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string,
): Promise<SendResult> {
  return postSend(sessionId, 'location', {
    to,
    latitude,
    longitude,
    name: name || undefined,
    address: address || undefined,
  });
}

/** Kirim kontak (vCard). */
export function sendContact(
  sessionId: string,
  to: string,
  displayName: string,
  phone?: string,
): Promise<SendResult> {
  return postSend(sessionId, 'contact', {
    to,
    contact: { displayName, phone: phone || undefined },
  });
}

/** Kirim polling (single choice, 2–12 opsi). */
export function sendPoll(
  sessionId: string,
  to: string,
  question: string,
  options: string[],
): Promise<SendResult> {
  return postSend(sessionId, 'poll', { to, question, options });
}

/** Kirim tombol interaktif (reply/url/copy/call, maks 10, header gambar opsional). */
export function sendButtons(
  sessionId: string,
  to: string,
  text: string,
  buttons: SendButton[],
  footer?: string,
  media?: string,
): Promise<SendResult> {
  return postSend(sessionId, 'buttons', {
    to,
    text,
    buttons,
    footer: footer || undefined,
    media: media || undefined,
  });
}

/** Kirim tombol quick-reply klasik (hanya reply, maks 3). */
export function sendButtonV2(
  sessionId: string,
  to: string,
  text: string,
  buttons: Array<{ id: string; text: string }>,
  footer?: string,
  media?: string,
): Promise<SendResult> {
  return postSend(sessionId, 'buttonv2', {
    to,
    text,
    buttons,
    footer: footer || undefined,
    media: media || undefined,
  });
}

export type SendListSection = {
  title?: string;
  rows: Array<{ title: string; description?: string }>;
};

/** Kirim list (sections + rows, maks 10 section). */
export function sendList(
  sessionId: string,
  to: string,
  text: string,
  sections: SendListSection[],
  title?: string,
  buttonText?: string,
  footer?: string,
): Promise<SendResult> {
  return postSend(sessionId, 'list', {
    to,
    text,
    sections,
    title: title || undefined,
    buttonText: buttonText || undefined,
    footer: footer || undefined,
  });
}

export type SendCarouselCard = {
  image?: string;
  video?: string;
  caption?: string;
  title?: string;
  subtitle?: string;
  footer?: string;
  buttons: SendButton[];
};

/** Kirim carousel (1–10 card, tiap card wajib gambar/video). */
export function sendCarousel(
  sessionId: string,
  to: string,
  cards: SendCarouselCard[],
  text?: string,
  footer?: string,
): Promise<SendResult> {
  return postSend(sessionId, 'carousel', {
    to,
    cards,
    text: text || undefined,
    footer: footer || undefined,
  });
}

/** Kirim email tes SMTP (admin). */
export function sendSettingsTestEmail(to: string): Promise<{ sent: boolean; message: string }> {
  return api<{ sent: boolean; message: string }>('/api/admin/settings/test', {
    method: 'POST',
    body: JSON.stringify({ to }),
  });
}

export type MessageFilter = {
  remoteJid?: string;
  direction?: '' | 'in' | 'out';
  q?: string;
  limit?: number;
  offset?: number;
};

export function searchMessages(
  sessionId: string,
  filter: MessageFilter,
): Promise<{ messages: HistoryMessage[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (filter.remoteJid) params.set('remote_jid', filter.remoteJid);
  if (filter.direction) params.set('direction', filter.direction);
  if (filter.q) params.set('q', filter.q);
  params.set('limit', String(filter.limit ?? 20));
  params.set('offset', String(filter.offset ?? 0));
  return api(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages/history?${params.toString()}`,
  );
}

export type GroupSummary = {
  id: string | null;
  subject: string | null;
  desc: string | null;
  owner: string | null;
  creation: number | null;
  size: number;
  restrict: boolean;
  announce: boolean;
  joinApprovalMode: boolean;
  memberAddMode: boolean;
  ephemeralDuration: number | null;
  participants: Array<{ id: string | null; phoneNumber: string | null; admin: string | null }>;
};

export function listGroups(
  sessionId: string,
): Promise<{ groups: GroupSummary[]; total: number }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/groups`);
}

export function createGroup(
  sessionId: string,
  subject: string,
  participants: string[],
): Promise<{ group: GroupSummary }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/groups/create`, {
    method: 'POST',
    body: JSON.stringify({ subject, participants }),
  });
}

export function getGroupMetadata(
  sessionId: string,
  jid: string,
): Promise<{ group: GroupSummary }> {
  return api(
    `/api/sessions/${encodeURIComponent(sessionId)}/groups/metadata?jid=${encodeURIComponent(jid)}`,
  );
}

export function updateGroupMembers(
  sessionId: string,
  jid: string,
  action: 'add' | 'remove' | 'promote' | 'demote',
  participants: string[],
): Promise<{ jid: string; action: string; results: Array<{ jid: string | null; status: string }> }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/groups/members`, {
    method: 'POST',
    body: JSON.stringify({ jid, action, participants }),
  });
}

export function renameGroup(
  sessionId: string,
  jid: string,
  subject: string,
): Promise<{ updated: boolean; jid: string; subject: string }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/groups/name`, {
    method: 'POST',
    body: JSON.stringify({ jid, subject }),
  });
}

export function getGroupInvite(
  sessionId: string,
  jid: string,
): Promise<{ jid: string; code: string; link: string }> {
  return api(
    `/api/sessions/${encodeURIComponent(sessionId)}/groups/invite?jid=${encodeURIComponent(jid)}`,
  );
}

export function revokeGroupInvite(
  sessionId: string,
  jid: string,
): Promise<{ jid: string; code: string; link: string }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/groups/revoke`, {
    method: 'POST',
    body: JSON.stringify({ jid }),
  });
}

export function leaveGroup(
  sessionId: string,
  jid: string,
): Promise<{ left: boolean; jid: string }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/groups/leave`, {
    method: 'POST',
    body: JSON.stringify({ jid }),
  });
}

export type CheckNumberResult = {
  jid: string | null;
  exists: boolean;
  lid: string | null;
};

export function checkNumber(
  sessionId: string,
  number: string,
): Promise<{ results: CheckNumberResult[] }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/check-number`, {
    method: 'POST',
    body: JSON.stringify({ number }),
  });
}

export function getProfilePicture(
  sessionId: string,
  number?: string,
): Promise<{ jid: string; url: string | null }> {
  const q = number ? `?number=${encodeURIComponent(number)}` : '';
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/profile-picture${q}`);
}

export function getContactAbout(
  sessionId: string,
  number: string,
): Promise<{ about: { jid: string | null; status: string | null; setAt: number | null } }> {
  return api(
    `/api/sessions/${encodeURIComponent(sessionId)}/about?number=${encodeURIComponent(number)}`,
  );
}

export function getBlocklist(
  sessionId: string,
): Promise<{ blocklist: string[]; total: number }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/blocklist`);
}

export function blockContact(
  sessionId: string,
  number: string,
): Promise<{ jid: string; blocked: boolean }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/block`, {
    method: 'POST',
    body: JSON.stringify({ number }),
  });
}

export function unblockContact(
  sessionId: string,
  number: string,
): Promise<{ jid: string; blocked: boolean }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/unblock`, {
    method: 'POST',
    body: JSON.stringify({ number }),
  });
}

export type BlastItem = {
  id: number;
  label: string;
  total: number;
  delayMin: number;
  delayMax: number;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type BlastMediaInput = {
  kind: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  media: string;
  mimetype?: string;
  filename?: string;
  gif?: boolean;
  ptt?: boolean;
};

export type BlastButtonsInput =
  | { mode: 'buttons'; buttons: SendButton[]; footer?: string; headerMedia?: string }
  | { mode: 'buttonv2'; buttons: Array<{ id: string; text: string }>; footer?: string; headerMedia?: string }
  | {
      mode: 'list';
      sections: SendListSection[];
      title?: string;
      buttonText?: string;
      footer?: string;
    };

export type BlastDetail = BlastItem & {
  sessionId: string;
  textBody: string;
  mediaJson: BlastMediaInput | null;
  buttonsJson: BlastButtonsInput | null;
  error: string | null;
};

export function listBlasts(
  sessionId: string,
): Promise<{ blasts: BlastItem[]; total: number }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/blasts?limit=100`);
}

export function getBlastDetail(
  sessionId: string,
  blastId: number,
): Promise<{ blast: BlastDetail; stats: { pending: number; sent: number; failed: number; total: number } }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/blasts/${blastId}`);
}

export type CreateBlastBody = {
  label: string;
  text?: string;
  recipients: string;
  delayMin: number;
  delayMax: number;
  media?: BlastMediaInput | null;
  buttons?: BlastButtonsInput | null;
};

export function createBlast(
  sessionId: string,
  body: CreateBlastBody,
): Promise<{ blast: BlastItem; skipped: number }> {
  const payload: Record<string, unknown> = {
    label: body.label,
    recipients: body.recipients,
    delayMin: body.delayMin,
    delayMax: body.delayMax,
  };
  if (body.text !== undefined) payload.text = body.text;
  if (body.media) payload.mediaJson = body.media;
  if (body.buttons) payload.buttonsJson = body.buttons;
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/blasts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function blastAction(
  sessionId: string,
  blastId: number,
  action: 'pause' | 'resume' | 'cancel',
): Promise<{ blast: BlastItem }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/blasts/${blastId}/${action}`, {
    method: 'POST',
  });
}

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'admin' | 'user';
  active: boolean;
  createdAt: string;
};

export function listAdminUsers(): Promise<{ users: AdminUser[] }> {
  return api('/api/admin/users');
}

export function createAdminUser(
  body: { username: string; email: string; fullName: string; password: string; role?: 'admin' | 'user' },
): Promise<{ user: AdminUser }> {
  return api('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patchAdminUser(
  id: number,
  body: Partial<{ email: string; fullName: string; phone: string | null; role: 'admin' | 'user'; active: boolean; password: string }>,
): Promise<{ user: AdminUser }> {
  return api(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteAdminUser(id: number): Promise<{ deleted: boolean }> {
  return api(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export type AdminSession = {
  id: string;
  label: string;
  status: string;
  phone: string | null;
  ownerId: number | null;
  owner: { id: number; username: string; email: string } | null;
  updatedAt: string;
};

export function listAdminSessions(filter?: {
  status?: string;
  ownerId?: number;
  limit?: number;
  offset?: number;
}): Promise<{ sessions: AdminSession[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (filter?.status) params.set('status', filter.status);
  if (filter?.ownerId) params.set('owner_id', String(filter.ownerId));
  params.set('limit', String(filter?.limit ?? 100));
  params.set('offset', String(filter?.offset ?? 0));
  return api(`/api/admin/sessions?${params.toString()}`);
}

export function forceStopSession(
  id: string,
  logout = false,
): Promise<{ stopped: boolean; deleted?: boolean; id?: string }> {
  return api(`/api/admin/sessions/${encodeURIComponent(id)}/force-stop`, {
    method: 'POST',
    body: JSON.stringify({ logout }),
  });
}

export type AdminAuditMessage = {
  id: string;
  sessionId: string;
  direction: 'in' | 'out';
  waId: string | null;
  remoteJid: string;
  msgType: string;
  textBody: string | null;
  status: string | null;
  createdAt: string;
  session: {
    id: string;
    label: string;
    ownerId: number | null;
    owner: { id: number; username: string } | null;
  } | null;
};

export type AdminAuditFilter = {
  q?: string;
  direction?: '' | 'in' | 'out';
  status?: string;
  remoteJid?: string;
  sessionId?: string;
  ownerId?: number;
  limit?: number;
  offset?: number;
};

/** Audit pesan lintas user (admin saja). */
export function listAdminMessages(
  filter: AdminAuditFilter,
): Promise<{ messages: AdminAuditMessage[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.direction) params.set('direction', filter.direction);
  if (filter.status) params.set('status', filter.status);
  if (filter.remoteJid) params.set('remote_jid', filter.remoteJid);
  if (filter.sessionId) params.set('session_id', filter.sessionId);
  if (filter.ownerId) params.set('owner_id', String(filter.ownerId));
  params.set('limit', String(filter.limit ?? 20));
  params.set('offset', String(filter.offset ?? 0));
  return api(`/api/admin/messages?${params.toString()}`);
}

export type MeUser = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  active: boolean;
  webhookUrl: string | null;
  hasApiKey: boolean;
};

export function patchMe(
  body: Partial<{ fullName: string; email: string; phone: string | null; avatarUrl: string | null }>,
): Promise<{ user: MeUser }> {
  return api('/api/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ changed: boolean }> {
  return api('/api/me/password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export function updateWebhook(
  body: { url?: string | null; secret?: string | null },
): Promise<{ webhookUrl: string | null; hasSecret: boolean }> {
  return api('/api/me/webhook', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** Status API key milik sendiri (tanpa nilai mentah). */
export function getMyApiKey(): Promise<{ hasApiKey: boolean; hint: string | null }> {
  return api('/api/me/api-key');
}

/** Buat API key baru (409 bila sudah ada — pakai rotateMyApiKey). */
export function createMyApiKey(): Promise<{ apiKey: string; rotated: boolean }> {
  return api('/api/me/api-key', { method: 'POST' });
}

/** Rotasi API key (key lama langsung mati, dapat key baru). */
export function rotateMyApiKey(): Promise<{ apiKey: string; rotated: boolean }> {
  return api('/api/me/api-key', { method: 'PUT' });
}

/** Hapus API key milik sendiri. */
export function deleteMyApiKey(): Promise<{ deleted: boolean }> {
  return api('/api/me/api-key', { method: 'DELETE' });
}

export type NotificationItem = {
  id: string;
  userId: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/** List notifikasi inbox milik sendiri (terbaru dulu). */
export function listNotifications(
  limit = 30,
  offset = 0,
): Promise<{ notifications: NotificationItem[]; total: number; unread: number; limit: number; offset: number }> {
  return api(`/api/notifications?limit=${limit}&offset=${offset}`);
}

/** Tandai satu notifikasi sebagai dibaca. */
export function markNotificationRead(id: string): Promise<{ read: boolean }> {
  return api('/api/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

/** Tandai semua notifikasi sebagai dibaca. */
export function markAllNotificationsRead(): Promise<{ read: number }> {
  return api('/api/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ all: true }),
  });
}

/** Broadcast admin ke semua user aktif atau user tertentu. */
export function broadcastNotification(body: {
  title: string;
  body?: string;
  link?: string;
  userIds?: number[];
}): Promise<{ sent: number }> {
  return api('/api/admin/notifications', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type TicketListItem = {
  id: number;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  hasUnread: boolean;
  lastFromAdmin: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketMessage = {
  id: string;
  fromAdmin: boolean;
  body: string;
  createdAt: string;
  sender: { id: number; username: string; fullName: string } | null;
};

export type TicketDetail = {
  id: number;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
  updatedAt: string;
  user: { id: number; username: string; fullName: string };
  messages: TicketMessage[];
};

/** Daftar tiket milik sendiri. */
export function listTickets(): Promise<{ tickets: TicketListItem[] }> {
  return api('/api/tickets');
}

/** Buat tiket baru (pesan pertama). */
export function createTicket(
  subject: string,
  message: string,
): Promise<{ ticket: Pick<TicketDetail, 'id' | 'subject' | 'status' | 'createdAt'>; preview: string }> {
  return api('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ subject, message }),
  });
}

/** Detail + thread tiket milik sendiri. */
export function getTicket(id: number): Promise<{ ticket: TicketDetail }> {
  return api(`/api/tickets/${id}`);
}

/** Balas tiket milik sendiri (409 bila sudah ditutup). */
export function replyTicket(id: number, message: string): Promise<{ replied: boolean }> {
  return api(`/api/tickets/${id}`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

/** Tutup tiket milik sendiri. */
export function closeTicket(id: number): Promise<{ closed: boolean }> {
  return api(`/api/tickets/${id}/close`, { method: 'POST' });
}

export type AdminTicketListItem = TicketListItem & {
  lastExcerpt: string | null;
  user: { id: number; username: string; fullName: string };
};

export type AdminTicketDetail = TicketDetail & { userId: number };

export type AdminTicketFilter = {
  status?: '' | 'open' | 'answered' | 'closed';
  limit?: number;
  offset?: number;
};

/** Semua tiket semua user (admin): filter status + paginasi. */
export function listAdminTickets(
  filter: AdminTicketFilter = {},
): Promise<{ tickets: AdminTicketListItem[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  params.set('limit', String(filter.limit ?? 20));
  params.set('offset', String(filter.offset ?? 0));
  return api(`/api/admin/tickets?${params.toString()}`);
}

/** Detail tiket siapa pun (admin). */
export function getAdminTicket(id: number): Promise<{ ticket: AdminTicketDetail }> {
  return api(`/api/admin/tickets/${id}`);
}

/** Admin membalas tiket (otomatis answered; closed ikut terbuka). */
export function replyAdminTicket(
  id: number,
  message: string,
): Promise<{ replied: boolean; reopened: boolean }> {
  return api(`/api/admin/tickets/${id}`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

/** Admin ubah status tiket manual. */
export function setAdminTicketStatus(
  id: number,
  status: 'open' | 'answered' | 'closed',
): Promise<{ ticket: { id: number; status: string } }> {
  return api(`/api/admin/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
