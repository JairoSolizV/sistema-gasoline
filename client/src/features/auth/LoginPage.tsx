import { useState } from 'react';
import { useLogin } from '../../api/auth';
import { ErrorApi } from '../../api/client';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const login = useLogin();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login.mutateAsync(password);
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-lateral p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-acento">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l4-2 4 2 4-2 4 2v3l-2 1v9H6v-9l-2-1z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-semibold">Taller · Pagos</div>
            <div className="text-xs text-gray-500">Panel administrativo</div>
          </div>
        </div>

        <label className="mb-1 block text-sm font-medium">Contraseña del administrador</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="••••••••"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20"
        />
        {login.error != null && (
          <p className="mt-2 text-xs text-error">
            {login.error instanceof ErrorApi ? login.error.message : 'Error al ingresar'}
          </p>
        )}
        <button
          type="submit"
          disabled={login.isPending || password === ''}
          className="mt-5 w-full rounded-lg bg-acento px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
        >
          {login.isPending ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
