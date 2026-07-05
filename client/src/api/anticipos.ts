import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnticipoDTO,
  AnticipoGuardadoDTO,
  CrearAnticipoInput,
  EditarAnticipoInput,
} from '@taller/shared';
import { api } from './client';

export function useAnticipos(operarioId?: string) {
  const query = operarioId ? `?operarioId=${operarioId}` : '';
  return useQuery({
    queryKey: ['anticipos', operarioId ?? 'todos'],
    queryFn: () => api<AnticipoDTO[]>(`/anticipos${query}`),
  });
}

function invalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['anticipos'] });
}

export function useCrearAnticipo() {
  const onSuccess = invalidar();
  return useMutation({
    mutationFn: (input: CrearAnticipoInput) =>
      api<AnticipoGuardadoDTO>('/anticipos', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess,
  });
}

export function useEditarAnticipo() {
  const onSuccess = invalidar();
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: EditarAnticipoInput }) =>
      api<AnticipoGuardadoDTO>(`/anticipos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(cambios),
      }),
    onSuccess,
  });
}

export function useEliminarAnticipo() {
  const onSuccess = invalidar();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ eliminado: boolean }>(`/anticipos/${id}`, { method: 'DELETE' }),
    onSuccess,
  });
}
