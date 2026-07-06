import { useMutation } from '@tanstack/react-query';
import type { LoginRespuestaDTO } from '@taller/shared';
import { api, tokenStore } from './client';

export function useLogin() {
  return useMutation({
    mutationFn: (password: string) =>
      api<LoginRespuestaDTO>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: (data) => tokenStore.set(data.token),
  });
}

export function logout() {
  tokenStore.clear();
  window.location.href = '/login';
}
