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
