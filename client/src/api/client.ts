// Cliente HTTP: entiende la forma estándar { data } / { error: { code, message } }.
export class ErrorApi extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${ruta}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    const err = cuerpo?.error as { code?: string; message?: string } | undefined;
    throw new ErrorApi(err?.code ?? 'ERROR', err?.message ?? `HTTP ${res.status}`, res.status);
  }
  return cuerpo.data as T;
}
