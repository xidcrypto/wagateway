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

export type BlastDetail = BlastItem & {
  sessionId: string;
  textBody: string;
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

export function createBlast(
  sessionId: string,
  body: { label: string; text: string; recipients: string; delayMin: number; delayMax: number },
): Promise<{ blast: BlastItem; skipped: number }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/blasts`, {
    method: 'POST',
    body: JSON.stringify(body),
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

export function listAdminSessions(): Promise<{ sessions: AdminSession[]; total: number }> {
  return api('/api/admin/sessions?limit=100');
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
