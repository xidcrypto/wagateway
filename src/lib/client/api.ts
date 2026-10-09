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
