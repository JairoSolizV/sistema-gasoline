// Cliente HTTP: forma estándar { data } / { error }, token JWT en localStorage.
export class ErrorApi extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const CLAVE_TOKEN = 'taller_token';

export const tokenStore = {
  get: () => localStorage.getItem(CLAVE_TOKEN),
  set: (t: string) => localStorage.setItem(CLAVE_TOKEN, t),
  clear: () => localStorage.removeItem(CLAVE_TOKEN),
};

export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`/api/v1${ruta}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    // token vencido/ausente: limpiar y mandar al login
    if (res.status === 401 && !ruta.startsWith('/auth/')) {
      tokenStore.clear();
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    const err = cuerpo?.error as { code?: string; message?: string } | undefined;
    throw new ErrorApi(err?.code ?? 'ERROR', err?.message ?? `HTTP ${res.status}`, res.status);
  }
  return cuerpo.data as T;
}
